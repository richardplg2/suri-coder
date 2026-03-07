import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiClient } from 'renderer/lib/api-client'
import type {
  StepReview,
  RequestChangesPayload,
  RegeneratePayload,
  PromptOverridePayload,
} from 'renderer/types/api'

export function useApproveStep(projectId: string, ticketId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (stepId: string) =>
      apiClient<{ detail: string }>(`/tickets/${ticketId}/steps/${stepId}/approve`, {
        method: 'POST',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'tickets', ticketId] })
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'tickets'] })
    },
  })
}

export function useRunStep(projectId: string, ticketId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (stepId: string) =>
      apiClient(`/tickets/${ticketId}/steps/${stepId}/run`, {
        method: 'POST',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'tickets', ticketId] })
    },
  })
}

export function useRetryStep(projectId: string, ticketId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (stepId: string) =>
      apiClient(`/tickets/${ticketId}/steps/${stepId}/retry`, {
        method: 'POST',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'tickets', ticketId] })
    },
  })
}

export function useSkipStep(projectId: string, ticketId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (stepId: string) =>
      apiClient(`/tickets/${ticketId}/steps/${stepId}/skip`, {
        method: 'POST',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'tickets', ticketId] })
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'tickets'] })
    },
  })
}

export function useApproveReview(projectId: string, ticketId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (stepId: string) =>
      apiClient<{ detail: string }>(`/tickets/${ticketId}/steps/${stepId}/approve-review`, {
        method: 'POST',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'tickets', ticketId] })
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'tickets'] })
    },
  })
}

export function useRequestChanges(projectId: string, ticketId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ stepId, payload }: { stepId: string; payload: RequestChangesPayload }) =>
      apiClient(`/tickets/${ticketId}/steps/${stepId}/request-changes`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'tickets', ticketId] })
    },
  })
}

export function useRegenerateBrainstorm(projectId: string, ticketId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ stepId, payload }: { stepId: string; payload: RegeneratePayload }) =>
      apiClient(`/tickets/${ticketId}/steps/${stepId}/regenerate`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'tickets', ticketId] })
    },
  })
}

export function useUpdateStepPrompt(projectId: string, ticketId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ stepId, payload }: { stepId: string; payload: PromptOverridePayload }) =>
      apiClient(`/tickets/${ticketId}/steps/${stepId}/prompt`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'tickets', ticketId] })
    },
  })
}

export function useStepReviews(projectId: string, ticketId: string, stepId: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'tickets', ticketId, 'steps', stepId, 'reviews'],
    queryFn: () =>
      apiClient<StepReview[]>(`/tickets/${ticketId}/steps/${stepId}/reviews`),
    enabled: !!projectId && !!ticketId && !!stepId,
  })
}

export function useRunTicketWorkflow(projectId: string, ticketId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiClient(`/tickets/${ticketId}/run`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'tickets', ticketId] })
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'tickets'] })
    },
  })
}
