# Feature 1: Claude Code Session Management + WebSocket Streaming

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Backend infrastructure to spawn Claude Code sessions via SDK, stream output through WebSocket to clients, with Redis-backed task queue.

**Architecture:** FastAPI handles REST + WebSocket endpoints. ARQ workers run Claude SDK sessions. Redis PubSub bridges worker streaming events to WebSocket connections. PostgreSQL stores session state and messages.

**Tech Stack:** FastAPI, ARQ, Redis, claude_agent_sdk (ClaudeSDKClient), SQLAlchemy async, WebSocket, PostgreSQL

**Dependencies to add:** `arq`, `redis[hiredis]`, `claude-agent-sdk`

---

### Task 1: Add dependencies and Redis config

**Files:**
- Modify: `apps/backend/pyproject.toml`
- Modify: `apps/backend/app/config.py`

**Step 1: Add new dependencies to pyproject.toml**

Add to `dependencies` list in `apps/backend/pyproject.toml`:

```toml
dependencies = [
    "fastapi[standard]>=0.115.0",
    "sqlalchemy[asyncio]>=2.0.0",
    "asyncpg>=0.30.0",
    "alembic>=1.15.0",
    "pydantic-settings>=2.7.0",
    "arq>=0.26.0",
    "redis[hiredis]>=5.0.0",
    "claude-agent-sdk>=0.1.0",
]
```

**Step 2: Add Redis config to settings**

Modify `apps/backend/app/config.py`:

```python
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Agent Coding API"
    debug: bool = False
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/agent_coding"
    redis_url: str = "redis://localhost:6379"
    anthropic_api_key: str = ""

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
```

**Step 3: Install dependencies**

Run: `cd apps/backend && uv sync`

**Step 4: Commit**

```bash
git add apps/backend/pyproject.toml apps/backend/app/config.py apps/backend/uv.lock
git commit -m "feat(backend): add arq, redis, claude-agent-sdk dependencies"
```

---

### Task 2: Session and SessionMessage SQLAlchemy models

**Files:**
- Create: `apps/backend/app/models/session.py`
- Modify: `apps/backend/app/models/__init__.py`
- Test: `apps/backend/tests/test_models_session.py`

**Step 1: Write the failing test**

Create `apps/backend/tests/test_models_session.py`:

```python
import uuid
from datetime import datetime, timezone

from app.models.session import Session, SessionMessage, SessionStatus, SessionType


def test_session_model_fields():
    session = Session(
        id=uuid.uuid4(),
        project_id=uuid.uuid4(),
        type=SessionType.CHAT,
        status=SessionStatus.PENDING,
    )
    assert session.type == SessionType.CHAT
    assert session.status == SessionStatus.PENDING
    assert session.cost_usd is None


def test_session_message_model_fields():
    msg = SessionMessage(
        id=uuid.uuid4(),
        session_id=uuid.uuid4(),
        role="user",
        content="hello",
    )
    assert msg.role == "user"
    assert msg.content == "hello"
    assert msg.tool_use is None
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend && uv run pytest tests/test_models_session.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.models.session'`

**Step 3: Write the models**

Create `apps/backend/app/models/session.py`:

```python
import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, Float, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class SessionType(str, enum.Enum):
    CHAT = "chat"
    FIGMA_TO_CODE = "figma_to_code"
    TEST_RUN = "test_run"
    CODE_REVIEW = "code_review"


class SessionStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    type: Mapped[SessionType] = mapped_column(Enum(SessionType), nullable=False)
    status: Mapped[SessionStatus] = mapped_column(Enum(SessionStatus), default=SessionStatus.PENDING)
    worker_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    cost_usd: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    messages: Mapped[list["SessionMessage"]] = relationship(back_populates="session", cascade="all, delete-orphan")


class SessionMessage(Base):
    __tablename__ = "session_messages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("sessions.id"), nullable=False)
    role: Mapped[str] = mapped_column(String(50), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    tool_use: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    session: Mapped["Session"] = relationship(back_populates="messages")
```

