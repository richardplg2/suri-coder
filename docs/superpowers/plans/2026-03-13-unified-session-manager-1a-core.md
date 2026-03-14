# Unified Session Manager — Phase 1a: Core Infrastructure

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the new session/strategy infrastructure alongside the existing system — no existing behavior changes until Phase 1b/1c.

**Architecture:** Expand DB models (Session, new SessionEvent, AgentConfig), create the AgentStrategy ABC + registry, and implement SessionManager with create_session + concurrency guard + event pipeline skeleton. New `/sessions/` router added; existing routers untouched.

**Tech Stack:** FastAPI, SQLAlchemy (async), Alembic, Pydantic v2, Redis pub/sub, Python ABCs

---

## Chunk 1: Data Model Changes

### Task 1: Expand enums in `models/enums.py`

**Files:**
- Modify: `apps/backend/app/models/enums.py`

- [ ] **Step 1: Add `created` and `waiting_input` to `SessionStatus`**

```python
# In apps/backend/app/models/enums.py, replace:
class SessionStatus(str, enum.Enum):
    running = "running"
    completed = "completed"
    failed = "failed"
    cancelled = "cancelled"

# With:
class SessionStatus(str, enum.Enum):
    created = "created"           # record exists, SDK not started
    running = "running"           # SDK executing
    waiting_input = "waiting_input"  # agent turn done, awaiting user message
    completed = "completed"       # task finished successfully
    failed = "failed"             # unrecoverable error
    cancelled = "cancelled"       # user or system cancelled
```

- [ ] **Step 2: Add `EventType` enum after `SessionStatus`**

```python
class EventType(str, enum.Enum):
    message = "message"
    thinking = "thinking"
    tool_call = "tool_call"
    tool_result = "tool_result"
    subagent_start = "subagent_start"
    subagent_complete = "subagent_complete"
    cost_update = "cost_update"
    status_change = "status_change"
    structured_output = "structured_output"
    error = "error"
    permission_request = "permission_request"
```

- [ ] **Step 3: Remove `brainstorm_session` from `WsChannel` (it will be replaced by `session_stream`)**

  Keep `session_stream = "session:stream"` — it already exists.
  Remove: `brainstorm_session = "brainstorm:session"` — **do this in Phase 1b** once frontend is updated.
  **Skip this step for now** — leave `WsChannel` intact.

- [ ] **Step 4: Run linter to verify no syntax issues**

```bash
cd apps/backend && uv run ruff check app/models/enums.py
```
Expected: no errors.

---

### Task 2: Add `SessionEvent` model

**Files:**
- Create: `apps/backend/app/models/session_event.py`
- Modify: `apps/backend/app/models/__init__.py`

- [ ] **Step 1: Create `session_event.py`**

```python
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.base import UUIDMixin


class SessionEvent(UUIDMixin, Base):
    __tablename__ = "session_events"

    session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("sessions.id", ondelete="CASCADE")
    )
    sequence: Mapped[int] = mapped_column(Integer)
    event_type: Mapped[str] = mapped_column(String(50))  # EventType values
    role: Mapped[str | None] = mapped_column(String(20), nullable=True)
    content: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
```

- [ ] **Step 2: Import `SessionEvent` in `models/__init__.py`**

  Open `apps/backend/app/models/__init__.py` — add `from app.models.session_event import SessionEvent` alongside existing imports.

- [ ] **Step 3: Lint check**

```bash
cd apps/backend && uv run ruff check app/models/session_event.py
```

---

### Task 3: Modify `Session` model

**Files:**
- Modify: `apps/backend/app/models/session.py`

- [ ] **Step 1: Add new columns to `Session`**

  Replace the existing `Session` class body with:

