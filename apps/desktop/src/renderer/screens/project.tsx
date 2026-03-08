import { useProject } from 'renderer/hooks/queries/use-projects'
import { Spinner } from '@agent-coding/ui'
import { TicketsBoard } from './project/tickets-board'

interface ProjectScreenProps {
  projectId: string
}

export function ProjectScreen({ projectId }: ProjectScreenProps) {
  const { data: project, isLoading } = useProject(projectId)

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner label="Loading project..." />
      </div>
    )
  }

  if (!project) {
    return <div className="p-6 text-[13px] text-muted-foreground">Project not found</div>
  }

  return <TicketsBoard project={project} />
}
