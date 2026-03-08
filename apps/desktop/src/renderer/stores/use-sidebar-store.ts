import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SidebarStore {
  isOpen: boolean
  toggle: () => void
}

export const useSidebarStore = create<SidebarStore>()(
  persist(
    (set) => ({
      isOpen: true,
      toggle: () => set((s) => ({ isOpen: !s.isOpen })),
    }),
    { name: 'sidebar-store' },
  ),
)
