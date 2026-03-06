# Monorepo Setup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restructure the agent-coding Electron app into a Turborepo monorepo with FastAPI backend, shared TS packages, and shared UI package.

**Architecture:** Turborepo + pnpm workspaces orchestrate 4 packages: `apps/desktop` (Electron), `apps/backend` (FastAPI/Python/uv), `packages/shared` (TS types/utils), `packages/ui` (React components). The Python backend lives alongside TS packages; Turborepo runs its tasks via shell commands.

**Tech Stack:** Turborepo, pnpm workspaces, electron-vite, FastAPI, uv, SQLAlchemy (async), Alembic, Claude Agent SDK, tsup, Tailwind CSS v4, Biome, Ruff

---

## Task 1: Root Monorepo Scaffolding

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `tsconfig.base.json`
- Modify: `package.json`
- Modify: `.gitignore`
- Modify: `.npmrc`
- Modify: `biome.json`

**Step 1: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

**Step 2: Create `turbo.json`**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "dev": {
      "persistent": true,
      "cache": false
    },
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", "node_modules/.dev/**"]
    },
    "lint": {
      "cache": false
    },
    "typecheck": {
      "dependsOn": ["^build"]
    }
  }
}
```

**Step 3: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "strict": true,
    "target": "esnext",
    "lib": ["esnext", "dom", "dom.iterable"],
    "jsx": "react-jsx",
    "importHelpers": true,
    "moduleResolution": "bundler",
    "module": "ESNext",
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "sourceMap": true,
    "isolatedModules": true,
    "allowJs": true,
    "allowSyntheticDefaultImports": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true
  },
  "exclude": ["node_modules"]
}
```

**Step 4: Update root `package.json`**

Replace the entire file. The root becomes a workspace root — no app-specific deps, only tooling.

```json
{
  "name": "agent-coding",
  "private": true,
  "packageManager": "pnpm@10.0.0",
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "typecheck": "turbo typecheck"
  },
  "devDependencies": {
    "@biomejs/biome": "^2.3.8",
    "turbo": "^2.5.0",
    "typescript": "^5.9.3"
  },
  "pnpm": {
    "onlyBuiltDependenciesFile": "./trusted-dependencies-scripts.json"
  }
}
```

**Step 5: Update `.gitignore`**

```gitignore
# dependencies
node_modules
.pnp
.pnp.js

# testing
coverage

# production
build
dist

# turbo
.turbo

# python
__pycache__
*.py[cod]
*$py.class
.venv
*.egg-info

# misc
.DS_Store
.env
.env.local
.env.development.local
.env.test.local
.env.production.local
.eslintcache

npm-debug.log*
yarn-debug.log*
yarn-error.log*
```

**Step 6: Update `.npmrc`**

```
auto-install-peers=true
strict-peer-dependencies=false
```

Remove `shamefully-hoist=true` — not needed with proper workspace config and can cause issues in monorepos.

**Step 7: Update `biome.json`**

Update the `files.includes` to cover the monorepo structure:

```json
{
  "$schema": "./node_modules/@biomejs/biome/configuration_schema.json",
  "assist": {
    "actions": {
      "source": {
        "organizeImports": "off",
        "useSortedAttributes": "on",
        "useSortedKeys": "off",
        "useSortedProperties": "on"
      }
    },
    "enabled": true
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineEnding": "lf",
    "lineWidth": 80
  },
  "javascript": {
    "formatter": {
      "arrowParentheses": "asNeeded",
      "bracketSpacing": true,
      "indentStyle": "space",
      "jsxQuoteStyle": "double",
      "quoteStyle": "single",
      "semicolons": "asNeeded",
      "trailingCommas": "es5"
    }
  },
  "linter": {
    "enabled": true,
    "rules": {
      "a11y": {
        "noSvgWithoutTitle": "off",
        "useButtonType": "off"
      },
      "complexity": {
        "noBannedTypes": "warn"
      },
      "correctness": {
        "noUnusedImports": "warn",
        "useExhaustiveDependencies": "off"
      },
      "recommended": true,
      "style": {
        "noUselessElse": "warn"
      },
      "suspicious": {
        "noArrayIndexKey": "info",
        "noDuplicateObjectKeys": "warn",
        "noDuplicateProperties": "warn",
        "noEmptyInterface": "off",
        "noExplicitAny": "off",
        "noUnknownAtRules": "off"
      }
    }
  },
  "css": {
    "parser": {
      "tailwindDirectives": true
    }
  },
  "files": {
    "includes": [
      "apps/**/*",
      "packages/**/*"
    ],
    "ignore": [
      "**/node_modules/**",
      "**/dist/**",
      "**/.turbo/**",
      "apps/backend/**"
    ]
  }
}
```

**Step 8: Commit**

```bash
git add pnpm-workspace.yaml turbo.json tsconfig.base.json package.json .gitignore .npmrc biome.json
git commit -m "feat: add root monorepo scaffolding (turborepo + pnpm workspaces)"
```

---

## Task 2: Create `packages/shared`

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/tsup.config.ts`
- Create: `packages/shared/src/index.ts`
- Create: `packages/shared/src/types/index.ts`
- Create: `packages/shared/src/constants/index.ts`

