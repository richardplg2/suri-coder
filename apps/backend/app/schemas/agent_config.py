import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AgentConfigCreate(BaseModel):
    name: str
    description: str | None = None
    system_prompt: str
    claude_model: str
    tools_list: list | None = None
    mcp_servers: dict | None = None
    tools_config: dict | None = None
    max_turns: int = 25
    skill_ids: list[uuid.UUID] | None = None


class AgentConfigUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    system_prompt: str | None = None
    claude_model: str | None = None
    tools_list: list | None = None
    mcp_servers: dict | None = None
    tools_config: dict | None = None
    max_turns: int | None = None
    skill_ids: list[uuid.UUID] | None = None


class AgentConfigResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID | None
    name: str
    description: str | None
    system_prompt: str
    claude_model: str
    tools_list: list | None
    mcp_servers: dict | None
    tools_config: dict | None
    max_turns: int
    created_at: datetime
