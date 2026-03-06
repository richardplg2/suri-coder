import uuid
from sqlalchemy import String, Text, Integer, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from app.models.base import UUIDMixin, TimestampMixin

class ReviewSession(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "review_sessions"

    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sessions.id", ondelete="CASCADE"))
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending, in_progress, approved, changes_requested
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)

    file_reviews: Mapped[list["FileReview"]] = relationship(cascade="all, delete-orphan")

class FileReview(UUIDMixin, Base):
    __tablename__ = "file_reviews"

    review_session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("review_sessions.id", ondelete="CASCADE"))
    file_path: Mapped[str] = mapped_column(String(512))
    status: Mapped[str] = mapped_column(String(20))  # approved, changes_requested, comment
    comments: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # [{line: int, comment: str, severity: str}]
