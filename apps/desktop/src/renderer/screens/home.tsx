import { Plus, Folder } from 'lucide-react'
import { Button, EmptyState, Spinner, ScrollArea } from '@agent-coding/ui'
import { useProjects } from 'renderer/hooks/queries/use-projects'
import { useProjectNavStore } from 'renderer/stores/use-project-nav-store'
import { useTabStore } from 'renderer/stores/use-tab-store'
import { useModalStore } from 'renderer/stores/use-modal-store'
import { ProjectCard } from 'renderer/components/project-card'

export function HomeScreen() {
  const { data: projects, isLoading } = useProjects()
  const { setActiveProject } = useProjectNavStore()
  const { open } = useModalStore()

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
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-lg font-semibold tracking-tight">Projects</h1>
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
          <div className="bento-grid-3">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onClick={() => setActiveProject(project.id)}
                onSettings={() => {
                  setActiveProject(project.id)
                  useTabStore.getState().openSettingsTab(project.id)
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
