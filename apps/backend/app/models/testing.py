import uuid
from datetime import datetime
from sqlalchemy import String, Text, Integer, ForeignKey, JSON, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from app.models.base import UUIDMixin, TimestampMixin

class TestRun(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "test_runs"

    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sessions.id", ondelete="CASCADE"))
    command: Mapped[str] = mapped_column(String(512))
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending, running, passed, failed
    total_tests: Mapped[int] = mapped_column(Integer, default=0)
    passed: Mapped[int] = mapped_column(Integer, default=0)
    failed: Mapped[int] = mapped_column(Integer, default=0)
    skipped: Mapped[int] = mapped_column(Integer, default=0)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)

    results: Mapped[list["TestResult"]] = relationship(cascade="all, delete-orphan")

class TestResult(UUIDMixin, Base):
    __tablename__ = "test_results"

    test_run_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("test_runs.id", ondelete="CASCADE"))
    test_name: Mapped[str] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(String(20))  # passed, failed, skipped, error
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    stack_trace: Mapped[str | None] = mapped_column(Text, nullable=True)
