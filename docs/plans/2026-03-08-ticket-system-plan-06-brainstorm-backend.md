# Ticket System — Plan 06: Brainstorming Backend

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build backend brainstorming service that manages AI brainstorm sessions via Claude Agent SDK, streams structured messages (text + quiz) via WebSocket, and creates tickets from brainstorm output.

**Architecture:** Backend manages Claude SDK client sessions. Agent uses structured output for quiz messages. Messages streamed via WebSocket to frontend. Multi-turn conversation via ClaudeSDKClient. On completion, summary saved as Feature Spec and ticket created.

**Tech Stack:** Claude Agent SDK (ClaudeSDKClient, structured output), FastAPI, WebSocket, Redis pub/sub

**Depends on:** [Plan 01](./2026-03-08-ticket-system-plan-01-data-layer.md), [Plan 03](./2026-03-08-ticket-system-plan-03-spec-management.md)
**Required by:** [Plan 08: Brainstorm UI](./2026-03-08-ticket-system-plan-08-brainstorm-ui.md)

---

## Task 1: Create brainstorm agent system prompt

**Files:**
- Create: `apps/backend/app/services/brainstorm_agent.py`

Define constants for the brainstorm agent system prompt and the structured output JSON schema.

### System Prompt

The `BRAINSTORM_SYSTEM_PROMPT` constant instructs the agent to:

1. Act as a brainstorming partner that helps users define features, bugs, and improvements
2. Ask questions **one at a time** using structured quiz format (JSON output)
3. Each quiz message must include:
   - A `question` string (the main question being asked)
   - A `context` string (why this question matters, background info)
   - An `options` array where each option has: `id`, `label`, `description`, `recommended` (bool), `recommendation_reason` (nullable string)
   - `allow_multiple` (bool) — whether user can pick multiple options
   - `allow_custom` (bool) — whether user can provide free-text answer instead
4. After sufficient questions (5-8), confirm with the user that brainstorming is complete
5. When confirmed, generate a summary following this format:

```
## Problem
What problem does this solve?

## Solution
High-level approach and key decisions.

## Decisions
Summary of each quiz answer and the rationale.

## Requirements
- Functional requirements (bulleted list)
- Non-functional requirements (performance, security, etc.)

## Design References
Any Figma links, mockup descriptions, or UI notes.

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2

## Technical Notes
Implementation considerations, constraints, dependencies.
```

### Structured Output Schema

Define `QUIZ_OUTPUT_SCHEMA` as a Python dict representing the JSON Schema for quiz messages. This matches the `QuizData` Pydantic schema from Plan 01:

```python
QUIZ_OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "message_type": {
            "type": "string",
            "enum": ["quiz", "text", "summary"],
            "description": "Type of message: quiz for structured questions, text for plain responses, summary for final output"
        },
        "content": {
            "type": "string",
            "description": "Plain text content (used for text and summary message types)"
        },
        "quiz": {
            "type": "object",
            "properties": {
                "question": {"type": "string"},
                "context": {"type": "string"},
                "options": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "id": {"type": "string"},
                            "label": {"type": "string"},
                            "description": {"type": "string"},
                            "recommended": {"type": "boolean"},
                            "recommendation_reason": {"type": ["string", "null"]}
                        },
                        "required": ["id", "label", "description", "recommended"]
                    }
                },
                "allow_multiple": {"type": "boolean"},
                "allow_custom": {"type": "boolean"}
            },
            "required": ["question", "context", "options", "allow_multiple", "allow_custom"]
        }
    },
    "required": ["message_type"]
}
```

Also define a helper `build_initial_prompt(source: str, initial_message: str | None, figma_data: dict | None) -> str` that constructs the first user message sent to the agent, incorporating the source type and any initial context.

