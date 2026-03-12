import { create } from 'zustand'
import type { ReactNode } from 'react'

export interface StatusBarItem {
  /** Unique key for this item */
  id: string
  /** React node to render in the left section of the status bar */
  content: ReactNode
  /** Lower numbers render first (default 0) */
  order?: number
}

interface StatusBarStore {
  items: Map<string, StatusBarItem>
  setItem: (item: StatusBarItem) => void
  removeItem: (id: string) => void
}

export const useStatusBarStore = create<StatusBarStore>()((set) => ({
  items: new Map(),
  setItem: (item) =>
    set((state) => {
      const next = new Map(state.items)
      next.set(item.id, item)
      return { items: next }
    }),
  removeItem: (id) =>
    set((state) => {
      const next = new Map(state.items)
      next.delete(id)
      return { items: next }
    }),
}))
