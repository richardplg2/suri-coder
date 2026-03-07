import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class SpecReferenceCreate(BaseModel):
    target_spec_id: uuid.UUID
    ref_type: str  # derives_from, implements, verifies, relates_to
    section: str | None = None


class SpecCreate(BaseModel):
    type: str  # feature, design, plan, test
    title: str
    content: str
    references: list[SpecReferenceCreate] | None = None


class SpecUpdate(BaseModel):
    content: str
    title: str | None = None


class SpecReferenceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    source_spec_id: uuid.UUID
    target_spec_id: uuid.UUID
    ref_type: str
    section: str | None


class SpecResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    ticket_id: uuid.UUID
    type: str
    title: str
    content: str
    revision: int
    created_by: uuid.UUID
    agent_step_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime


class SpecDetailResponse(SpecResponse):
    source_references: list[SpecReferenceResponse]
    target_references: list[SpecReferenceResponse]
