# Figma Annotator Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the Figma Import screen as a tab-routable "Figma Annotator" with multi-node support — users connect via channel ID, load multiple Figma nodes, view each node's design/tree, and add notes per node.

**Architecture:** Add `'figma'` tab type so clicking Figma opens a new tab. The screen has a 3-panel layout (layers 20% | canvas 50% | annotations 30%) matching the Stitch design. State manages a list of `DesignEntry` objects — each is a loaded Figma node with its tree, image, and notes. Clicking an entry in the right panel shows its canvas + layers in the center/left panels.

**Tech Stack:** React, Zustand (tab store), existing `useFigmaConnection` hook, Lucide icons, design system CSS variables, SplitPane

**Design reference:** `.stitch/designs/figma-annotator.png` and `.stitch/designs/figma-annotator.html`

---

## Data Model

```typescript
// New interface for multi-node support
interface DesignEntry {
  id: string                    // Figma node ID
  name: string                  // Node name from Figma
  type: string                  // FRAME, COMPONENT, etc.
  nodeTree: FigmaNode           // Full node hierarchy
  flatNodes: FlatNode[]         // Flattened for tree/canvas
  imageDataUrl: string          // PNG export
  rootBBox: { x: number; y: number; width: number; height: number }
  notes: string                 // User notes for this node
  addedAt: number               // timestamp
}
```

---

## Task 1: Add `figma` Tab Type + Store Action

**Files:**
- Modify: `apps/desktop/src/renderer/types/tabs.ts`
- Modify: `apps/desktop/src/renderer/stores/use-tab-store.ts`

**Step 1: Add FigmaTab to types**

In `types/tabs.ts`, add:

```typescript
export type TabType = 'home' | 'ticket' | 'settings' | 'figma'

// Add after SettingsTab:
export interface FigmaTab {
  id: string
  type: 'figma'
  projectId: string
  label: string
}

export type AppTab = HomeTab | TicketTab | SettingsTab | FigmaTab
```

**Step 2: Add openFigmaTab action to store**

In `use-tab-store.ts`, add to the interface:

```typescript
openFigmaTab: (projectId: string) => void
```

Implementation (follows same pattern as `openSettingsTab`):

```typescript
openFigmaTab: (projectId) => {
  const { tabsByProject, activeTabByProject } = get()
  const tabs = tabsByProject[projectId] ?? []
  const tabId = `figma-${projectId}`
  const existing = tabs.find((t) => t.id === tabId)
  if (existing) {
    set({ activeTabByProject: { ...activeTabByProject, [projectId]: tabId } })
    return
  }
  const newTab: AppTab = { id: tabId, type: 'figma', projectId, label: 'Figma Annotator' }
  set({
    tabsByProject: { ...tabsByProject, [projectId]: [...tabs, newTab] },
    activeTabByProject: { ...activeTabByProject, [projectId]: tabId },
  })
},
```

**Step 3: Update tab-content.tsx routing**

In `tab-content.tsx`, add import and case:

```typescript
import { FigmaAnnotatorScreen } from 'renderer/screens/figma-annotator'

// In switch:
case 'figma':
  return <FigmaAnnotatorScreen projectId={activeTab.projectId} />
```

**Step 4: Update tabToBarTab in app-layout.tsx**

```typescript
case 'figma':
  return { id: tab.id, label: tab.label, closable: true }
```

**Step 5: Verify**

Run: `pnpm --filter my-electron-app typecheck`
Expected: May fail on missing FigmaAnnotatorScreen — that's OK, we build it next.

**Step 6: Commit**

```bash
git add apps/desktop/src/renderer/types/tabs.ts apps/desktop/src/renderer/stores/use-tab-store.ts apps/desktop/src/renderer/components/tab-content.tsx apps/desktop/src/renderer/components/app-layout.tsx
git commit -m "feat: add figma tab type and routing"
```

---

## Task 2: Create FigmaAnnotatorScreen (Main Screen Shell)

**Files:**
- Create: `apps/desktop/src/renderer/screens/figma-annotator.tsx`

This is the main screen component. It manages:
- Connection state (channel ID, connect/disconnect)
- List of `DesignEntry` objects
- Active design selection
- Loading new designs from Figma

**Step 1: Create the screen**

