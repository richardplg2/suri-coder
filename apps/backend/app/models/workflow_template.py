import uuid

from sqlalchemy import JSON, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.base import TimestampMixin, UUIDMixin


class WorkflowTemplate(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "workflow_templates"

    project_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    steps_config: Mapped[dict] = mapped_column(JSON)
