import { useEffect, useMemo } from 'react'
import { useTabStore } from 'renderer/stores/use-tab-store'
import { useProjectNavStore } from 'renderer/stores/use-project-nav-store'
import { useSidebarStore } from 'renderer/stores/use-sidebar-store'
import { useInspectorStore } from 'renderer/stores/use-inspector-store'

export function useKeyboardShortcuts() {
  const activeProjectId = useProjectNavStore((s) => s.activeProjectId)
  const rawTabs = useTabStore((s) => activeProjectId ? s.tabsByProject[activeProjectId] : undefined)
  const tabs = useMemo(() => rawTabs ?? [], [rawTabs])
  const activeTabId = useTabStore((s) => activeProjectId ? s.activeTabByProject[activeProjectId] : undefined)
  const { setActiveTab, closeTab } = useTabStore()
  const { toggle: toggleSidebar } = useSidebarStore()
  const { toggle: toggleInspector } = useInspectorStore()

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey

      // Cmd+W: close active tab
      if (mod && e.key === 'w') {
        e.preventDefault()
        if (activeProjectId && activeTabId) closeTab(activeProjectId, activeTabId)
        return
      }

      // Cmd+B: toggle sidebar
      if (mod && e.key === 'b') {
        e.preventDefault()
        toggleSidebar()
        return
      }

      // Cmd+I: toggle inspector
      if (mod && e.key === 'i') {
        e.preventDefault()
        toggleInspector()
        return
      }

      // Cmd+1-9: switch to tab by position
      if (mod && e.key >= '1' && e.key <= '9') {
        e.preventDefault()
        const index = Number.parseInt(e.key) - 1
        if (activeProjectId && index < tabs.length) setActiveTab(activeProjectId, tabs[index].id)
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [tabs, activeTabId, activeProjectId, setActiveTab, closeTab, toggleSidebar, toggleInspector])
}
