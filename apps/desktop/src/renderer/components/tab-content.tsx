import { useTabStore } from 'renderer/stores/use-tab-store'
import { HomeScreen } from 'renderer/screens/home'
import { ProjectScreen } from 'renderer/screens/project'

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
      return <div className="p-6 text-muted-foreground">Ticket detail — Task 8</div>
  }
}
