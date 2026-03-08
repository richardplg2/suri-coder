import { useState } from 'react'
import { LayoutDashboard, Plus, Settings, Pencil, Trash2 } from 'lucide-react'
import {
  cn, Tooltip, TooltipTrigger, TooltipContent, ScrollArea,
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from '@agent-coding/ui'
import { useProjectNavStore } from 'renderer/stores/use-project-nav-store'
import { useProjects } from 'renderer/hooks/queries/use-projects'
import { useTabStore } from 'renderer/stores/use-tab-store'
import { useModalStore } from 'renderer/stores/use-modal-store'

function ProjectIcon({ name, isActive, onClick }: {
  name: string
  isActive: boolean
  onClick: () => void
}) {
  const initials = (name || '??').slice(0, 2).toUpperCase()
  return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'relative flex w-8 h-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold cursor-pointer transition-all duration-150 app-no-drag',
          isActive
            ? 'bg-secondary text-secondary-foreground'
            : 'bg-muted text-muted-foreground hover:bg-secondary'
        )}
      >
        {initials}
        {/* Active indicator: line on the left */}
        {isActive && (
          <div className="absolute -left-1 top-2 w-1 h-4 bg-primary rounded-r-full" />
        )}
      </button>
  )
}

function ProjectWithContextMenu({ project, isActive, onSelect, onSettings, onDelete }: {
  project: { id: string; name: string }
  isActive: boolean
  onSelect: () => void
  onSettings: () => void
  onDelete: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <span
              onContextMenu={(e) => {
                e.preventDefault()
                setMenuOpen(true)
              }}
              onPointerDown={(e) => e.preventDefault()}
            >
              <ProjectIcon
                name={project.name}
                isActive={isActive}
                onClick={onSelect}
              />
            </span>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="right">{project.name}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent side="right" align="start" className="w-48">
        <DropdownMenuItem onClick={() => {
          // TODO: inline rename — open rename modal
        }}>
          <Pencil className="size-4" />
          Rename
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onSettings}>
          <Settings className="size-4" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="size-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function Rail() {
  const { activeProjectId, setActiveProject } = useProjectNavStore()
  const { data: projects } = useProjects()
  const { openSettingsTab } = useTabStore()
  const { open } = useModalStore()

  return (
    <aside className="w-[48px] glass-effect border-r border-border flex flex-col items-center py-4 gap-4 shrink-0 app-drag z-10">
      {/* Home button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => setActiveProject(null)}
            className={cn(
              'flex w-8 h-8 shrink-0 items-center justify-center rounded-lg cursor-pointer transition-colors duration-150 app-no-drag',
              activeProjectId === null
                ? 'bg-primary text-primary-foreground shadow-lg'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
            )}
          >
            <LayoutDashboard className="size-5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">Dashboard</TooltipContent>
      </Tooltip>



      {/* Project list (scrollable) */}
      <ScrollArea className="flex-1 w-full app-no-drag">
        <div className="flex flex-col items-center gap-4 px-2">
          {projects?.map((project) => (
            <ProjectWithContextMenu
              key={project.id}
              project={project}
              isActive={activeProjectId === project.id}
              onSelect={() => setActiveProject(project.id)}
              onSettings={() => {
                setActiveProject(project.id)
                openSettingsTab(project.id)
              }}
              onDelete={() => open('delete-project', { projectId: project.id, projectName: project.name })}
            />
          ))}
        </div>
      </ScrollArea>



      <div className="mt-auto">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => open('create-project')}
              className="flex w-8 h-8 shrink-0 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground cursor-pointer hover:border-primary hover:text-primary transition-colors app-no-drag"
            >
              <Plus className="size-5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">New Project</TooltipContent>
        </Tooltip>
      </div>
    </aside>
  )
}
