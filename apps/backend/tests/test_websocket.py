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
    async def test_cleanup_unsubscribes_all(self, mock_websocket, mock_redis):
        manager = ConnectionManager(mock_websocket, mock_redis)
        await manager.subscribe(WsChannel.session_stream, {"session_id": "a"})
        await manager.subscribe(WsChannel.ticket_progress, {"ticket_id": "b"})

        await manager.cleanup()

        assert len(manager.subscriptions) == 0
