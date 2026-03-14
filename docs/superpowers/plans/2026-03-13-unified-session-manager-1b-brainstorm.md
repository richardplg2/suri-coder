# Unified Session Manager — Phase 1b: Brainstorm Migration

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate BrainstormService to SessionManager + BrainstormStrategy. Brainstorm endpoints become thin wrappers over the unified session API. Old `brainstorm_service.py`, `brainstorm_agent.py`, and `BrainstormMessage` model deleted.

**Architecture:** BrainstormStrategy implements `AgentStrategy`, calling `claude_agent_sdk.ClaudeSDKClient.query()` (request-response, single turn per call). SessionManager.`start_session` and `send_message` use the strategy to run the SDK and pipe all results through the event pipeline → Redis → WebSocket. Frontend switches from `brainstorm:session` to `session:stream` channel.

**Tech Stack:** `claude_agent_sdk`, FastAPI BackgroundTasks, Redis pub/sub, Alembic data migration

**Prerequisites:** Phase 1a complete (SessionManager core, AgentStrategy ABC, DB migration run).

---

## Chunk 1: BrainstormStrategy

### Task 1: Implement `BrainstormStrategy`

**Files:**
- Create: `apps/backend/app/services/strategies/brainstorm.py`

- [ ] **Step 1: Write failing test for `BrainstormStrategy`**

```python
# apps/backend/tests/strategies/test_brainstorm_strategy.py
import pytest
from unittest.mock import MagicMock

from app.services.strategies.brainstorm import BrainstormStrategy


@pytest.fixture
def strategy():
    return BrainstormStrategy()


def test_get_sdk_type(strategy):
    assert strategy.get_sdk_type() == "claude_agent"


def test_build_sdk_options_basic(strategy):
    session = MagicMock()
    agent_config = MagicMock()
    agent_config.system_prompt = "You are a brainstormer."
    agent_config.output_format = None
    agent_config.mcp_servers = None

    opts = strategy.build_sdk_options(session, agent_config)

    assert opts["system_prompt"] == "You are a brainstormer."
    assert opts["max_turns"] == 1


def test_build_sdk_options_with_output_format(strategy):
    session = MagicMock()
    agent_config = MagicMock()
    agent_config.system_prompt = "sys"
    agent_config.output_format = {"type": "json_schema", "schema": {}}
    agent_config.mcp_servers = None

    opts = strategy.build_sdk_options(session, agent_config)
    assert "output_format" in opts


def test_process_event_quiz(strategy):
    sdk_result = MagicMock()
    sdk_result.output = '{"message_type": "quiz", "content": "What problem?", "quiz": {"question": "Q?", "options": []}}'

    result = strategy.process_event(sdk_result)

    assert result is not None
    assert result["event_type"] == "structured_output"
    assert result["content"]["schema_type"] == "quiz"


def test_process_event_text(strategy):
    sdk_result = MagicMock()
    sdk_result.output = '{"message_type": "text", "content": "Hello!"}'

    result = strategy.process_event(sdk_result)
    assert result["content"]["schema_type"] == "text"
    assert result["content"]["data"]["content"] == "Hello!"


def test_process_event_fallback_to_text(strategy):
    sdk_result = MagicMock()
    sdk_result.output = "not valid json at all"
    # Remove result attribute to test fallback
    del sdk_result.result

    result = strategy.process_event(sdk_result)
    assert result["content"]["schema_type"] == "text"
```

- [ ] **Step 2: Create test directory init**

```bash
mkdir -p apps/backend/tests/strategies
touch apps/backend/tests/strategies/__init__.py
```

- [ ] **Step 3: Run failing tests**

```bash
cd apps/backend && uv run pytest tests/strategies/test_brainstorm_strategy.py -v
```
Expected: FAIL (module not found).

- [ ] **Step 4: Write `brainstorm.py`**