```python
class Session(UUIDMixin, Base):
    __tablename__ = "sessions"

    # Existing fields (step_id now nullable)
    step_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("workflow_steps.id", ondelete="SET NULL"),
        nullable=True,
    )
    status: Mapped[str] = mapped_column(
        String(20), default="created"
    )
    git_branch: Mapped[str | None] = mapped_column(String(255), nullable=True)
    git_commit_sha: Mapped[str | None] = mapped_column(String(40), nullable=True)
    worktree_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    cli_session_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    cost_usd: Mapped[float | None] = mapped_column(Numeric(10, 4), nullable=True)
    tokens_used: Mapped[int | None] = mapped_column(Integer, nullable=True)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    finished_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    exit_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    # New fields
    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE")
    )
    ticket_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("tickets.id", ondelete="SET NULL"), nullable=True
    )
    agent_config_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("agent_configs.id", ondelete="RESTRICT")
    )
    parent_session_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("sessions.id", ondelete="SET NULL"), nullable=True
    )
    conversation_history: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    total_input_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total_output_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Relationships
    messages: Mapped[list["SessionMessage"]] = relationship(
        cascade="all, delete-orphan", order_by="SessionMessage.timestamp"
    )
    events: Mapped[list["SessionEvent"]] = relationship(
        cascade="all, delete-orphan",
        order_by="SessionEvent.sequence",
        foreign_keys="SessionEvent.session_id",
    )
```

- [ ] **Step 2: Add import for `SessionEvent` and `JSON` at top of `session.py`**

  `JSON` is already imported. Add:
  ```python
  from app.models.session_event import SessionEvent
  ```
  (Add at bottom of imports to avoid circular; or use string annotation in `Mapped` and add to `__init__.py` ordering.)

  **Preferred approach:** Keep `events` relationship with `lazy="raise"` if needed, but for now just add the import. Watch for circular import — if it occurs, use string annotation `"SessionEvent"` in `Mapped` and ensure `SessionEvent` is imported in `__init__.py` after `Session`.

- [ ] **Step 3: Lint check**

```bash
cd apps/backend && uv run ruff check app/models/session.py
```

---

### Task 4: Add `agent_type` and `output_format` to `AgentConfig`

**Files:**
- Modify: `apps/backend/app/models/agent_config.py`

- [ ] **Step 1: Add two columns to `AgentConfig`**

```python
# Add after `default_requires_approval` field:
agent_type: Mapped[str] = mapped_column(String(50), default="backend")
output_format: Mapped[dict | None] = mapped_column(JSON, nullable=True)
```

- [ ] **Step 2: Lint check**

```bash
cd apps/backend && uv run ruff check app/models/agent_config.py
```

---

### Task 5: Alembic migration — structural schema changes

**Files:**
- Create: `apps/backend/alembic/versions/<hash>_unified_session_manager_phase1a.py`

- [ ] **Step 1: Generate migration scaffold**

```bash
cd apps/backend && uv run alembic revision --autogenerate -m "unified_session_manager_phase1a"
```

- [ ] **Step 2: Inspect generated file, replace `upgrade()` and `downgrade()` with exact DDL**

  The autogenerated migration may be incomplete. Verify it contains:

