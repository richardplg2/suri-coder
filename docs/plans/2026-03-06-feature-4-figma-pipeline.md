# Feature 4: Figma Design-to-Code Pipeline

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** A 3-step pipeline where users paste a Figma URL, map design nodes to component specs via a form, then Claude Code generates React components by reading the Figma design through MCP.

**Architecture:** FigmaTask and FigmaNode models store the mapping. cursor-talk-to-figma MCP server is configured as an external MCP server in ClaudeAgentOptions. Each node generates a structured prompt that Claude processes with access to Figma data via MCP tools.

**Tech Stack:** FastAPI, SQLAlchemy, claude_agent_sdk with MCP, cursor-talk-to-figma-mcp

**Depends on:** Feature 1 (Session management), Feature 2 (Skills — optional Figma skill)

**Reference:** https://github.com/grab/cursor-talk-to-figma-mcp

---

### Task 1: FigmaTask and FigmaNode models

**Files:**
- Create: `apps/backend/app/models/figma.py`
- Modify: `apps/backend/app/models/__init__.py`
- Test: `apps/backend/tests/test_models_figma.py`

**Step 1: Write the failing test**

Create `apps/backend/tests/test_models_figma.py`:

```python
import uuid

from app.models.figma import FigmaNode, FigmaTask, FigmaTaskStatus


def test_figma_task_fields():
    task = FigmaTask(
        id=uuid.uuid4(),
        project_id=uuid.uuid4(),
        figma_file_url="https://www.figma.com/design/abc123/MyDesign",
        status=FigmaTaskStatus.DRAFT,
    )
    assert task.status == FigmaTaskStatus.DRAFT
    assert task.session_id is None


def test_figma_node_fields():
    node = FigmaNode(
        id=uuid.uuid4(),
        task_id=uuid.uuid4(),
        node_id="123:456",
        component_name="Button",
        description="Primary CTA button with hover state",
    )
    assert node.node_id == "123:456"
    assert node.props_spec is None
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend && uv run pytest tests/test_models_figma.py -v`
Expected: FAIL

**Step 3: Write the models**

Create `apps/backend/app/models/figma.py`:

```python
import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class FigmaTaskStatus(str, enum.Enum):
    DRAFT = "draft"
    GENERATING = "generating"
    COMPLETED = "completed"
    FAILED = "failed"


class FigmaTask(Base):
    __tablename__ = "figma_tasks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    session_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("sessions.id"), nullable=True)
    figma_file_url: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[FigmaTaskStatus] = mapped_column(Enum(FigmaTaskStatus), default=FigmaTaskStatus.DRAFT)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    nodes: Mapped[list["FigmaNode"]] = relationship(back_populates="task", cascade="all, delete-orphan")


class FigmaNode(Base):
    __tablename__ = "figma_nodes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("figma_tasks.id"), nullable=False)
    node_id: Mapped[str] = mapped_column(String(255), nullable=False)
    component_name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    props_spec: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    preview_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    task: Mapped["FigmaTask"] = relationship(back_populates="nodes")
```

Update `apps/backend/app/models/__init__.py` to include:

```python
from app.models.figma import FigmaNode, FigmaTask, FigmaTaskStatus
```

**Step 4: Run test**

Run: `cd apps/backend && uv run pytest tests/test_models_figma.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/app/models/ apps/backend/tests/test_models_figma.py
git commit -m "feat(backend): add FigmaTask and FigmaNode models"
```

---

### Task 2: Figma Pydantic schemas

**Files:**
- Create: `apps/backend/app/schemas/figma.py`
- Test: `apps/backend/tests/test_schemas_figma.py`

**Step 1: Write the failing test**

Create `apps/backend/tests/test_schemas_figma.py`:

```python
import uuid

from app.schemas.figma import FigmaNodeCreate, FigmaTaskCreate, FigmaTaskResponse


def test_figma_task_create():
    data = FigmaTaskCreate(
        figma_file_url="https://www.figma.com/design/abc123/MyDesign",
        nodes=[
            FigmaNodeCreate(
                node_id="123:456",
                component_name="Button",
                description="Primary button",
            ),
        ],
    )
    assert len(data.nodes) == 1


def test_figma_task_response():
    resp = FigmaTaskResponse(
        id=uuid.uuid4(),
        project_id=uuid.uuid4(),
        figma_file_url="https://figma.com/abc",
        status="draft",
        nodes=[],
    )
    assert resp.status == "draft"
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend && uv run pytest tests/test_schemas_figma.py -v`
Expected: FAIL

**Step 3: Write the schemas**

Create `apps/backend/app/schemas/figma.py`:

```python
import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.figma import FigmaTaskStatus


class FigmaNodeCreate(BaseModel):
    node_id: str
    component_name: str
    description: str = ""
    props_spec: dict | None = None


class FigmaNodeResponse(BaseModel):
    id: uuid.UUID
    node_id: str
    component_name: str
    description: str
    props_spec: dict | None = None
    preview_url: str | None = None

    model_config = {"from_attributes": True}


class FigmaTaskCreate(BaseModel):
    figma_file_url: str
    nodes: list[FigmaNodeCreate] = []


class FigmaTaskResponse(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    session_id: uuid.UUID | None = None
    figma_file_url: str
    status: FigmaTaskStatus
    nodes: list[FigmaNodeResponse] = []
    created_at: datetime | None = None

    model_config = {"from_attributes": True}
```

**Step 4: Run test**

Run: `cd apps/backend && uv run pytest tests/test_schemas_figma.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/app/schemas/figma.py apps/backend/tests/test_schemas_figma.py
git commit -m "feat(backend): add Figma Pydantic schemas"
```

---

### Task 3: Figma prompt builder service

**Files:**
- Create: `apps/backend/app/services/figma_prompt.py`
- Test: `apps/backend/tests/test_figma_prompt.py`

**Step 1: Write the failing test**

Create `apps/backend/tests/test_figma_prompt.py`:

```python
from app.services.figma_prompt import build_figma_prompt


def test_build_single_node_prompt():
    nodes = [
        {
            "node_id": "123:456",
            "component_name": "Button",
            "description": "Primary CTA button with hover state",
            "props_spec": {"label": "string", "onClick": "function"},
        }
    ]
    prompt = build_figma_prompt(
        figma_file_url="https://figma.com/design/abc/MyDesign",
        nodes=nodes,
    )
    assert "123:456" in prompt
    assert "Button" in prompt
    assert "Primary CTA button" in prompt
    assert "label" in prompt


def test_build_multi_node_prompt():
    nodes = [
        {"node_id": "1:1", "component_name": "Button", "description": "btn", "props_spec": None},
        {"node_id": "2:2", "component_name": "Card", "description": "card", "props_spec": None},
    ]
    prompt = build_figma_prompt(figma_file_url="https://figma.com/x", nodes=nodes)
    assert "Button" in prompt
    assert "Card" in prompt
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend && uv run pytest tests/test_figma_prompt.py -v`
Expected: FAIL

**Step 3: Write the implementation**

Create `apps/backend/app/services/figma_prompt.py`:

```python
import json


def build_figma_prompt(figma_file_url: str, nodes: list[dict]) -> str:
    parts = [
        "Generate React components from the following Figma design.",
        f"Figma file: {figma_file_url}",
        "",
        "For each component below:",
        "1. Use the Figma MCP tools to read the design node and inspect its properties.",
        "2. Generate a React TypeScript component with Tailwind CSS.",
        "3. Match the design as closely as possible (colors, spacing, typography).",
        "4. Write the component file to the project.",
        "",
        "Components to generate:",
        "",
    ]

    for i, node in enumerate(nodes, 1):
        parts.append(f"### Component {i}: {node['component_name']}")
        parts.append(f"- Figma Node ID: {node['node_id']}")
        parts.append(f"- Description: {node['description']}")
        if node.get("props_spec"):
            parts.append(f"- Props: {json.dumps(node['props_spec'])}")
        parts.append("")

    return "\n".join(parts)
```

**Step 4: Run test**

