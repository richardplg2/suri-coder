from __future__ import annotations

from typing import Any

from pydantic import BaseModel

from app.models.enums import WsAction, WsChannel, WsEvent


class WsClientMessage(BaseModel):
    action: WsAction
    channel: WsChannel | None = None
    params: dict[str, str] | None = None


class WsServerMessage(BaseModel):
    channel: str  # WsChannel value or "_system"
    ref: str | None = None
    event: WsEvent
    data: Any | None = None


SYSTEM_CHANNEL = "_system"
