# Feature 3: Git Worktree Management

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Manage git worktrees per project via REST API and UI. Users create/list/delete worktrees, then workflow steps run Claude Code sessions in isolated worktree directories.

**Architecture:** GitWorktreeService already wraps `git worktree` CLI. Need a REST router to expose worktree CRUD, and a frontend UI showing worktree list with branch info and status indicators — all using `@agent-coding/ui` primitives.

**Tech Stack:** FastAPI, SQLAlchemy async, asyncio.subprocess (git CLI), React 19, @agent-coding/ui

**Depends on:** Feature 0 (app shell, API client), UI Primitives plan (packages/ui built)

**Already built (backend):**
- git_worktree service (`apps/backend/app/services/git_worktree.py`) — create_worktree, cleanup_worktree, merge_branches
- Session model has `worktree_path` field
- WorkflowStep references worktree paths

**Already built (UI package — no need to create locally):**
- `SourceList` — tree list with expand/collapse
- `Panel` — compound component for layout sections
- `SplitPane` — for 2-panel layout
- `EmptyState`, `Spinner`, `StatusBadge`, `KVRow`
- shadcn: `Breadcrumb`, `Button`, `Input`, `Label`, `Sheet`, `Dialog`, `Badge`, `Card`, `ScrollArea`, `Separator`, `Tooltip`

**Remaining work:**
- Backend: Worktrees REST router (CRUD endpoints scoped to projects)
- Backend: Worktree Pydantic schemas
- Frontend: Worktree list, create/delete UI, status indicators

**Design ref:** `docs/design/pages/worktrees.md`

---

### Task 1: Worktree Pydantic schemas

**Files:**
- Create: `apps/backend/app/schemas/worktree.py`
- Test: `apps/backend/tests/test_worktree_schemas.py`

**Step 1: Write the failing test**

Create `apps/backend/tests/test_worktree_schemas.py`:

```python
from app.schemas.worktree import WorktreeCreate, WorktreeResponse


def test_worktree_create():
    data = WorktreeCreate(branch="feature/auth")
    assert data.branch == "feature/auth"


def test_worktree_response():
    resp = WorktreeResponse(
        branch="feature/auth",
        path="/tmp/wt/feature-auth",
        head="abc123",
    )
    assert resp.branch == "feature/auth"
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend && uv run pytest tests/test_worktree_schemas.py -v`
Expected: FAIL

**Step 3: Write the schemas**

Create `apps/backend/app/schemas/worktree.py`:

```python
from pydantic import BaseModel


class WorktreeCreate(BaseModel):
    branch: str
    base_branch: str = "main"


class WorktreeResponse(BaseModel):
    branch: str
    path: str
    head: str | None = None
    bare: bool = False
```

**Step 4: Run test**

Run: `cd apps/backend && uv run pytest tests/test_worktree_schemas.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/app/schemas/worktree.py apps/backend/tests/test_worktree_schemas.py
git commit -m "feat(backend): add Worktree Pydantic schemas"
```

---

### Task 2: Worktrees REST router

**Files:**
- Create: `apps/backend/app/routers/worktrees.py`
- Modify: `apps/backend/app/main.py`
- Test: `apps/backend/tests/test_worktrees_router.py`

**Step 1: Write the failing test**

Create `apps/backend/tests/test_worktrees_router.py`:

```python
import os
import tempfile
import uuid

import pytest

from tests.conftest import auth_headers, create_user


async def test_list_worktrees(client, db_session):
    user = await create_user(db_session)
    headers = auth_headers(user.id)

    # Create a project with a real git repo path
    with tempfile.TemporaryDirectory() as tmpdir:
        os.system(f"cd {tmpdir} && git init && git commit --allow-empty -m 'init'")

        # Create project pointing to the temp dir
        proj_resp = await client.post(
            "/projects",
            json={"name": "Test", "slug": "test", "path": tmpdir},
            headers=headers,
        )
        project_id = proj_resp.json()["id"]

        response = await client.get(
            f"/projects/{project_id}/worktrees",
            headers=headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1  # main worktree always present


async def test_create_and_delete_worktree(client, db_session):
    user = await create_user(db_session)
    headers = auth_headers(user.id)

    with tempfile.TemporaryDirectory() as tmpdir:
        os.system(f"cd {tmpdir} && git init && git commit --allow-empty -m 'init'")

        proj_resp = await client.post(
            "/projects",
            json={"name": "Test2", "slug": "test2", "path": tmpdir},
            headers=headers,
        )
        project_id = proj_resp.json()["id"]

        # Create worktree
        create_resp = await client.post(
            f"/projects/{project_id}/worktrees",
            json={"branch": "feature/test"},
            headers=headers,
        )
        assert create_resp.status_code == 201
        wt = create_resp.json()
        assert wt["branch"] == "feature/test"
        assert os.path.isdir(wt["path"])

        # Delete worktree
        del_resp = await client.delete(
            f"/projects/{project_id}/worktrees/{wt['branch']}",
            headers=headers,
        )
        assert del_resp.status_code == 204
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend && uv run pytest tests/test_worktrees_router.py -v`
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
from app.schemas.worktree import WorktreeCreate, WorktreeResponse
from app.services.auth import get_current_user
from app.services.git_worktree import create_worktree, cleanup_worktree
from app.services.project import require_project_member

