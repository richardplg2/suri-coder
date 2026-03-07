# Ticket System — Implementation Plan Overview

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement each plan task-by-task.

**Goal:** Implement the full ticket system with AI brainstorming, spec management, workflow execution, and review UI.

**Design Doc:** [2026-03-08-ticket-system-design.md](./2026-03-08-ticket-system-design.md)

**Architecture:** Backend-orchestrated agents via Claude Agent SDK, streaming via WebSocket to Electron desktop app. Spec-driven development with DB-stored specs, scoped custom tools, and DAG-based workflow engine.

---

## Plan Files (execute in order)

| # | Plan | Description | Dependencies |
|---|------|-------------|-------------|
| 01 | [Data Layer](./2026-03-08-ticket-system-plan-01-data-layer.md) | DB migrations, models, enums, schemas | None |
| 02 | [Notifications](./2026-03-08-ticket-system-plan-02-notifications.md) | Generic notification system (backend + frontend) | Plan 01 |
| 03 | [Spec Management](./2026-03-08-ticket-system-plan-03-spec-management.md) | Specs CRUD, references, custom tools for agents | Plan 01 |
| 04 | [Project Seeding](./2026-03-08-ticket-system-plan-04-project-seeding.md) | Seed agents + templates on project creation | Plan 01 |
| 05 | [Workflow Engine](./2026-03-08-ticket-system-plan-05-workflow-engine.md) | auto_approval, escalation chain, git workspace | Plan 01, 02, 03 |
| 06 | [Brainstorming Backend](./2026-03-08-ticket-system-plan-06-brainstorm-backend.md) | Brainstorm session, agent integration, WebSocket | Plan 01, 03 |
| 07 | [Ticket Detail Frontend](./2026-03-08-ticket-system-plan-07-ticket-detail-ui.md) | Tabs (Overview, Specs, Tasks, Activity), DAG viz | Plan 01, 02, 03 |
| 08 | [Brainstorming Frontend](./2026-03-08-ticket-system-plan-08-brainstorm-ui.md) | Chat UI, Quiz components, Tiptap review editor | Plan 06, 07 |
| 09 | [Review UI](./2026-03-08-ticket-system-plan-09-review-ui.md) | Diff viewer, inline comments, test results panel | Plan 05, 07 |
| 10 | [Figma Integration](./2026-03-08-ticket-system-plan-10-figma-integration.md) | Embed Figma viewer in desktop app | Plan 08 |

## Dependency Graph

```
Plan 01 (Data Layer)
  ├── Plan 02 (Notifications)
  ├── Plan 03 (Spec Management)
  ├── Plan 04 (Project Seeding)
  ├── Plan 05 (Workflow Engine) ← depends 01, 02, 03
  ├── Plan 06 (Brainstorm Backend) ← depends 01, 03
  └── Plan 07 (Ticket Detail UI) ← depends 01, 02, 03
        ├── Plan 08 (Brainstorm UI) ← depends 06, 07
        ├── Plan 09 (Review UI) ← depends 05, 07
        └── Plan 10 (Figma Integration) ← depends 08
```

Plans 02, 03, 04 can be executed in parallel after Plan 01.
Plans 06, 07 can be executed in parallel after their dependencies.