```python
# apps/backend/app/services/strategies/brainstorm.py
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
        self, session: "Session", agent_config: "AgentConfig"
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
        self, session: "Session", db: AsyncSession
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
            logger.warning("BrainstormStrategy: failed to parse SDK event, treating as text")
            fallback = str(event) if event else ""
            return {"message_type": "text", "content": fallback}


# Self-register into the global registry
register_strategy("brainstorm", BrainstormStrategy)
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd apps/backend && uv run pytest tests/strategies/test_brainstorm_strategy.py -v
```
Expected: PASS

- [ ] **Step 6: Lint check**

```bash
cd apps/backend && uv run ruff check app/services/strategies/brainstorm.py
```

- [ ] **Step 7: Commit**

```bash
git add apps/backend/app/services/strategies/brainstorm.py apps/backend/tests/strategies/
git commit -m "feat(session): add BrainstormStrategy for claude_agent_sdk"
```

---

## Chunk 2: SessionManager — start_session and send_message

### Task 2: Implement `start_session` and `send_message` in `SessionManager`

**Files:**
- Modify: `apps/backend/app/services/session_manager.py`

- [ ] **Step 1: Write failing tests**

```python
# Append to apps/backend/tests/test_session_manager.py

@pytest.mark.asyncio
async def test_start_session_brainstorm(manager, mock_db):
    """start_session transitions to running → waiting_input and emits an event."""
    session_id = uuid.uuid4()
    agent_config_id = uuid.uuid4()

    session = MagicMock(spec=Session)
    session.id = session_id
    session.status = SessionStatus.created
    session.agent_config_id = agent_config_id

    agent_config = MagicMock(spec=AgentConfig)
    agent_config.agent_type = "brainstorm"
    agent_config.system_prompt = "sys"
    agent_config.output_format = None
    agent_config.mcp_servers = None

    mock_db.get.side_effect = lambda model, id: (
        session if model == Session else agent_config
    )
    mock_db.execute.return_value = MagicMock(scalars=MagicMock(return_value=[]))

    fake_result = MagicMock()
    fake_result.output = '{"message_type": "quiz", "content": "Q?"}'

    # Patch the claude_agent_sdk import inside SessionManager
    with patch("app.services.session_manager.ClaudeSDKClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client.query = AsyncMock(return_value=fake_result)
        mock_client_cls.return_value = mock_client

        with patch("app.services.session_manager.register_strategy"):
            # Inject brainstorm strategy
            from app.services.strategies.brainstorm import BrainstormStrategy
            with patch(
                "app.services.strategies.registry.STRATEGY_REGISTRY",
                {"brainstorm": BrainstormStrategy},
            ):
                await manager.start_session(session_id, "Tell me about X")

    mock_client.query.assert_called_once_with("Tell me about X")
    manager.redis.publish.assert_called()
```

- [ ] **Step 2: Run failing test**

```bash
cd apps/backend && uv run pytest tests/test_session_manager.py::test_start_session_brainstorm -v
```
Expected: FAIL (NotImplementedError from stub).

- [ ] **Step 3: Replace `start_session` and `send_message` stubs in `session_manager.py`**

