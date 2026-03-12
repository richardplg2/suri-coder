# Agent Coding

Workflow manager for Claude Code sessions — Electron desktop app + FastAPI backend monorepo.

## Quick Reference

```bash
pnpm docker:up                      # Start PostgreSQL + Redis (required)
pnpm install                        # Install all JS dependencies
pnpm dev                            # Dev mode (all apps via turbo)
pnpm build                          # Build everything
pnpm lint                           # Lint all (biome for TS, ruff for Python)
pnpm typecheck                      # Type-check all packages
```

### Desktop (`apps/desktop`)
```bash
pnpm --filter my-electron-app dev                  # Electron dev with hot reload
pnpm --filter my-electron-app build                # Build distributable
pnpm --filter my-electron-app test:e2e:mock        # E2E mock tests (no backend)
pnpm --filter my-electron-app test:e2e:integration # E2E integration (needs backend)
```

### Backend (`apps/backend`)
```bash
cd apps/backend
uv run fastapi dev app/main.py --port 8001  # Dev server
uv run pytest tests/ -v                     # Run tests
uv run alembic upgrade head                 # Run migrations
```

## Guidelines

- [Architecture](.claude/architecture.md) — monorepo layout, build orchestration
- [Desktop](.claude/desktop.md) — Electron targets, stores, queries, routing, e2e testing
- [Backend](.claude/backend.md) — models, enums, services, workflow engine, migrations
- [shadcn/ui](.claude/shadcn-ui.md) — component library, adding components, imports
- [Code Style](.claude/code-style.md) — Biome (TS) and Ruff (Python) conventions
- [UI Design Spec](docs/design/) — macOS-style design, components, screen layouts
