import { useTabStore } from 'renderer/stores/use-tab-store'
import { HomeScreen } from 'renderer/screens/home'
import { ProjectScreen } from 'renderer/screens/project'
import { TicketScreen } from 'renderer/screens/ticket'

export function TabContent() {
  const { tabs, activeTabId } = useTabStore()
  const activeTab = tabs.find((t) => t.id === activeTabId)

  if (!activeTab) return null

  switch (activeTab.type) {
    case 'home':
      return <HomeScreen />
    case 'project':
      return <ProjectScreen projectId={activeTab.projectId} />
    case 'ticket':
      return <TicketScreen ticketId={activeTab.ticketId} projectId={activeTab.projectId} />
  }
}
