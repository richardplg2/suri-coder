# App Shell Redesign — Design Document

**Date:** 2026-03-08
**Scope:** Incremental refactor of the existing AppLayout shell components

---

## Overview

Enhance the existing app-shell (Rail + Toolbar + Sidebar + Main + StatusBar) with:
1. New Inspector panel (320px right, Cmd+I toggle)
2. Refactored workflow steps sidebar (expandable steps with status icons + nested sessions)
3. Rail context menu (right-click → Rename/Settings/Delete)
4. Enhanced StatusBar with session metrics
5. Cmd+I keyboard shortcut for inspector

**Not in scope:** Screen content (Home, Kanban, Ticket, Settings, Brainstorm, Modals).

---

## Architecture

```
AppLayout (flex h-screen flex-col)
├── Toolbar (h-9, glass-panel, border-b border-border/50)
│   ├── Traffic light spacer (macOS)
│   ├── TabBar (center, scoped by activeProjectId)
│   └── Actions (Search, Notifications, Theme toggle)
├── Main Row (flex flex-1 overflow-hidden)
│   ├── Rail (w-12, glass-panel, border-r) — with context menu
│   ├── AppSidebar (w-60/w-0, glass-panel, border-r) — enhanced workflow steps
│   ├── main (flex-1, bg-background) — children/TabContent
│   └── InspectorPanel (w-80/w-0, surface, border-l) — NEW
└── StatusBar (h-7, glass-panel, border-t) — enhanced with metrics
```

---

## New Store: useInspectorStore

```typescript
type InspectorContentType = 'file-preview' | 'message-detail' | 'diff-viewer'

interface InspectorContent {
  type: InspectorContentType
  filePath?: string
  code?: string
  language?: string
  message?: SessionMessage
  diff?: string
}

interface InspectorStore {
  isOpen: boolean
  content: InspectorContent | null
  open: (content: InspectorContent) => void
  close: () => void
  toggle: () => void
}
```

Persisted to localStorage. Independent of sidebar store.

---

## Component Changes

### 1. InspectorPanel (NEW)

- Width: 320px when open, 0 when closed
- Transition: `transition-[width] duration-200 ease-out`
- Background: `bg-surface`, border-l `border-border/50`
- Header: content type label + close X button
- Content switches on `content.type`:
  - `file-preview` → FilePreview (breadcrumb + CodeBlock with line numbers)
  - `message-detail` → MessageDetailPanel (full message content)
  - `diff-viewer` → DiffViewer (existing component)

### 2. FilePreview (NEW)

- Header: folder icon + breadcrumb path segments separated by " / "
- Last segment: `text-foreground` (emphasized)
- Code area: JetBrains Mono 12px, line numbers (muted, right-aligned), syntax highlighted
- Uses existing CodeBlock from `@agent-coding/ui`

### 3. WorkflowStepList (NEW — replaces SourceList in TicketSidebar)

- Vertical list of `WorkflowStepItem` components
- Receives `steps: WorkflowStep[]` from ticket data

### 4. WorkflowStepItem (NEW)

Status icons (Lucide):
- completed → `CheckCircle2` (success green #32D74B)
- active → `Circle` filled (accent blue #0A84FF)
- running → `Loader2` with `animate-spin` (accent)
- failed → `XCircle` (destructive red #FF453A)
- pending → `Circle` (muted text-secondary)

Active step: `bg-accent/10 border border-accent/20 rounded-lg` (selection highlight)
Expandable: chevron toggle, nested sessions indented `pl-9`
Nested sessions: small dot + "Session #N" + status

### 5. RailContextMenu (NEW)

- Uses `DropdownMenu` from `@agent-coding/ui` (Radix)
- Triggered by `onContextMenu` on project icons
- Items: Rename, Settings, Delete
- Delete opens `DeleteProjectModal` via `useModalStore`
- Settings calls `openSettingsTab(projectId)`

### 6. StatusBar (MODIFY)

Right side additions:
- Session status indicator (dot + "Session active" / "No active session")
- Duration (e.g., "12:34")
- Token count (e.g., "4.2K tokens", accent color)
- Estimated cost (e.g., "$0.08 est.")
- Separated by `border-l border-border/50 pl-3`

Source: will need a hook or store to track active session metrics (can start with placeholder, wire later).

### 7. Rail (MODIFY)

- Replace `onContextMenu` handler with proper `DropdownMenu` context menu
- Menu items: Rename, Settings, Delete with Lucide icons

### 8. Keyboard Shortcuts (MODIFY)

- Add `Cmd+I` → `useInspectorStore().toggle()`

---

## File Plan

| File | Action |
|------|--------|
| `stores/use-inspector-store.ts` | CREATE |
| `components/inspector-panel.tsx` | CREATE |
| `components/inspector/file-preview.tsx` | CREATE |
| `components/sidebar/workflow-step-list.tsx` | CREATE |
| `components/sidebar/workflow-step-item.tsx` | CREATE |
| `components/sidebar/ticket-sidebar.tsx` | MODIFY (use WorkflowStepList) |
| `components/app-layout.tsx` | MODIFY (add InspectorPanel) |
| `components/rail.tsx` | MODIFY (add DropdownMenu context menu) |
| `components/status-bar.tsx` | MODIFY (add session metrics) |
| `hooks/use-keyboard-shortcuts.ts` | MODIFY (add Cmd+I) |

---

## Design Reference

- Stitch screenshot: `.stitch/designs/app-shell.png`
- Stitch HTML: `.stitch/designs/app-shell.html`
- Design system: `docs/design/design-system.md`
- Component specs: `docs/design/components.md`
- Requirements: `docs/plans/2026-03-08-layout-redesign-requirements.md`
