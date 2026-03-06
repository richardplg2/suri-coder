# Claude Code Workflow Manager — UI Design Spec

## Design Direction

macOS-native desktop app feel, combining System Preferences structure (A) with Xcode/Tower app patterns (B). Dark mode primary. Developer power-user tool density.

References: Xcode, Tower (Git), TablePlus, macOS Finder.

## App Shell & Layout

```
┌─────────────────────────────────────────────────────────┐
│ ● ● ●  [Traffic Lights]     Toolbar (translucent)       │
├────────┬──────────────────────┬──────────────────────────┤
│        │                      │                          │
│  Side  │    Main Content      │   Detail / Inspector     │
│  bar   │    Area              │   Panel (collapsible)    │
│  240px │                      │   320px                  │
│        │  (varies by feature) │  (context-dependent)     │
│  Nav   │                      │                          │
│  items │                      │                          │
│        ├──────────────────────┴──────────────────────────┤
│        │  Bottom Bar (status, session info, cost)        │
└────────┴────────────────────────────────────────────────┘
```

### Sidebar (240px, collapsible to 48px icon-only)

- **Project Selector** at top — dropdown with project avatar + name + path
- **Navigation Groups** with uppercase 11px section headers:
  - Sessions (message-square icon)
  - Skills (sparkles icon)
  - Worktrees (git-branch icon)
  - Figma Pipeline (figma icon)
  - Tests (test-tube-2 icon)
  - Reviews (file-diff icon)
- **Bottom**: settings gear, connection status dot (green/red)
- Vibrancy blur effect on background (`backdrop-filter: blur(20px)`)

### Toolbar (36px height, translucent)

- `titleBarStyle: 'hiddenInset'` for native traffic light integration
- Draggable region (`-webkit-app-region: drag`)
- Right side: search trigger (Cmd+K), notifications bell, theme toggle
- Buttons use `no-drag` to remain clickable

### Detail/Inspector Panel (320px, collapsible)

- Context-dependent content per feature
- Slide in/out with 200ms ease transition
- Toggle via toolbar button or keyboard shortcut

### Bottom Status Bar (28px)

- Left: connection status, backend version
- Right: active session status dot, duration, token count, cost

---

## Design System

### Color Palette

#### Dark Mode (Primary)

| Token | Value | Usage |
|-------|-------|-------|
| `--bg` | `#1E1E1E` | App background |
| `--surface` | `#252526` | Cards, panels |
| `--surface-hover` | `#2D2D2D` | Hover states, elevated cards |
| `--sidebar` | `rgba(27,27,31,0.85)` | Sidebar with vibrancy |
| `--border` | `#3C3C3C` | Dividers, card borders |
| `--text` | `#E5E5E5` | Primary text |
| `--text-secondary` | `#999999` | Muted/label text |
| `--accent` | `#0A84FF` | macOS system blue |
| `--accent-hover` | `#409CFF` | Hover on accent |
| `--success` | `#32D74B` | macOS system green |
| `--warning` | `#FFD60A` | macOS system yellow |
| `--destructive` | `#FF453A` | macOS system red |
| `--selection` | `rgba(10,132,255,0.15)` | Selected row background |

#### Light Mode

| Token | Value | Usage |
|-------|-------|-------|
| `--bg` | `#F5F5F7` | Apple gray background |
| `--surface` | `#FFFFFF` | Cards, panels |
| `--surface-hover` | `#FAFAFA` | Hover states |
| `--sidebar` | `rgba(240,240,240,0.85)` | Sidebar |
| `--border` | `#D1D1D6` | Dividers |
| `--text` | `#1D1D1F` | Primary text |
| `--text-secondary` | `#6E6E73` | Muted text |
| `--accent` | `#007AFF` | macOS system blue |
| `--success` | `#28CD41` | macOS system green |
| `--warning` | `#FFCC00` | macOS system yellow |
| `--destructive` | `#FF3B30` | macOS system red |
| `--selection` | `rgba(0,122,255,0.12)` | Selected row background |

### Typography

**Primary font**: Inter (closest web equivalent to SF Pro)
**Monospace**: JetBrains Mono (code, terminal output)

| Element | Size | Weight | Line Height | Letter Spacing |
|---------|------|--------|-------------|----------------|
| Window Title | 13px | 600 | 1.2 | -0.01em |
| Section Header | 11px | 600 | 1.3 | 0.06em (uppercase) |
| Body | 13px | 400 | 1.5 | -0.008em |
| Label | 12px | 500 | 1.3 | 0 |
| Caption | 11px | 400 | 1.3 | 0 |
| Code | 12px | 400 | 1.5 | 0 (JetBrains Mono) |

