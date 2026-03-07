import { Home, Folder } from 'lucide-react'
import { TabBar } from '@agent-coding/ui'
import type { Tab } from '@agent-coding/ui'
import { useTabStore } from 'renderer/stores/use-tab-store'
import type { AppTab } from 'renderer/types/tabs'
import { AppSidebar } from './app-sidebar'
import { useKeyboardShortcuts } from 'renderer/hooks/use-keyboard-shortcuts'

function tabToBarTab(tab: AppTab): Tab {
  switch (tab.type) {
    case 'home':
      return { id: tab.id, label: '', icon: <Home className="size-4" />, closable: false }
    case 'project':
      return { id: tab.id, label: '', icon: <Folder className="size-4" />, closable: true }
    case 'ticket':
      return { id: tab.id, label: tab.label, closable: true }
  }
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  useKeyboardShortcuts()
  const { tabs, activeTabId, setActiveTab, closeTab } = useTabStore()

  const barTabs = tabs.map(tabToBarTab)

  return (
    <div className="flex h-screen flex-col">
      {/* Toolbar + TabBar */}
      <div className="flex h-9 shrink-0 items-center border-b border-border bg-card app-drag">
        {/* Traffic light spacer (macOS) */}
        <div className="w-[78px] shrink-0" />
        <div className="flex-1 app-no-drag">
          <TabBar
            tabs={barTabs}
            activeTab={activeTabId}
            onTabChange={setActiveTab}
            onTabClose={closeTab}
          />
        </div>
      </div>

      {/* Main area: Sidebar + Content */}
      <div className="flex flex-1 overflow-hidden">
        <AppSidebar />
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  )
}
