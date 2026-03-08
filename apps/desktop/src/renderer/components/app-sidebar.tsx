import { cn } from '@agent-coding/ui'
import { useSidebarStore } from 'renderer/stores/use-sidebar-store'
import { useTabStore } from 'renderer/stores/use-tab-store'
import { useProjectNavStore } from 'renderer/stores/use-project-nav-store'
import { HomeSidebar } from './sidebar/home-sidebar'
import { ProjectSidebar } from './sidebar/project-sidebar'
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

  return (
    <aside
      className={cn(
        'shrink-0 border-r border-border/50 glass-panel bg-[var(--sidebar-bg)] transition-[width] duration-200 ease-out',
        isOpen ? 'w-60' : 'w-0 overflow-hidden'
      )}
    >
      <div className="flex h-full flex-col">
        {!activeProjectId && <HomeSidebar />}
        {activeProjectId && !activeTab && (
          <ProjectSidebar projectId={activeProjectId} />
        )}
        {activeTab?.type === 'ticket' && (
          <TicketSidebar ticketId={activeTab.ticketId} projectId={activeTab.projectId} />
        )}
        {activeTab?.type === 'settings' && (
          <ProjectSidebar projectId={activeProjectId!} />
        )}
      </div>
    </aside>
  )
}
