import { LayoutGrid, Settings } from 'lucide-react'
import { SourceList } from '@agent-coding/ui'
import type { SourceListItem } from '@agent-coding/ui'
import { useTabStore } from 'renderer/stores/use-tab-store'
import { useProject } from 'renderer/hooks/queries/use-projects'

const NAV_ITEMS: SourceListItem[] = [
  { id: 'tickets', label: 'Tickets', icon: <LayoutGrid className="size-4" /> },
  { id: 'settings', label: 'Settings', icon: <Settings className="size-4" /> },
]

interface ProjectSidebarProps {
  projectId: string
}

export function ProjectSidebar({ projectId }: ProjectSidebarProps) {
  const { data: project } = useProject(projectId)
  const { openSettingsTab } = useTabStore()

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-3 py-2">
        <div className="window-title truncate">{project?.name ?? 'Project'}</div>
      </div>
      <div className="section-header px-3 py-1.5">
        Manage
      </div>
      <SourceList
        items={NAV_ITEMS}
        onSelect={(id) => {
          if (id === 'settings') openSettingsTab(projectId)
        }}
      />
      <div className="flex-1" />
    </div>
  )
}
