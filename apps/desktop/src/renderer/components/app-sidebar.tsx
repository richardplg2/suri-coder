import { cn } from '@agent-coding/ui'
import { useSidebarStore } from 'renderer/stores/use-sidebar-store'
import { useTabStore } from 'renderer/stores/use-tab-store'
import { useProjectNavStore } from 'renderer/stores/use-project-nav-store'
import { TicketSidebar } from './sidebar/ticket-sidebar'

export function AppSidebar() {
  const { isOpen } = useSidebarStore()
  const activeProjectId = useProjectNavStore((s) => s.activeProjectId)
  const activeTabId = useTabStore((s) => activeProjectId ? s.activeTabByProject[activeProjectId] : undefined)
  const activeTab = useTabStore((s) => {
    if (!activeProjectId) return undefined
    const tabs = s.tabsByProject[activeProjectId] ?? []
    return tabs.find((t) => t.id === activeTabId)
  })

  // Sidebar only visible for ticket tabs
  const showSidebar = isOpen && activeTab?.type === 'ticket'

  return (
    <aside
      className={cn(
        'shrink-0 border-r border-border glass-effect transition-[width] duration-200 ease-out z-10',
        showSidebar ? 'w-[240px]' : 'w-0 overflow-hidden'
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
