from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import JSON, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin, UUIDMixin
from app.models.enums import BrainstormMessageType, BrainstormRole

if TYPE_CHECKING:
    from app.models.ticket import Ticket


class BrainstormMessage(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "brainstorm_messages"

    ticket_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("tickets.id", ondelete="CASCADE"), nullable=True, index=True
    )
    session_id: Mapped[str] = mapped_column(String(255), index=True)
    role: Mapped[BrainstormRole] = mapped_column()
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    message_type: Mapped[BrainstormMessageType] = mapped_column(
        default=BrainstormMessageType.text
    )
    structured_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    ticket: Mapped["Ticket | None"] = relationship()
