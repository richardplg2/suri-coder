# Projects & Multi-Context UX Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement tab-based multi-context navigation, projects dashboard, project CRUD, ticket board views, and ticket detail screen.

**Architecture:** Zustand tab store drives navigation. A single `AppLayout` component renders TabBar + context-adaptive Sidebar + content area. Each tab type (home/project/ticket) renders its own screen. Existing `@agent-coding/ui` components (TabBar, Card, DataTable, SourceList, Panel, SplitPane, Dialog) are reused heavily.

**Tech Stack:** React 19, Zustand 5, TanStack Query v5, Tailwind CSS v4, @agent-coding/ui, lucide-react, electron-router-dom

**Note:** No frontend test framework is configured. Tasks use manual verification (dev server visual check). Backend APIs already exist — this plan is frontend-only.

---

### Task 1: Tab Store

**Files:**
- Create: `apps/desktop/src/renderer/stores/use-tab-store.ts`
- Create: `apps/desktop/src/renderer/types/tabs.ts`

**Step 1: Create tab types**

```ts
// apps/desktop/src/renderer/types/tabs.ts

export type TabType = 'home' | 'project' | 'ticket'

export interface HomeTab {
  id: 'home'
  type: 'home'
  label: 'Home'
  pinned: true
}

export interface ProjectTab {
  id: string
  type: 'project'
  projectId: string
  label: string
  pinned: true
}

export interface TicketTab {
  id: string
  type: 'ticket'
  ticketId: string
  projectId: string
  label: string
  pinned: false
}

export type AppTab = HomeTab | ProjectTab | TicketTab
```

**Step 2: Create tab store**

```ts
// apps/desktop/src/renderer/stores/use-tab-store.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AppTab } from 'renderer/types/tabs'

interface TabStore {
  tabs: AppTab[]
  activeTabId: string
  openProjectTab: (projectId: string, label: string) => void
  openTicketTab: (ticketId: string, projectId: string, label: string) => void
  closeTab: (id: string) => void
  setActiveTab: (id: string) => void
  updateTabLabel: (id: string, label: string) => void
}

const HOME_TAB: AppTab = { id: 'home', type: 'home', label: 'Home', pinned: true }

export const useTabStore = create<TabStore>()(
  persist(
    (set, get) => ({
      tabs: [HOME_TAB],
      activeTabId: 'home',

      openProjectTab: (projectId, label) => {
        const { tabs } = get()
        const tabId = `project-${projectId}`
        const existing = tabs.find((t) => t.id === tabId)
        if (existing) {
          set({ activeTabId: tabId })
          return
        }
        const newTab: AppTab = { id: tabId, type: 'project', projectId, label, pinned: true }
        // Insert pinned tabs after other pinned tabs, before regular tabs
        const lastPinnedIndex = tabs.findLastIndex((t) => t.pinned)
        const newTabs = [...tabs]
        newTabs.splice(lastPinnedIndex + 1, 0, newTab)
        set({ tabs: newTabs, activeTabId: tabId })
      },

      openTicketTab: (ticketId, projectId, label) => {
        const { tabs } = get()
        const tabId = `ticket-${ticketId}`
        const existing = tabs.find((t) => t.id === tabId)
        if (existing) {
          set({ activeTabId: tabId })
          return
        }
        const newTab: AppTab = { id: tabId, type: 'ticket', ticketId, projectId, label, pinned: false }
        set({ tabs: [...tabs, newTab], activeTabId: tabId })
      },

      closeTab: (id) => {
        if (id === 'home') return
        const { tabs, activeTabId } = get()
        const index = tabs.findIndex((t) => t.id === id)
        const newTabs = tabs.filter((t) => t.id !== id)
        if (activeTabId === id) {
          const nextIndex = Math.min(index, newTabs.length - 1)
          set({ tabs: newTabs, activeTabId: newTabs[nextIndex].id })
        } else {
          set({ tabs: newTabs })
        }
      },

      setActiveTab: (id) => set({ activeTabId: id }),

      updateTabLabel: (id, label) => {
        set({ tabs: get().tabs.map((t) => (t.id === id ? { ...t, label } : t)) })
      },
    }),
    { name: 'tab-store' },
  ),
)
```

**Step 3: Verify**

Run: `pnpm --filter my-electron-app typecheck`
Expected: no type errors

**Step 4: Commit**

```bash
git add apps/desktop/src/renderer/types/tabs.ts apps/desktop/src/renderer/stores/use-tab-store.ts
git commit -m "feat: add tab store for multi-context navigation"
```

---

### Task 2: App Layout Shell

**Files:**
- Create: `apps/desktop/src/renderer/components/app-layout.tsx`
- Modify: `apps/desktop/src/renderer/routes.tsx`
- Modify: `apps/desktop/src/renderer/screens/main.tsx` → rename to `home.tsx`

**Step 1: Create AppLayout component**

This is the top-level layout that renders: Toolbar with TabBar + Sidebar + Content area.

```tsx
// apps/desktop/src/renderer/components/app-layout.tsx
import { Home, Folder, X } from 'lucide-react'
import { TabBar } from '@agent-coding/ui'
import type { Tab } from '@agent-coding/ui'
import { cn } from '@agent-coding/ui'
import { useTabStore } from 'renderer/stores/use-tab-store'
import type { AppTab } from 'renderer/types/tabs'
import { AppSidebar } from './app-sidebar'

function tabToBarTab(tab: AppTab): Tab {
  switch (tab.type) {
    case 'home':
      return { id: tab.id, label: '', icon: <Home className="size-4" />, closable: false }
    case 'project':
      return { id: tab.id, label: '', icon: <Folder className="size-4" />, closable: true }
    case 'ticket':
      return { id: tab.id, label: tab.label, closable: true }
  }
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { tabs, activeTabId, setActiveTab, closeTab } = useTabStore()

  const barTabs = tabs.map(tabToBarTab)

  return (
    <div className="flex h-screen flex-col">
      {/* Toolbar + TabBar */}
      <div className="flex h-9 shrink-0 items-center border-b border-border bg-card app-drag">
        {/* Traffic light spacer (macOS) */}
        <div className="w-[78px] shrink-0" />
        <div className="flex-1 app-no-drag">
          <TabBar
            tabs={barTabs}
            activeTab={activeTabId}
            onTabChange={setActiveTab}
            onTabClose={closeTab}
          />
        </div>
      </div>

      {/* Main area: Sidebar + Content */}
      <div className="flex flex-1 overflow-hidden">
        <AppSidebar />
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  )
}
```

