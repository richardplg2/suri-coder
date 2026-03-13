# Unified Agent Session Manager

## Overview

Replace `AgentRunner` and `BrainstormService` with a unified session management system. All agent types (brainstorm, backend, frontend, design, test, review, technical writer) go through a single `SessionManager` with per-agent-type behavior defined by the Strategy pattern.

**Phase 1 scope:** Core session manager + brainstorm migration + backend agent strategy.

## Decisions

| Decision | Choice |
|---|---|
| Scope | Replace both `AgentRunner` and `BrainstormService` entirely |
| Session model | Interactive multi-turn |
| Concurrency | Cross-type parallel, 1 session per agent type per project |
| Persistence | Hybrid checkpoint replay (new session from conversation history) |
| Streaming | Full transparency (all SDK events) |
| Agent config | Template-based (seed defaults, user-customizable) |
| Phasing | Phase 1: core + brainstorm + backend agent |
| Structured output | Preserved for brainstorm via strategy |

## Architecture

```
┌──────────────────────────────────────────────────┐
│                  API Layer                        │
│  POST /sessions, /sessions/{id}/message, etc.    │
└──────────────────┬───────────────────────────────┘
                   │
┌──────────────────▼───────────────────────────────┐
│              SessionManager                       │
│  - State machine (lifecycle transitions)          │
│  - SDK client registry (in-memory)                │
│  - Concurrency guard (1 per type per project)     │
│  - Event pipeline (persist + publish)             │
│  - Checkpoint management                          │
└──────┬───────────────────────────────┬───────────┘
       │                               │
┌──────▼──────────┐   ┌───────────────▼───────────┐
│ AgentStrategy   │   │   Redis Pub/Sub           │
│ (per type)      │   │   → WebSocket Manager     │
│                 │   │   → Frontend               │
│ - build_options │   └───────────────────────────┘
│ - process_event │
│ - on_complete   │
│ - get_sdk_type  │
└─────────────────┘
```

### Integration with WorkflowEngine

Decoupled via Redis events — no circular dependency:

```
WorkflowEngine.tick() → step ready → SessionManager.create_session() + start_session()
SessionManager publishes status_change:completed/failed → WorkflowEngine subscribes → tick() again
```

## Data Model

### Session (modified)

Extends the existing `sessions` table:

```python
class Session(UUIDMixin, Base):
    __tablename__ = "sessions"

    # Existing fields retained
    step_id: Mapped[uuid.UUID | None]  # nullable — brainstorm has no step
    status: Mapped[str]                # expanded enum
    git_branch: Mapped[str | None]
    git_commit_sha: Mapped[str | None]
    worktree_path: Mapped[str | None]
    cli_session_id: Mapped[str | None]
    cost_usd: Mapped[float | None]
    tokens_used: Mapped[int | None]
    started_at: Mapped[datetime]
    finished_at: Mapped[datetime | None]
    exit_code: Mapped[int | None]
    error_message: Mapped[str | None]

    # New fields
    project_id: Mapped[uuid.UUID]          # FK → projects
    ticket_id: Mapped[uuid.UUID | None]    # FK → tickets (nullable for brainstorm)
    agent_config_id: Mapped[uuid.UUID]     # FK → agent_configs
    parent_session_id: Mapped[uuid.UUID | None]  # FK → sessions (subagent/resume tracking)
    conversation_history: Mapped[dict | None]     # JSON checkpoint for resume
    total_input_tokens: Mapped[int | None]
    total_output_tokens: Mapped[int | None]

    # Relationships
    events: Mapped[list["SessionEvent"]] = relationship(
        cascade="all, delete-orphan", order_by="SessionEvent.sequence"
    )
```

**Changes from current model:**
- `step_id` becomes nullable (brainstorm sessions have no workflow step)
- Added `project_id`, `ticket_id`, `agent_config_id`, `parent_session_id`, `conversation_history`
- Added `total_input_tokens`, `total_output_tokens` (split from `tokens_used`)

### SessionStatus (expanded)

```python
class SessionStatus(str, enum.Enum):
    created = "created"           # record exists, SDK not started
    running = "running"           # SDK executing
    waiting_input = "waiting_input"  # agent turn done, awaiting user message
    completed = "completed"       # task finished successfully
    failed = "failed"             # unrecoverable error
    cancelled = "cancelled"       # user or system cancelled
```

