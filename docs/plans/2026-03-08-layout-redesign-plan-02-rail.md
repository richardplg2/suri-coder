# Layout Redesign — Plan 02: Rail Component

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create the vertical project rail component (48px icon-only sidebar on the far left edge).

**Architecture:** New `Rail` component renders Home icon at top, project icons in scrollable middle area, "+" button at bottom. Uses `useProjectNavStore` for active project and `useProjects` query for project list. Glass-panel background consistent with toolbar/status bar.

**Tech Stack:** React, Tailwind CSS, Lucide icons, `@agent-coding/ui` (Tooltip, Button, ScrollArea)

**Depends on:** Plan 01 (needs `useProjectNavStore`)
**Blocks:** Plan 03 (app shell integration)

**Ref:** `docs/plans/2026-03-08-layout-redesign-design.md` §1 (Rail Component)

---

## Task 1: Create Rail Component

**Files:**
- Create: `apps/desktop/src/renderer/components/rail.tsx`

**Step 1: Write the component**

```tsx
import { LayoutDashboard, Plus } from 'lucide-react'
import { cn, Button, Tooltip, TooltipTrigger, TooltipContent, ScrollArea } from '@agent-coding/ui'
import { useProjectNavStore } from 'renderer/stores/use-project-nav-store'
import { useProjects } from 'renderer/hooks/queries/use-projects'
import { useTabStore } from 'renderer/stores/use-tab-store'
import { useModalStore } from 'renderer/stores/use-modal-store'

function ProjectIcon({ name, isActive, onClick, onContextMenu }: {
  name: string
  isActive: boolean
  onClick: () => void
  onContextMenu: (e: React.MouseEvent) => void
}) {
  const initials = name.slice(0, 2).toUpperCase()
  return (
    <button
      type="button"
      onClick={onClick}
      onContextMenu={onContextMenu}
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

export function Rail() {
  const { activeProjectId, setActiveProject } = useProjectNavStore()
  const { data: projects } = useProjects()
  const { openSettingsTab } = useTabStore()
  const { open } = useModalStore()

  const handleProjectContext = (e: React.MouseEvent, projectId: string, projectName: string) => {
    e.preventDefault()
    // TODO: context menu with Rename, Settings, Delete
    // For now, open settings tab
    openSettingsTab(projectId)
    setActiveProject(projectId)
  }

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
            <Tooltip key={project.id}>
              <TooltipTrigger asChild>
                <span>
                  <ProjectIcon
                    name={project.name}
                    isActive={activeProjectId === project.id}
                    onClick={() => setActiveProject(project.id)}
                    onContextMenu={(e) => handleProjectContext(e, project.id, project.name)}
                  />
                </span>
              </TooltipTrigger>
              <TooltipContent side="right">{project.name}</TooltipContent>
            </Tooltip>
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
```

**Step 2: Commit**

```bash
git add apps/desktop/src/renderer/components/rail.tsx
git commit -m "feat: add Rail component for vertical project navigation"
```
