# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Workflow manager for Claude Code sessions — Electron desktop app + FastAPI backend monorepo.

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

- [Architecture](.claude/architecture.md) — monorepo structure, electron-vite targets, backend layout, shadcn/ui
- [Code Style](.claude/code-style.md) — Biome (TS) and Ruff (Python) conventions
- [UI Design Spec](docs/design/) — macOS-style design, components, screen layouts
- [Design System](docs/design/design-system.md) — colors, typography, spacing tokens
