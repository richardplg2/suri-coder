# Layout Redesign: Rail Navigation + Scoped Tabs + Session View

**Date:** 2026-03-08
**Status:** Approved
**Constraint:** All UI follows `docs/design/design-system.md` (bento grid, glass-panel, tokens, anti-patterns)

---

## Overview

Redesign the app shell from horizontal tab navigation to a vertical project rail with scoped tabs per project. Simplify project navigation by making kanban the default view and consolidating Repos/Agents/Templates/GitHub into a single Settings page. Add session view for full Claude Code agent transcript rendering.

### Key Changes from Current Layout

| Aspect | Current | New |
|--------|---------|-----|
| Project navigation | Horizontal tabs in toolbar | Vertical icon rail (48px, left edge) |
| Tab scope | Global (all tabs mixed) | Per-project (tabs scoped to active project) |
| Project sub-nav | Sidebar with 6 nav items | Removed; Settings page consolidates all |
| Default project view | Sidebar + content | Kanban board full-width, no sidebar |
| Brainstorm | Separate tab type | First step in ticket workflow |
| Figma | Separate tab type | Optional workflow step + ad-hoc via Cmd+K |
| Tab types | 5 (Home, Project, Ticket, Brainstorm, FigmaImport) | 3 (Home, Project, Ticket) + SettingsTab |
| Session visibility | None | Full transcript with message type rendering |

---

## 1. Layout Architecture

### Shell Structure

```
+------+--------------------------------------+--------------+
| Rail | Toolbar (36px, glass-panel)          |              |
| 48px | [drag region] [tabs] [actions]       |              |
|      +----------+---------------------------+  Inspector   |
|      | Sidebar  |                           |  (320px)     |
|      | (240px)  |    Main Content            |  collapsible |
|      | optional |    (flex-1)                |  Cmd+I       |
|      | Cmd+B    |                           |              |
|      |          |                           |              |
+------+----------+---------------------------+--------------+
| Status Bar (28px, glass-panel)                             |
+------------------------------------------------------------+
```

- **Rail:** Fixed, always visible, `glass-panel` background, `border-border/50` right border
- **Toolbar:** 36px, glass-panel, drag region, tab bar (scoped), right-side actions (search, notifications, theme)
- **Sidebar:** 240px, collapsible (Cmd+B), context-adaptive, `glass-panel`
- **Main Content:** `flex-1`, scrollable
- **Inspector:** 320px, collapsible (Cmd+I), for message details, Figma viewer, diffs
- **Status Bar:** 28px, glass-panel, connection status

### Rail Component (48px)

```
+------+
| Home |  Layout Dashboard or Home icon, always first
|------|
|  P1  |  Project avatar: 32x32, rounded-lg, first 2 letters
|  P2  |  Active: 3px accent bar left side
|  P3  |  Scrollable if many projects
|      |
|------|
|  +   |  New project, always last
+------+
```

- Background: `glass-panel`
- Project icons: 32x32, `rounded-lg`, display first 2 letters of project name
- Active indicator: 3px `var(--accent)` bar on left edge
- Home icon: Lucide `LayoutDashboard`
- Right-click project: context menu (Rename, Settings, Delete)
- Tooltip on hover: full project name

### Tab Scoping

- Each project maintains its own tab state: `Map<projectId, AppTab[]>`
- Switching project on rail changes toolbar tabs to that project's tabs
- Home has no tabs (full-width dashboard)
- Tab types: `TicketTab`, `SettingsTab` (within project scope)

### Sidebar Visibility Rules

| Context | Sidebar | Inspector | Main Content |
|---------|---------|-----------|--------------|
| Home (dashboard) | Hidden | Hidden | Dashboard bento grid |
| Project (kanban) | Hidden | Hidden | Kanban board full-width |
| Ticket detail | Visible: workflow steps | On demand | Session view / overview |
| Settings | Hidden | Hidden | Scrollable settings page |

---

## 2. Home Dashboard

Cross-project overview with mock data (API integration deferred).

### Sections

1. **Needs Attention** -- tickets awaiting user action (review pending, agent failed, agent needs input). Bento grid cards showing ticket key + status + project name. Click navigates to project + opens ticket tab.

2. **Running Now** -- tickets with active agent sessions. Shows step name + progress indicator. Click navigates to ticket session view.

3. **Recent Activity** -- timeline across all projects. Compact list rows: ticket key + event + relative time. Powered by notification data.

### Behavior

- No sidebar, no inspector
- Auto-refresh via WebSocket (notification events) -- mock for now
- Empty state: "No active tickets. Select a project to get started."
- Click any item: `setActiveProject(projectId)` + `openTicketTab(ticketId)`

---

## 3. Project View (Kanban)

```
+------+-----------------------------------------------------+
|      | Toolbar [T-12 | T-14 | Settings]        actions     |
| Rail +-----------------------------------------------------+
|      |                                                     |
|      |  Tickets                          [+ New Ticket]    |
|      |                                                     |
|      |  +--Backlog--+ +--In Prog--+ +--Review--+ +--Done--+
|      |  | T-15      | | T-14      | | T-12     | |        |
|      |  | T-16      | |           | |          | |        |
|      |  +-----------+ +-----------+ +----------+ +--------+
+------+-----------------------------------------------------+
| Status Bar                                                 |
+------------------------------------------------------------+
```