**Step 2: Create placeholder AppSidebar**

```tsx
// apps/desktop/src/renderer/components/app-sidebar.tsx
import { cn } from '@agent-coding/ui'
import { useSidebarStore } from 'renderer/stores/use-sidebar-store'

export function AppSidebar() {
  const { isOpen } = useSidebarStore()

  return (
    <aside
      className={cn(
        'shrink-0 border-r border-border bg-card/50 transition-[width] duration-200',
        isOpen ? 'w-60' : 'w-0 overflow-hidden'
      )}
    >
      <div className="p-3 text-xs text-muted-foreground">
        Sidebar placeholder
      </div>
    </aside>
  )
}
```

**Step 3: Create HomeScreen (rename from main.tsx)**

```tsx
// apps/desktop/src/renderer/screens/home.tsx
export function HomeScreen() {
  return (
    <div className="p-6">
      <h1 className="text-lg font-semibold">Projects</h1>
      <p className="text-sm text-muted-foreground">Projects dashboard coming next</p>
    </div>
  )
}
```

**Step 4: Create TabContent router component**

```tsx
// apps/desktop/src/renderer/components/tab-content.tsx
import { useTabStore } from 'renderer/stores/use-tab-store'
import { HomeScreen } from 'renderer/screens/home'

export function TabContent() {
  const { tabs, activeTabId } = useTabStore()
  const activeTab = tabs.find((t) => t.id === activeTabId)

  if (!activeTab) return null

  switch (activeTab.type) {
    case 'home':
      return <HomeScreen />
    case 'project':
      return <div className="p-6 text-muted-foreground">Project: {activeTab.projectId}</div>
    case 'ticket':
      return <div className="p-6 text-muted-foreground">Ticket: {activeTab.ticketId}</div>
  }
}
```

**Step 5: Update routes.tsx**

Replace the current routing with AppLayout + TabContent:

```tsx
// apps/desktop/src/renderer/routes.tsx
import { Route } from 'react-router-dom'
import { Router } from 'lib/electron-router-dom'
import { AppLayout } from './components/app-layout'
import { TabContent } from './components/tab-content'

function AppShell() {
  return (
    <AppLayout>
      <TabContent />
    </AppLayout>
  )
}

export function AppRoutes() {
  return <Router main={<Route element={<AppShell />} path="/" />} />
}
```

**Step 6: Delete old main.tsx**

Delete `apps/desktop/src/renderer/screens/main.tsx` (replaced by `home.tsx`).

**Step 7: Verify**

Run: `pnpm --filter my-electron-app typecheck`
Run: `pnpm --filter my-electron-app dev` → visually confirm: toolbar with Home tab + sidebar + empty content area

**Step 8: Commit**

```bash
git add -A apps/desktop/src/renderer/
git commit -m "feat: add app layout shell with tab bar and sidebar"
```

---

### Task 3: Context-Adaptive Sidebar

**Files:**
- Modify: `apps/desktop/src/renderer/components/app-sidebar.tsx`
- Create: `apps/desktop/src/renderer/components/sidebar/home-sidebar.tsx`
- Create: `apps/desktop/src/renderer/components/sidebar/project-sidebar.tsx`
- Create: `apps/desktop/src/renderer/components/sidebar/ticket-sidebar.tsx`

**Step 1: Create HomeSidebar**

```tsx
// apps/desktop/src/renderer/components/sidebar/home-sidebar.tsx
import { Folder } from 'lucide-react'
import { ScrollArea, SearchField, SourceList } from '@agent-coding/ui'
import type { SourceListItem } from '@agent-coding/ui'
import { useProjects } from 'renderer/hooks/queries/use-projects'
import { useTabStore } from 'renderer/stores/use-tab-store'
import { useState } from 'react'

export function HomeSidebar() {
  const { data: projects } = useProjects()
  const { openProjectTab } = useTabStore()
  const [search, setSearch] = useState('')

  const filtered = (projects ?? []).filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  const items: SourceListItem[] = filtered.map((p) => ({
    id: p.id,
    label: p.name,
    icon: <Folder className="size-4 text-muted-foreground" />,
  }))

  return (
    <div className="flex h-full flex-col">
      <div className="p-2">
        <SearchField
          placeholder="Filter projects..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClear={() => setSearch('')}
        />
      </div>
      <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        All Projects
      </div>
      <ScrollArea className="flex-1">
        <SourceList
          items={items}
          onSelect={(id) => {
            const project = projects?.find((p) => p.id === id)
            if (project) openProjectTab(project.id, project.name)
          }}
        />
      </ScrollArea>
    </div>
  )
}
```

**Step 2: Create ProjectSidebar**

```tsx
// apps/desktop/src/renderer/components/sidebar/project-sidebar.tsx
import { LayoutGrid, Bot, Workflow, Settings } from 'lucide-react'
import { ScrollArea, SourceList, StatusBadge } from '@agent-coding/ui'
import type { SourceListItem } from '@agent-coding/ui'
import { useSidebarStore } from 'renderer/stores/use-sidebar-store'

const NAV_ITEMS: SourceListItem[] = [
  { id: 'tickets', label: 'Tickets', icon: <LayoutGrid className="size-4" /> },
  { id: 'agents', label: 'Agents', icon: <Bot className="size-4" /> },
  { id: 'templates', label: 'Templates', icon: <Workflow className="size-4" /> },
  { id: 'settings', label: 'Settings', icon: <Settings className="size-4" /> },
]

interface ProjectSidebarProps {
  projectName: string
}

export function ProjectSidebar({ projectName }: ProjectSidebarProps) {
  const { activeNav, setActiveNav } = useSidebarStore()

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-3 py-2">
        <div className="text-sm font-semibold truncate">{projectName}</div>
      </div>
      <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Manage
      </div>
      <SourceList
        items={NAV_ITEMS}
        selectedId={activeNav}
        onSelect={setActiveNav}
      />
      <div className="flex-1" />
    </div>
  )
}
```

