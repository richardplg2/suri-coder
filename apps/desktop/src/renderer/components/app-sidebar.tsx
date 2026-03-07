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
