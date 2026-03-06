# Feature 5: E2E Testing with Cypress

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Run Cypress tests via the backend, capture videos/screenshots, store results. Users can trigger test runs, view results with video playback, and use Claude to write new tests or fix failures.

**Architecture:** TestRun and TestResult models in PostgreSQL. Worker runs Cypress as subprocess, parses results, saves artifacts to file storage. Claude sessions can be spawned to write or fix tests.

**Tech Stack:** FastAPI, Cypress (subprocess), SQLAlchemy async, file storage (local), claude_agent_sdk

**Depends on:** Feature 1 (Session management, ARQ workers)

---

### Task 1: TestRun and TestResult models

**Files:**
- Create: `apps/backend/app/models/test_run.py`
- Modify: `apps/backend/app/models/__init__.py`
- Test: `apps/backend/tests/test_models_test_run.py`

**Step 1: Write the failing test**

Create `apps/backend/tests/test_models_test_run.py`:

```python
import uuid

from app.models.test_run import TestResult, TestResultStatus, TestRun, TestRunStatus


def test_test_run_fields():
    run = TestRun(
        id=uuid.uuid4(),
        project_id=uuid.uuid4(),
        status=TestRunStatus.PENDING,
    )
    assert run.status == TestRunStatus.PENDING
    assert run.video_path is None


def test_test_result_fields():
    result = TestResult(
        id=uuid.uuid4(),
        run_id=uuid.uuid4(),
        spec_file="cypress/e2e/login.cy.ts",
        status=TestResultStatus.PASSED,
        duration_ms=1200,
    )
    assert result.spec_file == "cypress/e2e/login.cy.ts"
    assert result.error_message is None
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend && uv run pytest tests/test_models_test_run.py -v`
Expected: FAIL

**Step 3: Write the models**

Create `apps/backend/app/models/test_run.py`:

```python
import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class TestRunStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    PASSED = "passed"
    FAILED = "failed"


class TestResultStatus(str, enum.Enum):
    PASSED = "passed"
    FAILED = "failed"


class TestRun(Base):
    __tablename__ = "test_runs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    session_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("sessions.id"), nullable=True)
    status: Mapped[TestRunStatus] = mapped_column(Enum(TestRunStatus), default=TestRunStatus.PENDING)
    video_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    results: Mapped[list["TestResult"]] = relationship(back_populates="run", cascade="all, delete-orphan")


class TestResult(Base):
    __tablename__ = "test_results"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    run_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("test_runs.id"), nullable=False)
    spec_file: Mapped[str] = mapped_column(String(500), nullable=False)
    status: Mapped[TestResultStatus] = mapped_column(Enum(TestResultStatus), nullable=False)
    screenshot_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)

    run: Mapped["TestRun"] = relationship(back_populates="results")
```

Update `apps/backend/app/models/__init__.py` to include:

```python
from app.models.test_run import TestResult, TestResultStatus, TestRun, TestRunStatus
```

**Step 4: Run test**

Run: `cd apps/backend && uv run pytest tests/test_models_test_run.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/app/models/ apps/backend/tests/test_models_test_run.py
git commit -m "feat(backend): add TestRun and TestResult models"
```

---

### Task 2: Cypress runner service

**Files:**
- Create: `apps/backend/app/services/cypress_runner.py`
- Test: `apps/backend/tests/test_cypress_runner.py`

**Step 1: Write the failing test**

Create `apps/backend/tests/test_cypress_runner.py`:

```python
from app.services.cypress_runner import build_cypress_command, parse_cypress_results


def test_build_cypress_command_all():
    cmd = build_cypress_command(
        project_path="/home/user/project",
        video=True,
    )
    assert "cypress" in cmd[1]
    assert "run" in cmd
    assert "--config" in cmd
    assert "video=true" in cmd


def test_build_cypress_command_specific_spec():
    cmd = build_cypress_command(
        project_path="/home/user/project",
        spec="cypress/e2e/login.cy.ts",
        video=True,
    )
    assert "--spec" in cmd
    assert "cypress/e2e/login.cy.ts" in cmd


def test_parse_cypress_results_json():
    raw_json = {
        "totalPassed": 3,
        "totalFailed": 1,
        "totalDuration": 5200,
        "runs": [
            {
                "spec": {"relative": "cypress/e2e/login.cy.ts"},
                "stats": {"duration": 1200},
                "tests": [
                    {"title": ["Login", "should login"], "state": "passed"},
                ],
                "screenshots": [],
                "video": "/tmp/videos/login.cy.ts.mp4",
            }
        ],
    }
    results = parse_cypress_results(raw_json)
    assert len(results) == 1
    assert results[0]["spec_file"] == "cypress/e2e/login.cy.ts"
    assert results[0]["video"] == "/tmp/videos/login.cy.ts.mp4"
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend && uv run pytest tests/test_cypress_runner.py -v`
Expected: FAIL

