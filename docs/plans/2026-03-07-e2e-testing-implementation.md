# E2E Testing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Set up Playwright e2e testing for the Electron desktop app with mock and integration test layers.

**Architecture:** Playwright launches the Electron app via `_electron.launch()`. Custom fixtures provide app instance, authenticated page, and mock API. Two projects: `mock` (no backend) and `integration` (real backend).

**Tech Stack:** `@playwright/test`, Electron, Playwright route interception for mocking

---

### Task 1: Install Playwright and add scripts

**Files:**
- Modify: `apps/desktop/package.json`

**Step 1: Install @playwright/test**

Run:
```bash
cd /home/richard/work/AgentCoding/agent-coding && pnpm --filter my-electron-app add -D @playwright/test
```

**Step 2: Add e2e scripts to package.json**

Add these scripts to `apps/desktop/package.json`:

```json
"test:e2e": "playwright test --config=e2e/playwright.config.ts",
"test:e2e:mock": "playwright test --config=e2e/playwright.config.ts --project=mock",
"test:e2e:integration": "playwright test --config=e2e/playwright.config.ts --project=integration"
```

**Step 3: Commit**

```bash
git add apps/desktop/package.json pnpm-lock.yaml
git commit -m "chore: install @playwright/test and add e2e scripts"
```

---

### Task 2: Create Playwright config

**Files:**
- Create: `apps/desktop/e2e/playwright.config.ts`

**Step 1: Write the config**

```typescript
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  timeout: 30_000,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  projects: [
    {
      name: 'mock',
      testMatch: ['{flows,ui}/**/*.spec.ts'],
    },
    {
      name: 'integration',
      testMatch: ['integration/**/*.spec.ts'],
    },
  ],
})
```

**Step 2: Add e2e output dirs to .gitignore**

Append to `apps/desktop/.gitignore` (create if needed):

```
# Playwright
test-results/
playwright-report/
```

**Step 3: Commit**

```bash
git add apps/desktop/e2e/playwright.config.ts apps/desktop/.gitignore
git commit -m "chore: add Playwright config with mock and integration projects"
```

---

### Task 3: Create app fixture (Electron launch)

**Files:**
- Create: `apps/desktop/e2e/fixtures/app.fixture.ts`

**Context:** The Electron main process entry after build is at `./node_modules/.dev/main/index.mjs`. The app uses `electron-vite` for building. For tests, we need to build first, then launch. The main process is at `apps/desktop/src/main/index.ts`, which gets compiled to `node_modules/.dev/main/index.mjs`.

**Step 1: Write the app fixture**

```typescript
import { test as base, _electron as electron } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { resolve } from 'node:path'

type AppFixtures = {
  electronApp: ElectronApplication
  appPage: Page
}

export const test = base.extend<AppFixtures>({
  electronApp: async ({}, use) => {
    const appPath = resolve(__dirname, '../../node_modules/.dev/main/index.mjs')
    const electronApp = await electron.launch({
      args: [appPath],
      env: {
        ...process.env,
        NODE_ENV: 'test',
      },
    })
    await use(electronApp)
    await electronApp.close()
  },

  appPage: async ({ electronApp }, use) => {
    const page = await electronApp.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    await use(page)
  },
})

export { expect } from '@playwright/test'
```

**Step 2: Write a smoke test to verify the fixture works**

Create `apps/desktop/e2e/flows/smoke.spec.ts`:

```typescript
import { test, expect } from '../fixtures/app.fixture'

test('app launches and shows login screen', async ({ appPage }) => {
  await expect(appPage.locator('text=Sign in')).toBeVisible()
})
```

**Step 3: Build the app and run the smoke test**

Run:
```bash
cd /home/richard/work/AgentCoding/agent-coding && pnpm --filter my-electron-app compile:app
```

Then:
```bash
cd /home/richard/work/AgentCoding/agent-coding && pnpm --filter my-electron-app test:e2e:mock
```

Expected: 1 test passes, app launches and shows "Sign in".

**Step 4: Commit**

```bash
git add apps/desktop/e2e/
git commit -m "feat(e2e): add app fixture and smoke test"
```

---

### Task 4: Create mock API fixture

**Files:**
- Create: `apps/desktop/e2e/fixtures/mock-api.fixture.ts`

