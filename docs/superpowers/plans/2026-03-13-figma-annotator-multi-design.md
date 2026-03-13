# Figma Annotator Multi-Design Flow — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the Figma Annotator screen to support hierarchical Design → FrameEntry[] model with per-frame annotations (notes + tags), Zustand store, and grid/detail navigation.

**Architecture:** Extract all figma-annotator state into a dedicated Zustand store. Replace the flat DesignEntry model with a hierarchical Design containing FrameEntry[]. Split the monolithic screen into focused components: DesignTreeSidebar, FrameGrid, FrameDetailView, FrameAnnotationPanel, and TagPicker. Reuse existing FigmaNodeTree and FigmaCanvas components.

**Tech Stack:** React 19, Zustand, TypeScript, Tailwind CSS, Lucide React icons, @agent-coding/ui (shadcn/ui-based component library with SplitPane, ScrollArea, Button, Badge, Input, Textarea)

**Design System:** macOS-style dark theme — follow `docs/design/design-system.md` and `docs/design/components.md` strictly. Key tokens: `--surface-elevated` (#2A2A2C) for cards, `--selection` (rgba(10,132,255,0.15)) for active items, `--glass-bg` for chrome panels, `bento-cell` (12px radius, 16px padding) for grid cards, pill badges (9999px radius) for tags, 13px body / 11px caption typography, 150ms ease transitions, `cursor-pointer` on all interactive elements.

**Spec:** `docs/superpowers/specs/2026-03-13-figma-annotator-multi-design-flow.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `src/renderer/types/figma.ts` | Updated types: `Tag`, `FrameAnnotation`, `FrameEntry`, `Design`, `PRESET_TAGS`, `TAG_COLORS`, `TYPE_BADGE_COLORS` (replaces old `DesignEntry`) |
| Create | `src/renderer/stores/use-figma-design-store.ts` | Zustand store: designs, navigation, annotations, interaction, loading state |
| Create | `src/renderer/components/figma/design-tree-sidebar.tsx` | Tree nav: designs → frames, glass panel styling |
| Create | `src/renderer/components/figma/frame-grid.tsx` | Bento grid of frame thumbnails with tag/notes badges |
| Create | `src/renderer/components/figma/frame-detail-view.tsx` | SplitPane with FigmaNodeTree + FigmaCanvas for active frame |
| Create | `src/renderer/components/figma/view-mode-toggle.tsx` | Grid/Detail toggle button group |
| Create | `src/renderer/components/figma/frame-annotation-panel.tsx` | Per-frame notes + tags, replaces AnnotationsPanel |
| Create | `src/renderer/components/figma/tag-picker.tsx` | Preset + custom tag selection with autocomplete |
| Modify | `src/renderer/screens/figma-annotator.tsx` | Rewrite as layout shell consuming store + new components |
| Modify | `src/renderer/components/figma/figma-canvas.tsx` | Minor: pass empty annotations `{}` (no functional change needed) |
| Modify | `apps/backend/app/services/brainstorm_agent.py:109-157` | Update `build_initial_prompt` to handle new `designs[].frames[]` structure |
| Delete | `src/renderer/components/figma/annotations-panel.tsx` | Replaced by DesignTreeSidebar + FrameAnnotationPanel |

All frontend paths are relative to `apps/desktop/`.

---

## Chunk 1: Data Model + Zustand Store

### Task 1: Update types/figma.ts with new data model

**Files:**
- Modify: `apps/desktop/src/renderer/types/figma.ts`

- [ ] **Step 1: Read the current types file**

Read `apps/desktop/src/renderer/types/figma.ts` to understand the current `DesignEntry` type.

- [ ] **Step 2: Replace with new hierarchical types**

Replace the entire file with:

```typescript
import type { FigmaNode } from 'renderer/hooks/use-figma-connection'
import type { FlatNode } from 'renderer/components/figma/figma-node-tree'

export interface Tag {
  label: string
  preset: boolean
  color: string
}

export const PRESET_TAGS: Tag[] = [
  { label: 'todo', preset: true, color: 'yellow' },
  { label: 'approved', preset: true, color: 'green' },
  { label: 'needs-review', preset: true, color: 'blue' },
  { label: 'bug', preset: true, color: 'red' },
  { label: 'enhancement', preset: true, color: 'purple' },
]

export interface FrameAnnotation {
  notes: string
  tags: Tag[]
}

export interface FrameEntry {
  id: string
  name: string
  type: string
  nodeTree: FigmaNode
  flatNodes: FlatNode[]
  imageDataUrl: string
  rootBBox: { x: number; y: number; width: number; height: number }
  annotation: FrameAnnotation
}

export interface Design {
  id: string
  name: string
  sourceNodeId: string
  frames: FrameEntry[]
  addedAt: number
}

export const TAG_COLORS: Record<string, string> = {
  yellow: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  green: 'bg-green-500/20 text-green-400 border-green-500/30',
  blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  red: 'bg-red-500/20 text-red-400 border-red-500/30',
  purple: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  gray: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
}

export const TYPE_BADGE_COLORS: Record<string, string> = {
  FRAME: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  COMPONENT: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  INSTANCE: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  GROUP: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
}

/** @deprecated Use Design + FrameEntry instead */
export interface DesignEntry {
  id: string
  name: string
  type: string
  nodeTree: FigmaNode
  flatNodes: FlatNode[]
  imageDataUrl: string
  rootBBox: { x: number; y: number; width: number; height: number }
  notes: string
  addedAt: number
}
```

Note: Keep `DesignEntry` as deprecated temporarily so TypeScript doesn't break while other files still reference it. It will be removed in Task 7 when `figma-annotator.tsx` is rewritten.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `pnpm --filter my-electron-app typecheck`
Expected: No new errors (DesignEntry still exported)

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/renderer/types/figma.ts
git commit -m "feat(figma): add hierarchical Design/FrameEntry types with tag support"
```

---

### Task 2: Create the Zustand store

**Files:**
- Create: `apps/desktop/src/renderer/stores/use-figma-design-store.ts`

- [ ] **Step 1: Create the store file**

```typescript
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
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `pnpm --filter my-electron-app typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/renderer/stores/use-figma-design-store.ts
git commit -m "feat(figma): add Zustand store for multi-design state management"
```

---

## Chunk 2: UI Components (Part 1 — Sidebar + Toggle + TagPicker)

### Task 3: Create TagPicker component

**Files:**
- Create: `apps/desktop/src/renderer/components/figma/tag-picker.tsx`

- [ ] **Step 1: Create the component**

```typescript
import { useState, useRef } from 'react'
import { Badge, Input } from '@agent-coding/ui'
import { cn } from '@agent-coding/ui'
import { X, Plus } from 'lucide-react'
import { PRESET_TAGS } from 'renderer/types/figma'
import type { Tag } from 'renderer/types/figma'

const TAG_COLORS: Record<string, string> = {
  yellow: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  green: 'bg-green-500/20 text-green-400 border-green-500/30',
  blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  red: 'bg-red-500/20 text-red-400 border-red-500/30',
  purple: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  gray: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
}

interface TagPickerProps {
  readonly tags: Tag[]
  readonly customTags: Tag[]
  readonly onAddTag: (tag: Tag) => void
  readonly onRemoveTag: (label: string) => void
  readonly onAddCustomTag: (tag: Tag) => void
}

export function TagPicker({
  tags,
  customTags,
  onAddTag,
  onRemoveTag,
  onAddCustomTag,
}: TagPickerProps) {
  const [customInput, setCustomInput] = useState('')
  const [showInput, setShowInput] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const activeLabels = new Set(tags.map((t) => t.label))

  // Merge preset + custom for the suggestion pool
  const allAvailable = [
    ...PRESET_TAGS,
    ...customTags.filter((ct) => !PRESET_TAGS.some((p) => p.label === ct.label)),
  ]

  // Filter suggestions for autocomplete
  const suggestions = customInput.trim()
    ? allAvailable.filter(
        (t) =>
          t.label.toLowerCase().includes(customInput.toLowerCase()) &&
          !activeLabels.has(t.label),
      )
    : []

  const handleAddCustom = () => {
    const label = customInput.trim().toLowerCase()
    if (!label) return
    const existing = allAvailable.find((t) => t.label === label)
    if (existing) {
      onAddTag(existing)
    } else {
      const newTag: Tag = { label, preset: false, color: 'gray' }
      onAddCustomTag(newTag)
      onAddTag(newTag)
    }
    setCustomInput('')
    setShowInput(false)
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
        Tags
      </span>

      {/* Preset tags */}
      <div className="flex flex-wrap gap-1.5">
        {allAvailable.map((tag) => {
          const isActive = activeLabels.has(tag.label)
          const colorClass = TAG_COLORS[tag.color] ?? TAG_COLORS.gray
          return (
            <button
              key={tag.label}
              type="button"
              onClick={() =>
                isActive ? onRemoveTag(tag.label) : onAddTag(tag)
              }
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase transition-all duration-150 cursor-pointer',
                isActive
                  ? colorClass
                  : 'border-border text-muted-foreground hover:border-border hover:text-foreground',
              )}
            >
              {tag.label}
              {isActive && <X className="size-2.5" />}
            </button>
          )
        })}

        {/* Add custom tag button */}
        {!showInput && (
          <button
            type="button"
            onClick={() => {
              setShowInput(true)
              setTimeout(() => inputRef.current?.focus(), 0)
            }}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <Plus className="size-2.5" />
            Custom
          </button>
        )}
      </div>

      {/* Custom tag input */}
      {showInput && (
        <div className="relative">
          <Input
            ref={inputRef}
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddCustom()
              if (e.key === 'Escape') {
                setShowInput(false)
                setCustomInput('')
              }
            }}
            onBlur={() => {
              if (!customInput.trim()) {
                setShowInput(false)
                setCustomInput('')
              }
            }}
            placeholder="Tag name..."
            className="h-7 text-[11px]"
          />
          {suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-10 mt-1 rounded-md border border-border bg-surface p-1 shadow-md">
              {suggestions.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onAddTag(s)
                    setCustomInput('')
                    setShowInput(false)
                  }}
                  className="flex w-full items-center gap-2 rounded px-2 py-1 text-[11px] text-foreground hover:bg-surface-hover cursor-pointer transition-colors"
                >
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.5 text-[9px] uppercase',
                      TAG_COLORS[s.color] ?? TAG_COLORS.gray,
                    )}
                  >
                    {s.label}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `pnpm --filter my-electron-app typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/renderer/components/figma/tag-picker.tsx
git commit -m "feat(figma): add TagPicker component with preset + custom tags"
```

