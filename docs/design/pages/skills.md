# Skills Management — Screen Design

> Overrides: This file extends `docs/design/design-system.md`.

## Overview

Manage Claude Code skills per project. View all available skills, toggle them on/off, edit content, and clone from templates.

## Wireframe

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

## Component Mapping

| Area | Component | Props/Config | Notes |
|------|-----------|-------------|-------|
| Header | `SegmentedControl` | items: ["All", "Enabled", "Templates"] | Filter view |
| Content | `DataTable` | columns: [icon, name, category, toggle] | 32px rows, selectable |
| Content | `Toggle` | per-row enable/disable | Inline in table |
| Footer | `Button` | "+ New Skill", "Clone" | Primary + secondary variants |
| Inspector | Input fields | name, category, priority | Metadata editor |
| Inspector | `TextArea` / CodeMirror | markdown content | Skill content editor |
| Inspector | `Button` | "Save", "Reset" | Actions |

## States

- **Empty**: `EmptyState` — "No skills yet. Create one or browse templates."
- **Loading**: `Spinner` replacing table content
- **Selected**: Row highlighted with `--selection` bg, inspector shows editor
- **Unsaved changes**: Save button becomes accent-colored, Reset enabled

## Interactions

| Action | Trigger | Behavior |
|--------|---------|----------|
| Select skill | Click row | Highlight row, show editor in inspector |
| Toggle skill | Click Toggle | Enable/disable for current project |
| Filter view | Click SegmentedControl | Filter DataTable rows |
| Save changes | Click Save or Cmd+S | Persist skill content |
| Clone template | Select template + Clone | Create project-specific copy |
| New skill | Click "+ New Skill" | Empty editor in inspector |
