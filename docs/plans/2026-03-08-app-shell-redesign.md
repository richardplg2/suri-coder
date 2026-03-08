# App Shell Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enhance the existing app-shell with an Inspector panel, expandable workflow steps sidebar, rail context menu, and session metrics in the status bar.

**Architecture:** Incremental refactor — the shell already works (Rail, Toolbar, Sidebar, TabContent routing, StatusBar, all Zustand stores). We add a new `InspectorPanel` to the flex row, refactor `TicketSidebar` to use expandable `WorkflowStepItem` components (replacing flat `SourceList`), add a right-click `DropdownMenu` to Rail project icons, and wire `Cmd+I` to toggle the inspector.

**Tech Stack:** React 19 + Tailwind CSS v4 + Lucide React + Zustand + Radix UI (via shadcn). All components in `apps/desktop/src/renderer/`. UI primitives from `@agent-coding/ui` (`packages/ui/src/`).

**Design Reference:**
- Stitch screenshot: `.stitch/designs/app-shell.png`
- Stitch HTML: `.stitch/designs/app-shell.html`
- Requirements: `docs/plans/2026-03-08-layout-redesign-requirements.md` (REQ-SHELL-01 through REQ-SHELL-08)
- Design system: `docs/design/design-system.md`
- Design doc: `docs/plans/2026-03-08-app-shell-redesign-design.md`

---

## Task 0: Export Missing UI Primitives

**Why:** `DropdownMenu` and `Breadcrumb` shadcn components exist in `packages/ui/src/components/` but are not exported from `packages/ui/src/index.ts`. We need them for the Rail context menu and Inspector file preview.

**Files:**
- Modify: `packages/ui/src/index.ts`

**Step 1: Add DropdownMenu exports**

Add after line 116 (Toaster export) in `packages/ui/src/index.ts`:

```typescript
export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from './components/dropdown-menu'
```

**Step 2: Add Breadcrumb exports**

Add right after DropdownMenu exports:

```typescript
export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from './components/breadcrumb'
```

**Step 3: Verify build**

Run: `pnpm --filter @agent-coding/ui build`
Expected: Build succeeds with no errors.

**Step 4: Commit**

```bash
git add packages/ui/src/index.ts
git commit -m "chore: export DropdownMenu and Breadcrumb from UI package"
```

---

## Task 1: Create Inspector Store

**Why:** REQ-STATE-04 requires a separate store for the Inspector panel with `isOpen`, `content`, `open()`, `close()`, `toggle()`.

**Files:**
- Create: `apps/desktop/src/renderer/stores/use-inspector-store.ts`

**Step 1: Create the store**

Create `apps/desktop/src/renderer/stores/use-inspector-store.ts`:

```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type InspectorContentType = 'file-preview' | 'message-detail' | 'diff-viewer'

export interface InspectorContent {
  type: InspectorContentType
  /** file-preview fields */
  filePath?: string
  code?: string
  language?: string
  /** message-detail fields */
  messageId?: string
  messageContent?: string
  /** diff-viewer fields */
  diff?: string
}

interface InspectorStore {
  isOpen: boolean
  content: InspectorContent | null
  open: (content: InspectorContent) => void
  close: () => void
  toggle: () => void
}

export const useInspectorStore = create<InspectorStore>()(
  persist(
    (set) => ({
      isOpen: false,
      content: null,
      open: (content) => set({ isOpen: true, content }),
      close: () => set({ isOpen: false, content: null }),
      toggle: () => set((s) => ({ isOpen: !s.isOpen })),
    }),
    {
      name: 'inspector-store',
      partialize: (state) => ({ isOpen: state.isOpen }),
    },
  ),
)
```

Note: `partialize` persists only `isOpen` — not the content (transient data).

**Step 2: Verify typecheck**

Run: `pnpm --filter my-electron-app typecheck`
Expected: No errors.

**Step 3: Commit**

```bash
git add apps/desktop/src/renderer/stores/use-inspector-store.ts
git commit -m "feat: add useInspectorStore for inspector panel state"
```

---

## Task 2: Create InspectorPanel Component

**Why:** REQ-SHELL-06. 320px right panel, slide animation, renders context-dependent content.

