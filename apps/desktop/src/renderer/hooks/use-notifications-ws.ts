import { useEffect, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { WsChannel, WsEvent } from '@agent-coding/shared'

import { useWsStore } from 'renderer/stores/use-ws-store'
import { useNotificationStore } from 'renderer/stores/use-notification-store'
import { useAuthStore } from 'renderer/stores/use-auth-store'
import { notificationKeys } from 'renderer/hooks/queries/use-notifications'

export function useNotificationsWs() {
  const qc = useQueryClient()
  const { subscribe, unsubscribe, addListener, removeListener } = useWsStore()
  const osNotificationsEnabled = useNotificationStore((s) => s.osNotificationsEnabled)
  const token = useAuthStore((s) => s.token)

  // Extract user_id from JWT (simple base64 decode of payload)
  const userId = (() => {
    if (!token) return null
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      return payload.sub ?? payload.user_id ?? null
    } catch {
      return null
    }
  })()

  const handleEvent = useCallback(
    (event: string, data: unknown) => {
      if (event === WsEvent.NewNotification) {
        // Invalidate notification queries to refetch
        qc.invalidateQueries({ queryKey: notificationKeys.all })
        qc.invalidateQueries({ queryKey: notificationKeys.unreadCount })

        // Show OS notification if enabled
        const notifData = data as { title?: string; body?: string } | null
        if (osNotificationsEnabled && notifData?.title && 'Notification' in window) {
          new Notification(notifData.title, {
            body: notifData.body ?? undefined,
          })
        }
      }

      if (event === WsEvent.UnreadCountChanged) {
        qc.invalidateQueries({ queryKey: notificationKeys.unreadCount })
      }
    },
    [qc, osNotificationsEnabled],
  )

  useEffect(() => {
    if (!userId) return

    const channel = WsChannel.Notifications
    const params = { user_id: userId }
    const ref = `${channel}:${userId}`

    subscribe(channel, params)
    addListener(ref, handleEvent)

    return () => {
      removeListener(ref, handleEvent)
      unsubscribe(channel, params)
    }
  }, [userId, subscribe, unsubscribe, addListener, removeListener, handleEvent])
}