**Steps:**
1. Create `apps/backend/app/services/brainstorm_agent.py` with `BRAINSTORM_SYSTEM_PROMPT`, `QUIZ_OUTPUT_SCHEMA`, and `build_initial_prompt()`
2. Run `cd apps/backend && uv run ruff check app/services/brainstorm_agent.py` — Expected: no errors
3. Commit: `git add apps/backend/app/services/brainstorm_agent.py && git commit -m "feat(backend): add brainstorm agent system prompt and output schema"`

---

## Task 2: Create brainstorm service

**Files:**
- Create: `apps/backend/app/services/brainstorm_service.py`

### Class: `BrainstormService`

This service manages brainstorm sessions, interacts with ClaudeSDKClient, persists messages, and publishes WebSocket events.

**Constructor:**

```python
def __init__(self, db: AsyncSession, redis: aioredis.Redis):
    self.db = db
    self.redis = redis
```

**Session storage:**

Process-local dict for active ClaudeSDKClient instances:

```python
# Process-local session registry. For multi-worker deployments,
# would need Redis-backed session registry.
_active_brainstorm_sessions: dict[str, Any] = {}  # session_id -> ClaudeSDKClient
```

**Methods:**

#### `start_session(project_id, source, initial_message, figma_data, user_id) -> BrainstormSessionResponse`

1. Generate `session_id = str(uuid.uuid4())`
2. Build initial prompt using `build_initial_prompt(source, initial_message, figma_data)` from `brainstorm_agent.py`
3. Create `ClaudeSDKClient` with `ClaudeAgentOptions`:
   - `system_prompt=BRAINSTORM_SYSTEM_PROMPT`
   - `output_format={"type": "json_schema", "schema": QUIZ_OUTPUT_SCHEMA}`
   - `max_turns=1` (single response per call)
4. Send initial prompt via `client.query(initial_prompt)`
5. Parse the agent's `ResultMessage` — extract structured output to determine `message_type`
6. Save the user's initial message to `brainstorm_messages` table (role=user, message_type=text)
7. Save the agent's response to `brainstorm_messages` table (role=assistant, message_type from structured output)
8. If `source == "figma"` and `figma_data` is provided, also save a system message with `message_type=figma_context` and `structured_data=figma_data`
9. Store client in `_active_brainstorm_sessions[session_id]`
10. Publish WebSocket event via Redis (`brainstorm:{session_id}` channel)
11. Return `BrainstormSessionResponse(session_id=session_id, first_message=agent_response_as_BrainstormMessageResponse)`

#### `send_message(session_id, content, quiz_response) -> BrainstormMessageResponse`

1. Retrieve client from `_active_brainstorm_sessions[session_id]` — raise 404 if not found
2. Format user message:
   - If `quiz_response` provided, format as: `"Selected: {option_labels}. {custom_text if any}"`
   - Otherwise use `content` directly
3. Save user message to `brainstorm_messages` (role=user, message_type=text)
4. Send to client via `client.query(formatted_message)`
5. Parse agent `ResultMessage` structured output
6. Save agent response to `brainstorm_messages` (role=assistant, message_type from structured output)
7. Determine WebSocket event type:
   - If `message_type == "quiz"` → publish `brainstorm_quiz` event
   - If `message_type == "text"` → publish `brainstorm_message` event
   - If `message_type == "summary"` → publish `brainstorm_summary` event
8. Publish to Redis channel `brainstorm:{session_id}`
9. Return `BrainstormMessageResponse`

#### `complete_session(session_id) -> dict`

1. Retrieve client from `_active_brainstorm_sessions[session_id]`
2. Send completion prompt: `"Please generate the final summary now. Output as message_type: summary with the full content."`
3. Parse the summary from `ResultMessage`
4. Save summary message to `brainstorm_messages` (role=assistant, message_type=summary)
5. Publish `brainstorm_summary` event via WebSocket
6. Remove client from `_active_brainstorm_sessions`
7. Return the summary content as a dict

#### `batch_update(session_id, comments) -> dict`