```python
# Replace the stub methods in SessionManager with:

async def start_session(
    self, session_id: uuid.UUID, initial_prompt: str
) -> None:
    """Start SDK execution for a session. Runs as a background task."""
    from app.services.strategies.registry import get_strategy

    session = await self._get_or_404(session_id)
    agent_config = await self.db.get(AgentConfig, session.agent_config_id)
    if agent_config is None:
        raise HTTPException(status_code=500, detail="AgentConfig missing for session")

    strategy = get_strategy(agent_config.agent_type)
    await self._transition(session, SessionStatus.running)
    await self.db.flush()

    try:
        if strategy.get_sdk_type() == "claude_agent":
            await self._run_claude_agent(session, agent_config, strategy, initial_prompt)
        else:
            await self._run_claude_code(session, agent_config, strategy, initial_prompt)

        await strategy.on_session_complete(session, self.db)
        # Brainstorm stays in waiting_input after each query
        # Backend agent transitions to completed when SDK finishes
        if session.status == SessionStatus.running:
            await self._transition(session, SessionStatus.completed)
            session.finished_at = datetime.now(timezone.utc)

    except Exception as exc:
        logger.exception("Session %s failed: %s", session_id, exc)
        session.error_message = str(exc)
        session.finished_at = datetime.now(timezone.utc)
        await self._transition(session, SessionStatus.failed)
    finally:
        self._clients.pop(session_id, None)
        await self.db.commit()

async def send_message(
    self, session_id: uuid.UUID, content: str
) -> None:
    """Send a follow-up message to a waiting_input session."""
    from app.services.strategies.registry import get_strategy

    session = await self._get_or_404(session_id)
    if session.status != SessionStatus.waiting_input:
        raise HTTPException(
            status_code=400,
            detail=f"Session is not waiting for input (status: {session.status})",
        )

    agent_config = await self.db.get(AgentConfig, session.agent_config_id)
    strategy = get_strategy(agent_config.agent_type)

    # Record user message event
    await self._emit_event(
        session, EventType.message, content={"text": content}, role="user"
    )

    await self._transition(session, SessionStatus.running)
    await self.db.flush()

    try:
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

async def _run_claude_agent(
    self,
    session: Session,
    agent_config: AgentConfig,
    strategy: Any,
    prompt: str,
) -> None:
    """Execute a single claude_agent_sdk query."""
    from claude_agent_sdk import ClaudeAgentOptions, ClaudeSDKClient

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
```

- [ ] **Step 4: Add missing `datetime` import to `session_manager.py` if not already present**

  Verify top imports include: `from datetime import datetime, timezone`

- [ ] **Step 5: Run all session_manager tests**

```bash
cd apps/backend && uv run pytest tests/test_session_manager.py -v
```
Expected: PASS

- [ ] **Step 6: Lint check**

```bash
cd apps/backend && uv run ruff check app/services/session_manager.py
```

- [ ] **Step 7: Commit**

```bash
git add apps/backend/app/services/session_manager.py apps/backend/tests/test_session_manager.py
git commit -m "feat(session): implement start_session and send_message for claude_agent strategy"
```

---

## Chunk 3: Brainstorm Router Migration

### Task 3: Seed `AgentConfig` for brainstorm and update brainstorm router

**Files:**
- Modify: `apps/backend/app/routers/brainstorm.py`
- Modify: `apps/backend/app/services/seed_data.py` (add brainstorm AgentConfig seeding)

The brainstorm router keeps the same URL paths (backward compatible) but wires them to `SessionManager` instead of `BrainstormService`.

- [ ] **Step 1: Add brainstorm AgentConfig seed**

  Open `apps/backend/app/services/seed_data.py` (or wherever agent configs are seeded). Find where global agent configs are created and add a brainstorm config if one doesn't exist:

```python
# In the seed/setup logic, ensure a brainstorm AgentConfig exists:
from app.services.brainstorm_agent import BRAINSTORM_SYSTEM_PROMPT, QUIZ_OUTPUT_SCHEMA

BRAINSTORM_AGENT_CONFIG = {
    "name": "brainstorm",
    "description": "Interactive brainstorming partner",
    "system_prompt": BRAINSTORM_SYSTEM_PROMPT,
    "claude_model": "claude-sonnet-4-6",
    "agent_type": "brainstorm",
    "output_format": {
        "type": "json_schema",
        "schema": QUIZ_OUTPUT_SCHEMA,
    },
    "max_turns": 1,
}
```

  **Important:** Run `uv run alembic upgrade head` before seeding — the `agent_type` column must exist.

  If there's no seeding mechanism, we'll look up the brainstorm AgentConfig by name in the router.

