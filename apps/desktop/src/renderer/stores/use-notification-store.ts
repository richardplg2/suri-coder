import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface NotificationStore {
  osNotificationsEnabled: boolean
  setOsNotificationsEnabled: (enabled: boolean) => void
}

export const useNotificationStore = create<NotificationStore>()(
  persist(
    (set) => ({
      osNotificationsEnabled: true,
      setOsNotificationsEnabled: (enabled) => set({ osNotificationsEnabled: enabled }),
    }),
    { name: 'notification-store' },
  ),
)
