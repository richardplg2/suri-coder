import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AppTab } from 'renderer/types/tabs'

interface TabStore {
  tabs: AppTab[]
  activeTabId: string
  openProjectTab: (projectId: string, label: string) => void
  openTicketTab: (ticketId: string, projectId: string, label: string) => void
  closeTab: (id: string) => void
  setActiveTab: (id: string) => void
  updateTabLabel: (id: string, label: string) => void
}

const HOME_TAB: AppTab = { id: 'home', type: 'home', label: 'Home', pinned: true }

export const useTabStore = create<TabStore>()(
  persist(
    (set, get) => ({
      tabs: [HOME_TAB],
      activeTabId: 'home',

      openProjectTab: (projectId, label) => {
        const { tabs } = get()
        const tabId = `project-${projectId}`
        const existing = tabs.find((t) => t.id === tabId)
        if (existing) {
          set({ activeTabId: tabId })
          return
        }
        const newTab: AppTab = { id: tabId, type: 'project', projectId, label, pinned: true }
        // Insert pinned tabs after other pinned tabs, before regular tabs
        const lastPinnedIndex = tabs.findLastIndex((t) => t.pinned)
        const newTabs = [...tabs]
        newTabs.splice(lastPinnedIndex + 1, 0, newTab)
        set({ tabs: newTabs, activeTabId: tabId })
      },

      openTicketTab: (ticketId, projectId, label) => {
        const { tabs } = get()
        const tabId = `ticket-${ticketId}`
        const existing = tabs.find((t) => t.id === tabId)
        if (existing) {
          set({ activeTabId: tabId })
          return
        }
        const newTab: AppTab = { id: tabId, type: 'ticket', ticketId, projectId, label, pinned: false }
        set({ tabs: [...tabs, newTab], activeTabId: tabId })
      },

      closeTab: (id) => {
        if (id === 'home') return
        const { tabs, activeTabId } = get()
        const index = tabs.findIndex((t) => t.id === id)
        const newTabs = tabs.filter((t) => t.id !== id)
        if (activeTabId === id) {
          const nextIndex = Math.min(index, newTabs.length - 1)
          set({ tabs: newTabs, activeTabId: newTabs[nextIndex].id })
        } else {
          set({ tabs: newTabs })
        }
      },

      setActiveTab: (id) => set({ activeTabId: id }),

      updateTabLabel: (id, label) => {
        set({
          tabs: get().tabs.map((t) => {
            if (t.id !== id || t.type === 'home') return t
            return { ...t, label } as AppTab
          }),
        })
      },
    }),
    { name: 'tab-store' },
  ),
)
