# Layout Redesign — Plan 00: Overview

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restructure the app shell from horizontal tabs to vertical project rail with scoped tabs, consolidated settings, and session view.

**Architecture:** Add a fixed Rail component (48px) on the left edge for project switching. Refactor tab store to scope tabs per project. Simplify project screen to kanban-only, consolidate sub-nav into a single Settings page. Add session transcript view inside ticket detail.

**Tech Stack:** React, Zustand, Tailwind CSS, Lucide icons, existing `@agent-coding/ui` components

**Design Doc:** `docs/plans/2026-03-08-layout-redesign-design.md`

---

## Plan Files

| Plan | Name | Description |
|------|------|-------------|
| 01 | Types + Stores | Foundation: tab types, project nav store, tab store refactor, sidebar store simplify |
| 02 | Rail Component | New Rail UI component with project icons |
| 03 | App Shell | Modified app-layout, app-sidebar, tab-content routing |
| 04 | Home Dashboard | New dashboard screen with mock data |
| 05 | Project + Settings Screens | Simplify project to kanban, new consolidated settings page |
| 06 | Session View + Ticket Update | New session transcript component, ticket screen integration |

## Dependency Graph

```
Plan 01 (Types + Stores)
  ├── Plan 02 (Rail) ──────────────┐
  ├── Plan 04 (Home Dashboard)     ├── Plan 03 (App Shell)
  ├── Plan 05 (Project + Settings) │
  └── Plan 06 (Session View) ──────┘
```

## Parallel Execution Groups

**Group 1 — Foundation (sequential, must be first):**
- Plan 01: Types + Stores

**Group 2 — Independent screens (all parallel after Plan 01):**
- Plan 02: Rail Component
- Plan 04: Home Dashboard
- Plan 05: Project + Settings Screens
- Plan 06: Session View + Ticket Update

**Group 3 — Integration (after Group 2):**
- Plan 03: App Shell (depends on Plan 01 + 02)

## File Impact Summary

| File | Action | Plan |
|------|--------|------|
| `renderer/types/tabs.ts` | Modify | 01 |
| `renderer/stores/use-tab-store.ts` | Rewrite | 01 |
| `renderer/stores/use-sidebar-store.ts` | Simplify | 01 |
| `renderer/stores/use-project-nav-store.ts` | Create | 01 |
| `renderer/components/rail.tsx` | Create | 02 |
| `renderer/components/app-layout.tsx` | Modify | 03 |
| `renderer/components/app-sidebar.tsx` | Modify | 03 |
| `renderer/components/tab-content.tsx` | Modify | 03 |
| `renderer/screens/home.tsx` | Rewrite | 04 |
| `renderer/screens/project.tsx` | Simplify | 05 |
| `renderer/screens/settings.tsx` | Create | 05 |
| `renderer/components/session-view.tsx` | Create | 06 |
| `renderer/components/session-message.tsx` | Create | 06 |
| `renderer/components/inspector-panel.tsx` | Create | 06 |
| `renderer/screens/ticket.tsx` | Modify | 06 |