```python
def upgrade() -> None:
    # 1. Create session_events table
    op.create_table(
        "session_events",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("session_id", sa.UUID(), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("event_type", sa.String(50), nullable=False),
        sa.Column("role", sa.String(20), nullable=True),
        sa.Column("content", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["session_id"], ["sessions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_session_events_session_id", "session_events", ["session_id"])
    op.create_index("ix_session_events_session_sequence", "session_events", ["session_id", "sequence"])

    # 2. Alter sessions table — add new columns
    op.add_column("sessions", sa.Column("project_id", sa.UUID(), nullable=True))  # nullable until backfilled
    op.add_column("sessions", sa.Column("ticket_id", sa.UUID(), nullable=True))
    op.add_column("sessions", sa.Column("agent_config_id", sa.UUID(), nullable=True))
    op.add_column("sessions", sa.Column("parent_session_id", sa.UUID(), nullable=True))
    op.add_column("sessions", sa.Column("conversation_history", sa.JSON(), nullable=True))
    op.add_column("sessions", sa.Column("total_input_tokens", sa.Integer(), nullable=True))
    op.add_column("sessions", sa.Column("total_output_tokens", sa.Integer(), nullable=True))

    # 3. Make sessions.step_id nullable
    op.alter_column("sessions", "step_id", existing_type=sa.UUID(), nullable=True)

    # 4. Add FK constraints (deferred — backfill happens in Phase 1b/1c)
    op.create_foreign_key("fk_sessions_project_id", "sessions", "projects", ["project_id"], ["id"], ondelete="CASCADE")
    op.create_foreign_key("fk_sessions_ticket_id", "sessions", "tickets", ["ticket_id"], ["id"], ondelete="SET NULL")
    op.create_foreign_key("fk_sessions_agent_config_id", "sessions", "agent_configs", ["agent_config_id"], ["id"])
    op.create_foreign_key("fk_sessions_parent_session_id", "sessions", "sessions", ["parent_session_id"], ["id"], ondelete="SET NULL")

    # 5. Expand SessionStatus — add new enum values
    # PostgreSQL requires ALTER TYPE ... ADD VALUE
    op.execute("ALTER TYPE sessionstatus ADD VALUE IF NOT EXISTS 'created'")
    op.execute("ALTER TYPE sessionstatus ADD VALUE IF NOT EXISTS 'waiting_input'")
    # Note: If using String column (not PG enum), skip this step

    # 6. Add columns to agent_configs
    op.add_column("agent_configs", sa.Column("agent_type", sa.String(50), nullable=True))
    op.add_column("agent_configs", sa.Column("output_format", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("agent_configs", "output_format")
    op.drop_column("agent_configs", "agent_type")
    op.drop_constraint("fk_sessions_parent_session_id", "sessions", type_="foreignkey")
    op.drop_constraint("fk_sessions_agent_config_id", "sessions", type_="foreignkey")
    op.drop_constraint("fk_sessions_ticket_id", "sessions", type_="foreignkey")
    op.drop_constraint("fk_sessions_project_id", "sessions", type_="foreignkey")
    op.alter_column("sessions", "step_id", existing_type=sa.UUID(), nullable=False)
    op.drop_column("sessions", "total_output_tokens")
    op.drop_column("sessions", "total_input_tokens")
    op.drop_column("sessions", "conversation_history")
    op.drop_column("sessions", "parent_session_id")
    op.drop_column("sessions", "agent_config_id")
    op.drop_column("sessions", "ticket_id")
    op.drop_column("sessions", "project_id")
    op.drop_index("ix_session_events_session_sequence", "session_events")
    op.drop_index("ix_session_events_session_id", "session_events")
    op.drop_table("session_events")
```

  **Note on SessionStatus enum:** Check how the current `status` column is defined. In `models/session.py` it's `String(20)` — not a PG enum type — so **skip the `ALTER TYPE` commands**. The enum expansion is just Python-side; no DB DDL needed for string columns.

- [ ] **Step 3: Run migration**

```bash
cd apps/backend && uv run alembic upgrade head
```
Expected: "Running upgrade ... -> <hash>, unified_session_manager_phase1a"

- [ ] **Step 4: Commit**

```bash
git add apps/backend/app/models/ apps/backend/alembic/versions/
git commit -m "feat(session): add SessionEvent model and session schema extensions for unified session manager"
```

---

## Chunk 2: Strategy Pattern

### Task 6: `AgentStrategy` base ABC

**Files:**
- Create: `apps/backend/app/services/strategies/__init__.py`
- Create: `apps/backend/app/services/strategies/base.py`

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p apps/backend/app/services/strategies
touch apps/backend/app/services/strategies/__init__.py
```

- [ ] **Step 2: Write `base.py`**

```python
# apps/backend/app/services/strategies/base.py
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
        self, session: "Session", agent_config: "AgentConfig"
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
        self, session: "Session", db: AsyncSession
    ) -> None:
        """Called after the SDK finishes executing. Cleanup and side effects."""