**Step 1: Create `packages/shared/package.json`**

```json
{
  "name": "@agent-coding/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "typecheck": "tsc --noEmit",
    "lint": "biome check ."
  },
  "devDependencies": {
    "tsup": "^8.4.0"
  }
}
```

**Step 2: Create `packages/shared/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

**Step 3: Create `packages/shared/tsup.config.ts`**

```ts
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
})
```

**Step 4: Create `packages/shared/src/constants/index.ts`**

These are environment/platform constants that don't depend on Electron-specific APIs — they can be shared. Note: `process.env` and `process.platform` are available in both Electron and Node contexts.

```ts
export const ENVIRONMENT = {
  IS_DEV: process.env.NODE_ENV === 'development',
}

export const PLATFORM = {
  IS_MAC: process.platform === 'darwin',
  IS_WINDOWS: process.platform === 'win32',
  IS_LINUX: process.platform === 'linux',
}
```

**Step 5: Create `packages/shared/src/types/index.ts`**

Start empty — Electron-specific types (BrowserWindow, IpcMainInvokeEvent) stay in `apps/desktop`. Only truly shared types go here.

```ts
export {}
```

**Step 6: Create `packages/shared/src/index.ts`**

```ts
export * from './constants'
export * from './types'
```

**Step 7: Commit**

```bash
git add packages/shared/
git commit -m "feat: add packages/shared with constants and types"
```

---

## Task 3: Create `packages/ui`

**Files:**
- Create: `packages/ui/package.json`
- Create: `packages/ui/tsconfig.json`
- Create: `packages/ui/tsup.config.ts`
- Create: `packages/ui/src/index.ts`
- Create: `packages/ui/src/lib/utils.ts`
- Create: `packages/ui/src/components/alert.tsx`

**Step 1: Create `packages/ui/package.json`**

```json
{
  "name": "@agent-coding/ui",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./globals.css": "./src/globals.css"
  },
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "typecheck": "tsc --noEmit",
    "lint": "biome check ."
  },
  "dependencies": {
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "tailwind-merge": "^3.4.0"
  },
  "peerDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.2.7",
    "@types/react-dom": "^19.2.3",
    "tailwindcss": "^4.1.17",
    "tsup": "^8.4.0"
  }
}
```

**Step 2: Create `packages/ui/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

**Step 3: Create `packages/ui/tsup.config.ts`**

```ts
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  external: ['react', 'react-dom'],
})
```

**Step 4: Create `packages/ui/src/lib/utils.ts`**

Move the `cn()` helper from `src/renderer/lib/utils.ts`:

```ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

**Step 5: Create `packages/ui/src/components/alert.tsx`**

Move from `src/renderer/components/ui/alert.tsx`, updating the import path:

```tsx
import type * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '../lib/utils'

