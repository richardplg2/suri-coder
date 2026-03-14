# Unified Session Manager — Phase 1c: Backend Agent Migration

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `AgentRunner` with `BackendAgentStrategy` + SessionManager. `WorkflowEngine.auto_start_step()` delegates to SessionManager. WorkflowEngine subscribes to Redis `status_change:completed/failed` events to trigger `tick()`. `AgentRunner` and `SessionMessage` model deleted.

**Architecture:** `BackendAgentStrategy` uses `claude_code_sdk` async streaming. SessionManager._run_claude_code iterates SDK events. WorkflowEngine and SessionManager are decoupled via Redis events — no circular imports.

**Tech Stack:** `claude_code_sdk` (async iterator), Redis pub/sub listener, Alembic data migration

**Prerequisites:** Phase 1a + 1b complete.

---

## Chunk 1: BackendAgentStrategy

### Task 1: Read the existing `workflow_engine.py` `auto_start_step` fully

**Files:**
- Read: `apps/backend/app/services/workflow_engine.py` (lines 120–end)

- [ ] **Step 1: Read the full auto_start_step method**

```bash
cd apps/backend && grep -n "auto_start_step\|claude_code_sdk\|AgentRunner\|SessionMessage" app/services/workflow_engine.py
```

  Note the exact SDK import pattern and how events are currently processed — you'll mirror this in `_run_claude_code`.

- [ ] **Step 2: Note the current SDK import**

  Look for something like:
  ```python
  from claude_code_sdk import query as claude_query, ClaudeCodeOptions
  # or
  import claude_code_sdk
  ```
  This is the SDK used by `BackendAgentStrategy.get_sdk_type() == "claude_code"`.

---

### Task 2: Implement `BackendAgentStrategy`

**Files:**
- Create: `apps/backend/app/services/strategies/backend.py`

- [ ] **Step 1: Write failing tests**

```python
# apps/backend/tests/strategies/test_backend_strategy.py
import pytest
from unittest.mock import MagicMock

from app.services.strategies.backend import BackendAgentStrategy


@pytest.fixture
def strategy():
    return BackendAgentStrategy()


def test_get_sdk_type(strategy):
    assert strategy.get_sdk_type() == "claude_code"


def test_build_sdk_options(strategy):
    session = MagicMock()
    session.worktree_path = "/tmp/worktree"

    agent_config = MagicMock()
    agent_config.system_prompt = "You are a backend developer."
    agent_config.claude_model = "claude-sonnet-4-6"
    agent_config.tools_list = ["Edit", "Write", "Bash"]
    agent_config.mcp_servers = {}
    agent_config.max_turns = 25

    opts = strategy.build_sdk_options(session, agent_config)

    assert opts["cwd"] == "/tmp/worktree"
    assert opts["permission_mode"] == "acceptEdits"
    assert opts["system_prompt"] == "You are a backend developer."
    assert opts["max_turns"] == 25
    assert opts["include_partial_messages"] is True


def test_process_event_message(strategy):
    event = MagicMock()
    event.type = "assistant"
    event.message = MagicMock()
    event.message.content = [MagicMock(type="text", text="Hello world")]

    result = strategy.process_event(event)
    assert result is not None
    assert result["event_type"] == "message"
    assert result["role"] == "assistant"


def test_process_event_tool_use(strategy):
    event = MagicMock()
    event.type = "tool_use"
    event.tool_use = MagicMock()
    event.tool_use.name = "Edit"
    event.tool_use.input = {"file_path": "/foo.py"}

    result = strategy.process_event(event)
    assert result["event_type"] == "tool_call"
    assert result["content"]["tool_name"] == "Edit"


def test_process_event_cost(strategy):
    event = MagicMock()
    event.type = "result"
    event.cost_usd = 0.05
    event.usage = MagicMock()
    event.usage.input_tokens = 1000
    event.usage.output_tokens = 500

    result = strategy.process_event(event)
    assert result["event_type"] == "cost_update"
    assert result["content"]["cost_usd"] == 0.05


def test_process_event_unknown_filtered(strategy):
    event = MagicMock()
    event.type = "some_unknown_type"
    result = strategy.process_event(event)
    assert result is None
```

- [ ] **Step 2: Run failing tests**

```bash
cd apps/backend && uv run pytest tests/strategies/test_backend_strategy.py -v
```
Expected: FAIL (ImportError).

