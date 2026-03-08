# Layout Redesign — Plan 01: Types + Stores

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor the type system and state stores to support project rail navigation and per-project tab scoping.

**Architecture:** Replace flat tab array with per-project `Map`. Add new project nav store. Remove `activeNav` from sidebar store (no longer needed). Remove BrainstormTab/FigmaImportTab types, add SettingsTab.

**Tech Stack:** TypeScript, Zustand with persist middleware

**Depends on:** Nothing (foundation layer)
**Blocks:** Plans 02, 03, 04, 05, 06

---

## Task 1: Update Tab Types

**Files:**
- Modify: `apps/desktop/src/renderer/types/tabs.ts`

**Step 1: Rewrite tab types**

Replace the entire file:

```typescript
export type TabType = 'home' | 'ticket' | 'settings'

export interface HomeTab {
  id: 'home'
  type: 'home'
  label: 'Home'
}

export interface TicketTab {
  id: string
  type: 'ticket'
  ticketId: string
  projectId: string
  label: string
}

export interface SettingsTab {
  id: string
  type: 'settings'
  projectId: string
  label: 'Settings'
}

export type AppTab = HomeTab | TicketTab | SettingsTab
```

Key changes:
- Removed `ProjectTab`, `BrainstormTab`, `FigmaImportTab`
- Removed `pinned` field (no longer relevant — home is on rail, project tabs are scoped)
- Added `SettingsTab`
- Only 3 tab types remain

**Step 2: Commit**

```bash
git add apps/desktop/src/renderer/types/tabs.ts
git commit -m "refactor: simplify tab types for rail layout (remove brainstorm/figma/project tabs, add settings)"
```

---

## Task 2: Create Project Nav Store

**Files:**
- Create: `apps/desktop/src/renderer/stores/use-project-nav-store.ts`

**Step 1: Write the store**

```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ProjectNavStore {
  activeProjectId: string | null
  setActiveProject: (id: string | null) => void
}

export const useProjectNavStore = create<ProjectNavStore>()(
  persist(
    (set) => ({
      activeProjectId: null,
      setActiveProject: (id) => set({ activeProjectId: id }),
    }),
    { name: 'project-nav-store' },
  ),
)
```

Note: `projectOrder` deferred — use query order from `useProjects()` for now.

**Step 2: Commit**

```bash
git add apps/desktop/src/renderer/stores/use-project-nav-store.ts
git commit -m "feat: add project nav store for rail navigation"
```

---

## Task 3: Rewrite Tab Store

**Files:**
- Modify: `apps/desktop/src/renderer/stores/use-tab-store.ts`

**Step 1: Rewrite the store**

Replace the entire file. The new store scopes tabs per project:

```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AppTab } from 'renderer/types/tabs'

interface TabStore {
  // Per-project tab state
  tabsByProject: Record<string, AppTab[]>
  activeTabByProject: Record<string, string>

  // Actions
  openTicketTab: (projectId: string, ticketId: string, label: string) => void
  openSettingsTab: (projectId: string) => void
  closeTab: (projectId: string, tabId: string) => void
  setActiveTab: (projectId: string, tabId: string) => void
  updateTabLabel: (projectId: string, tabId: string, label: string) => void
  getProjectTabs: (projectId: string) => AppTab[]
  getActiveTabId: (projectId: string) => string | undefined
}

export const useTabStore = create<TabStore>()(
  persist(
    (set, get) => ({
      tabsByProject: {},
      activeTabByProject: {},

      openTicketTab: (projectId, ticketId, label) => {
        const { tabsByProject, activeTabByProject } = get()
        const tabs = tabsByProject[projectId] ?? []
        const tabId = `ticket-${ticketId}`
        const existing = tabs.find((t) => t.id === tabId)
        if (existing) {
          set({
            activeTabByProject: { ...activeTabByProject, [projectId]: tabId },
          })
          return
        }
        const newTab: AppTab = { id: tabId, type: 'ticket', ticketId, projectId, label }
        set({
          tabsByProject: { ...tabsByProject, [projectId]: [...tabs, newTab] },
          activeTabByProject: { ...activeTabByProject, [projectId]: tabId },
        })
      },

      openSettingsTab: (projectId) => {
        const { tabsByProject, activeTabByProject } = get()
        const tabs = tabsByProject[projectId] ?? []
        const tabId = `settings-${projectId}`
        const existing = tabs.find((t) => t.id === tabId)
        if (existing) {
          set({
            activeTabByProject: { ...activeTabByProject, [projectId]: tabId },
          })
          return
        }
        const newTab: AppTab = { id: tabId, type: 'settings', projectId, label: 'Settings' }
        set({
          tabsByProject: { ...tabsByProject, [projectId]: [...tabs, newTab] },
          activeTabByProject: { ...activeTabByProject, [projectId]: tabId },
        })
      },

      closeTab: (projectId, tabId) => {
        const { tabsByProject, activeTabByProject } = get()
        const tabs = tabsByProject[projectId] ?? []
        const index = tabs.findIndex((t) => t.id === tabId)
        if (index === -1) return
        const newTabs = tabs.filter((t) => t.id !== tabId)
        const updates: Partial<TabStore> = {
          tabsByProject: { ...tabsByProject, [projectId]: newTabs },
        }
        if (activeTabByProject[projectId] === tabId) {
          // Select adjacent tab or clear
          if (newTabs.length > 0) {
            const nextIndex = Math.min(index, newTabs.length - 1)
            updates.activeTabByProject = {
              ...activeTabByProject,
              [projectId]: newTabs[nextIndex].id,
            }
          } else {
            const { [projectId]: _, ...rest } = activeTabByProject
            updates.activeTabByProject = rest
          }
        }
        set(updates as TabStore)
      },

      setActiveTab: (projectId, tabId) => {
        set({
          activeTabByProject: { ...get().activeTabByProject, [projectId]: tabId },
        })
      },

      updateTabLabel: (projectId, tabId, label) => {
        const { tabsByProject } = get()
        const tabs = tabsByProject[projectId] ?? []
        set({
          tabsByProject: {
            ...tabsByProject,
            [projectId]: tabs.map((t) =>
              t.id === tabId && t.type === 'ticket' ? { ...t, label } : t,
            ),
          },
        })
      },

      getProjectTabs: (projectId) => {
        return get().tabsByProject[projectId] ?? []
      },

      getActiveTabId: (projectId) => {
        return get().activeTabByProject[projectId]
      },
    }),
    { name: 'tab-store' },
  ),
)
```

Key changes:
- `tabs: AppTab[]` → `tabsByProject: Record<string, AppTab[]>`
- `activeTabId: string` → `activeTabByProject: Record<string, string>`
- All actions now take `projectId` as first param
- Removed `openProjectTab`, `openBrainstormTab`, `openFigmaImportTab`
- Added `openSettingsTab`, `getProjectTabs`, `getActiveTabId`
- When closing last tab, active tab clears (shows kanban default)

**Step 2: Commit**

```bash
git add apps/desktop/src/renderer/stores/use-tab-store.ts
git commit -m "refactor: scope tab store per project for rail navigation"
```

---

## Task 4: Simplify Sidebar Store

**Files:**
- Modify: `apps/desktop/src/renderer/stores/use-sidebar-store.ts`

**Step 1: Remove activeNav**

Replace the entire file:

```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SidebarStore {
  isOpen: boolean
  toggle: () => void
}

export const useSidebarStore = create<SidebarStore>()(
  persist(
    (set) => ({
      isOpen: true,
      toggle: () => set((s) => ({ isOpen: !s.isOpen })),
    }),
    { name: 'sidebar-store' },
  ),
)
```

`activeNav` is no longer needed — project sub-navigation (Tickets, Repos, Agents, etc.) is replaced by a consolidated Settings tab.

**Step 2: Commit**

```bash
git add apps/desktop/src/renderer/stores/use-sidebar-store.ts
git commit -m "refactor: remove activeNav from sidebar store (settings is now a tab)"
```