**Files:**
- Create: `apps/desktop/src/renderer/components/inspector/file-preview.tsx`
- Create: `apps/desktop/src/renderer/components/inspector-panel.tsx`

**Step 1: Create FilePreview sub-component**

Create `apps/desktop/src/renderer/components/inspector/file-preview.tsx`:

```typescript
import { X, Folder } from 'lucide-react'
import { CodeBlock, Button } from '@agent-coding/ui'
import { useInspectorStore } from 'renderer/stores/use-inspector-store'
import type { InspectorContent } from 'renderer/stores/use-inspector-store'

function FileBreadcrumb({ filePath }: { filePath: string }) {
  const segments = filePath.split('/')
  return (
    <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border/50 bg-[var(--surface)]/30">
      <Folder className="size-3.5 text-muted-foreground shrink-0" />
      <div className="flex items-center text-caption font-mono text-muted-foreground truncate">
        {segments.map((seg, i) => (
          <span key={`${seg}-${i}`} className="flex items-center">
            {i > 0 && <span className="mx-1 text-muted-foreground/50">/</span>}
            <span className={i === segments.length - 1 ? 'text-foreground' : ''}>
              {seg}
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}

export function FilePreview({ content }: { content: InspectorContent }) {
  return (
    <div className="flex h-full flex-col">
      {content.filePath && <FileBreadcrumb filePath={content.filePath} />}
      <div className="flex-1 overflow-auto">
        <CodeBlock
          code={content.code ?? ''}
          language={content.language ?? 'typescript'}
          showLineNumbers
        />
      </div>
    </div>
  )
}
```

**Step 2: Create InspectorPanel component**

Create `apps/desktop/src/renderer/components/inspector-panel.tsx`:

```typescript
import { X } from 'lucide-react'
import { cn, Button, DiffViewer } from '@agent-coding/ui'
import { useInspectorStore } from 'renderer/stores/use-inspector-store'
import { FilePreview } from './inspector/file-preview'

const CONTENT_LABELS: Record<string, string> = {
  'file-preview': 'File Preview',
  'message-detail': 'Message Detail',
  'diff-viewer': 'Diff Viewer',
}

export function InspectorPanel() {
  const { isOpen, content, close } = useInspectorStore()

  return (
    <aside
      className={cn(
        'shrink-0 border-l border-border/50 bg-[var(--surface)] transition-[width] duration-200 ease-out overflow-hidden',
        isOpen && content ? 'w-80' : 'w-0',
      )}
    >
      <div className="flex h-full w-80 flex-col">
        {/* Header */}
        <div className="flex h-10 shrink-0 items-center justify-between border-b border-border/50 px-3">
          <span className="section-header">
            {content ? CONTENT_LABELS[content.type] ?? 'Inspector' : 'Inspector'}
          </span>
          <Button variant="ghost" size="icon-sm" className="size-6" onClick={close}>
            <X className="size-3.5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {content?.type === 'file-preview' && <FilePreview content={content} />}
          {content?.type === 'diff-viewer' && content.diff && (
            <div className="h-full overflow-auto">
              <DiffViewer patch={content.diff} />
            </div>
          )}
          {content?.type === 'message-detail' && (
            <div className="p-3 text-sm text-foreground whitespace-pre-wrap">
              {content.messageContent}
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
```

**Step 3: Verify typecheck**

Run: `pnpm --filter my-electron-app typecheck`
Expected: No errors.

**Step 4: Commit**

```bash
git add apps/desktop/src/renderer/components/inspector/file-preview.tsx apps/desktop/src/renderer/components/inspector-panel.tsx
git commit -m "feat: add InspectorPanel with FilePreview, DiffViewer, MessageDetail"
```

---

## Task 3: Wire InspectorPanel into AppLayout

**Why:** The inspector needs to appear in the main flex row, after `<main>`.

**Files:**
- Modify: `apps/desktop/src/renderer/components/app-layout.tsx`

**Step 1: Add import and render InspectorPanel**

In `apps/desktop/src/renderer/components/app-layout.tsx`:

1. Add import at top (after StatusBar import, ~line 11):