```

- [ ] **Step 3: Update `__init__.py` to export base**

```python
# apps/backend/app/services/strategies/__init__.py
from app.services.strategies.base import AgentStrategy

__all__ = ["AgentStrategy"]
```

- [ ] **Step 4: Lint check**

```bash
cd apps/backend && uv run ruff check app/services/strategies/
```

---

### Task 7: Strategy registry

**Files:**
- Create: `apps/backend/app/services/strategies/registry.py`

- [ ] **Step 1: Write `registry.py`**

```python
# apps/backend/app/services/strategies/registry.py
from app.services.strategies.base import AgentStrategy

# Populated in Phase 1b (BrainstormStrategy) and 1c (BackendAgentStrategy)
STRATEGY_REGISTRY: dict[str, type[AgentStrategy]] = {}


def get_strategy(agent_type: str) -> AgentStrategy:
    """Return an instantiated strategy for the given agent type."""
    cls = STRATEGY_REGISTRY.get(agent_type)
    if cls is None:
        raise ValueError(
            f"Unknown agent type: '{agent_type}'. "
            f"Registered types: {list(STRATEGY_REGISTRY.keys())}"
        )
    return cls()


def register_strategy(agent_type: str, cls: type[AgentStrategy]) -> None:
    """Register a strategy class. Called at import time in each strategy module."""
    STRATEGY_REGISTRY[agent_type] = cls
```

- [ ] **Step 2: Export from `__init__.py`**

```python
# apps/backend/app/services/strategies/__init__.py
from app.services.strategies.base import AgentStrategy
from app.services.strategies.registry import get_strategy, register_strategy

__all__ = ["AgentStrategy", "get_strategy", "register_strategy"]
```

- [ ] **Step 3: Write a failing test for the registry**

```python
# apps/backend/tests/test_strategy_registry.py
import pytest
from app.services.strategies.registry import (
    STRATEGY_REGISTRY,
    get_strategy,
    register_strategy,
)
from app.services.strategies.base import AgentStrategy


class _FakeStrategy(AgentStrategy):
    def get_sdk_type(self): return "claude_agent"
    def build_sdk_options(self, session, agent_config): return {}
    def process_event(self, event): return None
    async def on_session_complete(self, session, db): pass


def test_register_and_get_strategy():
    register_strategy("fake", _FakeStrategy)
    strategy = get_strategy("fake")
    assert isinstance(strategy, _FakeStrategy)


def test_get_unknown_strategy_raises():
    with pytest.raises(ValueError, match="Unknown agent type"):
        get_strategy("nonexistent_xyz")
```

- [ ] **Step 4: Run failing test**

```bash
cd apps/backend && uv run pytest tests/test_strategy_registry.py -v
```
Expected: FAIL (module not found or import error until code is written).

- [ ] **Step 5: Run test to verify it passes**

```bash
cd apps/backend && uv run pytest tests/test_strategy_registry.py -v
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/backend/app/services/strategies/ apps/backend/tests/test_strategy_registry.py
git commit -m "feat(session): add AgentStrategy ABC and strategy registry"
```

---

## Chunk 3: SessionManager Core

### Task 8: `SessionManager` — `create_session` and concurrency guard

**Files:**
- Create: `apps/backend/app/services/session_manager.py`

- [ ] **Step 1: Write failing tests first**

```python
# apps/backend/tests/test_session_manager.py
import uuid
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import SessionStatus
from app.models.session import Session
from app.models.agent_config import AgentConfig
from app.services.session_manager import SessionManager


@pytest.fixture
def mock_db():
    db = AsyncMock(spec=AsyncSession)
    db.get = AsyncMock()
    db.execute = AsyncMock()
    db.add = MagicMock()
    db.flush = AsyncMock()
    return db


@pytest.fixture
def mock_redis():
    return AsyncMock()


@pytest.fixture
def manager(mock_db, mock_redis):
    return SessionManager(db=mock_db, redis=mock_redis)


