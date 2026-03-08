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