Valid transitions:
```
created → running             (start_session)
running → waiting_input       (agent turn complete, multi-turn)
running → completed           (task done)
running → failed              (unrecoverable error)
waiting_input → running       (send_message)
any except completed → cancelled  (cancel_session)
```

### SessionEvent (replaces SessionMessage)

```python
class SessionEvent(UUIDMixin, Base):
    __tablename__ = "session_events"

    session_id: Mapped[uuid.UUID]  # FK → sessions
    sequence: Mapped[int]          # ordering within session
    event_type: Mapped[str]        # EventType enum value
    role: Mapped[str | None]       # user/assistant/system/tool
    content: Mapped[dict]          # JSON — shape varies by event_type
    created_at: Mapped[datetime]
```

### EventType

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

### Event content shapes

| Event Type | Content |
|---|---|
| `message` | `{"role": str, "text": str}` |
| `thinking` | `{"text": str}` |
| `tool_call` | `{"tool_name": str, "tool_input": dict, "status": str}` |
| `tool_result` | `{"tool_name": str, "output": str, "is_error": bool}` |
| `subagent_start` | `{"subagent_session_id": str, "description": str}` |
| `subagent_complete` | `{"subagent_session_id": str, "status": str}` |
| `cost_update` | `{"cost_usd": float, "input_tokens": int, "output_tokens": int}` |
| `status_change` | `{"old_status": str, "new_status": str}` |
| `structured_output` | `{"schema_type": str, "data": dict}` |
| `error` | `{"message": str, "recoverable": bool}` |
| `permission_request` | `{"tool_name": str, "description": str}` |

### Tables to deprecate

- `brainstorm_messages` — data migrates to `session_events`
- `session_messages` — data migrates to `session_events`

### AgentConfig additions

```python
# New field on existing AgentConfig model
agent_type: Mapped[str] = mapped_column(String(50))  # "brainstorm", "backend", etc.
output_format: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # structured output schema
```

## SessionManager

Core service managing all session lifecycles. Agent-agnostic.

```python
class SessionManager:
    def __init__(self, db: AsyncSession, redis: aioredis.Redis):
        self.db = db
        self.redis = redis
        self._clients: dict[uuid.UUID, Any] = {}  # session_id → SDK client

    async def create_session(
        self,
        agent_config_id: uuid.UUID,
        project_id: uuid.UUID,
        ticket_id: uuid.UUID | None = None,
        workflow_step_id: uuid.UUID | None = None,
        parent_session_id: uuid.UUID | None = None,
    ) -> Session:
        """Create session record. Enforces concurrency guard."""

    async def start_session(
        self,
        session_id: uuid.UUID,
        initial_prompt: str,
    ) -> None:
        """Start SDK execution. Streams events via pipeline."""

    async def send_message(
        self,
        session_id: uuid.UUID,
        content: str,
    ) -> None:
        """Send follow-up message into multi-turn session."""

    async def cancel_session(self, session_id: uuid.UUID) -> None:
        """Cancel running session. Cleanup SDK client."""

    async def resume_session(self, session_id: uuid.UUID) -> Session:
        """Create new session from checkpoint of failed/cancelled session."""

    async def get_active_sessions(
        self,
        project_id: uuid.UUID,
    ) -> list[Session]:
        """List running/waiting_input sessions for project."""
```

### Concurrency guard

Before `create_session`, check for existing active sessions:

```python
async def _check_concurrency(
    self, agent_config: AgentConfig, project_id: uuid.UUID
) -> None:
    existing = await self.db.execute(
        select(Session).where(
            Session.project_id == project_id,
            Session.agent_config_id.in_(
                select(AgentConfig.id).where(
                    AgentConfig.agent_type == agent_config.agent_type,
                    AgentConfig.project_id == project_id,
                )
            ),
            Session.status.in_(["running", "waiting_input"]),
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail=f"Agent type '{agent_config.agent_type}' already has an active session",
        )
```

### Event pipeline

Every SDK event goes through:

```python
async def _process_event(
    self,
    session: Session,
    strategy: AgentStrategy,
    sdk_event: Any,
) -> None:
    # 1. Strategy transforms SDK event → SessionEvent data
    event_data = strategy.process_event(sdk_event)
    if event_data is None:
        return  # strategy filtered out this event

    # 2. Persist to DB
    session_event = SessionEvent(
        session_id=session.id,
        sequence=self._next_sequence(session.id),
        event_type=event_data["event_type"],
        role=event_data.get("role"),
        content=event_data["content"],
    )
    self.db.add(session_event)

    # 3. Publish to Redis for WebSocket delivery
    await self.redis.publish(
        f"session:{session.id}",
        json.dumps({
            "event": event_data["event_type"],
            "data": {
                "session_id": str(session.id),
                "sequence": session_event.sequence,
                "event_type": event_data["event_type"],
                "content": event_data["content"],
            },
        }, default=str),
    )

    # 4. Update session aggregates
    if event_data["event_type"] == "cost_update":
        session.cost_usd = event_data["content"].get("cost_usd")
        session.total_input_tokens = event_data["content"].get("input_tokens")
        session.total_output_tokens = event_data["content"].get("output_tokens")
```

### Checkpoint management

```python
async def _save_checkpoint(self, session: Session) -> None:
    """Save conversation history for resume capability."""
    events = await self.db.execute(
        select(SessionEvent)
        .where(SessionEvent.session_id == session.id)
        .order_by(SessionEvent.sequence)
    )
    # Build Claude API conversation format from events
    history = self._build_conversation_history(list(events.scalars()))
    session.conversation_history = history
    await self.db.flush()
```

Checkpoint triggers:
- Running → waiting_input transition
- Running → completed transition
- Every 20 events (configurable safety net)

### Resume flow

```python
async def resume_session(self, session_id: uuid.UUID) -> Session:
    original = await self.db.get(Session, session_id)
    if original.status not in ("failed", "cancelled"):
        raise HTTPException(400, "Can only resume failed/cancelled sessions")

    # Create new session linked to original
    new_session = await self.create_session(
        agent_config_id=original.agent_config_id,
        project_id=original.project_id,
        ticket_id=original.ticket_id,
        workflow_step_id=original.step_id,
        parent_session_id=original.id,
    )

    # Start with history as context
    resume_prompt = (
        "Session resumed from checkpoint. Previous execution was interrupted. "
        "Please review current state and continue."
    )
    # Strategy builds options with conversation_history injected
    await self.start_session(new_session.id, resume_prompt)
    return new_session
```

## Agent Strategy Pattern

### Base interface

```python
from abc import ABC, abstractmethod
from typing import Any, Literal

class AgentStrategy(ABC):

    @abstractmethod
    def build_sdk_options(
        self, session: Session, agent_config: AgentConfig
    ) -> dict:
        """Build SDK options dict."""

    @abstractmethod
    def process_event(self, event: Any) -> dict | None:
        """Transform SDK event → SessionEvent data dict.
        Return None to filter out the event."""

    @abstractmethod
    async def on_session_complete(
        self, session: Session, db: AsyncSession
    ) -> None:
        """Hook when session completes — cleanup, side effects."""

    @abstractmethod
    def get_sdk_type(self) -> Literal["claude_code", "claude_agent"]:
        """Which SDK to use for this agent type."""
```

### BrainstormStrategy

```python
class BrainstormStrategy(AgentStrategy):

    def get_sdk_type(self) -> Literal["claude_code", "claude_agent"]:
        return "claude_agent"

    def build_sdk_options(
        self, session: Session, agent_config: AgentConfig
    ) -> dict:
        options = {
            "system_prompt": agent_config.system_prompt,
            "max_turns": 1,  # brainstorm is single-turn per query
        }
        if agent_config.output_format:
            options["output_format"] = agent_config.output_format
        if agent_config.mcp_servers:
            options["mcp_servers"] = agent_config.mcp_servers
        return options

    def process_event(self, event: Any) -> dict | None:
        # Parse structured output (quiz/summary/text)
        output = self._parse_structured_output(event)
        return {
            "event_type": "structured_output",
            "role": "assistant",
            "content": {
                "schema_type": output["message_type"],
                "data": output,
            },
        }

    async def on_session_complete(
        self, session: Session, db: AsyncSession
    ) -> None:
        pass  # user decides when to create ticket

    def _parse_structured_output(self, event: Any) -> dict:
        """Same logic as current _parse_agent_response."""
        # ... (migrated from brainstorm_service.py)
```