```tsx
import { useState, useCallback } from 'react'
import { SplitPane, SplitPanePanel, SplitPaneHandle, Button, Input, Badge, Spinner } from '@agent-coding/ui'
import { ArrowLeft, Plug, Unplug, Download, Loader2, Sparkles, LayoutGrid, CheckCircle } from 'lucide-react'
import { useFigmaConnection } from 'renderer/hooks/use-figma-connection'
import type { FigmaNode } from 'renderer/hooks/use-figma-connection'
import type { FlatNode } from 'renderer/components/figma/figma-node-tree'
import { FigmaNodeTree } from 'renderer/components/figma/figma-node-tree'
import { FigmaCanvas } from 'renderer/components/figma/figma-canvas'
import { AnnotationsPanel } from 'renderer/components/figma/annotations-panel'
import { useBrainstormStart } from 'renderer/hooks/queries/use-brainstorm'
import { generateFigmaMarkdown } from 'renderer/lib/figma-export'
import { useTabStore } from 'renderer/stores/use-tab-store'

interface DesignEntry {
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

interface FigmaAnnotatorScreenProps {
  readonly projectId: string
}

export function FigmaAnnotatorScreen({ projectId }: FigmaAnnotatorScreenProps) {
  const figma = useFigmaConnection()
  const [channelId, setChannelId] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Multi-node state
  const [designEntries, setDesignEntries] = useState<DesignEntry[]>([])
  const [activeDesignId, setActiveDesignId] = useState<string | null>(null)

  // Interaction state for active design's canvas/tree
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)

  const closeTab = useTabStore((s) => s.closeTab)
  const startBrainstorm = useBrainstormStart(projectId)

  const activeDesign = designEntries.find((d) => d.id === activeDesignId) ?? null

  const handleLoadDesign = async () => {
    setIsLoading(true)
    setLoadError(null)
    try {
      const selection = await figma.sendCommand<{ selection: Array<{ id: string; name: string; type: string }> }>(
        'get_selection',
      )
      if (!selection.selection?.length) {
        throw new Error('No node selected in Figma. Please select a frame.')
      }

      const selected = selection.selection[0]

      // Don't add duplicates
      if (designEntries.some((d) => d.id === selected.id)) {
        setActiveDesignId(selected.id)
        return
      }

      const nodeInfo = await figma.sendCommand<FigmaNode>('get_node_info', { nodeId: selected.id })

      const exported = await figma.sendCommand<{ imageData: string }>('export_node_as_image', {
        nodeId: selected.id,
        format: 'PNG',
        scale: 2,
      })

      const imgData = exported.imageData.startsWith('data:')
        ? exported.imageData
        : `data:image/png;base64,${exported.imageData}`

      const flat: FlatNode[] = []
      flattenNodes(nodeInfo, 0, flat)

      const entry: DesignEntry = {
        id: selected.id,
        name: nodeInfo.name,
        type: nodeInfo.type,
        nodeTree: nodeInfo,
        flatNodes: flat,
        imageDataUrl: imgData,
        rootBBox: nodeInfo.absoluteBoundingBox!,
        notes: '',
        addedAt: Date.now(),
      }

      setDesignEntries((prev) => [...prev, entry])
      setActiveDesignId(selected.id)
      setSelectedNodeId(null)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load design'
      setLoadError(message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRemoveDesign = useCallback((designId: string) => {
    setDesignEntries((prev) => prev.filter((d) => d.id !== designId))
    setActiveDesignId((prev) => (prev === designId ? null : prev))
  }, [])

  const handleUpdateNotes = useCallback((designId: string, notes: string) => {
    setDesignEntries((prev) =>
      prev.map((d) => (d.id === designId ? { ...d, notes } : d)),
    )
  }, [])

  const handleSelectNode = (nodeId: string) => {
    setSelectedNodeId(nodeId)
    figma.sendCommand('set_selections', { nodeIds: [nodeId] }).catch(() => {})
  }

  const handleStartBrainstorm = () => {
    if (designEntries.length === 0) return

    // Combine all design entries into brainstorm data
    const allAnnotations: Record<string, { text: string; nodeName: string; nodeType: string }> = {}
    for (const entry of designEntries) {
      if (entry.notes) {
        allAnnotations[entry.id] = { text: entry.notes, nodeName: entry.name, nodeType: entry.type }
      }
    }

    const firstEntry = designEntries[0]
    const markdown = generateFigmaMarkdown(firstEntry.nodeTree, allAnnotations, false)

    startBrainstorm.mutate({
      figma_data: {
        overall_description: designEntries.map((d) => `${d.name}: ${d.notes}`).filter(Boolean).join('\n'),
        design_markdown: markdown,
        annotations: allAnnotations,
        node_tree_name: firstEntry.nodeTree.name,
        node_tree_type: firstEntry.nodeTree.type,
      },
    })
  }

  const isConnected = figma.state.status === 'connected'

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border/50 px-4 bg-background">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="p-1 rounded hover:bg-surface-hover transition-colors cursor-pointer"
            onClick={() => closeTab(projectId, `figma-${projectId}`)}
          >
            <ArrowLeft className="size-4 text-muted-foreground" />
          </button>
          <div className="flex items-center gap-2">
            <LayoutGrid className="size-4 text-accent" />
            <h1 className="text-[13px] font-semibold tracking-tight">Figma Import</h1>
            {isConnected && (
              <div className="flex items-center gap-1.5 ml-2 px-2 py-0.5 bg-[var(--success)]/10 rounded-full border border-[var(--success)]/20">
                <div className="size-1.5 rounded-full bg-[var(--success)]" />
                <span className="text-[10px] uppercase font-bold text-[var(--success)] tracking-wider">Connected</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isConnected ? (
            <div className="flex items-center gap-2 bg-surface px-3 py-1.5 rounded-lg border border-border">
              <span className="text-xs font-mono text-foreground">{channelId}</span>
              <CheckCircle className="size-3.5 text-[var(--success)]" />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Input
                value={channelId}
                onChange={(e) => setChannelId(e.target.value)}
                placeholder="Channel ID"
                className="w-40 text-[12px] font-mono"
              />
              <Button size="sm" onClick={() => figma.connect(channelId)} disabled={!channelId.trim()}>
                <Plug className="mr-1.5 size-3" /> Connect
              </Button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {isConnected && (
            <>
              <Button size="sm" variant="outline" onClick={figma.disconnect}>
                <Unplug className="mr-1.5 size-3" /> Disconnect
              </Button>
              <Button size="sm" onClick={handleLoadDesign} disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-1.5 size-3 animate-spin" /> : <Download className="mr-1.5 size-3" />}
                Load Design
              </Button>
            </>
          )}
          <Button
            onClick={handleStartBrainstorm}
            disabled={designEntries.length === 0 || startBrainstorm.isPending}
            className="bg-accent hover:bg-accent-hover text-white"
          >
            <Sparkles className="mr-1.5 size-3.5" />
            Start Brainstorm
          </Button>
        </div>
      </header>

      {/* Error banner */}
      {(figma.state.error || loadError) && (
        <div className="px-4 py-2 bg-destructive/10 border-b border-destructive/20 text-[12px] text-destructive">
          {figma.state.error || loadError}
        </div>
      )}

      {/* Main 3-panel layout */}
      {activeDesign ? (
        <SplitPane orientation="horizontal" className="flex-1">
          <SplitPanePanel defaultSize={20} minSize={15}>
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-border/50 p-3">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Layers</span>
              </div>
              <FigmaNodeTree
                nodes={activeDesign.flatNodes}
                selectedNodeId={selectedNodeId}
                hoveredNodeId={hoveredNodeId}
                annotations={{}}
                onSelectNode={handleSelectNode}
                onHoverNode={setHoveredNodeId}
              />
            </div>
          </SplitPanePanel>

          <SplitPaneHandle />

          <SplitPanePanel defaultSize={50} minSize={30}>
            <FigmaCanvas
              imageDataUrl={activeDesign.imageDataUrl}
              rootBBox={activeDesign.rootBBox}
              nodes={activeDesign.flatNodes}
              selectedNodeId={selectedNodeId}
              hoveredNodeId={hoveredNodeId}
              annotations={{}}
              onSelectNode={handleSelectNode}
              onHoverNode={setHoveredNodeId}
            />
          </SplitPanePanel>

          <SplitPaneHandle />

          <SplitPanePanel defaultSize={30} minSize={20}>
            <AnnotationsPanel
              entries={designEntries}
              activeDesignId={activeDesignId}
              onSelectDesign={setActiveDesignId}
              onRemoveDesign={handleRemoveDesign}
              onUpdateNotes={handleUpdateNotes}
            />
          </SplitPanePanel>
        </SplitPane>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-muted-foreground">
          {isLoading ? (
            <Spinner label="Loading design..." />
          ) : (
            <div className="bento-cell-lg max-w-md text-center">
              <div className="text-sm font-semibold tracking-tight mb-2">
                {isConnected ? 'Select a frame in Figma and click Load Design' : 'Connect to Figma to get started'}
              </div>
              <p className="text-caption">
                {isConnected
                  ? 'You can load multiple design nodes. Each will appear as an annotation card.'
                  : 'Enter the channel ID from the Figma plugin and click Connect.'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Footer status bar */}
      {isConnected && (
        <footer className="flex h-8 shrink-0 items-center justify-between border-t border-border/50 px-4 glass-effect">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="size-1.5 rounded-full bg-accent animate-pulse" />
              <span className="text-[10px] font-mono text-muted-foreground">CONNECTED</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">
              {designEntries.length} design{designEntries.length !== 1 ? 's' : ''} loaded
            </span>
          </div>
        </footer>
      )}
    </div>
  )
}
```

