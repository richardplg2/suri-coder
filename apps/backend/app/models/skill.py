from sqlalchemy import Boolean, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.base import TimestampMixin, UUIDMixin


class Skill(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "skills"

    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    content: Mapped[str] = mapped_column(Text)
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    is_template: Mapped[bool] = mapped_column(Boolean, default=False)
