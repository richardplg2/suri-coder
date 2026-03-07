import uuid

from sqlalchemy import ForeignKey, Integer, JSON, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.base import TimestampMixin, UUIDMixin
from app.models.enums import ReviewStatus


class StepReview(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "step_reviews"

    step_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("workflow_steps.id", ondelete="CASCADE")
    )
    revision: Mapped[int] = mapped_column(Integer, default=1)
    diff_content: Mapped[str | None] = mapped_column(Text, nullable=True)
    comments: Mapped[list | None] = mapped_column(JSON, nullable=True)
    status: Mapped[ReviewStatus] = mapped_column(default=ReviewStatus.pending)
