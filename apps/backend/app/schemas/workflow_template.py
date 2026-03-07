import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class StepConfig(BaseModel):
    id: str
    agent: str
    depends_on: list[str] = []
    description: str = ""
    condition: str | None = None
    expandable: bool = False


class StepsConfigSchema(BaseModel):
    steps: list[StepConfig]


class WorkflowTemplateCreate(BaseModel):
    name: str
    description: str | None = None
    steps_config: StepsConfigSchema


class WorkflowTemplateUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    steps_config: StepsConfigSchema | None = None


class WorkflowTemplateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID | None
    name: str
    description: str | None
    steps_config: dict
    created_at: datetime
