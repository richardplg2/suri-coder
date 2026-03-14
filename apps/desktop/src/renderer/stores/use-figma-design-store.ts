import { create } from 'zustand'
import type { Design, Tag } from 'renderer/types/figma'

interface FigmaDesignState {
  // Data
  designs: Design[]
  customTags: Tag[]

  // Navigation
  activeDesignId: string | null
  activeFrameId: string | null
  viewMode: 'grid' | 'detail'

  // Interaction (detail view)
  selectedNodeId: string | null
  hoveredNodeId: string | null

  // Loading
  isLoading: boolean
  loadError: string | null

  // Actions — designs
  addDesign: (design: Design) => void
  removeDesign: (id: string) => void
  setActiveDesign: (id: string) => void
  setActiveFrame: (designId: string, frameId: string) => void
  setViewMode: (mode: 'grid' | 'detail') => void
  reset: () => void

  // Actions — frame annotations
  updateFrameNotes: (designId: string, frameId: string, notes: string) => void
  addFrameTag: (designId: string, frameId: string, tag: Tag) => void
  removeFrameTag: (designId: string, frameId: string, label: string) => void
  addCustomTag: (tag: Tag) => void

  // Actions — interaction
  setSelectedNode: (id: string | null) => void
  setHoveredNode: (id: string | null) => void
  setLoading: (loading: boolean) => void
  setLoadError: (error: string | null) => void
}

const initialState = {
  designs: [],
  customTags: [],
  activeDesignId: null,
  activeFrameId: null,
  viewMode: 'grid' as const,
  selectedNodeId: null,
  hoveredNodeId: null,
  isLoading: false,
  loadError: null,
}

export const useFigmaDesignStore = create<FigmaDesignState>()((set, get) => ({
  ...initialState,

  addDesign: (design) =>
    set((s) => ({ designs: [...s.designs, design] })),

  removeDesign: (id) =>
    set((s) => {
      const newDesigns = s.designs.filter((d) => d.id !== id)
      if (s.activeDesignId === id) {
        const nextDesign = newDesigns[0] ?? null
        return {
          designs: newDesigns,
          activeDesignId: nextDesign?.id ?? null,
          activeFrameId: null,
          selectedNodeId: null,
          hoveredNodeId: null,
        }
      }
      return { designs: newDesigns }
    }),

  setActiveDesign: (id) =>
    set({
      activeDesignId: id,
      activeFrameId: null,
      selectedNodeId: null,
      hoveredNodeId: null,
    }),

  setActiveFrame: (designId, frameId) =>
    set({
      activeDesignId: designId,
      activeFrameId: frameId,
      selectedNodeId: null,
      hoveredNodeId: null,
    }),

  setViewMode: (mode) => set({ viewMode: mode }),

  reset: () => set(initialState),

  updateFrameNotes: (designId, frameId, notes) =>
    set((s) => ({
      designs: s.designs.map((d) =>
        d.id === designId
          ? {
              ...d,
              frames: d.frames.map((f) =>
                f.id === frameId
                  ? { ...f, annotation: { ...f.annotation, notes } }
                  : f,
              ),
            }
          : d,
      ),
    })),

  addFrameTag: (designId, frameId, tag) =>
    set((s) => ({
      designs: s.designs.map((d) =>
        d.id === designId
          ? {
              ...d,
              frames: d.frames.map((f) =>
                f.id === frameId &&
                !f.annotation.tags.some((t) => t.label === tag.label)
                  ? {
                      ...f,
                      annotation: {
                        ...f.annotation,
                        tags: [...f.annotation.tags, tag],
                      },
                    }
                  : f,
              ),
            }
          : d,
      ),
    })),

  removeFrameTag: (designId, frameId, label) =>
    set((s) => ({
      designs: s.designs.map((d) =>
        d.id === designId
          ? {
              ...d,
              frames: d.frames.map((f) =>
                f.id === frameId
                  ? {
                      ...f,
                      annotation: {
                        ...f.annotation,
                        tags: f.annotation.tags.filter(
                          (t) => t.label !== label,
                        ),
                      },
                    }
                  : f,
              ),
            }
          : d,
      ),
    })),

  addCustomTag: (tag) =>
    set((s) => {
      if (s.customTags.some((t) => t.label === tag.label)) return s
      return { customTags: [...s.customTags, tag] }
    }),

  setSelectedNode: (id) => set({ selectedNodeId: id }),
  setHoveredNode: (id) => set({ hoveredNodeId: id }),
  setLoading: (loading) => set({ isLoading: loading }),
  setLoadError: (error) => set({ loadError: error }),
}))
