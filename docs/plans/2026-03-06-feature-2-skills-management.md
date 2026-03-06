# Feature 2: Skills Management Per Project

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** CRUD for skills with per-project enable/disable. Skills are injected into Claude Code agent sessions as system prompt content. Build both the missing backend router and the frontend skills management UI.

**Architecture:** Skill model already exists. Need a standalone Skills CRUD router (separate from AgentSkill which links skills to agent configs). Frontend shows skill list with editor panel, toggle per project, and clone-from-template support — all using `@agent-coding/ui` primitives.

**Tech Stack:** FastAPI, SQLAlchemy async, React 19, @agent-coding/ui

**Depends on:** Feature 0 (app shell, API client), UI Primitives plan (packages/ui built)

**Already built (backend):**
- Skill model (`apps/backend/app/models/skill.py`) — name, description, content, category, is_template
- AgentSkill model (`apps/backend/app/models/agent_config.py`) — links skills to agent configs
- Skill schemas (`apps/backend/app/schemas/skill.py`) — SkillCreate, SkillUpdate, SkillResponse

**Already built (UI package — no need to create locally):**
- `SegmentedControl` — for filter tabs
- `DataTable` — for skill list with columns
- `Panel` — compound component for layout sections
- `SplitPane` — for 2-panel layout
- `EmptyState`, `Spinner`, `SearchField`, `StatusBadge`
- shadcn: `Switch`, `Button`, `Input`, `Label`, `Textarea`, `Badge`, `ScrollArea`, `Separator`, `Dialog`, `Tooltip`

**Remaining work:**
- Backend: Skills CRUD router (the agents router manages AgentConfig, not Skill entities directly)
- Frontend: Skills list, skill editor, project-level skill management

**Design ref:** `docs/design/pages/skills.md`

---

### Task 1: Skills CRUD router

**Files:**
- Create: `apps/backend/app/routers/skills.py`
- Modify: `apps/backend/app/main.py`
- Test: `apps/backend/tests/test_skills.py`

**Step 1: Write the failing test**

Create `apps/backend/tests/test_skills.py`:

```python
import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from tests.conftest import auth_headers, create_user


async def test_create_skill(client, db_session):
    user = await create_user(db_session)
    headers = auth_headers(user.id)

    response = await client.post(
        "/skills",
        json={
            "name": "TDD",
            "description": "Test-driven development",
            "content": "# TDD\n\nWrite tests first.",
            "category": "process",
            "is_template": True,
        },
        headers=headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "TDD"
    assert data["is_template"] is True


async def test_list_skills(client, db_session):
    user = await create_user(db_session)
    headers = auth_headers(user.id)

    response = await client.get("/skills", headers=headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)


async def test_clone_skill(client, db_session):
    user = await create_user(db_session)
    headers = auth_headers(user.id)

    # Create a template skill
    create_resp = await client.post(
        "/skills",
        json={
            "name": "Debug",
            "description": "Debugging process",
            "content": "# Debug\nReproduce first.",
            "category": "process",
            "is_template": True,
        },
        headers=headers,
    )
    skill_id = create_resp.json()["id"]

    # Clone it
    clone_resp = await client.post(f"/skills/{skill_id}/clone", headers=headers)
    assert clone_resp.status_code == 201
    data = clone_resp.json()
    assert data["name"] == "Debug (copy)"
    assert data["is_template"] is False
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend && uv run pytest tests/test_skills.py -v`
Expected: FAIL — no `/skills` route

**Step 3: Write the router**

Create `apps/backend/app/routers/skills.py`:

```python
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.skill import Skill
from app.schemas.skill import SkillCreate, SkillResponse, SkillUpdate
from app.services.auth import get_current_user

router = APIRouter(prefix="/skills", tags=["skills"])


@router.get("", response_model=list[SkillResponse])
async def list_skills(
    category: str | None = None,
    is_template: bool | None = None,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
    query = select(Skill).order_by(Skill.name)
    if category:
        query = query.where(Skill.category == category)
    if is_template is not None:
        query = query.where(Skill.is_template == is_template)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("", status_code=201, response_model=SkillResponse)
async def create_skill(
    body: SkillCreate,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
    skill = Skill(id=uuid.uuid4(), **body.model_dump())
    db.add(skill)
    await db.commit()
    await db.refresh(skill)
    return skill


@router.get("/{skill_id}", response_model=SkillResponse)
async def get_skill(
    skill_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
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
    _user=Depends(get_current_user),
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
async def delete_skill(
    skill_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
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
    _user=Depends(get_current_user),
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

**Step 4: Register in main.py**

Add to `apps/backend/app/main.py`:

```python
from app.routers.skills import router as skills_router
app.include_router(skills_router)
```

**Step 5: Run tests**

Run: `cd apps/backend && uv run pytest tests/test_skills.py -v`
Expected: PASS

**Step 6: Commit**

```bash
git add apps/backend/app/routers/skills.py apps/backend/app/main.py apps/backend/tests/test_skills.py
git commit -m "feat(backend): add Skills CRUD router with clone support"
```

---

### Task 2: Skills API hook in frontend

**Files:**
- Create: `apps/desktop/src/renderer/hooks/use-skills.ts`

**Step 1: Create useSkills hook**

```typescript
import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api-client'