**Context:** The app calls `http://localhost:8000` for all API requests (see `apps/desktop/src/renderer/lib/api-client.ts:4`). Auth is via `POST /auth/login` which returns `{ access_token, token_type, user }`. Projects list is `GET /projects/`. The auth store persists to localStorage with key `auth-store`.

**Step 1: Write the mock API fixture**

```typescript
import { test as appTest } from './app.fixture'
import type { Page } from '@playwright/test'

const API_BASE = 'http://localhost:8000'

const TEST_USER = {
  id: 'test-user-id',
  email: 'test@example.com',
  name: 'Test User',
  avatar_url: null,
  role: 'admin',
  created_at: '2026-01-01T00:00:00Z',
}

const TEST_TOKEN = 'test-jwt-token'

const DEFAULT_RESPONSES: Record<string, { status: number; body: unknown }> = {
  'POST /auth/login': {
    status: 200,
    body: { access_token: TEST_TOKEN, token_type: 'bearer', user: TEST_USER },
  },
  'GET /projects/': {
    status: 200,
    body: [],
  },
  'GET /health': {
    status: 200,
    body: { status: 'ok' },
  },
}

async function setupMockApi(page: Page) {
  await page.route(`${API_BASE}/**`, async (route) => {
    const request = route.request()
    const method = request.method()
    const url = new URL(request.url())
    const path = url.pathname + (url.pathname.endsWith('/') ? '' : '/')
    const key = `${method} ${path.replace(/\/+$/, '/').replace(/\/\//g, '/')}`

    // Try exact match first, then try without trailing slash
    const response =
      DEFAULT_RESPONSES[key] ||
      DEFAULT_RESPONSES[key.replace(/\/$/, '')]

    if (response) {
      await route.fulfill({
        status: response.status,
        contentType: 'application/json',
        body: JSON.stringify(response.body),
      })
    } else {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ detail: `Mock not found: ${key}` }),
      })
    }
  })
}

type MockApiFixtures = {
  mockApi: void
}

export const test = appTest.extend<MockApiFixtures>({
  mockApi: async ({ appPage }, use) => {
    await setupMockApi(appPage)
    await use()
  },
})

export { expect } from '@playwright/test'
export { TEST_USER, TEST_TOKEN, API_BASE }
```

**Step 2: Write a test that uses mock API for login**

Create `apps/desktop/e2e/flows/login.spec.ts`:

```typescript
import { test, expect, TEST_USER } from '../fixtures/mock-api.fixture'

test('login with valid credentials redirects to home', async ({
  appPage,
  mockApi,
}) => {
  // Fill in login form
  await appPage.getByLabel('Email').fill('test@example.com')
  await appPage.getByLabel('Password').fill('password123')
  await appPage.getByRole('button', { name: 'Sign In' }).click()

  // Should redirect to home and show Projects heading
  await expect(appPage.locator('text=Projects')).toBeVisible()
})

test('login with invalid credentials shows error', async ({
  appPage,
  mockApi,
}) => {
  // Override the login mock to return 401
  await appPage.route('http://localhost:8000/auth/login', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ detail: 'Invalid email or password' }),
    })
  })

  await appPage.getByLabel('Email').fill('wrong@example.com')
  await appPage.getByLabel('Password').fill('wrongpass')
  await appPage.getByRole('button', { name: 'Sign In' }).click()

  // Should show error message
  await expect(appPage.locator('text=Invalid email or password')).toBeVisible()
})
```

**Step 3: Run tests**

```bash
cd /home/richard/work/AgentCoding/agent-coding && pnpm --filter my-electron-app test:e2e:mock
```

Expected: 3 tests pass (1 smoke + 2 login).

**Step 4: Commit**

```bash
git add apps/desktop/e2e/
git commit -m "feat(e2e): add mock API fixture and login flow tests"
```

---

### Task 5: Create auth fixture (pre-authenticated page)

**Files:**
- Create: `apps/desktop/e2e/fixtures/auth.fixture.ts`

**Context:** The auth store uses Zustand persist middleware with localStorage key `auth-store` (see `apps/desktop/src/renderer/stores/use-auth-store.ts:13`). The `Root` component in `routes.tsx:20` checks `token` to decide whether to show `LoginScreen` or `AppShell`.

**Step 1: Write the auth fixture**

```typescript
import { test as mockApiTest, TEST_USER, TEST_TOKEN } from './mock-api.fixture'

type AuthFixtures = {
  authedPage: void
}

export const test = mockApiTest.extend<AuthFixtures>({
  authedPage: async ({ appPage, electronApp, mockApi }, use) => {
    // Inject auth state into Zustand persist store via localStorage
    await appPage.evaluate(
      ({ token, user }) => {
        const state = {
          state: { token, user },
          version: 0,
        }
        localStorage.setItem('auth-store', JSON.stringify(state))
      },
      { token: TEST_TOKEN, user: TEST_USER },
    )

    // Reload so the app picks up the persisted auth state
    await appPage.reload()
    await appPage.waitForLoadState('domcontentloaded')

    await use()
  },
})

export { expect } from '@playwright/test'
```

**Step 2: Write a test that uses authed fixture**

Create `apps/desktop/e2e/flows/home.spec.ts`:

```typescript
import { test, expect } from '../fixtures/auth.fixture'

test('authenticated user sees home screen with projects', async ({
  appPage,
  authedPage,
}) => {
  // Should show the Projects heading (home screen)
  await expect(appPage.locator('text=Projects')).toBeVisible()
})

test('authenticated user sees New Project button', async ({
  appPage,
  authedPage,
}) => {
  await expect(
    appPage.getByRole('button', { name: /New Project/i }),
  ).toBeVisible()
})
```

**Step 3: Run tests**

```bash
cd /home/richard/work/AgentCoding/agent-coding && pnpm --filter my-electron-app test:e2e:mock
```

Expected: 5 tests pass.

**Step 4: Commit**

```bash
git add apps/desktop/e2e/
git commit -m "feat(e2e): add auth fixture and home screen tests"
```

---

### Task 6: Create integration fixture

**Files:**
- Create: `apps/desktop/e2e/fixtures/integration.fixture.ts`

**Context:** Integration tests need the real backend running (`docker:up` + FastAPI). The backend has a test account (check `docs/test-account.md`). Health check is at `GET /health`.

**Step 1: Read the test account docs**

Read `docs/test-account.md` to find test credentials.

**Step 2: Write the integration fixture**

```typescript
import { test as appTest, expect } from './app.fixture'

type IntegrationFixtures = {
  backendReady: void
}

export const test = appTest.extend<IntegrationFixtures>({
  backendReady: async ({}, use) => {
    // Verify backend is running
    const res = await fetch('http://localhost:8000/health')
    if (!res.ok) {
      throw new Error(
        'Backend not running. Start with: pnpm docker:up && cd apps/backend && uv run fastapi dev app/main.py --port 8000',
      )
    }
    await use()
  },
})

export { expect }
```

**Step 3: Write a basic integration test**

Create `apps/desktop/e2e/integration/auth-flow.spec.ts`:

Use the real test credentials from `docs/test-account.md`:

```typescript
import { test, expect } from '../fixtures/integration.fixture'

test('login with real backend credentials', async ({
  appPage,
  backendReady,
}) => {
  // Use test account credentials from docs/test-account.md
  await appPage.getByLabel('Email').fill('<TEST_EMAIL>')
  await appPage.getByLabel('Password').fill('<TEST_PASSWORD>')
  await appPage.getByRole('button', { name: 'Sign In' }).click()

  // Should redirect to home screen
  await expect(appPage.locator('text=Projects')).toBeVisible({ timeout: 10_000 })
})
```

> **Note to implementer:** Replace `<TEST_EMAIL>` and `<TEST_PASSWORD>` with actual values from `docs/test-account.md`.

**Step 4: Commit**

```bash
git add apps/desktop/e2e/
git commit -m "feat(e2e): add integration fixture and auth flow test"
```

---

### Task 7: Add project flow tests (mock)

**Files:**
- Create: `apps/desktop/e2e/flows/project.spec.ts`

**Context:** Home screen shows project cards. "New Project" button opens a modal (`open('create-project')`). The project creation endpoint is `POST /projects/`. After creation, the project should appear in the list.

**Step 1: Write project flow tests**

```typescript
import { test, expect } from '../fixtures/auth.fixture'
import { API_BASE } from '../fixtures/mock-api.fixture'

const TEST_PROJECT = {
  id: 'proj-1',
  name: 'Test Project',
  slug: 'test-project',
  path: '/tmp/test-project',
  repo_url: null,
  description: 'A test project',
  settings: null,
  created_by: 'test-user-id',
  created_at: '2026-01-01T00:00:00Z',
  member_count: 1,
}

test('create project via modal', async ({ appPage, authedPage }) => {
  // Mock the create endpoint
  await appPage.route(`${API_BASE}/projects/`, async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(TEST_PROJECT),
      })
    } else {
      // GET returns the newly created project
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([TEST_PROJECT]),
      })
    }
  })

  // Click "New Project" button
  await appPage.getByRole('button', { name: /New Project/i }).click()

  // Fill in the create project modal
  // (Exact selectors depend on the modal implementation - adjust as needed)
  await appPage.getByLabel('Name').fill('Test Project')
  await appPage.getByLabel('Path').fill('/tmp/test-project')

  // Submit
  await appPage.getByRole('button', { name: /Create/i }).click()

  // Project should appear in the list
  await expect(appPage.locator('text=Test Project')).toBeVisible()
})
```

> **Note to implementer:** Check the create-project modal component for exact form field labels and button text. Adjust selectors accordingly.

**Step 2: Run tests**

```bash
cd /home/richard/work/AgentCoding/agent-coding && pnpm --filter my-electron-app test:e2e:mock
```

**Step 3: Commit**

```bash
git add apps/desktop/e2e/flows/project.spec.ts
git commit -m "feat(e2e): add project flow tests"
```

---

### Task 8: Add UI interaction tests

**Files:**
- Create: `apps/desktop/e2e/ui/sidebar.spec.ts`

**Context:** The app has a sidebar (managed by `use-sidebar-store.ts`), tabs (managed by `use-tab-store.ts`), and modals (managed by `use-modal-store.ts`).

**Step 1: Read sidebar and tab store to understand the UI**

Read these files to understand what UI elements exist:
- `apps/desktop/src/renderer/stores/use-sidebar-store.ts`
- `apps/desktop/src/renderer/stores/use-tab-store.ts`
- `apps/desktop/src/renderer/components/app-layout.tsx`

**Step 2: Write sidebar tests**

```typescript
import { test, expect } from '../fixtures/auth.fixture'

test('sidebar is visible on home screen', async ({ appPage, authedPage }) => {
  // Check sidebar exists (adjust selector based on actual component)
  await expect(appPage.locator('[data-testid="sidebar"]')).toBeVisible()
})
```

> **Note to implementer:** Inspect the actual sidebar component to determine correct selectors. Add `data-testid` attributes to key UI elements if needed for stable test selectors. Add more tests for sidebar navigation, collapse/expand, etc.

**Step 3: Run tests**

```bash
cd /home/richard/work/AgentCoding/agent-coding && pnpm --filter my-electron-app test:e2e:mock
```

**Step 4: Commit**

```bash
git add apps/desktop/e2e/ui/
git commit -m "feat(e2e): add UI interaction tests for sidebar"
```

---

### Task 9: Add pre-build script for e2e

**Files:**
- Modify: `apps/desktop/package.json`

**Context:** E2E tests need the Electron app to be built first (`compile:app`). Add a prebuild step.

**Step 1: Add pre-test script**

Add to `apps/desktop/package.json` scripts:

```json
"pretest:e2e": "electron-vite build"
```

This ensures the app is compiled before any e2e test run.

**Step 2: Verify it works end-to-end**

```bash
cd /home/richard/work/AgentCoding/agent-coding && pnpm --filter my-electron-app test:e2e:mock
```

Expected: Build runs automatically, then tests execute.

**Step 3: Commit**

```bash
git add apps/desktop/package.json
git commit -m "chore: add pre-build step for e2e tests"
```

---

### Task 10: Document e2e testing in CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Add e2e testing commands to CLAUDE.md**

Add under the Desktop section:

```markdown
#### E2E Tests
```bash
pnpm --filter my-electron-app test:e2e           # All e2e tests (builds first)
pnpm --filter my-electron-app test:e2e:mock       # Mock tests only (no backend)
pnpm --filter my-electron-app test:e2e:integration # Integration (needs docker:up + backend)
```
```

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add e2e testing commands to CLAUDE.md"
```
