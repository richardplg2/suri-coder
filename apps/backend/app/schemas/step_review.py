import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class StepReviewResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    step_id: uuid.UUID
    revision: int
    diff_content: str | None
    comments: list | None
    status: str
    created_at: datetime


class RequestChangesRequest(BaseModel):
    comments: list[dict]  # [{file: str, line: int, comment: str}]


class RegenerateRequest(BaseModel):
    section_comments: dict[str, str]  # {section_key: "comment text"}