**Step 3: Create TicketSidebar**

```tsx
// apps/desktop/src/renderer/components/sidebar/ticket-sidebar.tsx
import { ScrollArea, SourceList, StatusBadge } from '@agent-coding/ui'
import type { SourceListItem } from '@agent-coding/ui'
import { useTicket } from 'renderer/hooks/queries/use-tickets'
import type { StepStatus } from 'renderer/types/api'

function stepStatusVariant(status: StepStatus) {
  const map: Record<StepStatus, 'passed' | 'running' | 'failed' | 'pending' | 'idle'> = {
    completed: 'passed',
    running: 'running',
    failed: 'failed',
    ready: 'pending',
    pending: 'idle',
    skipped: 'idle',
  }
  return map[status]
}

interface TicketSidebarProps {
  ticketId: string
  projectId: string
}

export function TicketSidebar({ ticketId, projectId }: TicketSidebarProps) {
  const { data: ticket } = useTicket(projectId, ticketId)

  const stepItems: SourceListItem[] = (ticket?.steps ?? []).map((step) => ({
    id: step.id,
    label: step.name,
    badge: <StatusBadge variant={stepStatusVariant(step.status)} size="sm" />,
  }))

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-3 py-2">
        <div className="text-xs text-muted-foreground">{ticket?.key}</div>
        <div className="text-sm font-semibold truncate">{ticket?.title}</div>
      </div>
      <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Workflow
      </div>
      <ScrollArea className="flex-1">
        <SourceList items={stepItems} />
      </ScrollArea>
    </div>
  )
}
```

**Step 4: Update AppSidebar to be context-adaptive**

```tsx
// apps/desktop/src/renderer/components/app-sidebar.tsx
import { cn } from '@agent-coding/ui'
import { useSidebarStore } from 'renderer/stores/use-sidebar-store'
import { useTabStore } from 'renderer/stores/use-tab-store'
import { useProject } from 'renderer/hooks/queries/use-projects'
import { HomeSidebar } from './sidebar/home-sidebar'
import { ProjectSidebar } from './sidebar/project-sidebar'
import { TicketSidebar } from './sidebar/ticket-sidebar'

export function AppSidebar() {
  const { isOpen } = useSidebarStore()
  const { tabs, activeTabId } = useTabStore()
  const activeTab = tabs.find((t) => t.id === activeTabId)

  return (
    <aside
      className={cn(
        'shrink-0 border-r border-border bg-card/50 transition-[width] duration-200',
        isOpen ? 'w-60' : 'w-0 overflow-hidden'
      )}
    >
      {activeTab?.type === 'home' && <HomeSidebar />}
      {activeTab?.type === 'project' && (
        <ProjectSidebar projectName={activeTab.label} />
      )}
      {activeTab?.type === 'ticket' && (
        <TicketSidebar ticketId={activeTab.ticketId} projectId={activeTab.projectId} />
      )}
    </aside>
  )
}
```

**Step 5: Verify**

Run: `pnpm --filter my-electron-app typecheck`
Expected: no type errors

**Step 6: Commit**

```bash
git add apps/desktop/src/renderer/components/
git commit -m "feat: add context-adaptive sidebar (home, project, ticket)"
```

---

### Task 4: Home Screen — Projects Card Grid

**Files:**
- Modify: `apps/desktop/src/renderer/screens/home.tsx`
- Create: `apps/desktop/src/renderer/components/project-card.tsx`

**Step 1: Create ProjectCard component**

```tsx
// apps/desktop/src/renderer/components/project-card.tsx
import { Folder, MoreHorizontal } from 'lucide-react'
import {
  Card, CardHeader, CardTitle, CardContent, CardAction,
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  Button,
} from '@agent-coding/ui'
import type { Project } from 'renderer/types/api'

interface ProjectCardProps {
  project: Project
  onClick: () => void
  onSettings: () => void
  onDelete: () => void
}

export function ProjectCard({ project, onClick, onSettings, onDelete }: ProjectCardProps) {
  return (
    <Card
      className="cursor-pointer transition-colors hover:bg-secondary/50"
      onClick={onClick}
    >
      <CardHeader>
        <div className="flex items-center gap-2">
          <Folder className="size-4 text-primary" />
          <CardTitle className="text-sm">{project.name}</CardTitle>
        </div>
        <CardAction>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="size-7">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onSettings() }}>
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={(e) => { e.stopPropagation(); onDelete() }}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-1">
        <p className="text-xs text-muted-foreground truncate">{project.path}</p>
        <p className="text-xs text-muted-foreground">
          {project.member_count} member{project.member_count !== 1 ? 's' : ''}
        </p>
      </CardContent>
    </Card>
  )
}
```

**Step 2: Build HomeScreen with card grid**

```tsx
// apps/desktop/src/renderer/screens/home.tsx
import { Plus } from 'lucide-react'
import { Button, EmptyState, Spinner } from '@agent-coding/ui'
import { useProjects } from 'renderer/hooks/queries/use-projects'
import { useTabStore } from 'renderer/stores/use-tab-store'
import { useModalStore } from 'renderer/stores/use-modal-store'
import { ProjectCard } from 'renderer/components/project-card'

export function HomeScreen() {
  const { data: projects, isLoading } = useProjects()
  const { openProjectTab } = useTabStore()
  const { open } = useModalStore()

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner label="Loading projects..." />
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Projects</h1>
        <Button size="sm" onClick={() => open('create-project')}>
          <Plus className="mr-1.5 size-4" />
          New Project
        </Button>
      </div>

      {(!projects || projects.length === 0) ? (
        <EmptyState
          title="No projects yet"
          description="Create your first project to get started."
          action={
            <Button size="sm" onClick={() => open('create-project')}>
              <Plus className="mr-1.5 size-4" />
              New Project
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onClick={() => openProjectTab(project.id, project.name)}
              onSettings={() => {
                openProjectTab(project.id, project.name)
                // TODO: navigate to settings nav
              }}
              onDelete={() => open('delete-project', { projectId: project.id, projectName: project.name })}
            />
          ))}
        </div>
      )}
    </div>
  )
}
```

