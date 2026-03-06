# Feature 6: File Review Workflow

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Per-file code review with AI-generated comments, inline diff viewer, interactive Q&A per file, and approve/reject/fix actions.

**Architecture:** ReviewSession and FileReview models. When a review is triggered, the backend runs `git diff` to get changed files, then spawns a Claude session per file to generate review comments. Users can interact with Claude per-file and trigger fix sessions.

**Tech Stack:** FastAPI, SQLAlchemy async, claude_agent_sdk, git CLI (subprocess), PostgreSQL

**Depends on:** Feature 1 (Session management), Feature 3 (Worktree — review can target worktree branch)

---

### Task 1: ReviewSession and FileReview models

**Files:**
- Create: `apps/backend/app/models/review.py`
- Modify: `apps/backend/app/models/__init__.py`
- Test: `apps/backend/tests/test_models_review.py`

**Step 1: Write the failing test**

Create `apps/backend/tests/test_models_review.py`:

```python
import uuid

from app.models.review import FileReview, FileReviewStatus, ReviewSession, ReviewStatus


def test_review_session_fields():
    rs = ReviewSession(
        id=uuid.uuid4(),
        project_id=uuid.uuid4(),
        branch="feature/auth",
        status=ReviewStatus.IN_PROGRESS,
    )
    assert rs.branch == "feature/auth"
    assert rs.session_id is None


def test_file_review_fields():
    fr = FileReview(
        id=uuid.uuid4(),
        review_id=uuid.uuid4(),
        file_path="src/auth/login.ts",
        diff_content="- old\n+ new",
        user_status=FileReviewStatus.PENDING,
    )
    assert fr.file_path == "src/auth/login.ts"
    assert fr.ai_comments is None
    assert fr.conversation is None
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend && uv run pytest tests/test_models_review.py -v`
Expected: FAIL

**Step 3: Write the models**

Create `apps/backend/app/models/review.py`:

```python
import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ReviewStatus(str, enum.Enum):
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"


class FileReviewStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class ReviewSession(Base):
    __tablename__ = "review_sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    session_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("sessions.id"), nullable=True)
    branch: Mapped[str] = mapped_column(String(255), nullable=False)
    base_branch: Mapped[str] = mapped_column(String(255), default="main")
    status: Mapped[ReviewStatus] = mapped_column(Enum(ReviewStatus), default=ReviewStatus.IN_PROGRESS)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    files: Mapped[list["FileReview"]] = relationship(back_populates="review", cascade="all, delete-orphan")


class FileReview(Base):
    __tablename__ = "file_reviews"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    review_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("review_sessions.id"), nullable=False)
    file_path: Mapped[str] = mapped_column(Text, nullable=False)
    diff_content: Mapped[str] = mapped_column(Text, nullable=False)
    ai_comments: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    user_status: Mapped[FileReviewStatus] = mapped_column(Enum(FileReviewStatus), default=FileReviewStatus.PENDING)
    conversation: Mapped[list | None] = mapped_column(JSON, nullable=True)

    review: Mapped["ReviewSession"] = relationship(back_populates="files")
```

Update `apps/backend/app/models/__init__.py` to include:

```python
from app.models.review import FileReview, FileReviewStatus, ReviewSession, ReviewStatus
```

**Step 4: Run test**

Run: `cd apps/backend && uv run pytest tests/test_models_review.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/app/models/ apps/backend/tests/test_models_review.py
git commit -m "feat(backend): add ReviewSession and FileReview models"
```

---

### Task 2: Git diff service

**Files:**
- Create: `apps/backend/app/services/git_diff.py`
- Test: `apps/backend/tests/test_git_diff_service.py`

**Step 1: Write the failing test**

Create `apps/backend/tests/test_git_diff_service.py`:

```python
import os
import tempfile

import pytest

from app.services.git_diff import GitDiffService


@pytest.fixture
def git_repo_with_changes():
    with tempfile.TemporaryDirectory() as tmpdir:
        os.system(f"cd {tmpdir} && git init && git checkout -b main")
        # Create initial file
        with open(os.path.join(tmpdir, "hello.py"), "w") as f:
            f.write("print('hello')\n")
        os.system(f"cd {tmpdir} && git add . && git commit -m 'init'")
        # Create branch with changes
        os.system(f"cd {tmpdir} && git checkout -b feature/test")
        with open(os.path.join(tmpdir, "hello.py"), "w") as f:
            f.write("print('hello world')\n")
        with open(os.path.join(tmpdir, "new_file.py"), "w") as f:
            f.write("print('new')\n")
        os.system(f"cd {tmpdir} && git add . && git commit -m 'changes'")
        yield tmpdir


@pytest.mark.asyncio
async def test_get_changed_files(git_repo_with_changes):
    service = GitDiffService()
    files = await service.get_changed_files(
        repo_path=git_repo_with_changes,
        branch="feature/test",
        base_branch="main",
    )
    assert len(files) == 2
    paths = [f["path"] for f in files]
    assert "hello.py" in paths
    assert "new_file.py" in paths


@pytest.mark.asyncio
async def test_get_file_diff(git_repo_with_changes):
    service = GitDiffService()
    diff = await service.get_file_diff(
        repo_path=git_repo_with_changes,
        file_path="hello.py",
        branch="feature/test",
        base_branch="main",
    )
    assert "hello" in diff
    assert "+" in diff or "-" in diff
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend && uv run pytest tests/test_git_diff_service.py -v`
Expected: FAIL

**Step 3: Write the implementation**

Create `apps/backend/app/services/git_diff.py`:

```python
import asyncio


class GitDiffService:
    async def _run(self, cmd: list[str], cwd: str) -> tuple[int, str, str]:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            cwd=cwd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate()
        return proc.returncode, stdout.decode(), stderr.decode()

    async def get_changed_files(
        self,
        repo_path: str,
        branch: str,
        base_branch: str = "main",
    ) -> list[dict]:
        returncode, stdout, stderr = await self._run(
            ["git", "diff", "--name-status", f"{base_branch}...{branch}"],
            repo_path,
        )
        if returncode != 0:
            return []

        files = []
        for line in stdout.strip().split("\n"):
            if not line:
                continue
            parts = line.split("\t")
            status = parts[0]
            path = parts[1] if len(parts) > 1 else ""
            files.append({"status": status, "path": path})
        return files

    async def get_file_diff(
        self,
        repo_path: str,
        file_path: str,
        branch: str,
        base_branch: str = "main",
    ) -> str:
        returncode, stdout, stderr = await self._run(
            ["git", "diff", f"{base_branch}...{branch}", "--", file_path],
            repo_path,
        )
        return stdout
```

**Step 4: Run test**

Run: `cd apps/backend && uv run pytest tests/test_git_diff_service.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/app/services/git_diff.py apps/backend/tests/test_git_diff_service.py
git commit -m "feat(backend): add git diff service"
```

---

### Task 3: Review prompt builder service

**Files:**
- Create: `apps/backend/app/services/review_prompt.py`
- Test: `apps/backend/tests/test_review_prompt.py`

**Step 1: Write the failing test**

Create `apps/backend/tests/test_review_prompt.py`:

```python
from app.services.review_prompt import build_file_review_prompt, build_fix_prompt


def test_build_file_review_prompt():
    prompt = build_file_review_prompt(
        file_path="src/auth/login.ts",
        diff_content="- old line\n+ new line",
    )
    assert "src/auth/login.ts" in prompt
    assert "- old line" in prompt
    assert "review" in prompt.lower()


def test_build_fix_prompt():
    prompt = build_fix_prompt(
        file_path="src/auth/login.ts",
        ai_comment="Missing error handling for async jwt.sign",
    )
    assert "src/auth/login.ts" in prompt
    assert "Missing error handling" in prompt
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend && uv run pytest tests/test_review_prompt.py -v`
Expected: FAIL

**Step 3: Write the implementation**

Create `apps/backend/app/services/review_prompt.py`:

```python
def build_file_review_prompt(file_path: str, diff_content: str) -> str:
    return (
        f"Review the following file changes and provide detailed feedback.\n\n"
        f"File: {file_path}\n\n"
        f"```diff\n{diff_content}\n```\n\n"
        f"For each issue found, provide:\n"
        f"1. Line reference\n"
        f"2. Severity (critical, warning, suggestion)\n"
        f"3. Description of the issue\n"
        f"4. Suggested fix\n\n"
        f"Respond in JSON format:\n"
        f'{{"comments": [{{"line": number, "severity": string, "message": string, "suggestion": string}}]}}'
    )


def build_fix_prompt(file_path: str, ai_comment: str) -> str:
    return (
        f"Fix the following issue in {file_path}:\n\n"
        f"{ai_comment}\n\n"
        f"Read the file, understand the context, apply the fix, and verify it works."
    )


def build_question_prompt(file_path: str, diff_content: str, question: str, history: list[dict] | None = None) -> str:
    parts = [
        f"Context: reviewing changes in {file_path}\n",
        f"```diff\n{diff_content}\n```\n",
    ]
    if history:
        parts.append("Previous conversation:")
        for msg in history:
            parts.append(f"- {msg['role']}: {msg['content']}")
        parts.append("")
    parts.append(f"Question: {question}")
    return "\n".join(parts)
```

**Step 4: Run test**

Run: `cd apps/backend && uv run pytest tests/test_review_prompt.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/app/services/review_prompt.py apps/backend/tests/test_review_prompt.py
git commit -m "feat(backend): add review prompt builder service"
```

---

### Task 4: Review Pydantic schemas

**Files:**
- Create: `apps/backend/app/schemas/review.py`
- Test: `apps/backend/tests/test_schemas_review.py`

**Step 1: Write the failing test**

Create `apps/backend/tests/test_schemas_review.py`:

```python
import uuid

from app.schemas.review import FileReviewResponse, ReviewCreate, ReviewResponse


def test_review_create():
    data = ReviewCreate(branch="feature/auth")
    assert data.base_branch == "main"


def test_review_response():
    resp = ReviewResponse(
        id=uuid.uuid4(),
        project_id=uuid.uuid4(),
        branch="feature/auth",
        base_branch="main",
        status="in_progress",
        files=[],
    )
    assert len(resp.files) == 0


def test_file_review_response():
    fr = FileReviewResponse(
        id=uuid.uuid4(),
        file_path="src/login.ts",
        diff_content="+ new",
        user_status="pending",
    )
    assert fr.ai_comments is None
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend && uv run pytest tests/test_schemas_review.py -v`
Expected: FAIL

**Step 3: Write the schemas**

Create `apps/backend/app/schemas/review.py`:

```python
import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.review import FileReviewStatus, ReviewStatus


class ReviewCreate(BaseModel):
    branch: str
    base_branch: str = "main"


class FileReviewResponse(BaseModel):
    id: uuid.UUID
    file_path: str
    diff_content: str
    ai_comments: dict | None = None
    user_status: FileReviewStatus
    conversation: list | None = None

    model_config = {"from_attributes": True}


class ReviewResponse(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    session_id: uuid.UUID | None = None
    branch: str
    base_branch: str
    status: ReviewStatus
    files: list[FileReviewResponse] = []
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class FileReviewAction(BaseModel):
    action: FileReviewStatus  # approved or rejected


class FileReviewQuestion(BaseModel):
    question: str
```

**Step 4: Run test**

Run: `cd apps/backend && uv run pytest tests/test_schemas_review.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/app/schemas/review.py apps/backend/tests/test_schemas_review.py
git commit -m "feat(backend): add Review Pydantic schemas"
```

---

### Task 5: Review REST API router

**Files:**
- Create: `apps/backend/app/routers/reviews.py`
- Modify: `apps/backend/app/main.py`
- Test: `apps/backend/tests/test_router_reviews.py`

**Step 1: Write the failing test**