const alertVariants = cva(
  'relative w-full rounded-lg border px-4 py-3 text-sm grid has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] grid-cols-[0_1fr] has-[>svg]:gap-x-3 gap-y-0.5 items-start [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current',
  {
    variants: {
      variant: {
        default: 'bg-background text-foreground',
        destructive:
          'text-destructive-foreground [&>svg]:text-current *:data-[slot=alert-description]:text-destructive-foreground/80',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
  return (
    <div
      className={cn(alertVariants({ variant }), className)}
      data-slot="alert"
      role="alert"
      {...props}
    />
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'col-start-2 line-clamp-1 min-h-4 font-medium tracking-tight',
        className
      )}
      data-slot="alert-title"
      {...props}
    />
  )
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'text-muted-foreground col-start-2 grid justify-items-start gap-1 text-sm [&_p]:leading-relaxed',
        className
      )}
      data-slot="alert-description"
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription }
```

**Step 6: Create `packages/ui/src/globals.css`**

Move the CSS variables and Tailwind config from `src/renderer/globals.css`. This becomes the shared design tokens file.

Copy the entire content of `src/renderer/globals.css` to `packages/ui/src/globals.css`.

**Step 7: Create `packages/ui/src/index.ts`**

```ts
export { Alert, AlertTitle, AlertDescription } from './components/alert'
export { cn } from './lib/utils'
```

**Step 8: Commit**

```bash
git add packages/ui/
git commit -m "feat: add packages/ui with shared components and design tokens"
```

---

## Task 4: Move Electron App to `apps/desktop`

**Files:**
- Create: `apps/desktop/package.json`
- Create: `apps/desktop/tsconfig.json`
- Move: `electron.vite.config.ts` → `apps/desktop/electron.vite.config.ts`
- Move: `electron-builder.ts` → `apps/desktop/electron-builder.ts`
- Move: `src/main/` → `apps/desktop/src/main/`
- Move: `src/preload/` → `apps/desktop/src/preload/`
- Move: `src/renderer/` → `apps/desktop/src/renderer/`
- Move: `src/lib/` → `apps/desktop/src/lib/`
- Move: `src/resources/` → `apps/desktop/src/resources/`
- Move: `index.d.ts` → `apps/desktop/index.d.ts`
- Move: `components.json` → `apps/desktop/components.json`
- Move: `trusted-dependencies-scripts.json` → keep at root (pnpm config)
- Delete: `src/shared/` (moved to `packages/shared`)
- Delete: `src/renderer/components/ui/alert.tsx` (moved to `packages/ui`)
- Delete: `src/renderer/lib/utils.ts` (moved to `packages/ui`)
- Delete: `src/lib/electron-app/extensions/react-developer-tools/` (remove bundled devtools)

**Step 1: Create directory structure and move files**

```bash
mkdir -p apps/desktop

# Move source files
mv src/main apps/desktop/src/main
mv src/preload apps/desktop/src/preload
mv src/renderer apps/desktop/src/renderer
mv src/lib apps/desktop/src/lib
mv src/resources apps/desktop/src/resources

# Move config files
mv electron.vite.config.ts apps/desktop/
mv electron-builder.ts apps/desktop/
mv index.d.ts apps/desktop/
mv components.json apps/desktop/
mv .nvmrc apps/desktop/
mv .editorconfig apps/desktop/

# Remove files that moved to packages
rm apps/desktop/src/renderer/components/ui/alert.tsx
rm apps/desktop/src/renderer/lib/utils.ts
rm -rf apps/desktop/src/lib/electron-app/extensions/react-developer-tools