**Step 3: Verify**

Run: `pnpm --filter my-electron-app typecheck`
Run: `pnpm --filter my-electron-app dev` → Home tab shows project card grid (or empty state)

**Step 4: Commit**

```bash
git add apps/desktop/src/renderer/screens/home.tsx apps/desktop/src/renderer/components/project-card.tsx
git commit -m "feat: add home screen with projects card grid"
```

---

### Task 5: Project Create Modal

**Files:**
- Create: `apps/desktop/src/renderer/components/modals/create-project-modal.tsx`
- Create: `apps/desktop/src/renderer/components/modals/index.tsx`
- Modify: `apps/desktop/src/renderer/routes.tsx` (mount modal provider)

**Step 1: Create CreateProjectModal**

```tsx
// apps/desktop/src/renderer/components/modals/create-project-modal.tsx
import { useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  Button, Input, Label, Textarea,
} from '@agent-coding/ui'
import { useModalStore } from 'renderer/stores/use-modal-store'
import { useCreateProject } from 'renderer/hooks/queries/use-projects'
import { useTabStore } from 'renderer/stores/use-tab-store'

function slugify(name: string): string {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 10)
}

export function CreateProjectModal() {
  const { activeModal, close } = useModalStore()
  const createProject = useCreateProject()
  const { openProjectTab } = useTabStore()

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [path, setPath] = useState('')
  const [repoUrl, setRepoUrl] = useState('')
  const [description, setDescription] = useState('')
  const [slugManual, setSlugManual] = useState(false)

  const isOpen = activeModal === 'create-project'

  function reset() {
    setName('')
    setSlug('')
    setPath('')
    setRepoUrl('')
    setDescription('')
    setSlugManual(false)
  }

  function handleNameChange(value: string) {
    setName(value)
    if (!slugManual) setSlug(slugify(value))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !slug.trim() || !path.trim()) return

    const project = await createProject.mutateAsync({
      name: name.trim(),
      slug: slug.trim(),
      path: path.trim(),
      repo_url: repoUrl.trim() || undefined,
      description: description.trim() || undefined,
    })
    close()
    reset()
    openProjectTab(project.id, project.name)
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) { close(); reset() } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="project-name">Name</Label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="My Project"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-slug">Slug (ticket prefix)</Label>
            <Input
              id="project-slug"
              value={slug}
              onChange={(e) => { setSlug(e.target.value.toUpperCase()); setSlugManual(true) }}
              placeholder="PROJ"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-path">Path</Label>
            <Input
              id="project-path"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="/home/user/projects/my-project"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-repo">Repo URL (optional)</Label>
            <Input
              id="project-repo"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-desc">Description (optional)</Label>
            <Textarea
              id="project-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { close(); reset() }}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || !slug.trim() || !path.trim() || createProject.isPending}>
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

**Step 2: Create modal index (modal provider)**

```tsx
// apps/desktop/src/renderer/components/modals/index.tsx
import { CreateProjectModal } from './create-project-modal'

export function ModalProvider() {
  return (
    <>
      <CreateProjectModal />
    </>
  )
}
```

**Step 3: Mount ModalProvider in routes.tsx**

Update `AppShell` in `routes.tsx` to include `<ModalProvider />`:

```tsx
// Add import
import { ModalProvider } from './components/modals'

function AppShell() {
  return (
    <AppLayout>
      <TabContent />
      <ModalProvider />
    </AppLayout>
  )
}
```

**Step 4: Verify**

Run: `pnpm --filter my-electron-app typecheck`
Run: `pnpm --filter my-electron-app dev` → click "New Project" → modal opens, fill form, submit → project created, tab opens

**Step 5: Commit**

```bash
git add apps/desktop/src/renderer/components/modals/ apps/desktop/src/renderer/routes.tsx
git commit -m "feat: add create project modal"
```

---

### Task 6: Delete Project Confirmation Modal

**Files:**
- Create: `apps/desktop/src/renderer/components/modals/delete-project-modal.tsx`
- Modify: `apps/desktop/src/renderer/components/modals/index.tsx`

**Step 1: Create DeleteProjectModal**

```tsx
// apps/desktop/src/renderer/components/modals/delete-project-modal.tsx
import { useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
  Button, Input, Label,
} from '@agent-coding/ui'
import { useModalStore } from 'renderer/stores/use-modal-store'
import { useDeleteProject } from 'renderer/hooks/queries/use-projects'
import { useTabStore } from 'renderer/stores/use-tab-store'

export function DeleteProjectModal() {
  const { activeModal, modalData, close } = useModalStore()
  const deleteProject = useDeleteProject()
  const { closeTab } = useTabStore()

  const [confirm, setConfirm] = useState('')

  const isOpen = activeModal === 'delete-project'
  const projectId = modalData?.projectId as string | undefined
  const projectName = modalData?.projectName as string | undefined

  async function handleDelete() {
    if (!projectId || confirm !== projectName) return
    await deleteProject.mutateAsync(projectId)
    closeTab(`project-${projectId}`)
    close()
    setConfirm('')
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) { close(); setConfirm('') } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete Project</DialogTitle>
          <DialogDescription>
            This action cannot be undone. Type <span className="font-semibold">{projectName}</span> to confirm.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="confirm-name">Project name</Label>
          <Input
            id="confirm-name"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={projectName}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { close(); setConfirm('') }}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={confirm !== projectName || deleteProject.isPending}
            onClick={handleDelete}
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

