import { Folder, MoreHorizontal, Settings, Trash2, GitBranch } from 'lucide-react'
import {
  Card, CardHeader, CardTitle, CardContent, CardAction,
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  Button,
} from '@agent-coding/ui'
import type { Project } from 'renderer/types/api'
import { useProjectRepositories } from 'renderer/hooks/queries/use-github'

interface ProjectCardProps {
  project: Project
  onClick: () => void
  onSettings: () => void
  onDelete: () => void
}

export function ProjectCard({ project, onClick, onSettings, onDelete }: ProjectCardProps) {
  const { data: repos } = useProjectRepositories(project.id)
  const repoCount = repos?.length ?? 0

  return (
    <Card
      className="bento-cell cursor-pointer p-0 transition-all duration-150"
      onClick={onClick}
    >
      <CardHeader>
        <div className="flex items-center gap-2">
          <Folder className="size-4 text-primary" />
          <CardTitle className="text-sm font-semibold tracking-tight">{project.name}</CardTitle>
        </div>
        <CardAction>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon-sm" className="size-7">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onSettings() }}>
                <Settings className="mr-2 size-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={(e) => { e.stopPropagation(); onDelete() }}
              >
                <Trash2 className="mr-2 size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-0.5">
        <p className="text-caption text-muted-foreground truncate">{project.path}</p>
        <div className="flex items-center gap-3">
          <p className="text-caption text-muted-foreground">
            {project.member_count} member{project.member_count !== 1 ? 's' : ''}
          </p>
          {repoCount > 0 && (
            <p className="text-caption text-muted-foreground flex items-center gap-1">
              <GitBranch className="size-3" />
              {repoCount} repo{repoCount !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
