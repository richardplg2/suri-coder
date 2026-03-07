import { useTabStore } from 'renderer/stores/use-tab-store'
import { HomeScreen } from 'renderer/screens/home'

export function TabContent() {
  const { tabs, activeTabId } = useTabStore()
  const activeTab = tabs.find((t) => t.id === activeTabId)

  if (!activeTab) return null

  switch (activeTab.type) {
    case 'home':
      return <HomeScreen />
    case 'project':
      return <div className="p-6 text-muted-foreground">Project: {activeTab.projectId}</div>
    case 'ticket':
      return <div className="p-6 text-muted-foreground">Ticket: {activeTab.ticketId}</div>
  }
}
