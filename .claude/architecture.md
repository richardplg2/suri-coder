# Architecture

## Monorepo Layout

- **`apps/desktop`** — Electron + React + Tailwind v4 (electron-vite, Vite 7)
- **`apps/backend`** — FastAPI + async SQLAlchemy + PostgreSQL (Python 3.12, uv)
- **`packages/shared`** — Shared TS constants and types (`@agent-coding/shared`)
- **`packages/ui`** — Shared UI components with shadcn/ui + CVA + tailwind-merge (`@agent-coding/ui`)

Turborepo orchestrates builds; `build` tasks depend on `^build` (packages build before apps).

## Detailed Guides

- [Desktop App](desktop.md) — Electron targets, Zustand stores, TanStack Query hooks, routing
- [Backend](backend.md) — FastAPI models, enums, services, workflow engine, migrations
- [shadcn/ui](shadcn-ui.md) — component library, adding components, imports
