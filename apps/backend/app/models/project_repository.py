import uuid
from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.base import UUIDMixin


class ProjectRepository(UUIDMixin, Base):
    __tablename__ = "project_repositories"

    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    github_account_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("user_github_accounts.id", ondelete="CASCADE")
    )
    github_repo_id: Mapped[int] = mapped_column(BigInteger)
    repo_full_name: Mapped[str] = mapped_column(String(512))
    repo_url: Mapped[str] = mapped_column(String(512))
    default_branch: Mapped[str] = mapped_column(String(255), default="main")
    is_private: Mapped[bool] = mapped_column(Boolean, default=False)
    connected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    connected_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
