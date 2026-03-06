import uuid
from sqlalchemy import String, Text, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base
from app.models.base import UUIDMixin, TimestampMixin

class FigmaTask(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "figma_tasks"

    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sessions.id", ondelete="CASCADE"))
    figma_url: Mapped[str] = mapped_column(String(512))
    status: Mapped[str] = mapped_column(String(20), default="pending")
    result: Mapped[dict | None] = mapped_column(JSON, nullable=True)

class FigmaNode(UUIDMixin, Base):
    __tablename__ = "figma_nodes"

    figma_task_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("figma_tasks.id", ondelete="CASCADE"))
    node_id: Mapped[str] = mapped_column(String(255))
    node_name: Mapped[str] = mapped_column(String(255))
    node_type: Mapped[str] = mapped_column(String(100))
    properties: Mapped[dict | None] = mapped_column(JSON, nullable=True)
