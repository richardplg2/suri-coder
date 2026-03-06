# Feature 2: Skills Management Per Project

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** CRUD for skills with per-project enable/disable and customization. Skills are injected into Claude Code sessions as system prompt content.

**Architecture:** Skill and ProjectSkill models in PostgreSQL. REST API for CRUD. Skills stored as markdown content in the database. Template skills can be cloned and customized per project. When a session starts, enabled skills for the project are loaded and injected into ClaudeAgentOptions.system_prompt.

**Tech Stack:** FastAPI, SQLAlchemy async, PostgreSQL, Pydantic

**Depends on:** Feature 1 (Project model, Session runner)

---

### Task 1: Skill and ProjectSkill models

**Files:**
- Create: `apps/backend/app/models/skill.py`
- Modify: `apps/backend/app/models/__init__.py`
- Test: `apps/backend/tests/test_models_skill.py`

**Step 1: Write the failing test**

Create `apps/backend/tests/test_models_skill.py`:

```python
import uuid

from app.models.skill import ProjectSkill, Skill


def test_skill_model_fields():
    skill = Skill(
        id=uuid.uuid4(),
        name="TDD",
        description="Test-driven development workflow",
        content="# TDD\n\nAlways write tests first.",
        category="process",
        is_template=True,
    )
    assert skill.name == "TDD"
    assert skill.is_template is True


def test_project_skill_model_fields():
    ps = ProjectSkill(
        project_id=uuid.uuid4(),
        skill_id=uuid.uuid4(),
        enabled=True,
        priority=1,
    )
    assert ps.enabled is True
    assert ps.custom_overrides is None
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend && uv run pytest tests/test_models_skill.py -v`
Expected: FAIL

**Step 3: Write the models**

Create `apps/backend/app/models/skill.py`:

```python
import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Skill(Base):
    __tablename__ = "skills"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    content: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False, default="general")
    is_template: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class ProjectSkill(Base):
    __tablename__ = "project_skills"
    __table_args__ = (UniqueConstraint("project_id", "skill_id"),)

    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id"), primary_key=True)
    skill_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("skills.id"), primary_key=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    custom_overrides: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    priority: Mapped[int] = mapped_column(Integer, default=0)
```

Update `apps/backend/app/models/__init__.py`:

```python
from app.models.project import Project
from app.models.session import Session, SessionMessage, SessionStatus, SessionType
from app.models.skill import ProjectSkill, Skill

__all__ = [
    "Project",
    "ProjectSkill",
    "Session",
    "SessionMessage",
    "SessionStatus",
    "SessionType",
    "Skill",
]
```

**Step 4: Run test**

Run: `cd apps/backend && uv run pytest tests/test_models_skill.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/app/models/ apps/backend/tests/test_models_skill.py
git commit -m "feat(backend): add Skill and ProjectSkill models"
```

---

### Task 2: Skill Pydantic schemas

**Files:**
- Create: `apps/backend/app/schemas/skill.py`
- Test: `apps/backend/tests/test_schemas_skill.py`

**Step 1: Write the failing test**

Create `apps/backend/tests/test_schemas_skill.py`:

```python
import uuid

from app.schemas.skill import ProjectSkillUpdate, SkillCreate, SkillResponse


def test_skill_create():
    data = SkillCreate(
        name="Debugging",
        description="Systematic debugging process",
        content="# Debugging\n\nReproduce first.",
        category="process",
    )
    assert data.name == "Debugging"
    assert data.category == "process"


def test_skill_response():
    resp = SkillResponse(
        id=uuid.uuid4(),
        name="TDD",
        description="TDD flow",
        content="# TDD",
        category="process",
        is_template=True,
    )
    assert resp.is_template is True


def test_project_skill_update():
    ps = ProjectSkillUpdate(enabled=True, priority=2)
    assert ps.custom_overrides is None
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend && uv run pytest tests/test_schemas_skill.py -v`
Expected: FAIL

**Step 3: Write the schemas**

Create `apps/backend/app/schemas/skill.py`:

```python
import uuid
from datetime import datetime

from pydantic import BaseModel


class SkillCreate(BaseModel):
    name: str
    description: str = ""
    content: str
    category: str = "general"
    is_template: bool = False


class SkillUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    content: str | None = None
    category: str | None = None


class SkillResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: str
    content: str
    category: str
    is_template: bool
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class ProjectSkillUpdate(BaseModel):
    enabled: bool = True
    custom_overrides: dict | None = None
    priority: int = 0


class ProjectSkillResponse(BaseModel):
    skill: SkillResponse
    enabled: bool
    custom_overrides: dict | None = None
    priority: int
```

**Step 4: Run test**

Run: `cd apps/backend && uv run pytest tests/test_schemas_skill.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/app/schemas/skill.py apps/backend/tests/test_schemas_skill.py
git commit -m "feat(backend): add Skill Pydantic schemas"
```

---

### Task 3: Skills CRUD router

