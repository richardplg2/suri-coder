from __future__ import annotations

import json
import logging
import uuid
from datetime import UTC, datetime
from typing import Any

import redis.asyncio as aioredis
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agent_config import AgentConfig
from app.models.enums import EventType, SessionStatus
from app.models.session import Session
from app.models.session_event import SessionEvent

try:
    from claude_agent_sdk import ClaudeAgentOptions, ClaudeSDKClient
except ImportError:  # SDK not installed in dev/test
    ClaudeAgentOptions = None  # type: ignore[assignment,misc]
    ClaudeSDKClient = None  # type: ignore[assignment,misc]

logger = logging.getLogger(__name__)


class SessionManager:
    def __init__(self, db: AsyncSession, redis: aioredis.Redis):
        self.db = db
        self.redis = redis
        self._clients: dict[uuid.UUID, Any] = {}  # session_id → SDK client
        self._sequences: dict[uuid.UUID, int] = {}  # session_id → next sequence

    # -------------------------------------------------------------------------
    # Public API
    # -------------------------------------------------------------------------

    async def create_session(
        self,
        agent_config_id: uuid.UUID,
        project_id: uuid.UUID,
        ticket_id: uuid.UUID | None = None,
        workflow_step_id: uuid.UUID | None = None,
        parent_session_id: uuid.UUID | None = None,
    ) -> Session:
        """Create a session record in `created` status. Enforces concurrency guard."""
        agent_config = await self.db.get(AgentConfig, agent_config_id)
        if agent_config is None:
            raise HTTPException(status_code=404, detail="AgentConfig not found")

        await self._check_concurrency(agent_config, project_id)

        session = Session(
            status=SessionStatus.created,
            project_id=project_id,
            ticket_id=ticket_id,
            agent_config_id=agent_config_id,
            step_id=workflow_step_id,
            parent_session_id=parent_session_id,
            started_at=datetime.now(UTC),
        )
        self.db.add(session)
        await self.db.flush()
        return session

    async def cancel_session(self, session_id: uuid.UUID) -> Session:
        """Cancel a session that hasn't completed yet."""
        session = await self._get_or_404(session_id)
        if session.status in (SessionStatus.completed, SessionStatus.cancelled):
            raise HTTPException(
                status_code=400,
                detail=f"Cannot cancel session in '{session.status}' status",
            )
        # Cancel the in-flight SDK client if any
        client = self._clients.pop(session_id, None)
        if client and hasattr(client, "cancel"):
            try:
                await client.cancel()
            except Exception:
                logger.warning("Failed to cancel SDK client for session %s", session_id)

        await self._transition(session, SessionStatus.cancelled)
        session.finished_at = datetime.now(UTC)
        await self.db.flush()
        return session

    async def resume_session(self, session_id: uuid.UUID) -> Session:
        """Create a new session from the checkpoint of a failed/cancelled session."""
        original = await self._get_or_404(session_id)
        if original.status not in (SessionStatus.failed, SessionStatus.cancelled):
            raise HTTPException(
                status_code=400,
                detail="Can only resume failed or cancelled sessions",
            )

        new_session = await self.create_session(
            agent_config_id=original.agent_config_id,
            project_id=original.project_id,
            ticket_id=original.ticket_id,
            workflow_step_id=original.step_id,
            parent_session_id=original.id,
        )
        return new_session

    async def get_active_sessions(
        self, project_id: uuid.UUID
    ) -> list[Session]:
        """Return running/waiting_input sessions for a project."""
        result = await self.db.execute(
            select(Session).where(
                Session.project_id == project_id,
                Session.status.in_([
                    SessionStatus.running,
                    SessionStatus.waiting_input,
                ]),
            )
        )
        return list(result.scalars().all())

    async def start_session(
        self, session_id: uuid.UUID, initial_prompt: str
    ) -> None:
        """Start SDK execution for a session. Runs as a background task.

        NOTE(TODO): This method receives the request-scoped DB session via
        __init__. For production multi-worker deployments, background tasks
        should open their own DB session rather than reusing the request session
        to avoid identity-map staleness after commit.
        """
        from app.services.strategies.registry import get_strategy

        session = await self._get_or_404(session_id)
        agent_config = await self.db.get(AgentConfig, session.agent_config_id)

        try:
            if agent_config is None:
                raise ValueError("AgentConfig missing for session")

            # Record the initial user prompt so conversation history is complete
            await self._emit_event(
                session,
                EventType.message,
                content={"text": initial_prompt},
                role="user",
            )

            strategy = get_strategy(agent_config.agent_type)
            await self._transition(session, SessionStatus.running)
            await self.db.flush()

            if strategy.get_sdk_type() == "claude_agent":
                await self._run_claude_agent(
                    session, agent_config, strategy, initial_prompt
                )
            else:
                await self._run_claude_code(
                    session, agent_config, strategy, initial_prompt
                )

            await strategy.on_session_complete(session, self.db)
            # _run_claude_agent transitions to waiting_input for single-turn strategies.
            # If status is still running (claude_code / future), complete the session.
            if session.status == SessionStatus.running:
                await self._transition(session, SessionStatus.completed)
                session.finished_at = datetime.now(UTC)

        except Exception as exc:
            logger.exception("Session %s failed: %s", session_id, exc)
            session.error_message = str(exc)
            session.finished_at = datetime.now(UTC)
            await self._transition(session, SessionStatus.failed)
        finally:
            self._clients.pop(session_id, None)
            await self.db.commit()

    async def send_message(self, session_id: uuid.UUID, content: str) -> None:
        """Send a follow-up message to a waiting_input session.

        Called via BackgroundTasks — HTTPException would be silently swallowed.
        Status validation uses an early-return so invalid-state calls are logged
        and committed cleanly without spuriously marking the session as failed.
        """
        from app.services.strategies.registry import get_strategy

        session = await self._get_or_404(session_id)
        agent_config = await self.db.get(AgentConfig, session.agent_config_id)

        try:
            if session.status != SessionStatus.waiting_input:
                logger.warning(
                    "Session %s: send_message ignored — status '%s' != waiting_input",
                    session_id,
                    session.status,
                )
                return

            if agent_config is None:
                raise ValueError("AgentConfig missing for session")

            strategy = get_strategy(agent_config.agent_type)

            # Record user message event
            await self._emit_event(
                session, EventType.message, content={"text": content}, role="user"
            )

            await self._transition(session, SessionStatus.running)
            await self.db.flush()

            if strategy.get_sdk_type() == "claude_agent":
                await self._run_claude_agent(session, agent_config, strategy, content)
            else:
                await self._run_claude_code(session, agent_config, strategy, content)

            # After sending a message, brainstorm goes back to waiting_input
            if session.status == SessionStatus.running:
                await self._transition(session, SessionStatus.waiting_input)
                await self._save_checkpoint(session)

        except Exception as exc:
            logger.exception("Session %s send_message failed: %s", session_id, exc)
            session.error_message = str(exc)
            await self._transition(session, SessionStatus.failed)
        finally:
            await self.db.commit()

    # -------------------------------------------------------------------------
    # Internal helpers
    # -------------------------------------------------------------------------

    async def _run_claude_agent(
        self,
        session: Session,
        agent_config: AgentConfig,
        strategy: Any,
        prompt: str,
    ) -> None:
        """Execute a single claude_agent_sdk query.

        TODO(Phase 1c): The waiting_input transition here is coupled to brainstorm
        semantics. When BackendAgentStrategy arrives it may use claude_agent too
        but want completed semantics. Delegate post-run status to the strategy
        (e.g. via on_session_complete or a new post_run_status() hook).
        """
        options = strategy.build_sdk_options(session, agent_config)
        client = ClaudeSDKClient(ClaudeAgentOptions(**options))
        self._clients[session.id] = client

        result = await client.query(prompt)
        await self._process_event(session, strategy, result)

        # Transition to waiting_input after single-turn completes
        await self._transition(session, SessionStatus.waiting_input)
        await self._save_checkpoint(session)

    async def _run_claude_code(
        self,
        session: Session,
        agent_config: AgentConfig,
        strategy: Any,
        prompt: str,
    ) -> None:
        """Execute a claude_code_sdk streaming run (implemented in Phase 1c)."""
        raise NotImplementedError("claude_code SDK integration added in Phase 1c")

    async def _check_concurrency(
        self, agent_config: AgentConfig, project_id: uuid.UUID
    ) -> None:
        """Raise 409 if agent_type already has an active session for this project."""
        result = await self.db.execute(
            select(Session).where(
                Session.project_id == project_id,
                Session.agent_config_id.in_(
                    select(AgentConfig.id).where(
                        AgentConfig.agent_type == agent_config.agent_type,
                        AgentConfig.project_id == project_id,
                    )
                ),
                Session.status.in_([
                    SessionStatus.running,
                    SessionStatus.waiting_input,
                ]),
            )
        )
        if result.scalar_one_or_none() is not None:
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Agent type '{agent_config.agent_type}' already has "
                    "an active session for this project"
                ),
            )

    async def _get_or_404(self, session_id: uuid.UUID) -> Session:
        session = await self.db.get(Session, session_id)
        if session is None:
            raise HTTPException(status_code=404, detail="Session not found")
        return session

    async def _transition(
        self, session: Session, new_status: SessionStatus
    ) -> None:
        """Transition session to new status and emit a status_change event."""
        old_status = session.status
        session.status = new_status
        await self._emit_event(
            session,
            EventType.status_change,
            content={"old_status": old_status, "new_status": new_status},
        )

    async def _emit_event(
        self,
        session: Session,
        event_type: EventType,
        content: dict,
        role: str | None = None,
    ) -> None:
        """Persist event to DB and publish to Redis."""
        seq = self._next_sequence(session.id)

        event = SessionEvent(
            session_id=session.id,
            sequence=seq,
            event_type=event_type,
            role=role,
            content=content,
        )
        self.db.add(event)

        payload = json.dumps(
            {
                "channel": "session:stream",
                "ref": f"session:stream:{session.id}",
                "event": event_type,
                "data": {
                    "session_id": str(session.id),
                    "sequence": seq,
                    "event_type": event_type,
                    "content": content,
                },
            },
            default=str,
        )
        await self.redis.publish(f"session:{session.id}", payload)

    async def _process_event(
        self,
        session: Session,
        strategy: Any,  # AgentStrategy (imported lazily to avoid circular)
        sdk_event: Any,
    ) -> None:
        """Run an SDK event through the strategy pipeline → DB → Redis."""
        event_data = strategy.process_event(sdk_event)
        if event_data is None:
            return

        await self._emit_event(
            session,
            event_type=event_data["event_type"],
            content=event_data["content"],
            role=event_data.get("role"),
        )

        # Update session cost aggregates
        if event_data["event_type"] == EventType.cost_update:
            session.cost_usd = event_data["content"].get("cost_usd")
            session.total_input_tokens = event_data["content"].get("input_tokens")
            session.total_output_tokens = event_data["content"].get("output_tokens")

    async def _save_checkpoint(self, session: Session) -> None:
        """Persist conversation history for resume capability."""
        result = await self.db.execute(
            select(SessionEvent)
            .where(SessionEvent.session_id == session.id)
            .order_by(SessionEvent.sequence)
        )
        events = list(result.scalars().all())
        session.conversation_history = self._build_conversation_history(events)
        await self.db.flush()

    def _build_conversation_history(
        self, events: list[SessionEvent]
    ) -> list[dict]:
        """Convert session events to Claude API conversation format."""
        # TODO(Phase 1b): include tool_call/tool_result events in history
        history = []
        for event in events:
            is_message = event.event_type == EventType.message
            if is_message and event.role in ("user", "assistant"):
                history.append({
                    "role": event.role,
                    "content": event.content.get("text", ""),
                })
        return history

    def _next_sequence(self, session_id: uuid.UUID) -> int:
        # TODO(Phase 1b): Replace with DB-side sequence (MAX(sequence)+1)
        # to support multiple workers
        n = self._sequences.get(session_id, 0)
        self._sequences[session_id] = n + 1
        return n
