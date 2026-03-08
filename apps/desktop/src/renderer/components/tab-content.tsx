import { useProjectNavStore } from 'renderer/stores/use-project-nav-store'
import { useTabStore } from 'renderer/stores/use-tab-store'
import { HomeScreen } from 'renderer/screens/home'
import { ProjectScreen } from 'renderer/screens/project'
import { TicketScreen } from 'renderer/screens/ticket'
import { SettingsScreen } from 'renderer/screens/settings'
import { FigmaAnnotatorScreen } from 'renderer/screens/figma-annotator'

export function TabContent() {
  const activeProjectId = useProjectNavStore((s) => s.activeProjectId)
  const activeTab = useTabStore((s) => {
    if (!activeProjectId) return undefined
    const tabId = s.activeTabByProject[activeProjectId]
    if (!tabId) return undefined
    const tabs = s.tabsByProject[activeProjectId] ?? []
    return tabs.find((t) => t.id === tabId)
  })

  // No active project → Home dashboard
  if (!activeProjectId) {
    return <HomeScreen />
  }

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
    case 'figma':
      return <FigmaAnnotatorScreen projectId={activeTab.projectId} />
  }
}