router = APIRouter(
    prefix="/projects/{project_id}/worktrees",
    tags=["worktrees"],
)


@router.get("", response_model=list[WorktreeResponse])
async def list_worktrees(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
    _member=Depends(require_project_member),
):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # List worktrees via git CLI
    import asyncio

    proc = await asyncio.create_subprocess_exec(
        "git", "worktree", "list", "--porcelain",
        cwd=project.path,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, _ = await proc.communicate()

    worktrees = []
    current = {}
    for line in stdout.decode().strip().split("\n"):
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


@router.post("", status_code=201, response_model=WorktreeResponse)
async def create_worktree_endpoint(
    project_id: uuid.UUID,
    body: WorktreeCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
    _member=Depends(require_project_member),
):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    safe_branch = body.branch.replace("/", "-")
    wt_path = os.path.join(project.path, ".worktrees", safe_branch)

    try:
        await create_worktree(project.path, body.branch, wt_path)
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return WorktreeResponse(branch=body.branch, path=wt_path)


@router.delete("/{branch:path}", status_code=204)
async def delete_worktree_endpoint(
    project_id: uuid.UUID,
    branch: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
    _member=Depends(require_project_member),
):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    safe_branch = branch.replace("/", "-")
    wt_path = os.path.join(project.path, ".worktrees", safe_branch)

    try:
        await cleanup_worktree(project.path, wt_path)
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))
```

**Step 4: Register router in main.py**

Add to `apps/backend/app/main.py`:

```python
from app.routers.worktrees import router as worktrees_router
app.include_router(worktrees_router)
```

**Step 5: Run tests**

Run: `cd apps/backend && uv run pytest tests/test_worktrees_router.py -v`
Expected: PASS

**Step 6: Commit**

```bash
git add apps/backend/app/routers/worktrees.py apps/backend/app/main.py apps/backend/tests/test_worktrees_router.py
git commit -m "feat(backend): add Worktrees REST router"
```

---

### Task 3: Worktrees screen in frontend

**Files:**
- Create: `apps/desktop/src/renderer/hooks/use-worktrees.ts`
- Modify: `apps/desktop/src/renderer/screens/worktrees.tsx`

**UI imports from `@agent-coding/ui`:** `Breadcrumb`, `BreadcrumbItem`, `BreadcrumbLink`, `BreadcrumbList`, `BreadcrumbPage`, `BreadcrumbSeparator`, `SourceList`, `Panel`, `SplitPane`, `SplitPanePanel`, `SplitPaneHandle`, `Button`, `Input`, `Label`, `Sheet`, `SheetContent`, `SheetHeader`, `SheetTitle`, `SheetFooter`, `SheetTrigger`, `EmptyState`, `StatusBadge`, `KVRow`, `Spinner`, `Badge`, `Card`, `CardContent`, `ScrollArea`, `Separator`, `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`

**Step 1: Create useWorktrees hook**

```typescript
import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api-client'

interface Worktree {
  branch: string
  path: string
  head: string | null
  bare: boolean
}

export function useWorktrees(projectId: string) {
  const [worktrees, setWorktrees] = useState<Worktree[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      setWorktrees(await api.get<Worktree[]>(`/projects/${projectId}/worktrees`))
    } catch {
      setWorktrees([])
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => { fetch() }, [fetch])

  const create = async (branch: string) => {
    await api.post(`/projects/${projectId}/worktrees`, { branch })
    await fetch()
  }

  const remove = async (branch: string) => {
    await api.delete(`/projects/${projectId}/worktrees/${branch}`)
    await fetch()
  }

  return { worktrees, loading, refresh: fetch, create, remove }
}
```

**Step 2: Build the worktrees screen**

Replace placeholder with worktrees UI per `docs/design/pages/worktrees.md`:

```tsx
import { useState } from 'react'
import { GitBranch, Plus, Trash2 } from 'lucide-react'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  SourceList,
  Panel,
  SplitPane,
  SplitPanePanel,
  SplitPaneHandle,
  Button,
  Input,
  Label,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetTrigger,
  EmptyState,
  StatusBadge,
  KVRow,
  Spinner,
  Badge,
  Card,
  CardContent,
  ScrollArea,
  Separator,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  type SourceListItem,
} from '@agent-coding/ui'

