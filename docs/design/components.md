# Component System

Built in `@agent-coding/ui` package. Radix UI primitives + CVA variants. Lucide icons throughout.

## Navigation

| Component | Description | macOS Reference |
|-----------|-------------|-----------------|
| `Sidebar` | Collapsible nav, vibrancy blur, icon+label items, section groups | Finder sidebar |
| `SidebarItem` | Nav item: icon, label, badge count, active highlight (accent bg) | Source list row |
| `ProjectSwitcher` | Dropdown: project avatar + name + path | Xcode project selector |
| `Toolbar` | Translucent bar, drag region, action buttons | Native toolbar |
| `SegmentedControl` | Tab-like toggle for view switching | NSSegmentedControl |
| `Breadcrumb` | Path display in content header | Finder path bar |

## Data Display

| Component | Description | macOS Reference |
|-----------|-------------|-----------------|
| `DataTable` | Sortable, compact rows (32px), alternating row tint | Finder list view |
| `SourceList` | Tree list with expand/collapse, icons, disclosure triangles | Xcode navigator |
| `StatusBadge` | Pill with colored dot (running/passed/failed/pending) | Activity Monitor |
| `EmptyState` | Centered icon + message + CTA button | Mail empty inbox |
| `KVRow` | Key-value pair row for inspector panels | System Info rows |

## Input

| Component | Description | macOS Reference |
|-----------|-------------|-----------------|
| `SearchField` | Rounded search, Cmd+K shortcut, inline icon | Spotlight bar |
| `CommandPalette` | Full overlay: fuzzy search, keyboard nav, categories | Spotlight / Raycast |
| `TextArea` | Auto-resize for prompts, shift+enter for newline | Notes.app |
| `Select` | Dropdown with option groups | NSPopUpButton |
| `Toggle` | macOS-style switch toggle | System Preferences |

## Feedback

| Component | Description | macOS Reference |
|-----------|-------------|-----------------|
| `Sheet` | Slide-down panel from toolbar, not blocking modal | macOS Sheets |
| `Popover` | Small contextual popup on click | NSPopover |
| `Toast` | Top-right notification, auto-dismiss 4s | Notification Center |
| `ProgressBar` | Thin accent-colored bar | Safari loading |
| `Spinner` | Small circular spinner, inline | NSProgressIndicator |

## Session-Specific

| Component | Description |
|-----------|-------------|
| `ChatBubble` | User (right, accent tint) / Assistant (left, surface bg) |
| `StreamingText` | Typing cursor + text reveal animation |
| `ToolCallCard` | Expandable: tool name + icon, params (collapsed), result |
| `CostBadge` | Small pill: dollar icon + amount |
| `SessionStatusBar` | Status dot + duration + token count + cost |

## Code & Review

| Component | Description |
|-----------|-------------|
| `DiffViewer` | Side-by-side or unified, syntax highlighted, line numbers |
| `CodeBlock` | Syntax highlight + copy button + language label |
| `InlineComment` | AI annotation anchored to diff line, with reply/fix/dismiss |
| `FileTree` | Expandable tree with status icons (modified/added/deleted) |

## Layout

| Component | Description |
|-----------|-------------|
| `SplitPane` | Resizable horizontal/vertical split with drag handle (4px) |
| `Panel` | Content area with optional header bar + toolbar |
| `TabBar` | macOS-style tabs for multiple sessions, closable |