**Step 2: Add to ModalProvider**

```tsx
// apps/desktop/src/renderer/components/modals/index.tsx
import { CreateProjectModal } from './create-project-modal'
import { DeleteProjectModal } from './delete-project-modal'

export function ModalProvider() {
  return (
    <>
      <CreateProjectModal />
      <DeleteProjectModal />
    </>
  )
}
```

**Step 3: Verify**

Run: `pnpm --filter my-electron-app typecheck`

**Step 4: Commit**

```bash
git add apps/desktop/src/renderer/components/modals/
git commit -m "feat: add delete project confirmation modal"
```

---

### Task 7: Project Tab Screen

**Files:**
- Create: `apps/desktop/src/renderer/screens/project.tsx`
- Create: `apps/desktop/src/renderer/screens/project/tickets-board.tsx`
- Create: `apps/desktop/src/renderer/screens/project/project-settings.tsx`
- Modify: `apps/desktop/src/renderer/components/tab-content.tsx`

**Step 1: Create ProjectScreen container**

This is the main component for a project tab. It reads `activeNav` from sidebar store to decide which sub-view to show.

```tsx
// apps/desktop/src/renderer/screens/project.tsx
import { useSidebarStore } from 'renderer/stores/use-sidebar-store'
import { useProject } from 'renderer/hooks/queries/use-projects'
import { Spinner } from '@agent-coding/ui'
import { TicketsBoard } from './project/tickets-board'
import { ProjectSettings } from './project/project-settings'

interface ProjectScreenProps {
  projectId: string
}

export function ProjectScreen({ projectId }: ProjectScreenProps) {
  const { data: project, isLoading } = useProject(projectId)
  const { activeNav } = useSidebarStore()

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner label="Loading project..." />
      </div>
    )
  }

  if (!project) {
    return <div className="p-6 text-muted-foreground">Project not found</div>
  }

  switch (activeNav) {
    case 'settings':
      return <ProjectSettings project={project} />
    case 'agents':
      return <div className="p-6 text-muted-foreground">Agents config — coming soon</div>
    case 'templates':
      return <div className="p-6 text-muted-foreground">Templates editor — coming soon</div>
    default:
      return <TicketsBoard project={project} />
  }
}
```

**Step 2: Create TicketsBoard placeholder**

```tsx
// apps/desktop/src/renderer/screens/project/tickets-board.tsx
import { Plus, LayoutGrid, List } from 'lucide-react'
import { Button, SegmentedControl, EmptyState, Spinner } from '@agent-coding/ui'
import { useTickets } from 'renderer/hooks/queries/use-tickets'
import { useTabStore } from 'renderer/stores/use-tab-store'
import type { Project, TicketListItem } from 'renderer/types/api'
import { useState } from 'react'

type ViewMode = 'kanban' | 'list'

interface TicketsBoardProps {
  project: Project
}

export function TicketsBoard({ project }: TicketsBoardProps) {
  const { data: tickets, isLoading } = useTickets(project.id)
  const { openTicketTab } = useTabStore()
  const [viewMode, setViewMode] = useState<ViewMode>('kanban')

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner label="Loading tickets..." />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border px-4">
        <div className="text-sm font-medium">Tickets</div>
        <div className="flex items-center gap-2">
          <SegmentedControl
            value={viewMode}
            onValueChange={(v) => setViewMode(v as ViewMode)}
            options={[
              { value: 'kanban', label: <LayoutGrid className="size-3.5" /> },
              { value: 'list', label: <List className="size-3.5" /> },
            ]}
            size="sm"
          />
          <Button size="sm">
            <Plus className="mr-1.5 size-4" />
            New Ticket
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {(!tickets || tickets.length === 0) ? (
          <EmptyState
            title="No tickets yet"
            description="Create a ticket to start your workflow."
          />
        ) : viewMode === 'kanban' ? (
          <KanbanView
            tickets={tickets}
            onTicketClick={(t) => openTicketTab(t.id, project.id, `${t.key}: ${t.title}`)}
          />
        ) : (
          <ListView
            tickets={tickets}
            onTicketClick={(t) => openTicketTab(t.id, project.id, `${t.key}: ${t.title}`)}
          />
        )}
      </div>
    </div>
  )
}

// --- Kanban sub-component ---

const KANBAN_COLUMNS = [
  { status: 'backlog', label: 'Backlog' },
  { status: 'todo', label: 'Todo' },
  { status: 'in_progress', label: 'In Progress' },
  { status: 'in_review', label: 'In Review' },
  { status: 'done', label: 'Done' },
] as const

function KanbanView({
  tickets,
  onTicketClick,
}: {
  tickets: TicketListItem[]
  onTicketClick: (t: TicketListItem) => void
}) {
  return (
    <div className="flex gap-4 h-full">
      {KANBAN_COLUMNS.map((col) => {
        const colTickets = tickets.filter((t) => t.status === col.status)
        return (
          <div key={col.status} className="flex w-64 shrink-0 flex-col">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {col.label}
              </span>
              <span className="text-xs text-muted-foreground">{colTickets.length}</span>
            </div>
            <div className="flex-1 space-y-2 overflow-auto">
              {colTickets.map((ticket) => (
                <TicketCard key={ticket.id} ticket={ticket} onClick={() => onTicketClick(ticket)} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// --- Ticket card ---

import { Badge } from '@agent-coding/ui'
import type { TicketType, TicketPriority } from 'renderer/types/api'

const TYPE_COLORS: Record<TicketType, string> = {
  feature: 'bg-blue-500/15 text-blue-400',
  bug: 'bg-red-500/15 text-red-400',
  improvement: 'bg-green-500/15 text-green-400',
  chore: 'bg-zinc-500/15 text-zinc-400',
  spike: 'bg-purple-500/15 text-purple-400',
}

const PRIORITY_COLORS: Record<TicketPriority, string> = {
  urgent: 'text-red-400',
  high: 'text-orange-400',
  medium: 'text-yellow-400',
  low: 'text-blue-400',
  none: 'text-zinc-400',
}

function TicketCard({ ticket, onClick }: { ticket: TicketListItem; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full cursor-pointer rounded-lg border border-border bg-card p-3 text-left transition-colors hover:bg-secondary/50"
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{ticket.key}</span>
        <span className={`text-[10px] font-medium uppercase ${TYPE_COLORS[ticket.type]} rounded px-1.5 py-0.5`}>
          {ticket.type}
        </span>
      </div>
      <div className="mb-2 text-sm leading-snug line-clamp-2">{ticket.title}</div>
      <div className="flex items-center justify-between">
        <span className={`text-xs ${PRIORITY_COLORS[ticket.priority]}`}>
          {ticket.priority !== 'none' ? ticket.priority : ''}
        </span>
      </div>
    </button>
  )
}

// --- List sub-component ---

import { DataTable } from '@agent-coding/ui'
import type { Column } from '@agent-coding/ui'

function ListView({
  tickets,
  onTicketClick,
}: {
  tickets: TicketListItem[]
  onTicketClick: (t: TicketListItem) => void
}) {
  const columns: Column<TicketListItem>[] = [
    { key: 'key', header: 'Key', width: '100px' },
    { key: 'title', header: 'Title', render: (t) => <span className="truncate">{t.title}</span> },
    {
      key: 'type',
      header: 'Type',
      width: '100px',
      render: (t) => (
        <span className={`text-[10px] font-medium uppercase ${TYPE_COLORS[t.type]} rounded px-1.5 py-0.5`}>
          {t.type}
        </span>
      ),
    },
    { key: 'status', header: 'Status', width: '120px', render: (t) => t.status.replace('_', ' ') },
    {
      key: 'priority',
      header: 'Priority',
      width: '100px',
      render: (t) => (
        <span className={PRIORITY_COLORS[t.priority]}>{t.priority !== 'none' ? t.priority : '-'}</span>
      ),
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={tickets}
      rowKey={(t) => t.id}
      onRowClick={onTicketClick}
    />
  )
}
```