### BackendAgentStrategy

```python
class BackendAgentStrategy(AgentStrategy):

    def get_sdk_type(self) -> Literal["claude_code", "claude_agent"]:
        return "claude_code"

    def build_sdk_options(
        self, session: Session, agent_config: AgentConfig
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
        # Map claude_code_sdk events 1:1 to SessionEvent
        if hasattr(event, "type"):
            return self._map_sdk_event(event)
        return None

    async def on_session_complete(
        self, session: Session, db: AsyncSession
    ) -> None:
        # Notify WorkflowEngine via Redis that step is done
        # Cleanup git worktree if needed
        pass

    def _map_sdk_event(self, event: Any) -> dict:
        """Map claude_code_sdk event types to EventType values."""
        # message → message
        # tool_use → tool_call
        # tool_result → tool_result
        # thinking → thinking
        # cost → cost_update
        # etc.
```

### Strategy Registry

```python
STRATEGY_REGISTRY: dict[str, type[AgentStrategy]] = {
    "brainstorm": BrainstormStrategy,
    "backend": BackendAgentStrategy,
    # Phase 2: "frontend", "design", "test", "review", "technical_writer"
}

def get_strategy(agent_type: str) -> AgentStrategy:
    cls = STRATEGY_REGISTRY.get(agent_type)
    if cls is None:
        raise ValueError(f"Unknown agent type: {agent_type}")
    return cls()
```

## Streaming & WebSocket

### Redis channel format

Uses existing `session:stream` WsChannel, keyed by session_id:

```json
{
  "channel": "session:stream",
  "ref": "session:stream:{session_id}",
  "event": "tool_call",
  "data": {
    "session_id": "uuid",
    "sequence": 42,
    "event_type": "tool_call",
    "content": {
      "tool_name": "Edit",
      "tool_input": {"file_path": "...", "old_string": "...", "new_string": "..."},
      "status": "running"
    }
  }
}
```

### Frontend subscription

Existing `use-ws-channel` hook works unchanged:

```typescript
useWsChannel('session:stream', { session_id }, (event) => {
  // append to transcript store based on event.event type
})
```

### Brainstorm migration

| Before | After |
|---|---|
| `POST /brainstorm/start` → REST response | `POST /sessions` + `POST /sessions/{id}/start` → events via WebSocket |
| `POST /brainstorm/{id}/message` → REST response | `POST /sessions/{id}/message` → events via WebSocket |
| `brainstorm:session` WsChannel | `session:stream` WsChannel (unified) |
| `BrainstormMessage` table | `SessionEvent` with `event_type: structured_output` |

## Checkpoint & Resume

### What gets checkpointed

Conversation history in Claude API format — enough to feed back to a new SDK session:

```json
[
  {"role": "user", "content": "..."},
  {"role": "assistant", "content": "...", "tool_calls": [...]},
  {"role": "tool", "content": "...", "tool_call_id": "..."},
  ...
]
```

### Checkpoint triggers

- Running → waiting_input transition
- Running → completed transition
- Every 20 events (configurable, safety net for long sessions)

### Resume creates a new session

Original session stays in `failed`/`cancelled` status. New session has `parent_session_id` pointing to the original. Strategy builds SDK options and injects conversation history as context.

### What cannot be resumed

- Pending tool calls mid-execution (tool was running when crash happened)
- In-memory SDK state
- Corrupted git worktree state

In these cases, the resume session includes a system message asking the agent to review current state and continue.

## API Endpoints

### New unified endpoints

```
POST   /projects/{id}/sessions                 — create session
POST   /sessions/{id}/start                    — start with initial prompt
POST   /sessions/{id}/message                  — send follow-up message
POST   /sessions/{id}/cancel                   — cancel running session
POST   /sessions/{id}/resume                   — resume from checkpoint
GET    /projects/{id}/sessions                 — list sessions (filter: status, agent_type, ticket_id)
GET    /sessions/{id}                          — session detail + metadata
GET    /sessions/{id}/events                   — paginated event history
GET    /projects/{id}/sessions/active          — currently running/waiting sessions
```