- [ ] **Step 3: Write `backend.py`**

```python
# apps/backend/app/services/strategies/backend.py
from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any, Literal

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.strategies.base import AgentStrategy
from app.services.strategies.registry import register_strategy

if TYPE_CHECKING:
    from app.models.agent_config import AgentConfig
    from app.models.session import Session

logger = logging.getLogger(__name__)


class BackendAgentStrategy(AgentStrategy):
    """Strategy for backend coding agent sessions (claude_code_sdk, streaming)."""

    def get_sdk_type(self) -> Literal["claude_code", "claude_agent"]:
        return "claude_code"

    def build_sdk_options(
        self, session: "Session", agent_config: "AgentConfig"
    ) -> dict:
        return {
            "system_prompt": agent_config.system_prompt,
            "model": agent_config.claude_model,
            "tools": agent_config.tools_list,
            "mcp_servers": agent_config.mcp_servers or {},
            "max_turns": agent_config.max_turns,
            "cwd": session.worktree_path,
            "permission_mode": "acceptEdits",
            "setting_sources": ["project"],
            "include_partial_messages": True,
        }

    def process_event(self, event: Any) -> dict | None:
        """Map claude_code_sdk event types to SessionEvent data."""
        event_type = getattr(event, "type", None)
        if event_type is None:
            return None

        if event_type == "assistant":
            text = self._extract_text(event)
            if text is None:
                return None
            return {
                "event_type": "message",
                "role": "assistant",
                "content": {"text": text},
            }

        if event_type == "tool_use":
            tool_use = getattr(event, "tool_use", None)
            if tool_use is None:
                return None
            return {
                "event_type": "tool_call",
                "role": None,
                "content": {
                    "tool_name": getattr(tool_use, "name", "unknown"),
                    "tool_input": getattr(tool_use, "input", {}),
                    "status": "running",
                },
            }

        if event_type == "tool_result":
            tool_result = getattr(event, "tool_result", None)
            if tool_result is None:
                return None
            return {
                "event_type": "tool_result",
                "role": None,
                "content": {
                    "tool_name": getattr(tool_result, "name", "unknown"),
                    "output": str(getattr(tool_result, "content", "")),
                    "is_error": getattr(tool_result, "is_error", False),
                },
            }

        if event_type == "thinking":
            thinking = getattr(event, "thinking", None)
            if thinking is None:
                return None
            return {
                "event_type": "thinking",
                "role": None,
                "content": {"text": str(thinking)},
            }

        if event_type == "result":
            cost_usd = getattr(event, "cost_usd", None)
            usage = getattr(event, "usage", None)
            if cost_usd is None and usage is None:
                return None
            return {
                "event_type": "cost_update",
                "role": None,
                "content": {
                    "cost_usd": cost_usd,
                    "input_tokens": getattr(usage, "input_tokens", 0) if usage else 0,
                    "output_tokens": getattr(usage, "output_tokens", 0) if usage else 0,
                },
            }

        # Unknown event type — filter out
        return None

    async def on_session_complete(
        self, session: "Session", db: AsyncSession
    ) -> None:
        """Publish completion to Redis so WorkflowEngine can tick the DAG."""
        # WorkflowEngine subscribes to session:completed events.
        # The SessionManager._transition() already publishes status_change events
        # to f"session:{session.id}" — WorkflowEngine listens there.
        pass

    def _extract_text(self, event: Any) -> str | None:
        message = getattr(event, "message", None)
        if message is None:
            return None
        content = getattr(message, "content", None)
        if not content:
            return None
        # Content may be a list of content blocks
        if isinstance(content, list):
            texts = [
                getattr(block, "text", "")
                for block in content
                if getattr(block, "type", None) == "text"
            ]
            return " ".join(texts) or None
        return str(content) or None


# Self-register into the global registry
register_strategy("backend", BackendAgentStrategy)
```

- [ ] **Step 4: Run tests**

```bash
cd apps/backend && uv run pytest tests/strategies/test_backend_strategy.py -v
```
Expected: PASS

- [ ] **Step 5: Lint check**

```bash
cd apps/backend && uv run ruff check app/services/strategies/backend.py
```

- [ ] **Step 6: Commit**

```bash
git add apps/backend/app/services/strategies/backend.py apps/backend/tests/strategies/test_backend_strategy.py
git commit -m "feat(session): add BackendAgentStrategy for claude_code_sdk streaming"
```