interface Skill {
  id: string
  name: string
  description: string
  content: string
  category: string
  is_template: boolean
}

export function useSkills() {
  const [skills, setSkills] = useState<Skill[]>([])
  const [loading, setLoading] = useState(true)

  const fetchSkills = useCallback(async () => {
    setLoading(true)
    try {
      setSkills(await api.get<Skill[]>('/skills'))
    } catch {
      setSkills([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchSkills() }, [fetchSkills])

  const createSkill = async (data: Omit<Skill, 'id'>) => {
    const skill = await api.post<Skill>('/skills', data)
    setSkills((prev) => [...prev, skill])
    return skill
  }

  const updateSkill = async (id: string, data: Partial<Skill>) => {
    const skill = await api.patch<Skill>(`/skills/${id}`, data)
    setSkills((prev) => prev.map((s) => (s.id === id ? skill : s)))
    return skill
  }

  const deleteSkill = async (id: string) => {
    await api.delete(`/skills/${id}`)
    setSkills((prev) => prev.filter((s) => s.id !== id))
  }

  const cloneSkill = async (id: string) => {
    const skill = await api.post<Skill>(`/skills/${id}/clone`)
    setSkills((prev) => [...prev, skill])
    return skill
  }

  return { skills, loading, refresh: fetchSkills, createSkill, updateSkill, deleteSkill, cloneSkill }
}
```

**Step 2: Commit**

```bash
git add apps/desktop/src/renderer/hooks/use-skills.ts
git commit -m "feat(desktop): add useSkills hook"
```

---

### Task 3: Skills screen

**Files:**
- Modify: `apps/desktop/src/renderer/screens/skills.tsx`

**UI imports from `@agent-coding/ui`:** `SegmentedControl`, `DataTable`, `SplitPane`, `SplitPanePanel`, `SplitPaneHandle`, `Panel`, `SearchField`, `Switch`, `Button`, `Input`, `Label`, `Textarea`, `Badge`, `EmptyState`, `Spinner`, `ScrollArea`, `Separator`, `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`, `Tooltip`, `TooltipTrigger`, `TooltipContent`, `TooltipProvider`

**Step 1: Build the skills screen**

Replace the placeholder with a skills management screen per `docs/design/pages/skills.md`:

```tsx
import { useState } from 'react'
import { Copy, Plus, Save, Sparkles, Trash2 } from 'lucide-react'
import {
  SegmentedControl,
  DataTable,
  SplitPane,
  SplitPanePanel,
  SplitPaneHandle,
  Panel,
  SearchField,
  Switch,
  Button,
  Input,
  Label,
  Textarea,
  Badge,
  EmptyState,
  Spinner,
  ScrollArea,
  Separator,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  type Column,
} from '@agent-coding/ui'

import { useSkills } from '../hooks/use-skills'

type FilterTab = 'all' | 'enabled' | 'templates'

interface Skill {
  id: string
  name: string
  description: string
  content: string
  category: string
  is_template: boolean
}

export function SkillsScreen() {
  const { skills, loading, createSkill, updateSkill, deleteSkill, cloneSkill } = useSkills()
  const [filter, setFilter] = useState<FilterTab>('all')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  // Editing state
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editCategory, setEditCategory] = useState('')

  const selectedSkill = skills.find((s) => s.id === selectedId)

  function selectSkill(skill: Skill) {
    setSelectedId(skill.id)
    setEditName(skill.name)
    setEditDescription(skill.description)
    setEditContent(skill.content)
    setEditCategory(skill.category)
  }

  const filteredSkills = skills.filter((s) => {
    if (filter === 'templates' && !s.is_template) return false
    if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const columns: Column<Skill>[] = [
    { key: 'name', header: 'Name', render: (s) => <span className="font-medium">{s.name}</span> },
    { key: 'category', header: 'Category', width: '100px', render: (s) => <Badge variant="secondary">{s.category}</Badge> },
    { key: 'is_template', header: 'Type', width: '80px', render: (s) => s.is_template ? <Badge>Template</Badge> : null },
  ]

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner label="Loading skills..." />
      </div>
    )
  }

  return (
    <SplitPane direction="horizontal">
      {/* Skill list panel */}
      <SplitPanePanel defaultSize={40} minSize={25}>
        <Panel>
          <Panel.Header>
            <Panel.Title>Skills</Panel.Title>
            <Panel.Actions>
              <Button size="xs" onClick={() => createSkill({ name: 'New Skill', description: '', content: '', category: 'general', is_template: false })}>
                <Plus size={14} />
              </Button>
            </Panel.Actions>
          </Panel.Header>
          <div className="border-b border-border px-3 py-2 space-y-2">
            <SegmentedControl
              value={filter}
              onValueChange={(v) => setFilter(v as FilterTab)}
              items={[
                { value: 'all', label: 'All' },
                { value: 'enabled', label: 'Enabled' },
                { value: 'templates', label: 'Templates' },
              ]}
              size="sm"
            />
            <SearchField
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClear={() => setSearch('')}
              placeholder="Filter skills..."
            />
          </div>
          <Panel.Content>
            <DataTable
              columns={columns}
              data={filteredSkills}
              rowKey={(s) => s.id}
              selectedKey={selectedId ?? undefined}
              onRowClick={selectSkill}
              emptyState={
                <EmptyState
                  icon={Sparkles}
                  title="No skills found"
                  description="Create a new skill or adjust filters"
                  action={<Button size="sm" onClick={() => createSkill({ name: 'New Skill', description: '', content: '', category: 'general', is_template: false })}>Create Skill</Button>}
                />
              }
            />
          </Panel.Content>
        </Panel>
      </SplitPanePanel>

      <SplitPaneHandle />

      {/* Editor panel */}
      <SplitPanePanel defaultSize={60}>
        <Panel>
          {selectedSkill ? (
            <>
              <Panel.Header>
                <Panel.Title>{selectedSkill.name}</Panel.Title>
                <Panel.Actions>
                  {selectedSkill.is_template && (
                    <Button variant="outline" size="xs" onClick={() => cloneSkill(selectedSkill.id)}>
                      <Copy size={14} /> Clone
                    </Button>
                  )}
                  <Button size="xs" onClick={() => updateSkill(selectedSkill.id, { name: editName, description: editDescription, content: editContent, category: editCategory })}>
                    <Save size={14} /> Save
                  </Button>
                  <Button variant="destructive" size="xs" onClick={() => setDeleteDialogOpen(true)}>
                    <Trash2 size={14} />
                  </Button>
                </Panel.Actions>
              </Panel.Header>
              <Panel.Content>
                <ScrollArea className="h-full">
                  <div className="space-y-4 p-4">
                    <div className="space-y-2">
                      <Label htmlFor="skill-name">Name</Label>
                      <Input id="skill-name" value={editName} onChange={(e) => setEditName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="skill-desc">Description</Label>
                      <Input id="skill-desc" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="skill-category">Category</Label>
                      <Input id="skill-category" value={editCategory} onChange={(e) => setEditCategory(e.target.value)} />
                    </div>
                    <Separator />
                    <div className="space-y-2">
                      <Label htmlFor="skill-content">Content</Label>
                      <Textarea
                        id="skill-content"
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="min-h-[300px] font-mono text-[12px]"
                      />
                    </div>
                  </div>
                </ScrollArea>
              </Panel.Content>
            </>
          ) : (
            <Panel.Content>
              <EmptyState
                icon={Sparkles}
                title="No skill selected"
                description="Select a skill from the list to view and edit"
              />
            </Panel.Content>
          )}
        </Panel>
      </SplitPanePanel>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Skill</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedSkill?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => { if (selectedId) { deleteSkill(selectedId); setSelectedId(null); setDeleteDialogOpen(false) } }}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SplitPane>
  )
}
```

**Step 2: Verify the screen renders**

Run: `pnpm --filter my-electron-app dev`
Expected: Skills screen shows list + editor panel with @agent-coding/ui components

**Step 3: Commit**

```bash
git add apps/desktop/src/renderer/screens/skills.tsx
git commit -m "feat(desktop): build skills management screen with @agent-coding/ui"
```
