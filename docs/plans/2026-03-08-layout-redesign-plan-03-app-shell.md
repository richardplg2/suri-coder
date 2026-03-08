# Layout Redesign — Plan 03: App Shell

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrate Rail into app layout, update sidebar visibility rules, and rewire tab-content routing.

**Architecture:** AppLayout gains Rail on left edge. Toolbar tabs read from scoped tab store using active project. Sidebar only shows for ticket detail (workflow steps). TabContent routes Home/Project/Ticket/Settings based on active project and active tab.

**Tech Stack:** React, Tailwind CSS, Zustand

**Depends on:** Plan 01 (types + stores), Plan 02 (Rail component)
**Blocks:** Nothing (final integration)

**Ref:** `docs/plans/2026-03-08-layout-redesign-design.md` §1 (Layout Architecture, Tab Scoping, Sidebar Visibility)

---

## Task 1: Update AppLayout

**Files:**
- Modify: `apps/desktop/src/renderer/components/app-layout.tsx`

**Step 1: Rewrite app-layout.tsx**

Key changes:
- Add Rail to left edge (before toolbar/sidebar/content)
- Toolbar reads tabs from `tabsByProject[activeProjectId]`
- Tab bar hidden when on Home (no active project)
- Remove `Home` and `Folder` icon imports (no longer used in tab bar)

```tsx
import { Search, Sun, Moon } from 'lucide-react'
import { TabBar, Button, Tooltip, TooltipTrigger, TooltipContent, TooltipProvider, Toaster } from '@agent-coding/ui'
import type { Tab } from '@agent-coding/ui'
import { useTabStore } from 'renderer/stores/use-tab-store'
import { useThemeStore } from 'renderer/stores/use-theme-store'
import { useProjectNavStore } from 'renderer/stores/use-project-nav-store'
import type { AppTab } from 'renderer/types/tabs'
import { Rail } from './rail'
import { AppSidebar } from './app-sidebar'
import { StatusBar } from './status-bar'
import { useKeyboardShortcuts } from 'renderer/hooks/use-keyboard-shortcuts'
import { NotificationDropdown } from './notification-dropdown'
import { useNotificationsWs } from 'renderer/hooks/use-notifications-ws'

function tabToBarTab(tab: AppTab): Tab {
  switch (tab.type) {
    case 'ticket':
      return { id: tab.id, label: tab.label, closable: true }
    case 'settings':
      return { id: tab.id, label: 'Settings', closable: true }
  }
}

const isMac = window.App?.platform === 'darwin'

export function AppLayout({ children }: { children: React.ReactNode }) {
  useKeyboardShortcuts()
  useNotificationsWs()
  const { activeProjectId } = useProjectNavStore()
  const { getProjectTabs, getActiveTabId, setActiveTab, closeTab } = useTabStore()
  const { theme, setTheme } = useThemeStore()

  const projectTabs = activeProjectId ? getProjectTabs(activeProjectId) : []
  const activeTabId = activeProjectId ? getActiveTabId(activeProjectId) : undefined
  const barTabs = projectTabs.map(tabToBarTab)

  return (
    <TooltipProvider delayDuration={400}>
      <div className="flex h-screen flex-col">
        {/* Toolbar — 36px, translucent */}
        <div className="flex h-9 shrink-0 items-center border-b border-border/50 glass-panel app-drag">
          {/* Traffic light spacer (macOS only) — offset by rail width */}
          {isMac && <div className="w-[78px] shrink-0" />}
          <div className="flex-1 app-no-drag">
            {activeProjectId && barTabs.length > 0 && (
              <TabBar
                tabs={barTabs}
                activeTab={activeTabId}
                onTabChange={(id) => setActiveTab(activeProjectId, id)}
                onTabClose={(id) => closeTab(activeProjectId, id)}
              />
            )}
          </div>
          {/* Right-side actions */}
          <div className="flex items-center gap-0.5 px-2 app-no-drag">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" className="size-7">
                  <Search className="size-3.5 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Search (Cmd+K)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <NotificationDropdown />
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom">Notifications</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-7"
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                >
                  {theme === 'dark' ? (
                    <Sun className="size-3.5 text-muted-foreground" />
                  ) : (
                    <Moon className="size-3.5 text-muted-foreground" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Toggle theme</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Main area: Rail + Sidebar + Content */}
        <div className="flex flex-1 overflow-hidden">
          <Rail />
          <AppSidebar />
          <main className="flex-1 overflow-hidden bg-background">
            {children}
          </main>
        </div>

        {/* Status bar */}
        <StatusBar />
      </div>

      <Toaster />
    </TooltipProvider>
  )
}
```

**Step 2: Commit**