### Spacing Scale (4px base)

`4, 8, 12, 16, 20, 24, 32, 40, 48`

### Border Radius

| Element | Radius |
|---------|--------|
| Buttons | 6px |
| Cards / Panels | 8px |
| Modals / Sheets | 10px |
| Input fields | 6px |
| Tags / Badges | 9999px (pill) |

### Shadows

```css
--shadow-sm: 0 1px 2px rgba(0,0,0,0.15);
--shadow-md: 0 4px 12px rgba(0,0,0,0.2);
--shadow-lg: 0 10px 30px rgba(0,0,0,0.25);
```

### Transitions

- Micro-interactions: `150ms ease`
- Panel slide: `200ms ease`
- Page transitions: `250ms ease`
- Respect `prefers-reduced-motion`

---

## Component System

Built in `@agent-coding/ui` package. Radix UI primitives + CVA variants. Lucide icons throughout.

### Navigation

| Component | Description | macOS Reference |
|-----------|-------------|-----------------|
| `Sidebar` | Collapsible nav, vibrancy blur, icon+label items, section groups | Finder sidebar |
| `SidebarItem` | Nav item: icon, label, badge count, active highlight (accent bg) | Source list row |
| `ProjectSwitcher` | Dropdown: project avatar + name + path | Xcode project selector |
| `Toolbar` | Translucent bar, drag region, action buttons | Native toolbar |
| `SegmentedControl` | Tab-like toggle for view switching | NSSegmentedControl |
| `Breadcrumb` | Path display in content header | Finder path bar |

### Data Display

| Component | Description | macOS Reference |
|-----------|-------------|-----------------|
| `DataTable` | Sortable, compact rows (32px), alternating row tint | Finder list view |
| `SourceList` | Tree list with expand/collapse, icons, disclosure triangles | Xcode navigator |
| `StatusBadge` | Pill with colored dot (running/passed/failed/pending) | Activity Monitor |
| `EmptyState` | Centered icon + message + CTA button | Mail empty inbox |
| `KVRow` | Key-value pair row for inspector panels | System Info rows |

### Input

| Component | Description | macOS Reference |
|-----------|-------------|-----------------|
| `SearchField` | Rounded search, Cmd+K shortcut, inline icon | Spotlight bar |
| `CommandPalette` | Full overlay: fuzzy search, keyboard nav, categories | Spotlight / Raycast |
| `TextArea` | Auto-resize for prompts, shift+enter for newline | Notes.app |
| `Select` | Dropdown with option groups | NSPopUpButton |
| `Toggle` | macOS-style switch toggle | System Preferences |

### Feedback

| Component | Description | macOS Reference |
|-----------|-------------|-----------------|
| `Sheet` | Slide-down panel from toolbar, not blocking modal | macOS Sheets |
| `Popover` | Small contextual popup on click | NSPopover |
| `Toast` | Top-right notification, auto-dismiss 4s | Notification Center |
| `ProgressBar` | Thin accent-colored bar | Safari loading |
| `Spinner` | Small circular spinner, inline | NSProgressIndicator |

### Session-Specific

| Component | Description |
|-----------|-------------|
| `ChatBubble` | User (right, accent tint) / Assistant (left, surface bg) |
| `StreamingText` | Typing cursor + text reveal animation |
| `ToolCallCard` | Expandable: tool name + icon, params (collapsed), result |
| `CostBadge` | Small pill: dollar icon + amount |
| `SessionStatusBar` | Status dot + duration + token count + cost |

### Code & Review

| Component | Description |
|-----------|-------------|
| `DiffViewer` | Side-by-side or unified, syntax highlighted, line numbers |
| `CodeBlock` | Syntax highlight + copy button + language label |
| `InlineComment` | AI annotation anchored to diff line, with reply/fix/dismiss |
| `FileTree` | Expandable tree with status icons (modified/added/deleted) |

### Layout

| Component | Description |
|-----------|-------------|
| `SplitPane` | Resizable horizontal/vertical split with drag handle (4px) |
| `Panel` | Content area with optional header bar + toolbar |
| `TabBar` | macOS-style tabs for multiple sessions, closable |

---

## Screen Designs

### 1. Sessions (Main Screen)

