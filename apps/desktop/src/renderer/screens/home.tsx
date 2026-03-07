import { Plus, Folder } from 'lucide-react'
import { Button, EmptyState, Spinner, ScrollArea } from '@agent-coding/ui'
import { useProjects } from 'renderer/hooks/queries/use-projects'
import { useTabStore } from 'renderer/stores/use-tab-store'
import { useModalStore } from 'renderer/stores/use-modal-store'
import { useSidebarStore } from 'renderer/stores/use-sidebar-store'
import { ProjectCard } from 'renderer/components/project-card'

export function HomeScreen() {
  const { data: projects, isLoading } = useProjects()
  const { openProjectTab } = useTabStore()
  const { open } = useModalStore()
  const { setActiveNav } = useSidebarStore()

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner label="Loading projects..." />
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h1 className="window-title">Projects</h1>
          <Button size="sm" onClick={() => open('create-project')}>
            <Plus className="mr-1.5 size-3.5" />
            New Project
          </Button>
        </div>

        {/* Content */}
        {(!projects || projects.length === 0) ? (
          <EmptyState
            icon={Folder}
            title="No projects yet"
            description="Create your first project to get started."
            action={
              <Button size="sm" onClick={() => open('create-project')}>
                <Plus className="mr-1.5 size-3.5" />
                New Project
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onClick={() => openProjectTab(project.id, project.name)}
                onSettings={() => {
                  openProjectTab(project.id, project.name)
                  setActiveNav('settings')
                }}
                onDelete={() => open('delete-project', { projectId: project.id, projectName: project.name })}
              />
            ))}
          </div>
        )}
      </div>
    </ScrollArea>
  )
}
