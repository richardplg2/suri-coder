# Component System

Built in `@agent-coding/ui` package. Radix UI primitives + CVA variants. Lucide icons throughout.

**Import:** `import { ComponentName } from '@agent-coding/ui'`

> **Design Reference:** See `.stitch/designs/` for visual screenshots of each screen.

---

## Core Layout Components

### Rail

**Purpose:** Fixed vertical navigation for switching between Home and projects.
**macOS Reference:** Xcode project navigator icons

| Property | Value |
|----------|-------|
| Width | 48px fixed |
| Background | Glass panel (`glass-bg` + `backdrop-blur-xl`) |
| Border | Right `border-border/50` |
| Padding | 8px vertical |

**Children:**
| Component | Size | Description |
|-----------|------|-------------|
| `RailHomeButton` | 32x32 | LayoutDashboard icon, active = accent highlight |
| `RailProjectAvatar` | 32x32, rounded-lg | 2-letter initials, active = 3px accent bar left |
| `RailAddButton` | 32x32 | "+" icon at bottom of list |

**States:** Home active (accent icon), Project active (accent bar), Project hover (tooltip)
**Allowed Usage:** AppLayout root, always visible, not collapsible.

---

### Toolbar (Header)

**Purpose:** Top bar with window controls, tab bar, and global actions.
**macOS Reference:** Native toolbar with `titleBarStyle: hiddenInset`

| Property | Value |
|----------|-------|
| Height | 36px |
| Background | Glass panel |
| Border | Bottom `border-border/50` |
| Drag region | `-webkit-app-region: drag` |

**Variants:**
- With tabs (project context — tabs scoped by `activeProjectId`)
- Without tabs (Home context — tab bar hidden)

**Children:**
| Component | Position | Description |
|-----------|----------|-------------|
| `TrafficLights` | Left | macOS red/yellow/green (12px circles) |
| `TabBar` | Center | Tabs scoped by project, closable |
| `ToolbarActions` | Right (`no-drag`) | Search (Cmd+K), Bell, Theme toggle |

**States:** Tab active (blue text), Tab hover (surface-hover), Tab close (X on hover)
**Allowed Usage:** AppLayout root, always rendered.

---

### Content Container

**Purpose:** Flexible main content area between sidebar and inspector.

