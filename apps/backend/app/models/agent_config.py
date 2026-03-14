import uuid

from sqlalchemy import (
    JSON,
    Boolean,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin, UUIDMixin


class AgentSkill(Base):
    __tablename__ = "agent_skills"

    agent_config_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("agent_configs.id", ondelete="CASCADE"), primary_key=True
    )
    skill_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("skills.id"), primary_key=True
    )
    priority: Mapped[int] = mapped_column(Integer, default=0)


class AgentConfig(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "agent_configs"
    __table_args__ = (UniqueConstraint("project_id", "name"),)

    project_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=True
    )  # null = global
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    system_prompt: Mapped[str] = mapped_column(Text)
    claude_model: Mapped[str] = mapped_column(String(50))  # "opus", "sonnet", "haiku"
    tools_list: Mapped[list | None] = mapped_column(JSON, nullable=True)
    mcp_servers: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    tools_config: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    max_turns: Mapped[int] = mapped_column(Integer, default=25)
    default_requires_approval: Mapped[bool] = mapped_column(Boolean, default=False)
    agent_type: Mapped[str] = mapped_column(String(50), default="backend")
    output_format: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    skills: Mapped[list["AgentSkill"]] = relationship(cascade="all, delete-orphan")