- [ ] **Step 2: Rewrite `routers/brainstorm.py`**

  Keep the same URL paths so the frontend doesn't break. Replace `BrainstormService` calls with `SessionManager`:

```python
# apps/backend/app/routers/brainstorm.py
import uuid
from typing import Any

import redis.asyncio as aioredis
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.agent_config import AgentConfig
from app.models.project import Project, ProjectMember
from app.models.session import Session
from app.models.session_event import SessionEvent
from app.models.user import User
from app.schemas.brainstorm import (
    BrainstormBatchUpdateRequest,
    BrainstormMessageRequest,
    BrainstormStartRequest,
    CreateTicketFromBrainstormRequest,
)
from app.schemas.session import CreateSessionRequest, UnifiedSessionResponse
from app.schemas.ticket import TicketResponse
from app.services.auth import get_current_user
from app.services.project import require_project_member
from app.services.session_manager import SessionManager
from app.services.ticket import create_ticket
from app.services.spec import SpecService
from app.models.enums import SessionStatus, TicketSource, SpecType

router = APIRouter(tags=["brainstorm"])


async def get_redis(request: Request) -> aioredis.Redis:
    return request.app.state.redis


async def _get_brainstorm_agent_config(
    project_id: uuid.UUID, db: AsyncSession
) -> AgentConfig:
    """Find the brainstorm AgentConfig for this project (or global)."""
    result = await db.execute(
        select(AgentConfig).where(
            AgentConfig.agent_type == "brainstorm",
            AgentConfig.project_id == project_id,
        )
    )
    config = result.scalar_one_or_none()
    if config is None:
        # Fall back to global brainstorm config
        result = await db.execute(
            select(AgentConfig).where(
                AgentConfig.agent_type == "brainstorm",
                AgentConfig.project_id.is_(None),
            )
        )
        config = result.scalar_one_or_none()
    if config is None:
        raise HTTPException(
            status_code=500,
            detail="No brainstorm AgentConfig found. Run seeding.",
        )
    return config


@router.post(
    "/projects/{project_id}/brainstorm/start",
    status_code=status.HTTP_201_CREATED,
)
async def start_brainstorm(
    project_id: uuid.UUID,
    data: BrainstormStartRequest,
    background_tasks: BackgroundTasks,
    project_member: tuple[Project, ProjectMember] = Depends(require_project_member),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),
) -> dict:
    """Create and start a brainstorm session. Events stream via session:stream WebSocket."""
    from app.services.brainstorm_agent import build_initial_prompt

    agent_config = await _get_brainstorm_agent_config(project_id, db)
    manager = SessionManager(db=db, redis=redis)

    session = await manager.create_session(
        agent_config_id=agent_config.id,
        project_id=project_id,
    )
    await db.commit()

    prompt = build_initial_prompt(
        source=data.source,
        initial_message=data.initial_message,
        figma_data=data.figma_data,
    )
    background_tasks.add_task(manager.start_session, session.id, prompt)

    return {
        "session_id": str(session.id),
        "status": "starting",
        "ws_channel": "session:stream",
        "ws_ref": f"session:stream:{session.id}",
    }


@router.post(
    "/projects/{project_id}/brainstorm/{session_id}/message",
)
async def send_brainstorm_message(
    project_id: uuid.UUID,
    session_id: uuid.UUID,
    data: BrainstormMessageRequest,
    background_tasks: BackgroundTasks,
    project_member: tuple[Project, ProjectMember] = Depends(require_project_member),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),
) -> dict:
    manager = SessionManager(db=db, redis=redis)

    # Format quiz response if provided
    if data.quiz_response:
        labels = data.quiz_response.get("option_labels", []) or data.quiz_response.get("option_ids", [])
        custom = data.quiz_response.get("custom_text", "")
        content = f"Selected: {', '.join(labels)}"
        if custom:
            content += f". {custom}"
    else:
        content = data.content or ""

    background_tasks.add_task(manager.send_message, session_id, content)
    return {"status": "sent", "session_id": str(session_id)}


@router.post(
    "/projects/{project_id}/brainstorm/{session_id}/complete",
)
async def complete_brainstorm(
    project_id: uuid.UUID,
    session_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    project_member: tuple[Project, ProjectMember] = Depends(require_project_member),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),
) -> dict:
    """Request final summary generation."""
    manager = SessionManager(db=db, redis=redis)
    summary_prompt = (
        "Please generate the final summary now. "
        "Output as message_type: summary with the full content."
    )
    background_tasks.add_task(manager.send_message, session_id, summary_prompt)
    return {"status": "generating_summary", "session_id": str(session_id)}


@router.post(
    "/projects/{project_id}/brainstorm/{session_id}/batch-update",
)
async def batch_update_brainstorm(
    project_id: uuid.UUID,
    session_id: uuid.UUID,
    data: BrainstormBatchUpdateRequest,
    background_tasks: BackgroundTasks,
    project_member: tuple[Project, ProjectMember] = Depends(require_project_member),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),
) -> dict:
    manager = SessionManager(db=db, redis=redis)
    formatted = "\n".join(
        f"- [{c.get('section_id', 'general')}]: {c.get('text', '')}"
        for c in data.comments
    )
    prompt = f"Please update the summary based on these comments:\n{formatted}"
    background_tasks.add_task(manager.send_message, session_id, prompt)
    return {"status": "updating", "session_id": str(session_id)}


@router.post(
    "/projects/{project_id}/brainstorm/{session_id}/create-ticket",
    response_model=TicketResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_ticket_from_brainstorm(
    project_id: uuid.UUID,
    session_id: uuid.UUID,
    data: CreateTicketFromBrainstormRequest,
    project_member: tuple[Project, ProjectMember] = Depends(require_project_member),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),
) -> TicketResponse:
    """Create a ticket from the latest summary event in this brainstorm session."""
    from app.schemas.ticket import TicketCreate

    # Find the latest summary event for this session
    result = await db.execute(
        select(SessionEvent)
        .where(
            SessionEvent.session_id == session_id,
            SessionEvent.event_type == "structured_output",
        )
        .order_by(SessionEvent.sequence.desc())
        .limit(10)
    )
    events = list(result.scalars().all())
    summary_event = next(
        (e for e in events if e.content.get("schema_type") == "summary"),
        None,
    )
    if summary_event is None:
        raise HTTPException(
            status_code=400, detail="No summary found for this session"
        )

    summary_content = summary_event.content.get("data", {}).get("content", "")

    ticket_data = TicketCreate(
        title=data.title,
        description=summary_content,
        type=data.type,
        priority=data.priority,
        template_id=data.template_id,
        source=TicketSource.ai_brainstorm,
    )
    ticket = await create_ticket(db, project_id, ticket_data, user.id)

    await SpecService.create_spec(
        db=db,
        ticket_id=ticket.id,
        type=SpecType.feature,
        title=data.title,
        content=summary_content,
        created_by=user.id,
    )

    await db.commit()
    return TicketResponse.model_validate(ticket)
```