| Property | Value |
|----------|-------|
| Width | Flexible (fills remaining) |
| Background | `bg` (#1E1E1E) |
| Overflow | Scroll vertical |

**Variants:**
- Full-width (Home, Kanban, Settings — no sidebar/inspector)
- With sidebar (Ticket detail — 240px sidebar left)
- With sidebar + inspector (Sessions with file preview — 320px inspector right)

**Allowed Usage:** AppLayout main area.

---

### Sidebar

**Purpose:** Context-dependent left panel showing workflow steps.
**macOS Reference:** Finder sidebar

| Property | Value |
|----------|-------|
| Width | 240px |
| Background | Glass panel |
| Border | Right `border-border/50` |
| Toggle | Cmd+B |

**Visibility Logic:**
| Context | Visible |
|---------|---------|
| Home | Hidden |
| Kanban | Hidden |
| Settings | Hidden |
| Ticket detail | **Visible** |

**Children:** `WorkflowStepList` → `WorkflowStepItem[]` (expandable with nested sessions)
**Allowed Usage:** AppLayout, conditional on active tab type.

---

### Inspector

**Purpose:** Right panel for detailed content preview.

| Property | Value |
|----------|-------|
| Width | 320px |
| Background | `surface` (#252526) |
| Border | Left `border-border/50` |
| Animation | 200ms ease slide in/out |
| Toggle | Cmd+I |

**Variants:**
| Variant | Content |
|---------|---------|
| `FilePreview` | Syntax-highlighted code + line numbers + breadcrumb path |
| `MessageDetailPanel` | Full detail of clicked collapsed message |
| `FigmaViewerPanel` | Figma design viewer (ad-hoc via Cmd+K) |
| `DiffViewer` | Code diff (old → new) |

**States:** Open (slide-in), Closed (hidden, default)
**Allowed Usage:** AppLayout, triggered by clicking collapsed messages or Cmd+K.

---

### StatusBar

**Purpose:** Bottom info bar with connection status and session metrics.

| Property | Value |
|----------|-------|
| Height | 28px |
| Background | Glass panel |
| Border | Top `border-border/50` |
| Font | Caption (11px) |

**Content:**
- Left: Connection dot (green/red) + status text + backend version
- Right: Active session info + duration + token count + cost

**Allowed Usage:** AppLayout root, always rendered.

---

## Form Components

### Button

**Purpose:** Primary interactive trigger.
**macOS Reference:** NSButton

| Property | Value |
|----------|-------|
| Padding | 6px 16px |
| Border radius | 6px |
| Font | 13px / 500 weight |
| Transition | 150ms ease |
| Cursor | pointer |

**Variants:**
| Variant | Background | Text | Border | Usage |
|---------|-----------|------|--------|-------|
| `primary` | `accent` (#0A84FF) | white | none | Main CTAs |
| `secondary` | `surface` | `text` | 1px `border` | Cancel, secondary actions |
| `destructive` | `destructive` (#FF453A) | white | none | Delete, reject |
| `ghost` | transparent | `text-secondary` | none | Toolbar icons, subtle actions |
| `icon` | transparent | `text-secondary` | none | Icon-only (close, menu) |

**States:** Default → Hover (lighter) → Active (pressed) → Focus (accent ring 3px) → Disabled (50% opacity)
**Allowed Usage:** Forms, modals, toolbars, card actions, anywhere.

---

### Input

**Purpose:** Text entry field.
**macOS Reference:** NSTextField

| Property | Value |
|----------|-------|
| Padding | 6px 10px |
| Border | 1px `border` (#3C3C3C) |
| Border radius | 6px |
| Background | `surface` (#252526) |
| Font | 13px / 400 |

**Variants:** Text input, Textarea (multi-row), With icon (folder picker, search)
**States:** Default → Focus (accent border + `box-shadow: 0 0 0 3px rgba(10,132,255,0.2)`) → Error (destructive border) → Disabled
**Allowed Usage:** Forms, modals, search bars, inline editing.

---

### Select

**Purpose:** Dropdown selection.
**macOS Reference:** NSPopUpButton

| Property | Value |
|----------|-------|
| Padding | 6px 10px |
| Border | 1px `border` |
| Border radius | 6px |
| Background | `surface` |
| Icon | Chevron-down (right) |

**Variants:** Default, With color dot (priority), With badge (ticket type)
**States:** Default → Open (dropdown visible) → Focus (accent ring) → Disabled
**Allowed Usage:** Forms, modals, filter controls.

---

### Checkbox

**Purpose:** Multi-select toggle.

| Property | Value |
|----------|-------|
| Size | 16x16 |
| Border | 1px `border`, 4px radius |
| Checked bg | `accent` with white checkmark |

**Variants:** Standalone, With label, Card checkbox (brainstorm multi-select — full card clickable)
**States:** Unchecked → Checked (blue + check) → Indeterminate (dash) → Disabled
**Allowed Usage:** Task lists, brainstorm multi-select, settings, filters.

---

### Toggle (Switch)

**Purpose:** Binary on/off switch.
**macOS Reference:** System Preferences toggle

| Property | Value |
|----------|-------|
| Size | 36x20 |
| Radius | 9999px |
| ON | `accent` bg, thumb right |
| OFF | `border` bg, thumb left |
| Thumb | 16px white circle |

**Variants:** Standalone, With label (label left + toggle right)
**States:** ON → OFF → Disabled (50% opacity)
**Allowed Usage:** Settings forms, preference toggles.

---

## Data Components

### Table

**Purpose:** Compact data rows.
**macOS Reference:** Finder list view

| Property | Value |
|----------|-------|
| Row height | 32px |
| Padding | 0 12px |
| Font | 13px |
| Border | Bottom 1px `border` per row |

**Variants:**
- Simple list (Recent Activity — no header, timestamp right-aligned)
- DataTable (Kanban list view — sortable column headers)

**States:** Row hover (`surface-hover`), Row selected (`selection` bg), Even row (2% white tint)
**Allowed Usage:** Home recent activity, kanban list view, task checklists.

---

### Card (Bento Cell)

**Purpose:** Elevated content container for grid layouts.

| Variant | Radius | Padding | Background | Usage |
|---------|--------|---------|-----------|-------|
| `bento-cell` | 12px | 16px | `surface-elevated` | Standard (tickets, specs, repos, agents) |
| `bento-cell-lg` | 16px | 24px | `surface-elevated` | Hero/featured cards |
| `add-card` | 12px | 16px | transparent, dashed border | Add new item trigger |
| `kanban-card` | 12px | 12px | `surface-elevated` | Compact ticket card in column |

**Border:** 1px `border` (#3C3C3C). Shadow on hover: `shadow-md`.
**States:** Default → Hover (shadow elevation) → Selected (accent border)
**Allowed Usage:** All bento grid layouts.

---

### Badge

**Purpose:** Small status/type label.

| Property | Value |
|----------|-------|
| Padding | 3px 8px |
| Radius | 9999px (pill) |
| Font | 10-11px / 500, uppercase |

**Variants:**
| Category | Variants |
|----------|----------|
| Ticket type | `feature` (blue), `bug` (red), `refactor` (teal), `chore` (gray), `spike` (purple) |
| Status | `in_progress` (yellow), `review_pending` (yellow), `completed` (green), `running` (green), `failed` (red), `needs_input` (blue) |
| Version | `v1`, `v2`, `v3` (blue) |
| Session | `completed` (green), `running` (green pulse) |

**Color Pattern:** `{color}20` background (20% opacity) + `{color}` text.
**States:** Static (no interaction).
**Allowed Usage:** Ticket cards, headers, sessions, settings — anywhere status needed.

---

## Navigation Components

### Tabs

**Purpose:** Switch between content views.

**Variants:**
| Variant | Location | Active Style |
|---------|----------|-------------|
| Toolbar tabs | Toolbar center | Blue text, close X |
| Segmented control | Ticket detail | Blue text, blue bottom border 2px |
| Anchor nav | Settings | Blue text, blue bottom border 2px, intersection observer |

**States:** Active (accent + indicator) → Inactive (muted) → Hover (text lightens)
**Allowed Usage:** Toolbar, ticket detail, settings.

---

### Breadcrumb

**Purpose:** File path display in inspector.

| Property | Value |
|----------|-------|
| Font | 12px / 400, `text-secondary` |
| Separator | " / " (muted) |
| Last segment | `text-primary` (emphasized) |

**Allowed Usage:** Inspector panel header.

---

## Specialized Components

### WorkflowStepItem

**Purpose:** Step in the workflow sidebar.

**Status Icons:**
| Status | Icon | Color |
|--------|------|-------|
| Completed | `CheckCircle` | `success` (#32D74B) |
| Active | `Circle` (filled) | `accent` (#0A84FF) |
| Running | `Loader2` (spinning) | `accent` |
| Failed | `XCircle` | `destructive` (#FF453A) |
| Pending | `Circle` (empty) | `text-secondary` |

**States:** Active (selection bg), Completed (muted), Expandable (chevron → nested sessions)

---

### SessionMessage

**Purpose:** Message row in session transcript.

| Type | Icon | Height | Detail |
|------|------|--------|--------|
| Text (Assistant) | — | Auto | Full markdown inline |
| Tool: Read/Edit/Write | `File` | 32px | Collapsed: icon + filename + "Read"/"Edit"/"Write" |
| Tool: Bash | `Terminal` | 32px | Collapsed: icon + command + "Bash" + success/fail badge |
| Subagent | `Bot` | 32px | Collapsed: icon + "Subagent: [desc]" |
| Todo | `CheckSquare` | 32px | Collapsed: icon + "Todo: N/M done" + mini progress bar |
| Skill | `Sparkles` | 32px | Collapsed: icon + "Skill: [name]" |
| Error | `AlertCircle` | 32px | Collapsed: icon + error summary, red bg tint |

**States:** Default → Hover (surface-hover) → Selected (3px blue left border + selection bg → opens in inspector)

---

### SessionHeader

**Purpose:** Collapsible header per session block.

**Content:** Step name + "Session #N" + status badge + duration + tokens + cost + chevron
**States:** Expanded → Collapsed → Active (green running badge) → Completed (muted)

---

### QuizOption

**Purpose:** Selectable option in brainstorm questions.

| Property | Value |
|----------|-------|
| Padding | 12px |
| Border | 1px `border` |
| Radius | 8px |
| Background | `surface` |

**Variants:** Single-select (radio), Multi-select (checkbox), With "Recommended" badge
**States:** Default → Hover (surface-hover) → Selected (accent border + selection bg + filled indicator)

---

### PriorityDot

**Purpose:** Color-coded priority indicator (8px circle).

| Priority | Color |
|----------|-------|
| Critical | `#FF453A` |
| High | `#FF9F0A` |
| Medium | `#FFD60A` |
| Low | `#32D74B` |

**Allowed Usage:** Kanban cards, ticket headers, priority selects.

---

## Grid Layout Classes

| Class | Columns | Usage |
|-------|---------|-------|
| `bento-grid-2` | 2, 12px gap | Settings repos/GitHub, specs grid |
| `bento-grid-3` | 3, 12px gap | Home dashboard, agents, templates |
| `bento-grid-4` | 4, 12px gap | Dashboard metrics |
| `bento-span-2` | Span 2 cols | Hero/featured cards |
| `bento-span-row-2` | Span 2 rows | Tall content |
| `glass-effect` | — | Frosted glass: `backdrop-filter: blur(20px)`, semi-transparent |

---

## Component Hierarchy

```
AppLayout
├── Rail
│   ├── RailHomeButton
│   ├── RailProjectAvatar[]
│   └── RailAddButton
├── Toolbar
│   ├── TrafficLights
│   ├── TabBar → Tab[]
│   └── ToolbarActions
├── Sidebar (conditional: ticket context)
│   └── WorkflowStepList → WorkflowStepItem[]
├── ContentContainer
│   ├── HomeView
│   │   ├── BentoGrid-3 → Card[] (Needs Attention)
│   │   ├── BentoGrid-3 → Card[] (Running Now)
│   │   └── Table (Recent Activity)
│   ├── KanbanView
│   │   ├── KanbanColumn[] → KanbanCard[] (Board)
│   │   └── DataTable (List toggle)
│   ├── TicketDetailView
│   │   ├── TicketHeader → Badge[], Title
│   │   ├── SegmentedControl (Overview | Sessions)
│   │   ├── OverviewTab
│   │   │   ├── Description
│   │   │   ├── BentoGrid-2 → SpecCard[]
│   │   │   ├── FigmaReferences
│   │   │   ├── TaskChecklist → Checkbox[]
│   │   │   └── ActivityTimeline
│   │   └── SessionsTab
│   │       └── SessionBlock[]
│   │           ├── SessionHeader
│   │           └── SessionMessage[]
│   ├── BrainstormView
│   │   ├── ChatMessage[]
│   │   ├── QuizQuestion → QuizOption[]
│   │   ├── SummaryEditor (Tiptap)
│   │   └── InputBar (glass)
│   └── SettingsView
│       ├── AnchorNav (Tabs)
│       ├── GeneralForm → Input[], Toggle
│       └── BentoGrid → Card[] (per section)
├── Inspector (conditional)
│   ├── FilePreview → Breadcrumb + CodeBlock
│   ├── MessageDetailPanel
│   └── DiffViewer
├── StatusBar
└── Modals
    ├── CreateProjectModal → Input[], Button[]
    ├── CreateTicketModal → Input[], Select[], Button[]
    └── DeleteProjectModal → Input, Button(destructive)
```