# Remove old src/shared (now in packages/shared)
rm -rf src/
```

**Step 2: Create `apps/desktop/package.json`**

```json
{
  "displayName": "My Electron App",
  "name": "my-electron-app",
  "description": "Your awesome app description",
  "version": "0.0.0",
  "main": "./node_modules/.dev/main/index.mjs",
  "resources": "src/resources",
  "author": {
    "name": "Dalton Menezes",
    "email": "daltonmenezes@outlook.com"
  },
  "homepage": "https://github.com/nicholasmolina2019/agent-coding",
  "license": "MIT",
  "scripts": {
    "start": "electron-vite preview",
    "predev": "run-s clean:dev",
    "dev": "cross-env NODE_ENV=development electron-vite dev --watch",
    "compile:app": "electron-vite build",
    "compile:packageJSON": "tsx ./src/lib/electron-app/release/modules/prebuild.ts",
    "prebuild": "run-s clean:dev compile:app compile:packageJSON",
    "build": "pnpm electron-builder",
    "postinstall": "run-s prebuild install:deps",
    "install:deps": "electron-builder install-app-deps",
    "make:release": "tsx ./src/lib/electron-app/release/modules/release.ts",
    "release": "electron-builder --publish always",
    "clean:dev": "rimraf ./node_modules/.dev",
    "lint": "biome check --no-errors-on-unmatched",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@agent-coding/shared": "workspace:*",
    "@agent-coding/ui": "workspace:*",
    "electron-router-dom": "^2.1.0",
    "lucide-react": "^0.556.0",
    "react": "^19.2.1",
    "react-dom": "^19.2.1",
    "react-router-dom": "^7.10.1",
    "tailwindcss-animate": "^1.0.7"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.1.17",
    "@types/node": "^24.10.1",
    "@types/react": "^19.2.7",
    "@types/react-dom": "^19.2.3",
    "@types/semver": "^7.7.1",
    "@vitejs/plugin-react": "^5.1.1",
    "code-inspector-plugin": "^1.3.0",
    "cross-env": "^10.1.0",
    "electron": "^39.2.6",
    "electron-builder": "^26.0.12",
    "electron-vite": "^4.0.1",
    "npm-run-all": "^4.1.5",
    "open": "^11.0.0",
    "rimraf": "^6.1.2",
    "rollup-plugin-inject-process-env": "^1.3.1",
    "semver": "^7.7.3",
    "tailwindcss": "^4.1.17",
    "tsx": "^4.21.0",
    "vite": "^7.2.6",
    "vite-tsconfig-paths": "^5.1.4"
  }
}
```

Note: `class-variance-authority`, `clsx`, `tailwind-merge` removed from here — they come via `@agent-coding/ui`.

**Step 3: Create `apps/desktop/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "*": ["src/*"],
      "~/*": ["./*"]
    }
  },
  "include": [
    "./src",
    "electron.vite.config.*",
    "electron-builder.ts",
    "index.d.ts"
  ],
  "exclude": ["node_modules"]
}
```

**Step 4: Update `apps/desktop/src/shared/constants.ts`**

Create a re-export file that imports from the shared package. This way existing imports like `import { ENVIRONMENT } from 'shared/constants'` keep working.

```bash
mkdir -p apps/desktop/src/shared
```

```ts
export { ENVIRONMENT, PLATFORM } from '@agent-coding/shared'
```

**Step 5: Update `apps/desktop/src/shared/types.ts`**

This file has Electron-specific types — keep it in desktop, no changes needed since it only depends on Electron types and `lib/electron-router-dom`.

```ts
import type { BrowserWindow, IpcMainInvokeEvent } from 'electron'

import type { registerRoute } from 'lib/electron-router-dom'

export type BrowserWindowOrNull = Electron.BrowserWindow | null

type Route = Parameters<typeof registerRoute>[0]

export interface WindowProps extends Electron.BrowserWindowConstructorOptions {
  id: Route['id']
  query?: Route['query']
}

export interface WindowCreationByIPC {
  channel: string
  window(): BrowserWindowOrNull
  callback(window: BrowserWindow, event: IpcMainInvokeEvent): void
}
```

**Step 6: Update `apps/desktop/src/shared/utils.ts`**

Keep as-is — `makeAppId` and `waitFor` are desktop-specific utilities.

**Step 7: Update `apps/desktop/src/renderer/screens/main.tsx`**

Update Alert import to use `@agent-coding/ui`:

```tsx
import { Terminal } from 'lucide-react'
import { useEffect } from 'react'

import {
  Alert,
  AlertTitle,
  AlertDescription,
} from '@agent-coding/ui'

const { App } = window