Update `apps/backend/app/models/__init__.py`:

```python
from app.models.session import Session, SessionMessage, SessionStatus, SessionType

__all__ = ["Session", "SessionMessage", "SessionStatus", "SessionType"]
```

**Step 4: Run test to verify it passes**

Run: `cd apps/backend && uv run pytest tests/test_models_session.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/app/models/ apps/backend/tests/test_models_session.py
git commit -m "feat(backend): add Session and SessionMessage models"
```

---

### Task 3: Project model (Session depends on it)

**Files:**
- Create: `apps/backend/app/models/project.py`
- Modify: `apps/backend/app/models/__init__.py`
- Test: `apps/backend/tests/test_models_project.py`

**Step 1: Write the failing test**

Create `apps/backend/tests/test_models_project.py`:

```python
import uuid

from app.models.project import Project


def test_project_model_fields():
    project = Project(
        id=uuid.uuid4(),
        name="my-project",
        path="/home/user/projects/my-project",
    )
    assert project.name == "my-project"
    assert project.settings is None
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend && uv run pytest tests/test_models_project.py -v`
Expected: FAIL

**Step 3: Write the model**

Create `apps/backend/app/models/project.py`:

```python
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    path: Mapped[str] = mapped_column(Text, nullable=False)
    settings: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
```

Update `apps/backend/app/models/__init__.py`:

```python
from app.models.project import Project
from app.models.session import Session, SessionMessage, SessionStatus, SessionType

__all__ = ["Project", "Session", "SessionMessage", "SessionStatus", "SessionType"]
```

**Step 4: Run tests**

Run: `cd apps/backend && uv run pytest tests/test_models_project.py tests/test_models_session.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/app/models/ apps/backend/tests/test_models_project.py
git commit -m "feat(backend): add Project model"
```

---

### Task 4: Pydantic schemas for Session API

**Files:**
- Create: `apps/backend/app/schemas/session.py`
- Test: `apps/backend/tests/test_schemas_session.py`

**Step 1: Write the failing test**

Create `apps/backend/tests/test_schemas_session.py`:

```python
import uuid

from app.schemas.session import SessionCreate, SessionResponse


def test_session_create_schema():
    data = SessionCreate(
        project_id=uuid.uuid4(),
        type="chat",
        prompt="Hello Claude",
    )
    assert data.type == "chat"
    assert data.prompt == "Hello Claude"


def test_session_response_schema():
    sid = uuid.uuid4()
    pid = uuid.uuid4()
    resp = SessionResponse(
        id=sid,
        project_id=pid,
        type="chat",
        status="pending",
        cost_usd=None,
    )
    assert resp.id == sid
    assert resp.status == "pending"
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend && uv run pytest tests/test_schemas_session.py -v`
Expected: FAIL

**Step 3: Write the schemas**

Create `apps/backend/app/schemas/session.py`:

```python
import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.session import SessionStatus, SessionType


class SessionCreate(BaseModel):
    project_id: uuid.UUID
    type: SessionType
    prompt: str


class SessionSendMessage(BaseModel):
    content: str


class SessionResponse(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    type: SessionType
    status: SessionStatus
    cost_usd: float | None = None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class SessionMessageResponse(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    role: str
    content: str
    tool_use: dict | None = None
    timestamp: datetime | None = None

    model_config = {"from_attributes": True}
```

**Step 4: Run test**

Run: `cd apps/backend && uv run pytest tests/test_schemas_session.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/app/schemas/ apps/backend/tests/test_schemas_session.py
git commit -m "feat(backend): add Session Pydantic schemas"
```

---

### Task 5: Redis connection manager

**Files:**
- Create: `apps/backend/app/redis.py`
- Test: `apps/backend/tests/test_redis.py`

**Step 1: Write the failing test**

Create `apps/backend/tests/test_redis.py`:

```python
from app.redis import RedisManager


def test_redis_manager_init():
    manager = RedisManager(url="redis://localhost:6379")
    assert manager.url == "redis://localhost:6379"
    assert manager._redis is None
    assert manager._pubsub_connections == {}
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend && uv run pytest tests/test_redis.py -v`
Expected: FAIL

**Step 3: Write the implementation**

Create `apps/backend/app/redis.py`:

```python
from redis.asyncio import Redis


class RedisManager:
    def __init__(self, url: str):
        self.url = url
        self._redis: Redis | None = None
        self._pubsub_connections: dict[str, any] = {}

    async def connect(self) -> Redis:
        if self._redis is None:
            self._redis = Redis.from_url(self.url, decode_responses=True)
        return self._redis

    async def disconnect(self):
        if self._redis:
            await self._redis.close()
            self._redis = None

    async def publish(self, channel: str, message: str):
        redis = await self.connect()
        await redis.publish(channel, message)

    async def subscribe(self, channel: str):
        redis = await self.connect()
        pubsub = redis.pubsub()
        await pubsub.subscribe(channel)
        self._pubsub_connections[channel] = pubsub
        return pubsub

    async def unsubscribe(self, channel: str):
        if channel in self._pubsub_connections:
            pubsub = self._pubsub_connections.pop(channel)
            await pubsub.unsubscribe(channel)
            await pubsub.close()


redis_manager = RedisManager(url="redis://localhost:6379")
```

**Step 4: Run test**

Run: `cd apps/backend && uv run pytest tests/test_redis.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/app/redis.py apps/backend/tests/test_redis.py
git commit -m "feat(backend): add Redis connection manager"
```

---

### Task 6: WebSocket connection manager

**Files:**
- Create: `apps/backend/app/ws_manager.py`
- Test: `apps/backend/tests/test_ws_manager.py`

**Step 1: Write the failing test**

Create `apps/backend/tests/test_ws_manager.py`:

```python
from unittest.mock import AsyncMock

import pytest

from app.ws_manager import ConnectionManager


@pytest.fixture
def manager():
    return ConnectionManager()


def test_manager_init(manager):
    assert manager.main_connections == []
    assert manager.session_connections == {}


@pytest.mark.asyncio
async def test_connect_main(manager):
    ws = AsyncMock()
    await manager.connect_main(ws)
    assert ws in manager.main_connections
    ws.accept.assert_called_once()


@pytest.mark.asyncio
async def test_connect_session(manager):
    ws = AsyncMock()
    await manager.connect_session("session-1", ws)
    assert "session-1" in manager.session_connections
    assert ws in manager.session_connections["session-1"]


@pytest.mark.asyncio
async def test_disconnect_main(manager):
    ws = AsyncMock()
    await manager.connect_main(ws)
    manager.disconnect_main(ws)
    assert ws not in manager.main_connections


@pytest.mark.asyncio
async def test_broadcast_to_session(manager):
    ws1 = AsyncMock()
    ws2 = AsyncMock()
    await manager.connect_session("s1", ws1)
    await manager.connect_session("s1", ws2)
    await manager.send_to_session("s1", {"type": "text", "data": "hello"})
    ws1.send_json.assert_called_once_with({"type": "text", "data": "hello"})
    ws2.send_json.assert_called_once_with({"type": "text", "data": "hello"})
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend && uv run pytest tests/test_ws_manager.py -v`
Expected: FAIL

**Step 3: Write the implementation**

Create `apps/backend/app/ws_manager.py`:

```python
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self.main_connections: list[WebSocket] = []
        self.session_connections: dict[str, list[WebSocket]] = {}

    async def connect_main(self, websocket: WebSocket):
        await websocket.accept()
        self.main_connections.append(websocket)

    def disconnect_main(self, websocket: WebSocket):
        self.main_connections.remove(websocket)

    async def connect_session(self, session_id: str, websocket: WebSocket):
        await websocket.accept()
        if session_id not in self.session_connections:
            self.session_connections[session_id] = []
        self.session_connections[session_id].append(websocket)

    def disconnect_session(self, session_id: str, websocket: WebSocket):
        if session_id in self.session_connections:
            self.session_connections[session_id].remove(websocket)
            if not self.session_connections[session_id]:
                del self.session_connections[session_id]

    async def send_to_session(self, session_id: str, data: dict):
        if session_id in self.session_connections:
            for ws in self.session_connections[session_id]:
                await ws.send_json(data)

    async def broadcast_main(self, data: dict):
        for ws in self.main_connections:
            await ws.send_json(data)


ws_manager = ConnectionManager()
```

