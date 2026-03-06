import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.models.enums import WsAction, WsChannel, WsEvent
from app.schemas.websocket import SYSTEM_CHANNEL, WsClientMessage, WsServerMessage
from app.services.ws_manager import CHANNEL_TO_REDIS_KEY, ConnectionManager


@pytest.fixture
def mock_websocket():
    ws = AsyncMock()
    ws.send_text = AsyncMock()
    return ws


@pytest.fixture
def mock_redis():
    r = AsyncMock()
    r.pubsub = MagicMock(return_value=AsyncMock())
    return r


class TestChannelToRedisKey:
    def test_project_tickets(self):
        key = CHANNEL_TO_REDIS_KEY[WsChannel.project_tickets]({"project_id": "abc"})
        assert key == "project:abc:tickets"

    def test_ticket_progress(self):
        key = CHANNEL_TO_REDIS_KEY[WsChannel.ticket_progress]({"ticket_id": "def"})
        assert key == "ticket:def"

    def test_session_stream(self):
        key = CHANNEL_TO_REDIS_KEY[WsChannel.session_stream]({"session_id": "ghi"})
        assert key == "session:ghi"


class TestConnectionManager:
    @pytest.mark.asyncio
    async def test_subscribe_sends_confirmation(self, mock_websocket, mock_redis):
        manager = ConnectionManager(mock_websocket, mock_redis)
        await manager.subscribe(WsChannel.session_stream, {"session_id": "abc-123"})

        mock_redis.pubsub().subscribe.assert_called_once_with("session:abc-123")
        assert "session:abc-123" in manager.subscriptions

        sent = json.loads(mock_websocket.send_text.call_args[0][0])
        assert sent["channel"] == SYSTEM_CHANNEL
        assert sent["event"] == WsEvent.subscribed.value
        assert sent["ref"] == "session:stream:abc-123"

    @pytest.mark.asyncio
    async def test_unsubscribe_sends_confirmation(self, mock_websocket, mock_redis):
        manager = ConnectionManager(mock_websocket, mock_redis)
        # Subscribe first
        await manager.subscribe(WsChannel.session_stream, {"session_id": "abc-123"})
        mock_websocket.send_text.reset_mock()

        await manager.unsubscribe(WsChannel.session_stream, {"session_id": "abc-123"})

        mock_redis.pubsub().unsubscribe.assert_called_once_with("session:abc-123")
        assert "session:abc-123" not in manager.subscriptions

        sent = json.loads(mock_websocket.send_text.call_args[0][0])
        assert sent["channel"] == SYSTEM_CHANNEL
        assert sent["event"] == WsEvent.unsubscribed.value

    @pytest.mark.asyncio
    async def test_ping_sends_pong(self, mock_websocket, mock_redis):
        manager = ConnectionManager(mock_websocket, mock_redis)
        await manager.handle_client_message(
            WsClientMessage(action=WsAction.ping)
        )

        sent = json.loads(mock_websocket.send_text.call_args[0][0])
        assert sent["channel"] == SYSTEM_CHANNEL
        assert sent["event"] == WsEvent.pong.value

    @pytest.mark.asyncio
    async def test_subscribe_invalid_channel_sends_error(self, mock_websocket, mock_redis):
        manager = ConnectionManager(mock_websocket, mock_redis)
        # Missing required params
        await manager.subscribe(WsChannel.session_stream, {})

        sent = json.loads(mock_websocket.send_text.call_args[0][0])
        assert sent["channel"] == SYSTEM_CHANNEL
        assert sent["event"] == WsEvent.error.value

    @pytest.mark.asyncio
    async def test_handle_subscribe_via_client_message(self, mock_websocket, mock_redis):
        manager = ConnectionManager(mock_websocket, mock_redis)
        await manager.handle_client_message(
            WsClientMessage(
                action=WsAction.subscribe,
                channel=WsChannel.session_stream,
                params={"session_id": "x"},
            )
        )

        assert "session:x" in manager.subscriptions

    @pytest.mark.asyncio
    async def test_handle_subscribe_missing_channel(self, mock_websocket, mock_redis):
        manager = ConnectionManager(mock_websocket, mock_redis)
        await manager.handle_client_message(
            WsClientMessage(action=WsAction.subscribe)
        )

        sent = json.loads(mock_websocket.send_text.call_args[0][0])
        assert sent["event"] == WsEvent.error.value
        assert "channel required" in sent["data"]["message"]

    @pytest.mark.asyncio
    async def test_handle_unsubscribe_via_client_message(self, mock_websocket, mock_redis):
        manager = ConnectionManager(mock_websocket, mock_redis)
        await manager.subscribe(WsChannel.session_stream, {"session_id": "x"})
        await manager.handle_client_message(
            WsClientMessage(
                action=WsAction.unsubscribe,
                channel=WsChannel.session_stream,
                params={"session_id": "x"},
            )
        )

        assert "session:x" not in manager.subscriptions


class TestForwardRedisMessage:
    @pytest.mark.asyncio
    async def test_forward_valid_json(self, mock_websocket, mock_redis):
        manager = ConnectionManager(mock_websocket, mock_redis)
        await manager.subscribe(WsChannel.session_stream, {"session_id": "a"})
        mock_websocket.send_text.reset_mock()

        payload = json.dumps({"event": "message", "data": {"text": "hello"}})
        await manager.forward_redis_message("session:a", payload)

        sent = json.loads(mock_websocket.send_text.call_args[0][0])
        assert sent["event"] == "message"
        assert sent["data"] == {"text": "hello"}
        assert sent["channel"] == WsChannel.session_stream.value

    @pytest.mark.asyncio
    async def test_forward_invalid_json_falls_back(self, mock_websocket, mock_redis):
        manager = ConnectionManager(mock_websocket, mock_redis)
        await manager.subscribe(WsChannel.session_stream, {"session_id": "a"})
        mock_websocket.send_text.reset_mock()

        await manager.forward_redis_message("session:a", "plain text")

        sent = json.loads(mock_websocket.send_text.call_args[0][0])
        assert sent["event"] == "message"
        assert sent["data"] == "plain text"

    @pytest.mark.asyncio
    async def test_forward_unknown_event_drops(self, mock_websocket, mock_redis):
        manager = ConnectionManager(mock_websocket, mock_redis)
        await manager.subscribe(WsChannel.session_stream, {"session_id": "a"})
        mock_websocket.send_text.reset_mock()

        payload = json.dumps({"event": "nonexistent_event", "data": {}})
        await manager.forward_redis_message("session:a", payload)

        mock_websocket.send_text.assert_not_called()

    @pytest.mark.asyncio
    async def test_forward_unsubscribed_key_noop(self, mock_websocket, mock_redis):
        manager = ConnectionManager(mock_websocket, mock_redis)

        payload = json.dumps({"event": "message", "data": {}})
        await manager.forward_redis_message("session:unknown", payload)

        mock_websocket.send_text.assert_not_called()

    @pytest.mark.asyncio
    async def test_cleanup_unsubscribes_all(self, mock_websocket, mock_redis):
        manager = ConnectionManager(mock_websocket, mock_redis)
        await manager.subscribe(WsChannel.session_stream, {"session_id": "a"})
        await manager.subscribe(WsChannel.ticket_progress, {"ticket_id": "b"})

        await manager.cleanup()

        assert len(manager.subscriptions) == 0
