from __future__ import annotations

import json
import logging

import redis.asyncio as aioredis
from fastapi import WebSocket

from app.models.enums import WsAction, WsChannel, WsEvent
from app.schemas.websocket import SYSTEM_CHANNEL, WsClientMessage, WsServerMessage

logger = logging.getLogger(__name__)

CHANNEL_TO_REDIS_KEY: dict[WsChannel, callable] = {
    WsChannel.project_tickets: lambda p: f"project:{p['project_id']}:tickets",
    WsChannel.ticket_progress: lambda p: f"ticket:{p['ticket_id']}",
    WsChannel.session_stream: lambda p: f"session:{p['session_id']}",
}

REDIS_PREFIX_TO_CHANNEL: dict[str, WsChannel] = {
    "project:": WsChannel.project_tickets,
    "ticket:": WsChannel.ticket_progress,
    "session:": WsChannel.session_stream,
}


def _make_ref(channel: WsChannel, params: dict[str, str]) -> str:
    """Build a ref string like 'session:stream:abc-123'."""
    param_val = next(iter(params.values()), "")
    return f"{channel.value}:{param_val}"


class ConnectionManager:
    def __init__(self, websocket: WebSocket, redis: aioredis.Redis):
        self.websocket = websocket
        self.redis = redis
        self.pubsub = redis.pubsub()
        # redis_key -> (channel, ref)
        self.subscriptions: dict[str, tuple[WsChannel, str]] = {}

    async def subscribe(self, channel: WsChannel, params: dict[str, str]) -> None:
        try:
            redis_key = CHANNEL_TO_REDIS_KEY[channel](params)
        except KeyError:
            msg = f"missing params for {channel.value}"
            await self._send_system(
                WsEvent.error, data={"message": msg},
            )
            return

        ref = _make_ref(channel, params)
        await self.pubsub.subscribe(redis_key)
        self.subscriptions[redis_key] = (channel, ref)
        await self._send_system(WsEvent.subscribed, ref=ref)

    async def unsubscribe(self, channel: WsChannel, params: dict[str, str]) -> None:
        try:
            redis_key = CHANNEL_TO_REDIS_KEY[channel](params)
        except KeyError:
            msg = f"missing params for {channel.value}"
            await self._send_system(
                WsEvent.error, data={"message": msg},
            )
            return

        ref = _make_ref(channel, params)
        await self.pubsub.unsubscribe(redis_key)
        self.subscriptions.pop(redis_key, None)
        await self._send_system(WsEvent.unsubscribed, ref=ref)

    async def handle_client_message(self, msg: WsClientMessage) -> None:
        if msg.action == WsAction.ping:
            await self._send_system(WsEvent.pong)
        elif msg.action == WsAction.subscribe:
            if msg.channel is None:
                await self._send_system(
                    WsEvent.error,
                    data={"message": "channel required"},
                )
                return
            await self.subscribe(msg.channel, msg.params or {})
        elif msg.action == WsAction.unsubscribe:
            if msg.channel is None:
                await self._send_system(
                    WsEvent.error,
                    data={"message": "channel required"},
                )
                return
            await self.unsubscribe(msg.channel, msg.params or {})

    async def forward_redis_message(self, redis_key: str, data: str) -> None:
        """Forward a Redis pubsub message to the WebSocket client."""
        sub = self.subscriptions.get(redis_key)
        if not sub:
            return

        channel, ref = sub
        try:
            payload = json.loads(data)
            event = payload.get("event", "message")
            event_data = payload.get("data")
        except (json.JSONDecodeError, AttributeError):
            event = "message"
            event_data = data

        msg = WsServerMessage(
            channel=channel.value,
            ref=ref,
            event=WsEvent(event),
            data=event_data,
        )
        await self.websocket.send_text(msg.model_dump_json())

    async def cleanup(self) -> None:
        for key in list(self.subscriptions):
            await self.pubsub.unsubscribe(key)
        self.subscriptions.clear()
        await self.redis.aclose()

    async def _send_system(
        self, event: WsEvent, ref: str | None = None, data: dict | None = None
    ) -> None:
        msg = WsServerMessage(
            channel=SYSTEM_CHANNEL, ref=ref, event=event, data=data
        )
        await self.websocket.send_text(msg.model_dump_json())