---

## Chunk 2: SessionManager — `_run_claude_code`

### Task 3: Implement `_run_claude_code` in `SessionManager`

**Files:**
- Modify: `apps/backend/app/services/session_manager.py`

- [ ] **Step 1: Check how `claude_code_sdk` is imported in the existing `workflow_engine.py`**

```bash
cd apps/backend && grep -n "claude_code_sdk\|from claude" app/services/workflow_engine.py | head -20
```

  Note the exact import pattern used. Mirror it in `_run_claude_code`.

- [ ] **Step 2: Write failing test for `_run_claude_code`**

```python
# Append to apps/backend/tests/test_session_manager.py

@pytest.mark.asyncio
async def test_run_claude_code_streams_events(manager, mock_db):
    """_run_claude_code iterates async SDK events and processes each."""
    from app.services.strategies.backend import BackendAgentStrategy

    session = MagicMock(spec=Session)
    session.id = uuid.uuid4()
    session.status = SessionStatus.running
    session.worktree_path = "/tmp/worktree"

    agent_config = MagicMock(spec=AgentConfig)
    agent_config.agent_type = "backend"
    agent_config.system_prompt = "sys"
    agent_config.claude_model = "claude-sonnet-4-6"
    agent_config.tools_list = []
    agent_config.mcp_servers = {}
    agent_config.max_turns = 25

    strategy = BackendAgentStrategy()

    # Fake SDK events
    fake_event_1 = MagicMock()
    fake_event_1.type = "assistant"
    fake_event_1.message = MagicMock()
    fake_event_1.message.content = [MagicMock(type="text", text="Working on it")]

    fake_event_2 = MagicMock()
    fake_event_2.type = "result"
    fake_event_2.cost_usd = 0.01
    fake_event_2.usage = MagicMock(input_tokens=100, output_tokens=50)

    async def mock_sdk_iterator(*args, **kwargs):
        for e in [fake_event_1, fake_event_2]:
            yield e

    with patch("app.services.session_manager.claude_code_query", mock_sdk_iterator):
        await manager._run_claude_code(session, agent_config, strategy, "Fix the bug")

    # Redis should have been called for each non-None event
    assert manager.redis.publish.call_count >= 1
```

- [ ] **Step 3: Run failing test**

```bash
cd apps/backend && uv run pytest tests/test_session_manager.py::test_run_claude_code_streams_events -v
```
Expected: FAIL (NotImplementedError).

- [ ] **Step 4: Replace `_run_claude_code` stub in `session_manager.py`**

```python
# Replace the NotImplementedError stub with:

async def _run_claude_code(
    self,
    session: Session,
    agent_config: AgentConfig,
    strategy: Any,
    prompt: str,
) -> None:
    """Execute a claude_code_sdk streaming run, piping each event through the pipeline."""
    options = strategy.build_sdk_options(session, agent_config)

    event_count = 0
    checkpoint_interval = 20

    async for sdk_event in claude_code_query(prompt, **options):
        await self._process_event(session, strategy, sdk_event)
        event_count += 1
        if event_count % checkpoint_interval == 0:
            await self._save_checkpoint(session)
        await self.db.flush()

    # Final checkpoint on completion
    await self._save_checkpoint(session)
```

- [ ] **Step 5: Add `claude_code_query` import at the top of `session_manager.py`**

  Check the SDK import pattern from workflow_engine.py. It may be:
  ```python
  from claude_code_sdk import query as claude_code_query
  ```
  or:
  ```python
  from claude_code_sdk import ClaudeCodeOptions
  # and called as: claude_code_sdk.query(prompt, ClaudeCodeOptions(**options))
  ```

  Adjust the import and call in `_run_claude_code` to match the actual SDK API. If the SDK uses a different call signature, adapt accordingly.

  **If import is at module level (preferred for testing):**
  ```python
  # In session_manager.py imports section:
  try:
      from claude_code_sdk import query as claude_code_query
  except ImportError:
      claude_code_query = None  # type: ignore  # not available in test env
  ```

- [ ] **Step 6: Register BackendAgentStrategy in `main.py`**

```python
# In apps/backend/app/main.py, add:
import app.services.strategies.backend  # noqa: F401  — registers BackendAgentStrategy
```

- [ ] **Step 7: Run tests**

```bash
cd apps/backend && uv run pytest tests/test_session_manager.py -v
```
Expected: PASS

