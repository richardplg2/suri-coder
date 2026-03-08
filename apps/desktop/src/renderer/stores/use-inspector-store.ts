import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type InspectorContentType = 'file-preview' | 'message-detail' | 'diff-viewer'

export interface InspectorContent {
  type: InspectorContentType
  /** file-preview fields */
  filePath?: string
  code?: string
  language?: string
  /** message-detail fields */
  messageId?: string
  messageContent?: string
  /** diff-viewer fields */
  diff?: string
}

interface InspectorStore {
  isOpen: boolean
  content: InspectorContent | null
  open: (content: InspectorContent) => void
  close: () => void
  toggle: () => void
}

export const useInspectorStore = create<InspectorStore>()(
  persist(
    (set) => ({
      isOpen: false,
      content: null,
      open: (content) => set({ isOpen: true, content }),
      close: () => set({ isOpen: false, content: null }),
      toggle: () => set((s) => ({ isOpen: !s.isOpen })),
    }),
    {
      name: 'inspector-store',
      partialize: (state) => ({ isOpen: state.isOpen }),
    },
  ),
)
