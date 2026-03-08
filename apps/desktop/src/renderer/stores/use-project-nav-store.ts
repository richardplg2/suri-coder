import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ProjectNavStore {
  activeProjectId: string | null
  setActiveProject: (id: string | null) => void
}

export const useProjectNavStore = create<ProjectNavStore>()(
  persist(
    (set) => ({
      activeProjectId: null,
      setActiveProject: (id) => set({ activeProjectId: id }),
    }),
    { name: 'project-nav-store' },
  ),
)
