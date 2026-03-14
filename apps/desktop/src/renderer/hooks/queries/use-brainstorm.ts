import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from 'renderer/lib/api-client'

interface BrainstormStartResponse {
  session_id: string
  status: string
  ws_channel: string
  ws_ref: string
}

interface BrainstormMessageResponse {
  status: string
  session_id: string
}

interface BrainstormCompleteResponse {
  summary: string
  specs: Record<string, string>
}

interface BatchUpdatePayload {
  comments: Array<{ section: string; text: string; range?: { from: number; to: number } }>
}

interface CreateTicketFromBrainstormPayload {
  session_id: string
  title: string
  type?: string
  priority?: string
}

export function useBrainstormStart(projectId: string) {
  return useMutation({
    mutationFn: (params?: { figma_data?: Record<string, unknown> }) =>
      apiClient<BrainstormStartResponse>(
        `/projects/${projectId}/brainstorm/start`,
        {
          method: 'POST',
          body: JSON.stringify(params ?? {}),
        },
      ),
  })
}

export function useBrainstormMessage(projectId: string) {
  return useMutation({
    mutationFn: ({ sessionId, content }: { sessionId: string; content: string }) =>
      apiClient<BrainstormMessageResponse>(
        `/projects/${projectId}/brainstorm/${sessionId}/message`,
        {
          method: 'POST',
          body: JSON.stringify({ content }),
        },
      ),
  })
}

export function useBrainstormComplete(projectId: string) {
  return useMutation({
    mutationFn: (sessionId: string) =>
      apiClient<BrainstormCompleteResponse>(
        `/projects/${projectId}/brainstorm/${sessionId}/complete`,
        { method: 'POST' },
      ),
  })
}

export function useBrainstormBatchUpdate(projectId: string) {
  return useMutation({
    mutationFn: ({ sessionId, payload }: { sessionId: string; payload: BatchUpdatePayload }) =>
      apiClient<BrainstormCompleteResponse>(
        `/projects/${projectId}/brainstorm/${sessionId}/batch-update`,
        {
          method: 'POST',
          body: JSON.stringify(payload),
        },
      ),
  })
}

export function useCreateTicketFromBrainstorm(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateTicketFromBrainstormPayload) =>
      apiClient<{ ticket_id: string }>(
        `/projects/${projectId}/brainstorm/create-ticket`,
        {
          method: 'POST',
          body: JSON.stringify(payload),
        },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'tickets'] })
    },
  })
}
