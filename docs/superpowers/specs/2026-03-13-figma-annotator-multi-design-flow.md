# Figma Annotator: Multi-Design Flow

## Overview

Refactor the Figma Annotator screen to support loading multiple designs, each containing multiple node frames, with per-frame annotations (text notes + tags). Replace flat `DesignEntry` model with hierarchical `Design → FrameEntry[]` structure and extract state into a dedicated Zustand store.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Load behavior | Smart: multi-select → import directly, single parent → auto expand children | Covers both workflows without user needing to remember rules |
| Annotations | Text notes + preset/custom tags per frame | Flexible — preset tags for speed, custom for specificity |
| Navigation | Sidebar tree + Grid/Detail toggle | Overview when needed, detail when annotating |
| Persistence | In-memory (React state) | Data only needed within session, sent to backend on brainstorm start |
| Architecture | Zustand store + focused components | Consistent with existing patterns (useTabStore, useStatusBarStore), clean separation of state and UI |

## Data Model

```typescript
const PRESET_TAGS: Tag[] = [
  { label: 'todo', preset: true, color: 'yellow' },
  { label: 'approved', preset: true, color: 'green' },
  { label: 'needs-review', preset: true, color: 'blue' },
  { label: 'bug', preset: true, color: 'red' },
  { label: 'enhancement', preset: true, color: 'purple' },
]

interface Tag {
  label: string
  preset: boolean      // true = from PRESET_TAGS, false = user-created
  color: string        // Semantic color key for badge rendering
}

interface FrameAnnotation {
  notes: string
  tags: Tag[]
}

interface FrameEntry {
  id: string             // Figma node ID
  name: string
  type: string
  nodeTree: FigmaNode
  flatNodes: FlatNode[]
  imageDataUrl: string
  rootBBox: { x: number; y: number; width: number; height: number }
  annotation: FrameAnnotation
}

interface Design {
  id: string             // Generated UUID
  name: string           // From parent node name or "Design #N"
  sourceNodeId: string   // Figma parent node ID (if expand children)
  frames: FrameEntry[]
  addedAt: number
}
```

### Changes from current model

- `DesignEntry` (flat, 1 node = 1 entry) → `Design` containing `FrameEntry[]`
- `notes: string` at design level → `FrameAnnotation { notes, tags }` at frame level
- Each frame has its own `imageDataUrl`, `flatNodes`, `nodeTree` for independent canvas rendering

## Zustand Store

File: `apps/desktop/src/renderer/stores/use-figma-design-store.ts`

```typescript
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
  reset: () => void   // Clean up on unmount / navigation away

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
```

## Component Architecture

```
figma-annotator.tsx (layout shell)
├── Header (connection, load design, start brainstorm)
│
├── SplitPane horizontal
│   ├── DesignTreeSidebar (left, 20%)
│   │   └── Tree: Design → FrameEntry[]
│   │       - Click design → setActiveDesign
│   │       - Click frame → setActiveFrame + viewMode='detail'
│   │
│   ├── MainPanel (center, 50%)
│   │   ├── ViewModeToggle [Grid | Detail]
│   │   ├── FrameGrid (viewMode='grid')
│   │   │   └── Bento grid of frame thumbnails
│   │   │       - Click → setActiveFrame + viewMode='detail'
│   │   │       - Badge: tag count, notes indicator
│   │   └── FrameDetailView (viewMode='detail')
│   │       └── SplitPane vertical
│   │           ├── LayersPanel (20% min 15%, reuse FigmaNodeTree)
│   │           └── FigmaCanvas (80% min 40%, reuse existing)
│   │       Props from store: selectedNodeId, hoveredNodeId
│   │       Callbacks: onSelectNode → setSelectedNode + figma.sendCommand('set_selections')
│   │                  onHoverNode → setHoveredNode
│   │
│   └── FrameAnnotationPanel (right, 30%)
│       ├── Frame info (name, type badge)
│       ├── TagPicker
│       │   ├── Preset tags (pill badges, click to toggle)
│       │   └── Custom tag input (autocomplete from customTags)
│       └── Notes textarea
│
└── Empty state (no designs loaded)
```

### New components

| Component | File | Purpose |
|-----------|------|---------|
| `DesignTreeSidebar` | `components/figma/design-tree-sidebar.tsx` | Tree navigation: designs → frames |
| `FrameGrid` | `components/figma/frame-grid.tsx` | Bento grid overview of all frames in active design |
| `FrameDetailView` | `components/figma/frame-detail-view.tsx` | Canvas + layers for single frame (wraps existing components) |
| `ViewModeToggle` | `components/figma/view-mode-toggle.tsx` | Grid/Detail toggle buttons |
| `FrameAnnotationPanel` | `components/figma/frame-annotation-panel.tsx` | Per-frame notes + tags |
| `TagPicker` | `components/figma/tag-picker.tsx` | Preset + custom tag selection with autocomplete |

