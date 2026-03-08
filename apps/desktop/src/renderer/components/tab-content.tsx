import { useTabStore } from 'renderer/stores/use-tab-store'
import { useProjectNavStore } from 'renderer/stores/use-project-nav-store'
import { HomeScreen } from 'renderer/screens/home'
import { ProjectScreen } from 'renderer/screens/project'
import { TicketScreen } from 'renderer/screens/ticket'

export function TabContent() {
  const activeProjectId = useProjectNavStore((s) => s.activeProjectId)
  const activeTab = useTabStore((s) => {
    if (!activeProjectId) return undefined
    const tabId = s.activeTabByProject[activeProjectId]
    if (!tabId) return undefined
    const tabs = s.tabsByProject[activeProjectId] ?? []
    return tabs.find((t) => t.id === tabId)
  })

  // No project selected — show home
  if (!activeProjectId) return <HomeScreen />

  // Project selected but no active tab — show project kanban
  if (!activeTab) return <ProjectScreen projectId={activeProjectId} />

  switch (activeTab.type) {
    case 'home':
      return <HomeScreen />
    case 'ticket':
      return <TicketScreen ticketId={activeTab.ticketId} projectId={activeTab.projectId} />
    case 'settings':
      return <ProjectScreen projectId={activeProjectId} />
  }
}
