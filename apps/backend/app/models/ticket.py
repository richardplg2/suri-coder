from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, JSON, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin, UUIDMixin
from app.models.enums import TicketPriority, TicketSource, TicketStatus, TicketType

if TYPE_CHECKING:
    from app.models.ticket_spec import TicketSpec
    from app.models.workflow_step import WorkflowStep


class Ticket(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "tickets"

    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE")
    )
    key: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(500))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    type: Mapped[TicketType] = mapped_column(default=TicketType.feature)
    status: Mapped[TicketStatus] = mapped_column(default=TicketStatus.backlog)
    priority: Mapped[TicketPriority] = mapped_column(default=TicketPriority.none)
    template_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("workflow_templates.id"), nullable=True
    )
    assignee_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )
    budget_usd: Mapped[float | None] = mapped_column(
        Numeric(10, 2), nullable=True
    )
    auto_execute: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    auto_approval: Mapped[bool] = mapped_column(Boolean, default=False)
    source: Mapped[TicketSource] = mapped_column(default=TicketSource.manual)
    figma_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    steps: Mapped[list["WorkflowStep"]] = relationship(
        back_populates="ticket", cascade="all, delete-orphan"
    )
    specs: Mapped[list["TicketSpec"]] = relationship(
        back_populates="ticket", cascade="all, delete-orphan"
    )
