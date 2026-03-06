import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class SessionMessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    role: str
    content: str | None
    tool_use: dict | None
    timestamp: datetime


class SessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    step_id: uuid.UUID
    status: str
    git_branch: str | None
    cost_usd: float | None
    tokens_used: int | None
    started_at: datetime
    finished_at: datetime | None
    exit_code: int | None
    error_message: str | None


class SessionDetailResponse(SessionResponse):
    messages: list[SessionMessageResponse] = []