```
┌────────┬──────────────────────────────┬─────────────────┐
│Sidebar │  TabBar: [Session 1] [+New]  │   Inspector     │
│        ├──────────────────────────────┤                  │
│ ● Sess │                              │ Session Info     │
│   Skills│  ChatBubble (assistant)     │ - Status: ● run │
│   Trees │  ToolCallCard (collapsed)   │ - Duration: 3m  │
│   Figma │  ChatBubble (user)          │ - Tokens: 12k   │
│   Tests │  StreamingText...           │ - Cost: $0.08   │
│   Review│                              │                  │
│        │                              │ Active Tools     │
│        │                              │ - Read file.ts   │
│        │  ┌──────────────────────┐    │ - Edit main.tsx  │
│        │  │ TextArea + Send btn  │    │                  │
│        ├──┴──────────────────────┴────┤                  │
│ ⚙ Set  │ SessionStatusBar             │                  │
└────────┴──────────────────────────────┴─────────────────┘
```

- TabBar allows multiple concurrent sessions
- Chat area auto-scrolls, ToolCallCards collapse by default
- TextArea: Shift+Enter for newline, Enter to send
- Inspector shows live session metadata + active tool calls

### 2. Skills Management

```
┌────────┬──────────────────────────────┬─────────────────┐
│Sidebar │  SegmentedControl:           │   Skill Editor   │
│        │  [All] [Enabled] [Templates] │                  │
│        ├──────────────────────────────┤  Name: ______   │
│        │                              │  Category: ___  │
│        │  DataTable                   │  Priority: [3]  │
│        │  ┌──┬────────┬─────┬──────┐ │                  │
│        │  │⚡│ TDD    │proc │ ✓ On │ │  ┌────────────┐  │
│        │  │⚡│ Debug  │proc │ ✓ On │ │  │ Markdown    │  │
│        │  │📝│ React  │impl │ ✗ Off│ │  │ Editor     │  │
│        │  │📝│ API    │impl │ ✗ Off│ │  │ (content)  │  │
│        │  └──┴────────┴─────┴──────┘ │  │            │  │
│        │                              │  └────────────┘  │
│        │  [+ New Skill] [Clone]       │  [Save] [Reset]  │
└────────┴──────────────────────────────┴─────────────────┘
```

- DataTable with toggle switches per skill
- Skill Editor in detail panel: metadata fields + markdown editor
- Clone from template creates editable project-specific copy

### 3. Worktree Management

```
┌────────┬──────────────────────────────────────────────────┐
│Sidebar │  Breadcrumb: Project > Worktrees                 │
│        ├──────────────────────────────────────────────────┤
│        │                                                  │
│        │  SourceList                                      │
│        │  ├── main (default)         ● active             │
│        │  ├── feat/session-mgmt      ○ clean              │
│        │  ├── feat/skills-ui         ◐ 3 changes          │
│        │  └── fix/ws-reconnect       ○ clean              │
│        │                                                  │
│        │  ┌─────────────────────────────────────────┐     │
│        │  │ Selected: feat/skills-ui                │     │
│        │  │ Path: /tmp/worktrees/skills-ui           │     │
│        │  │ Branch: feat/skills-ui                   │     │
│        │  │ Status: 3 modified files                 │     │
│        │  │ [Open Session] [Delete Worktree]         │     │
│        │  └─────────────────────────────────────────┘     │
│        │                                                  │
│        │  [+ New Worktree]                                │
└────────┴──────────────────────────────────────────────────┘
```

- SourceList with status indicators per worktree
- Detail card shows selected worktree info
- "Open Session" launches Claude session scoped to that worktree

### 4. Figma Pipeline

```
┌────────┬──────────────────────────────┬─────────────────┐
│Sidebar │  Steps: [1.Setup] [2.Map]    │  Preview Panel  │
│        │         [3.Generate] [4.Rev] │                  │
│        ├──────────────────────────────┤  ┌───────────┐  │
│        │                              │  │ Figma     │  │
│        │  Figma URL: [____________]   │  │ Node      │  │
│        │  Status: ● Connected         │  │ Preview   │  │
│        │                              │  │ (image)   │  │
│        │  Node Mappings:              │  └───────────┘  │
│        │  ┌────────────────────────┐  │                  │
│        │  │ Node: header-nav       │  │  Generated Code  │
│        │  │ Component: Navbar      │  │  ┌───────────┐  │
│        │  │ Props: {links, logo}   │  │  │ CodeBlock │  │
│        │  │ [Edit] [Generate]      │  │  │           │  │
│        │  └────────────────────────┘  │  └───────────┘  │
│        │  [+ Add Node]               │                  │
└────────┴──────────────────────────────┴─────────────────┘
```

