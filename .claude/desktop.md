# Desktop App (`apps/desktop`)

Electron + React + Tailwind v4, built with electron-vite (Vite 7).

## Build Targets

Three targets in `electron.vite.config.ts`:
- **main** — Electron main process (`src/main/`)
- **preload** — Preload scripts (`src/preload/`)
- **renderer** — React UI (`src/renderer/`)

## Path Aliases

Defined in `tsconfig.json`: `*` → `src/*`, `~/*` → `./*`.
So `import { foo } from 'main/something'` resolves to `src/main/something`.

## Renderer Architecture

```
src/renderer/
├── index.tsx              # Entry point
├── routes.tsx             # electron-router-dom routing
├── screens/               # Page-level components
├── stores/                # Zustand stores
├── hooks/queries/         # TanStack Query hooks
├── lib/
│   ├── api-client.ts      # Fetch wrapper
│   └── query-client.ts    # TanStack Query client
└── types/api.ts           # API response types
```

## State Management (Zustand)

Stores use `create` with `persist` middleware for local storage persistence:

```ts
export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({ theme: 'system', setTheme: (theme) => set({ theme }) }),
    { name: 'theme-store' },
  ),
)
```

Existing stores: `use-auth-store`, `use-theme-store`, `use-sidebar-store`, `use-modal-store`, `use-tab-store`.

## Data Fetching (TanStack Query)

All API calls go through `apiClient<T>(path, init?)` in `renderer/lib/api-client.ts`.

### Query Key Convention

Hierarchical, resource-based:
```ts
['projects']                                    // list
['projects', projectId]                         // detail
['projects', projectId, 'tickets']              // nested list
['projects', projectId, 'tickets', ticketId]    // nested detail
['projects', projectId, 'templates']            // nested list
```

### Hook Patterns

**Queries** — one hook per endpoint, `enabled` guard on IDs:
```ts
export function useTickets(projectId: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'tickets'],
    queryFn: () => apiClient<TicketListItem[]>(`/projects/${projectId}/tickets`),
    enabled: !!projectId,
  })
}
```

**Mutations** — invalidate related queries on success:
```ts
export function useCreateTicket(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: TicketCreate) =>
      apiClient<Ticket>(`/projects/${projectId}/tickets`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'tickets'] }),
  })
}
```

Hook files: `use-projects.ts`, `use-tickets.ts`, `use-workflows.ts` in `renderer/hooks/queries/`.

## Routing

Uses `electron-router-dom` (wrapper around react-router-dom for Electron):
```tsx
<Router main={<Route element={<MainScreen />} path="/" />} />
```

## E2E Testing (Playwright)

Tests live in `e2e/` with Playwright launching Electron via `_electron.launch()`.

```
e2e/
├── playwright.config.ts     # Two projects: mock, integration
├── fixtures/
│   ├── app.fixture.ts       # Electron launch + cleanup (clears localStorage)
│   ├── mock-api.fixture.ts  # Route interception for localhost:8001
│   ├── auth.fixture.ts      # Pre-authenticated page via Zustand persist
│   └── integration.fixture.ts # Real backend health check
├── flows/                   # Mock tests: login, home, project creation
├── ui/                      # Mock tests: sidebar, layout
└── integration/             # Integration tests (needs running backend)
```

The single instance lock in `src/lib/electron-app/factories/app/instance.ts` is skipped when `NODE_ENV=test`.

Fixtures chain: `app` → `mock-api` → `auth`. Each test clears `localStorage` to prevent state leaks between runs.

### Writing E2E Tests

**Choose the right fixture:**
- `app.fixture` — test the login screen or unauthenticated flows
- `mock-api.fixture` — test flows that call the API (login, data fetching) without a real backend
- `auth.fixture` — test authenticated screens (home, project, settings) with pre-injected auth
- `integration.fixture` — test against a real running backend

**Selectors:** Use Playwright's role-based locators (`getByRole`, `getByLabel`, `getByText`). Avoid CSS selectors. When multiple elements match, use `.first()` or be more specific (e.g. `getByRole('heading', { name: 'Projects' })` instead of `getByText('Projects')`).

**Adding API mocks:** Override specific routes in the test body after the fixture sets up the catch-all:
```ts
await appPage.route('http://localhost:8001/some/endpoint', async (route) => {
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) })
})
```

**File placement:**
- `e2e/flows/*.spec.ts` — user flow tests (mock project)
- `e2e/ui/*.spec.ts` — UI interaction tests (mock project)
- `e2e/integration/*.spec.ts` — real backend tests (integration project)

**Prerequisites:** The Electron app must be built before running e2e tests. The `pretest:e2e` script handles this automatically. Workspace packages (`@agent-coding/shared`, `@agent-coding/ui`) must also be built.

**Destructured fixture params that aren't read directly (e.g. `mockApi`, `authedPage`) still must be included** — they trigger fixture setup as a side effect.
