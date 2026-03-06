# Feature 0: Foundation — App Shell, API Client, Auth UI

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Set up the Electron app shell (3-panel macOS-style layout), API client layer, auth flow, and shared base components. This is the prerequisite for all feature screens.

**Architecture:** Electron window with hiddenInset title bar. React app with sidebar navigation, main content area, and collapsible inspector panel. HTTP client (fetch/ky) communicates with FastAPI backend. JWT auth with token storage in Electron's secure storage.

**Tech Stack:** Electron, React 19, React Router, Tailwind CSS v4, @agent-coding/ui (Radix UI, CVA, Lucide React)

**Depends on:** Backend already running (auth, projects endpoints exist), UI Primitives plan (packages/ui built)

**Design refs:**
- `docs/design/app-shell.md` — Layout spec
- `docs/design/design-system.md` — Tokens and rules
- `docs/design/components.md` — Component catalog
- `docs/plans/2026-03-07-ui-primitives.md` — UI component library

---

### Task 1: Run Alembic migration

**Files:**
- Verify: `apps/backend/alembic/` exists and is configured

**Step 1: Generate migration from current models**

Run: `cd apps/backend && uv run alembic revision --autogenerate -m "initial schema"`
Expected: Migration file created in `apps/backend/alembic/versions/`

**Step 2: Review the generated migration**

Read the generated file. Verify it creates all 20 tables matching models in `apps/backend/app/models/`.

**Step 3: Apply migration**

Run: `cd apps/backend && uv run alembic upgrade head`
Expected: All tables created in PostgreSQL

**Step 4: Run seed data**

Run: `cd apps/backend && uv run python -m app.seed`
Expected: 5 global agents + 3 workflow templates seeded

**Step 5: Verify backend starts**

Run: `cd apps/backend && uv run fastapi dev app/main.py --port 8000`
Expected: Server starts, `GET /health` returns `{"status": "ok"}`

**Step 6: Commit**

```bash
git add apps/backend/alembic/
git commit -m "feat(backend): add initial alembic migration"
```

---

### Task 2: API client module in frontend

**Files:**
- Create: `apps/desktop/src/renderer/lib/api-client.ts`
- Create: `apps/desktop/src/renderer/lib/auth.ts`
- Test: Manual — verify login flow works

**Step 1: Create the API client**

Create `apps/desktop/src/renderer/lib/api-client.ts`:

```typescript
const API_BASE = 'http://localhost:8000'

let accessToken: string | null = null

export function setToken(token: string | null) {
  accessToken = token
}

export function getToken(): string | null {
  return accessToken
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  }
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }))
    throw new Error(error.detail || `HTTP ${response.status}`)
  }

  if (response.status === 204) return undefined as T
  return response.json()
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}
```

**Step 2: Create auth module**

Create `apps/desktop/src/renderer/lib/auth.ts`:

```typescript
import { api, setToken } from './api-client'

interface TokenResponse {
  access_token: string
  token_type: string
  user: {
    id: string
    email: string
    name: string
    role: string
  }
}

export async function login(email: string, password: string) {
  const data = await api.post<TokenResponse>('/auth/login', { email, password })
  setToken(data.access_token)
  return data.user
}

export async function register(email: string, name: string, password: string) {
  const data = await api.post<TokenResponse>('/auth/register', { email, name, password })
  setToken(data.access_token)
  return data.user
}

export async function getMe() {
  return api.get<TokenResponse['user']>('/auth/me')
}

export function logout() {
  setToken(null)
}
```

**Step 3: Commit**

```bash
git add apps/desktop/src/renderer/lib/
git commit -m "feat(desktop): add API client and auth module"
```

---

### Task 3: Electron window configuration

**Files:**
- Modify: `apps/desktop/src/main/windows/main.ts`

**Step 1: Read current window config**

Read `apps/desktop/src/main/windows/main.ts` to see current configuration.

**Step 2: Update window config for macOS-style title bar**

Update the BrowserWindow options per `docs/design/app-shell.md`:

```typescript
{
  width: 1440,
  height: 900,
  minWidth: 1024,
  minHeight: 600,
  titleBarStyle: 'hiddenInset',
  trafficLightPosition: { x: 16, y: 12 },
  backgroundColor: '#1E1E1E',
}
```

**Step 3: Verify**

Run: `pnpm --filter my-electron-app dev`
Expected: Window opens with hidden title bar, traffic lights at correct position

**Step 4: Commit**

```bash
git add apps/desktop/src/main/windows/main.ts
git commit -m "feat(desktop): configure macOS-style window with hidden title bar"
```

---

### Task 4: App shell layout components

**Files:**
- Create: `apps/desktop/src/renderer/components/layout/sidebar.tsx`
- Create: `apps/desktop/src/renderer/components/layout/toolbar.tsx`
- Create: `apps/desktop/src/renderer/components/layout/status-bar.tsx`
- Create: `apps/desktop/src/renderer/components/layout/app-shell.tsx`

