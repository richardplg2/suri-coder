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


class SessionEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    session_id: uuid.UUID
    sequence: int
    event_type: str
    role: str | None
    content: dict
    created_at: datetime


class UnifiedSessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    status: str
    project_id: uuid.UUID | None
    ticket_id: uuid.UUID | None
    agent_config_id: uuid.UUID | None
    step_id: uuid.UUID | None
    parent_session_id: uuid.UUID | None
    cost_usd: float | None
    total_input_tokens: int | None
    total_output_tokens: int | None
    started_at: datetime
    finished_at: datetime | None
    error_message: str | None


class CreateSessionRequest(BaseModel):
    agent_config_id: uuid.UUID
    ticket_id: uuid.UUID | None = None
    workflow_step_id: uuid.UUID | None = None


class StartSessionRequest(BaseModel):
    prompt: str


class SendMessageRequest(BaseModel):
    content: str
