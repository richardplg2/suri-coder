# Architecture

## Monorepo Layout

- **`apps/desktop`** — Electron + React + Tailwind v4 (electron-vite, Vite 7)
- **`apps/backend`** — FastAPI + async SQLAlchemy + PostgreSQL (Python 3.12, uv)
- **`packages/shared`** — Shared TS constants and types (`@agent-coding/shared`)
- **`packages/ui`** — Shared UI components with shadcn/ui + CVA + tailwind-merge (`@agent-coding/ui`)

Turborepo orchestrates builds; `build` tasks depend on `^build` (packages build before apps).

## Desktop App (Electron-vite)

Three build targets configured in `electron.vite.config.ts`:
- **main** — Electron main process (`src/main/`)
- **preload** — Preload scripts (`src/preload/`)
- **renderer** — React UI (`src/renderer/`)

Path aliases in `tsconfig.json`: `*` → `src/*`, `~/*` → `./*`.
So `import { foo } from 'main/something'` resolves to `src/main/something`.

## Backend (FastAPI)

Standard layout under `apps/backend/app/`:
- `main.py` — App factory with lifespan, CORS middleware
- `config.py` — Pydantic Settings (reads `.env`)
- `database.py` — Async SQLAlchemy engine + session factory, `Base` declarative base
- `models/`, `schemas/`, `routers/`, `services/`, `agent/` — Feature scaffolding
- `alembic/` — Database migrations

Requires `.env` file (copy `.env.example`): `DATABASE_URL`, `ANTHROPIC_API_KEY`, `DEBUG`.

## shadcn/ui Integration

Components added via shadcn CLI into `packages/ui` (configured in `apps/desktop/components.json`).
- `cn()` utility: `packages/ui/src/lib/utils.ts`
- Style: `new-york`, base color: `neutral`, icon library: `lucide`

## Design Doc

See `docs/plans/2026-03-06-workflow-manager-design.md` for data models, feature flows, and build priority.
