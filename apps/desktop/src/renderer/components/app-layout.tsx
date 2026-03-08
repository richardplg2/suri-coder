import { useMemo } from 'react'
import { Search, Sun, Moon } from 'lucide-react'
import { TabBar, Button, Tooltip, TooltipTrigger, TooltipContent, TooltipProvider, Toaster } from '@agent-coding/ui'
import type { Tab } from '@agent-coding/ui'
import { useTabStore } from 'renderer/stores/use-tab-store'
import { useThemeStore } from 'renderer/stores/use-theme-store'
import { useProjectNavStore } from 'renderer/stores/use-project-nav-store'
import type { AppTab } from 'renderer/types/tabs'
import { Rail } from './rail'
import { AppSidebar } from './app-sidebar'
import { StatusBar } from './status-bar'
import { InspectorPanel } from './inspector-panel'
import { useKeyboardShortcuts } from 'renderer/hooks/use-keyboard-shortcuts'
import { NotificationDropdown } from './notification-dropdown'
import { useNotificationsWs } from 'renderer/hooks/use-notifications-ws'

function tabToBarTab(tab: AppTab): Tab | null {
  switch (tab.type) {
    case 'ticket':
      return { id: tab.id, label: tab.label, closable: true }
    case 'settings':
      return { id: tab.id, label: 'Settings', closable: true }
    default:
      return null
  }
}

const isMac = window.App?.platform === 'darwin'

export function AppLayout({ children }: { children: React.ReactNode }) {
  useKeyboardShortcuts()
  useNotificationsWs()
  const activeProjectId = useProjectNavStore((s) => s.activeProjectId)
  const rawTabs = useTabStore((s) => activeProjectId ? s.tabsByProject[activeProjectId] : undefined)
  const projectTabs = useMemo(() => rawTabs ?? [], [rawTabs])
  const activeTabId = useTabStore((s) => activeProjectId ? s.activeTabByProject[activeProjectId] : undefined)
  const { setActiveTab, closeTab } = useTabStore()
  const { theme, setTheme } = useThemeStore()

  const barTabs = projectTabs.map(tabToBarTab).filter((t): t is Tab => t !== null)

  return (
    <TooltipProvider delayDuration={400}>
      <div className="flex flex-col h-screen overflow-hidden bg-background text-foreground">
        {/* Toolbar — 36px, translucent */}
        <header className="flex h-[36px] shrink-0 items-center justify-between border-b border-border px-3 glass-effect app-drag">
          <div className="flex items-center gap-2 w-48">
            {/* Traffic light spacer (macOS only) — offset by rail width */}
            {isMac && <div className="w-[78px] shrink-0" />}
          </div>
          <div className="flex items-center justify-center flex-1 app-no-drag">
            {activeProjectId && barTabs.length > 0 && (
              <TabBar
                tabs={barTabs}
                activeTab={activeTabId ?? ''}
                onTabChange={(id) => setActiveTab(activeProjectId, id)}
                onTabClose={(id) => closeTab(activeProjectId, id)}
              />
            )}
          </div>
          {/* Right-side actions */}
          <div className="flex items-center gap-3 w-48 justify-end app-no-drag text-muted-foreground">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" className="size-7">
                  <Search className="size-3.5 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Search (Cmd+K)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <NotificationDropdown />
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom">Notifications</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-7"
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                >
                  {theme === 'dark' ? (
                    <Sun className="size-3.5 text-muted-foreground" />
                  ) : (
                    <Moon className="size-3.5 text-muted-foreground" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Toggle theme</TooltipContent>
            </Tooltip>
          </div>
        </header>

        {/* Main area: Rail + Sidebar + Content */}
        <div className="flex flex-1 overflow-hidden">
          <Rail />
          <AppSidebar />
          <main className="flex-1 overflow-hidden bg-background min-w-0">
            {children}
          </main>
          <InspectorPanel />
        </div>

        {/* Status bar */}
        <StatusBar />
      </div>

      <Toaster />
    </TooltipProvider>
  )
}
