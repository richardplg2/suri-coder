import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agent_config import AgentConfig
from app.models.session import Session


async def build_agent_options(
    db: AsyncSession, session: Session, agent_config: AgentConfig, cwd: str
) -> dict:
    """Build options dict for Claude Code SDK execution."""
    return {
        "system_prompt": agent_config.system_prompt,
        "model": agent_config.claude_model,
        "tools": agent_config.tools_list,
        "mcp_servers": agent_config.mcp_servers,
        "max_turns": agent_config.max_turns,
        "cwd": cwd,
    }


async def run_agent(session_id: uuid.UUID, options: dict):
    """Execute a Claude Code SDK session. Placeholder for ARQ worker."""
    # This will be called by the ARQ worker
    # Actual implementation depends on claude_agent_sdk availability
    pass