- No sidebar, no inspector -- kanban gets full width
- Click ticket card: `openTicketTab(ticketId)` adds tab to toolbar
- "+ New Ticket": create draft ticket, open ticket tab, start brainstorm step
- Kanban columns map to ticket status enum (Backlog, In Progress, Review, Done)
- Ticket card shows: key, title, type badge (feat/bug/refactor), active step indicator
- Existing bento kanban styles from restyle -- only remove sidebar, adjust width

---

## 4. Ticket Detail + Session View

```
+------+----------+-------------------------+--------------+
|      | Toolbar  [T-12 | T-14 | Settings]  |              |
| Rail +----------+-------------------------+  Inspector   |
|      | Sidebar  |                         |  (320px)     |
|      |          | T-14: Add user auth     |              |
|      | Workflow | [Overview | Sessions]   |  Message     |
|      |          |                         |  Detail      |
|      | * Brain v| Session #2 (running)    |              |
|      | * Specs v|                         | +----------+ |
|      | * Code @ | text: Analyzing...      | |Read:     | |
|      |   #1  v  | tool: Read auth.tsx  <--| |auth.tsx  | |
|      |   #2  ~  | tool: Edit auth.tsx     | |L1-150    | |
|      | o Test   | todo: 3/5 done          | +----------+ |
|      | o Review | agent: Subagent: tests  |              |
|      |          | text: "Fixed login..."  |              |
+------+----------+-------------------------+--------------+
| Status Bar                                               |
+----------------------------------------------------------+
```

### Sidebar: Workflow Steps

