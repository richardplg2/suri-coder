# Claude Code Workflow Manager — Design

## Overview

A personal power-user tool to manage development workflows powered by Claude Code SDK (Python). Centralized backend orchestrates Claude Code sessions, streams output via WebSocket to an Electron desktop app.

## Architecture

```
Desktop App (Electron + React) <-> FastAPI Backend <-> Claude Code SDK
                                        |
                    +-------------------+-------------------+
                    v                   v                   v
                Redis               PostgreSQL          File Storage
              (Queue + PubSub)       (Data)             (assets)
                    |
                ARQ Workers
                (Claude SDK, Cypress runner)
```

### Key decisions

- **ARQ** (async Redis queue) over Celery — native asyncio, fits Claude SDK's async nature.
- **Redis PubSub** bridges workers to FastAPI to WebSocket — workers publish streaming events, FastAPI relays to the correct WebSocket channel.
- **PostgreSQL** stores projects, skills, sessions, review results.
- **File Storage** for Cypress videos/screenshots, Figma assets.

## Current State (as of 2026-03-06)

### Backend — DONE
- **All 20 database models** implemented: User, Project, ProjectMember, Skill, AgentConfig, AgentSkill, WorkflowTemplate, Ticket, WorkflowStep, WorkflowStepDependency, Session, SessionMessage, FigmaTask, FigmaNode, TestRun, TestResult, ReviewSession, FileReview
- **8 routers** with full CRUD: auth, projects, agents, templates, tickets, sessions, workflow, websocket
- **All Pydantic schemas** for request/response validation
- **Core services**: auth, project, ticket, workflow_engine, dag_validator, git_worktree, agent_runner
- **Worker placeholder** (ARQ task structure, not wired to real Claude SDK)
- **Seed data** with 5 global agents + 3 workflow templates
- **45 tests** (38 active)

### Backend — NOT YET DONE
- Skills CRUD router (model exists, no REST endpoints for skill management)
- Worktrees REST router (git_worktree service exists, no REST endpoints)
- Figma pipeline router (models exist, no endpoints)
- Cypress testing router (models exist, no endpoints)
- File review router (models exist, no endpoints)
- Actual Claude Code SDK integration (worker is placeholder)
- Alembic migration execution (`alembic upgrade head`)

### Frontend — NOT YET DONE
- App shell layout (sidebar, toolbar, status bar)
- API client / HTTP service layer
- WebSocket client
- ALL feature screens (sessions, skills, worktrees, figma, tests, reviews)
- State management
- Auth flow UI

## Build Priority

0. Foundation — App shell, API client, auth, base components
1. Claude Code session management + WebSocket streaming (core)
2. Skills management per project
3. Git worktree management
4. Figma design-to-code pipeline
5. E2E testing with Cypress
6. File review workflow

## Implementation Plans

Each feature has its own plan doc, designed to be executed independently:

- [Feature 0: Foundation](2026-03-06-feature-0-foundation.md) — App shell, API client, auth UI, base components
- [Feature 1: Session Management](2026-03-06-feature-1-session-management.md) — Claude SDK integration, chat UI, WebSocket streaming
- [Feature 2: Skills Management](2026-03-06-feature-2-skills-management.md) — Skills CRUD router, skills UI
- [Feature 3: Worktree Management](2026-03-06-feature-3-worktree-management.md) — Worktrees REST router, worktrees UI
- [Feature 4: Figma Pipeline](2026-03-06-feature-4-figma-pipeline.md) — Figma router/services, pipeline UI
- [Feature 5: Cypress Testing](2026-03-06-feature-5-cypress-testing.md) — Cypress runner, testing UI
- [Feature 6: File Review](2026-03-06-feature-6-file-review.md) — Review router/services, review UI

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Electron + React 19 + Tailwind v4 (existing) |
| Backend API | FastAPI + async SQLAlchemy + PostgreSQL |
| Task Queue | ARQ + Redis |
| Real-time | WebSocket (FastAPI) + Redis PubSub |
| AI Engine | Claude Code SDK Python (claude_agent_sdk) |
| Figma | cursor-talk-to-figma MCP server |
| E2E Testing | Cypress (video + screenshots) |
| File Storage | Local filesystem |
| UI Components | Radix UI + CVA + Lucide React (@agent-coding/ui) |

## Data Model

See `apps/backend/app/models/` for complete implementation. Key entities:

- **User** + **Project** + **ProjectMember** — multi-user project management
- **AgentConfig** + **AgentSkill** + **Skill** — configurable AI agents with skill injection
- **WorkflowTemplate** + **Ticket** + **WorkflowStep** — DAG-based workflow orchestration
- **Session** + **SessionMessage** — Claude Code session tracking
- **FigmaTask** + **FigmaNode** — design-to-code pipeline
- **TestRun** + **TestResult** — Cypress test management
- **ReviewSession** + **FileReview** — AI code review