- [ ] **Step 8: Lint check**

```bash
cd apps/backend && uv run ruff check app/services/session_manager.py
```

- [ ] **Step 9: Commit**

```bash
git add apps/backend/app/services/session_manager.py apps/backend/app/main.py
git commit -m "feat(session): implement _run_claude_code with async SDK streaming"
```

---

## Chunk 3: WorkflowEngine Refactor

### Task 4: Read the full `auto_start_step` method

**Files:**
- Read: `apps/backend/app/services/workflow_engine.py`

- [ ] **Step 1: Read the complete method**

```bash
cd apps/backend && uv run python -c "
import ast, sys
src = open('app/services/workflow_engine.py').read()
tree = ast.parse(src)
for node in ast.walk(tree):
    if isinstance(node, ast.AsyncFunctionDef) and node.name == 'auto_start_step':
        lines = src.split('\n')
        print('\n'.join(lines[node.lineno-1:node.end_lineno]))
"
```

  Understand the full logic before rewriting.

---

### Task 5: Refactor `WorkflowEngine.auto_start_step` to use `SessionManager`

**Files:**
- Modify: `apps/backend/app/services/workflow_engine.py`

- [ ] **Step 1: Write a failing test for the refactored `auto_start_step`**

```python
# apps/backend/tests/test_workflow_engine_session.py
import uuid
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.workflow_engine import WorkflowEngine
from app.models.enums import StepStatus, SessionStatus


@pytest.mark.asyncio
async def test_auto_start_step_creates_session(mock_db_factory):
    """auto_start_step should create a session via SessionManager, not AgentRunner."""
    db = AsyncMock()
    engine = WorkflowEngine(db=db)

    step = MagicMock()
    step.id = uuid.uuid4()
    step.ticket_id = uuid.uuid4()
    step.agent_config_id = uuid.uuid4()
    step.worktree_path = "/tmp/worktree"
    step.status = StepStatus.ready

    ticket = MagicMock()
    ticket.id = step.ticket_id
    ticket.auto_execute = True
    ticket.budget_usd = None

    agent_config = MagicMock()
    agent_config.id = step.agent_config_id
    agent_config.agent_type = "backend"

    db.get.side_effect = lambda model, id: (
        ticket if model.__name__ == "Ticket"
        else agent_config if model.__name__ == "AgentConfig"
        else MagicMock()
    )

    mock_session = MagicMock()
    mock_session.id = uuid.uuid4()

    with patch("app.services.workflow_engine.SessionManager") as mock_sm_cls:
        mock_sm = AsyncMock()
        mock_sm.create_session = AsyncMock(return_value=mock_session)
        mock_sm.start_session = AsyncMock()
        mock_sm_cls.return_value = mock_sm

        await engine.auto_start_step(step, db_session_factory=AsyncMock())

    mock_sm.create_session.assert_called_once()
    call_kwargs = mock_sm.create_session.call_args.kwargs
    assert call_kwargs["workflow_step_id"] == step.id
    assert call_kwargs["ticket_id"] == step.ticket_id
```

- [ ] **Step 2: Run failing test**

```bash
cd apps/backend && uv run pytest tests/test_workflow_engine_session.py -v
```
Expected: FAIL.

- [ ] **Step 3: Rewrite `auto_start_step` in `workflow_engine.py`**

  Replace the existing implementation with:

```python
async def auto_start_step(
    self,
    step: WorkflowStep,
    db_session_factory,
    redis=None,
    websocket_manager=None,
) -> None:
    """Execute a workflow step via SessionManager instead of AgentRunner."""
    from app.services.session_manager import SessionManager
    from app.services.prompt_builder import build_step_prompt
    from app.services.workspace_manager import WorkspaceManager

    ticket = await self.db.get(Ticket, step.ticket_id)
    if not ticket:
        await self.fail_step(step, "Ticket not found")
        return

    agent_config = await self.db.get(AgentConfig, step.agent_config_id)
    if not agent_config:
        await self.fail_step(step, "AgentConfig not found")
        return

    await self.start_step(step)
    await self.db.flush()

    # Set up workspace (git worktree)
    workspace = WorkspaceManager(self.db)
    cwd = await workspace.setup(step, ticket)
    step.worktree_path = cwd
    await self.db.flush()

    # Build the initial prompt for the step
    prompt = await build_step_prompt(step, ticket, db=self.db)

    # Create and start session via SessionManager
    manager = SessionManager(db=self.db, redis=redis or _get_app_redis())
    try:
        session = await manager.create_session(
            agent_config_id=agent_config.id,
            project_id=ticket.project_id,
            ticket_id=ticket.id,
            workflow_step_id=step.id,
        )
        await self.db.commit()

        # Run SDK synchronously here (WorkflowEngine is already in a background task)
        await manager.start_session(session.id, prompt)

        # After start_session completes, check session status
        await self.db.refresh(session)
        if session.status == "completed":
            await self.complete_step(step)
        elif session.status == "failed":
            await self.fail_step(step, session.error_message)

    except Exception as exc:
        await self.fail_step(step, str(exc))
        raise
```

  **Notes:**
  - `_get_app_redis()` is a helper that gets the Redis client from the app state. If the current code passes `redis` explicitly, use that.
  - `build_step_prompt` — check if this exists in `prompt_builder.py` or if the prompt is built inline in the current `auto_start_step`. If inline, extract the logic to a local variable first.
  - `WorkspaceManager.setup` — check how the current code sets up the workspace. If it uses `git_worktree.py` directly, replicate that.

- [ ] **Step 4: Identify and extract `build_step_prompt` if not already a function**

```bash
cd apps/backend && grep -n "build_step_prompt\|prompt_builder\|initial_prompt" app/services/workflow_engine.py | head -20
```
  If prompt building is inline, extract it to a helper or pass the built string directly.

- [ ] **Step 5: Run tests**

```bash
cd apps/backend && uv run pytest tests/test_workflow_engine_session.py tests/test_workflow_engine.py -v
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/backend/app/services/workflow_engine.py
git commit -m "feat(workflow): refactor auto_start_step to use SessionManager instead of AgentRunner"
```

---

## Chunk 4: WorkflowEngine Redis Subscription

### Task 6: Wire WorkflowEngine to receive session completion events from Redis

**Files:**
- Modify: `apps/backend/app/worker.py`
- Modify: `apps/backend/app/services/workflow_engine.py` (add `handle_session_completed`)

The WorkflowEngine currently calls `tick()` after `complete_step()`. With the new model, SessionManager notifies completion via Redis, and the WorkflowEngine listens and calls `tick()`.

- [ ] **Step 1: Read `worker.py` to understand the background task structure**

```bash
cd apps/backend && cat app/worker.py
```
Expected: ARQ worker setup with registered task functions.

- [ ] **Step 2: Add `handle_session_completed` to `WorkflowEngine`**

```python
# Append to WorkflowEngine class in workflow_engine.py:

async def handle_session_completed(
    self,
    session_id: uuid.UUID,
    status: str,
    error_message: str | None = None,
) -> None:
    """Called when a session completes. Advances the workflow DAG."""
    from sqlalchemy import select
    from app.models.session import Session

    session = await self.db.get(Session, session_id)
    if session is None or session.step_id is None:
        return  # not a workflow session

    step = await self.db.get(WorkflowStep, session.step_id)
    if step is None:
        return

    if status == "completed":
        await self.complete_step(step)
    elif status == "failed":
        await self.fail_step(step, error_message)
```

- [ ] **Step 3: Add a Redis subscriber task in `worker.py`**

  The SessionManager publishes `status_change` events to `session:{session_id}`. The worker needs to subscribe and trigger `handle_session_completed`.

```python
# In apps/backend/app/worker.py, add a startup task:

async def session_event_listener(ctx: dict) -> None:
    """Listen for session status_change events and advance the workflow DAG."""
    import json
    import asyncio
    from app.database import AsyncSessionLocal
    from app.services.workflow_engine import WorkflowEngine

    redis = ctx["redis"]
    pubsub = redis.pubsub()
    await pubsub.psubscribe("session:*")  # subscribe to all session channels

    async for message in pubsub.listen():
        if message["type"] != "pmessage":
            continue
        try:
            payload = json.loads(message["data"])
        except (json.JSONDecodeError, TypeError):
            continue

        if payload.get("event") != "status_change":
            continue

        data = payload.get("data", {})
        content = data.get("content", {})
        new_status = content.get("new_status")

        if new_status not in ("completed", "failed"):
            continue

        session_id_str = data.get("session_id")
        if not session_id_str:
            continue

        import uuid
        try:
            session_id = uuid.UUID(session_id_str)
        except ValueError:
            continue

        async with AsyncSessionLocal() as db:
            engine = WorkflowEngine(db=db)
            await engine.handle_session_completed(
                session_id=session_id,
                status=new_status,
                error_message=content.get("error_message"),
            )
            await db.commit()
```

  **Note:** The exact ARQ worker registration varies. Consult `worker.py` structure to register `session_event_listener` as a startup coroutine or background task.