```bash
git add apps/desktop/src/renderer/components/app-layout.tsx
git commit -m "feat: integrate Rail into app layout, scope toolbar tabs per project"
```

---

## Task 2: Update AppSidebar

**Files:**
- Modify: `apps/desktop/src/renderer/components/app-sidebar.tsx`

**Step 1: Update sidebar visibility rules**

Sidebar only shows for ticket detail now. Remove HomeSidebar and ProjectSidebar imports.

```tsx
import { cn } from '@agent-coding/ui'
import { useSidebarStore } from 'renderer/stores/use-sidebar-store'
import { useTabStore } from 'renderer/stores/use-tab-store'
import { useProjectNavStore } from 'renderer/stores/use-project-nav-store'
import { TicketSidebar } from './sidebar/ticket-sidebar'

export function AppSidebar() {
  const { isOpen } = useSidebarStore()
  const { activeProjectId } = useProjectNavStore()
  const { getProjectTabs, getActiveTabId } = useTabStore()

  const tabs = activeProjectId ? getProjectTabs(activeProjectId) : []
  const activeTabId = activeProjectId ? getActiveTabId(activeProjectId) : undefined
  const activeTab = tabs.find((t) => t.id === activeTabId)

  // Sidebar only visible for ticket tabs
  const showSidebar = isOpen && activeTab?.type === 'ticket'

  return (
    <aside
      className={cn(
        'shrink-0 border-r border-border/50 glass-panel bg-[var(--sidebar-bg)] transition-[width] duration-200 ease-out',
        showSidebar ? 'w-60' : 'w-0 overflow-hidden',
      )}
    >
      <div className="flex h-full flex-col">
        {activeTab?.type === 'ticket' && (
          <TicketSidebar ticketId={activeTab.ticketId} projectId={activeTab.projectId} />
        )}
      </div>
    </aside>
  )
}
```

**Step 2: Commit**

```bash
git add apps/desktop/src/renderer/components/app-sidebar.tsx
git commit -m "refactor: sidebar only shows for ticket detail (remove home/project sidebar)"
```

---

## Task 3: Update TabContent

**Files:**
- Modify: `apps/desktop/src/renderer/components/tab-content.tsx`

**Step 1: Rewrite tab content routing**

Route based on `activeProjectId` and active tab within that project. When no active project → Home. When active project but no tab → ProjectScreen (kanban). When active tab → route by tab type.

```tsx
import { useProjectNavStore } from 'renderer/stores/use-project-nav-store'
import { useTabStore } from 'renderer/stores/use-tab-store'
import { HomeScreen } from 'renderer/screens/home'
import { ProjectScreen } from 'renderer/screens/project'
import { TicketScreen } from 'renderer/screens/ticket'
import { SettingsScreen } from 'renderer/screens/settings'

export function TabContent() {
  const { activeProjectId } = useProjectNavStore()
  const { getProjectTabs, getActiveTabId } = useTabStore()

  // No active project → Home dashboard
  if (!activeProjectId) {
    return <HomeScreen />
  }

  const tabs = getProjectTabs(activeProjectId)
  const activeTabId = getActiveTabId(activeProjectId)
  const activeTab = tabs.find((t) => t.id === activeTabId)

  // Active project but no tab → Project screen (kanban)
  if (!activeTab) {
    return <ProjectScreen projectId={activeProjectId} />
  }

  // Route by tab type
  switch (activeTab.type) {
    case 'ticket':
      return <TicketScreen ticketId={activeTab.ticketId} projectId={activeTab.projectId} />
    case 'settings':
      return <SettingsScreen projectId={activeTab.projectId} />
  }
}
```

Key changes:
- Navigation now driven by `activeProjectId` (from rail) + active tab (from scoped tab store)
- Removed BrainstormScreen and FigmaImportScreen imports
- Added SettingsScreen import
- Home/Project shown based on project nav, not tab type

**Step 2: Commit**

```bash
git add apps/desktop/src/renderer/components/tab-content.tsx
git commit -m "refactor: tab content routing via project nav store + scoped tabs"
```

---

## Task 4: Clean Up Unused Sidebar Components

**Files:**
- Delete: `apps/desktop/src/renderer/components/sidebar/home-sidebar.tsx`
- Delete: `apps/desktop/src/renderer/components/sidebar/project-sidebar.tsx`

**Step 1: Delete files**

These are no longer imported anywhere after the AppSidebar update.

```bash
rm apps/desktop/src/renderer/components/sidebar/home-sidebar.tsx
rm apps/desktop/src/renderer/components/sidebar/project-sidebar.tsx
```

**Step 2: Commit**

```bash
git add -A apps/desktop/src/renderer/components/sidebar/
git commit -m "chore: remove unused home-sidebar and project-sidebar components"
```