1. Retrieve client from `_active_brainstorm_sessions[session_id]`
2. Format comments as a single message: `"Please update the summary based on these comments:\n{formatted_comments}"`
3. Send to client, parse updated summary
4. Save messages to `brainstorm_messages`
5. Publish `brainstorm_summary` event
6. Return updated summary dict

#### `create_ticket_from_brainstorm(session_id, title, type, priority, template_id, user_id, project_id) -> Ticket`

1. Load all `brainstorm_messages` for the session from DB
2. Find the latest summary message (message_type=summary)
3. Create a `Ticket` using the existing `create_ticket()` service function with:
   - `source=TicketSource.ai_brainstorm`
   - `description` from the summary content
4. Create a `TicketSpec` with:
   - `type=SpecType.feature`
   - `title=title`
   - `content=summary_content`
   - `created_by=user_id`
5. Update all `brainstorm_messages` for this session to set `ticket_id`
6. Commit and return the ticket

**Helper: `_parse_agent_response(result: ResultMessage) -> tuple[str, str | None, dict | None]`**

Parses the agent's result into `(message_type, content, structured_data)`:
- If result has structured JSON output with `message_type == "quiz"`, extract quiz data
- If `message_type == "summary"`, extract content
- If `message_type == "text"`, extract content
- Fallback: treat as text with raw content

**Helper: `_publish_brainstorm_event(session_id, event_type, data)`**

Publishes to Redis channel `brainstorm:{session_id}` with JSON payload `{"event": event_type, "data": data}`.

**Steps:**
1. Create `apps/backend/app/services/brainstorm_service.py`
2. Run `cd apps/backend && uv run ruff check app/services/brainstorm_service.py` — Expected: no errors
3. Commit: `git add apps/backend/app/services/brainstorm_service.py && git commit -m "feat(backend): add brainstorm service with Claude SDK integration"`

---

## Task 3: Create brainstorm router

**Files:**
- Create: `apps/backend/app/routers/brainstorm.py`
- Modify: `apps/backend/app/main.py`

### Router Endpoints

All endpoints require authentication via `get_current_user` and project membership via `require_project_member`.

#### `POST /projects/{project_id}/brainstorm/start`

- Request body: `BrainstormStartRequest` (source, initial_message, figma_data)
- Creates `BrainstormService(db, redis)` and calls `start_session()`
- Returns: `BrainstormSessionResponse` (session_id + first_message)
- Status: 201

```python
@router.post(
    "/projects/{project_id}/brainstorm/start",
    response_model=BrainstormSessionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def start_brainstorm(
    data: BrainstormStartRequest,
    project_member: tuple[Project, ProjectMember] = Depends(require_project_member),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),
) -> BrainstormSessionResponse:
```

#### `POST /projects/{project_id}/brainstorm/{session_id}/message`

- Request body: `BrainstormMessageRequest` (content, quiz_response)
- Calls `send_message()`
- Returns: `BrainstormMessageResponse`

```python
@router.post(
    "/projects/{project_id}/brainstorm/{session_id}/message",
    response_model=BrainstormMessageResponse,
)
async def send_brainstorm_message(
    session_id: str,
    data: BrainstormMessageRequest,
    project_member: tuple[Project, ProjectMember] = Depends(require_project_member),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),
) -> BrainstormMessageResponse:
```

#### `POST /projects/{project_id}/brainstorm/{session_id}/complete`

- No request body
- Calls `complete_session()`
- Returns: `{"summary": <summary_dict>}`

```python
@router.post(
    "/projects/{project_id}/brainstorm/{session_id}/complete",
)
async def complete_brainstorm(
    session_id: str,
    project_member: tuple[Project, ProjectMember] = Depends(require_project_member),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),
) -> dict:
```

#### `POST /projects/{project_id}/brainstorm/{session_id}/batch-update`

- Request body: `BrainstormBatchUpdateRequest` (comments)
- Calls `batch_update()`
- Returns: `{"summary": <updated_summary_dict>}`