- [ ] **Step 4: Write a test for `handle_session_completed`**

```python
# apps/backend/tests/test_workflow_engine_session.py (append)

@pytest.mark.asyncio
async def test_handle_session_completed_advances_dag():
    """handle_session_completed calls complete_step when session succeeds."""
    db = AsyncMock()
    engine = WorkflowEngine(db=db)

    session_id = uuid.uuid4()
    step_id = uuid.uuid4()

    session = MagicMock(spec=Session)
    session.id = session_id
    session.step_id = step_id

    step = MagicMock(spec=WorkflowStep)
    step.id = step_id

    db.get.side_effect = lambda model, id: (
        session if id == session_id else step if id == step_id else None
    )

    with patch.object(engine, "complete_step", new=AsyncMock()) as mock_complete:
        await engine.handle_session_completed(session_id, "completed")

    mock_complete.assert_called_once_with(step)


@pytest.mark.asyncio
async def test_handle_session_completed_fails_step_on_failure():
    db = AsyncMock()
    engine = WorkflowEngine(db=db)

    session_id = uuid.uuid4()
    step_id = uuid.uuid4()

    session = MagicMock(spec=Session)
    session.id = session_id
    session.step_id = step_id

    step = MagicMock(spec=WorkflowStep)
    step.id = step_id

    db.get.side_effect = lambda model, id: (
        session if id == session_id else step if id == step_id else None
    )

    with patch.object(engine, "fail_step", new=AsyncMock()) as mock_fail:
        await engine.handle_session_completed(
            session_id, "failed", error_message="SDK crashed"
        )

    mock_fail.assert_called_once_with(step, "SDK crashed")
```

- [ ] **Step 5: Run tests**

```bash
cd apps/backend && uv run pytest tests/test_workflow_engine_session.py -v
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/backend/app/services/workflow_engine.py apps/backend/app/worker.py apps/backend/tests/test_workflow_engine_session.py
git commit -m "feat(workflow): add handle_session_completed and Redis listener for DAG advancement"
```

---

## Chunk 5: Data Migration and Cleanup

### Task 7: Migrate `session_messages` → `session_events` and drop old tables

**Files:**
- Create: `apps/backend/alembic/versions/<hash>_migrate_session_messages_to_events.py`

- [ ] **Step 1: Generate migration**

```bash
cd apps/backend && uv run alembic revision -m "migrate_session_messages_to_events"
```

- [ ] **Step 2: Write `upgrade()` with data migration**

```python
def upgrade() -> None:
    # Migrate existing session_messages to session_events
    # session_messages: id, session_id, role, content (text), tool_use (JSON), timestamp
    # session_events: id, session_id, sequence, event_type, role, content (JSON), created_at

    op.execute("""
        INSERT INTO session_events (id, session_id, sequence, event_type, role, content, created_at)
        SELECT
            gen_random_uuid(),
            session_id,
            ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY timestamp) - 1 AS sequence,
            CASE
                WHEN tool_use IS NOT NULL THEN 'tool_call'
                ELSE 'message'
            END AS event_type,
            role,
            CASE
                WHEN tool_use IS NOT NULL THEN tool_use
                ELSE jsonb_build_object('text', COALESCE(content, ''))
            END AS content,
            timestamp AS created_at
        FROM session_messages
        WHERE session_id IN (SELECT id FROM sessions)
    """)

    # Drop old table
    op.drop_table("session_messages")


def downgrade() -> None:
    op.create_table(
        "session_messages",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("session_id", sa.UUID(), nullable=False),
        sa.Column("role", sa.String(20), nullable=False),
        sa.Column("content", sa.Text(), nullable=True),
        sa.Column("tool_use", sa.JSON(), nullable=True),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["session_id"], ["sessions.id"], ondelete="CASCADE"),
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
git commit -m "feat(session): migrate session_messages to session_events and drop old table"
```

---

### Task 8: Delete `AgentRunner` and `SessionMessage` model

