import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import { apiClient } from 'renderer/lib/api-client'
import type {
  TicketSpec,
  TicketSpecDetail,
} from 'renderer/types/api'

export function useSpecs(ticketId: string) {
  return useQuery({
    queryKey: ['tickets', ticketId, 'specs'],
    queryFn: () =>
      apiClient<TicketSpec[]>(`/tickets/${ticketId}/specs`),
    enabled: !!ticketId,
  })
}

export function useSpec(ticketId: string, specId: string) {
  return useQuery({
    queryKey: ['tickets', ticketId, 'specs', specId],
    queryFn: () =>
      apiClient<TicketSpecDetail>(`/tickets/${ticketId}/specs/${specId}`),
    enabled: !!ticketId && !!specId,
  })
}

export function useSpecHistory(ticketId: string, specId: string) {
  return useQuery({
    queryKey: ['tickets', ticketId, 'specs', specId, 'history'],
    queryFn: () =>
      apiClient<TicketSpec[]>(`/tickets/${ticketId}/specs/${specId}/history`),
    enabled: !!ticketId && !!specId,
  })
}

export function useCreateSpec(ticketId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { type: string; title: string; content: string }) =>
      apiClient<TicketSpec>(`/tickets/${ticketId}/specs`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['tickets', ticketId, 'specs'] }),
  })
}

export function useUpdateSpec(ticketId: string, specId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { content: string; title?: string }) =>
      apiClient<TicketSpec>(`/tickets/${ticketId}/specs/${specId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tickets', ticketId, 'specs'] })
      qc.invalidateQueries({
        queryKey: ['tickets', ticketId, 'specs', specId],
      })
    },
  })
}
