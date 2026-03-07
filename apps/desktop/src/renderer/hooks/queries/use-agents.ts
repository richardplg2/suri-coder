import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import { apiClient } from 'renderer/lib/api-client'

export interface AgentConfig {
  id: string
  project_id: string | null
  name: string
  description: string | null
  system_prompt: string
  claude_model: string
  tools_list: string[] | null
  max_turns: number
  created_at: string
}

export function useAgents(projectId: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'agents'],
    queryFn: () =>
      apiClient<AgentConfig[]>(`/projects/${projectId}/agents`),
    enabled: !!projectId,
  })
}

export function useResetAgentDefaults(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiClient<{ detail: string; agent_count: number }>(
        `/projects/${projectId}/agents/reset-defaults`,
        { method: 'POST' },
      ),
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: ['projects', projectId, 'agents'],
      }),
  })
}

export function useDuplicateAgent(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (agent: AgentConfig) =>
      apiClient<AgentConfig>(`/projects/${projectId}/agents`, {
        method: 'POST',
        body: JSON.stringify({
          name: `${agent.name} (copy)`,
          description: agent.description,
          system_prompt: agent.system_prompt,
          claude_model: agent.claude_model,
          tools_list: agent.tools_list,
          max_turns: agent.max_turns,
        }),
      }),
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: ['projects', projectId, 'agents'],
      }),
  })
}
