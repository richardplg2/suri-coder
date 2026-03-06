import uuid

from sqlalchemy import ForeignKey, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import UUIDMixin, TimestampMixin
from app.models.user import User


class Project(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "projects"

    name: Mapped[str] = mapped_column(String(255))
    slug: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    path: Mapped[str] = mapped_column(String(512))
    repo_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    settings: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))

    members: Mapped[list["ProjectMember"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )


class ProjectMember(Base):
    __tablename__ = "project_members"
    __table_args__ = (UniqueConstraint("project_id", "user_id"),)

    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id"), primary_key=True
    )
    role: Mapped[str] = mapped_column(String(20), default="member")

    project: Mapped["Project"] = relationship(back_populates="members")
    user: Mapped["User"] = relationship()