Run: `cd apps/backend && uv run pytest tests/test_figma_prompt.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/app/services/figma_prompt.py apps/backend/tests/test_figma_prompt.py
git commit -m "feat(backend): add Figma prompt builder service"
```

---

### Task 4: Figma session runner (MCP integration)

**Files:**
- Create: `apps/backend/app/services/figma_runner.py`
- Test: `apps/backend/tests/test_figma_runner.py`

**Step 1: Write the failing test**

Create `apps/backend/tests/test_figma_runner.py`:

```python
from app.services.figma_runner import build_figma_agent_options


def test_build_figma_agent_options():
    options = build_figma_agent_options(
        project_path="/home/user/project",
        figma_websocket_url="ws://localhost:3055",
    )
    assert "figma" in options.mcp_servers
    assert options.cwd.as_posix() == "/home/user/project"
    assert any("mcp__figma" in t for t in options.allowed_tools)
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend && uv run pytest tests/test_figma_runner.py -v`
Expected: FAIL

**Step 3: Write the implementation**

Create `apps/backend/app/services/figma_runner.py`:

```python
import json
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


def build_figma_agent_options(
    project_path: str,
    figma_websocket_url: str = "ws://localhost:3055",
    skills_content: str | None = None,
) -> ClaudeAgentOptions:
    system_prompt = "You are a design-to-code expert. Generate pixel-perfect React components from Figma designs."
    if skills_content:
        system_prompt = f"{skills_content}\n\n{system_prompt}"

    return ClaudeAgentOptions(
        allowed_tools=[
            "Read", "Write", "Edit", "Bash", "Grep", "Glob",
            "mcp__figma__get_node_info",
            "mcp__figma__get_node_children",
            "mcp__figma__get_node_styles",
            "mcp__figma__get_node_css",
        ],
        system_prompt=system_prompt,
        permission_mode="acceptEdits",
        cwd=Path(project_path),
        mcp_servers={
            "figma": {
                "type": "stdio",
                "command": "npx",
                "args": ["-y", "cursor-talk-to-figma-mcp", figma_websocket_url],
            },
        },
    )


async def run_figma_task(
    ctx: dict,
    session_id: str,
    project_path: str,
    prompt: str,
    figma_websocket_url: str = "ws://localhost:3055",
    skills_content: str | None = None,
):
    channel = f"session:{session_id}"

    options = build_figma_agent_options(
        project_path=project_path,
        figma_websocket_url=figma_websocket_url,
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

Run: `cd apps/backend && uv run pytest tests/test_figma_runner.py -v`
Expected: PASS

**Step 5: Register in worker**

Add `run_figma_task` to `apps/backend/app/worker.py`:

```python
from app.services.figma_runner import run_figma_task

class WorkerSettings:
    functions = [run_session_task, run_figma_task]
    # ...
```

**Step 6: Commit**

```bash
git add apps/backend/app/services/figma_runner.py apps/backend/app/worker.py apps/backend/tests/test_figma_runner.py
git commit -m "feat(backend): add Figma session runner with MCP integration"
```

---

### Task 5: Figma REST API router

**Files:**
- Create: `apps/backend/app/routers/figma.py`
- Modify: `apps/backend/app/main.py`
- Test: `apps/backend/tests/test_router_figma.py`

**Step 1: Write the failing test**

Create `apps/backend/tests/test_router_figma.py`:

```python
from httpx import ASGITransport, AsyncClient

from app.main import app


async def test_list_figma_tasks():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get(
            "/api/projects/00000000-0000-0000-0000-000000000001/figma"
        )
    assert response.status_code == 200
    assert isinstance(response.json(), list)
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend && uv run pytest tests/test_router_figma.py -v`
Expected: FAIL

**Step 3: Write the router**

Create `apps/backend/app/routers/figma.py`:

```python
import uuid

from arq import ArqRedis
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.figma import FigmaNode, FigmaTask, FigmaTaskStatus
from app.models.project import Project
from app.models.session import Session, SessionStatus, SessionType
from app.routers.sessions import get_arq_pool
from app.schemas.figma import FigmaNodeCreate, FigmaTaskCreate, FigmaTaskResponse
from app.services.figma_prompt import build_figma_prompt

