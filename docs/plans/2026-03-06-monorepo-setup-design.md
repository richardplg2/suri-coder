# Monorepo Setup Design

## Overview

Restructure the agent-coding project from a single Electron app into a Turborepo monorepo with a FastAPI backend, shared packages, and the existing desktop app.

## Architecture

```
agent-coding/
├── apps/
│   ├── desktop/          # Electron app (React + Tailwind + electron-vite)
│   └── backend/          # FastAPI (Python, uv)
├── packages/
│   ├── ui/               # Shared React UI components
│   └── shared/           # Shared TS types/utils
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

## Decisions

- **Turborepo + pnpm workspaces** for monorepo management
- **uv** for Python dependency management
- **Backend serves both web clients and Electron app** — independent API server
- **No web client yet** — will be added later, shared packages ready for it

## Backend (apps/backend)

FastAPI with standard project structure:

```
apps/backend/
├── pyproject.toml
├── uv.lock
├── .python-version
├── alembic.ini
├── alembic/versions/
├── app/
│   ├── main.py              # FastAPI app entry, lifespan
│   ├── config.py            # pydantic-settings
│   ├── database.py          # SQLAlchemy async engine/session
│   ├── models/              # SQLAlchemy models
│   ├── schemas/             # Pydantic request/response schemas
│   ├── routers/             # API route handlers
│   ├── services/            # Business logic
│   └── agent/               # Claude Code SDK integration
└── tests/
```

Stack:
- Async SQLAlchemy + PostgreSQL
- Alembic for migrations
- pydantic-settings for config
- Claude Code SDK (claude_agent_sdk)
- Ruff for linting

## Packages

### packages/shared
- TypeScript types and constants shared across frontend apps
- Built with tsup
- Future: generate types from FastAPI OpenAPI schema

### packages/ui
- Shared React UI components (migrated from desktop renderer)
- Tailwind CSS v4
- Built with tsup

## Desktop App (apps/desktop)

Move existing Electron app into apps/desktop with:
- Refactored imports to use @agent-coding/shared and @agent-coding/ui
- Shared UI components moved to packages/ui
- Remove bundled react-developer-tools extension
- Keep electron-vite, Biome, Tailwind CSS v4

## Root Config

- `pnpm-workspace.yaml` — packages: ["apps/*", "packages/*"]
- `turbo.json` — pipeline for dev, build, lint, typecheck
- `biome.json` — shared Biome config
- `tsconfig.base.json` — shared TS config

### Turborepo Pipeline

| Task | Behavior |
|------|----------|
| dev | Parallel: desktop dev, backend uvicorn --reload, shared/ui watch |
| build | Sequential: shared → ui → desktop |
| lint | Parallel: biome (TS), ruff (Python) |
| typecheck | Parallel: all TS packages |
