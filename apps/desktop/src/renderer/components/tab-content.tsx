import { useProjectNavStore } from 'renderer/stores/use-project-nav-store'
import { useTabStore } from 'renderer/stores/use-tab-store'
import { HomeScreen } from 'renderer/screens/home'
import { ProjectScreen } from 'renderer/screens/project'
import { TicketScreen } from 'renderer/screens/ticket'
import { SettingsScreen } from 'renderer/screens/settings'

export function TabContent() {
  const { activeProjectId } = useProjectNavStore()
  const { getProjectTabs, getActiveTabId } = useTabStore()

  // No active project → Home dashboard
  if (!activeProjectId) {
    return <HomeScreen />
  }

  const tabs = getProjectTabs(activeProjectId)
  const activeTabId = getActiveTabId(activeProjectId)
  const activeTab = tabs.find((t) => t.id === activeTabId)

  // Active project but no tab → Project screen (kanban)
  if (!activeTab) {
    return <ProjectScreen projectId={activeProjectId} />
  }

  // Route by tab type
  switch (activeTab.type) {
    case 'ticket':
      return <TicketScreen ticketId={activeTab.ticketId} projectId={activeTab.projectId} />
    case 'settings':
      return <SettingsScreen projectId={activeTab.projectId} />
  }
}
