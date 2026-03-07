import { useSidebarStore } from 'renderer/stores/use-sidebar-store'
import { useProject } from 'renderer/hooks/queries/use-projects'
import { Spinner } from '@agent-coding/ui'
import { TicketsBoard } from './project/tickets-board'
import { ProjectSettings } from './project/project-settings'
import { ProjectRepositories } from './project/project-repositories'
import { ProjectAgents } from './project/project-agents'
import { GitHubAccounts } from './settings/github-accounts'

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
    return <div className="p-6 text-[13px] text-muted-foreground">Project not found</div>
  }

  switch (activeNav) {
    case 'settings':
      return <ProjectSettings project={project} />
    case 'repositories':
      return <ProjectRepositories project={project} />
    case 'github':
      return <GitHubAccounts />
    case 'agents':
      return <ProjectAgents project={project} />
    case 'templates':
      return <div className="p-6 text-[13px] text-muted-foreground">Templates editor — coming soon</div>
    default:
      return <TicketsBoard project={project} />
  }
}
