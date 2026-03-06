import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.enums import (
    StepStatus,
    TicketPriority,
    TicketStatus,
    TicketType,
)


class TicketCreate(BaseModel):
    title: str
    description: str | None = None
    type: TicketType = TicketType.feature
    priority: TicketPriority = TicketPriority.none
    template_id: uuid.UUID | None = None
    assignee_id: uuid.UUID | None = None
    budget_usd: float | None = None


class TicketUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    type: TicketType | None = None
    status: TicketStatus | None = None
    priority: TicketPriority | None = None
    assignee_id: uuid.UUID | None = None
    budget_usd: float | None = None


class WorkflowStepResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    template_step_id: str
    name: str
    description: str | None
    agent_config_id: uuid.UUID | None
    status: StepStatus
    order: int


class TicketResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    key: str
    title: str
    description: str | None
    type: TicketType
    status: TicketStatus
    priority: TicketPriority
    template_id: uuid.UUID | None
    assignee_id: uuid.UUID | None
    budget_usd: float | None
    created_by: uuid.UUID
    created_at: datetime
    steps: list[WorkflowStepResponse] = []


class TicketListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    key: str
    title: str
    type: TicketType
    status: TicketStatus
    priority: TicketPriority
    assignee_id: uuid.UUID | None
    created_at: datetime
