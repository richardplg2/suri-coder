from __future__ import annotations

import json
import logging
from typing import TYPE_CHECKING, Any, Literal

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.strategies.base import AgentStrategy
from app.services.strategies.registry import register_strategy

if TYPE_CHECKING:
    from app.models.agent_config import AgentConfig
    from app.models.session import Session

logger = logging.getLogger(__name__)


class BrainstormStrategy(AgentStrategy):
    """Strategy for brainstorm sessions (claude_agent_sdk, single-turn per call)."""

    def get_sdk_type(self) -> Literal["claude_code", "claude_agent"]:
        return "claude_agent"

    def build_sdk_options(
        self, session: Session, agent_config: AgentConfig
    ) -> dict:
        options: dict[str, Any] = {
            "system_prompt": agent_config.system_prompt,
            "max_turns": 1,  # brainstorm is single-turn per query
        }
        if agent_config.output_format:
            options["output_format"] = agent_config.output_format
        if agent_config.mcp_servers:
            options["mcp_servers"] = agent_config.mcp_servers
        return options

    def process_event(self, event: Any) -> dict | None:
        """Parse structured output from claude_agent_sdk result."""
        output = self._extract_output(event)
        if output is None:
            return None

        schema_type = output.get("message_type", "text")
        return {
            "event_type": "structured_output",
            "role": "assistant",
            "content": {
                "schema_type": schema_type,
                "data": output,
            },
        }

    async def on_session_complete(
        self, session: Session, db: AsyncSession
    ) -> None:
        # Brainstorm sessions don't auto-complete — user triggers summary
        pass

    def _extract_output(self, event: Any) -> dict | None:
        """Parse SDK result into a structured dict. Returns None on failure."""
        try:
            raw = None
            if hasattr(event, "output"):
                raw = event.output
            elif hasattr(event, "result"):
                raw = event.result
            else:
                raw = str(event) if event else None

            if isinstance(raw, str):
                parsed = json.loads(raw)
            elif isinstance(raw, dict):
                parsed = raw
            else:
                parsed = {"message_type": "text", "content": str(raw) if raw else ""}

            return parsed if isinstance(parsed, dict) else None

        except (json.JSONDecodeError, AttributeError, TypeError):
            logger.warning(
                "BrainstormStrategy: failed to parse SDK event, treating as text"
            )
            fallback = str(event) if event else ""
            return {"message_type": "text", "content": fallback}


# Self-register into the global registry
register_strategy("brainstorm", BrainstormStrategy)
