import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import { apiClient } from 'renderer/lib/api-client'
import type { Notification } from 'renderer/types/api'

export const notificationKeys = {
  all: ['notifications'] as const,
  list: (read?: boolean) => [...notificationKeys.all, { read }] as const,
  unreadCount: ['notifications', 'unread-count'] as const,
}

export function useNotifications(read?: boolean) {
  const params = new URLSearchParams()
  if (read !== undefined) params.set('read', String(read))
  const qs = params.toString()

  return useQuery({
    queryKey: notificationKeys.list(read),
    queryFn: () => apiClient<Notification[]>(`/notifications${qs ? `?${qs}` : ''}`),
  })
}

export function useUnreadCount() {
  return useQuery({
    queryKey: notificationKeys.unreadCount,
    queryFn: () => apiClient<{ count: number }>('/notifications/unread-count'),
    refetchInterval: 30000,
  })
}

export function useMarkRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (notificationId: string) =>
      apiClient<Notification>(`/notifications/${notificationId}`, {
        method: 'PATCH',
        body: JSON.stringify({ read: true }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notificationKeys.all })
      qc.invalidateQueries({ queryKey: notificationKeys.unreadCount })
    },
  })
}

export function useMarkAllRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiClient<{ updated: number }>('/notifications/mark-all-read', {
        method: 'POST',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notificationKeys.all })
      qc.invalidateQueries({ queryKey: notificationKeys.unreadCount })
    },
  })
}
