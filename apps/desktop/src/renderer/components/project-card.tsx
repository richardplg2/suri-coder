import { Folder, MoreHorizontal } from 'lucide-react'
import {
  Card, CardHeader, CardTitle, CardContent, CardAction,
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  Button,
} from '@agent-coding/ui'
import type { Project } from 'renderer/types/api'

interface ProjectCardProps {
  project: Project
  onClick: () => void
  onSettings: () => void
  onDelete: () => void
}

export function ProjectCard({ project, onClick, onSettings, onDelete }: ProjectCardProps) {
  return (
    <Card
      className="cursor-pointer transition-colors hover:bg-secondary/50"
      onClick={onClick}
    >
      <CardHeader>
        <div className="flex items-center gap-2">
          <Folder className="size-4 text-primary" />
          <CardTitle className="text-sm">{project.name}</CardTitle>
        </div>
        <CardAction>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="size-7">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onSettings() }}>
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={(e) => { e.stopPropagation(); onDelete() }}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-1">
        <p className="text-xs text-muted-foreground truncate">{project.path}</p>
        <p className="text-xs text-muted-foreground">
          {project.member_count} member{project.member_count !== 1 ? 's' : ''}
        </p>
      </CardContent>
    </Card>
  )
}