- [ ] **Step 3: Ensure brainstorm strategy is imported (registered) in `main.py`**

```python
# In apps/backend/app/main.py, add this import:
import app.services.strategies.brainstorm  # noqa: F401  — registers BrainstormStrategy
```

- [ ] **Step 4: Lint check**

```bash
cd apps/backend && uv run ruff check app/routers/brainstorm.py app/main.py
```

- [ ] **Step 5: Commit**

```bash
git add apps/backend/app/routers/brainstorm.py apps/backend/app/main.py
git commit -m "feat(brainstorm): migrate brainstorm router to SessionManager"
```

---

## Chunk 4: Data Migration

### Task 4: Migrate `brainstorm_messages` → `session_events`

**Files:**
- Create: `apps/backend/alembic/versions/<hash>_migrate_brainstorm_to_session_events.py`

  **Note:** This migration assumes existing brainstorm data in `brainstorm_messages` must be preserved. If the DB is empty (dev environment), you may skip the data copy and just drop the table.

- [ ] **Step 1: Generate migration**

```bash
cd apps/backend && uv run alembic revision -m "migrate_brainstorm_to_session_events"
```

- [ ] **Step 2: Write `upgrade()` with data migration**

```python
def upgrade() -> None:
    # NOTE: brainstorm_messages used string session_ids (not UUIDs).
    # Brainstorm sessions in the new system are proper Session records.
    # Since old brainstorm sessions have no corresponding Session records,
    # we cannot migrate the data relationally. Instead, we archive it.
    # If you need to preserve brainstorm history, export before running this.

    # Drop brainstorm_messages table
    op.drop_table("brainstorm_messages")


def downgrade() -> None:
    # Recreate brainstorm_messages table (empty — data is lost)
    op.create_table(
        "brainstorm_messages",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("session_id", sa.String(36), nullable=False),
        sa.Column("role", sa.String(20), nullable=False),
        sa.Column("content", sa.Text(), nullable=True),
        sa.Column("message_type", sa.String(20), nullable=False),
        sa.Column("structured_data", sa.JSON(), nullable=True),
        sa.Column("ticket_id", sa.UUID(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
```