### Brainstorm-specific endpoints (kept)

```
POST   /sessions/{id}/complete                 — trigger summary generation (brainstorm only)
POST   /sessions/{id}/create-ticket            — create ticket from brainstorm summary
```

These are thin wrappers that call `SessionManager.send_message()` with specific prompts, then perform domain-specific actions (spec creation, ticket creation).

### Deprecation

| Old endpoint | Replacement |
|---|---|
| `POST /projects/{id}/brainstorm/start` | `POST /projects/{id}/sessions` + `POST /sessions/{id}/start` |
| `POST /projects/{id}/brainstorm/{id}/message` | `POST /sessions/{id}/message` |
| `POST /projects/{id}/brainstorm/{id}/complete` | `POST /sessions/{id}/complete` |
| `POST /tickets/{id}/run` | Internally uses SessionManager (facade unchanged) |

## Migration Plan

### Phase 1a — Build new system alongside old

- Create `SessionManager`, `AgentStrategy` base, `STRATEGY_REGISTRY`
- Create `SessionEvent` model + Alembic migration
- Alter `Session` model (add new fields, make `step_id` nullable)
- Expand `SessionStatus` enum
- Add `agent_type`, `output_format` to `AgentConfig`
- New API router: `/sessions/`

### Phase 1b — Migrate brainstorm

- Implement `BrainstormStrategy`
- Wire brainstorm endpoints to SessionManager
- Migrate `BrainstormMessage` data → `SessionEvent`
- Update frontend: subscribe to `session:stream` instead of `brainstorm:session`
- Delete `BrainstormService`, `brainstorm_service.py`, `brainstorm_agent.py`
- Delete `BrainstormMessage` model

### Phase 1c — Add backend agent

- Implement `BackendAgentStrategy`
- Refactor `WorkflowEngine.auto_start_step()` to use SessionManager
- Wire WorkflowEngine ↔ SessionManager via Redis events
- Delete `AgentRunner`, `agent_runner.py`
- Delete `SessionMessage` model

### DB migration

Single Alembic migration covering:
1. Add columns to `sessions`: `project_id`, `ticket_id`, `agent_config_id`, `parent_session_id`, `conversation_history`, `total_input_tokens`, `total_output_tokens`
2. Make `step_id` nullable
3. Create `session_events` table
4. Add `agent_type`, `output_format` columns to `agent_configs`
5. Expand `SessionStatus` enum values
6. Data migration: `session_messages` → `session_events`, `brainstorm_messages` → `session_events`
7. Drop `session_messages`, `brainstorm_messages` tables (after verification)

## Files to Create

```
apps/backend/app/services/session_manager.py     — SessionManager class
apps/backend/app/services/strategies/             — strategy directory
apps/backend/app/services/strategies/__init__.py
apps/backend/app/services/strategies/base.py      — AgentStrategy ABC
apps/backend/app/services/strategies/brainstorm.py — BrainstormStrategy
apps/backend/app/services/strategies/backend.py    — BackendAgentStrategy
apps/backend/app/services/strategies/registry.py   — STRATEGY_REGISTRY
apps/backend/app/models/session_event.py          — SessionEvent model
apps/backend/app/schemas/session.py               — updated Pydantic schemas
apps/backend/app/routers/sessions.py              — unified session endpoints
```

## Files to Modify

```
apps/backend/app/models/session.py      — add new fields, make step_id nullable
apps/backend/app/models/enums.py        — expand SessionStatus, add EventType
apps/backend/app/models/agent_config.py — add agent_type, output_format
apps/backend/app/services/workflow_engine.py — use SessionManager instead of AgentRunner
apps/backend/app/routers/brainstorm.py  — redirect to session endpoints
apps/backend/app/main.py               — register new router
```

## Files to Delete (after migration)

```
apps/backend/app/services/brainstorm_service.py
apps/backend/app/services/brainstorm_agent.py
apps/backend/app/services/agent_runner.py
apps/backend/app/models/brainstorm_message.py
```