**Step 2: Verify typecheck**

Run: `pnpm --filter my-electron-app typecheck`
Expected: May fail on missing AnnotationsPanel — we build it next.

**Step 3: Commit**

```bash
git add apps/desktop/src/renderer/screens/figma-annotator.tsx
git commit -m "feat: create FigmaAnnotatorScreen with multi-node support"
```

---

## Task 3: Create AnnotationsPanel Component

**Files:**
- Create: `apps/desktop/src/renderer/components/figma/annotations-panel.tsx`

This replaces the old FigmaAnnotationPanel. It shows a list of loaded design entries as cards (matching the Stitch design's right panel), with notes editing per entry.

**Step 1: Create the component**

```tsx
import { useState } from 'react'
import { ScrollArea, Button, Textarea } from '@agent-coding/ui'
import { Trash2, PlusCircle, Clock } from 'lucide-react'
import { cn } from '@agent-coding/ui'
import type { FigmaNode } from 'renderer/hooks/use-figma-connection'
import type { FlatNode } from 'renderer/components/figma/figma-node-tree'

interface DesignEntry {
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

interface AnnotationsPanelProps {
  readonly entries: DesignEntry[]
  readonly activeDesignId: string | null
  readonly onSelectDesign: (id: string) => void
  readonly onRemoveDesign: (id: string) => void
  readonly onUpdateNotes: (id: string, notes: string) => void
}

const TYPE_BADGE_COLORS: Record<string, string> = {
  FRAME: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  COMPONENT: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  INSTANCE: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
  GROUP: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
}

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

export function AnnotationsPanel({
  entries,
  activeDesignId,
  onSelectDesign,
  onRemoveDesign,
  onUpdateNotes,
}: AnnotationsPanelProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  const handleStartEdit = (entry: DesignEntry) => {
    setEditingId(entry.id)
    setEditText(entry.notes)
  }

  const handleSaveEdit = () => {
    if (editingId) {
      onUpdateNotes(editingId, editText)
      setEditingId(null)
    }
  }

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 p-3">
        <h2 className="text-[13px] font-semibold">Annotations ({entries.length})</h2>
      </div>

      {/* Cards list */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {entries.map((entry, index) => (
            <div
              key={entry.id}
              className={cn(
                'rounded-lg border p-3 space-y-2 cursor-pointer transition-all duration-150',
                activeDesignId === entry.id
                  ? 'border-accent bg-[var(--selection)]'
                  : 'border-border bg-surface hover:bg-surface-hover',
              )}
              onClick={() => onSelectDesign(entry.id)}
            >
              {/* Card header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-white">
                    {index + 1}
                  </span>
                  <span className="text-[13px] font-semibold">{entry.name}</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onRemoveDesign(entry.id)
                  }}
                  className="text-muted-foreground hover:text-destructive cursor-pointer transition-colors"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>

              {/* Type badge */}
              <div>
                <span
                  className={cn(
                    'inline-block rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase',
                    TYPE_BADGE_COLORS[entry.type] ?? 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
                  )}
                >
                  {entry.type}
                </span>
              </div>

              {/* Notes */}
              {editingId === entry.id ? (
                <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                  <Textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    placeholder="Add notes about this design node..."
                    rows={3}
                    className="text-[12px]"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSaveEdit}>Save</Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <p
                  className="text-[12px] text-muted-foreground leading-relaxed cursor-text"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleStartEdit(entry)
                  }}
                >
                  {entry.notes || 'Click to add notes...'}
                </p>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between border-t border-border/30 pt-2 text-[10px] text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="size-3" />
                  <span>Added {timeAgo(entry.addedAt)}</span>
                </div>
                <span className="font-mono">#{entry.id.slice(0, 6)}</span>
              </div>
            </div>
          ))}

          {/* Empty state / Add prompt */}
          <div className="pt-4 text-center space-y-2">
            <div className="inline-flex items-center justify-center size-10 rounded-full bg-border/30">
              <PlusCircle className="size-5 text-muted-foreground/50" />
            </div>
            <p className="text-[12px] text-muted-foreground px-4">
              Select a node in Figma and click Load Design to add more annotations.
            </p>
          </div>
        </div>
      </ScrollArea>

      {/* Panel footer */}
      <div className="border-t border-border/50 p-3">
        <Button
          variant="secondary"
          className="w-full"
          disabled={entries.length === 0}
          onClick={() => {
            // Export functionality — future enhancement
          }}
        >
          Export Documentation
        </Button>
      </div>
    </div>
  )
}
```

**Step 2: Verify typecheck**

Run: `pnpm --filter my-electron-app typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/desktop/src/renderer/components/figma/annotations-panel.tsx
git commit -m "feat: create AnnotationsPanel component for multi-node design entries"
```

---

## Task 4: Add Trigger to Open Figma Tab

**Files:**
- Modify: `apps/desktop/src/renderer/screens/project.tsx` (or wherever the project toolbar/actions are)

Need a button/menu item that calls `openFigmaTab(projectId)`. Check where project-level actions live (likely project screen toolbar or sidebar).

**Step 1: Find the right trigger location**

Look at `project.tsx` or the sidebar for a place to add "Import from Figma" action. Add a button that calls:

```typescript
const { openFigmaTab } = useTabStore()
// ...
<Button variant="ghost" onClick={() => openFigmaTab(projectId)}>
  <Figma className="size-4 mr-1.5" /> Import from Figma
</Button>
```

> Note: `Figma` icon doesn't exist in Lucide. Use `LayoutGrid` or `Frame` instead, or a custom SVG.

**Step 2: Verify the tab opens correctly**

Manual test: Click the button → new tab appears in TabBar → shows FigmaAnnotatorScreen.

**Step 3: Commit**

```bash
git add <modified-files>
git commit -m "feat: add trigger to open Figma Annotator tab from project"
```

---

## Task 5: Extract Shared DesignEntry Type

**Files:**
- Create: `apps/desktop/src/renderer/types/figma.ts`
- Modify: `apps/desktop/src/renderer/screens/figma-annotator.tsx`
- Modify: `apps/desktop/src/renderer/components/figma/annotations-panel.tsx`

**Step 1: Extract the shared type**

```typescript
// types/figma.ts
import type { FigmaNode } from 'renderer/hooks/use-figma-connection'
import type { FlatNode } from 'renderer/components/figma/figma-node-tree'

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

**Step 2: Update imports in both files**

Replace inline `DesignEntry` definition with `import type { DesignEntry } from 'renderer/types/figma'`.

**Step 3: Verify + commit**

Run: `pnpm --filter my-electron-app typecheck`

```bash
git add apps/desktop/src/renderer/types/figma.ts apps/desktop/src/renderer/screens/figma-annotator.tsx apps/desktop/src/renderer/components/figma/annotations-panel.tsx
git commit -m "refactor: extract DesignEntry type to shared types/figma.ts"
```

---

## Task 6: Final Cleanup — Remove Old FigmaImportScreen

**Files:**
- Delete: `apps/desktop/src/renderer/screens/figma-import.tsx` (old screen)
- Modify: Any remaining imports of the old screen

**Step 1: Search for old imports**

```bash
grep -r "figma-import" apps/desktop/src/
```

Remove any references. The old `FigmaViewer` component (`figma-viewer.tsx`) can stay since its sub-components (FigmaCanvas, FigmaNodeTree) are still used. The viewer itself is now unused — can be removed.

**Step 2: Clean up**

- Delete `figma-import.tsx`
- Delete `figma-viewer.tsx` (logic moved into figma-annotator.tsx)
- Keep: `figma-canvas.tsx`, `figma-node-tree.tsx`, `figma-annotation-panel.tsx` (still used or deprecated gracefully)

Actually, `figma-annotation-panel.tsx` is replaced by `annotations-panel.tsx`. Check if anything else uses it — if not, delete it.

**Step 3: Verify + commit**

Run: `pnpm --filter my-electron-app typecheck`

```bash
git add -A
git commit -m "refactor: remove old FigmaImportScreen and FigmaViewer, replaced by FigmaAnnotatorScreen"
```

---

## Summary

| Task | Description | Key Files |
|------|-------------|-----------|
| 1 | Add `figma` tab type + routing | `types/tabs.ts`, `use-tab-store.ts`, `tab-content.tsx`, `app-layout.tsx` |
| 2 | Create FigmaAnnotatorScreen | `screens/figma-annotator.tsx` |
| 3 | Create AnnotationsPanel | `components/figma/annotations-panel.tsx` |
| 4 | Add trigger button | `screens/project.tsx` or sidebar |
| 5 | Extract shared type | `types/figma.ts` |
| 6 | Clean up old files | Delete `figma-import.tsx`, `figma-viewer.tsx` |