- [ ] **Step 3: Run migration**

```bash
cd apps/backend && uv run alembic upgrade head
```

- [ ] **Step 4: Commit**

```bash
git add apps/backend/alembic/versions/
git commit -m "feat(brainstorm): migrate brainstorm_messages data and drop table"
```

---

## Chunk 5: Delete Old Brainstorm Files

### Task 5: Delete `BrainstormService`, `BrainstormMessage`, and `brainstorm_agent.py`

**Files:**
- Delete: `apps/backend/app/services/brainstorm_service.py`
- Delete: `apps/backend/app/services/brainstorm.py` (if it exists as a separate module)
- Delete: `apps/backend/app/models/brainstorm_message.py`
- Modify: `apps/backend/app/models/__init__.py` (remove BrainstormMessage import)
- Modify: `apps/backend/tests/test_brainstorm_service.py` (delete or replace with new tests)

  **Keep:** `apps/backend/app/services/brainstorm_agent.py` — still needed for `BRAINSTORM_SYSTEM_PROMPT`, `QUIZ_OUTPUT_SCHEMA`, and `build_initial_prompt`. The brainstorm router imports these.

- [ ] **Step 1: Check for any other usages of the files to be deleted**

```bash
cd apps/backend && grep -r "BrainstormService\|BrainstormMessage\|brainstorm_service" app/ --include="*.py" -l
```
Expected: only `app/routers/brainstorm.py` — but we already rewrote that. If other files appear, update them first.

- [ ] **Step 2: Check `BrainstormMessage` usages**

```bash
cd apps/backend && grep -r "BrainstormMessage\|brainstorm_message" app/ --include="*.py" -l
```

- [ ] **Step 3: Delete files**

```bash
rm apps/backend/app/services/brainstorm_service.py
rm apps/backend/app/models/brainstorm_message.py
```

  Remove the `brainstorm.py` service file if it exists:
```bash
ls apps/backend/app/services/brainstorm.py && rm apps/backend/app/services/brainstorm.py || true
```

- [ ] **Step 4: Remove imports from `models/__init__.py`**

  Open `apps/backend/app/models/__init__.py` and remove the `BrainstormMessage` import.

- [ ] **Step 5: Update `tests/test_brainstorm_service.py`** — replace old service tests with new integration tests

