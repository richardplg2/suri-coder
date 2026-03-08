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
  openFigmaTab: (projectId: string) => void
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

      openFigmaTab: (projectId) => {
        const { tabsByProject, activeTabByProject } = get()
        const tabs = tabsByProject[projectId] ?? []
        const tabId = `figma-${projectId}`
        const existing = tabs.find((t) => t.id === tabId)
        if (existing) {
          set({
            activeTabByProject: { ...activeTabByProject, [projectId]: tabId },
          })
          return
        }
        const newTab: AppTab = { id: tabId, type: 'figma', projectId, label: 'Figma Annotator' }
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
