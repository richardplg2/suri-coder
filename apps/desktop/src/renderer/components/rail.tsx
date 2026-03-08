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
        'relative flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold cursor-pointer',
        'bg-[var(--surface-elevated)] text-muted-foreground border border-border/50',
        'transition-all duration-150 hover:bg-[var(--surface-elevated-hover)] hover:text-foreground',
        isActive && 'text-foreground ring-1 ring-[var(--accent)]',
      )}
    >
      {initials}
      {/* Active indicator: 3px accent bar on left */}
      {isActive && (
        <div className="absolute -left-[7px] top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-[var(--accent)]" />
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
          className="text-[var(--destructive)] focus:text-[var(--destructive)]"
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
    <div className="flex h-full w-12 shrink-0 flex-col items-center border-r border-border/50 glass-panel py-2 gap-1">
      {/* Home button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => setActiveProject(null)}
            className={cn(
              'flex size-8 shrink-0 items-center justify-center rounded-lg cursor-pointer',
              'text-muted-foreground transition-colors duration-150',
              'hover:bg-[var(--surface-elevated-hover)] hover:text-foreground',
              activeProjectId === null && 'bg-[var(--surface-elevated)] text-foreground',
            )}
          >
            <LayoutDashboard className="size-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">Dashboard</TooltipContent>
      </Tooltip>

      {/* Separator */}
      <div className="mx-2 my-1 h-px w-6 bg-border/50" />

      {/* Project list (scrollable) */}
      <ScrollArea className="flex-1 w-full">
        <div className="flex flex-col items-center gap-1 px-2">
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

      {/* Separator */}
      <div className="mx-2 my-1 h-px w-6 bg-border/50" />

      {/* Add project button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => open('create-project')}
            className={cn(
              'flex size-8 shrink-0 items-center justify-center rounded-lg cursor-pointer',
              'text-muted-foreground transition-colors duration-150',
              'hover:bg-[var(--surface-elevated-hover)] hover:text-foreground',
            )}
          >
            <Plus className="size-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">New Project</TooltipContent>
      </Tooltip>
    </div>
  )
}
