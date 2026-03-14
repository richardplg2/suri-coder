from __future__ import annotations

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING, Any, Literal

from sqlalchemy.ext.asyncio import AsyncSession

if TYPE_CHECKING:
    from app.models.agent_config import AgentConfig
    from app.models.session import Session


class AgentStrategy(ABC):
    """Defines per-agent-type behavior for the SessionManager."""

    @abstractmethod
    def get_sdk_type(self) -> Literal["claude_code", "claude_agent"]:
        """Which Claude SDK to use for this agent type."""

    @abstractmethod
    def build_sdk_options(
        self, session: Session, agent_config: AgentConfig
    ) -> dict:
        """Build the options dict to pass to the SDK client."""

    @abstractmethod
    def process_event(self, event: Any) -> dict | None:
        """Transform a raw SDK event into a SessionEvent data dict.

        Returns a dict with keys:
          - event_type: str (EventType value)
          - role: str | None
          - content: dict

        Return None to filter out (ignore) the event.
        """

    @abstractmethod
    async def on_session_complete(
        self, session: Session, db: AsyncSession
    ) -> None:
        """Called after the SDK finishes executing. Cleanup and side effects."""