export function MainScreen() {
  useEffect(() => {
    App.sayHelloFromBridge()
  }, [])

  const userName = App.username || 'there'

  return (
    <main className="flex flex-col items-center justify-center h-screen bg-background">
      <Alert className="mt-5 bg-transparent border-transparent text-accent w-fit">
        <AlertTitle className="text-5xl text-teal-400">
          Hi, {userName}!
        </AlertTitle>

        <AlertDescription className="flex items-center gap-2 text-lg">
          <Terminal className="size-6 text-fuchsia-300" />

          <span className="text-gray-400">
            It's time to build something awesome!
          </span>
        </AlertDescription>
      </Alert>
    </main>
  )
}
```

**Step 8: Update `apps/desktop/src/renderer/globals.css`**

Replace with an import of the shared design tokens from `@agent-coding/ui`, plus any desktop-specific overrides:

```css
@import "@agent-coding/ui/globals.css";
```

**Step 9: Remove moved/deleted files and empty dirs**

```bash
# Remove empty component/lib dirs if they exist
rmdir apps/desktop/src/renderer/components/ui 2>/dev/null || true
rmdir apps/desktop/src/renderer/components 2>/dev/null || true
rmdir apps/desktop/src/renderer/lib 2>/dev/null || true
```

**Step 10: Update `apps/desktop/src/lib/electron-app/utils/react-devtools.ts`**

Since we removed the bundled extension, update to use electron-devtools-installer or just remove the feature:

```ts
export async function loadReactDevtools() {
  // React DevTools can be loaded via the browser extension in dev mode
  // The bundled extension has been removed to reduce package size
  console.log(
    '\nTo use React DevTools, install the browser extension or use standalone.\n'
  )
}
```

**Step 11: Update `apps/desktop/components.json`**

Update paths for new structure:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/renderer/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "renderer/components",
    "utils": "@agent-coding/ui",
    "ui": "@agent-coding/ui",
    "lib": "renderer/lib",
    "hooks": "renderer/hooks"
  },
  "iconLibrary": "lucide"
}
```

**Step 12: Delete old root files no longer needed**

```bash
rm -f tsconfig.json
```

**Step 13: Commit**

```bash
git add -A
git commit -m "feat: move electron app to apps/desktop and wire up workspace packages"
```

---

## Task 5: Create FastAPI Backend (`apps/backend`)

**Prerequisites:** `uv` must be installed. Run `uv --version` to verify. If not installed: `curl -LsSf https://astral.sh/uv/install.sh | sh`

**Files:**
- Create: `apps/backend/pyproject.toml`
- Create: `apps/backend/.python-version`
- Create: `apps/backend/app/__init__.py`
- Create: `apps/backend/app/main.py`
- Create: `apps/backend/app/config.py`
- Create: `apps/backend/app/database.py`
- Create: `apps/backend/app/models/__init__.py`
- Create: `apps/backend/app/schemas/__init__.py`
- Create: `apps/backend/app/routers/__init__.py`
- Create: `apps/backend/app/services/__init__.py`
- Create: `apps/backend/app/agent/__init__.py`
- Create: `apps/backend/tests/__init__.py`
- Create: `apps/backend/tests/test_health.py`

**Step 1: Create `apps/backend/.python-version`**

```
3.12
```

**Step 2: Initialize uv project and add dependencies**

```bash
cd apps/backend
uv init --no-readme
```

Then replace the generated `pyproject.toml`:

**Step 3: Create `apps/backend/pyproject.toml`**

```toml
[project]
name = "agent-coding-backend"
version = "0.0.0"
description = "Agent Coding API backend"
requires-python = ">=3.12"
dependencies = [
    "fastapi[standard]>=0.115.0",
    "sqlalchemy[asyncio]>=2.0.0",
    "asyncpg>=0.30.0",
    "alembic>=1.15.0",
    "pydantic-settings>=2.7.0",
    "claude-agent-sdk>=0.1.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0.0",
    "pytest-asyncio>=0.25.0",
    "httpx>=0.28.0",
    "ruff>=0.9.0",
]

[tool.ruff]
target-version = "py312"
line-length = 88

[tool.ruff.lint]
select = ["E", "F", "I", "N", "W", "UP"]

[tool.pytest.ini_options]
asyncio_mode = "auto"
```

**Step 4: Install dependencies**

```bash
cd apps/backend
uv sync --all-extras
```

**Step 5: Create `apps/backend/app/__init__.py`**

```python
```

**Step 6: Create `apps/backend/app/config.py`**

```python
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Agent Coding API"
    debug: bool = False
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/agent_coding"
    anthropic_api_key: str = ""

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
```