**UI imports from `@agent-coding/ui`:** `Button`, `StatusBadge`, `SearchField`, `ScrollArea`, `Separator`, `Tooltip`, `TooltipTrigger`, `TooltipContent`, `TooltipProvider`

**Step 1: Create Sidebar component**

Create `apps/desktop/src/renderer/components/layout/sidebar.tsx`:

```tsx
import { useState } from 'react'
import {
  FileCode2,
  GitBranch,
  MessageSquare,
  Settings,
  Sparkles,
  TestTube2,
} from 'lucide-react'
import { Button, ScrollArea, Separator, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@agent-coding/ui'

interface SidebarProps {
  currentRoute: string
  onNavigate: (route: string) => void
  collapsed?: boolean
}

const NAV_ITEMS = [
  { id: 'sessions', label: 'Sessions', icon: MessageSquare },
  { id: 'skills', label: 'Skills', icon: Sparkles },
  { id: 'worktrees', label: 'Worktrees', icon: GitBranch },
  { id: 'tests', label: 'Tests', icon: TestTube2 },
  { id: 'reviews', label: 'Reviews', icon: FileCode2 },
]

export function Sidebar({ currentRoute, onNavigate, collapsed }: SidebarProps) {
  return (
    <aside
      className="flex h-full flex-col border-r border-border bg-[var(--sidebar-bg)]"
      style={{ width: collapsed ? 48 : 240 }}
    >
      <div className="flex h-[52px] items-center px-4 pt-2" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
        {!collapsed && <span className="text-[13px] font-semibold text-foreground">Agent Coding</span>}
      </div>

      <ScrollArea className="flex-1">
        <nav className="space-y-1 px-2 py-2">
          <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {!collapsed && 'Workspace'}
          </p>
          <TooltipProvider delayDuration={0}>
            {NAV_ITEMS.map((item) => (
              <Tooltip key={item.id}>
                <TooltipTrigger asChild>
                  <Button
                    variant={currentRoute === item.id ? 'secondary' : 'ghost'}
                    size="sm"
                    className={`w-full justify-start gap-2 ${
                      currentRoute === item.id ? 'text-primary' : 'text-muted-foreground'
                    }`}
                    onClick={() => onNavigate(item.id)}
                  >
                    <item.icon size={16} />
                    {!collapsed && item.label}
                  </Button>
                </TooltipTrigger>
                {collapsed && <TooltipContent side="right">{item.label}</TooltipContent>}
              </Tooltip>
            ))}
          </TooltipProvider>
        </nav>
      </ScrollArea>

      <Separator />
      <div className="px-2 py-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-muted-foreground"
          onClick={() => onNavigate('settings')}
        >
          <Settings size={16} />
          {!collapsed && 'Settings'}
        </Button>
      </div>
    </aside>
  )
}
```

**Step 2: Create Toolbar component**

Create `apps/desktop/src/renderer/components/layout/toolbar.tsx`:

```tsx
import { Bell, Moon, Sun } from 'lucide-react'
import { Button, SearchField } from '@agent-coding/ui'

interface ToolbarProps {
  title?: string
  onToggleTheme?: () => void
  isDark?: boolean
}

export function Toolbar({ title, onToggleTheme, isDark = true }: ToolbarProps) {
  return (
    <header
      className="flex h-9 items-center justify-between border-b border-border bg-card/80 px-4 backdrop-blur-md"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div className="pl-16 text-[13px] font-semibold text-foreground">{title}</div>
      <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <Button variant="ghost" size="icon-xs">
          <Bell size={14} />
        </Button>
        <Button variant="ghost" size="icon-xs" onClick={onToggleTheme}>
          {isDark ? <Sun size={14} /> : <Moon size={14} />}
        </Button>
      </div>
    </header>
  )
}
```

**Step 3: Create StatusBar component**

Create `apps/desktop/src/renderer/components/layout/status-bar.tsx`:

```tsx
import { StatusBadge } from '@agent-coding/ui'

interface StatusBarProps {
  connected?: boolean
}

export function StatusBar({ connected = false }: StatusBarProps) {
  return (
    <footer className="flex h-7 items-center justify-between border-t border-border bg-card px-3 text-[11px] text-muted-foreground">
      <StatusBadge status={connected ? 'connected' : 'disconnected'}>
        {connected ? 'Connected' : 'Disconnected'}
      </StatusBadge>
      <span>v0.1.0</span>
    </footer>
  )
}
```

**Step 4: Create AppShell layout component**

Create `apps/desktop/src/renderer/components/layout/app-shell.tsx`:

```tsx
import { useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'

import { Sidebar } from './sidebar'
import { StatusBar } from './status-bar'
import { Toolbar } from './toolbar'

const ROUTE_TITLES: Record<string, string> = {
  sessions: 'Sessions',
  skills: 'Skills',
  worktrees: 'Worktrees',
  tests: 'Tests',
  reviews: 'Reviews',
  settings: 'Settings',
}

export function AppShell() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  const currentRoute = location.pathname.split('/')[1] || 'sessions'

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <Toolbar title={ROUTE_TITLES[currentRoute] || 'Agent Coding'} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          currentRoute={currentRoute}
          onNavigate={(route) => navigate(`/${route}`)}
          collapsed={sidebarCollapsed}
        />
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
      <StatusBar />
    </div>
  )
}
```