### Reused components

- `FigmaNodeTree` — layers panel in detail view
- `FigmaCanvas` — canvas rendering
- `SplitPane` / `SplitPanePanel` / `SplitPaneHandle` — layout

### Removed/replaced

- `AnnotationsPanel` — replaced by `DesignTreeSidebar` + `FrameAnnotationPanel`
- "Export Documentation" button — removed from panel footer (was non-functional placeholder)

### Behavior: design removal

When a design is removed via `removeDesign(id)`:
- If removed design was active → set `activeDesignId` to the next design (or null if none remain)
- Clear `activeFrameId`, `selectedNodeId`, `hoveredNodeId`
- Same logic as current `handleRemoveDesign` but in the store

## Smart Load Design Logic

```typescript
async function handleLoadDesign() {
  const selection = await figma.sendCommand('get_selection')

  if (!selection.selection?.length) {
    throw new Error('No node selected in Figma')
  }

  // Duplicate detection: skip if sourceNodeId already loaded
  const sourceId = selection.selection.length === 1
    ? selection.selection[0].id
    : selection.selection.map(n => n.id).sort().join(',')
  const existing = store.designs.find(d => d.sourceNodeId === sourceId)
  if (existing) {
    store.setActiveDesign(existing.id)
    return
  }

  let frames: FrameEntry[]
  let designName: string

  if (selection.selection.length > 1) {
    // MULTI-SELECT: each selected node → 1 FrameEntry
    frames = await Promise.all(
      selection.selection.map(node => fetchFrameEntry(node))
    )
    designName = `Design #${designs.length + 1}`
  } else {
    const node = selection.selection[0]
    const nodeInfo = await figma.sendCommand('get_node_info', { nodeId: node.id })

    const childFrames = nodeInfo.children?.filter(
      c => ['FRAME', 'COMPONENT', 'INSTANCE'].includes(c.type)
           && c.absoluteBoundingBox
    )

    if (childFrames?.length > 0) {
      // Single parent with children → expand
      frames = await Promise.all(
        childFrames.map(child => fetchFrameEntry(child))
      )
      designName = node.name
    } else {
      // Leaf node → single frame
      frames = [await fetchFrameEntry(node)]
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
}

async function fetchFrameEntry(node: { id: string; name: string; type: string }): Promise<FrameEntry> {
  const [nodeInfo, exported] = await Promise.all([
    figma.sendCommand('get_node_info', { nodeId: node.id }),
    figma.sendCommand('export_node_as_image', { nodeId: node.id, format: 'PNG', scale: 2 }),
  ])

  if (!nodeInfo.absoluteBoundingBox) {
    throw new Error(`Node "${node.name}" has no bounding box. Select a frame with dimensions.`)
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
```

## Brainstorm Integration

Update `handleStartBrainstorm` to send frame-level annotations:

```typescript
const figmaData = {
  designs: designs.map(design => ({
    id: design.id,
    name: design.name,
    frames: design.frames.map(frame => ({
      id: frame.id,
      name: frame.name,
      type: frame.type,
      notes: frame.annotation.notes,
      tags: frame.annotation.tags.map(t => t.label),
      markdown: generateFigmaMarkdown(frame.nodeTree, {}),
    })),
  })),
}

brainstorm.mutate({ figma_data: figmaData })
```

### Backend impact

- `figma_data` is a JSON blob — backend forwards it to the AI agent
- No DB schema or API contract changes needed
- The brainstorm service prompt template in `apps/backend/app/services/brainstorm_service.py` must be updated to handle the new `designs[].frames[]` structure instead of the old flat `designs[].notes` / `designs[].markdown` shape. This is a required change to avoid broken brainstorm output.

## UI Design Notes

Follow existing macOS-style design system:

- **DesignTreeSidebar**: Glass effect background (`glass-bg`, `backdrop-filter: blur(20px)`), 11px/600 uppercase section headers, 13px body text, `selection` highlight for active items
- **FrameGrid**: Bento grid (`bento-grid-3`), `bento-cell` with 12px radius, `shadow-md` on hover, frame thumbnails with tag count badges
- **TagPicker**: Pill badges (`border-radius: 9999px`), semantic colors — green=approved, yellow=todo, red=bug, blue=needs-review, purple=enhancement
- **ViewModeToggle**: Ghost button group, accent (`#0A84FF`) highlight for active mode
- All interactive elements: `cursor-pointer`, transitions 150ms ease
- Typography: 13px body, 11px captions/labels, Inter font
- Colors: dark theme tokens (`#1E1E1E` bg, `#252526` surface, `#3C3C3C` border, `#E5E5E5` text)
