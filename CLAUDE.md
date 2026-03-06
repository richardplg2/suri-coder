# CLAUDE.md

Workflow manager for Claude Code sessions — Electron desktop app + FastAPI backend monorepo.

## Prerequisites

PostgreSQL and Redis are required. Start via Docker:
```bash
pnpm docker:up       # Start PostgreSQL + Redis containers
pnpm docker:down     # Stop containers
pnpm docker:reset    # Stop + delete volumes
```

## Commands

```bash
pnpm install                        # Install all JS dependencies
pnpm dev                            # Dev mode (all apps via turbo)
pnpm build                          # Build everything
pnpm lint                           # Lint all (biome for TS, ruff for Python)
pnpm typecheck                      # Type-check all packages
```

### Desktop (`apps/desktop`)
```bash
pnpm --filter my-electron-app dev       # Electron dev with hot reload
pnpm --filter my-electron-app build     # Build distributable
```

### Backend (`apps/backend`)
```bash
cd apps/backend
uv sync                                     # Install Python deps
cp .env.example .env                         # First-time env setup
uv run fastapi dev app/main.py --port 8000  # Dev server
uv run pytest tests/ -v                     # Run all tests
uv run pytest tests/test_health.py -v       # Run single test file
uv run alembic upgrade head                  # Run DB migrations
uv run alembic revision --autogenerate -m "description"  # Create migration
uv run ruff check .                         # Lint
uv run ruff check --fix .                   # Auto-fix lint
```

## Guidelines

- [Architecture](.claude/architecture.md) — monorepo overview, links to per-app guides
- [Desktop](.claude/desktop.md) — Electron targets, Zustand stores, TanStack Query hooks, routing
- [Backend](.claude/backend.md) — FastAPI models, enums, services, workflow engine, migrations
- [shadcn/ui](.claude/shadcn-ui.md) — component library, adding components, imports
- [Code Style](.claude/code-style.md) — Biome (TS) and Ruff (Python) conventions
- [UI Design Spec](docs/design/) — macOS-style design, components, screen layouts
- [Design System](docs/design/design-system.md) — colors, typography, spacing tokens