- All steps of ticket workflow displayed vertically
- Status icons: checkmark (completed), dot-filled (active), spinner (running), x (failed), dot-empty (pending)
- Each step expands to show sessions within (Session #1 completed, Session #2 running)
- Click step: main content shows sessions for that step
- Click session: scroll to / focus that session

### Main Content: Segmented Control [Overview | Sessions]

**Overview tab:**
- Ticket header: key + type badge + status badge + title
- Specs bento grid (reuse existing ticket overview components)
- Figma design references if present

**Sessions tab:**
- Default view when ticket has active session
- Smart collapse rendering: text messages shown in full, tool calls collapsed to summary line
- Click any collapsed message: Inspector shows full detail

#### Message Type Rendering

| Message Type | Collapsed View | Inspector Detail |
|---|---|---|
| Text (assistant) | Full content inline | -- |
| Tool Call: Read/Edit/Write | Icon + filename | Full file content with line numbers |
| Tool Call: Bash | Icon + command summary | Full terminal output |
| Subagent | Icon + "Subagent: description" | Full subagent transcript |
| Todo List | Icon + "Todo: N/M done" | Full checklist with item statuses |
| Skill invocation | Icon + "Skill: name" | Skill content |
| Error | Icon + error summary (red) | Full stack trace |

- Active session auto-scrolls; completed sessions scroll freely
- Session header: status badge, duration, token/cost info

### Brainstorm (First Workflow Step)

When Brainstorm step is active, Sessions tab renders brainstorm UI:
- Chat messages (user + AI) in conversation format
- Quiz components: single/multi-select with recommended badges
- On completion: AI generates specs, transitions to Specs step
- Tiptap rich editor for reviewing/editing brainstorm output before confirming

### Figma Integration

- **As workflow step:** Main content shows Figma viewer (node tree + canvas + annotation panel)
- **Ad-hoc (Cmd+K):** Inspector shows Figma viewer while main content stays on current context
- **Output:** Structured markdown exported and appended to ticket specs

---

## 5. Project Settings

```
+------+-----------------------------------------------------+
|      | Toolbar [T-12 | Settings]                actions     |
| Rail +-----------------------------------------------------+
|      |                                                     |
|      |  Project Settings    [General][Repos][Agents]       |
|      |                      [Templates][GitHub] <-- anchors |
|      |                                                     |
|      |  -- General ---------------------------------       |
|      |  | Name: [input]  Description: [input]      |       |
|      |  | Auto-approval: [ON / OFF]                |       |
|      |  -------------------------------------------        |
|      |                                                     |
|      |  Repositories                             [Add]     |
|      |  +----------+ +----------+                          |
|      |  | my-app   | | api-srv  |                          |
|      |  +----------+ +----------+                          |
|      |                                                     |
|      |  Agents                                   [Add]     |
|      |  +--------+ +--------+ +--------+                   |
|      |  |Planner | |Coder   | |Tester  |                   |
|      |  +--------+ +--------+ +--------+                   |
|      |  +--------+ +--------+                              |
|      |  |Designer| |Reviewer|                              |
|      |  +--------+ +--------+                              |
|      |                                                     |
|      |  Workflow Templates                       [Add]     |
|      |  +------------+ +---------+ +----------+            |
|      |  |Full Feature| |Bug Fix  | |Refactor  |            |
|      |  +------------+ +---------+ +----------+            |
|      |                                                     |
|      |  GitHub Accounts                          [Add]     |
|      |  +----------+                                       |
|      |  | richard  |                                       |
|      |  +----------+                                       |
+------+-----------------------------------------------------+
| Status Bar                                                 |
+------------------------------------------------------------+
```

### Behavior

- No sidebar, no inspector -- full-width scrollable page
- Anchor menu sticky at top: `[General] [Repos] [Agents] [Templates] [GitHub]`
  - Click to jump-to-section
  - Highlight active section on scroll (intersection observer)
- Opens as tab on toolbar: `SettingsTab` (id: `settings-{projectId}`)
- Each section is a bento group with section header + action button (Add)
- Cards use existing `bento-cell` styles
- Access: right-click project icon on rail -> Settings, or Cmd+K -> "Settings"
- Reuse existing components: ProjectRepositories, ProjectAgents, GitHubAccounts cards

---

## 6. Store Changes

### New: Rail / Project Store

```typescript
interface ProjectNavStore {
  activeProjectId: string | null        // Which project is selected on rail
  projectOrder: string[]                // Order of projects on rail
  setActiveProject(id: string): void
  reorderProjects(ids: string[]): void  // Drag-to-reorder (nice-to-have)
}
```

### Modified: Tab Store

```typescript
// Before: flat array
interface TabStore {
  tabs: AppTab[]
  activeTabId: string
}

// After: scoped per project
interface TabStore {
  tabsByProject: Map<string, AppTab[]>  // projectId -> tabs
  activeTabByProject: Map<string, string> // projectId -> activeTabId
  openTicketTab(projectId, ticketId, label): void
  openSettingsTab(projectId): void
  closeTab(projectId, tabId): void
  setActiveTab(projectId, tabId): void
}
```

### Modified: Sidebar Store

```typescript
// Remove activeNav (no longer needed -- settings is a separate page)
interface SidebarStore {
  isOpen: boolean
  toggle(): void
}
```

### Removed Tab Types

- `BrainstormTab` -- brainstorm is now a workflow step inside ticket
- `FigmaImportTab` -- figma is now a workflow step or ad-hoc inspector view

### New Tab Type

- `SettingsTab` -- `{ type: 'settings', projectId: string }`

---

## 7. Component Hierarchy

```
AppShell
+-- Rail (new)
|   +-- RailHomeButton
|   +-- RailProjectList
|   |   +-- RailProjectIcon (per project)
|   +-- RailAddButton
+-- AppLayout (modified)
    +-- Toolbar (modified: tabs scoped to active project)
    |   +-- TabBar (reads from tabsByProject[activeProjectId])
    +-- Sidebar (unchanged structure, new visibility rules)
    |   +-- TicketSidebar (workflow steps + sessions)
    +-- MainContent
    |   +-- TabContent (modified router)
    |       +-- HomeScreen (new: dashboard with mock data)
    |       +-- ProjectScreen (simplified: kanban only)
    |       +-- TicketScreen (modified: + session view)
    |       |   +-- TicketOverview (existing)
    |       |   +-- SessionView (new)
    |       |       +-- SessionTranscript
    |       |       |   +-- TextMessage
    |       |       |   +-- ToolCallMessage (collapsed)
    |       |       |   +-- SubagentMessage (collapsed)
    |       |       |   +-- TodoListMessage (collapsed)
    |       |       |   +-- SkillMessage (collapsed)
    |       |       |   +-- ErrorMessage
    |       |       +-- BrainstormView (when brainstorm step active)
    |       |           +-- ChatMessages
    |       |           +-- QuizComponent
    |       |           +-- TiptapEditor
    |       +-- SettingsScreen (new: consolidated)
    |           +-- SettingsAnchorMenu (sticky)
    |           +-- GeneralSection
    |           +-- RepositoriesSection (reuse existing)
    |           +-- AgentsSection (reuse existing)
    |           +-- TemplatesSection
    |           +-- GitHubSection (reuse existing)
    +-- Inspector (modified: message details, figma viewer)
    |   +-- MessageDetailPanel (new)
    |   +-- FigmaViewerPanel (ad-hoc)
    +-- StatusBar (unchanged)
```

---

## Design Constraints

All UI must follow `docs/design/design-system.md`:

- **Bento grid** for all card layouts (`bento-grid-2/3/4`, `bento-cell`, `bento-cell-lg`)
- **Glass panel** on chrome elements (rail, toolbar, sidebar, status bar, input bars)
- **Color tokens** from design system (no ad-hoc colors)
- **Typography** from design system (Inter + JetBrains Mono, specified sizes/weights)
- **Spacing** on 4px base grid
- **Border radius** per component type (6px buttons, 12px bento cells, etc.)
- **Shadows** per elevation level (`--shadow-sm/md/lg`)
- **Transitions** 150ms+ for hover, 200ms for panels
- **Icons** from Lucide React only
- **Anti-patterns** from design system checklist strictly avoided