```python
@router.post(
    "/projects/{project_id}/brainstorm/{session_id}/batch-update",
)
async def batch_update_brainstorm(
    session_id: str,
    data: BrainstormBatchUpdateRequest,
    project_member: tuple[Project, ProjectMember] = Depends(require_project_member),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),
) -> dict:
```

#### `POST /projects/{project_id}/brainstorm/{session_id}/create-ticket`

- Request body: `CreateTicketFromBrainstormRequest` (title, type, priority, template_id)
- Calls `create_ticket_from_brainstorm()`
- Returns: `TicketResponse`
- Status: 201

```python
@router.post(
    "/projects/{project_id}/brainstorm/{session_id}/create-ticket",
    response_model=TicketResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_ticket_from_brainstorm(
    session_id: str,
    data: CreateTicketFromBrainstormRequest,
    project_member: tuple[Project, ProjectMember] = Depends(require_project_member),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),
) -> TicketResponse:
```

### Redis dependency

Add a `get_redis` dependency that retrieves the Redis client from `request.app.state.redis`:

```python
from fastapi import Request

async def get_redis(request: Request) -> aioredis.Redis:
    return request.app.state.redis
```

### Register in main.py

Add to `apps/backend/app/main.py`:

```python
from app.routers import brainstorm
# ...
app.include_router(brainstorm.router)
```

**Steps:**
1. Create `apps/backend/app/routers/brainstorm.py` with all endpoints and `get_redis` dependency
2. Modify `apps/backend/app/main.py` to import and register the brainstorm router
3. Run `cd apps/backend && uv run ruff check app/routers/brainstorm.py app/main.py` — Expected: no errors
4. Commit: `git add apps/backend/app/routers/brainstorm.py apps/backend/app/main.py && git commit -m "feat(backend): add brainstorm router with all endpoints"`

---

## Task 4: WebSocket streaming for brainstorm

**Files:**
- Modify: `apps/backend/app/models/enums.py`
- Modify: `apps/backend/app/services/ws_manager.py`

### Add WebSocket channel and events

Add to `WsChannel` enum in `apps/backend/app/models/enums.py`:

```python
brainstorm_session = "brainstorm:session"
```

Add to `WsEvent` enum:

```python
# Brainstorm
brainstorm_message = "brainstorm_message"
brainstorm_quiz = "brainstorm_quiz"
brainstorm_summary = "brainstorm_summary"
```

### Update ws_manager.py

Add the brainstorm channel to `CHANNEL_TO_REDIS_KEY`:

```python
WsChannel.brainstorm_session: lambda p: f"brainstorm:{p['session_id']}",
```

### Streaming flow

When the brainstorm service publishes events, the flow is:

1. `BrainstormService._publish_brainstorm_event()` publishes JSON to Redis channel `brainstorm:{session_id}`
2. `ConnectionManager.forward_redis_message()` picks it up for subscribed WebSocket clients
3. Frontend receives the event on the `brainstorm:session` WebSocket channel

The event payload format:

```json
{
  "event": "brainstorm_quiz",
  "data": {
    "id": "msg-uuid",
    "session_id": "session-uuid",
    "role": "assistant",
    "content": null,
    "message_type": "quiz",
    "structured_data": { "question": "...", "options": [...] },
    "created_at": "2026-03-08T..."
  }
}
```

**Steps:**
1. Add `brainstorm_session` to `WsChannel` and brainstorm events to `WsEvent` in `apps/backend/app/models/enums.py`
2. Add brainstorm channel mapping to `CHANNEL_TO_REDIS_KEY` in `apps/backend/app/services/ws_manager.py`
3. Run `cd apps/backend && uv run ruff check app/models/enums.py app/services/ws_manager.py` — Expected: no errors
4. Commit: `git add apps/backend/app/models/enums.py apps/backend/app/services/ws_manager.py && git commit -m "feat(backend): add brainstorm WebSocket channel and events"`