import { useWorktrees } from '../hooks/use-worktrees'

export function WorktreesScreen() {
  const projectId = 'current-project-id' // TODO: get from route/context
  const { worktrees, loading, create, remove } = useWorktrees(projectId)
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null)
  const [newBranch, setNewBranch] = useState('')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const selectedWorktree = worktrees.find((w) => w.branch === selectedBranch)

  const sourceItems: SourceListItem[] = worktrees.map((wt) => ({
    id: wt.branch,
    label: wt.branch,
    icon: <GitBranch size={14} className="text-muted-foreground" />,
    badge: <StatusBadge status={wt.bare ? 'idle' : 'connected'} showDot />,
  }))

  async function handleCreate() {
    if (!newBranch.trim()) return
    await create(newBranch)
    setNewBranch('')
    setSheetOpen(false)
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner label="Loading worktrees..." />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Breadcrumb */}
      <div className="border-b border-border px-4 py-2">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="#">Projects</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Worktrees</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <SplitPane direction="horizontal" className="flex-1">
        {/* Worktree list */}
        <SplitPanePanel defaultSize={30} minSize={20}>
          <Panel>
            <Panel.Header>
              <Panel.Title>Worktrees</Panel.Title>
              <Panel.Actions>
                <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                  <SheetTrigger asChild>
                    <Button size="xs"><Plus size={14} /></Button>
                  </SheetTrigger>
                  <SheetContent>
                    <SheetHeader>
                      <SheetTitle>Create Worktree</SheetTitle>
                    </SheetHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="branch-name">Branch Name</Label>
                        <Input
                          id="branch-name"
                          placeholder="feature/my-feature"
                          value={newBranch}
                          onChange={(e) => setNewBranch(e.target.value)}
                        />
                      </div>
                    </div>
                    <SheetFooter>
                      <Button onClick={handleCreate}>Create</Button>
                    </SheetFooter>
                  </SheetContent>
                </Sheet>
              </Panel.Actions>
            </Panel.Header>
            <Panel.Content>
              <ScrollArea className="h-full">
                {worktrees.length === 0 ? (
                  <EmptyState
                    icon={GitBranch}
                    title="No worktrees"
                    description="Create a worktree to start working on a branch"
                    action={<Button size="sm" onClick={() => setSheetOpen(true)}>Create Worktree</Button>}
                  />
                ) : (
                  <SourceList
                    items={sourceItems}
                    selectedId={selectedBranch ?? undefined}
                    onSelect={setSelectedBranch}
                  />
                )}
              </ScrollArea>
            </Panel.Content>
          </Panel>
        </SplitPanePanel>

        <SplitPaneHandle />

        {/* Detail panel */}
        <SplitPanePanel defaultSize={70}>
          <Panel>
            {selectedWorktree ? (
              <>
                <Panel.Header>
                  <Panel.Title>
                    <Badge variant="outline">{selectedWorktree.branch}</Badge>
                  </Panel.Title>
                  <Panel.Actions>
                    <Button variant="destructive" size="xs" onClick={() => setDeleteDialogOpen(true)}>
                      <Trash2 size={14} /> Remove
                    </Button>
                  </Panel.Actions>
                </Panel.Header>
                <Panel.Content>
                  <Card className="m-4">
                    <CardContent className="pt-4">
                      <div className="space-y-1">
                        <KVRow label="Branch" value={selectedWorktree.branch} />
                        <Separator />
                        <KVRow label="Path" value={selectedWorktree.path} />
                        <Separator />
                        <KVRow label="HEAD" value={selectedWorktree.head ?? 'N/A'} />
                        <Separator />
                        <KVRow
                          label="Status"
                          value={<StatusBadge status={selectedWorktree.bare ? 'idle' : 'connected'}>{selectedWorktree.bare ? 'Bare' : 'Active'}</StatusBadge>}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </Panel.Content>
              </>
            ) : (
              <Panel.Content>
                <EmptyState
                  icon={GitBranch}
                  title="No worktree selected"
                  description="Select a worktree from the list to view details"
                />
              </Panel.Content>
            )}
          </Panel>
        </SplitPanePanel>
      </SplitPane>

      {/* Delete confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Worktree</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove the worktree for "{selectedWorktree?.branch}"?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => { if (selectedBranch) { remove(selectedBranch); setSelectedBranch(null); setDeleteDialogOpen(false) } }}>
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add apps/desktop/src/renderer/hooks/use-worktrees.ts apps/desktop/src/renderer/screens/worktrees.tsx
git commit -m "feat(desktop): build worktrees screen with @agent-coding/ui"
```
