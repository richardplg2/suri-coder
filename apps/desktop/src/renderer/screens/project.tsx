import { useSidebarStore } from 'renderer/stores/use-sidebar-store'
import { useProject } from 'renderer/hooks/queries/use-projects'
import { Spinner } from '@agent-coding/ui'
import { TicketsBoard } from './project/tickets-board'
import { ProjectSettings } from './project/project-settings'

interface ProjectScreenProps {
  projectId: string
}

export function ProjectScreen({ projectId }: ProjectScreenProps) {
  const { data: project, isLoading } = useProject(projectId)
  const { activeNav } = useSidebarStore()

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner label="Loading project..." />
      </div>
    )
  }

  if (!project) {
    return <div className="p-6 text-muted-foreground">Project not found</div>
  }

  switch (activeNav) {
    case 'settings':
      return <ProjectSettings project={project} />
    case 'agents':
      return <div className="p-6 text-muted-foreground">Agents config — coming soon</div>
    case 'templates':
      return <div className="p-6 text-muted-foreground">Templates editor — coming soon</div>
    default:
      return <TicketsBoard project={project} />
  }
}
