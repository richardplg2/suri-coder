import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class SkillCreate(BaseModel):
    name: str
    description: str | None = None
    content: str
    category: str | None = None
    is_template: bool = False


class SkillUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    content: str | None = None
    category: str | None = None
    is_template: bool | None = None


class SkillResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: str | None
    content: str
    category: str | None
    is_template: bool
    created_at: datetime