```python
# apps/backend/tests/test_brainstorm.py (replace old test_brainstorm_service.py content)
"""
Brainstorm integration tests.
These test that the brainstorm router correctly uses SessionManager.
The underlying BrainstormService no longer exists.
"""
import pytest


def test_brainstorm_service_replaced():
    """Verify old BrainstormService is gone."""
    with pytest.raises(ImportError):
        from app.services.brainstorm_service import BrainstormService  # noqa


def test_brainstorm_strategy_registered():
    """Verify BrainstormStrategy is registered in STRATEGY_REGISTRY."""
    import app.services.strategies.brainstorm  # noqa — triggers registration
    from app.services.strategies.registry import STRATEGY_REGISTRY
    assert "brainstorm" in STRATEGY_REGISTRY
```

- [ ] **Step 6: Run full test suite**

```bash
cd apps/backend && uv run pytest tests/ -v --tb=short 2>&1 | tail -40
```
Expected: all tests pass; no references to deleted modules.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(brainstorm): delete BrainstormService and BrainstormMessage — fully migrated to SessionManager"
```

---

## Chunk 6: Frontend WebSocket Update

### Task 6: Update frontend to use `session:stream` instead of `brainstorm:session`

**Files:**
- Search and update: `apps/desktop/src/**/*.ts` and `apps/desktop/src/**/*.tsx`

- [ ] **Step 1: Find all usages of `brainstorm:session` channel**

```bash
grep -r "brainstorm:session\|brainstorm_session" apps/desktop/src/ --include="*.ts" --include="*.tsx" -l
```

- [ ] **Step 2: For each file found, update the channel name**

  Change `'brainstorm:session'` → `'session:stream'`
  Change WsChannel.brainstorm_session → WsChannel.session_stream (if using enum)

  Example pattern in `use-ws-channel` hook calls:
  ```typescript
  // Before:
  useWsChannel('brainstorm:session', { session_id }, handleBrainstormEvent)

  // After:
  useWsChannel('session:stream', { session_id }, handleSessionEvent)
  ```

  Also update the event handler to read `event.event_type` instead of `event.event` for consistency.

- [ ] **Step 3: Update event handler to handle new `structured_output` event type**

  The old brainstorm events were `brainstorm_quiz`, `brainstorm_text`, `brainstorm_summary`. The new events are all `structured_output` with `content.schema_type` indicating the type:

  ```typescript
  // Old handler:
  if (event.event === 'brainstorm_quiz') { ... }
  if (event.event === 'brainstorm_summary') { ... }

  // New handler:
  if (event.event_type === 'structured_output') {
    const { schema_type, data } = event.data.content
    if (schema_type === 'quiz') { ... }
    if (schema_type === 'summary') { ... }
    if (schema_type === 'text') { ... }
  }
  ```

- [ ] **Step 4: Update any frontend code that expected `session_id` as a string (old brainstorm used string UUIDs)**

  Old brainstorm: `session_id` was `string`. New sessions: `session_id` is `uuid.UUID` serialized as string — same format, no change needed.

- [ ] **Step 5: Update `WsChannel` enum in frontend if it exists**

```bash
grep -r "brainstorm" apps/desktop/src/ --include="*.ts" -l
```
  Find the enum definition and ensure `session_stream` is there (it already should be from existing code).

- [ ] **Step 6: Typecheck frontend**

```bash
pnpm --filter my-electron-app typecheck
```
Expected: no type errors.

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src/
git commit -m "feat(brainstorm): update frontend to use session:stream WebSocket channel"
```

---

## Summary

Phase 1b delivers:
- `BrainstormStrategy` implementing `AgentStrategy` for `claude_agent_sdk`
- `SessionManager.start_session` and `send_message` for single-turn (claude_agent) strategies
- Brainstorm router fully wired to SessionManager (same URL paths, backward compatible)
- `brainstorm_messages` table dropped, `BrainstormService` and `BrainstormMessage` deleted
- Frontend WebSocket updated from `brainstorm:session` to `session:stream`

**Brainstorm still works end-to-end.** Same URLs, same frontend behavior, different backend plumbing.

**Next:** Phase 1c — Backend agent migration (`2026-03-13-unified-session-manager-1c-backend-agent.md`)