**Step 4: Run test**

Run: `cd apps/backend && uv run pytest tests/test_ws_manager.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/app/ws_manager.py apps/backend/tests/test_ws_manager.py
git commit -m "feat(backend): add WebSocket connection manager"
```

---

### Task 7: ARQ worker with Claude SDK session runner

**Files:**
- Create: `apps/backend/app/worker.py`
- Create: `apps/backend/app/services/session_runner.py`
- Test: `apps/backend/tests/test_session_runner.py`

**Step 1: Write the failing test**

Create `apps/backend/tests/test_session_runner.py`:

```python
import uuid
from unittest.mock import AsyncMock, patch

import pytest

from app.services.session_runner import build_agent_options, run_session_task


def test_build_agent_options_chat():
    options = build_agent_options(
        session_type="chat",
        project_path="/home/user/project",
        prompt="Hello",
        skills_content=None,
    )
    assert options.cwd.as_posix() == "/home/user/project"
    assert "Read" in options.allowed_tools
    assert options.permission_mode == "acceptEdits"


def test_build_agent_options_with_skills():
    skills = "You are a TDD expert.\n\nAlways write tests first."
    options = build_agent_options(
        session_type="chat",
        project_path="/tmp/test",
        prompt="Write a function",
        skills_content=skills,
    )
    assert "TDD expert" in options.system_prompt
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend && uv run pytest tests/test_session_runner.py -v`
Expected: FAIL

**Step 3: Write session runner service**

Create `apps/backend/app/services/session_runner.py`:

```python
import json
import uuid
from pathlib import Path

from claude_agent_sdk import (
    AssistantMessage,
    ClaudeAgentOptions,
    ClaudeSDKClient,
    ResultMessage,
    TextBlock,
    ToolUseBlock,
)

from app.redis import redis_manager


def build_agent_options(
    session_type: str,
    project_path: str,
    prompt: str,
    skills_content: str | None = None,
) -> ClaudeAgentOptions:
    system_prompt = "You are a helpful coding assistant."
    if skills_content:
        system_prompt = f"{skills_content}\n\n{system_prompt}"

    return ClaudeAgentOptions(
        allowed_tools=["Read", "Write", "Edit", "Bash", "Grep", "Glob"],
        system_prompt=system_prompt,
        permission_mode="acceptEdits",
        cwd=Path(project_path),
    )


async def run_session_task(
    ctx: dict,
    session_id: str,
    project_path: str,
    session_type: str,
    prompt: str,
    skills_content: str | None = None,
):
    channel = f"session:{session_id}"

    options = build_agent_options(
        session_type=session_type,
        project_path=project_path,
        prompt=prompt,
        skills_content=skills_content,
    )

    await redis_manager.publish(channel, json.dumps({
        "type": "status",
        "status": "running",
    }))

    try:
        async with ClaudeSDKClient(options=options) as client:
            await client.query(prompt)

            async for msg in client.receive_response():
                if isinstance(msg, AssistantMessage):
                    for block in msg.content:
                        if isinstance(block, TextBlock):
                            await redis_manager.publish(channel, json.dumps({
                                "type": "text",
                                "content": block.text,
                            }))
                        elif isinstance(block, ToolUseBlock):
                            await redis_manager.publish(channel, json.dumps({
                                "type": "tool_use",
                                "tool": block.name,
                                "input": block.input,
                            }))
                elif isinstance(msg, ResultMessage):
                    await redis_manager.publish(channel, json.dumps({
                        "type": "complete",
                        "cost_usd": msg.total_cost_usd,
                    }))

    except Exception as e:
        await redis_manager.publish(channel, json.dumps({
            "type": "error",
            "error": str(e),
        }))
```

