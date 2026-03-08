import { useState } from 'react'
import { Button, ScrollArea, Spinner } from '@agent-coding/ui'
import {
  useAgents,
  useResetAgentDefaults,
  useDuplicateAgent,
} from 'renderer/hooks/queries/use-agents'
import { ApiError } from 'renderer/lib/api-client'
import type { Project } from 'renderer/types/api'

interface ProjectAgentsProps {
  project: Project
}

export function ProjectAgents({ project }: ProjectAgentsProps) {
  const { data: agents = [], isLoading } = useAgents(project.id)
  const resetMutation = useResetAgentDefaults(project.id)
  const duplicateMutation = useDuplicateAgent(project.id)
  const [error, setError] = useState<string | null>(null)

  const handleReset = () => {
    if (
      window.confirm(
        'Reset all agents to defaults? This will delete any customizations.',
      )
    ) {
      resetMutation.mutate()
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner label="Loading agents..." />
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Agent Configurations</h2>
            {error && (
              <p className="text-[13px] text-destructive mt-1">{error}</p>
            )}
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleReset}
            disabled={resetMutation.isPending}
          >
            {resetMutation.isPending ? 'Resetting...' : 'Reset to Defaults'}
          </Button>
        </div>

        <div className="bento-grid-3">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="bento-cell space-y-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-[13px] font-medium">{agent.name}</h3>
                  {agent.description && (
                    <p className="text-caption text-muted-foreground mt-1">
                      {agent.description}
                    </p>
                  )}
                </div>
                {agent.project_id === null && (
                  <span className="text-[11px] bg-muted px-2 py-0.5 rounded">
                    Global
                  </span>
                )}
              </div>

              <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                <span>Model: {agent.claude_model}</span>
                <span>Max turns: {agent.max_turns}</span>
              </div>

              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setError(null)
                    duplicateMutation.mutate(agent, {
                      onError: err => {
                        const msg =
                          err instanceof ApiError
                            ? err.message
                            : 'Failed to duplicate agent'
                        setError(msg)
                      },
                    })
                  }}
                  disabled={duplicateMutation.isPending}
                >
                  Duplicate
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </ScrollArea>
  )
}
