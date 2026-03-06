import { useQuery } from '@tanstack/react-query'

import { apiClient } from 'renderer/lib/api-client'
import type { WorkflowTemplate } from 'renderer/types/api'

export function useWorkflowTemplates(projectId: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'templates'],
    queryFn: () =>
      apiClient<WorkflowTemplate[]>(`/projects/${projectId}/templates`),
    enabled: !!projectId,
  })
}

export function useWorkflowTemplate(projectId: string, templateId: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'templates', templateId],
    queryFn: () =>
      apiClient<WorkflowTemplate>(
        `/projects/${projectId}/templates/${templateId}`,
      ),
    enabled: !!projectId && !!templateId,
  })
}
