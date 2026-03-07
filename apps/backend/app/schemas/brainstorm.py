import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class QuizOption(BaseModel):
    id: str
    label: str
    description: str
    recommended: bool = False
    recommendation_reason: str | None = None


class QuizData(BaseModel):
    question: str
    context: str
    options: list[QuizOption]
    allow_multiple: bool = False
    allow_custom: bool = True


class BrainstormStartRequest(BaseModel):
    source: str  # "ai" or "figma"
    initial_message: str | None = None
    figma_data: dict | None = None


class BrainstormMessageRequest(BaseModel):
    content: str | None = None
    quiz_response: dict | None = None  # { option_ids: [], custom_text: "" }


class BrainstormBatchUpdateRequest(BaseModel):
    comments: list[dict]  # [{ section_id, text }]


class CreateTicketFromBrainstormRequest(BaseModel):
    title: str
    type: str  # feature, bug, etc
    priority: str  # none, low, medium, high, urgent
    template_id: uuid.UUID | None = None


class BrainstormMessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    session_id: str
    role: str
    content: str | None
    message_type: str
    structured_data: dict | None
    created_at: datetime


class BrainstormSessionResponse(BaseModel):
    session_id: str
    first_message: BrainstormMessageResponse | None = None
