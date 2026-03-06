# Feature 3: Git Worktree Management

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Manage git worktrees per project via API. Users create/list/delete worktrees in the UI, then assign Claude Code sessions to run in specific worktrees for isolation.

**Architecture:** Worktree model in PostgreSQL tracks worktree metadata. Service layer wraps `git worktree` CLI commands via subprocess. Sessions reference an optional worktree_id — worker uses worktree path as `cwd` instead of project root.

**Tech Stack:** FastAPI, SQLAlchemy async, PostgreSQL, asyncio.subprocess (git CLI)

**Depends on:** Feature 1 (Project model, Session model)

---

### Task 1: Worktree model

**Files:**
- Create: `apps/backend/app/models/worktree.py`
- Modify: `apps/backend/app/models/__init__.py`
- Modify: `apps/backend/app/models/session.py` (add worktree_id FK)
- Test: `apps/backend/tests/test_models_worktree.py`

**Step 1: Write the failing test**

Create `apps/backend/tests/test_models_worktree.py`:

```python
import uuid

from app.models.worktree import Worktree, WorktreeStatus


def test_worktree_model_fields():
    wt = Worktree(
        id=uuid.uuid4(),
        project_id=uuid.uuid4(),
        branch="feature/auth",
        path="/tmp/worktrees/feature-auth",
        status=WorktreeStatus.ACTIVE,
    )
    assert wt.branch == "feature/auth"
    assert wt.status == WorktreeStatus.ACTIVE
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend && uv run pytest tests/test_models_worktree.py -v`
Expected: FAIL

**Step 3: Write the model**

Create `apps/backend/app/models/worktree.py`:

```python
import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class WorktreeStatus(str, enum.Enum):
    ACTIVE = "active"
    LOCKED = "locked"
    REMOVING = "removing"


class Worktree(Base):
    __tablename__ = "worktrees"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    branch: Mapped[str] = mapped_column(String(255), nullable=False)
    path: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[WorktreeStatus] = mapped_column(Enum(WorktreeStatus), default=WorktreeStatus.ACTIVE)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
```

Add `worktree_id` to Session model in `apps/backend/app/models/session.py`:

```python
# Add this field to the Session class, after worker_id:
worktree_id: Mapped[uuid.UUID | None] = mapped_column(
    UUID(as_uuid=True), ForeignKey("worktrees.id"), nullable=True
)
```

Update `apps/backend/app/models/__init__.py`:

```python
from app.models.project import Project
from app.models.session import Session, SessionMessage, SessionStatus, SessionType
from app.models.skill import ProjectSkill, Skill
from app.models.worktree import Worktree, WorktreeStatus

__all__ = [
    "Project",
    "ProjectSkill",
    "Session",
    "SessionMessage",
    "SessionStatus",
    "SessionType",
    "Skill",
    "Worktree",
    "WorktreeStatus",
]
```

**Step 4: Run test**

Run: `cd apps/backend && uv run pytest tests/test_models_worktree.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/app/models/ apps/backend/tests/test_models_worktree.py
git commit -m "feat(backend): add Worktree model and session worktree_id FK"
```

---

### Task 2: Git worktree service (subprocess wrapper)

**Files:**
- Create: `apps/backend/app/services/git_worktree.py`
- Test: `apps/backend/tests/test_git_worktree_service.py`

**Step 1: Write the failing test**

Create `apps/backend/tests/test_git_worktree_service.py`:

```python
import os
import tempfile

import pytest

from app.services.git_worktree import GitWorktreeService


@pytest.fixture
def git_repo():
    with tempfile.TemporaryDirectory() as tmpdir:
        os.system(f"cd {tmpdir} && git init && git commit --allow-empty -m 'init'")
        yield tmpdir


@pytest.mark.asyncio
async def test_create_worktree(git_repo):
    service = GitWorktreeService()
    wt_path = os.path.join(git_repo, ".worktrees", "test-branch")

    result = await service.create(
        repo_path=git_repo,
        branch="test-branch",
        worktree_path=wt_path,
        new_branch=True,
    )
    assert result["success"] is True
    assert os.path.isdir(wt_path)


@pytest.mark.asyncio
async def test_list_worktrees(git_repo):
    service = GitWorktreeService()
    result = await service.list(repo_path=git_repo)
    assert isinstance(result, list)
    assert len(result) >= 1  # main worktree always listed


@pytest.mark.asyncio
async def test_remove_worktree(git_repo):
    service = GitWorktreeService()
    wt_path = os.path.join(git_repo, ".worktrees", "to-remove")
    await service.create(repo_path=git_repo, branch="to-remove", worktree_path=wt_path, new_branch=True)

    result = await service.remove(repo_path=git_repo, worktree_path=wt_path)
    assert result["success"] is True
    assert not os.path.isdir(wt_path)
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend && uv run pytest tests/test_git_worktree_service.py -v`
Expected: FAIL

**Step 3: Write the implementation**

Create `apps/backend/app/services/git_worktree.py`:

```python
import asyncio
import os


class GitWorktreeService:
    async def _run(self, cmd: list[str], cwd: str) -> tuple[int, str, str]:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            cwd=cwd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate()
        return proc.returncode, stdout.decode(), stderr.decode()

    async def create(
        self,
        repo_path: str,
        branch: str,
        worktree_path: str,
        new_branch: bool = True,
    ) -> dict:
        os.makedirs(os.path.dirname(worktree_path), exist_ok=True)

        cmd = ["git", "worktree", "add"]
        if new_branch:
            cmd.extend(["-b", branch])
        cmd.append(worktree_path)
        if not new_branch:
            cmd.append(branch)

        returncode, stdout, stderr = await self._run(cmd, repo_path)
        return {
            "success": returncode == 0,
            "path": worktree_path,
            "branch": branch,
            "error": stderr if returncode != 0 else None,
        }

    async def list(self, repo_path: str) -> list[dict]:
        returncode, stdout, stderr = await self._run(
            ["git", "worktree", "list", "--porcelain"], repo_path
        )
        if returncode != 0:
            return []

        worktrees = []
        current = {}
        for line in stdout.strip().split("\n"):
            if line.startswith("worktree "):
                if current:
                    worktrees.append(current)
                current = {"path": line.split(" ", 1)[1]}
            elif line.startswith("HEAD "):
                current["head"] = line.split(" ", 1)[1]
            elif line.startswith("branch "):
                current["branch"] = line.split(" ", 1)[1].replace("refs/heads/", "")
            elif line == "bare":
                current["bare"] = True
            elif line == "":
                if current:
                    worktrees.append(current)
                    current = {}
        if current:
            worktrees.append(current)
        return worktrees

    async def remove(self, repo_path: str, worktree_path: str, force: bool = False) -> dict:
        cmd = ["git", "worktree", "remove"]
        if force:
            cmd.append("--force")
        cmd.append(worktree_path)

        returncode, stdout, stderr = await self._run(cmd, repo_path)
        return {
            "success": returncode == 0,
            "error": stderr if returncode != 0 else None,
        }
```

**Step 4: Run test**

Run: `cd apps/backend && uv run pytest tests/test_git_worktree_service.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/app/services/git_worktree.py apps/backend/tests/test_git_worktree_service.py
git commit -m "feat(backend): add git worktree subprocess service"
```

---

### Task 3: Worktree Pydantic schemas

**Files:**
- Create: `apps/backend/app/schemas/worktree.py`
- Test: `apps/backend/tests/test_schemas_worktree.py`

**Step 1: Write the failing test**

Create `apps/backend/tests/test_schemas_worktree.py`:

```python
import uuid

from app.schemas.worktree import WorktreeCreate, WorktreeResponse


def test_worktree_create():
    data = WorktreeCreate(branch="feature/auth", new_branch=True)
    assert data.branch == "feature/auth"
    assert data.new_branch is True


def test_worktree_response():
    resp = WorktreeResponse(
        id=uuid.uuid4(),
        project_id=uuid.uuid4(),
        branch="feature/auth",
        path="/tmp/wt",
        status="active",
    )
    assert resp.status == "active"
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend && uv run pytest tests/test_schemas_worktree.py -v`
Expected: FAIL

**Step 3: Write the schemas**

Create `apps/backend/app/schemas/worktree.py`:

```python
import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.worktree import WorktreeStatus


class WorktreeCreate(BaseModel):
    branch: str
    new_branch: bool = True


class WorktreeResponse(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    branch: str
    path: str
    status: WorktreeStatus
    created_at: datetime | None = None

    model_config = {"from_attributes": True}
```

**Step 4: Run test**

Run: `cd apps/backend && uv run pytest tests/test_schemas_worktree.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/app/schemas/worktree.py apps/backend/tests/test_schemas_worktree.py
git commit -m "feat(backend): add Worktree Pydantic schemas"
```

---

### Task 4: Worktree REST API router

**Files:**
- Create: `apps/backend/app/routers/worktrees.py`
- Modify: `apps/backend/app/main.py`
- Test: `apps/backend/tests/test_router_worktrees.py`

**Step 1: Write the failing test**

Create `apps/backend/tests/test_router_worktrees.py`:

```python
from httpx import ASGITransport, AsyncClient

from app.main import app


async def test_list_worktrees():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get(
            "/api/projects/00000000-0000-0000-0000-000000000001/worktrees"
        )
    assert response.status_code == 200
    assert isinstance(response.json(), list)
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend && uv run pytest tests/test_router_worktrees.py -v`
Expected: FAIL

**Step 3: Write the router**

Create `apps/backend/app/routers/worktrees.py`:

```python
import os
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.project import Project
from app.models.worktree import Worktree, WorktreeStatus
from app.schemas.worktree import WorktreeCreate, WorktreeResponse
from app.services.git_worktree import GitWorktreeService

router = APIRouter(prefix="/api/projects/{project_id}/worktrees", tags=["worktrees"])
git_service = GitWorktreeService()


@router.get("", response_model=list[WorktreeResponse])
async def list_worktrees(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Worktree).where(Worktree.project_id == project_id)
    )
    return result.scalars().all()


@router.post("", status_code=201, response_model=WorktreeResponse)
async def create_worktree(
    project_id: uuid.UUID,
    body: WorktreeCreate,
    db: AsyncSession = Depends(get_db),
):
    # Get project path
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Build worktree path
    safe_branch = body.branch.replace("/", "-")
    wt_path = os.path.join(project.path, ".worktrees", safe_branch)

    # Create via git
    git_result = await git_service.create(
        repo_path=project.path,
        branch=body.branch,
        worktree_path=wt_path,
        new_branch=body.new_branch,
    )
    if not git_result["success"]:
        raise HTTPException(status_code=400, detail=git_result["error"])

    # Save to DB
    worktree = Worktree(
        id=uuid.uuid4(),
        project_id=project_id,
        branch=body.branch,
        path=wt_path,
        status=WorktreeStatus.ACTIVE,
    )
    db.add(worktree)
    await db.commit()
    await db.refresh(worktree)
    return worktree


@router.delete("/{worktree_id}", status_code=204)
async def remove_worktree(
    project_id: uuid.UUID,
    worktree_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Worktree).where(
            Worktree.id == worktree_id,
            Worktree.project_id == project_id,
        )
    )
    worktree = result.scalar_one_or_none()
    if not worktree:
        raise HTTPException(status_code=404, detail="Worktree not found")

    # Get project for repo path
    proj_result = await db.execute(select(Project).where(Project.id == project_id))
    project = proj_result.scalar_one_or_none()

    # Remove via git
    git_result = await git_service.remove(
        repo_path=project.path,
        worktree_path=worktree.path,
    )
    if not git_result["success"]:
        raise HTTPException(status_code=400, detail=git_result["error"])

    await db.delete(worktree)
    await db.commit()
```

**Step 4: Register router in main.py**

Add to `apps/backend/app/main.py`:

```python
from app.routers.worktrees import router as worktrees_router

app.include_router(worktrees_router)
```

**Step 5: Run tests**

Run: `cd apps/backend && uv run pytest tests/ -v`
Expected: ALL PASS

**Step 6: Commit**

```bash
git add apps/backend/app/routers/worktrees.py apps/backend/app/main.py apps/backend/tests/test_router_worktrees.py
git commit -m "feat(backend): add Worktree REST API with git integration"
```

---

### Task 5: Wire worktree into session runner

**Files:**
- Modify: `apps/backend/app/services/session_runner.py`
- Modify: `apps/backend/app/routers/sessions.py`
- Test: `apps/backend/tests/test_session_runner.py` (add worktree test)

**Step 1: Add test for worktree-aware session**

Add to `apps/backend/tests/test_session_runner.py`:

```python
def test_build_agent_options_with_worktree_path():
    options = build_agent_options(
        session_type="chat",
        project_path="/home/user/project/.worktrees/feature-auth",
        prompt="Hello",
        skills_content=None,
    )
    assert options.cwd.as_posix() == "/home/user/project/.worktrees/feature-auth"
```

**Step 2: Run test — should already pass**

Run: `cd apps/backend && uv run pytest tests/test_session_runner.py -v`
Expected: PASS (build_agent_options already takes project_path as param)

**Step 3: Update session creation to accept optional worktree_id**

In `apps/backend/app/schemas/session.py`, add to `SessionCreate`:

```python
class SessionCreate(BaseModel):
    project_id: uuid.UUID
    type: SessionType
    prompt: str
    worktree_id: uuid.UUID | None = None
```

In `apps/backend/app/routers/sessions.py`, resolve worktree path when creating session:

```python
# In create_session, after creating the Session object:
# Resolve working directory
work_dir = "/tmp"  # default
if body.worktree_id:
    wt_result = await db.execute(
        select(Worktree).where(Worktree.id == body.worktree_id)
    )
    wt = wt_result.scalar_one_or_none()
    if wt:
        work_dir = wt.path
else:
    proj_result = await db.execute(
        select(Project).where(Project.id == body.project_id)
    )
    proj = proj_result.scalar_one_or_none()
    if proj:
        work_dir = proj.path

await pool.enqueue_job(
    "run_session_task",
    str(session.id),
    work_dir,
    body.type.value,
    body.prompt,
)
```

**Step 4: Run all tests**

Run: `cd apps/backend && uv run pytest tests/ -v`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add apps/backend/app/schemas/session.py apps/backend/app/routers/sessions.py apps/backend/tests/test_session_runner.py
git commit -m "feat(backend): wire worktree path into session runner"
```

---

### Task 6: Alembic migration for worktree table

**Step 1: Generate migration**

Run: `cd apps/backend && uv run alembic revision --autogenerate -m "add worktree table and session worktree_id"`

**Step 2: Review and run**

Run: `cd apps/backend && uv run alembic upgrade head`

**Step 3: Commit**

```bash
git add apps/backend/alembic/versions/
git commit -m "feat(backend): add migration for worktree table"
```