router = APIRouter(prefix="/api/projects/{project_id}/figma", tags=["figma"])


@router.get("", response_model=list[FigmaTaskResponse])
async def list_figma_tasks(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(FigmaTask)
        .options(selectinload(FigmaTask.nodes))
        .where(FigmaTask.project_id == project_id)
        .order_by(FigmaTask.created_at.desc())
    )
    return result.scalars().all()


@router.post("", status_code=201, response_model=FigmaTaskResponse)
async def create_figma_task(
    project_id: uuid.UUID,
    body: FigmaTaskCreate,
    db: AsyncSession = Depends(get_db),
):
    task = FigmaTask(
        id=uuid.uuid4(),
        project_id=project_id,
        figma_file_url=body.figma_file_url,
        status=FigmaTaskStatus.DRAFT,
    )
    for node_data in body.nodes:
        node = FigmaNode(id=uuid.uuid4(), **node_data.model_dump())
        task.nodes.append(node)

    db.add(task)
    await db.commit()
    await db.refresh(task, ["nodes"])
    return task


@router.post("/{task_id}/nodes", status_code=201)
async def add_node(
    project_id: uuid.UUID,
    task_id: uuid.UUID,
    body: FigmaNodeCreate,
    db: AsyncSession = Depends(get_db),
):
    node = FigmaNode(id=uuid.uuid4(), task_id=task_id, **body.model_dump())
    db.add(node)
    await db.commit()
    await db.refresh(node)
    return node


@router.post("/{task_id}/generate", status_code=202, response_model=FigmaTaskResponse)
async def generate_from_figma(
    project_id: uuid.UUID,
    task_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    pool: ArqRedis = Depends(get_arq_pool),
):
    # Load task with nodes
    result = await db.execute(
        select(FigmaTask)
        .options(selectinload(FigmaTask.nodes))
        .where(FigmaTask.id == task_id, FigmaTask.project_id == project_id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Figma task not found")
    if not task.nodes:
        raise HTTPException(status_code=400, detail="No nodes to generate")

    # Get project path
    proj_result = await db.execute(select(Project).where(Project.id == project_id))
    project = proj_result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Create session
    session = Session(
        id=uuid.uuid4(),
        project_id=project_id,
        type=SessionType.FIGMA_TO_CODE,
        status=SessionStatus.PENDING,
    )
    db.add(session)
    task.session_id = session.id
    task.status = FigmaTaskStatus.GENERATING
    await db.commit()
    await db.refresh(task, ["nodes"])

    # Build prompt and enqueue
    nodes_data = [
        {
            "node_id": n.node_id,
            "component_name": n.component_name,
            "description": n.description,
            "props_spec": n.props_spec,
        }
        for n in task.nodes
    ]
    prompt = build_figma_prompt(task.figma_file_url, nodes_data)

    await pool.enqueue_job(
        "run_figma_task",
        str(session.id),
        project.path,
        prompt,
    )

    return task
```

**Step 4: Register router in main.py**

Add to `apps/backend/app/main.py`:

```python
from app.routers.figma import router as figma_router

app.include_router(figma_router)
```

**Step 5: Run tests**

Run: `cd apps/backend && uv run pytest tests/ -v`
Expected: ALL PASS

**Step 6: Commit**

```bash
git add apps/backend/app/routers/figma.py apps/backend/app/main.py apps/backend/tests/test_router_figma.py
git commit -m "feat(backend): add Figma REST API with generate endpoint"
```

---

### Task 6: Alembic migration for figma tables

**Step 1: Generate migration**

Run: `cd apps/backend && uv run alembic revision --autogenerate -m "add figma_tasks and figma_nodes tables"`

**Step 2: Run migration**

Run: `cd apps/backend && uv run alembic upgrade head`

**Step 3: Commit**

```bash
git add apps/backend/alembic/versions/
git commit -m "feat(backend): add migration for figma tables"
```
