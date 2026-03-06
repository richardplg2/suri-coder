import uuid

import redis.asyncio as aioredis
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.config import settings

router = APIRouter(tags=["websocket"])


@router.websocket("/ws/sessions/{session_id}")
async def session_stream(websocket: WebSocket, session_id: uuid.UUID):
    await websocket.accept()
    r = aioredis.from_url(settings.redis_url)
    pubsub = r.pubsub()
    await pubsub.subscribe(f"session:{session_id}")

    try:
        async for message in pubsub.listen():
            if message["type"] == "message":
                data = message["data"]
                if isinstance(data, bytes):
                    data = data.decode()
                await websocket.send_text(data)
    except WebSocketDisconnect:
        pass
    finally:
        await pubsub.unsubscribe(f"session:{session_id}")
        await r.aclose()


@router.websocket("/ws/tickets/{ticket_id}")
async def ticket_stream(websocket: WebSocket, ticket_id: uuid.UUID):
    await websocket.accept()
    r = aioredis.from_url(settings.redis_url)
    pubsub = r.pubsub()
    await pubsub.subscribe(f"ticket:{ticket_id}")

    try:
        async for message in pubsub.listen():
            if message["type"] == "message":
                data = message["data"]
                if isinstance(data, bytes):
                    data = data.decode()
                await websocket.send_text(data)
    except WebSocketDisconnect:
        pass
    finally:
        await pubsub.unsubscribe(f"ticket:{ticket_id}")
        await r.aclose()
