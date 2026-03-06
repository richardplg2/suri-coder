import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SidebarStore {
  isOpen: boolean
  activeNav: string
  toggle: () => void
  setActiveNav: (nav: string) => void
}

export const useSidebarStore = create<SidebarStore>()(
  persist(
    (set) => ({
      isOpen: true,
      activeNav: 'projects',
      toggle: () => set((s) => ({ isOpen: !s.isOpen })),
      setActiveNav: (nav) => set({ activeNav: nav }),
    }),
    { name: 'sidebar-store' },
  ),
)
