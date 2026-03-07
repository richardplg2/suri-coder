# Projects & Multi-Context UX Design

Extends the existing [project/ticket/workflow design](2026-03-06-project-ticket-workflow-design.md) with project CRUD UI, tab-based multi-context navigation, and ticket board/detail screens.

## Core Concept

Tab-based navigation lets users work across multiple projects and tickets simultaneously. Each open context (project or ticket) is a tab. The sidebar adapts to the active tab's context.

## Tab System

### Tab types

| Type | Appearance | Closeable | Notes |
|------|-----------|-----------|-------|
| Home | Pinned icon (house) | No | Always present, first position |
| Project | Pinned icon (folder) | Yes | Icon-only, compact (~40px) |
| Ticket | Regular tab | Yes | Shows ticket key + title, shrinkable |

### Tab bar layout

```
[home] [proj] [proj] | [PROJ-1: Auth Feature] [API-3: Fix Bug] [...]
 pinned tabs            regular tabs (shrinkable, closeable)
```

A visual separator divides pinned and regular tabs.

### Overflow behavior

Regular tabs shrink to min-width (~100px) as more open. When space is exhausted, an overflow menu ("...") at the right edge lists hidden tabs.

### Interactions

- Click project card or sidebar item: open/focus project pinned tab
- Click ticket card or sidebar item: open ticket regular tab
- Cmd+W: close active tab (except Home)
- Cmd+1-9: switch to tab by position
- Middle-click tab: close
- Right-click tab: context menu (Close, Close Others, Close All)

## Sidebar (context-adaptive)

The sidebar changes its navigation items based on the active tab.

### Home tab

```
Search [filter projects]

ALL PROJECTS
  MyApp
  API-Core
  Docs

RECENT TICKETS
  PROJ-1
  API-3
  PROJ-5

[Settings]
```

- Project list: click to open/focus project tab
- Recent tickets: click to open ticket tab
- Search filters the project list

### Project tab

```
[Project Name]

MANAGE
  Tickets       (default, board view)
  Agents        (agent configs)
  Templates     (workflow templates)
  Settings      (project edit/delete)

ACTIVE
  PROJ-1        (running tickets, live status)
  PROJ-3

[Settings]
```

### Ticket tab

```
[PROJ-1]
[Auth Feature]

WORKFLOW
  Brainstorm    done
  Design        running
  Code          pending
  Test          pending
  Review        pending

INFO
  Sessions
  Activity

[Settings]
```

Step status icons update in real-time via WebSocket.

## Home Tab: Projects Dashboard

### Layout

Card grid, 3-4 cards per row, responsive. Each card represents one project.

### Project card

```
+-------------------------+
| [color] PROJ-NAME       |  project name + color dot
|                         |
| ~/work/project-path     |  filesystem path
|                         |
| 12 tickets   2 running  |  ticket count + active sessions
| 3m ago                  |  last activity
+-------------------------+
```

Card click opens/focuses the project pinned tab.

### Actions

- "New Project" button (top-right of grid) opens create modal
- Right-click card: context menu (Open, Settings, Delete)

## Project CRUD

### Create

Modal dialog triggered from Home tab "New Project" button.

Fields:
- **Name** (required) - project display name
- **Slug** (required) - auto-generated from name, editable. Used for ticket key prefixes (e.g., "PROJ" produces PROJ-1, PROJ-2)
- **Path** (required) - filesystem path, native file picker button
- **Repo URL** (optional) - git remote URL
- **Description** (optional) - textarea

On submit: create project via API, auto-open new project pinned tab.

### Edit

Accessed via project tab sidebar "Settings" nav item. Renders an inline settings panel in the main content area (not a modal).

Same fields as create. Changes save on blur or explicit "Save" button.

### Delete

Located at the bottom of the Settings panel in a "Danger Zone" section.

"Delete Project" button opens a confirmation dialog. User must type the project name to confirm. Deleting closes the project tab and removes the card from Home.

## Project Tab: Tickets Board

The default view when opening a project tab.

### View modes

Toggle between Kanban and List via icon buttons in the toolbar area. Preference saved per-project (persistent).

### Kanban view

Columns grouped by ticket status: Backlog, Todo, In Progress, In Review, Done.

Drag-and-drop cards between columns to change status.

### Ticket card (on board)

```
+-------------------------+
| [status] PROJ-1  feature|  key + type badge (color-coded)
|                         |
| Auth Login Feature      |  title (max 2 lines, truncate)
|                         |
| ***..**  3/5 steps      |  workflow progress dots
|                         |
| [!] urgent      [avatar]|  priority (color) + assignee
+-------------------------+
```

Type badge colors: feature=blue, bug=red, improvement=green, chore=gray, spike=purple.
Priority colors: urgent=red, high=orange, medium=yellow, low=blue, none=gray.

### List view

Sortable/filterable table with columns: Key, Title, Type, Status, Priority, Progress, Assignee.

### Interactions

- Click card/row: open ticket tab
- Right-click: context menu (Open, Change Status, Change Priority, Delete)
- Filter bar: filter by type, priority, assignee, status
- "New Ticket" button: create ticket (existing API auto-creates workflow steps from template)

## Ticket Tab: Detail + DAG

Two-panel layout within the main content area.

### Left panel: Ticket info + DAG

**Ticket metadata** (top, inline-editable):
- Title (click to edit)
- Description (expandable textarea)
- Type, Priority, Status (dropdowns)
- Assignee, Template, Budget

**DAG visualization** (middle):
- Interactive directed graph. Nodes are workflow steps, edges are dependencies.
- Node appearance reflects status: green=completed, blue=running, yellow=awaiting approval, gray=pending, red=failed.
- Click a node to select it (updates the right inspector panel).

**Activity log** (bottom, scrollable):
- Chronological list: step status changes, costs, timestamps.

### Right panel: Step inspector

Displays details for the selected step (clicked in DAG or sidebar).

Contents:
- Step name + status badge
- Agent config (name, model)
- Git branch name
- Cost + duration
- Action buttons: View Session, Retry, Skip
- File changes list (when in review status)
- Approve / Request Changes buttons (when in review status)

### Interactions

- Click DAG node or sidebar step: select step, show in inspector
- Double-click DAG node: open session view (if session exists)
- Inspector actions trigger workflow engine API calls

## Data Model

No new models required. This design uses the existing Project, Ticket, WorkflowStep models from the [original design](2026-03-06-project-ticket-workflow-design.md).

### Frontend state additions

**Tab store** (Zustand, persistent):
```ts
interface TabStore {
  tabs: Tab[]
  activeTabId: string
  openTab: (tab: Tab) => void
  closeTab: (id: string) => void
  setActiveTab: (id: string) => void
}

type Tab =
  | { id: 'home'; type: 'home' }
  | { id: string; type: 'project'; projectId: string; pinned: true }
  | { id: string; type: 'ticket'; ticketId: string; projectId: string; pinned: false }
```

**Board preference** (per-project, stored in project settings JSON or local Zustand store):
- `viewMode: 'kanban' | 'list'`

## API Usage

All endpoints already defined in the original design. No new endpoints needed.

| Feature | Endpoint |
|---------|----------|
| List projects | GET /projects |
| Create project | POST /projects |
| Update project | PATCH /projects/:id |
| Delete project | DELETE /projects/:id |
| List tickets | GET /projects/:id/tickets |
| Ticket detail | GET /tickets/:id |
| Ticket steps | GET /tickets/:id/steps |
| Step actions | POST /tickets/:id/steps/:step_id/* |
