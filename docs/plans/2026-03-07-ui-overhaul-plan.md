# UI Overhaul Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all visual/structural gaps between current UI and the macOS-style design spec across 8 layers.

**Architecture:** Incremental layer-by-layer changes. Each layer builds on the previous. Window config first, then fonts, then app shell (toolbar + status bar), then sidebar, then screen polish, then dark mode wiring.

**Tech Stack:** Electron (main process), React 19, Tailwind v4, Zustand, Lucide React, shadcn/ui components from `@agent-coding/ui`.

**Design refs:**
- `docs/design/design-system.md` — colors, typography, spacing tokens
- `docs/design/app-shell.md` — layout structure, toolbar, sidebar, status bar
- `docs/design/components.md` — component specs

---

### Task 1: Fix Window Configuration

**Files:**
- Modify: `apps/desktop/src/main/windows/main.ts`

**Step 1: Update window settings**

Replace the `createWindow` call with proper sizing and platform-conditional macOS settings:

```ts
import { BrowserWindow } from 'electron'
import { join } from 'node:path'

import { createWindow } from 'lib/electron-app/factories/windows/create'
import { ENVIRONMENT } from 'shared/constants'
import { displayName } from '~/package.json'

export async function MainWindow() {
  const isMac = process.platform === 'darwin'

  const window = createWindow({
    id: 'main',
    title: displayName,
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 600,
    show: false,
    center: true,
    movable: true,
    resizable: true,
    autoHideMenuBar: true,
    backgroundColor: '#1E1E1E',

    ...(isMac && {
      titleBarStyle: 'hiddenInset' as const,
      trafficLightPosition: { x: 16, y: 12 },
      vibrancy: 'sidebar' as const,
    }),

    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
    },
  })

  window.webContents.on('did-finish-load', () => {
    if (ENVIRONMENT.IS_DEV) {
      window.webContents.openDevTools({ mode: 'detach' })
    }

    window.show()
  })

  window.on('close', () => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.destroy()
    }
  })

  return window
}
```

**Step 2: Verify**

Run: `pnpm --filter my-electron-app dev`
Expected: Window opens at 1440x900, resizable, no alwaysOnTop.

**Step 3: Commit**

```bash
git add apps/desktop/src/main/windows/main.ts
git commit -m "fix: window size 1440x900, resizable, macOS titlebar"
```

---

### Task 2: Expose Platform Info via Preload

**Files:**
- Modify: `apps/desktop/src/preload/index.ts`

**Step 1: Add platform to preload API**

```ts
import { contextBridge } from 'electron'

declare global {
  interface Window {
    App: typeof API
  }
}

const API = {
  platform: process.platform,
  username: process.env.USER,
}

contextBridge.exposeInMainWorld('App', API)
```

**Step 2: Commit**

```bash
git add apps/desktop/src/preload/index.ts
git commit -m "feat: expose platform in preload API"
```

---

### Task 3: Load Fonts

**Files:**
- Modify: `apps/desktop/src/renderer/index.html`
- Modify: `apps/desktop/src/renderer/globals.css`

**Step 1: Add Google Fonts to index.html**

Add inside `<head>`, before the closing `</head>`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />
```

Also update the CSP meta tag to allow Google Fonts:

```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self' *; script-src 'self' *; style-src 'self' 'unsafe-inline' *; font-src 'self' https://fonts.gstatic.com *;" />
```

**Step 2: Apply font-family in globals.css**

Add to the `body` rule inside `@layer base`:

```css
body {
  @apply bg-background text-foreground;
  font-family: var(--font-sans);
}
```

`--font-sans` is already defined in `packages/ui/src/globals.css` as `'Inter', -apple-system, ...`.

**Step 3: Verify**

Reload app. Text should render in Inter. Inspect in DevTools → Computed → font-family.

**Step 4: Commit**

```bash
git add apps/desktop/src/renderer/index.html apps/desktop/src/renderer/globals.css
git commit -m "feat: load Inter + JetBrains Mono fonts"
```

---

### Task 4: Wire Dark Mode to Theme Store

**Files:**
- Modify: `apps/desktop/src/renderer/index.tsx`

**Step 1: Add theme effect**

The `index.html` has `class="dark"` hardcoded. We need the theme store to control this. Add a `ThemeProvider` effect in `index.tsx`:

```tsx
import ReactDom from 'react-dom/client'
import React, { useEffect } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'

