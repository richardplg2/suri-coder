# Component System

Built in `@agent-coding/ui` package. Radix UI primitives + CVA variants. Lucide icons throughout.

**Import:** `import { ComponentName } from '@agent-coding/ui'`

## Navigation

| Component | Import | Description | macOS Reference |
|-----------|--------|-------------|-----------------|
| `Sidebar` | — | Collapsible nav, vibrancy blur, icon+label items, section groups | Finder sidebar |
| `SidebarItem` | — | Nav item: icon, label, badge count, active highlight (accent bg) | Source list row |
| `ProjectSwitcher` | — | Dropdown: project avatar + name + path | Xcode project selector |
| `Toolbar` | — | Translucent bar, drag region, action buttons | Native toolbar |
| `SegmentedControl` | `SegmentedControl` | Tab-like toggle for view switching | NSSegmentedControl |
| `Breadcrumb` | `Breadcrumb` | Path display in content header | Finder path bar |

## Data Display

| Component | Import | Description | macOS Reference |
|-----------|--------|-------------|-----------------|
| `DataTable` | `DataTable` | Sortable, compact rows (32px), alternating row tint | Finder list view |
| `SourceList` | `SourceList` | Tree list with expand/collapse, icons, disclosure triangles | Xcode navigator |
| `StatusBadge` | `StatusBadge` | Pill with colored dot (running/passed/failed/pending) | Activity Monitor |
| `EmptyState` | `EmptyState` | Centered icon + message + CTA button | Mail empty inbox |
| `KVRow` | `KVRow` | Key-value pair row for inspector panels | System Info rows |

## Input

| Component | Import | Description | macOS Reference |
|-----------|--------|-------------|-----------------|
| `SearchField` | `SearchField` | Rounded search, Cmd+K shortcut, inline icon | Spotlight bar |
| `CommandPalette` | `Command`, `CommandDialog` | Full overlay: fuzzy search, keyboard nav, categories | Spotlight / Raycast |
| `TextArea` | `Textarea` | Auto-resize for prompts, shift+enter for newline | Notes.app |
| `Select` | `Select` | Dropdown with option groups | NSPopUpButton |
| `Toggle` | `Switch` | macOS-style switch toggle | System Preferences |

## Feedback

| Component | Import | Description | macOS Reference |
|-----------|--------|-------------|-----------------|
| `Sheet` | `Sheet` | Slide-down panel from toolbar, not blocking modal | macOS Sheets |
| `Popover` | `Popover` | Small contextual popup on click | NSPopover |
| `Toast` | `Toaster` | Top-right notification, auto-dismiss 4s | Notification Center |
| `ProgressBar` | `Progress` | Thin accent-colored bar | Safari loading |
| `Spinner` | `Spinner` | Small circular spinner, inline | NSProgressIndicator |

## Session-Specific

| Component | Import | Description |
|-----------|--------|-------------|
| `ChatBubble` | `ChatBubble` | User (right, accent tint) / Assistant (left, surface bg) |
| `StreamingText` | `StreamingText` | Typing cursor + text reveal animation |
| `ToolCallCard` | `ToolCallCard` | Expandable: tool name + icon, params (collapsed), result |
| `CostBadge` | `CostBadge` | Small pill: dollar icon + amount |
| `SessionStatusBar` | `SessionStatusBar` | Status dot + duration + token count + cost |

## Code & Review

| Component | Import | Description |
|-----------|--------|-------------|
| `DiffViewer` | `DiffViewer` | Unified diff, syntax highlighted, line numbers |
| `CodeBlock` | `CodeBlock` | Syntax highlight (shiki) + copy button + language label |
| `InlineComment` | `InlineComment` | AI annotation anchored to diff line, with reply/fix/dismiss |
| `FileTree` | `FileTree` | Expandable tree with status icons (modified/added/deleted) |

## Layout

| Component | Import | Description |
|-----------|--------|-------------|
| `SplitPane` | `SplitPane` | Resizable horizontal/vertical split with drag handle (4px) |
| `Panel` | `Panel` | Content area with optional header bar + toolbar |
| `TabBar` | `TabBar` | macOS-style tabs for multiple sessions, closable |

> **—** = Not yet implemented. These are app-shell components to be built in `apps/desktop`.