**Step 3: Write the implementation**

Create `apps/backend/app/services/cypress_runner.py`:

```python
import asyncio
import json
import os


def build_cypress_command(
    project_path: str,
    spec: str | None = None,
    video: bool = True,
    browser: str = "electron",
) -> list[str]:
    cmd = ["npx", "cypress", "run", "--reporter", "json"]
    if spec:
        cmd.extend(["--spec", spec])
    cmd.extend(["--browser", browser])

    config_parts = [f"video={str(video).lower()}"]
    cmd.extend(["--config", ",".join(config_parts)])

    return cmd


def parse_cypress_results(raw: dict) -> list[dict]:
    results = []
    for run in raw.get("runs", []):
        spec_file = run.get("spec", {}).get("relative", "unknown")
        duration = run.get("stats", {}).get("duration", 0)
        video = run.get("video")
        screenshots = [s.get("path") for s in run.get("screenshots", [])]

        # Determine status from tests
        tests = run.get("tests", [])
        all_passed = all(t.get("state") == "passed" for t in tests)
        failed_tests = [t for t in tests if t.get("state") == "failed"]
        error_msg = None
        if failed_tests:
            error_msg = "; ".join(
                " > ".join(t.get("title", [])) for t in failed_tests
            )

        results.append({
            "spec_file": spec_file,
            "status": "passed" if all_passed else "failed",
            "duration_ms": duration,
            "video": video,
            "screenshots": screenshots,
            "error_message": error_msg,
        })
    return results


async def run_cypress(
    project_path: str,
    spec: str | None = None,
    video: bool = True,
) -> dict:
    cmd = build_cypress_command(project_path, spec=spec, video=video)

    proc = await asyncio.create_subprocess_exec(
        *cmd,
        cwd=project_path,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate()

    try:
        raw = json.loads(stdout.decode())
        results = parse_cypress_results(raw)
    except (json.JSONDecodeError, KeyError):
        results = []

    overall_passed = all(r["status"] == "passed" for r in results) if results else False

    return {
        "success": proc.returncode == 0,
        "overall_status": "passed" if overall_passed else "failed",
        "results": results,
        "stderr": stderr.decode() if proc.returncode != 0 else None,
    }
```

**Step 4: Run test**

Run: `cd apps/backend && uv run pytest tests/test_cypress_runner.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/app/services/cypress_runner.py apps/backend/tests/test_cypress_runner.py
git commit -m "feat(backend): add Cypress runner service with JSON parsing"
```

---

### Task 3: Cypress worker task

**Files:**
- Create: `apps/backend/app/services/cypress_task.py`
- Modify: `apps/backend/app/worker.py`
- Test: `apps/backend/tests/test_cypress_task.py`

**Step 1: Write the failing test**

Create `apps/backend/tests/test_cypress_task.py`:

```python
from app.services.cypress_task import build_test_fix_prompt


def test_build_test_fix_prompt():
    prompt = build_test_fix_prompt(
        spec_file="cypress/e2e/login.cy.ts",
        error_message="Expected 200, got 500",
    )
    assert "login.cy.ts" in prompt
    assert "Expected 200, got 500" in prompt
    assert "fix" in prompt.lower()
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend && uv run pytest tests/test_cypress_task.py -v`
Expected: FAIL

**Step 3: Write the implementation**

Create `apps/backend/app/services/cypress_task.py`:

```python
import json
import uuid

from app.redis import redis_manager
from app.services.cypress_runner import run_cypress


def build_test_fix_prompt(spec_file: str, error_message: str) -> str:
    return (
        f"The following Cypress test is failing:\n"
        f"- Spec file: {spec_file}\n"
        f"- Error: {error_message}\n\n"
        f"Please read the test file, understand the failure, and fix it. "
        f"Run the test again after fixing to verify it passes."
    )


async def run_cypress_task(
    ctx: dict,
    session_id: str,
    project_path: str,
    spec: str | None = None,
    video: bool = True,
):
    channel = f"session:{session_id}"

    await redis_manager.publish(channel, json.dumps({
        "type": "status",
        "status": "running",
    }))

    try:
        result = await run_cypress(
            project_path=project_path,
            spec=spec,
            video=video,
        )

        await redis_manager.publish(channel, json.dumps({
            "type": "test_results",
            "overall_status": result["overall_status"],
            "results": result["results"],
        }))

        await redis_manager.publish(channel, json.dumps({
            "type": "complete",
            "success": result["success"],
        }))

    except Exception as e:
        await redis_manager.publish(channel, json.dumps({
            "type": "error",
            "error": str(e),
        }))
```

Add to `apps/backend/app/worker.py`:

```python
from app.services.cypress_task import run_cypress_task

class WorkerSettings:
    functions = [run_session_task, run_figma_task, run_cypress_task]
    # ...
```

**Step 4: Run test**

Run: `cd apps/backend && uv run pytest tests/test_cypress_task.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/app/services/cypress_task.py apps/backend/app/worker.py apps/backend/tests/test_cypress_task.py
git commit -m "feat(backend): add Cypress worker task with Redis streaming"
```

---

### Task 4: Test Pydantic schemas

**Files:**
- Create: `apps/backend/app/schemas/test_run.py`
- Test: `apps/backend/tests/test_schemas_test_run.py`

**Step 1: Write the failing test**

Create `apps/backend/tests/test_schemas_test_run.py`:

```python
import uuid

from app.schemas.test_run import TestRunCreate, TestRunResponse


def test_test_run_create():
    data = TestRunCreate(spec="cypress/e2e/login.cy.ts", video=True)
    assert data.video is True


def test_test_run_create_all():
    data = TestRunCreate()
    assert data.spec is None
    assert data.video is True


def test_test_run_response():
    resp = TestRunResponse(
        id=uuid.uuid4(),
        project_id=uuid.uuid4(),
        status="pending",
        results=[],
    )
    assert resp.video_path is None
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend && uv run pytest tests/test_schemas_test_run.py -v`
Expected: FAIL

**Step 3: Write the schemas**

Create `apps/backend/app/schemas/test_run.py`:

```python
import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.test_run import TestResultStatus, TestRunStatus


class TestRunCreate(BaseModel):
    spec: str | None = None
    video: bool = True


class TestResultResponse(BaseModel):
    id: uuid.UUID
    spec_file: str
    status: TestResultStatus
    screenshot_path: str | None = None
    error_message: str | None = None
    duration_ms: int | None = None

    model_config = {"from_attributes": True}


class TestRunResponse(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    session_id: uuid.UUID | None = None
    status: TestRunStatus
    video_path: str | None = None
    results: list[TestResultResponse] = []
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class TestFixRequest(BaseModel):
    spec_file: str
    error_message: str
```

**Step 4: Run test**

Run: `cd apps/backend && uv run pytest tests/test_schemas_test_run.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/app/schemas/test_run.py apps/backend/tests/test_schemas_test_run.py
git commit -m "feat(backend): add TestRun Pydantic schemas"
```

---

### Task 5: Test runner REST API router

**Files:**
- Create: `apps/backend/app/routers/tests.py`
- Modify: `apps/backend/app/main.py`
- Test: `apps/backend/tests/test_router_tests.py`

**Step 1: Write the failing test**

Create `apps/backend/tests/test_router_tests.py`:

```python
from httpx import ASGITransport, AsyncClient

from app.main import app


async def test_list_test_runs():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get(
            "/api/projects/00000000-0000-0000-0000-000000000001/tests"
        )
    assert response.status_code == 200
    assert isinstance(response.json(), list)
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend && uv run pytest tests/test_router_tests.py -v`
Expected: FAIL

**Step 3: Write the router**

Create `apps/backend/app/routers/tests.py`:

```python
import uuid

from arq import ArqRedis
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.project import Project
from app.models.session import Session, SessionStatus, SessionType
from app.models.test_run import TestRun, TestRunStatus
from app.routers.sessions import get_arq_pool
from app.schemas.test_run import TestFixRequest, TestRunCreate, TestRunResponse

router = APIRouter(prefix="/api/projects/{project_id}/tests", tags=["tests"])


@router.get("", response_model=list[TestRunResponse])
async def list_test_runs(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(TestRun)
        .options(selectinload(TestRun.results))
        .where(TestRun.project_id == project_id)
        .order_by(TestRun.created_at.desc())
    )
    return result.scalars().all()


@router.post("", status_code=201, response_model=TestRunResponse)
async def create_test_run(
    project_id: uuid.UUID,
    body: TestRunCreate,
    db: AsyncSession = Depends(get_db),
    pool: ArqRedis = Depends(get_arq_pool),
):
    proj_result = await db.execute(select(Project).where(Project.id == project_id))
    project = proj_result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Create session for tracking
    session = Session(
        id=uuid.uuid4(),
        project_id=project_id,
        type=SessionType.TEST_RUN,
        status=SessionStatus.PENDING,
    )
    db.add(session)

    run = TestRun(
        id=uuid.uuid4(),
        project_id=project_id,
        session_id=session.id,
        status=TestRunStatus.PENDING,
    )
    db.add(run)
    await db.commit()
    await db.refresh(run, ["results"])

    await pool.enqueue_job(
        "run_cypress_task",
        str(session.id),
        project.path,
        body.spec,
        body.video,
    )

    return run


@router.get("/{run_id}", response_model=TestRunResponse)
async def get_test_run(
    project_id: uuid.UUID,
    run_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(TestRun)
        .options(selectinload(TestRun.results))
        .where(TestRun.id == run_id, TestRun.project_id == project_id)
    )
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Test run not found")
    return run


@router.post("/{run_id}/fix", status_code=202)
async def fix_failing_test(
    project_id: uuid.UUID,
    run_id: uuid.UUID,
    body: TestFixRequest,
    db: AsyncSession = Depends(get_db),
    pool: ArqRedis = Depends(get_arq_pool),
):
    proj_result = await db.execute(select(Project).where(Project.id == project_id))
    project = proj_result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    from app.services.cypress_task import build_test_fix_prompt

    prompt = build_test_fix_prompt(body.spec_file, body.error_message)

    session = Session(
        id=uuid.uuid4(),
        project_id=project_id,
        type=SessionType.TEST_RUN,
        status=SessionStatus.PENDING,
    )
    db.add(session)
    await db.commit()

    await pool.enqueue_job(
        "run_session_task",
        str(session.id),
        project.path,
        "chat",
        prompt,
    )

    return {"session_id": str(session.id), "message": "Fix session started"}
```

**Step 4: Register router in main.py**

Add to `apps/backend/app/main.py`:

```python
from app.routers.tests import router as tests_router

app.include_router(tests_router)
```

**Step 5: Run tests**

Run: `cd apps/backend && uv run pytest tests/ -v`
Expected: ALL PASS

**Step 6: Commit**

```bash
git add apps/backend/app/routers/tests.py apps/backend/app/main.py apps/backend/tests/test_router_tests.py
git commit -m "feat(backend): add Test runner REST API with fix endpoint"
```

---

### Task 6: Static file serving for videos/screenshots

**Files:**
- Modify: `apps/backend/app/main.py`
- Modify: `apps/backend/app/config.py`

**Step 1: Add storage config**

Add to `apps/backend/app/config.py`:

```python
storage_path: str = "./storage"
```

**Step 2: Mount static files in main.py**

Add to `apps/backend/app/main.py`:

```python
import os
from fastapi.staticfiles import StaticFiles
from app.config import settings

# After app creation, before routes:
os.makedirs(settings.storage_path, exist_ok=True)
app.mount("/storage", StaticFiles(directory=settings.storage_path), name="storage")
```

**Step 3: Commit**

```bash
git add apps/backend/app/main.py apps/backend/app/config.py
git commit -m "feat(backend): add static file serving for test artifacts"
```

---

### Task 7: Alembic migration for test tables

**Step 1: Generate migration**

Run: `cd apps/backend && uv run alembic revision --autogenerate -m "add test_runs and test_results tables"`

**Step 2: Run migration**

Run: `cd apps/backend && uv run alembic upgrade head`

**Step 3: Commit**

```bash
git add apps/backend/alembic/versions/
git commit -m "feat(backend): add migration for test run tables"
```