**Step 3: Create ProjectSettings**

```tsx
// apps/desktop/src/renderer/screens/project/project-settings.tsx
import { useState, useEffect } from 'react'
import { Button, Input, Label, Textarea, Separator } from '@agent-coding/ui'
import { useUpdateProject } from 'renderer/hooks/queries/use-projects'
import { useModalStore } from 'renderer/stores/use-modal-store'
import type { Project } from 'renderer/types/api'

interface ProjectSettingsProps {
  project: Project
}

export function ProjectSettings({ project }: ProjectSettingsProps) {
  const updateProject = useUpdateProject(project.id)
  const { open } = useModalStore()

  const [name, setName] = useState(project.name)
  const [path, setPath] = useState(project.path)
  const [repoUrl, setRepoUrl] = useState(project.repo_url ?? '')
  const [description, setDescription] = useState(project.description ?? '')

  useEffect(() => {
    setName(project.name)
    setPath(project.path)
    setRepoUrl(project.repo_url ?? '')
    setDescription(project.description ?? '')
  }, [project])

  const isDirty =
    name !== project.name ||
    path !== project.path ||
    repoUrl !== (project.repo_url ?? '') ||
    description !== (project.description ?? '')

  async function handleSave() {
    await updateProject.mutateAsync({
      name: name.trim(),
      path: path.trim(),
      repo_url: repoUrl.trim() || undefined,
      description: description.trim() || undefined,
    })
  }

  return (
    <div className="mx-auto max-w-lg p-6 space-y-6">
      <h2 className="text-lg font-semibold">Project Settings</h2>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Slug</Label>
          <Input value={project.slug} disabled className="opacity-60" />
          <p className="text-xs text-muted-foreground">Slug cannot be changed after creation.</p>
        </div>
        <div className="space-y-2">
          <Label>Path</Label>
          <Input value={path} onChange={(e) => setPath(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Repo URL</Label>
          <Input value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Description</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </div>

        <Button onClick={handleSave} disabled={!isDirty || updateProject.isPending}>
          Save Changes
        </Button>
      </div>

      <Separator />

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-destructive">Danger Zone</h3>
        <p className="text-xs text-muted-foreground">
          Deleting this project will remove all tickets, workflows, and sessions.
        </p>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => open('delete-project', { projectId: project.id, projectName: project.name })}
        >
          Delete Project
        </Button>
      </div>
    </div>
  )
}
```

**Step 4: Update TabContent**

```tsx
// apps/desktop/src/renderer/components/tab-content.tsx
import { useTabStore } from 'renderer/stores/use-tab-store'
import { HomeScreen } from 'renderer/screens/home'
import { ProjectScreen } from 'renderer/screens/project'

export function TabContent() {
  const { tabs, activeTabId } = useTabStore()
  const activeTab = tabs.find((t) => t.id === activeTabId)

  if (!activeTab) return null

  switch (activeTab.type) {
    case 'home':
      return <HomeScreen />
    case 'project':
      return <ProjectScreen projectId={activeTab.projectId} />
    case 'ticket':
      return <div className="p-6 text-muted-foreground">Ticket detail — Task 8</div>
  }
}
```

**Step 5: Verify**

Run: `pnpm --filter my-electron-app typecheck`
Run: `pnpm --filter my-electron-app dev` → open a project tab → see Kanban board or empty state, toggle to list view, open settings

**Step 6: Commit**

```bash
git add apps/desktop/src/renderer/screens/ apps/desktop/src/renderer/components/tab-content.tsx
git commit -m "feat: add project screen with tickets board and settings"
```

---

### Task 8: Ticket Detail Screen

**Files:**
- Create: `apps/desktop/src/renderer/screens/ticket.tsx`
- Create: `apps/desktop/src/renderer/components/workflow-dag.tsx`
- Create: `apps/desktop/src/renderer/components/step-inspector.tsx`
- Modify: `apps/desktop/src/renderer/components/tab-content.tsx`

**Step 1: Create WorkflowDAG component**