---

## Task 5: Handle Figma context injection

**Files:**
- Modify: `apps/backend/app/services/brainstorm_agent.py`
- Modify: `apps/backend/app/services/brainstorm_service.py`

### Figma context in initial prompt

Update `build_initial_prompt()` in `brainstorm_agent.py` to handle Figma data:

When `source == "figma"` and `figma_data` is provided, the initial prompt should include structured Figma context:

```python
def build_initial_prompt(
    source: str,
    initial_message: str | None,
    figma_data: dict | None,
) -> str:
    parts = []

    if source == "figma" and figma_data:
        parts.append("## Design Context (from Figma)\n")
        if figma_data.get("file_name"):
            parts.append(f"**File:** {figma_data['file_name']}")
        if figma_data.get("page_name"):
            parts.append(f"**Page:** {figma_data['page_name']}")
        if figma_data.get("node_names"):
            parts.append(f"**Selected elements:** {', '.join(figma_data['node_names'])}")
        if figma_data.get("description"):
            parts.append(f"**Description:** {figma_data['description']}")
        if figma_data.get("figma_url"):
            parts.append(f"**Figma URL:** {figma_data['figma_url']}")
        parts.append("")  # blank line
        parts.append(
            "Use this design context to inform your questions. "
            "Include relevant Design References in the final summary."
        )
        parts.append("")

    if initial_message:
        parts.append(initial_message)
    elif source == "figma":
        parts.append(
            "I'd like to create a ticket based on this Figma design. "
            "Please help me brainstorm the implementation details."
        )
    else:
        parts.append(
            "I'd like to brainstorm a new feature. Please start by asking me "
            "what problem I'm trying to solve."
        )

    return "\n".join(parts)
```

### Save Figma context message

In `BrainstormService.start_session()`, when `source == "figma"` and `figma_data` is provided:

1. Save a system message with `message_type=BrainstormMessageType.figma_context` and `structured_data=figma_data` **before** the first user message
2. This ensures the brainstorm history includes the Figma context for later reference

The agent's system prompt already instructs it to include Design References in the summary when Figma context is present.

**Steps:**
1. Update `build_initial_prompt()` in `apps/backend/app/services/brainstorm_agent.py` to format Figma context
2. Update `start_session()` in `apps/backend/app/services/brainstorm_service.py` to save figma_context system message
3. Run `cd apps/backend && uv run ruff check app/services/brainstorm_agent.py app/services/brainstorm_service.py` — Expected: no errors
4. Commit: `git add apps/backend/app/services/brainstorm_agent.py apps/backend/app/services/brainstorm_service.py && git commit -m "feat(backend): add Figma context injection to brainstorm sessions"`

---

## Task 6: Tests

**Files:**
- Create: `apps/backend/tests/test_brainstorm_service.py`

### Test structure

Tests use the existing `conftest.py` fixtures (`db_session`, `client`, `auth_headers`). Claude SDK calls are mocked.

### Unit tests for brainstorm_agent.py

```python
def test_build_initial_prompt_ai_source():
    """AI source with initial message uses message directly."""
    prompt = build_initial_prompt("ai", "I want to add dark mode", None)
    assert "dark mode" in prompt

def test_build_initial_prompt_ai_source_no_message():
    """AI source without message uses default prompt."""
    prompt = build_initial_prompt("ai", None, None)
    assert "brainstorm" in prompt.lower()

def test_build_initial_prompt_figma_source():
    """Figma source includes design context."""
    figma_data = {
        "file_name": "App Design",
        "page_name": "Login",
        "node_names": ["LoginForm", "SignUpButton"],
        "figma_url": "https://figma.com/file/abc123",
    }
    prompt = build_initial_prompt("figma", None, figma_data)
    assert "App Design" in prompt
    assert "Login" in prompt
    assert "LoginForm" in prompt
    assert "Design Context" in prompt

def test_quiz_output_schema_structure():
    """QUIZ_OUTPUT_SCHEMA has required fields."""
    assert "message_type" in QUIZ_OUTPUT_SCHEMA["properties"]
    assert "quiz" in QUIZ_OUTPUT_SCHEMA["properties"]
    assert "content" in QUIZ_OUTPUT_SCHEMA["properties"]
```

