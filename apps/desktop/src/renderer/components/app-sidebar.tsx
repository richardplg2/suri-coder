import { cn } from '@agent-coding/ui'
import { useSidebarStore } from 'renderer/stores/use-sidebar-store'

export function AppSidebar() {
  const { isOpen } = useSidebarStore()

  return (
    <aside
      className={cn(
        'shrink-0 border-r border-border bg-card/50 transition-[width] duration-200',
        isOpen ? 'w-60' : 'w-0 overflow-hidden'
      )}
    >
      <div className="p-3 text-xs text-muted-foreground">
        Sidebar placeholder
      </div>
    </aside>
  )
}