Simple node-based DAG visualization using CSS grid/flexbox (no external graph library needed for MVP).

```tsx
// apps/desktop/src/renderer/components/workflow-dag.tsx
import { cn } from '@agent-coding/ui'
import { StatusBadge } from '@agent-coding/ui'
import type { WorkflowStep, StepStatus } from 'renderer/types/api'

function stepStatusVariant(status: StepStatus) {
  const map: Record<StepStatus, 'passed' | 'running' | 'failed' | 'pending' | 'idle'> = {
    completed: 'passed',
    running: 'running',
    failed: 'failed',
    ready: 'pending',
    pending: 'idle',
    skipped: 'idle',
  }
  return map[status]
}

interface WorkflowDAGProps {
  steps: WorkflowStep[]
  selectedStepId?: string
  onSelectStep: (stepId: string) => void
}

export function WorkflowDAG({ steps, selectedStepId, onSelectStep }: WorkflowDAGProps) {
  const sorted = [...steps].sort((a, b) => a.order - b.order)

  return (
    <div className="flex flex-wrap gap-3 p-4">
      {sorted.map((step) => (
        <button
          key={step.id}
          type="button"
          onClick={() => onSelectStep(step.id)}
          className={cn(
            'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
            selectedStepId === step.id
              ? 'border-primary bg-primary/10'
              : 'border-border bg-card hover:bg-secondary/50',
            'cursor-pointer'
          )}
        >
          <StatusBadge variant={stepStatusVariant(step.status)} size="sm" />
          <span>{step.name}</span>
        </button>
      ))}
    </div>
  )
}
```

**Step 2: Create StepInspector component**

```tsx
// apps/desktop/src/renderer/components/step-inspector.tsx
import { Button, KVRow, Separator, StatusBadge } from '@agent-coding/ui'
import type { WorkflowStep, StepStatus } from 'renderer/types/api'

function stepStatusVariant(status: StepStatus) {
  const map: Record<StepStatus, 'passed' | 'running' | 'failed' | 'pending' | 'idle'> = {
    completed: 'passed',
    running: 'running',
    failed: 'failed',
    ready: 'pending',
    pending: 'idle',
    skipped: 'idle',
  }
  return map[status]
}

interface StepInspectorProps {
  step: WorkflowStep
}

export function StepInspector({ step }: StepInspectorProps) {
  return (
    <div className="space-y-4 p-4">
      <div>
        <h3 className="text-sm font-semibold">{step.name}</h3>
        {step.description && (
          <p className="mt-1 text-xs text-muted-foreground">{step.description}</p>
        )}
      </div>

      <div className="space-y-1">
        <KVRow label="Status">
          <StatusBadge variant={stepStatusVariant(step.status)} label={step.status} />
        </KVRow>
        <KVRow label="Order">{step.order}</KVRow>
        <KVRow label="Step ID">{step.template_step_id}</KVRow>
      </div>

      <Separator />

      <div className="flex gap-2">
        <Button size="sm" variant="outline" disabled={step.status !== 'ready'}>
          Run
        </Button>
        <Button size="sm" variant="outline" disabled={step.status === 'completed'}>
          Skip
        </Button>
        <Button size="sm" variant="outline" disabled={step.status !== 'failed'}>
          Retry
        </Button>
      </div>
    </div>
  )
}
```

**Step 3: Create TicketScreen**

```tsx
// apps/desktop/src/renderer/screens/ticket.tsx
import { useState } from 'react'
import { SplitPane, SplitPanePanel, SplitPaneHandle, Spinner, Badge, Separator } from '@agent-coding/ui'
import { useTicket } from 'renderer/hooks/queries/use-tickets'
import { WorkflowDAG } from 'renderer/components/workflow-dag'
import { StepInspector } from 'renderer/components/step-inspector'
import type { TicketPriority, TicketType } from 'renderer/types/api'

const TYPE_COLORS: Record<TicketType, string> = {
  feature: 'bg-blue-500/15 text-blue-400',
  bug: 'bg-red-500/15 text-red-400',
  improvement: 'bg-green-500/15 text-green-400',
  chore: 'bg-zinc-500/15 text-zinc-400',
  spike: 'bg-purple-500/15 text-purple-400',
}

interface TicketScreenProps {
  ticketId: string
  projectId: string
}

export function TicketScreen({ ticketId, projectId }: TicketScreenProps) {
  const { data: ticket, isLoading } = useTicket(projectId, ticketId)
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null)

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner label="Loading ticket..." />
      </div>
    )
  }

  if (!ticket) {
    return <div className="p-6 text-muted-foreground">Ticket not found</div>
  }

  const selectedStep = ticket.steps.find((s) => s.id === selectedStepId)
  const completedCount = ticket.steps.filter((s) => s.status === 'completed').length

  return (
    <SplitPane direction="horizontal" className="h-full">
      <SplitPanePanel defaultSize={65} minSize={40}>
        <div className="h-full overflow-auto">
          {/* Ticket header */}
          <div className="border-b border-border p-4">
            <div className="mb-1 flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{ticket.key}</span>
              <span className={`text-[10px] font-medium uppercase ${TYPE_COLORS[ticket.type]} rounded px-1.5 py-0.5`}>
                {ticket.type}
              </span>
              <span className="text-xs text-muted-foreground">
                {ticket.status.replace('_', ' ')}
              </span>
            </div>
            <h2 className="text-base font-semibold">{ticket.title}</h2>
            {ticket.description && (
              <p className="mt-2 text-sm text-muted-foreground">{ticket.description}</p>
            )}
            <div className="mt-3 text-xs text-muted-foreground">
              Workflow: {completedCount}/{ticket.steps.length} steps completed
            </div>
          </div>

          {/* DAG */}
          <div className="border-b border-border">
            <div className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Workflow
            </div>
            <WorkflowDAG
              steps={ticket.steps}
              selectedStepId={selectedStepId ?? undefined}
              onSelectStep={setSelectedStepId}
            />
          </div>
        </div>
      </SplitPanePanel>

      <SplitPaneHandle />

      <SplitPanePanel defaultSize={35} minSize={25}>
        {selectedStep ? (
          <StepInspector step={selectedStep} />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Select a step to inspect
          </div>
        )}
      </SplitPanePanel>
    </SplitPane>
  )
}
```

