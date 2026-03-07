import { useEffect } from 'react'
import { useTabStore } from 'renderer/stores/use-tab-store'
import { useSidebarStore } from 'renderer/stores/use-sidebar-store'

export function useKeyboardShortcuts() {
  const { tabs, activeTabId, setActiveTab, closeTab } = useTabStore()
  const { toggle: toggleSidebar } = useSidebarStore()

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey

      // Cmd+W: close active tab
      if (mod && e.key === 'w') {
        e.preventDefault()
        if (activeTabId !== 'home') closeTab(activeTabId)
        return
      }

      // Cmd+B: toggle sidebar
      if (mod && e.key === 'b') {
        e.preventDefault()
        toggleSidebar()
        return
      }

      // Cmd+1-9: switch to tab by position
      if (mod && e.key >= '1' && e.key <= '9') {
        e.preventDefault()
        const index = Number.parseInt(e.key) - 1
        if (index < tabs.length) setActiveTab(tabs[index].id)
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [tabs, activeTabId, setActiveTab, closeTab, toggleSidebar])
}
