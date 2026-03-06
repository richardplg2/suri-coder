# Cypress Testing — Screen Design

> Overrides: This file extends `docs/design/design-system.md`.

## Overview

Run and manage Cypress E2E tests. View test results, watch recorded videos, inspect failure screenshots, and use AI to write or fix tests.

## Wireframe

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

## Component Mapping

| Area | Component | Props/Config | Notes |
|------|-----------|-------------|-------|
| Header | `SegmentedControl` | items: ["All Runs", "Specs", "Videos"] | View filter |
| Content | `DataTable` | columns: [status, name, duration, result] | 32px rows, sortable |
| Content | `StatusBadge` | pass (green), fail (red), running (blue) | Inline in table |
| Footer | `Button` | "Run All", "+ Write Test" | Primary actions |
| Inspector | `KVRow` | spec file, status, duration | Test metadata |
| Inspector | Error display | error message text | Monospace, red tint |
| Inspector | Image | screenshot preview | Click to expand |
| Inspector | Video player | native HTML5 video | Cypress recording |
| Inspector | `Button` | "Fix with AI" | Accent, spawns Claude session |

## States

- **Empty**: `EmptyState` — "No test runs yet. Run tests or write a new one."
- **Running**: `ProgressBar` at top + running rows show `Spinner`
- **All passed**: Summary bar with green `StatusBadge` "All tests passed"
- **Has failures**: Failed rows highlighted with subtle red tint

## Interactions

| Action | Trigger | Behavior |
|--------|---------|----------|
| Select test | Click row | Show detail in inspector |
| Run all tests | Click "Run All" | Start Cypress run, stream results |
| Write test | Click "+ Write Test" | Navigate to Sessions with Cypress context |
| Fix with AI | Click "Fix with AI" | Navigate to Sessions with error context |
| View video | Click video player | Play inline or expand to full screen |
| View screenshot | Click image | Expand in `Popover` |
| Filter view | Click SegmentedControl | Switch between runs/specs/videos |