```typescript
import { InspectorPanel } from './inspector-panel'
```

2. Add `<InspectorPanel />` after the `<main>` element (after line 101, before the closing `</div>` of the flex row):

```typescript
          <main className="flex-1 overflow-hidden bg-background">
            {children}
          </main>
          <InspectorPanel />
```

**Step 2: Verify build and visual**

Run: `pnpm --filter my-electron-app dev`
Expected: App launches. No inspector visible (it's closed by default). Layout unchanged.

**Step 3: Commit**

```bash
git add apps/desktop/src/renderer/components/app-layout.tsx
git commit -m "feat: wire InspectorPanel into AppLayout"
```

---

## Task 4: Add Cmd+I Keyboard Shortcut

**Why:** REQ-KB-01 requires `Cmd+I` to toggle the inspector panel.

**Files:**
- Modify: `apps/desktop/src/renderer/hooks/use-keyboard-shortcuts.ts`

**Step 1: Import inspector store and add shortcut**

In `apps/desktop/src/renderer/hooks/use-keyboard-shortcuts.ts`:

1. Add import (after line 4):

```typescript
import { useInspectorStore } from 'renderer/stores/use-inspector-store'
```

2. Add destructuring inside the hook (after line 12):

```typescript
  const { toggle: toggleInspector } = useInspectorStore()
```

3. Add the shortcut handler inside `handleKeyDown` (after the Cmd+B block, ~after line 30):

```typescript
      // Cmd+I: toggle inspector
      if (mod && e.key === 'i') {
        e.preventDefault()
        toggleInspector()
        return
      }
```

4. Add `toggleInspector` to the useEffect dependency array (line 43):

```typescript
  }, [tabs, activeTabId, activeProjectId, setActiveTab, closeTab, toggleSidebar, toggleInspector])
```

**Step 2: Test manually**

Run: `pnpm --filter my-electron-app dev`
Test: Press `Cmd+I` — inspector panel should slide in (empty). Press again — should close.

**Step 3: Commit**

```bash
git add apps/desktop/src/renderer/hooks/use-keyboard-shortcuts.ts
git commit -m "feat: add Cmd+I shortcut to toggle inspector panel"
```

---

## Task 5: Create WorkflowStepItem + WorkflowStepList

**Why:** REQ-TICKET-05. Replace flat SourceList with expandable steps showing status icons (check/dot/spinner/x/empty) and nested sessions.

**Files:**
- Create: `apps/desktop/src/renderer/components/sidebar/workflow-step-item.tsx`
- Create: `apps/desktop/src/renderer/components/sidebar/workflow-step-list.tsx`

**Step 1: Create WorkflowStepItem**

Create `apps/desktop/src/renderer/components/sidebar/workflow-step-item.tsx`:

```typescript
import { useState } from 'react'
import { CheckCircle2, Circle, XCircle, Loader2, ChevronRight } from 'lucide-react'
import { cn } from '@agent-coding/ui'
import type { StepStatus } from 'renderer/types/api'

interface Session {
  id: string
  number: number
  status: 'running' | 'completed' | 'failed'
}

interface WorkflowStepItemProps {
  name: string
  status: StepStatus
  sessions?: Session[]
  isActive?: boolean
  onClickStep?: () => void
  onClickSession?: (sessionId: string) => void
}

const STATUS_ICONS: Record<string, { icon: typeof Circle; className: string }> = {
  completed: { icon: CheckCircle2, className: 'text-[var(--success)]' },
  running: { icon: Loader2, className: 'text-[var(--accent)] animate-spin' },
  ready: { icon: Circle, className: 'text-[var(--accent)] fill-[var(--accent)]' },
  review: { icon: Circle, className: 'text-[var(--accent)] fill-[var(--accent)]' },
  awaiting_approval: { icon: Circle, className: 'text-[var(--accent)] fill-[var(--accent)]' },
  changes_requested: { icon: XCircle, className: 'text-[var(--destructive)]' },
  failed: { icon: XCircle, className: 'text-[var(--destructive)]' },
  pending: { icon: Circle, className: 'text-muted-foreground' },
  skipped: { icon: Circle, className: 'text-muted-foreground/50' },
}

function getStatusIcon(status: StepStatus) {
  return STATUS_ICONS[status] ?? STATUS_ICONS.pending
}

const SESSION_DOT: Record<string, string> = {
  running: 'bg-[var(--success)] animate-pulse',
  completed: 'bg-muted-foreground/50',
  failed: 'bg-[var(--destructive)]',
}

export function WorkflowStepItem({
  name,
  status,
  sessions,
  isActive = false,
  onClickStep,
  onClickSession,
}: WorkflowStepItemProps) {
  const [expanded, setExpanded] = useState(isActive)
  const { icon: Icon, className: iconClass } = getStatusIcon(status)
  const hasSessions = sessions && sessions.length > 0

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          if (hasSessions) setExpanded((p) => !p)
          onClickStep?.()
        }}
        className={cn(
          'flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-sm cursor-pointer',
          'transition-colors duration-150',
          isActive
            ? 'bg-[var(--accent)]/10 border border-[var(--accent)]/20 text-[var(--accent)] font-medium'
            : 'text-muted-foreground hover:bg-[var(--surface-hover)] hover:text-foreground',
        )}
      >
        {hasSessions && (
          <ChevronRight
            className={cn(
              'size-3.5 shrink-0 transition-transform duration-150',
              expanded && 'rotate-90',
            )}
          />
        )}
        {!hasSessions && <div className="w-3.5 shrink-0" />}
        <Icon className={cn('size-4 shrink-0', iconClass)} />
        <span className="truncate">{name}</span>
      </button>

      {/* Nested sessions */}
      {expanded && hasSessions && (
        <div className="ml-6 mt-0.5 space-y-0.5 pl-3 border-l border-border/30">
          {sessions.map((session) => (
            <button
              key={session.id}
              type="button"
              onClick={() => onClickSession?.(session.id)}
              className="flex w-full items-center gap-2 px-2 py-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer rounded transition-colors duration-150"
            >
              <span className={cn('size-1.5 rounded-full shrink-0', SESSION_DOT[session.status] ?? SESSION_DOT.completed)} />
              <span>Session #{session.number}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

**Step 2: Create WorkflowStepList**

Create `apps/desktop/src/renderer/components/sidebar/workflow-step-list.tsx`:

```typescript
import type { WorkflowStep } from 'renderer/types/api'
import { WorkflowStepItem } from './workflow-step-item'

interface WorkflowStepListProps {
  steps: WorkflowStep[]
  activeStepId?: string
  onClickStep?: (stepId: string) => void
  onClickSession?: (sessionId: string) => void
}

export function WorkflowStepList({
  steps,
  activeStepId,
  onClickStep,
  onClickSession,
}: WorkflowStepListProps) {
  const sorted = [...steps].sort((a, b) => a.order - b.order)

  return (
    <div className="space-y-0.5 px-2">
      {sorted.map((step) => (
        <WorkflowStepItem
          key={step.id}
          name={step.name}
          status={step.status}
          isActive={step.id === activeStepId}
          sessions={[]}
          onClickStep={() => onClickStep?.(step.id)}
          onClickSession={onClickSession}
        />
      ))}
    </div>
  )
}
```

Note: `sessions` is passed as `[]` for now — wiring real session data will come when session API integration is built (out of scope for shell).

**Step 3: Verify typecheck**

Run: `pnpm --filter my-electron-app typecheck`
Expected: No errors.

**Step 4: Commit**

```bash
git add apps/desktop/src/renderer/components/sidebar/workflow-step-item.tsx apps/desktop/src/renderer/components/sidebar/workflow-step-list.tsx
git commit -m "feat: add WorkflowStepItem and WorkflowStepList components"
```

---

## Task 6: Refactor TicketSidebar to Use WorkflowStepList

**Why:** Replace flat `SourceList` with the new expandable `WorkflowStepList`.

**Files:**
- Modify: `apps/desktop/src/renderer/components/sidebar/ticket-sidebar.tsx`

**Step 1: Replace SourceList with WorkflowStepList**

Rewrite `apps/desktop/src/renderer/components/sidebar/ticket-sidebar.tsx`:

```typescript
import { ScrollArea } from '@agent-coding/ui'
import { useTicket } from 'renderer/hooks/queries/use-tickets'
import { WorkflowStepList } from './workflow-step-list'

interface TicketSidebarProps {
  ticketId: string
  projectId: string
}

export function TicketSidebar({ ticketId, projectId }: TicketSidebarProps) {
  const { data: ticket } = useTicket(projectId, ticketId)

  // Find the first active/running step for highlight
  const activeStep = ticket?.steps?.find(
    (s) => s.status === 'running' || s.status === 'ready' || s.status === 'review' || s.status === 'awaiting_approval',
  )

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border/50 px-3 py-2">
        <div className="text-caption text-muted-foreground">{ticket?.key}</div>
        <div className="window-title truncate">{ticket?.title}</div>
      </div>
      <div className="section-header px-3 py-1.5">
        Workflow Steps
      </div>
      <ScrollArea className="flex-1">
        <WorkflowStepList
          steps={ticket?.steps ?? []}
          activeStepId={activeStep?.id}
        />
      </ScrollArea>
    </div>
  )
}
```

**Step 2: Verify typecheck and visual**

Run: `pnpm --filter my-electron-app typecheck && pnpm --filter my-electron-app dev`
Expected: Open a ticket tab → sidebar shows workflow steps with colored status icons. Active step is highlighted. Steps are expandable (though sessions list is empty for now).

**Step 3: Commit**

```bash
git add apps/desktop/src/renderer/components/sidebar/ticket-sidebar.tsx
git commit -m "refactor: replace SourceList with expandable WorkflowStepList in sidebar"
```

---

## Task 7: Add Rail Context Menu

**Why:** REQ-SHELL-02. Right-click project icon → Rename, Settings, Delete.

**Files:**
- Modify: `apps/desktop/src/renderer/components/rail.tsx`

**Step 1: Add DropdownMenu imports and context menu**

In `apps/desktop/src/renderer/components/rail.tsx`:

1. Add imports (replace existing imports at top):

```typescript
import { LayoutDashboard, Plus, Settings, Pencil, Trash2 } from 'lucide-react'
import {
  cn, Tooltip, TooltipTrigger, TooltipContent, ScrollArea,
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from '@agent-coding/ui'
import { useProjectNavStore } from 'renderer/stores/use-project-nav-store'
import { useProjects } from 'renderer/hooks/queries/use-projects'
import { useTabStore } from 'renderer/stores/use-tab-store'
import { useModalStore } from 'renderer/stores/use-modal-store'
```

2. Replace the `handleProjectContext` function (~line 42-48) and the project mapping section. Replace the entire `{projects?.map(...)}` block inside the ScrollArea with:

```typescript
          {projects?.map((project) => (
            <DropdownMenu key={project.id}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <span>
                      <ProjectIcon
                        name={project.name}
                        isActive={activeProjectId === project.id}
                        onClick={() => setActiveProject(project.id)}
                      />
                    </span>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="right">{project.name}</TooltipContent>
              </Tooltip>
              <DropdownMenuContent side="right" align="start" className="w-48">
                <DropdownMenuItem onClick={() => {
                  // TODO: inline rename — open rename modal
                }}>
                  <Pencil className="size-4" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  setActiveProject(project.id)
                  openSettingsTab(project.id)
                }}>
                  <Settings className="size-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-[var(--destructive)] focus:text-[var(--destructive)]"
                  onClick={() => open('delete-project', { projectId: project.id, projectName: project.name })}
                >
                  <Trash2 className="size-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ))}
```

3. Remove the `onContextMenu` prop from the `ProjectIcon` component interface and its usage (no longer needed — DropdownMenu handles right-click natively via trigger).

Update `ProjectIcon` to remove the `onContextMenu` prop:

```typescript
function ProjectIcon({ name, isActive, onClick }: {
  name: string
  isActive: boolean
  onClick: () => void
}) {
```

4. Remove the old `handleProjectContext` function.

**Step 2: Test manually**

Run: `pnpm --filter my-electron-app dev`
Test: Right-click a project icon → context menu appears with Rename, Settings, Delete. Click Settings → navigates to settings tab. Click Delete → opens delete modal.

**Step 3: Commit**

```bash
git add apps/desktop/src/renderer/components/rail.tsx
git commit -m "feat: add right-click context menu on Rail project icons"
```

---

## Task 8: Enhance StatusBar with Session Metrics

**Why:** REQ-SHELL-07. Status bar right side should show active session status, duration, tokens, cost.

**Files:**
- Modify: `apps/desktop/src/renderer/components/status-bar.tsx`

**Step 1: Add session metrics to the right side**

Rewrite `apps/desktop/src/renderer/components/status-bar.tsx`:

```typescript
import { useEffect, useState } from 'react'
import { Zap } from 'lucide-react'
import { StatusBadge } from '@agent-coding/ui'
import { apiClient } from 'renderer/lib/api-client'

export function StatusBar() {
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    let mounted = true

    async function check() {
      try {
        await apiClient('/health')
        if (mounted) setConnected(true)
      } catch {
        if (mounted) setConnected(false)
      }
    }

    check()
    const interval = setInterval(check, 30_000)
    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [])

  // TODO: Wire real session metrics from WS/store when session tracking is implemented.
  // For now, show placeholder structure.

  return (
    <div className="flex h-7 shrink-0 items-center justify-between border-t border-border/50 glass-panel px-3 text-caption text-muted-foreground">
      <div className="flex items-center gap-3">
        <StatusBadge
          status={connected ? 'connected' : 'disconnected'}
          showDot
          className="text-[11px] px-1.5 py-0"
        >
          {connected ? 'Connected' : 'Disconnected'}
        </StatusBadge>
        <span className="text-muted-foreground/50">v1.0.0</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Zap className="size-3 text-muted-foreground" />
          <span>No active session</span>
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Test visually**

Run: `pnpm --filter my-electron-app dev`
Expected: Status bar shows "Connected" left, version, and "No active session" right with Zap icon.

**Step 3: Commit**

```bash
git add apps/desktop/src/renderer/components/status-bar.tsx
git commit -m "feat: enhance StatusBar with session metrics placeholder"
```

---

## Task 9: Final Typecheck + Lint

**Files:** All modified files.

**Step 1: Run typecheck**

Run: `pnpm typecheck`
Expected: No errors across all packages.

**Step 2: Run lint**

Run: `pnpm lint`
Expected: No errors. Fix any auto-fixable issues with `pnpm lint --fix` if needed.

**Step 3: Run dev to verify full layout**

Run: `pnpm --filter my-electron-app dev`

Verify:
- [ ] Rail shows projects with tooltips
- [ ] Right-click project icon → context menu with Rename/Settings/Delete
- [ ] Toolbar shows tabs for active project, hidden when Home
- [ ] Sidebar shows expandable workflow steps when ticket tab is active
- [ ] Sidebar hidden for Home/Kanban/Settings
- [ ] Cmd+I toggles inspector panel (320px, slides in/out)
- [ ] Inspector has close button (X) in header
- [ ] Status bar shows connection status + version + session placeholder
- [ ] Cmd+B still toggles sidebar
- [ ] All glass-panel elements have blur effect

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "chore: fix lint and typecheck issues after app-shell refactor"
```

---

## Summary

| Task | Files | Description |
|------|-------|-------------|
| 0 | `packages/ui/src/index.ts` | Export DropdownMenu + Breadcrumb |
| 1 | `stores/use-inspector-store.ts` | New inspector Zustand store |
| 2 | `components/inspector-panel.tsx`, `components/inspector/file-preview.tsx` | Inspector panel + FilePreview |
| 3 | `components/app-layout.tsx` | Wire InspectorPanel into layout |
| 4 | `hooks/use-keyboard-shortcuts.ts` | Add Cmd+I shortcut |
| 5 | `components/sidebar/workflow-step-item.tsx`, `workflow-step-list.tsx` | Expandable step components |
| 6 | `components/sidebar/ticket-sidebar.tsx` | Refactor to use WorkflowStepList |
| 7 | `components/rail.tsx` | Add DropdownMenu context menu |
| 8 | `components/status-bar.tsx` | Add session metrics placeholder |
| 9 | All files | Final typecheck + lint + visual verify |