---

### Task 4: Create ViewModeToggle component

**Files:**
- Create: `apps/desktop/src/renderer/components/figma/view-mode-toggle.tsx`

- [ ] **Step 1: Create the component**

```typescript
import { Button } from '@agent-coding/ui'
import { cn } from '@agent-coding/ui'
import { LayoutGrid, Maximize2 } from 'lucide-react'

interface ViewModeToggleProps {
  readonly viewMode: 'grid' | 'detail'
  readonly onChangeMode: (mode: 'grid' | 'detail') => void
  readonly disabled?: boolean
}

export function ViewModeToggle({
  viewMode,
  onChangeMode,
  disabled,
}: ViewModeToggleProps) {
  return (
    <div className="inline-flex items-center rounded-md border border-border bg-surface p-0.5">
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={disabled}
        onClick={() => onChangeMode('grid')}
        className={cn(
          'size-7 cursor-pointer transition-colors duration-150',
          viewMode === 'grid' && 'bg-accent text-accent-foreground',
        )}
      >
        <LayoutGrid className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={disabled}
        onClick={() => onChangeMode('detail')}
        className={cn(
          'size-7 cursor-pointer transition-colors duration-150',
          viewMode === 'detail' && 'bg-accent text-accent-foreground',
        )}
      >
        <Maximize2 className="size-3.5" />
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `pnpm --filter my-electron-app typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/renderer/components/figma/view-mode-toggle.tsx
git commit -m "feat(figma): add ViewModeToggle component"
```

---

### Task 5: Create DesignTreeSidebar component

**Files:**
- Create: `apps/desktop/src/renderer/components/figma/design-tree-sidebar.tsx`

- [ ] **Step 1: Create the component**

Design system notes: Glass panel background, 11px/600 uppercase section header, sidebar-item pattern for tree nodes, `--selection` bg for active, `cursor-pointer` on all items.

```typescript
import { ScrollArea, Badge } from '@agent-coding/ui'
import { cn } from '@agent-coding/ui'
import { ChevronDown, ChevronRight, Trash2, Image } from 'lucide-react'
import { useState } from 'react'
import type { Design } from 'renderer/types/figma'

