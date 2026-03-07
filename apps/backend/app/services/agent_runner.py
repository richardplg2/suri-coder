import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agent_config import AgentConfig
from app.models.ticket import Ticket
from app.models.workflow_step import WorkflowStep


class AgentRunner:
    """Manages Claude SDK agent execution and active session tracking."""

    _active_sessions: dict[uuid.UUID, Any] = {}

    def __init__(self, db: AsyncSession):
        self.db = db

    async def build_agent_options(
        self,
        step: WorkflowStep,
        agent_config: AgentConfig,
        cwd: str,
        brainstorm_schema: dict | None = None,
    ) -> dict:
        """Build options dict for Claude Code SDK execution."""
        ticket = await self.db.get(Ticket, step.ticket_id)

        options = {
            "system_prompt": agent_config.system_prompt,
            "model": agent_config.claude_model,
            "tools": agent_config.tools_list,
            "mcp_servers": agent_config.mcp_servers,
            "max_turns": agent_config.max_turns,
            "cwd": cwd,
            "permission_mode": "acceptEdits",
            "setting_sources": ["project"],
            "include_partial_messages": True,
        }

        if ticket and ticket.budget_usd:
            options["max_budget_usd"] = float(ticket.budget_usd)

        if brainstorm_schema:
            options["output_format"] = {
                "type": "json_schema",
                "schema": brainstorm_schema,
            }

        return options

    def register_session(self, step_id: uuid.UUID, client: Any) -> None:
        """Register an active SDK client for follow-up queries."""
        self._active_sessions[step_id] = client

    def get_session(self, step_id: uuid.UUID) -> Any | None:
        """Get active SDK client for a step."""
        return self._active_sessions.get(step_id)

    def remove_session(self, step_id: uuid.UUID) -> None:
        """Remove active SDK client when step completes."""
        self._active_sessions.pop(step_id, None)
