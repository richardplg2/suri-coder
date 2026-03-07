import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    type: str
    title: str
    body: str | None
    resource_type: str | None
    resource_id: uuid.UUID | None
    read: bool
    created_at: datetime


class NotificationUpdate(BaseModel):
    read: bool


class UnreadCountResponse(BaseModel):
    count: int
