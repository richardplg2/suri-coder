from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin, UUIDMixin
from app.models.enums import SpecRefType, SpecType

if TYPE_CHECKING:
    from app.models.ticket import Ticket
    from app.models.user import User
    from app.models.workflow_step import WorkflowStep


class TicketSpec(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "ticket_specs"

    ticket_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tickets.id", ondelete="CASCADE"), index=True
    )
    type: Mapped[SpecType] = mapped_column()
    title: Mapped[str] = mapped_column(String(255))
    content: Mapped[str] = mapped_column(Text)
    revision: Mapped[int] = mapped_column(Integer, default=1)
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    agent_step_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("workflow_steps.id"), nullable=True
    )

    # Relationships
    ticket: Mapped["Ticket"] = relationship(back_populates="specs")
    creator: Mapped["User"] = relationship()
    agent_step: Mapped["WorkflowStep | None"] = relationship()
    source_references: Mapped[list["TicketSpecReference"]] = relationship(
        foreign_keys="TicketSpecReference.source_spec_id",
        back_populates="source_spec",
        cascade="all, delete-orphan",
    )
    target_references: Mapped[list["TicketSpecReference"]] = relationship(
        foreign_keys="TicketSpecReference.target_spec_id",
        back_populates="target_spec",
        cascade="all, delete-orphan",
    )
