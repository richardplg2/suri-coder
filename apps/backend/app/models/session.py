from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import UUIDMixin


class Session(UUIDMixin, Base):
    __tablename__ = "sessions"

    # Existing fields (step_id now nullable)
    step_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("workflow_steps.id", ondelete="SET NULL"),
        nullable=True,
    )
    status: Mapped[str] = mapped_column(
        String(20), default="created"
    )
    git_branch: Mapped[str | None] = mapped_column(String(255), nullable=True)
    git_commit_sha: Mapped[str | None] = mapped_column(String(40), nullable=True)
    worktree_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    cli_session_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    cost_usd: Mapped[float | None] = mapped_column(Numeric(10, 4), nullable=True)
    tokens_used: Mapped[int | None] = mapped_column(Integer, nullable=True)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    finished_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    exit_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    # New fields
    project_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=True
    )
    ticket_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("tickets.id", ondelete="SET NULL"), nullable=True
    )
    agent_config_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("agent_configs.id", ondelete="RESTRICT"), nullable=True
    )
    parent_session_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("sessions.id", ondelete="SET NULL"), nullable=True
    )
    conversation_history: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    total_input_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total_output_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Relationships
    messages: Mapped[list[SessionMessage]] = relationship(
        cascade="all, delete-orphan", order_by="SessionMessage.timestamp"
    )
    events: Mapped[list["SessionEvent"]] = relationship(  # noqa: F821, UP037
        cascade="all, delete-orphan",
        order_by="SessionEvent.sequence",
        foreign_keys="SessionEvent.session_id",
    )


class SessionMessage(UUIDMixin, Base):
    __tablename__ = "session_messages"

    session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("sessions.id", ondelete="CASCADE")
    )
    role: Mapped[str] = mapped_column(String(20))  # "user", "assistant", "tool"
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    tool_use: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