**Step 4: Update TabContent to render TicketScreen**

```tsx
// apps/desktop/src/renderer/components/tab-content.tsx
import { useTabStore } from 'renderer/stores/use-tab-store'
import { HomeScreen } from 'renderer/screens/home'
import { ProjectScreen } from 'renderer/screens/project'
import { TicketScreen } from 'renderer/screens/ticket'

export function TabContent() {
  const { tabs, activeTabId } = useTabStore()
  const activeTab = tabs.find((t) => t.id === activeTabId)

  if (!activeTab) return null

  switch (activeTab.type) {
    case 'home':
      return <HomeScreen />
    case 'project':
      return <ProjectScreen projectId={activeTab.projectId} />
    case 'ticket':
      return <TicketScreen ticketId={activeTab.ticketId} projectId={activeTab.projectId} />
  }
}
```

**Step 5: Verify**

Run: `pnpm --filter my-electron-app typecheck`
Run: `pnpm --filter my-electron-app dev` → open a ticket → see ticket detail with DAG + step inspector

**Step 6: Commit**

```bash
git add apps/desktop/src/renderer/screens/ticket.tsx apps/desktop/src/renderer/components/workflow-dag.tsx apps/desktop/src/renderer/components/step-inspector.tsx apps/desktop/src/renderer/components/tab-content.tsx
git commit -m "feat: add ticket detail screen with workflow DAG and step inspector"
```

---

### Task 9: Keyboard Shortcuts

**Files:**
- Create: `apps/desktop/src/renderer/hooks/use-keyboard-shortcuts.ts`
- Modify: `apps/desktop/src/renderer/components/app-layout.tsx`

**Step 1: Create keyboard shortcuts hook**

```ts
// apps/desktop/src/renderer/hooks/use-keyboard-shortcuts.ts
import { useEffect } from 'react'
import { useTabStore } from 'renderer/stores/use-tab-store'
import { useSidebarStore } from 'renderer/stores/use-sidebar-store'

export function useKeyboardShortcuts() {
  const { tabs, activeTabId, setActiveTab, closeTab } = useTabStore()
  const { toggle: toggleSidebar } = useSidebarStore()

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey

      // Cmd+W: close active tab
      if (mod && e.key === 'w') {
        e.preventDefault()
        if (activeTabId !== 'home') closeTab(activeTabId)
        return
      }

      // Cmd+B: toggle sidebar
      if (mod && e.key === 'b') {
        e.preventDefault()
        toggleSidebar()
        return
      }

      // Cmd+1-9: switch to tab by position
      if (mod && e.key >= '1' && e.key <= '9') {
        e.preventDefault()
        const index = Number.parseInt(e.key) - 1
        if (index < tabs.length) setActiveTab(tabs[index].id)
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [tabs, activeTabId, setActiveTab, closeTab, toggleSidebar])
}
```

**Step 2: Wire into AppLayout**

Add `useKeyboardShortcuts()` call at the top of the `AppLayout` component body.

```tsx
// In app-layout.tsx, add:
import { useKeyboardShortcuts } from 'renderer/hooks/use-keyboard-shortcuts'

export function AppLayout({ children }: { children: React.ReactNode }) {
  useKeyboardShortcuts()
  // ... rest of component
}
```

**Step 3: Verify**

Run: `pnpm --filter my-electron-app typecheck`

**Step 4: Commit**

```bash
git add apps/desktop/src/renderer/hooks/use-keyboard-shortcuts.ts apps/desktop/src/renderer/components/app-layout.tsx
git commit -m "feat: add keyboard shortcuts (Cmd+W, Cmd+B, Cmd+1-9)"
```

---

### Task 10: Final Integration Check

**Step 1: Run full typecheck**

Run: `pnpm typecheck`
Expected: no type errors across the monorepo

**Step 2: Run lint**

Run: `pnpm lint`
Fix any lint errors found.

**Step 3: Visual smoke test**

Run: `pnpm --filter my-electron-app dev`

Check:
- Home tab shows projects card grid
- "New Project" opens create modal, creates project, opens project tab
- Project pinned tab shows in tab bar (icon-only)
- Project tab shows Kanban board / List toggle
- Click ticket card opens ticket tab (regular tab with label)
- Ticket tab shows detail + DAG + step inspector
- Sidebar changes when switching tabs
- Cmd+W closes active tab
- Cmd+B toggles sidebar
- Cmd+1-9 switches tabs
- Delete project from card context menu or settings page
- Project settings saves changes

**Step 4: Commit any fixes**

```bash
git add -A apps/desktop/
git commit -m "fix: lint and integration fixes"
```

---

## Summary

| Task | Description | Key Files |
|------|-------------|-----------|
| 1 | Tab Store | `stores/use-tab-store.ts`, `types/tabs.ts` |
| 2 | App Layout Shell | `components/app-layout.tsx`, `components/tab-content.tsx`, `routes.tsx` |
| 3 | Context-Adaptive Sidebar | `components/sidebar/{home,project,ticket}-sidebar.tsx` |
| 4 | Home Screen Cards | `screens/home.tsx`, `components/project-card.tsx` |
| 5 | Create Project Modal | `components/modals/create-project-modal.tsx` |
| 6 | Delete Project Modal | `components/modals/delete-project-modal.tsx` |
| 7 | Project Tab + Board | `screens/project.tsx`, `screens/project/tickets-board.tsx`, `screens/project/project-settings.tsx` |
| 8 | Ticket Detail | `screens/ticket.tsx`, `components/workflow-dag.tsx`, `components/step-inspector.tsx` |
| 9 | Keyboard Shortcuts | `hooks/use-keyboard-shortcuts.ts` |
| 10 | Integration Check | lint, typecheck, visual smoke test |