Create `apps/backend/tests/test_router_reviews.py`:

```python
from httpx import ASGITransport, AsyncClient

from app.main import app


async def test_list_reviews():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get(
            "/api/projects/00000000-0000-0000-0000-000000000001/reviews"
        )
    assert response.status_code == 200
    assert isinstance(response.json(), list)
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend && uv run pytest tests/test_router_reviews.py -v`
Expected: FAIL

**Step 3: Write the router**

Create `apps/backend/app/routers/reviews.py`:

```python
import uuid

from arq import ArqRedis
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.project import Project
from app.models.review import FileReview, FileReviewStatus, ReviewSession, ReviewStatus
from app.models.session import Session, SessionStatus, SessionType
from app.routers.sessions import get_arq_pool
from app.schemas.review import (
    FileReviewAction,
    FileReviewQuestion,
    ReviewCreate,
    ReviewResponse,
)
from app.services.git_diff import GitDiffService
from app.services.review_prompt import build_file_review_prompt, build_fix_prompt, build_question_prompt

router = APIRouter(prefix="/api/projects/{project_id}/reviews", tags=["reviews"])
git_diff_service = GitDiffService()


@router.get("", response_model=list[ReviewResponse])
async def list_reviews(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ReviewSession)
        .options(selectinload(ReviewSession.files))
        .where(ReviewSession.project_id == project_id)
        .order_by(ReviewSession.created_at.desc())
    )
    return result.scalars().all()


@router.post("", status_code=201, response_model=ReviewResponse)
async def create_review(
    project_id: uuid.UUID,
    body: ReviewCreate,
    db: AsyncSession = Depends(get_db),
    pool: ArqRedis = Depends(get_arq_pool),
):
    # Get project
    proj_result = await db.execute(select(Project).where(Project.id == project_id))
    project = proj_result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Get changed files
    changed_files = await git_diff_service.get_changed_files(
        repo_path=project.path,
        branch=body.branch,
        base_branch=body.base_branch,
    )
    if not changed_files:
        raise HTTPException(status_code=400, detail="No changes found")

    # Create review session
    session = Session(
        id=uuid.uuid4(),
        project_id=project_id,
        type=SessionType.CODE_REVIEW,
        status=SessionStatus.PENDING,
    )
    db.add(session)

    review = ReviewSession(
        id=uuid.uuid4(),
        project_id=project_id,
        session_id=session.id,
        branch=body.branch,
        base_branch=body.base_branch,
        status=ReviewStatus.IN_PROGRESS,
    )

    # Create FileReview for each changed file
    for cf in changed_files:
        diff = await git_diff_service.get_file_diff(
            repo_path=project.path,
            file_path=cf["path"],
            branch=body.branch,
            base_branch=body.base_branch,
        )
        file_review = FileReview(
            id=uuid.uuid4(),
            file_path=cf["path"],
            diff_content=diff,
            user_status=FileReviewStatus.PENDING,
        )
        review.files.append(file_review)

    db.add(review)
    await db.commit()
    await db.refresh(review, ["files"])

    # Enqueue AI review for each file
    for fr in review.files:
        prompt = build_file_review_prompt(fr.file_path, fr.diff_content)
        await pool.enqueue_job(
            "run_session_task",
            str(session.id),
            project.path,
            "code_review",
            prompt,
        )

    return review


@router.get("/{review_id}", response_model=ReviewResponse)
async def get_review(
    project_id: uuid.UUID,
    review_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ReviewSession)
        .options(selectinload(ReviewSession.files))
        .where(ReviewSession.id == review_id, ReviewSession.project_id == project_id)
    )
    review = result.scalar_one_or_none()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    return review


@router.patch("/{review_id}/files/{file_id}/status")
async def update_file_status(
    project_id: uuid.UUID,
    review_id: uuid.UUID,
    file_id: uuid.UUID,
    body: FileReviewAction,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(FileReview).where(
            FileReview.id == file_id,
            FileReview.review_id == review_id,
        )
    )
    fr = result.scalar_one_or_none()
    if not fr:
        raise HTTPException(status_code=404, detail="File review not found")
    fr.user_status = body.action
    await db.commit()
    return {"status": "updated"}


@router.post("/{review_id}/files/{file_id}/ask")
async def ask_about_file(
    project_id: uuid.UUID,
    review_id: uuid.UUID,
    file_id: uuid.UUID,
    body: FileReviewQuestion,
    db: AsyncSession = Depends(get_db),
    pool: ArqRedis = Depends(get_arq_pool),
):
    # Get file review
    result = await db.execute(
        select(FileReview).where(FileReview.id == file_id, FileReview.review_id == review_id)
    )
    fr = result.scalar_one_or_none()
    if not fr:
        raise HTTPException(status_code=404, detail="File review not found")

    # Get project
    proj_result = await db.execute(select(Project).where(Project.id == project_id))
    project = proj_result.scalar_one_or_none()

    # Build prompt with conversation history
    prompt = build_question_prompt(
        file_path=fr.file_path,
        diff_content=fr.diff_content,
        question=body.question,
        history=fr.conversation,
    )

    # Append to conversation
    conversation = fr.conversation or []
    conversation.append({"role": "user", "content": body.question})
    fr.conversation = conversation
    await db.commit()

    # Create session for the question
    session = Session(
        id=uuid.uuid4(),
        project_id=project_id,
        type=SessionType.CODE_REVIEW,
        status=SessionStatus.PENDING,
    )
    db.add(session)
    await db.commit()

    await pool.enqueue_job(
        "run_session_task",
        str(session.id),
        project.path,
        "code_review",
        prompt,
    )

    return {"session_id": str(session.id)}


@router.post("/{review_id}/files/{file_id}/fix", status_code=202)
async def fix_file(
    project_id: uuid.UUID,
    review_id: uuid.UUID,
    file_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    pool: ArqRedis = Depends(get_arq_pool),
):
    result = await db.execute(
        select(FileReview).where(FileReview.id == file_id, FileReview.review_id == review_id)
    )
    fr = result.scalar_one_or_none()
    if not fr:
        raise HTTPException(status_code=404, detail="File review not found")
    if not fr.ai_comments:
        raise HTTPException(status_code=400, detail="No AI comments to fix")

    proj_result = await db.execute(select(Project).where(Project.id == project_id))
    project = proj_result.scalar_one_or_none()

    # Build fix prompt from AI comments
    comments_text = "\n".join(
        f"- {c.get('message', '')}" for c in fr.ai_comments.get("comments", [])
    )
    prompt = build_fix_prompt(fr.file_path, comments_text)

    session = Session(
        id=uuid.uuid4(),
        project_id=project_id,
        type=SessionType.CODE_REVIEW,
        status=SessionStatus.PENDING,
    )
    db.add(session)
    await db.commit()

    await pool.enqueue_job(
        "run_session_task",
        str(session.id),
        project.path,
        "code_review",
        prompt,
    )

    return {"session_id": str(session.id), "message": "Fix session started"}
```

**Step 4: Register router in main.py**

Add to `apps/backend/app/main.py`:

```python
from app.routers.reviews import router as reviews_router

app.include_router(reviews_router)
```

**Step 5: Run tests**

Run: `cd apps/backend && uv run pytest tests/ -v`
Expected: ALL PASS

**Step 6: Commit**

```bash
git add apps/backend/app/routers/reviews.py apps/backend/app/main.py apps/backend/tests/test_router_reviews.py
git commit -m "feat(backend): add Review REST API with ask/fix endpoints"
```

---

### Task 6: Alembic migration for review tables

**Step 1: Generate migration**

Run: `cd apps/backend && uv run alembic revision --autogenerate -m "add review_sessions and file_reviews tables"`

**Step 2: Run migration**

Run: `cd apps/backend && uv run alembic upgrade head`

**Step 3: Commit**

```bash
git add apps/backend/alembic/versions/
git commit -m "feat(backend): add migration for review tables"
```
