import { Home, Search, Sun, Moon, Settings } from 'lucide-react'
import { TabBar, Button, Tooltip, TooltipTrigger, TooltipContent, TooltipProvider, Toaster } from '@agent-coding/ui'
import type { Tab } from '@agent-coding/ui'
import { useTabStore } from 'renderer/stores/use-tab-store'
import { useProjectNavStore } from 'renderer/stores/use-project-nav-store'
import { useThemeStore } from 'renderer/stores/use-theme-store'
import type { AppTab } from 'renderer/types/tabs'
import { AppSidebar } from './app-sidebar'
import { StatusBar } from './status-bar'
import { useKeyboardShortcuts } from 'renderer/hooks/use-keyboard-shortcuts'
import { NotificationDropdown } from './notification-dropdown'
import { useNotificationsWs } from 'renderer/hooks/use-notifications-ws'

function tabToBarTab(tab: AppTab): Tab {
  switch (tab.type) {
    case 'home':
      return { id: tab.id, label: '', icon: <Home className="size-4" />, closable: false }
    case 'ticket':
      return { id: tab.id, label: tab.label, closable: true }
    case 'settings':
      return { id: tab.id, label: tab.label, icon: <Settings className="size-4" />, closable: true }
  }
}

const isMac = window.App?.platform === 'darwin'

export function AppLayout({ children }: { children: React.ReactNode }) {
  useKeyboardShortcuts()
  useNotificationsWs()
  const activeProjectId = useProjectNavStore((s) => s.activeProjectId)
  const tabs = useTabStore((s) => activeProjectId ? s.tabsByProject[activeProjectId] ?? [] : [])
  const activeTabId = useTabStore((s) => activeProjectId ? s.activeTabByProject[activeProjectId] : undefined)
  const { setActiveTab, closeTab } = useTabStore()
  const { theme, setTheme } = useThemeStore()

  const barTabs = tabs.map(tabToBarTab)

  return (
    <TooltipProvider delayDuration={400}>
      <div className="flex h-screen flex-col">
        {/* Toolbar — 36px, translucent */}
        <div className="flex h-9 shrink-0 items-center border-b border-border/50 glass-panel app-drag">
          {/* Traffic light spacer (macOS only) */}
          {isMac && <div className="w-[78px] shrink-0" />}
          <div className="flex-1 app-no-drag">
            <TabBar
              tabs={barTabs}
              activeTab={activeTabId ?? ''}
              onTabChange={(id) => activeProjectId && setActiveTab(activeProjectId, id)}
              onTabClose={(id) => activeProjectId && closeTab(activeProjectId, id)}
            />
          </div>
          {/* Right-side actions */}
          <div className="flex items-center gap-0.5 px-2 app-no-drag">
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
        </div>

        {/* Main area: Sidebar + Content */}
        <div className="flex flex-1 overflow-hidden">
          <AppSidebar />
          <main className="flex-1 overflow-hidden bg-background">
            {children}
          </main>
        </div>

        {/* Status bar */}
        <StatusBar />
      </div>

      <Toaster />
    </TooltipProvider>
  )
}