**Step 5: Commit**

```bash
git add apps/desktop/src/renderer/components/
git commit -m "feat(desktop): add app shell layout with @agent-coding/ui primitives"
```

---

### Task 5: Import CSS design tokens from UI package

**Files:**
- Modify: `apps/desktop/src/renderer/globals.css`

**Step 1: Read current globals.css**

Read `apps/desktop/src/renderer/globals.css`.

**Step 2: Import tokens from @agent-coding/ui**

The design system tokens (colors, spacing, typography, shadows) are defined in `packages/ui/src/globals.css` (see UI Primitives plan Task 1). The desktop app should import them rather than redefine:

```css
@import '@agent-coding/ui/globals.css';

/* App-specific overrides (if any) */
html {
  font-family: var(--font-sans);
}

body {
  @apply bg-background text-foreground;
}

/* Default to dark mode for Electron app */
html {
  @apply dark;
}
```

**Step 3: Commit**

```bash
git add apps/desktop/src/renderer/globals.css
git commit -m "feat(desktop): import design tokens from @agent-coding/ui"
```

---

### Task 6: Set up routing with app shell

**Files:**
- Modify: `apps/desktop/src/renderer/routes.tsx`
- Create: `apps/desktop/src/renderer/screens/sessions.tsx` (placeholder)
- Create: `apps/desktop/src/renderer/screens/skills.tsx` (placeholder)
- Create: `apps/desktop/src/renderer/screens/worktrees.tsx` (placeholder)
- Create: `apps/desktop/src/renderer/screens/tests.tsx` (placeholder)
- Create: `apps/desktop/src/renderer/screens/reviews.tsx` (placeholder)
- Create: `apps/desktop/src/renderer/screens/settings.tsx` (placeholder)

**Step 1: Create placeholder screens**

Each placeholder uses `EmptyState` from `@agent-coding/ui`:

```tsx
import { MessageSquare } from 'lucide-react'
import { EmptyState } from '@agent-coding/ui'

export function SessionsScreen() {
  return (
    <div className="flex h-full items-center justify-center">
      <EmptyState
        icon={MessageSquare}
        title="Sessions"
        description="Coming soon"
      />
    </div>
  )
}
```

Create one file per screen with the appropriate icon and name.

**Step 2: Update routes.tsx**

Wire the AppShell layout with nested routes:

```tsx
import { Route, Routes } from 'react-router-dom'

import { AppShell } from './components/layout/app-shell'
import { SessionsScreen } from './screens/sessions'
import { SkillsScreen } from './screens/skills'
import { WorktreesScreen } from './screens/worktrees'
import { TestsScreen } from './screens/tests'
import { ReviewsScreen } from './screens/reviews'
import { SettingsScreen } from './screens/settings'

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<SessionsScreen />} />
        <Route path="sessions" element={<SessionsScreen />} />
        <Route path="skills" element={<SkillsScreen />} />
        <Route path="worktrees" element={<WorktreesScreen />} />
        <Route path="tests" element={<TestsScreen />} />
        <Route path="reviews" element={<ReviewsScreen />} />
        <Route path="settings" element={<SettingsScreen />} />
      </Route>
    </Routes>
  )
}
```

**Step 3: Verify app renders with sidebar navigation**

Run: `pnpm --filter my-electron-app dev`
Expected: App opens with sidebar, clicking nav items switches screens

**Step 4: Commit**

```bash
git add apps/desktop/src/renderer/
git commit -m "feat(desktop): add routing with app shell and placeholder screens"
```

---

### Task 7: Login screen

**Files:**
- Create: `apps/desktop/src/renderer/screens/login.tsx`
- Modify: `apps/desktop/src/renderer/routes.tsx`

**UI imports from `@agent-coding/ui`:** `Button`, `Input`, `Label`, `Card`, `CardHeader`, `CardTitle`, `CardContent`, `CardFooter`, `Alert`, `AlertDescription`

**Step 1: Create login screen**

Create `apps/desktop/src/renderer/screens/login.tsx`:

```tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button,
  Input,
  Label,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
  Alert,
  AlertDescription,
} from '@agent-coding/ui'

import { login } from '../lib/auth'

export function LoginScreen() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/sessions')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <Card className="w-80">
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle className="text-center">Sign In</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
```

**Step 2: Add login route and auth guard**

Update routes to include login and redirect unauthenticated users.

**Step 3: Commit**

```bash
git add apps/desktop/src/renderer/screens/login.tsx apps/desktop/src/renderer/routes.tsx
git commit -m "feat(desktop): add login screen with @agent-coding/ui components"
```
