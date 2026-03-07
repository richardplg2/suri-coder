import uuid

from sqlalchemy import BigInteger, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.base import TimestampMixin, UUIDMixin


class UserGitHubAccount(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "user_github_accounts"
    __table_args__ = (
        UniqueConstraint("user_id", "github_user_id", name="uq_github_account_user_gh"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE")
    )
    github_user_id: Mapped[int] = mapped_column(BigInteger)
    username: Mapped[str] = mapped_column(String(255))
    display_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    access_token: Mapped[str] = mapped_column(Text)
    scopes: Mapped[str] = mapped_column(String(512), default="")