**Step 7: Create `apps/backend/app/database.py`**

```python
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

engine = create_async_engine(settings.database_url, echo=settings.debug)

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with async_session() as session:
        yield session
```

**Step 8: Create `apps/backend/app/main.py`**

```python
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(
    title=settings.app_name,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    return {"status": "ok"}
```

**Step 9: Create empty module `__init__.py` files**

Create empty `__init__.py` in: `app/models/`, `app/schemas/`, `app/routers/`, `app/services/`, `app/agent/`, `tests/`.

```python
```

**Step 10: Create `apps/backend/tests/test_health.py`**

```python
from httpx import ASGITransport, AsyncClient

from app.main import app


async def test_health_check():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

**Step 11: Run the test**

```bash
cd apps/backend
uv run pytest tests/test_health.py -v
```

Expected: PASS

**Step 12: Add a `package.json` for Turborepo task integration**

Turborepo needs a `package.json` to recognize this as a workspace member (even for Python). Create a minimal one:

```json
{
  "name": "@agent-coding/backend",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "uv run fastapi dev app/main.py --port 8000",
    "build": "echo 'no build step for python'",
    "lint": "uv run ruff check .",
    "lint:fix": "uv run ruff check --fix .",
    "typecheck": "echo 'use pyright separately'",
    "test": "uv run pytest tests/ -v"
  }
}
```

**Step 13: Set up Alembic**

```bash
cd apps/backend
uv run alembic init alembic
```

Then update `apps/backend/alembic/env.py` — replace the `target_metadata` line:

Find the line:
```python
target_metadata = None
```

Replace with:
```python
from app.database import Base
target_metadata = Base.metadata
```

Update `apps/backend/alembic.ini` — find the `sqlalchemy.url` line and replace with:
```
sqlalchemy.url = postgresql+asyncpg://postgres:postgres@localhost:5432/agent_coding
```

**Step 14: Create `.env.example`**

```
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/agent_coding
ANTHROPIC_API_KEY=your-api-key-here
DEBUG=true
```

**Step 15: Commit**

```bash
git add apps/backend/
git commit -m "feat: add FastAPI backend with SQLAlchemy, Alembic, and health check"
```

---

## Task 6: Install Dependencies and Verify

**Step 1: Remove old node_modules and lockfile**

```bash
rm -rf node_modules pnpm-lock.yaml dist
```

**Step 2: Install all workspace dependencies**

```bash
pnpm install
```

**Step 3: Build shared packages first**

```bash
pnpm --filter @agent-coding/shared build
pnpm --filter @agent-coding/ui build
```

**Step 4: Verify desktop app typecheck**

```bash
pnpm --filter my-electron-app typecheck
```

Fix any import path issues that arise. Common issues:
- `shared/constants` path alias may need updating since the desktop tsconfig now has `baseUrl: "."` and path `"*": ["src/*"]` — but the actual file at `apps/desktop/src/shared/constants.ts` re-exports from `@agent-coding/shared`, so this should work.

**Step 5: Verify turbo tasks**

```bash
pnpm turbo build
pnpm turbo lint
```

**Step 6: Verify backend**

```bash
cd apps/backend
uv run pytest tests/ -v
```

**Step 7: Commit lockfile**

```bash
git add pnpm-lock.yaml
git commit -m "chore: add lockfile after monorepo restructure"
```

---

## Task 7: Final Cleanup and Verification

**Step 1: Remove old root files that are no longer needed**

```bash
# These were moved to apps/desktop or are no longer needed at root
rm -f .nvmrc .editorconfig 2>/dev/null || true
```

**Step 2: Update `.vscode/` settings if needed**

Check if `.vscode/settings.json` has paths that need updating for the new monorepo structure.

**Step 3: Run full dev to verify everything works**

```bash
pnpm turbo dev
```

This should start:
- `packages/shared` in watch mode
- `packages/ui` in watch mode
- `apps/desktop` electron-vite dev
- `apps/backend` FastAPI dev server on port 8000

**Step 4: Final commit**

```bash
git add -A
git commit -m "chore: final cleanup after monorepo restructure"
```
