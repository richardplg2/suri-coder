import { GitBranch, Lock, Globe, Plus, Trash2 } from 'lucide-react'
import { Button, ScrollArea, Spinner, EmptyState } from '@agent-coding/ui'
import { useProjectRepositories, useDisconnectRepo } from 'renderer/hooks/queries/use-github'
import { useModalStore } from 'renderer/stores/use-modal-store'
import type { Project } from 'renderer/types/api'

interface ProjectRepositoriesProps {
  project: Project
}

export function ProjectRepositories({ project }: ProjectRepositoriesProps) {
  const { data: repos, isLoading } = useProjectRepositories(project.id)
  const disconnectRepo = useDisconnectRepo(project.id)
  const { open } = useModalStore()

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner label="Loading repositories..." />
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Repositories</h2>
          <Button
            size="sm"
            onClick={() => open('connect-repos', { projectId: project.id })}
          >
            <Plus className="mr-1.5 size-4" />
            Add Repository
          </Button>
        </div>

        {!repos || repos.length === 0 ? (
          <EmptyState
            icon={GitBranch}
            title="No repositories connected"
            description="Connect GitHub repositories to this project."
            action={
              <Button
                size="sm"
                onClick={() => open('connect-repos', { projectId: project.id })}
              >
                Connect Repository
              </Button>
            }
          />
        ) : (
          <div className="bento-grid-2">
            {repos.map((repo) => (
              <div
                key={repo.id}
                className="bento-cell flex items-center justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <GitBranch className="size-4 text-muted-foreground" />
                    <span className="text-[13px] font-medium truncate">
                      {repo.repo_full_name}
                    </span>
                    {repo.is_private ? (
                      <Lock className="size-3 text-muted-foreground" />
                    ) : (
                      <Globe className="size-3 text-muted-foreground" />
                    )}
                  </div>
                  <p className="text-caption text-muted-foreground mt-0.5">
                    Branch: {repo.default_branch}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => disconnectRepo.mutate(repo.id)}
                  disabled={disconnectRepo.isPending}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </ScrollArea>
  )
}