@pytest.mark.asyncio
async def test_create_session_returns_session(manager, mock_db):
    project_id = uuid.uuid4()
    agent_config_id = uuid.uuid4()

    # Mock agent_config
    agent_config = MagicMock(spec=AgentConfig)
    agent_config.agent_type = "brainstorm"
    mock_db.get.return_value = agent_config

    # Mock no existing active session
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_db.execute.return_value = mock_result

    session = await manager.create_session(
        agent_config_id=agent_config_id,
        project_id=project_id,
    )

    assert session.status == SessionStatus.created
    assert session.project_id == project_id
    mock_db.add.assert_called_once()
    mock_db.flush.assert_called_once()


@pytest.mark.asyncio
async def test_create_session_raises_on_concurrency_conflict(manager, mock_db):
    from fastapi import HTTPException

    agent_config = MagicMock(spec=AgentConfig)
    agent_config.agent_type = "brainstorm"
    mock_db.get.return_value = agent_config

    # Mock existing active session
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = MagicMock(spec=Session)
    mock_db.execute.return_value = mock_result

    with pytest.raises(HTTPException) as exc_info:
        await manager.create_session(
            agent_config_id=uuid.uuid4(),
            project_id=uuid.uuid4(),
        )

    assert exc_info.value.status_code == 409
```

- [ ] **Step 2: Run failing tests**

```bash
cd apps/backend && uv run pytest tests/test_session_manager.py -v
```
Expected: FAIL (ImportError — session_manager.py doesn't exist yet).

- [ ] **Step 3: Write `session_manager.py`**

```python
# apps/backend/app/services/session_manager.py
from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

import redis.asyncio as aioredis
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agent_config import AgentConfig
from app.models.enums import EventType, SessionStatus
from app.models.session import Session
from app.models.session_event import SessionEvent

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
            started_at=datetime.now(timezone.utc),
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
        session.finished_at = datetime.now(timezone.utc)
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

    # -------------------------------------------------------------------------
    # Internal helpers
    # -------------------------------------------------------------------------

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
        history = []
        for event in events:
            if event.event_type == EventType.message and event.role in ("user", "assistant"):
                history.append({
                    "role": event.role,
                    "content": event.content.get("text", ""),
                })
        return history

    def _next_sequence(self, session_id: uuid.UUID) -> int:
        n = self._sequences.get(session_id, 0)
        self._sequences[session_id] = n + 1
        return n
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/backend && uv run pytest tests/test_session_manager.py -v
```
Expected: PASS

- [ ] **Step 5: Lint check**

```bash
cd apps/backend && uv run ruff check app/services/session_manager.py
```

- [ ] **Step 6: Commit**

```bash
git add apps/backend/app/services/session_manager.py apps/backend/tests/test_session_manager.py
git commit -m "feat(session): add SessionManager with create_session, concurrency guard, and event pipeline"
```

---

## Chunk 4: Sessions Router and Schemas

### Task 9: New session Pydantic schemas

**Files:**
- Modify: `apps/backend/app/schemas/session.py`

- [ ] **Step 1: Add new schemas to `schemas/session.py`** (keep existing schemas intact)

```python
# Append to apps/backend/app/schemas/session.py

class SessionEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    session_id: uuid.UUID
    sequence: int
    event_type: str
    role: str | None
    content: dict
    created_at: datetime


class UnifiedSessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    status: str
    project_id: uuid.UUID
    ticket_id: uuid.UUID | None
    agent_config_id: uuid.UUID
    step_id: uuid.UUID | None
    parent_session_id: uuid.UUID | None
    cost_usd: float | None
    total_input_tokens: int | None
    total_output_tokens: int | None
    started_at: datetime
    finished_at: datetime | None
    error_message: str | None


class CreateSessionRequest(BaseModel):
    agent_config_id: uuid.UUID
    ticket_id: uuid.UUID | None = None
    workflow_step_id: uuid.UUID | None = None


