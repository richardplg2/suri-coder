---
name: feature-design
description: Design screens and features for the Workflow Manager app following the established macOS-style design system. Use this skill whenever designing a new screen, page, feature, or UI flow — whether it's a single screen ("design the Settings page") or a multi-screen feature ("design the Figma Pipeline"). Also use when the user says "design", "wireframe", "layout", "screen design", "page design", or wants to plan UI before implementation. Always use this before building any new screen or feature UI.
---

# Feature Design Skill

Design screens and features for the Claude Code Workflow Manager, following the established macOS-native design system.

## Context

This app is an Electron desktop tool with a macOS-native feel (Xcode/Tower/TablePlus style). Before designing, read these files to ground yourself in the existing system:

1. **Design System** — `docs/design/design-system.md` — colors, typography, spacing, component specs
2. **App Shell** — `docs/design/app-shell.md` — layout structure, sidebar, toolbar, electron config, shortcuts
3. **Components** — `docs/design/components.md` — component catalog with macOS references
4. **Existing screens** — `docs/design/pages/*.md` — one file per feature screen

The app uses a **3-panel layout**: Sidebar (240px) + Main Content + Inspector (320px, collapsible). All screens live within this shell — the sidebar and toolbar are shared, only the main content and inspector change per feature.

## Process

### Step 1: Understand the Feature

Read the user's request and determine:
- **Scope**: single screen or multi-screen feature?
- **Data**: what entities/models does this screen display or manipulate?
- **User flows**: what actions can the user take? What are the states (empty, loading, populated, error)?
- **Existing context**: check `docs/plans/` for any feature plan that describes the backend/data model

If the feature has an existing plan doc (e.g., `docs/plans/2026-03-06-feature-N-*.md`), read it first to understand the data model and user flows.

### Step 2: Check Existing Screens

Read existing screen files in `docs/design/pages/` to see the established screen designs. Your new screen should be **consistent** with these patterns:
- Same sidebar, toolbar, and status bar
- Same component vocabulary (DataTable, SourceList, SegmentedControl, etc.)
- Same density (32px rows, 13px body text, 6px radius buttons)

### Step 3: Design the Screen(s)

For each screen, produce:

#### A. ASCII Wireframe

Use the established 3-panel format. The sidebar is shared — only show the main content and inspector areas changing.

```
┌────────┬──────────────────────────────┬─────────────────┐
│Sidebar │  [Header / Controls]         │   Inspector     │
│        ├──────────────────────────────┤                  │
│        │                              │  [Context info]  │
│ (shared│  [Main content area]         │                  │
│  nav)  │                              │  [Actions]       │
│        │                              │                  │
│        │  [Bottom actions / inputs]   │                  │
│        ├──────────────────────────────┤                  │
│        │  StatusBar                   │                  │
└────────┴──────────────────────────────┴─────────────────┘
```

#### B. Component Mapping

List every component used in the screen, mapping to the component catalog:

| Area | Component | Props/Config | Notes |
|------|-----------|-------------|-------|
| Header | `SegmentedControl` | items: ["Tab1", "Tab2"] | View switcher |
| Content | `DataTable` | columns: [...], rowHeight: 32 | Sortable, selectable |
| Inspector | `KVRow` | label, value pairs | Session metadata |

Only use components from the catalog in `docs/design/components.md`. If you need a new component, explicitly call it out as **[NEW]** with a description and macOS reference.

#### C. States

Define the key states for the screen:
- **Empty**: what shows when there's no data? (use `EmptyState` component)
- **Loading**: skeleton or spinner?
- **Populated**: the main wireframe above
- **Error**: how are errors displayed? (inline `Toast` or in-content message?)

#### D. Interactions

List key user interactions:
- Keyboard shortcuts (follow existing patterns from the spec)
- Click/hover behaviors
- Drag interactions (if any, e.g., SplitPane resize)

### Step 4: Save the Design

Save the design to `docs/design/pages/<feature-name>.md`.

For multi-screen features, use one file with sections per screen:
```
docs/design/pages/settings.md        (single screen)
docs/design/pages/figma-pipeline.md  (multi-screen: setup, map, generate, review)
```

### Output File Template

```markdown
# <Feature Name> — Screen Design

> Overrides: This file extends `docs/design/design-system.md`.
> Any rules here take precedence over the base design system for this feature.

## Overview

Brief description of what this screen/feature does and its primary user flow.

## Screen: <Screen Name>

### Wireframe

(ASCII art here)

### Component Mapping

| Area | Component | Props/Config | Notes |
|------|-----------|-------------|-------|

### States

- **Empty**: ...
- **Loading**: ...
- **Error**: ...

### Interactions

| Action | Trigger | Behavior |
|--------|---------|----------|
| ... | ... | ... |

### Design Overrides (if any)

Any deviations from the base design system for this specific screen.
For example, a wider inspector panel, custom colors for status indicators, etc.
```

## Component Quick Reference

When designing, prefer these components (from the established catalog):

**Navigation**: Sidebar, SidebarItem, ProjectSwitcher, Toolbar, SegmentedControl, Breadcrumb
**Data**: DataTable (32px rows), SourceList (tree), StatusBadge (pill+dot), EmptyState, KVRow
**Input**: SearchField, CommandPalette (Cmd+K), TextArea, Select, Toggle
**Feedback**: Sheet (slide-down), Popover, Toast (top-right), ProgressBar, Spinner
**Session**: ChatBubble, StreamingText, ToolCallCard, CostBadge, SessionStatusBar
**Code**: DiffViewer, CodeBlock, InlineComment, FileTree
**Layout**: SplitPane (resizable), Panel (header+content), TabBar (closable tabs)

## Design Principles

- **Compact density** — 32px row heights, 13px body text, tight spacing
- **Single accent color** — system blue (#0A84FF dark / #007AFF light) for active states
- **Neutral grays** — keep the UI quiet, let content stand out
- **Sheets over modals** — use Sheet for non-blocking actions, reserve modals for destructive confirmations
- **Keyboard-first** — every action should have a shortcut
- **Progressive disclosure** — show summary first, expand for details (e.g., ToolCallCard)
