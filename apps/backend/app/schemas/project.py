import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ProjectCreate(BaseModel):
    name: str
    slug: str
    path: str
    repo_url: str | None = None
    description: str | None = None
    settings: dict | None = None


class ProjectUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    path: str | None = None
    repo_url: str | None = None
    settings: dict | None = None


class ProjectMemberCreate(BaseModel):
    user_id: uuid.UUID
    role: str = "member"


class ProjectResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    path: str
    repo_url: str | None = None
    description: str | None = None
    settings: dict | None = None
    created_by: uuid.UUID
    created_at: datetime
    member_count: int = 0

    model_config = ConfigDict(from_attributes=True)