**Files:**
- Delete: `apps/backend/app/services/agent_runner.py`
- Delete: `SessionMessage` class from `apps/backend/app/models/session.py`
- Modify: `apps/backend/app/schemas/session.py` (remove `SessionMessageResponse`)
- Modify: `apps/backend/app/models/__init__.py` (remove SessionMessage import)
- Modify: `apps/backend/tests/test_agent_runner.py` (delete or replace)

- [ ] **Step 1: Check all AgentRunner usages**

```bash
cd apps/backend && grep -r "AgentRunner\|agent_runner\|SessionMessage\|session_messages" app/ --include="*.py" -l
```
Expected: only `workflow_engine.py` — but we already replaced its usage. If other files appear, update them.

- [ ] **Step 2: Remove `AgentRunner` import from `workflow_engine.py` if present**

```bash
cd apps/backend && grep -n "AgentRunner\|agent_runner" app/services/workflow_engine.py
```
Remove any remaining imports.

- [ ] **Step 3: Delete `agent_runner.py`**

```bash
rm apps/backend/app/services/agent_runner.py
```

- [ ] **Step 4: Remove `SessionMessage` class from `models/session.py`**

  Delete the entire `SessionMessage` class definition and the `messages` relationship from `Session`.

- [ ] **Step 5: Remove `SessionMessageResponse` from `schemas/session.py` and update `SessionDetailResponse`**

  Remove `SessionMessageResponse`. Update `SessionDetailResponse` to use `SessionEventResponse` if still needed, or remove it.

- [ ] **Step 6: Update `models/__init__.py`** — remove `SessionMessage` import.

- [ ] **Step 7: Replace `tests/test_agent_runner.py`**

```python
# apps/backend/tests/test_agent_runner.py
"""AgentRunner has been replaced by SessionManager + BackendAgentStrategy."""
import pytest


def test_agent_runner_removed():
    with pytest.raises(ImportError):
        from app.services.agent_runner import AgentRunner  # noqa
```

- [ ] **Step 8: Run full test suite**

```bash
cd apps/backend && uv run pytest tests/ -v --tb=short 2>&1 | tail -40
```
Expected: all tests pass; no references to deleted modules.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(session): delete AgentRunner and SessionMessage — fully replaced by SessionManager"
```

---

## Chunk 6: Final Integration Verification

### Task 9: End-to-end smoke test

- [ ] **Step 1: Start the stack**

```bash
pnpm docker:up
cd apps/backend && uv run alembic upgrade head
uv run fastapi dev app/main.py --port 8001 &
sleep 3
```

- [ ] **Step 2: Verify all tests pass**

```bash
cd apps/backend && uv run pytest tests/ -v --tb=short 2>&1 | tail -50
```
Expected: all green.

- [ ] **Step 3: Verify API docs include new endpoints**

```bash
curl -s http://localhost:8001/openapi.json | python3 -c "
import json, sys
spec = json.load(sys.stdin)
session_paths = [p for p in spec['paths'] if 'session' in p]
print('\n'.join(session_paths))
"
```
Expected: `/projects/{project_id}/sessions`, `/sessions/{session_id}/start`, `/sessions/{session_id}/events`, etc.

- [ ] **Step 4: Verify old AgentRunner and BrainstormService are gone**

```bash
python3 -c "from app.services.agent_runner import AgentRunner" 2>&1 | grep -c "ImportError"
python3 -c "from app.services.brainstorm_service import BrainstormService" 2>&1 | grep -c "ImportError"
```
Expected: `1` for both (ImportError raised as expected).

- [ ] **Step 5: Cleanup background server**

```bash
kill %1 2>/dev/null || true
```

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat(session): Phase 1c complete — backend agent fully migrated to SessionManager"
```

---

## Summary

Phase 1c delivers:
- `BackendAgentStrategy` mapping `claude_code_sdk` streaming events to `SessionEvent` records
- `SessionManager._run_claude_code` — async iteration over SDK events
- `WorkflowEngine.auto_start_step` delegates to `SessionManager` instead of `AgentRunner`
- `WorkflowEngine.handle_session_completed` called by Redis listener to advance the DAG
- `session_messages` data migrated to `session_events`, table dropped
- `AgentRunner`, `SessionMessage` deleted
- Full test coverage for new components

**Phase 1 complete.** The unified session manager handles all agent types. Future agent types (frontend, design, test, review) require only a new `AgentStrategy` subclass and `register_strategy("type", MyStrategy)`.