**Step 4: Run test**

Run: `cd apps/backend && uv run pytest tests/test_session_runner.py -v`
Expected: PASS

**Step 5: Create the ARQ worker entry point**

Create `apps/backend/app/worker.py`:

```python
from arq import cron
from arq.connections import RedisSettings

from app.config import settings
from app.services.session_runner import run_session_task


class WorkerSettings:
    functions = [run_session_task]
    redis_settings = RedisSettings.from_dsn(settings.redis_url)
    max_jobs = 5
    job_timeout = 600  # 10 minutes per session
```

**Step 6: Commit**

```bash
git add apps/backend/app/services/session_runner.py apps/backend/app/worker.py apps/backend/tests/test_session_runner.py
git commit -m "feat(backend): add ARQ worker and Claude SDK session runner"
```

---

### Task 8: Session REST API router

**Files:**
- Create: `apps/backend/app/routers/sessions.py`
- Modify: `apps/backend/app/main.py`
- Test: `apps/backend/tests/test_router_sessions.py`

**Step 1: Write the failing test**

Create `apps/backend/tests/test_router_sessions.py`:

```python
from unittest.mock import AsyncMock, patch

from httpx import ASGITransport, AsyncClient

from app.main import app


async def test_create_session():
    mock_pool = AsyncMock()
    mock_pool.enqueue_job = AsyncMock(return_value=AsyncMock(job_id="job-123"))

    with patch("app.routers.sessions.get_arq_pool", return_value=mock_pool):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.post("/api/sessions", json={
                "project_id": "00000000-0000-0000-0000-000000000001",
                "type": "chat",
                "prompt": "Hello Claude",
            })

    assert response.status_code == 201
    data = response.json()
    assert data["type"] == "chat"
    assert data["status"] == "pending"


async def test_list_sessions():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/api/sessions")
    assert response.status_code == 200
    assert isinstance(response.json(), list)
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend && uv run pytest tests/test_router_sessions.py -v`
Expected: FAIL

**Step 3: Write the router**

Create `apps/backend/app/routers/sessions.py`:

```python
import uuid

from arq import ArqRedis
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.session import Session, SessionStatus
from app.schemas.session import SessionCreate, SessionResponse

router = APIRouter(prefix="/api/sessions", tags=["sessions"])

_arq_pool: ArqRedis | None = None


async def get_arq_pool() -> ArqRedis:
    global _arq_pool
    if _arq_pool is None:
        raise HTTPException(status_code=503, detail="Worker pool not ready")
    return _arq_pool


def set_arq_pool(pool: ArqRedis):
    global _arq_pool
    _arq_pool = pool


@router.post("", status_code=201, response_model=SessionResponse)
async def create_session(
    body: SessionCreate,
    db: AsyncSession = Depends(get_db),
    pool: ArqRedis = Depends(get_arq_pool),
):
    session = Session(
        id=uuid.uuid4(),
        project_id=body.project_id,
        type=body.type,
        status=SessionStatus.PENDING,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)

    await pool.enqueue_job(
        "run_session_task",
        str(session.id),
        "/tmp",  # TODO: resolve from project
        body.type.value,
        body.prompt,
    )

    return session


@router.get("", response_model=list[SessionResponse])
async def list_sessions(
    project_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(Session).order_by(Session.created_at.desc())
    if project_id:
        query = query.where(Session.project_id == project_id)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session
```

**Step 4: Register router in main.py**

Update `apps/backend/app/main.py`:

```python
from contextlib import asynccontextmanager

from arq import create_pool
from arq.connections import RedisSettings
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.redis import redis_manager
from app.routers.sessions import router as sessions_router, set_arq_pool


@asynccontextmanager
async def lifespan(app: FastAPI):
    await redis_manager.connect()
    pool = await create_pool(RedisSettings.from_dsn(settings.redis_url))
    set_arq_pool(pool)
    yield
    await pool.close()
    await redis_manager.disconnect()


app = FastAPI(
    title=settings.app_name,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sessions_router)


@app.get("/health")
async def health_check():
    return {"status": "ok"}
```

