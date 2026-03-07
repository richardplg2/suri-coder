from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin, UUIDMixin
from app.models.enums import StepStatus

if TYPE_CHECKING:
    from app.models.ticket import Ticket


class WorkflowStep(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "workflow_steps"

    ticket_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tickets.id", ondelete="CASCADE")
    )
    template_step_id: Mapped[str] = mapped_column(String(100))
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    agent_config_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("agent_configs.id"), nullable=True
    )
    status: Mapped[StepStatus] = mapped_column(default=StepStatus.pending)
    config: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    order: Mapped[int] = mapped_column(Integer, default=0)
    requires_approval: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    user_prompt_override: Mapped[str | None] = mapped_column(Text, nullable=True)
    brainstorm_output: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    step_breakdown: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    auto_approval: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    retry_count: Mapped[int] = mapped_column(Integer, default=0)
    max_retries: Mapped[int] = mapped_column(Integer, default=2)
    parent_step_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("workflow_steps.id"), nullable=True
    )
    repo_ids: Mapped[list | None] = mapped_column(JSON, nullable=True)

    ticket: Mapped["Ticket"] = relationship(back_populates="steps")
    dependencies: Mapped[list["WorkflowStepDependency"]] = relationship(
        foreign_keys="WorkflowStepDependency.step_id",
        cascade="all, delete-orphan",
    )


class WorkflowStepDependency(Base):
    __tablename__ = "workflow_step_dependencies"

    step_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("workflow_steps.id", ondelete="CASCADE"), primary_key=True
    )
    depends_on_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("workflow_steps.id", ondelete="CASCADE"), primary_key=True
    )