**Files:**
- Create: `apps/backend/app/routers/skills.py`
- Modify: `apps/backend/app/main.py`
- Test: `apps/backend/tests/test_router_skills.py`

**Step 1: Write the failing test**

Create `apps/backend/tests/test_router_skills.py`:

```python
from unittest.mock import AsyncMock, patch

from httpx import ASGITransport, AsyncClient

from app.main import app


async def test_create_skill():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post("/api/skills", json={
            "name": "TDD",
            "description": "Test-driven development",
            "content": "# TDD\n\nWrite tests first.",
            "category": "process",
            "is_template": True,
        })
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "TDD"
    assert data["is_template"] is True


async def test_list_skills():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/api/skills")
    assert response.status_code == 200
    assert isinstance(response.json(), list)
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend && uv run pytest tests/test_router_skills.py -v`
Expected: FAIL

**Step 3: Write the router**

Create `apps/backend/app/routers/skills.py`:

```python
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.skill import ProjectSkill, Skill
from app.schemas.skill import (
    ProjectSkillResponse,
    ProjectSkillUpdate,
    SkillCreate,
    SkillResponse,
    SkillUpdate,
)

router = APIRouter(prefix="/api/skills", tags=["skills"])


@router.post("", status_code=201, response_model=SkillResponse)
async def create_skill(body: SkillCreate, db: AsyncSession = Depends(get_db)):
    skill = Skill(id=uuid.uuid4(), **body.model_dump())
    db.add(skill)
    await db.commit()
    await db.refresh(skill)
    return skill


@router.get("", response_model=list[SkillResponse])
async def list_skills(
    category: str | None = None,
    is_template: bool | None = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(Skill)
    if category:
        query = query.where(Skill.category == category)
    if is_template is not None:
        query = query.where(Skill.is_template == is_template)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{skill_id}", response_model=SkillResponse)
async def get_skill(skill_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Skill).where(Skill.id == skill_id))
    skill = result.scalar_one_or_none()
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")
    return skill


@router.patch("/{skill_id}", response_model=SkillResponse)
async def update_skill(
    skill_id: uuid.UUID,
    body: SkillUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Skill).where(Skill.id == skill_id))
    skill = result.scalar_one_or_none()
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(skill, key, value)
    await db.commit()
    await db.refresh(skill)
    return skill


@router.delete("/{skill_id}", status_code=204)
async def delete_skill(skill_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Skill).where(Skill.id == skill_id))
    skill = result.scalar_one_or_none()
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")
    await db.delete(skill)
    await db.commit()


@router.post("/{skill_id}/clone", status_code=201, response_model=SkillResponse)
async def clone_skill(
    skill_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Skill).where(Skill.id == skill_id))
    source = result.scalar_one_or_none()
    if not source:
        raise HTTPException(status_code=404, detail="Skill not found")
    clone = Skill(
        id=uuid.uuid4(),
        name=f"{source.name} (copy)",
        description=source.description,
        content=source.content,
        category=source.category,
        is_template=False,
    )
    db.add(clone)
    await db.commit()
    await db.refresh(clone)
    return clone
```

**Step 4: Register router in main.py**

Add to `apps/backend/app/main.py`:

```python
from app.routers.skills import router as skills_router

app.include_router(skills_router)
```

**Step 5: Run tests**

Run: `cd apps/backend && uv run pytest tests/ -v`
Expected: ALL PASS

**Step 6: Commit**

```bash
git add apps/backend/app/routers/skills.py apps/backend/app/main.py apps/backend/tests/test_router_skills.py
git commit -m "feat(backend): add Skills CRUD router with clone support"
```

---

### Task 4: Project-Skill assignment router

**Files:**
- Create: `apps/backend/app/routers/project_skills.py`
- Modify: `apps/backend/app/main.py`
- Test: `apps/backend/tests/test_router_project_skills.py`

**Step 1: Write the failing test**

Create `apps/backend/tests/test_router_project_skills.py`:

```python
from httpx import ASGITransport, AsyncClient

from app.main import app


async def test_list_project_skills():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get(
            "/api/projects/00000000-0000-0000-0000-000000000001/skills"
        )
    assert response.status_code == 200
    assert isinstance(response.json(), list)
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend && uv run pytest tests/test_router_project_skills.py -v`
Expected: FAIL

**Step 3: Write the router**

Create `apps/backend/app/routers/project_skills.py`:

```python
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.database import get_db
from app.models.skill import ProjectSkill, Skill
from app.schemas.skill import ProjectSkillResponse, ProjectSkillUpdate

router = APIRouter(prefix="/api/projects/{project_id}/skills", tags=["project-skills"])


@router.get("", response_model=list[ProjectSkillResponse])
async def list_project_skills(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ProjectSkill, Skill)
        .join(Skill, ProjectSkill.skill_id == Skill.id)
        .where(ProjectSkill.project_id == project_id)
        .order_by(ProjectSkill.priority)
    )
    rows = result.all()
    return [
        ProjectSkillResponse(
            skill=ps_skill,
            enabled=ps.enabled,
            custom_overrides=ps.custom_overrides,
            priority=ps.priority,
        )
        for ps, ps_skill in rows
    ]


@router.put("/{skill_id}", response_model=ProjectSkillResponse)
async def assign_skill(
    project_id: uuid.UUID,
    skill_id: uuid.UUID,
    body: ProjectSkillUpdate,
    db: AsyncSession = Depends(get_db),
):
    # Check skill exists
    skill_result = await db.execute(select(Skill).where(Skill.id == skill_id))
    skill = skill_result.scalar_one_or_none()
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")

    # Upsert project-skill
    result = await db.execute(
        select(ProjectSkill).where(
            ProjectSkill.project_id == project_id,
            ProjectSkill.skill_id == skill_id,
        )
    )
    ps = result.scalar_one_or_none()

    if ps:
        ps.enabled = body.enabled
        ps.custom_overrides = body.custom_overrides
        ps.priority = body.priority
    else:
        ps = ProjectSkill(
            project_id=project_id,
            skill_id=skill_id,
            enabled=body.enabled,
            custom_overrides=body.custom_overrides,
            priority=body.priority,
        )
        db.add(ps)

    await db.commit()
    return ProjectSkillResponse(
        skill=skill,
        enabled=ps.enabled,
        custom_overrides=ps.custom_overrides,
        priority=ps.priority,
    )


@router.delete("/{skill_id}", status_code=204)
async def unassign_skill(
    project_id: uuid.UUID,
    skill_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ProjectSkill).where(
            ProjectSkill.project_id == project_id,
            ProjectSkill.skill_id == skill_id,
        )
    )
    ps = result.scalar_one_or_none()
    if not ps:
        raise HTTPException(status_code=404, detail="Skill not assigned")
    await db.delete(ps)
    await db.commit()
```

**Step 4: Register router and run tests**

Add to `apps/backend/app/main.py`:

```python
from app.routers.project_skills import router as project_skills_router

app.include_router(project_skills_router)
```

Run: `cd apps/backend && uv run pytest tests/ -v`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add apps/backend/app/routers/project_skills.py apps/backend/app/main.py apps/backend/tests/test_router_project_skills.py
git commit -m "feat(backend): add project-skill assignment router"
```

---

### Task 5: Skills loader service for session injection

**Files:**
- Create: `apps/backend/app/services/skills_loader.py`
- Modify: `apps/backend/app/services/session_runner.py`
- Test: `apps/backend/tests/test_skills_loader.py`

**Step 1: Write the failing test**

Create `apps/backend/tests/test_skills_loader.py`:

```python
from app.services.skills_loader import build_skills_prompt


def test_build_skills_prompt_empty():
    result = build_skills_prompt([])
    assert result is None


def test_build_skills_prompt_single():
    skills = [{"name": "TDD", "content": "# TDD\nWrite tests first.", "custom_overrides": None}]
    result = build_skills_prompt(skills)
    assert "# TDD" in result
    assert "Write tests first." in result


def test_build_skills_prompt_multiple():
    skills = [
        {"name": "TDD", "content": "# TDD\nTests first.", "custom_overrides": None},
        {"name": "Debug", "content": "# Debug\nReproduce first.", "custom_overrides": None},
    ]
    result = build_skills_prompt(skills)
    assert "# TDD" in result
    assert "# Debug" in result


def test_build_skills_prompt_with_override():
    skills = [
        {
            "name": "TDD",
            "content": "# TDD\nDefault content.",
            "custom_overrides": {"content": "# TDD\nCustom override content."},
        },
    ]
    result = build_skills_prompt(skills)
    assert "Custom override content." in result
    assert "Default content." not in result
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend && uv run pytest tests/test_skills_loader.py -v`
Expected: FAIL

**Step 3: Write the implementation**

Create `apps/backend/app/services/skills_loader.py`:

```python
def build_skills_prompt(skills: list[dict]) -> str | None:
    if not skills:
        return None

    parts = []
    for skill in skills:
        overrides = skill.get("custom_overrides") or {}
        content = overrides.get("content", skill["content"])
        parts.append(content)

    return "\n\n---\n\n".join(parts)
```

**Step 4: Run test**

Run: `cd apps/backend && uv run pytest tests/test_skills_loader.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/app/services/skills_loader.py apps/backend/tests/test_skills_loader.py
git commit -m "feat(backend): add skills loader for session prompt injection"
```

---

### Task 6: Alembic migration for skill tables

**Step 1: Generate migration**

Run: `cd apps/backend && uv run alembic revision --autogenerate -m "add skill and project_skill tables"`

**Step 2: Review the generated migration**

Check: `apps/backend/alembic/versions/` — verify it creates `skills` and `project_skills` tables.

**Step 3: Run migration**

Run: `cd apps/backend && uv run alembic upgrade head`

**Step 4: Commit**

```bash
git add apps/backend/alembic/versions/
git commit -m "feat(backend): add migration for skill and project_skill tables"
```
