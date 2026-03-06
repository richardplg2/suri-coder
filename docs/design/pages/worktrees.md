# Worktree Management — Screen Design

> Overrides: This file extends `docs/design/design-system.md`.

## Overview

Manage git worktrees for isolated feature development. View active worktrees, their status, and launch Claude sessions scoped to a specific worktree.

## Wireframe

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

## Component Mapping

| Area | Component | Props/Config | Notes |
|------|-----------|-------------|-------|
| Header | `Breadcrumb` | Project > Worktrees | Path context |
| Content | `SourceList` | tree items with status indicators | Single-level list |
| Content | Detail card | KVRow pairs + action buttons | Shows on selection |
| Footer | `Button` | "+ New Worktree" | Primary action |

## States

- **Empty**: `EmptyState` — "No worktrees. Create one to start isolated work."
- **Loading**: `Spinner` replacing SourceList
- **Selected**: Row highlighted, detail card visible below
- **No inspector**: This screen uses full-width content (no inspector panel)

## Status Indicators

| Icon | Meaning |
|------|---------|
| ● (accent) | Active/checked-out worktree |
| ○ (muted) | Clean, no uncommitted changes |
| ◐ (warning) | Has uncommitted changes (show count) |

## Interactions

| Action | Trigger | Behavior |
|--------|---------|----------|
| Select worktree | Click row | Show detail card with info |
| Open Session | Click button | Navigate to Sessions, scoped to worktree path |
| Delete worktree | Click button | Confirmation Sheet, then delete |
| New worktree | Click "+ New Worktree" | Sheet with branch name input |