### Unit tests for brainstorm_service.py

Mock `ClaudeSDKClient` and its `query()` method. Use `unittest.mock.AsyncMock` and `unittest.mock.patch`.

```python
@pytest.mark.asyncio
async def test_start_session_returns_session_id(db_session, mock_redis):
    """start_session generates a UUID session_id and returns first message."""

@pytest.mark.asyncio
async def test_start_session_saves_messages(db_session, mock_redis):
    """start_session saves user and assistant messages to DB."""

@pytest.mark.asyncio
async def test_send_message_quiz_response(db_session, mock_redis):
    """send_message with quiz_response formats selected options."""

@pytest.mark.asyncio
async def test_send_message_text(db_session, mock_redis):
    """send_message with plain text forwards to agent."""

@pytest.mark.asyncio
async def test_send_message_unknown_session_raises(db_session, mock_redis):
    """send_message with invalid session_id raises 404."""

@pytest.mark.asyncio
async def test_complete_session_returns_summary(db_session, mock_redis):
    """complete_session asks agent for summary and returns it."""

@pytest.mark.asyncio
async def test_complete_session_removes_client(db_session, mock_redis):
    """complete_session removes the client from active sessions."""

@pytest.mark.asyncio
async def test_create_ticket_from_brainstorm(db_session, mock_redis):
    """create_ticket_from_brainstorm creates ticket + spec from summary."""

@pytest.mark.asyncio
async def test_publish_brainstorm_event(db_session, mock_redis):
    """Events are published to correct Redis channel."""
```

### Router integration tests

```python
@pytest.mark.asyncio
async def test_start_brainstorm_endpoint(client, db_session):
    """POST /projects/{id}/brainstorm/start returns 201 with session."""

@pytest.mark.asyncio
async def test_create_ticket_from_brainstorm_endpoint(client, db_session):
    """POST /projects/{id}/brainstorm/{session}/create-ticket returns 201."""
```

### Mock fixtures

```python
@pytest.fixture
def mock_redis():
    """Mock Redis client with publish method."""
    redis = AsyncMock()
    redis.publish = AsyncMock()
    return redis

@pytest.fixture
def mock_claude_client():
    """Mock ClaudeSDKClient that returns structured quiz output."""
    client = AsyncMock()
    client.query = AsyncMock(return_value=MockResultMessage(
        message_type="quiz",
        content=None,
        quiz={
            "question": "What problem are you solving?",
            "context": "Understanding the core problem helps scope the solution.",
            "options": [
                {"id": "a", "label": "Performance", "description": "App is too slow", "recommended": False},
                {"id": "b", "label": "UX", "description": "Users are confused", "recommended": True, "recommendation_reason": "Most common issue"},
            ],
            "allow_multiple": False,
            "allow_custom": True,
        }
    ))
    return client
```

**Steps:**
1. Create `apps/backend/tests/test_brainstorm_service.py` with all test cases
2. Run `cd apps/backend && uv run pytest tests/test_brainstorm_service.py -v` — Expected: tests fail (some service logic may need adjusting)
3. Fix any issues in the service/agent code to make tests pass
4. Run `cd apps/backend && uv run pytest tests/test_brainstorm_service.py -v` — Expected: all tests pass
5. Run `cd apps/backend && uv run ruff check tests/test_brainstorm_service.py` — Expected: no lint errors
6. Run `cd apps/backend && uv run pytest tests/ -v` — Expected: all existing tests still pass
7. Commit: `git add apps/backend/tests/test_brainstorm_service.py && git commit -m "test(backend): add brainstorm service and agent tests"`
