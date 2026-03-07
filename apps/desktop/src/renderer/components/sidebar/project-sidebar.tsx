import { LayoutGrid, Bot, Workflow, Settings, GitBranch, Github } from 'lucide-react'
import { SourceList } from '@agent-coding/ui'
import type { SourceListItem } from '@agent-coding/ui'
import { useSidebarStore } from 'renderer/stores/use-sidebar-store'

const NAV_ITEMS: SourceListItem[] = [
  { id: 'tickets', label: 'Tickets', icon: <LayoutGrid className="size-4" /> },
  { id: 'repositories', label: 'Repositories', icon: <GitBranch className="size-4" /> },
  { id: 'agents', label: 'Agents', icon: <Bot className="size-4" /> },
  { id: 'templates', label: 'Templates', icon: <Workflow className="size-4" /> },
  { id: 'settings', label: 'Settings', icon: <Settings className="size-4" /> },
  { id: 'github', label: 'GitHub', icon: <Github className="size-4" /> },
]

interface ProjectSidebarProps {
  projectName: string
}

export function ProjectSidebar({ projectName }: ProjectSidebarProps) {
  const { activeNav, setActiveNav } = useSidebarStore()

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-3 py-2">
        <div className="window-title truncate">{projectName}</div>
      </div>
      <div className="section-header px-3 py-1.5">
        Manage
      </div>
      <SourceList
        items={NAV_ITEMS}
        selectedId={activeNav}
        onSelect={setActiveNav}
      />
      <div className="flex-1" />
    </div>
  )
}