class StartSessionRequest(BaseModel):
    prompt: str


class SendMessageRequest(BaseModel):
    content: str
```

- [ ] **Step 2: Lint check**

```bash
cd apps/backend && uv run ruff check app/schemas/session.py
```

---

### Task 10: Extend sessions router with unified endpoints

**Files:**
- Modify: `apps/backend/app/routers/sessions.py`

  The existing router has `GET /steps/{step_id}/sessions`, `GET /sessions/{session_id}`, `POST /sessions/{session_id}/cancel`. We add the new unified endpoints while preserving the old ones.

- [ ] **Step 1: Add new endpoints to `routers/sessions.py`**

```python
# Add these imports to existing routers/sessions.py:
from fastapi import BackgroundTasks, Request
import redis.asyncio as aioredis

from app.models.project import Project, ProjectMember
from app.schemas.session import (
    CreateSessionRequest,
    SendMessageRequest,
    StartSessionRequest,
    SessionEventResponse,
    UnifiedSessionResponse,
)
from app.services.project import require_project_member
from app.services.session_manager import SessionManager


async def get_redis(request: Request) -> aioredis.Redis:
    return request.app.state.redis


# Add new endpoints:

@router.post(
    "/projects/{project_id}/sessions",
    response_model=UnifiedSessionResponse,
    status_code=201,
)
async def create_session(
    project_id: uuid.UUID,
    data: CreateSessionRequest,
    project_member: tuple[Project, ProjectMember] = Depends(require_project_member),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),
) -> UnifiedSessionResponse:
    manager = SessionManager(db=db, redis=redis)
    session = await manager.create_session(
        agent_config_id=data.agent_config_id,
        project_id=project_id,
        ticket_id=data.ticket_id,
        workflow_step_id=data.workflow_step_id,
    )
    await db.commit()
    return UnifiedSessionResponse.model_validate(session)


@router.post("/sessions/{session_id}/start", status_code=202)
async def start_session(
    session_id: uuid.UUID,
    data: StartSessionRequest,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),
) -> dict:
    """Start session execution. Events stream via WebSocket session:stream channel."""
    manager = SessionManager(db=db, redis=redis)
    # start_session implemented in Phase 1b/1c
    background_tasks.add_task(manager.start_session, session_id, data.prompt)
    return {"status": "starting", "session_id": str(session_id)}


@router.post("/sessions/{session_id}/message", status_code=202)
async def send_message(
    session_id: uuid.UUID,
    data: SendMessageRequest,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),
) -> dict:
    manager = SessionManager(db=db, redis=redis)
    background_tasks.add_task(manager.send_message, session_id, data.content)
    return {"status": "sent", "session_id": str(session_id)}


@router.post("/sessions/{session_id}/resume", response_model=UnifiedSessionResponse)
async def resume_session(
    session_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),
) -> UnifiedSessionResponse:
    manager = SessionManager(db=db, redis=redis)
    session = await manager.resume_session(session_id)
    await db.commit()
    return UnifiedSessionResponse.model_validate(session)


@router.get(
    "/projects/{project_id}/sessions",
    response_model=list[UnifiedSessionResponse],
)
async def list_project_sessions(
    project_id: uuid.UUID,
    project_member: tuple[Project, ProjectMember] = Depends(require_project_member),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[UnifiedSessionResponse]:
    result = await db.execute(
        select(Session).where(Session.project_id == project_id)
        .order_by(Session.started_at.desc())
    )
    sessions = list(result.scalars().all())
    return [UnifiedSessionResponse.model_validate(s) for s in sessions]


@router.get(
    "/projects/{project_id}/sessions/active",
    response_model=list[UnifiedSessionResponse],
)
async def list_active_sessions(
    project_id: uuid.UUID,
    project_member: tuple[Project, ProjectMember] = Depends(require_project_member),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),
) -> list[UnifiedSessionResponse]:
    manager = SessionManager(db=db, redis=redis)
    sessions = await manager.get_active_sessions(project_id)
    return [UnifiedSessionResponse.model_validate(s) for s in sessions]


