import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import { apiClient } from 'renderer/lib/api-client'
import type {
  Ticket,
  TicketListItem,
  TicketCreate,
  TicketUpdate,
} from 'renderer/types/api'

export function useTickets(projectId: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'tickets'],
    queryFn: () =>
      apiClient<TicketListItem[]>(`/projects/${projectId}/tickets`),
    enabled: !!projectId,
  })
}

export function useTicket(projectId: string, ticketId: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'tickets', ticketId],
    queryFn: () => apiClient<Ticket>(`/tickets/${ticketId}`),
    enabled: !!projectId && !!ticketId,
  })
}

export function useCreateTicket(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: TicketCreate) =>
      apiClient<Ticket>(`/projects/${projectId}/tickets`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'tickets'] }),
  })
}

export function useUpdateTicket(projectId: string, ticketId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: TicketUpdate) =>
      apiClient<Ticket>(`/tickets/${ticketId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'tickets'] })
      qc.invalidateQueries({
        queryKey: ['projects', projectId, 'tickets', ticketId],
      })
    },
  })
}