import { queryClient } from './lib/query-client'
import { AppRoutes } from './routes'
import { useThemeStore } from './stores/use-theme-store'

import './globals.css'

function ThemeSync() {
  const theme = useThemeStore((s) => s.theme)

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      root.classList.toggle('dark', prefersDark)
    } else {
      root.classList.toggle('dark', theme === 'dark')
    }
  }, [theme])

  return null
}

ReactDom.createRoot(document.querySelector('app') as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeSync />
      <AppRoutes />
    </QueryClientProvider>
  </React.StrictMode>,
)
```

**Step 2: Verify**

Open DevTools console, run: `localStorage.setItem('theme-store', JSON.stringify({state:{theme:'light'},version:0}))`
Reload. App should render in light mode.

**Step 3: Commit**

```bash
git add apps/desktop/src/renderer/index.tsx
git commit -m "feat: wire theme store to document class"
```

---

### Task 5: Enhance Toolbar

**Files:**
- Modify: `apps/desktop/src/renderer/components/app-layout.tsx`

**Step 1: Update toolbar with right-side actions**

```tsx
import { Home, Folder, Search, Bell, Sun, Moon } from 'lucide-react'
import { TabBar, Button, Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@agent-coding/ui'
import type { Tab } from '@agent-coding/ui'
import { useTabStore } from 'renderer/stores/use-tab-store'
import { useThemeStore } from 'renderer/stores/use-theme-store'
import type { AppTab } from 'renderer/types/tabs'
import { AppSidebar } from './app-sidebar'
import { StatusBar } from './status-bar'
import { useKeyboardShortcuts } from 'renderer/hooks/use-keyboard-shortcuts'

function tabToBarTab(tab: AppTab): Tab {
  switch (tab.type) {
    case 'home':
      return { id: tab.id, label: '', icon: <Home className="size-4" />, closable: false }
    case 'project':
      return { id: tab.id, label: '', icon: <Folder className="size-4" />, closable: true }
    case 'ticket':
      return { id: tab.id, label: tab.label, closable: true }
  }
}

const isMac = window.App?.platform === 'darwin'

export function AppLayout({ children }: { children: React.ReactNode }) {
  useKeyboardShortcuts()
  const { tabs, activeTabId, setActiveTab, closeTab } = useTabStore()
  const { theme, setTheme } = useThemeStore()

  const barTabs = tabs.map(tabToBarTab)

  return (
    <TooltipProvider delayDuration={400}>
      <div className="flex h-screen flex-col">
        {/* Toolbar + TabBar */}
        <div className="flex h-9 shrink-0 items-center border-b border-border bg-card app-drag">
          {/* Traffic light spacer (macOS only) */}
          {isMac && <div className="w-[78px] shrink-0" />}
          <div className="flex-1 app-no-drag">
            <TabBar
              tabs={barTabs}
              activeTab={activeTabId}
              onTabChange={setActiveTab}
              onTabClose={closeTab}
            />
          </div>
          {/* Right-side actions */}
          <div className="flex items-center gap-0.5 px-2 app-no-drag">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="size-7">
                  <Search className="size-4 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Search (Cmd+K)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="size-7">
                  <Bell className="size-4 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Notifications</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                >
                  {theme === 'dark' ? (
                    <Sun className="size-4 text-muted-foreground" />
                  ) : (
                    <Moon className="size-4 text-muted-foreground" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Toggle theme</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Main area: Sidebar + Content */}
        <div className="flex flex-1 overflow-hidden">
          <AppSidebar />
          <main className="flex-1 overflow-hidden">
            {children}
          </main>
        </div>

        {/* Status bar */}
        <StatusBar />
      </div>
    </TooltipProvider>
  )
}
```

**Step 2: Check that Tooltip components exist in @agent-coding/ui**

Run: `grep -r "Tooltip" packages/ui/src/ --include="*.tsx" -l`

If Tooltip is not exported, add it. shadcn/ui tooltip should already be available. If not:
```bash
cd packages/ui && npx shadcn@latest add tooltip
```

**Step 3: Verify**

Reload app. Toolbar should show search, bell, and theme toggle icons on the right. Theme toggle should switch between light and dark.

**Step 4: Commit**

```bash
git add apps/desktop/src/renderer/components/app-layout.tsx
git commit -m "feat: toolbar with search, notifications, theme toggle"
```

---

### Task 6: Create Status Bar

**Files:**
- Create: `apps/desktop/src/renderer/components/status-bar.tsx`

**Step 1: Create the status bar component**

```tsx
import { useEffect, useState } from 'react'
import { apiClient } from 'renderer/lib/api-client'

export function StatusBar() {
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    let mounted = true

    async function check() {
      try {
        await apiClient('/health')
        if (mounted) setConnected(true)
      } catch {
        if (mounted) setConnected(false)
      }
    }

    check()
    const interval = setInterval(check, 30_000)
    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [])

  return (
    <div className="flex h-7 shrink-0 items-center justify-between border-t border-border bg-card/50 px-3 text-[11px] text-muted-foreground">
      <div className="flex items-center gap-1.5">
        <span
          className={`inline-block size-2 rounded-full ${connected ? 'bg-[var(--success)]' : 'bg-[var(--destructive)]'}`}
        />
        <span>{connected ? 'Connected' : 'Disconnected'}</span>
      </div>
      <div className="flex items-center gap-3">
        <span>No active session</span>
      </div>
    </div>
  )
}
```

**Step 2: Verify**

Reload app. Bottom bar should appear with green dot and "Connected" (if backend running) or red dot and "Disconnected".

**Step 3: Commit**

```bash
git add apps/desktop/src/renderer/components/status-bar.tsx
git commit -m "feat: add bottom status bar with connection indicator"
```

---

### Task 7: Polish Sidebar

**Files:**
- Modify: `apps/desktop/src/renderer/components/app-sidebar.tsx`

**Step 1: Update sidebar styling**

```tsx
import { cn } from '@agent-coding/ui'
import { useSidebarStore } from 'renderer/stores/use-sidebar-store'
import { useTabStore } from 'renderer/stores/use-tab-store'
import { HomeSidebar } from './sidebar/home-sidebar'
import { ProjectSidebar } from './sidebar/project-sidebar'
import { TicketSidebar } from './sidebar/ticket-sidebar'

export function AppSidebar() {
  const { isOpen } = useSidebarStore()
  const { tabs, activeTabId } = useTabStore()
  const activeTab = tabs.find((t) => t.id === activeTabId)

  return (
    <aside
      className={cn(
        'shrink-0 border-r border-border transition-[width] duration-200',
        isOpen ? 'w-60' : 'w-0 overflow-hidden'
      )}
      style={{
        background: 'var(--sidebar-bg)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      {activeTab?.type === 'home' && <HomeSidebar />}
      {activeTab?.type === 'project' && (
        <ProjectSidebar projectName={activeTab.label} />
      )}
      {activeTab?.type === 'ticket' && (
        <TicketSidebar ticketId={activeTab.ticketId} projectId={activeTab.projectId} />
      )}
    </aside>
  )
}
```

**Step 2: Verify**

Reload. Sidebar should have a subtle semi-transparent background with blur.

**Step 3: Commit**

```bash
git add apps/desktop/src/renderer/components/app-sidebar.tsx
git commit -m "fix: sidebar vibrancy blur and proper background"
```

---

### Task 8: Screen Polish — Typography & Spacing

**Files:**
- Modify: `apps/desktop/src/renderer/screens/home.tsx`
- Modify: `apps/desktop/src/renderer/components/project-card.tsx`
- Modify: `apps/desktop/src/renderer/screens/project/tickets-board.tsx`
- Modify: `apps/desktop/src/renderer/screens/ticket.tsx`
- Modify: `apps/desktop/src/renderer/screens/project/project-settings.tsx`

**Step 1: Home screen — fix heading size**

In `home.tsx`, change:
```tsx
<h1 className="text-lg font-semibold">Projects</h1>
```
to:
```tsx
<h1 className="text-[13px] font-semibold">Projects</h1>
```

Design spec: Window Title is 13px/600.

**Step 2: Project card — fix border radius**

In `project-card.tsx`, the `Card` component should use 8px radius. Check if the Card component already uses `--radius-card`. If not, add:
```tsx
<Card
  className="cursor-pointer rounded-lg transition-colors hover:bg-secondary/50"
  onClick={onClick}
>
```

`rounded-lg` in Tailwind v4 maps to `var(--radius-lg)` which we set to `var(--radius)` = `0.375rem` (6px). For 8px we need `rounded-[8px]`:

```tsx
<Card
  className="cursor-pointer rounded-[8px] transition-colors hover:bg-secondary/50"
  onClick={onClick}
>
```

**Step 3: Tickets board — verify compact density**

In `tickets-board.tsx`, the toolbar height `h-10` (40px) is close to spec. The kanban card uses `p-3` (12px) which is fine. Verify column header uses 11px uppercase:
```tsx
<span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
```

Already has `text-xs` (12px) — change to `text-[11px]` and add `tracking-[0.06em]`.

**Step 4: Ticket screen — verify header**

In `ticket.tsx`, the ticket key uses `text-xs` — fine (12px). Title uses `text-base` (16px) — should be 13px for body or keep at 16px for a page title which is acceptable.

**Step 5: Settings screen — verify form spacing**

In `project-settings.tsx`, spacing looks correct with `space-y-4` and `space-y-6`. The `max-w-lg` keeps form centered and readable.

**Step 6: Commit**

```bash
git add apps/desktop/src/renderer/screens/home.tsx apps/desktop/src/renderer/components/project-card.tsx apps/desktop/src/renderer/screens/project/tickets-board.tsx
git commit -m "fix: typography and spacing to match design system"
```

---

### Task 9: Login Screen — Verify at New Size

**Files:**
- Modify: `apps/desktop/src/renderer/screens/login.tsx` (if needed)

**Step 1: Visual check**

At 1440px width, the `lg:flex` branding panel should be visible (lg = 1024px). Verify:
- Left panel gradient shows with logo + text
- Right panel form is centered
- Drag region covers top

**Step 2: Minor polish if needed**

The login screen should work correctly at the new size. Only change if something looks off visually.

**Step 3: Commit (only if changes made)**

```bash
git add apps/desktop/src/renderer/screens/login.tsx
git commit -m "fix: login screen polish at full window size"
```

---

### Task 10: Final Verification

**Step 1: Full visual review**

- [ ] Window opens at 1440x900, resizable
- [ ] Inter font renders throughout
- [ ] Toolbar: tabs + search/bell/theme icons on right
- [ ] Theme toggle switches light/dark correctly
- [ ] Status bar at bottom with connection indicator
- [ ] Sidebar has blur/vibrancy effect
- [ ] Login screen shows both panels
- [ ] Home screen: project cards with 8px radius
- [ ] Kanban board: proper section headers (11px uppercase)
- [ ] Dark and light mode both look correct

**Step 2: Run lint**

```bash
pnpm lint
pnpm typecheck
```

Fix any issues.

**Step 3: Final commit if needed**

```bash
git commit -m "fix: lint and type errors from UI overhaul"
```