**Step 5: Run tests**

Run: `cd apps/backend && uv run pytest tests/ -v`
Expected: ALL PASS

**Step 6: Commit**

```bash
git add apps/backend/app/routers/sessions.py apps/backend/app/main.py apps/backend/tests/test_router_sessions.py
git commit -m "feat(backend): add Session REST API router with ARQ integration"
```

---

### Task 9: WebSocket endpoints

**Files:**
- Create: `apps/backend/app/routers/ws.py`
- Modify: `apps/backend/app/main.py`
- Test: `apps/backend/tests/test_ws_endpoints.py`

**Step 1: Write the failing test**

Create `apps/backend/tests/test_ws_endpoints.py`:

```python
import pytest
from fastapi.testclient import TestClient

from app.main import app


def test_main_ws_connects():
    client = TestClient(app)
    with client.websocket_connect("/ws") as ws:
        # Should connect without error
        pass


def test_session_ws_connects():
    client = TestClient(app)
    with client.websocket_connect("/ws/session/test-session-id") as ws:
        pass
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend && uv run pytest tests/test_ws_endpoints.py -v`
Expected: FAIL

**Step 3: Write the WebSocket router**

Create `apps/backend/app/routers/ws.py`:

```python
import asyncio
import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.redis import redis_manager
from app.ws_manager import ws_manager

router = APIRouter()


@router.websocket("/ws")
async def main_websocket(websocket: WebSocket):
    await ws_manager.connect_main(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # Handle main channel commands (future: notifications, status)
    except WebSocketDisconnect:
        ws_manager.disconnect_main(websocket)


@router.websocket("/ws/session/{session_id}")
async def session_websocket(websocket: WebSocket, session_id: str):
    await ws_manager.connect_session(session_id, websocket)
    channel = f"session:{session_id}"

    pubsub = await redis_manager.subscribe(channel)

    async def relay_messages():
        try:
            async for message in pubsub.listen():
                if message["type"] == "message":
                    data = json.loads(message["data"])
                    await ws_manager.send_to_session(session_id, data)
                    if data.get("type") in ("complete", "error"):
                        break
        except asyncio.CancelledError:
            pass

    relay_task = asyncio.create_task(relay_messages())

    try:
        while True:
            data = await websocket.receive_text()
            # Handle client messages (e.g., follow-up prompts)
    except WebSocketDisconnect:
        relay_task.cancel()
        ws_manager.disconnect_session(session_id, websocket)
        await redis_manager.unsubscribe(channel)
```

**Step 4: Register WS router in main.py**

Add to `apps/backend/app/main.py` after `app.include_router(sessions_router)`:

```python
from app.routers.ws import router as ws_router

app.include_router(ws_router)
```

**Step 5: Run tests**

Run: `cd apps/backend && uv run pytest tests/ -v`
Expected: ALL PASS

**Step 6: Commit**

```bash
git add apps/backend/app/routers/ws.py apps/backend/app/main.py apps/backend/tests/test_ws_endpoints.py
git commit -m "feat(backend): add WebSocket endpoints with Redis PubSub relay"
```

---

### Task 10: Alembic migration for initial tables

**Step 1: Generate migration**

Run: `cd apps/backend && uv run alembic revision --autogenerate -m "add project, session, session_message tables"`

**Step 2: Review the generated migration file**

Check: `apps/backend/alembic/versions/` — verify it creates `projects`, `sessions`, `session_messages` tables with correct columns.

**Step 3: Run migration (requires running PostgreSQL)**

Run: `cd apps/backend && uv run alembic upgrade head`

**Step 4: Commit**

```bash
git add apps/backend/alembic/versions/
git commit -m "feat(backend): add migration for project, session, session_message tables"
```
