# File Review — Screen Design

> Overrides: This file extends `docs/design/design-system.md`.

## Overview

AI-powered code review workflow. Select a branch, auto-generate AI comments on diffs, then approve, reject, or fix per file with interactive Q&A.

## Wireframe

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

## Layout Override

This screen uses a **custom 2-panel split** within the main content area (no inspector panel):
- Left: `FileTree` (200px, resizable via `SplitPane`)
- Right: `DiffViewer` (remaining width)

## Component Mapping

| Area | Component | Props/Config | Notes |
|------|-----------|-------------|-------|
| Header | `Select` | Branch dropdown | Lists branches/commits |
| Header | `Button` | "Start Review" | Triggers AI review |
| Left panel | `FileTree` | files with status icons | ● modified, + added, - deleted |
| Right panel | `DiffViewer` | unified or side-by-side | Syntax highlighted, line numbers |
| Inline | `InlineComment` | AI annotation | Anchored to diff line |
| Comment actions | `Button` group | Reply, Fix, Dismiss | Per-comment actions |
| Left footer | `Button` | "Approve", "Reject" | Per-file review actions |

## File Status Icons

| Icon | Color | Meaning |
|------|-------|---------|
| ● | `--warning` | Modified file |
| + | `--success` | Added file |
| - | `--destructive` | Deleted file |
| ○ | `--text-secondary` | Unchanged (context) |

## States

- **Empty**: `EmptyState` — "Select a branch to start reviewing"
- **Loading review**: `ProgressBar` + "AI is reviewing files..." with per-file progress
- **Reviewing**: FileTree + DiffViewer with inline AI comments
- **File approved**: File icon changes to checkmark (green)
- **File rejected**: File icon changes to X (red)
- **All reviewed**: Summary banner at top with approve/reject counts

## Interactions

| Action | Trigger | Behavior |
|--------|---------|----------|
| Select branch | Branch dropdown | Load changed files into FileTree |
| Start review | Click "Start Review" | Spawn Claude session per file for AI comments |
| Select file | Click in FileTree | Show diff in DiffViewer |
| Reply to comment | Click Reply | Expand inline `TextArea` for Q&A with Claude |
| Fix suggestion | Click Fix | Navigate to Sessions with fix context |
| Dismiss comment | Click Dismiss | Fade out the InlineComment |
| Approve file | Click Approve | Mark file as approved, update icon |
| Reject file | Click Reject | Mark file as rejected, update icon |
| Toggle diff mode | Toolbar button | Switch unified / side-by-side |
