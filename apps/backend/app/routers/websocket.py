import asyncio
import logging

import redis.asyncio as aioredis
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import ValidationError

from app.config import settings
from app.models.enums import WsEvent
from app.schemas.websocket import WsClientMessage
from app.services.ws_manager import ConnectionManager

logger = logging.getLogger(__name__)

router = APIRouter(tags=["websocket"])


@router.websocket("/ws")
async def ws_endpoint(websocket: WebSocket):
    await websocket.accept()
    r = aioredis.from_url(settings.redis_url)
    manager = ConnectionManager(websocket, r)

    async def read_client():
        while True:
            raw = await websocket.receive_text()
            try:
                msg = WsClientMessage.model_validate_json(raw)
                await manager.handle_client_message(msg)
            except ValidationError as e:
                await manager._send_system(
                    WsEvent.error, data={"message": str(e)},
                )

    async def read_redis():
        while True:
            message = await manager.pubsub.get_message(
                ignore_subscribe_messages=True, timeout=0.1
            )
            if message and message["type"] == "message":
                data = message["data"]
                if isinstance(data, bytes):
                    data = data.decode()
                redis_channel = message["channel"]
                if isinstance(redis_channel, bytes):
                    redis_channel = redis_channel.decode()
                await manager.forward_redis_message(
                    redis_channel, data,
                )
            else:
                await asyncio.sleep(0.01)

    try:
        async with asyncio.TaskGroup() as tg:
            tg.create_task(read_client())
            tg.create_task(read_redis())
    except* WebSocketDisconnect:
        pass
    finally:
        await manager.cleanup()