@router.get(
    "/sessions/{session_id}/events",
    response_model=list[SessionEventResponse],
)
async def list_session_events(
    session_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[SessionEventResponse]:
    from sqlalchemy import select
    from app.models.session_event import SessionEvent

    result = await db.execute(
        select(SessionEvent)
        .where(SessionEvent.session_id == session_id)
        .order_by(SessionEvent.sequence)
    )
    events = list(result.scalars().all())
    return [SessionEventResponse.model_validate(e) for e in events]
```

  **Note:** `start_session` and `send_message` stubs on `SessionManager` need to exist (even as `raise NotImplementedError`) — implement them in Phase 1b/1c. Add stubs to `session_manager.py` now:

```python
# Add to SessionManager class in session_manager.py:

async def start_session(self, session_id: uuid.UUID, initial_prompt: str) -> None:
    """Start SDK execution. Implemented by Phase 1b (brainstorm) and 1c (backend)."""
    raise NotImplementedError("start_session requires a strategy implementation")

async def send_message(self, session_id: uuid.UUID, content: str) -> None:
    """Send follow-up message into multi-turn session. Implemented in Phase 1b."""
    raise NotImplementedError("send_message requires a strategy implementation")
```

- [ ] **Step 2: Lint check**

```bash
cd apps/backend && uv run ruff check app/routers/sessions.py app/services/session_manager.py
```

- [ ] **Step 3: Verify the server starts without error**

```bash
cd apps/backend && uv run fastapi dev app/main.py --port 8001 &
sleep 3
curl http://localhost:8001/docs | grep -o "session" | head -5
kill %1
```
Expected: server starts, docs endpoint includes "session".

- [ ] **Step 4: Commit**

```bash
git add apps/backend/app/routers/sessions.py apps/backend/app/schemas/session.py apps/backend/app/services/session_manager.py
git commit -m "feat(session): add unified session router endpoints and Pydantic schemas"
```

---

## Chunk 5: Wire into main.py

### Task 11: Register the updated sessions router

**Files:**
- Modify: `apps/backend/app/main.py`

- [ ] **Step 1: Verify sessions router is already registered**

  Open `apps/backend/app/main.py` and check if `routers.sessions` is included. If it is, no change needed — the new endpoints are in the same router file.

  If `sessions` router is not registered, add:
  ```python
  from app.routers import sessions
  app.include_router(sessions.router)
  ```

- [ ] **Step 2: Ensure `SessionEvent` model is imported so SQLAlchemy registers the table**

  In `main.py` or the models `__init__.py`, ensure:
  ```python
  from app.models.session_event import SessionEvent  # noqa: F401
  ```

- [ ] **Step 3: Run all backend tests to confirm nothing broken**

```bash
cd apps/backend && uv run pytest tests/ -v --tb=short 2>&1 | tail -30
```
Expected: existing tests pass; new tests pass; no regressions.

- [ ] **Step 4: Final Phase 1a commit**

```bash
git add apps/backend/app/main.py
git commit -m "feat(session): Phase 1a complete — core session infrastructure in place"
```

---

## Summary

Phase 1a delivers:
- Expanded `SessionStatus` (`created`, `waiting_input`) and new `EventType` enum
- `SessionEvent` DB model + migration
- Extended `Session` model (new FK fields, `step_id` nullable)
- `AgentConfig.agent_type` + `output_format` fields
- `AgentStrategy` ABC and strategy registry
- `SessionManager` with `create_session`, concurrency guard, event pipeline, and checkpoint management
- New unified `/sessions/` endpoints (create, start stub, send_message stub, resume, list, events)

**No existing behavior changes.** Old brainstorm and agent_runner code runs untouched.

**Next:** Phase 1b — Brainstorm migration (`2026-03-13-unified-session-manager-1b-brainstorm.md`)
