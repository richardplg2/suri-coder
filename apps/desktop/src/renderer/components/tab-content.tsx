import { useTabStore } from 'renderer/stores/use-tab-store'
import { HomeScreen } from 'renderer/screens/home'
import { ProjectScreen } from 'renderer/screens/project'
import { TicketScreen } from 'renderer/screens/ticket'
import { BrainstormScreen } from 'renderer/screens/brainstorm'

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
    case 'brainstorm':
      return <BrainstormScreen projectId={activeTab.projectId} />
    case 'figma-import':
      return <div className="flex h-full items-center justify-center text-muted-foreground">Figma Import — coming soon (Plan 10)</div>
  }
}
