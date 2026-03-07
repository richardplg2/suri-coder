# E2E Testing for Desktop App

Date: 2026-03-07

## Goal

Set up end-to-end testing for the Electron desktop app using Playwright, with Claude Code MCP integration for interactive debugging and verification.

## Architecture

```
apps/desktop/
├── e2e/
│   ├── fixtures/              # Shared test fixtures
│   │   ├── app.fixture.ts     # Launch Electron, return app + page
│   │   ├── auth.fixture.ts    # Pre-authenticated page
│   │   ├── mock-api.fixture.ts # Route interception with default responses
│   │   └── integration.fixture.ts # Backend verification + test data seeding
│   ├── flows/                 # Critical user flow tests
│   │   ├── login.spec.ts
│   │   ├── project.spec.ts
│   │   └── ticket.spec.ts
│   ├── ui/                    # UI interaction tests
│   │   ├── sidebar.spec.ts
│   │   ├── modal.spec.ts
│   │   └── tabs.spec.ts
│   ├── integration/           # Full integration tests (needs backend)
│   │   ├── auth-flow.spec.ts
│   │   ├── project-crud.spec.ts
│   │   └── ticket-workflow.spec.ts
│   └── playwright.config.ts
```

## Test Layers

| Layer | Backend | Speed | Scope |
|-------|---------|-------|-------|
| UI tests (`e2e/ui/`) | Mock (route intercept) | Fast ~1-2s/test | Modal, sidebar, tabs, navigation |
| Flow tests (`e2e/flows/`) | Mock | Medium ~3-5s/test | Login, create project, create ticket |
| Integration tests (`e2e/integration/`) | Real (docker + FastAPI) | Slow ~5-10s/test | Full flows with real DB |

## Electron Launch Strategy

Use Playwright's `_electron.launch()` to start the actual Electron app. This tests:

- Window configuration (700x473, non-resizable)
- Preload scripts and context isolation
- Auth flow with real Electron BrowserWindow
- IPC communication (current and future)

## Playwright Config

Two projects configured:

- **mock** — runs `e2e/flows/` and `e2e/ui/`, no backend needed
- **integration** — runs `e2e/integration/`, requires docker + FastAPI running

## Fixtures

### appFixture
Launch Electron app, return `ElectronApplication` and first `Page`. Teardown closes the app.

### authFixture
Extends appFixture. Performs login via the login form or injects auth token into Zustand store. Returns authenticated page ready for testing.

### mockApiFixture
Sets up `page.route()` interception for API calls to `localhost:8000`. Provides default responses for common endpoints (projects list, tickets list, user info). Individual tests can override specific routes.

### integrationFixture
Verifies backend is running (health check). Seeds test database with known data. Cleans up after test run.

## Claude Code Integration

### CLI Commands
```bash
pnpm --filter my-electron-app test:e2e              # All tests
pnpm --filter my-electron-app test:e2e:mock          # Mock tests only (fast)
pnpm --filter my-electron-app test:e2e:integration   # Integration tests (needs backend)
```

### MCP Tools for Interactive Testing
Claude Code has Playwright and Chrome DevTools MCP servers available. Use these for:

- Taking screenshots to verify UI state during development
- Inspecting DOM elements when writing new test selectors
- Debugging test failures by stepping through interactions
- Ad-hoc verification of new features before writing formal tests

### Workflow
```
Implement feature
  -> Claude Code runs test suite (pnpm test:e2e:mock)
  -> If fail: use MCP tools to screenshot/inspect and debug
  -> Fix and re-run
  -> If new feature without tests: use MCP tools to explore UI -> write new test
```

## Test Priority

1. Login flow — open app, login form, submit, redirect to home
2. Project CRUD — create project, view list, click into project
3. Ticket workflow — create ticket, view detail, run workflow steps
4. UI interactions — sidebar toggle, tab switching, modal open/close
5. Error handling — 401 auto-logout, API error display

## Scripts (package.json additions)

```json
{
  "test:e2e": "playwright test --config=e2e/playwright.config.ts",
  "test:e2e:mock": "playwright test --config=e2e/playwright.config.ts --project=mock",
  "test:e2e:integration": "playwright test --config=e2e/playwright.config.ts --project=integration"
}
```

## Dependencies

- `@playwright/test` — test runner with Electron support
- `electron` (already installed) — launched by Playwright