- Step indicator (SegmentedControl) guides the pipeline flow
- Node mapping cards are form-based, one per Figma node
- Preview panel shows Figma node image + generated code side by side

### 5. Cypress Testing

```
┌────────┬──────────────────────────────┬─────────────────┐
│Sidebar │ SegmentedControl:            │  Test Detail     │
│        │ [All Runs] [Specs] [Videos]  │                  │
│        ├──────────────────────────────┤  spec: login.cy  │
│        │                              │  Status: ✗ fail  │
│        │  DataTable (test runs)       │  Duration: 4.2s  │
│        │  ┌──┬──────────┬────┬─────┐ │                  │
│        │  │✓ │ login    │2.1s│ pass│ │  Error:           │
│        │  │✗ │ checkout │4.2s│ fail│ │  "Element not     │
│        │  │✓ │ search   │1.8s│ pass│ │   found: #submit" │
│        │  └──┴──────────┴────┴─────┘ │                  │
│        │                              │  Screenshot:     │
│        │  [Run All] [+ Write Test]    │  [image preview] │
│        │                              │  [Video player]  │
│        │                              │  [Fix with AI]   │
└────────┴──────────────────────────────┴─────────────────┘
```

- DataTable with status badges (pass=green, fail=red)
- Detail panel: error message, screenshot, video player
- "Fix with AI" spawns Claude session with test context

### 6. File Review

```
┌────────┬──────────────────────────────────────────────────┐
│Sidebar │  Branch: feat/login  ▼    [Start Review]        │
│        ├────────────┬─────────────────────────────────────┤
│        │ FileTree   │  DiffViewer                         │
│        │            │                                     │
│        │ ├ src/     │  - import { old } from './old'      │
│        │ │ ├●auth.ts│  + import { new } from './new'      │
│        │ │ ├○utils  │                                     │
│        │ │ └+new.ts │    function login() {               │
│        │ └ tests/   │  +   validate(input)  <- AI comment │
│        │   └●login  │  +   await auth()     <- AI comment │
│        │            │                                     │
│        │ Legend:     │  ┌─ AI Comment ──────────────────┐  │
│        │ ● modified │  │ Consider adding error handling │  │
│        │ + added    │  │ for auth() timeout case.       │  │
│        │ - deleted  │  │ [Reply] [Fix] [Dismiss]        │  │
│        │            │  └───────────────────────────────┘  │
│        │ [Approve]  │                                     │
│        │ [Reject]   │                                     │
└────────┴────────────┴─────────────────────────────────────┘
```

- FileTree as secondary sidebar within main content
- DiffViewer with inline AI comments
- Per-file conversation via Reply button
- "Fix" spawns Claude session to implement the suggestion

---

## Electron Window Configuration

```typescript
const mainWindow = new BrowserWindow({
  width: 1440,
  height: 900,
  minWidth: 1024,
  minHeight: 600,
  titleBarStyle: 'hiddenInset',
  trafficLightPosition: { x: 16, y: 12 },
  vibrancy: 'sidebar',                    // macOS only
  backgroundColor: '#1E1E1E',
  webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
  },
})
```

---

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Command Palette | `Cmd+K` |
| New Session | `Cmd+N` |
| Close Tab | `Cmd+W` |
| Toggle Sidebar | `Cmd+B` |
| Toggle Inspector | `Cmd+I` |
| Settings | `Cmd+,` |
| Send Message | `Enter` |
| Newline in Input | `Shift+Enter` |
| Navigate Tabs | `Cmd+1-9` |
| Search in Session | `Cmd+F` |

---

## Implementation Notes

### Tech Stack (existing)

- Electron + electron-vite
- React 19 + React Router
- Tailwind CSS v4
- Radix UI + CVA (via `@agent-coding/ui` package)
- Lucide React icons

### CSS Custom Properties Mapping

Map design tokens to shadcn/ui CSS variable convention in `globals.css`. Override the existing oklch values with the macOS palette defined above.

### Component Build Order

1. Layout primitives: `Sidebar`, `SplitPane`, `Panel`, `Toolbar`
2. Navigation: `SidebarItem`, `ProjectSwitcher`, `TabBar`, `Breadcrumb`
3. Data display: `DataTable`, `SourceList`, `StatusBadge`, `EmptyState`
4. Input: `SearchField`, `CommandPalette`, `TextArea`, `Toggle`
5. Feedback: `Toast`, `Sheet`, `Popover`, `Spinner`
6. Feature-specific: `ChatBubble`, `StreamingText`, `ToolCallCard`, `DiffViewer`, `CodeBlock`