interface DesignTreeSidebarProps {
  readonly designs: Design[]
  readonly activeDesignId: string | null
  readonly activeFrameId: string | null
  readonly onSelectDesign: (id: string) => void
  readonly onSelectFrame: (designId: string, frameId: string) => void
  readonly onRemoveDesign: (id: string) => void
}

const TYPE_BADGE_COLORS: Record<string, string> = {
  FRAME: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  COMPONENT: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  INSTANCE: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  GROUP: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
}

export function DesignTreeSidebar({
  designs,
  activeDesignId,
  activeFrameId,
  onSelectDesign,
  onSelectFrame,
  onRemoveDesign,
}: DesignTreeSidebarProps) {
  const [expandedDesigns, setExpandedDesigns] = useState<Set<string>>(
    () => new Set(designs.map((d) => d.id)),
  )

  const toggleExpand = (id: string) => {
    setExpandedDesigns((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          Designs ({designs.length})
        </span>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-1">
          {designs.map((design) => {
            const isExpanded = expandedDesigns.has(design.id)
            const isActiveDesign = design.id === activeDesignId

            return (
              <div key={design.id}>
                {/* Design row */}
                <button
                  type="button"
                  onClick={() => {
                    toggleExpand(design.id)
                    onSelectDesign(design.id)
                  }}
                  className={cn(
                    'flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left transition-colors duration-150 cursor-pointer',
                    isActiveDesign && !activeFrameId
                      ? 'bg-(--selection)'
                      : 'hover:bg-surface-hover',
                  )}
                >
                  {isExpanded ? (
                    <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="size-3 shrink-0 text-muted-foreground" />
                  )}
                  <span className="flex-1 truncate text-[13px] font-medium text-foreground">
                    {design.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {design.frames.length}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onRemoveDesign(design.id)
                    }}
                    className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-red-400 transition-colors cursor-pointer"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </button>

                {/* Frame children */}
                {isExpanded &&
                  design.frames.map((frame) => {
                    const isActiveFrame =
                      isActiveDesign && frame.id === activeFrameId
                    const tagCount = frame.annotation.tags.length
                    const hasNotes = frame.annotation.notes.length > 0
                    const badgeColor =
                      TYPE_BADGE_COLORS[frame.type] ??
                      'bg-zinc-500/20 text-zinc-400 border-zinc-500/30'

                    return (
                      <button
                        key={frame.id}
                        type="button"
                        onClick={() =>
                          onSelectFrame(design.id, frame.id)
                        }
                        className={cn(
                          'flex w-full items-center gap-1.5 rounded-md py-1 pl-7 pr-2 text-left transition-colors duration-150 cursor-pointer',
                          isActiveFrame
                            ? 'bg-(--selection) border-l-2 border-accent'
                            : 'hover:bg-surface-hover',
                        )}
                      >
                        <Image className="size-3 shrink-0 text-muted-foreground" />
                        <span className="flex-1 truncate text-[12px] text-foreground">
                          {frame.name}
                        </span>
                        {(tagCount > 0 || hasNotes) && (
                          <div className="flex items-center gap-1">
                            {tagCount > 0 && (
                              <Badge
                                variant="outline"
                                className={cn(
                                  'px-1 py-0 text-[9px]',
                                  badgeColor,
                                )}
                              >
                                {tagCount}
                              </Badge>
                            )}
                            {hasNotes && (
                              <span className="size-1.5 rounded-full bg-yellow-400" />
                            )}
                          </div>
                        )}
                      </button>
                    )
                  })}
              </div>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `pnpm --filter my-electron-app typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/renderer/components/figma/design-tree-sidebar.tsx
git commit -m "feat(figma): add DesignTreeSidebar with collapsible tree navigation"
```

---

## Chunk 3: UI Components (Part 2 — Grid, Detail, Annotation Panel)

### Task 6: Create FrameGrid, FrameDetailView, and FrameAnnotationPanel

**Files:**
- Create: `apps/desktop/src/renderer/components/figma/frame-grid.tsx`
- Create: `apps/desktop/src/renderer/components/figma/frame-detail-view.tsx`
- Create: `apps/desktop/src/renderer/components/figma/frame-annotation-panel.tsx`

- [ ] **Step 1: Create FrameGrid component**

Design system notes: Use `bento-cell` pattern — `surface-elevated` background, 12px radius, 16px padding, `shadow-md` on hover. Tag badges as pills. 13px name, 11px caption.

```typescript
// frame-grid.tsx
import { Badge } from '@agent-coding/ui'
import { cn } from '@agent-coding/ui'
import type { FrameEntry } from 'renderer/types/figma'

const TAG_COLORS: Record<string, string> = {
  yellow: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  green: 'bg-green-500/20 text-green-400 border-green-500/30',
  blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  red: 'bg-red-500/20 text-red-400 border-red-500/30',
  purple: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  gray: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
}

interface FrameGridProps {
  readonly frames: FrameEntry[]
  readonly activeFrameId: string | null
  readonly onSelectFrame: (frameId: string) => void
}

export function FrameGrid({
  frames,
  activeFrameId,
  onSelectFrame,
}: FrameGridProps) {
  return (
    <div className="grid grid-cols-3 gap-3 p-4">
      {frames.map((frame) => {
        const isActive = frame.id === activeFrameId
        const hasNotes = frame.annotation.notes.length > 0

        return (
          <button
            key={frame.id}
            type="button"
            onClick={() => onSelectFrame(frame.id)}
            className={cn(
              'flex flex-col rounded-xl border p-4 text-left transition-all duration-150 cursor-pointer',
              'bg-surface-elevated hover:shadow-md',
              isActive
                ? 'border-accent shadow-md'
                : 'border-border hover:border-border',
            )}
          >
            {/* Thumbnail */}
            <div className="relative mb-3 aspect-video w-full overflow-hidden rounded-lg bg-zinc-950">
              <img
                src={frame.imageDataUrl}
                alt={frame.name}
                className="size-full object-contain"
              />
              {hasNotes && (
                <div className="absolute right-1.5 top-1.5 size-3 rounded-full bg-yellow-400" />
              )}
            </div>

            {/* Name */}
            <span className="truncate text-[13px] font-medium text-foreground">
              {frame.name}
            </span>

            {/* Type + Tags */}
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              <Badge
                variant="outline"
                className="px-1.5 py-0 text-[9px] bg-zinc-500/20 text-zinc-400 border-zinc-500/30"
              >
                {frame.type}
              </Badge>
              {frame.annotation.tags.map((tag) => (
                <Badge
                  key={tag.label}
                  variant="outline"
                  className={cn(
                    'px-1.5 py-0 text-[9px]',
                    TAG_COLORS[tag.color] ?? TAG_COLORS.gray,
                  )}
                >
                  {tag.label}
                </Badge>
              ))}
            </div>
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Create FrameDetailView component**

This wraps existing `FigmaNodeTree` and `FigmaCanvas` in a vertical SplitPane for the active frame. Follows spec: LayersPanel 20% min 15%, Canvas 80% min 40%.

```typescript
// frame-detail-view.tsx
import {
  SplitPane,
  SplitPanePanel,
  SplitPaneHandle,
} from '@agent-coding/ui'
import { FigmaNodeTree } from 'renderer/components/figma/figma-node-tree'
import { FigmaCanvas } from 'renderer/components/figma/figma-canvas'
import type { FrameEntry } from 'renderer/types/figma'

interface FrameDetailViewProps {
  readonly frame: FrameEntry
  readonly selectedNodeId: string | null
  readonly hoveredNodeId: string | null
  readonly onSelectNode: (nodeId: string) => void
  readonly onHoverNode: (nodeId: string | null) => void
}

export function FrameDetailView({
  frame,
  selectedNodeId,
  hoveredNodeId,
  onSelectNode,
  onHoverNode,
}: FrameDetailViewProps) {
  return (
    <SplitPane orientation="horizontal" className="h-full">
      <SplitPanePanel defaultSize={20} minSize={15}>
        <div className="flex h-full flex-col">
          <div className="flex items-center border-b border-border px-3 py-2">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Layers
            </span>
          </div>
          <FigmaNodeTree
            nodes={frame.flatNodes}
            selectedNodeId={selectedNodeId}
            hoveredNodeId={hoveredNodeId}
            annotations={{}}
            onSelectNode={onSelectNode}
            onHoverNode={onHoverNode}
          />
        </div>
      </SplitPanePanel>

      <SplitPaneHandle />

      <SplitPanePanel defaultSize={80} minSize={40}>
        <FigmaCanvas
          imageDataUrl={frame.imageDataUrl}
          rootBBox={frame.rootBBox}
          nodes={frame.flatNodes}
          selectedNodeId={selectedNodeId}
          hoveredNodeId={hoveredNodeId}
          annotations={{}}
          onSelectNode={onSelectNode}
          onHoverNode={onHoverNode}
        />
      </SplitPanePanel>
    </SplitPane>
  )
}
```

- [ ] **Step 3: Create FrameAnnotationPanel component**

Design system notes: 11px/600 uppercase section headers, glass panel styling, pill tags, textarea for notes.

```typescript
// frame-annotation-panel.tsx
import { ScrollArea, Badge, Textarea } from '@agent-coding/ui'
import { cn } from '@agent-coding/ui'
import { TagPicker } from 'renderer/components/figma/tag-picker'
import type { FrameEntry, Tag } from 'renderer/types/figma'

const TYPE_BADGE_COLORS: Record<string, string> = {
  FRAME: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  COMPONENT: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  INSTANCE: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  GROUP: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
}

interface FrameAnnotationPanelProps {
  readonly frame: FrameEntry | null
  readonly customTags: Tag[]
  readonly onUpdateNotes: (notes: string) => void
  readonly onAddTag: (tag: Tag) => void
  readonly onRemoveTag: (label: string) => void
  readonly onAddCustomTag: (tag: Tag) => void
}

export function FrameAnnotationPanel({
  frame,
  customTags,
  onUpdateNotes,
  onAddTag,
  onRemoveTag,
  onAddCustomTag,
}: FrameAnnotationPanelProps) {
  if (!frame) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center border-b border-border px-3 py-2">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Annotations
          </span>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <span className="text-[11px] text-muted-foreground">
            Select a frame to annotate
          </span>
        </div>
      </div>
    )
  }

  const badgeColor =
    TYPE_BADGE_COLORS[frame.type] ??
    'bg-zinc-500/20 text-zinc-400 border-zinc-500/30'

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center border-b border-border px-3 py-2">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          Annotations
        </span>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-4 p-3">
          {/* Frame info */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-foreground truncate">
              {frame.name}
            </span>
            <Badge
              variant="outline"
              className={cn('w-fit px-1.5 py-0 text-[10px]', badgeColor)}
            >
              {frame.type}
            </Badge>
            <span className="text-[10px] font-mono text-muted-foreground truncate">
              {frame.id}
            </span>
          </div>

          {/* Tags */}
          <TagPicker
            tags={frame.annotation.tags}
            customTags={customTags}
            onAddTag={onAddTag}
            onRemoveTag={onRemoveTag}
            onAddCustomTag={onAddCustomTag}
          />

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Notes
            </span>
            <Textarea
              value={frame.annotation.notes}
              onChange={(e) => onUpdateNotes(e.target.value)}
              placeholder="Add notes about this frame..."
              className="min-h-[120px] text-[12px] resize-none"
            />
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `pnpm --filter my-electron-app typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/renderer/components/figma/frame-grid.tsx \
       apps/desktop/src/renderer/components/figma/frame-detail-view.tsx \
       apps/desktop/src/renderer/components/figma/frame-annotation-panel.tsx
git commit -m "feat(figma): add FrameGrid, FrameDetailView, and FrameAnnotationPanel components"
```

---

## Chunk 4: Rewrite Screen + Smart Load + Brainstorm Integration

### Task 7: Rewrite figma-annotator.tsx as layout shell

**Files:**
- Modify: `apps/desktop/src/renderer/screens/figma-annotator.tsx`

- [ ] **Step 1: Read the current file**

Read `apps/desktop/src/renderer/screens/figma-annotator.tsx` to confirm current state.

- [ ] **Step 2: Rewrite the file**

Replace the entire file. The screen becomes a thin layout shell that:
- Uses `useFigmaDesignStore` for all state
- Uses `useFigmaConnection` for WebSocket communication
- Implements smart `handleLoadDesign` with duplicate detection and children expansion
- Composes the new components in a 3-panel SplitPane layout
- Calls `store.reset()` on unmount via `useEffect`

```typescript
import { useState, useCallback, useEffect } from 'react'
import {
  SplitPane, SplitPanePanel, SplitPaneHandle,
  Button, Input, Badge, Spinner,
} from '@agent-coding/ui'
import {
  ArrowLeft, LayoutGrid, Plug, Unplug, Download, Loader2, Sparkles,
} from 'lucide-react'
import { useFigmaConnection } from 'renderer/hooks/use-figma-connection'
import type { FigmaNode } from 'renderer/hooks/use-figma-connection'
import type { FlatNode } from 'renderer/components/figma/figma-node-tree'
import { DesignTreeSidebar } from 'renderer/components/figma/design-tree-sidebar'
import { FrameGrid } from 'renderer/components/figma/frame-grid'
import { FrameDetailView } from 'renderer/components/figma/frame-detail-view'
import { FrameAnnotationPanel } from 'renderer/components/figma/frame-annotation-panel'
import { ViewModeToggle } from 'renderer/components/figma/view-mode-toggle'
import type { Design, FrameEntry } from 'renderer/types/figma'
import { useFigmaDesignStore } from 'renderer/stores/use-figma-design-store'
import { useBrainstormStart } from 'renderer/hooks/queries/use-brainstorm'
import { generateFigmaMarkdown } from 'renderer/lib/figma-export'
import { useTabStore } from 'renderer/stores/use-tab-store'
import { useStatusBarStore } from 'renderer/stores/use-status-bar-store'

function flattenNodes(node: FigmaNode, depth: number, result: FlatNode[]) {
  if (!node.absoluteBoundingBox) return
  result.push({
    id: node.id,
    name: node.name,
    type: node.type,
    depth,
    absoluteBoundingBox: node.absoluteBoundingBox,
    characters: node.characters,
    fills: node.fills,
  })
  if (node.children) {
    for (const child of node.children) {
      flattenNodes(child, depth + 1, result)
    }
  }
}

async function fetchFrameEntry(
  figma: ReturnType<typeof useFigmaConnection>,
  node: { id: string; name: string; type: string },
): Promise<FrameEntry> {
  const [nodeInfo, exported] = await Promise.all([
    figma.sendCommand<FigmaNode>('get_node_info', { nodeId: node.id }),
    figma.sendCommand<{ imageData: string }>('export_node_as_image', {
      nodeId: node.id,
      format: 'PNG',
      scale: 2,
    }),
  ])

  if (!nodeInfo.absoluteBoundingBox) {
    throw new Error(
      `Node "${node.name}" has no bounding box. Select a frame with dimensions.`,
    )
  }

  const imgData = exported.imageData.startsWith('data:')
    ? exported.imageData
    : `data:image/png;base64,${exported.imageData}`

  const flat: FlatNode[] = []
  flattenNodes(nodeInfo, 0, flat)

  return {
    id: node.id,
    name: node.name ?? nodeInfo.name,
    type: node.type ?? nodeInfo.type,
    nodeTree: nodeInfo,
    flatNodes: flat,
    imageDataUrl: imgData,
    rootBBox: nodeInfo.absoluteBoundingBox,
    annotation: { notes: '', tags: [] },
  }
}

interface FigmaAnnotatorScreenProps {
  readonly projectId: string
}

export function FigmaAnnotatorScreen({ projectId }: FigmaAnnotatorScreenProps) {
  const figma = useFigmaConnection()
  const closeTab = useTabStore((s) => s.closeTab)
  const brainstorm = useBrainstormStart(projectId)

  // Store
  const store = useFigmaDesignStore()

  // Connection
  const [channelId, setChannelId] = useState('')

  // Derived
  const activeDesign =
    store.designs.find((d) => d.id === store.activeDesignId) ?? null
  const activeFrame =
    activeDesign?.frames.find((f) => f.id === store.activeFrameId) ?? null

  // Cleanup on unmount
  useEffect(() => {
    return () => store.reset()
  }, [store])

  const handleBack = useCallback(() => {
    closeTab(projectId, `figma-${projectId}`)
  }, [closeTab, projectId])

  const handleLoadDesign = useCallback(async () => {
    store.setLoading(true)
    store.setLoadError(null)
    try {
      const selection = await figma.sendCommand<{
        selection: Array<{ id: string; name: string; type: string }>
      }>('get_selection')

      if (!selection.selection?.length) {
        throw new Error('No node selected in Figma. Please select a frame.')
      }

      // Duplicate detection
      const sourceId =
        selection.selection.length === 1
          ? selection.selection[0].id
          : selection.selection
              .map((n) => n.id)
              .sort()
              .join(',')
      const existing = store.designs.find((d) => d.sourceNodeId === sourceId)
      if (existing) {
        store.setActiveDesign(existing.id)
        return
      }

      let frames: FrameEntry[]
      let designName: string

      if (selection.selection.length > 1) {
        // Multi-select: import all selected nodes
        frames = await Promise.all(
          selection.selection.map((node) => fetchFrameEntry(figma, node)),
        )
        designName = `Design #${store.designs.length + 1}`
      } else {
        const node = selection.selection[0]
        const nodeInfo = await figma.sendCommand<FigmaNode>('get_node_info', {
          nodeId: node.id,
        })

        const childFrames = nodeInfo.children?.filter(
          (c) =>
            ['FRAME', 'COMPONENT', 'INSTANCE'].includes(c.type) &&
            c.absoluteBoundingBox,
        )

        if (childFrames && childFrames.length > 0) {
          // Single parent with children → expand
          frames = await Promise.all(
            childFrames.map((child) =>
              fetchFrameEntry(figma, {
                id: child.id,
                name: child.name,
                type: child.type,
              }),
            ),
          )
          designName = node.name
        } else {
          // Leaf node → single frame
          frames = [await fetchFrameEntry(figma, node)]
          designName = node.name
        }
      }

      const design: Design = {
        id: crypto.randomUUID(),
        name: designName,
        sourceNodeId: sourceId,
        frames,
        addedAt: Date.now(),
      }

      store.addDesign(design)
      store.setActiveDesign(design.id)
      store.setViewMode(frames.length > 1 ? 'grid' : 'detail')
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Failed to load design'
      store.setLoadError(message)
      console.error('Failed to load design:', e)
    } finally {
      store.setLoading(false)
    }
  }, [figma, store])

  const handleSelectNode = useCallback(
    (nodeId: string) => {
      store.setSelectedNode(nodeId)
      figma
        .sendCommand('set_selections', { nodeIds: [nodeId] })
        .catch(() => {})
    },
    [figma, store],
  )

  const handleSelectFrame = useCallback(
    (designId: string, frameId: string) => {
      store.setActiveFrame(designId, frameId)
      store.setViewMode('detail')
    },
    [store],
  )

  const handleSelectFrameFromGrid = useCallback(
    (frameId: string) => {
      if (store.activeDesignId) {
        store.setActiveFrame(store.activeDesignId, frameId)
        store.setViewMode('detail')
      }
    },
    [store],
  )

  const handleStartBrainstorm = useCallback(() => {
    const figmaData: Record<string, unknown> = {
      designs: store.designs.map((design) => ({
        id: design.id,
        name: design.name,
        frames: design.frames.map((frame) => ({
          id: frame.id,
          name: frame.name,
          type: frame.type,
          notes: frame.annotation.notes,
          tags: frame.annotation.tags.map((t) => t.label),
          markdown: generateFigmaMarkdown(frame.nodeTree, {}),
        })),
      })),
    }
    brainstorm.mutate({ figma_data: figmaData })
  }, [store.designs, brainstorm])

  const isConnected = figma.state.status === 'connected'
  const errorMessage = figma.state.error || store.loadError

  // Status bar
  const setItem = useStatusBarStore((s) => s.setItem)
  const removeItem = useStatusBarStore((s) => s.removeItem)

  useEffect(() => {
    setItem({
      id: 'figma-connection',
      content: (
        <>
          <span
            className={`size-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-zinc-500'}`}
          />
          <span>Figma: {isConnected ? 'Connected' : 'Disconnected'}</span>
        </>
      ),
      order: 10,
    })
    setItem({
      id: 'figma-designs',
      content: (
        <span>
          {store.designs.length} design
          {store.designs.length !== 1 ? 's' : ''} loaded
        </span>
      ),
      order: 11,
    })
    return () => {
      removeItem('figma-connection')
      removeItem('figma-designs')
    }
  }, [isConnected, store.designs.length, setItem, removeItem])

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4">
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-7 cursor-pointer"
          onClick={handleBack}
        >
          <ArrowLeft className="size-4" />
        </Button>

        <LayoutGrid className="size-4 text-muted-foreground" />
        <span className="text-[13px] font-semibold">Figma Import</span>

        <Badge
          variant="outline"
          className={
            isConnected
              ? 'border-green-500/50 text-green-400'
              : figma.state.status === 'connecting'
                ? 'border-yellow-500/50 text-yellow-400'
                : 'border-zinc-500/50 text-zinc-400'
          }
        >
          {figma.state.status}
        </Badge>

        <div className="mx-2 h-4 w-px bg-border" />

        {isConnected ? (
          <>
            <span className="text-[11px] font-mono text-muted-foreground">
              {channelId}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={figma.disconnect}
              className="cursor-pointer"
            >
              <Unplug className="mr-1.5 size-3" /> Disconnect
            </Button>
            <Button
              size="sm"
              onClick={handleLoadDesign}
              disabled={store.isLoading}
              className="cursor-pointer"
            >
              {store.isLoading ? (
                <Loader2 className="mr-1.5 size-3 animate-spin" />
              ) : (
                <Download className="mr-1.5 size-3" />
              )}
              Load Design
            </Button>
          </>
        ) : (
          <>
            <Input
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
              placeholder="Channel ID"
              className="w-40 text-[12px] font-mono"
            />
            <Button
              size="sm"
              onClick={() => figma.connect(channelId)}
              disabled={!channelId.trim()}
              className="cursor-pointer"
            >
              <Plug className="mr-1.5 size-3" /> Connect
            </Button>
          </>
        )}

        <span className="flex-1" />

        <Button
          size="sm"
          onClick={handleStartBrainstorm}
          disabled={store.designs.length === 0 || brainstorm.isPending}
          className="bg-accent text-accent-foreground hover:bg-accent/90 cursor-pointer"
        >
          <Sparkles className="mr-1.5 size-3" />
          Start Brainstorm
        </Button>
      </div>

      {/* Error banner */}
      {errorMessage && (
        <div className="flex items-center gap-2 border-b border-red-500/30 bg-red-500/10 px-4 py-2">
          <span className="text-[11px] text-red-400">{errorMessage}</span>
        </div>
      )}

      {/* Main content */}
      {store.designs.length > 0 ? (
        <SplitPane orientation="horizontal" className="flex-1">
          {/* Left: Design tree sidebar */}
          <SplitPanePanel defaultSize={20} minSize={15}>
            <DesignTreeSidebar
              designs={store.designs}
              activeDesignId={store.activeDesignId}
              activeFrameId={store.activeFrameId}
              onSelectDesign={store.setActiveDesign}
              onSelectFrame={handleSelectFrame}
              onRemoveDesign={store.removeDesign}
            />
          </SplitPanePanel>

          <SplitPaneHandle />

          {/* Center: Grid or Detail view */}
          <SplitPanePanel defaultSize={50} minSize={30}>
            <div className="flex h-full flex-col">
              {/* View mode toggle bar */}
              {activeDesign && (
                <div className="flex items-center gap-2 border-b border-border px-3 py-1.5">
                  <ViewModeToggle
                    viewMode={store.viewMode}
                    onChangeMode={store.setViewMode}
                  />
                  <span className="text-[11px] text-muted-foreground">
                    {activeDesign.name} — {activeDesign.frames.length} frame
                    {activeDesign.frames.length !== 1 ? 's' : ''}
                  </span>
                </div>
              )}

              {/* Content area */}
              <div className="flex-1 overflow-auto">
                {!activeDesign ? (
                  <div className="flex h-full items-center justify-center text-[11px] text-muted-foreground">
                    Select a design from the sidebar
                  </div>
                ) : store.viewMode === 'grid' ? (
                  <FrameGrid
                    frames={activeDesign.frames}
                    activeFrameId={store.activeFrameId}
                    onSelectFrame={handleSelectFrameFromGrid}
                  />
                ) : activeFrame ? (
                  <FrameDetailView
                    frame={activeFrame}
                    selectedNodeId={store.selectedNodeId}
                    hoveredNodeId={store.hoveredNodeId}
                    onSelectNode={handleSelectNode}
                    onHoverNode={store.setHoveredNode}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-[11px] text-muted-foreground">
                    Select a frame to view details
                  </div>
                )}
              </div>
            </div>
          </SplitPanePanel>

          <SplitPaneHandle />

          {/* Right: Annotation panel */}
          <SplitPanePanel defaultSize={30} minSize={15}>
            <FrameAnnotationPanel
              frame={activeFrame}
              customTags={store.customTags}
              onUpdateNotes={(notes) => {
                if (store.activeDesignId && store.activeFrameId) {
                  store.updateFrameNotes(
                    store.activeDesignId,
                    store.activeFrameId,
                    notes,
                  )
                }
              }}
              onAddTag={(tag) => {
                if (store.activeDesignId && store.activeFrameId) {
                  store.addFrameTag(
                    store.activeDesignId,
                    store.activeFrameId,
                    tag,
                  )
                }
              }}
              onRemoveTag={(label) => {
                if (store.activeDesignId && store.activeFrameId) {
                  store.removeFrameTag(
                    store.activeDesignId,
                    store.activeFrameId,
                    label,
                  )
                }
              }}
              onAddCustomTag={store.addCustomTag}
            />
          </SplitPanePanel>
        </SplitPane>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-muted-foreground">
          {store.isLoading ? (
            <Spinner label="Loading design..." />
          ) : (
            <div className="max-w-md text-center">
              <div className="text-[13px] font-semibold tracking-tight mb-2">
                {isConnected
                  ? 'Select frames in Figma and click Load Design'
                  : 'Connect to Figma to get started'}
              </div>
              <p className="text-[11px]">
                {isConnected
                  ? 'Select one or multiple frames. Single parent nodes will auto-expand their children.'
                  : 'Enter the channel ID from the Figma plugin and click Connect.'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `pnpm --filter my-electron-app typecheck`
Expected: PASS (may have warnings about unused DesignEntry import elsewhere)

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/renderer/screens/figma-annotator.tsx
git commit -m "feat(figma): rewrite annotator screen with multi-design store and new components"
```

---

### Task 8: Clean up — remove old AnnotationsPanel and deprecated DesignEntry

**Files:**
- Delete: `apps/desktop/src/renderer/components/figma/annotations-panel.tsx`
- Modify: `apps/desktop/src/renderer/types/figma.ts` (remove deprecated DesignEntry)

- [ ] **Step 1: Check for any remaining references to AnnotationsPanel or DesignEntry**

Run: `grep -r "AnnotationsPanel\|DesignEntry" apps/desktop/src/renderer/ --include="*.tsx" --include="*.ts" -l`

If any files still import these, update them first.

- [ ] **Step 2: Delete annotations-panel.tsx**

```bash
rm apps/desktop/src/renderer/components/figma/annotations-panel.tsx
```

- [ ] **Step 3: Remove deprecated DesignEntry from types/figma.ts**

Remove the `DesignEntry` interface and the `@deprecated` comment from `apps/desktop/src/renderer/types/figma.ts`.

- [ ] **Step 4: Verify TypeScript compiles**

Run: `pnpm --filter my-electron-app typecheck`
Expected: PASS — no references to removed types

- [ ] **Step 5: Commit**

```bash
git add -A apps/desktop/src/renderer/components/figma/annotations-panel.tsx \
         apps/desktop/src/renderer/types/figma.ts
git commit -m "refactor(figma): remove old AnnotationsPanel and deprecated DesignEntry type"
```

---

### Task 9: Update backend brainstorm prompt for new figma_data structure

**Files:**
- Modify: `apps/backend/app/services/brainstorm_agent.py:109-157`

- [ ] **Step 1: Read the current `build_initial_prompt` function**

Read `apps/backend/app/services/brainstorm_agent.py` lines 109-157.

- [ ] **Step 2: Update to handle `designs[].frames[]` structure**

Replace the `build_initial_prompt` function:

```python
def build_initial_prompt(
    source: str,
    initial_message: str | None,
    figma_data: dict | None,
) -> str:
    parts: list[str] = []

    if source == "figma" and figma_data:
        parts.append("## Design Context (from Figma)\n")

        # Legacy flat fields
        if figma_data.get("file_name"):
            parts.append(f"**File:** {figma_data['file_name']}")
        if figma_data.get("page_name"):
            parts.append(f"**Page:** {figma_data['page_name']}")
        if figma_data.get("figma_url"):
            parts.append(f"**Figma URL:** {figma_data['figma_url']}")
        if figma_data.get("description"):
            parts.append(f"**Description:** {figma_data['description']}")

        # New hierarchical designs → frames structure
        designs = figma_data.get("designs", [])
        if designs:
            for design in designs:
                parts.append(f"\n### Design: {design.get('name', 'Unnamed')}")
                frames = design.get("frames", [])
                for frame in frames:
                    parts.append(
                        f"\n#### Frame: {frame.get('name', 'Unnamed')} "
                        f"({frame.get('type', 'FRAME')})"
                    )
                    tags = frame.get("tags", [])
                    if tags:
                        parts.append(f"**Tags:** {', '.join(tags)}")
                    notes = frame.get("notes", "")
                    if notes:
                        parts.append(f"**Notes:** {notes}")
                    markdown = frame.get("markdown", "")
                    if markdown:
                        parts.append(f"\n{markdown}")
        elif figma_data.get("node_names"):
            # Legacy: flat node_names list
            parts.append(
                "**Selected elements:** "
                f"{', '.join(figma_data['node_names'])}"
            )

        parts.append("")
        parts.append(
            "Use this design context to inform your questions. "
            "Include relevant Design References in the final "
            "summary."
        )
        parts.append("")

    if initial_message:
        parts.append(initial_message)
    elif source == "figma":
        parts.append(
            "I'd like to create a ticket based on this Figma "
            "design. Please help me brainstorm the "
            "implementation details."
        )
    else:
        parts.append(
            "I'd like to brainstorm a new feature. Please start "
            "by asking me what problem I'm trying to solve."
        )

    return "\n".join(parts)
```

- [ ] **Step 3: Run backend tests**

Run: `cd apps/backend && uv run pytest tests/ -v -k brainstorm`
Expected: PASS (or if tests don't cover this, at least no import errors)

- [ ] **Step 4: Commit**

```bash
git add apps/backend/app/services/brainstorm_agent.py
git commit -m "feat(backend): update brainstorm prompt to handle hierarchical designs.frames structure"
```

---

## Chunk 5: Verification

### Task 10: Full build and lint verification

- [ ] **Step 1: Run full typecheck**

Run: `pnpm typecheck`
Expected: PASS across all packages

- [ ] **Step 2: Run linter**

Run: `pnpm lint`
Expected: PASS (fix any lint issues found)

- [ ] **Step 3: Run backend tests**

Run: `cd apps/backend && uv run pytest tests/ -v`
Expected: PASS

- [ ] **Step 4: Run desktop dev to verify it starts**

Run: `pnpm --filter my-electron-app dev`
Expected: Electron app starts without errors, Figma Annotator screen loads showing empty state

- [ ] **Step 5: Final commit if any lint fixes were needed**

```bash
git add -A
git commit -m "fix: lint and type fixes for figma multi-design flow"
```
