import uuid

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.base import UUIDMixin, TimestampMixin
from app.models.enums import UserRole


class User(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    avatar_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    role: Mapped[UserRole] = mapped_column(default=UserRole.member)
    hashed_password: Mapped[str] = mapped_column(String(255))
