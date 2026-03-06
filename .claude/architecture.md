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

Config: `packages/ui/components.json` — style: `new-york`, base color: `neutral`, icons: `lucide`.

### Adding Components

Run from **anywhere in the monorepo** (shadcn traverses up to find `packages/ui/components.json`):

```bash
cd packages/ui && npx shadcn@latest add <component>
```

The CLI writes components to `packages/ui/src/components/` and imports `cn` from `@/lib/utils` (path alias). After adding:

1. **Export from the package** — add the component's exports to `packages/ui/src/index.ts`
2. **Rebuild the package** — run `pnpm --filter @agent-coding/ui build` (or `pnpm build` at root)
3. **Import in app code** — use `import { Button } from '@agent-coding/ui'`

### Key Paths

| What | Path |
|------|------|
| CLI config | `packages/ui/components.json` |
| Components | `packages/ui/src/components/` |
| `cn()` utility | `packages/ui/src/lib/utils.ts` |
| CSS variables | `packages/ui/src/globals.css` |
| Theme bridge | `apps/desktop/src/renderer/globals.css` |
| Package exports | `packages/ui/src/index.ts` |
| tsup config | `packages/ui/tsup.config.ts` |

### Path Alias

- `packages/ui/tsconfig.json` defines `@/*` → `./src/*`
- `packages/ui/tsup.config.ts` has esbuild alias `@` → `./src` so builds resolve correctly
- shadcn generates imports like `from "@/lib/utils"` — this is resolved by both TypeScript and tsup

### Rules

- Always import shadcn components from `@agent-coding/ui`, never from relative paths in app code
- CSS variables (light/dark) live in `packages/ui/src/globals.css`, theme-to-Tailwind mapping in `apps/desktop/src/renderer/globals.css`
- Components use CVA (`class-variance-authority`) for variants and `cn()` for class merging
- `rsc: false` in config — no React Server Components (Electron renderer)

## Design Doc

See `docs/plans/2026-03-06-workflow-manager-design.md` for data models, feature flows, and build priority.
