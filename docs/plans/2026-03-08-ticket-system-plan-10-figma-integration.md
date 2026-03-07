# Ticket System — Plan 10: Figma Integration

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Embed Figma viewer into the desktop app for selecting and annotating design nodes, then feeding into AI brainstorming.

**Architecture:** Refactor figma-viewer.html (standalone prototype) into React components. Connect via WebSocket to Figma plugin. Annotated nodes exported as structured data for brainstorm agent context.

**Tech Stack:** React 19, WebSocket (Figma plugin), @agent-coding/ui, Tailwind CSS v4

**Depends on:** [Plan 08](./2026-03-08-ticket-system-plan-08-brainstorm-ui.md)
**Reference:** [Figma Design Annotator Design](./2026-03-07-figma-design-annotator-design.md)

---

## Task 1: Create FigmaConnection hook

**Description:** A React hook that manages a direct WebSocket connection to the Figma plugin server (port 3055). Unlike `useWsChannel` (which connects to our backend WebSocket), this connects to the cursor-talk-to-figma-mcp WebSocket server. The hook manages connection state, channel joining, and request/response routing via a `pendingRequests` Map with UUID-based matching. This mirrors the `sendCommand` pattern from `figma-viewer.html`.

**Files to create:**
- `apps/desktop/src/renderer/hooks/use-figma-connection.ts`

**Props/Types:**

```tsx
interface FigmaConnectionState {
  status: 'disconnected' | 'connecting' | 'connected'
  error: string | null
}

interface FigmaNode {
  id: string
  name: string
  type: string
  absoluteBoundingBox: { x: number; y: number; width: number; height: number } | null
  fills?: Array<{ type: string; color?: string }>
  style?: {
    fontFamily?: string
    fontSize?: number
    fontWeight?: number
    fontStyle?: string
    letterSpacing?: number
    lineHeightPx?: number
    textAlignHorizontal?: string
  }
  characters?: string
  cornerRadius?: number
  children?: FigmaNode[]
}

interface UseFigmaConnectionReturn {
  state: FigmaConnectionState
  connect: (channelId: string) => void
  disconnect: () => void
  sendCommand: <T = unknown>(command: string, params?: Record<string, unknown>) => Promise<T>
}
```

**Key code:**

```tsx
import { useState, useRef, useCallback } from 'react'

const FIGMA_WS_URL = 'ws://localhost:3055'
const COMMAND_TIMEOUT_MS = 15000

export function useFigmaConnection(): UseFigmaConnectionReturn {
  const [state, setState] = useState<FigmaConnectionState>({ status: 'disconnected', error: null })
  const wsRef = useRef<WebSocket | null>(null)
  const channelRef = useRef<string>('')
  const pendingRequests = useRef<Map<string, {
    resolve: (value: unknown) => void
    reject: (reason: Error) => void
    timeout: ReturnType<typeof setTimeout>
  }>>(new Map())

  const connect = useCallback((channelId: string) => {
    if (wsRef.current) wsRef.current.close()

    setState({ status: 'connecting', error: null })
    channelRef.current = channelId

    const ws = new WebSocket(FIGMA_WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'join', channel: channelId }))
      setState({ status: 'connected', error: null })
    }

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data)
      if (msg.message?.id && pendingRequests.current.has(msg.message.id)) {
        const req = pendingRequests.current.get(msg.message.id)!
        pendingRequests.current.delete(msg.message.id)
        clearTimeout(req.timeout)
        req.resolve(msg.message.result)
      }
    }

    ws.onerror = () => {
      setState({ status: 'disconnected', error: 'Connection failed. Is the Figma plugin server running on port 3055?' })
    }

    ws.onclose = () => {
      setState((prev) => ({ ...prev, status: 'disconnected' }))
      wsRef.current = null
    }
  }, [])

  const disconnect = useCallback(() => {
    wsRef.current?.close()
    wsRef.current = null
    // Reject all pending requests
    for (const [id, req] of pendingRequests.current) {
      clearTimeout(req.timeout)
      req.reject(new Error('Disconnected'))
    }
    pendingRequests.current.clear()
    setState({ status: 'disconnected', error: null })
  }, [])

  const sendCommand = useCallback(<T = unknown,>(command: string, params: Record<string, unknown> = {}): Promise<T> => {
    return new Promise((resolve, reject) => {
      const ws = wsRef.current
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        reject(new Error('Not connected'))
        return
      }

      const id = crypto.randomUUID()
      const timeout = setTimeout(() => {
        pendingRequests.current.delete(id)
        reject(new Error(`Timeout: ${command}`))
      }, COMMAND_TIMEOUT_MS)

      pendingRequests.current.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeout,
      })

      ws.send(JSON.stringify({
        id,
        type: 'message',
        channel: channelRef.current,
        message: { id, command, params: { ...params, commandId: id } },
      }))
    })
  }, [])

  return { state, connect, disconnect, sendCommand }
}
```

**Commit message:** `feat(desktop): create useFigmaConnection hook with WebSocket and request/response routing`

---

## Task 2: Create FigmaNodeTree component

**Description:** Renders the Figma node hierarchy as an indented tree. Each node shows its type as a color-coded badge (FRAME = purple, TEXT = cyan, GROUP = amber, RECTANGLE = green, INSTANCE = pink, COMPONENT = violet). Nodes with annotations show a yellow dot badge. Clicking a node selects it (fires `onSelectNode`). Hovering highlights the corresponding overlay on the canvas.

**Files to create:**
- `apps/desktop/src/renderer/components/figma/figma-node-tree.tsx`

**Props/Types:**

```tsx
interface FlatNode {
  id: string
  name: string
  type: string
  depth: number
  absoluteBoundingBox: { x: number; y: number; width: number; height: number } | null
  characters?: string
  fills?: Array<{ type: string }>
}

interface FigmaNodeTreeProps {
  nodes: FlatNode[]
  selectedNodeId: string | null
  hoveredNodeId: string | null
  annotations: Record<string, { text: string; nodeName: string; nodeType: string }>
  onSelectNode: (nodeId: string) => void
  onHoverNode: (nodeId: string | null) => void
}
```

**Key code:**

```tsx
import { ScrollArea } from '@agent-coding/ui'
import { cn } from '@agent-coding/ui'

const TYPE_COLORS: Record<string, string> = {
  FRAME: 'bg-purple-500/20 text-purple-400',
  TEXT: 'bg-cyan-500/20 text-cyan-400',
  GROUP: 'bg-amber-500/20 text-amber-400',
  RECTANGLE: 'bg-green-500/20 text-green-400',
  INSTANCE: 'bg-pink-500/20 text-pink-400',
  COMPONENT: 'bg-violet-500/20 text-violet-400',
}

export function FigmaNodeTree({
  nodes,
  selectedNodeId,
  hoveredNodeId,
  annotations,
  onSelectNode,
  onHoverNode,
}: FigmaNodeTreeProps) {
  return (
    <ScrollArea className="h-full">
      <div className="p-1">
        {nodes.map((node) => (
          <button
            key={node.id}
            type="button"
            onClick={() => onSelectNode(node.id)}
            onMouseEnter={() => onHoverNode(node.id)}
            onMouseLeave={() => onHoverNode(null)}
            className={cn(
              'flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-[12px] transition-colors',
              selectedNodeId === node.id && 'bg-[var(--selection)] border-l-2 border-primary',
              hoveredNodeId === node.id && selectedNodeId !== node.id && 'bg-secondary/50',
            )}
            style={{ paddingLeft: `${node.depth * 12 + 8}px` }}
          >
            <span
              className={cn(
                'shrink-0 rounded px-1 py-0.5 text-[9px] font-semibold uppercase',
                TYPE_COLORS[node.type] ?? 'bg-zinc-500/20 text-zinc-400',
              )}
            >
              {node.type.substring(0, 4)}
            </span>
            <span className="flex-1 truncate" title={node.name}>
              {node.name}
            </span>
            {annotations[node.id] && (
              <span className="size-2 rounded-full bg-yellow-400 shrink-0" />
            )}
          </button>
        ))}
      </div>
    </ScrollArea>
  )
}
```

**Commit message:** `feat(desktop): create FigmaNodeTree component with type color-coding and annotation badges`

---

## Task 3: Create FigmaCanvas component

**Description:** Renders the exported Figma design image with overlay rectangles for each child node. Overlays are positioned using the node's `absoluteBoundingBox` relative to the root node, scaled by the image display size. Clicking an overlay selects the node. Hovering highlights the overlay and syncs with the tree. Selected overlays have a primary-colored border. Annotated overlays show a yellow badge.

**Files to create:**
- `apps/desktop/src/renderer/components/figma/figma-canvas.tsx`

**Props/Types:**

```tsx
interface FigmaCanvasProps {
  imageDataUrl: string
  rootBBox: { x: number; y: number; width: number; height: number }
  nodes: FlatNode[]
  selectedNodeId: string | null
  hoveredNodeId: string | null
  annotations: Record<string, { text: string; nodeName: string; nodeType: string }>
  onSelectNode: (nodeId: string) => void
  onHoverNode: (nodeId: string | null) => void
}
```

**Key code:**

```tsx
import { useRef, useState, useEffect, useCallback } from 'react'
import { cn } from '@agent-coding/ui'

export function FigmaCanvas({
  imageDataUrl,
  rootBBox,
  nodes,
  selectedNodeId,
  hoveredNodeId,
  annotations,
  onSelectNode,
  onHoverNode,
}: FigmaCanvasProps) {
  const imgRef = useRef<HTMLImageElement>(null)
  const [imageScale, setImageScale] = useState(1)

  const updateScale = useCallback(() => {
    if (imgRef.current && rootBBox) {
      setImageScale(imgRef.current.clientWidth / rootBBox.width)
    }
  }, [rootBBox])

  useEffect(() => {
    const observer = new ResizeObserver(updateScale)
    if (imgRef.current) observer.observe(imgRef.current)
    return () => observer.disconnect()
  }, [updateScale])

  // Skip root node (index 0) for overlays
  const overlayNodes = nodes.slice(1)

  return (
    <div className="flex-1 overflow-auto bg-zinc-950 flex items-start justify-center p-6">
      <div className="relative inline-block">
        <img
          ref={imgRef}
          src={imageDataUrl}
          alt="Figma design"
          className="block max-w-full h-auto rounded"
          onLoad={updateScale}
        />

        {/* Overlay rectangles */}
        {overlayNodes.map((node) => {
          if (!node.absoluteBoundingBox) return null
          const bbox = node.absoluteBoundingBox
          const isSelected = node.id === selectedNodeId
          const isHovered = node.id === hoveredNodeId
          const hasAnnotation = !!annotations[node.id]

          return (
            <div
              key={node.id}
              className={cn(
                'absolute border-2 cursor-pointer transition-all duration-100',
                isSelected
                  ? 'border-primary bg-primary/10'
                  : isHovered
                    ? 'border-primary/50 bg-primary/5'
                    : 'border-transparent',
              )}
              style={{
                left: `${(bbox.x - rootBBox.x) * imageScale}px`,
                top: `${(bbox.y - rootBBox.y) * imageScale}px`,
                width: `${bbox.width * imageScale}px`,
                height: `${bbox.height * imageScale}px`,
              }}
              onClick={(e) => { e.stopPropagation(); onSelectNode(node.id) }}
              onMouseEnter={() => onHoverNode(node.id)}
              onMouseLeave={() => onHoverNode(null)}
            >
              {/* Label tooltip */}
              {(isSelected || isHovered) && (
                <div className="absolute -top-5 left-0 rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground whitespace-nowrap pointer-events-none">
                  {node.name}
                </div>
              )}

              {/* Annotation badge */}
              {hasAnnotation && (
                <div className="absolute -top-2 -right-2 size-4 rounded-full bg-yellow-400 flex items-center justify-center text-[9px] font-bold text-black pointer-events-none">
                  !
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

**Commit message:** `feat(desktop): create FigmaCanvas component with node overlay rectangles, selection, and hover sync`

---

## Task 4: Create FigmaAnnotationPanel component

**Description:** The right sidebar panel for annotating a selected Figma node. Shows selected node details (name, type, dimensions, text content if TEXT node), a textarea for writing the annotation, and a "Save Note" button. If the node already has an annotation, the textarea is pre-filled. Shows a list of all annotations below.

**Files to create:**
- `apps/desktop/src/renderer/components/figma/figma-annotation-panel.tsx`

**Props/Types:**

```tsx
interface FigmaAnnotationPanelProps {
  selectedNode: FlatNode | null
  annotations: Record<string, { text: string; nodeName: string; nodeType: string }>
  onSaveAnnotation: (nodeId: string, text: string) => void
  onDeleteAnnotation: (nodeId: string) => void
  onSelectNode: (nodeId: string) => void
}
```

**Key code:**

```tsx
import { useState, useEffect } from 'react'
import { ScrollArea, Button, Textarea, Separator, KVRow } from '@agent-coding/ui'
import { Save, Trash2, StickyNote } from 'lucide-react'

export function FigmaAnnotationPanel({
  selectedNode,
  annotations,
  onSaveAnnotation,
  onDeleteAnnotation,
  onSelectNode,
}: FigmaAnnotationPanelProps) {
  const [noteText, setNoteText] = useState('')

  // Sync note text when selected node changes
  useEffect(() => {
    if (selectedNode) {
      setNoteText(annotations[selectedNode.id]?.text ?? '')
    }
  }, [selectedNode?.id, annotations])

  const handleSave = () => {
    if (!selectedNode) return
    onSaveAnnotation(selectedNode.id, noteText.trim())
  }

  const annotationEntries = Object.entries(annotations)

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        {/* Selected node details */}
        {selectedNode ? (
          <>
            <div>
              <h3 className="text-[13px] font-semibold mb-2">{selectedNode.name}</h3>
              <div className="space-y-1">
                <KVRow label="Type" value={selectedNode.type} />
                {selectedNode.absoluteBoundingBox && (
                  <KVRow
                    label="Size"
                    value={`${Math.round(selectedNode.absoluteBoundingBox.width)} x ${Math.round(selectedNode.absoluteBoundingBox.height)}`}
                  />
                )}
                {selectedNode.characters && (
                  <KVRow label="Text" value={
                    <span className="text-muted-foreground italic truncate max-w-40 inline-block">
                      "{selectedNode.characters}"
                    </span>
                  } />
                )}
              </div>
            </div>

            <Separator />

            {/* Annotation textarea */}
            <div>
              <label className="text-[11px] text-muted-foreground uppercase block mb-1.5">Annotation</label>
              <Textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Describe this element's behavior, layout intent, interactions..."
                rows={5}
                className="text-[13px]"
              />
              <Button size="sm" onClick={handleSave} className="mt-2" disabled={!noteText.trim()}>
                <Save className="mr-1.5 size-3" /> Save Note
              </Button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-[13px]">
            <StickyNote className="size-8 mb-2 opacity-30" />
            Select a node to annotate
          </div>
        )}

        <Separator />

        {/* All annotations list */}
        <div>
          <h3 className="text-[11px] text-muted-foreground uppercase mb-2">
            All Annotations ({annotationEntries.length})
          </h3>
          {annotationEntries.length === 0 ? (
            <p className="text-[12px] text-muted-foreground">No annotations yet.</p>
          ) : (
            <div className="space-y-2">
              {annotationEntries.map(([nodeId, anno]) => (
                <div
                  key={nodeId}
                  className="rounded-lg border border-border bg-card p-3 cursor-pointer hover:bg-secondary/30"
                  onClick={() => onSelectNode(nodeId)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] font-medium text-primary">{anno.nodeName}</span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onDeleteAnnotation(nodeId) }}
                      className="text-muted-foreground hover:text-red-400"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                  <p className="text-[12px] text-muted-foreground line-clamp-2">{anno.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ScrollArea>
  )
}
```

**Commit message:** `feat(desktop): create FigmaAnnotationPanel with node details, annotation editing, and annotations list`

---

## Task 5: Create FigmaViewer composite component

**Description:** The main Figma viewer layout combining all three panels: FigmaNodeTree (left), FigmaCanvas (center), FigmaAnnotationPanel (right). Uses two nested `SplitPane` components. A connection bar at the top manages the WebSocket connection to the Figma plugin. Shows connection status, channel ID input, Connect/Disconnect buttons, and a "Load Design" button that calls `get_selection` + `get_node_info` + `export_node_as_image` via the Figma connection hook.

**Files to create:**
- `apps/desktop/src/renderer/components/figma/figma-viewer.tsx`

**Key code:**

```tsx
import { useState, useCallback } from 'react'
import { SplitPane, SplitPanePanel, SplitPaneHandle, Button, Input, Badge, Spinner } from '@agent-coding/ui'
import { Plug, Unplug, Download, Loader2 } from 'lucide-react'
import { useFigmaConnection } from 'renderer/hooks/use-figma-connection'
import { FigmaNodeTree } from 'renderer/components/figma/figma-node-tree'
import { FigmaCanvas } from 'renderer/components/figma/figma-canvas'
import { FigmaAnnotationPanel } from 'renderer/components/figma/figma-annotation-panel'
import type { FigmaNode } from 'renderer/hooks/use-figma-connection'

interface FlatNode {
  id: string
  name: string
  type: string
  depth: number
  absoluteBoundingBox: { x: number; y: number; width: number; height: number } | null
  characters?: string
  fills?: Array<{ type: string }>
}

interface Annotation {
  text: string
  nodeName: string
  nodeType: string
}

interface FigmaViewerProps {
  onAnnotationsReady?: (annotations: Record<string, Annotation>, nodeTree: FigmaNode, imageDataUrl: string) => void
}

export function FigmaViewer({ onAnnotationsReady }: FigmaViewerProps) {
  const figma = useFigmaConnection()
  const [channelId, setChannelId] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Design state
  const [nodeTree, setNodeTree] = useState<FigmaNode | null>(null)
  const [flatNodes, setFlatNodes] = useState<FlatNode[]>([])
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null)
  const [rootBBox, setRootBBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null)

  // Interaction state
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
  const [annotations, setAnnotations] = useState<Record<string, Annotation>>({})

  const flattenNodes = useCallback((node: FigmaNode, depth: number, result: FlatNode[]) => {
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
  }, [])

  const handleLoadDesign = async () => {
    setIsLoading(true)
    try {
      // 1. Get current selection
      const selection = await figma.sendCommand<{ selection: Array<{ id: string; name: string; type: string }> }>('get_selection')
      if (!selection.selection?.length) {
        throw new Error('No node selected in Figma. Please select a frame.')
      }

      const selectedNode = selection.selection[0]

      // 2. Get full node info
      const nodeInfo = await figma.sendCommand<FigmaNode>('get_node_info', { nodeId: selectedNode.id })
      setNodeTree(nodeInfo)
      setRootBBox(nodeInfo.absoluteBoundingBox!)

      // 3. Export as image
      const exported = await figma.sendCommand<{ imageData: string }>('export_node_as_image', {
        nodeId: selectedNode.id,
        format: 'PNG',
        scale: 2,
      })

      const imgData = exported.imageData.startsWith('data:')
        ? exported.imageData
        : `data:image/png;base64,${exported.imageData}`
      setImageDataUrl(imgData)

      // 4. Flatten nodes
      const flat: FlatNode[] = []
      flattenNodes(nodeInfo, 0, flat)
      setFlatNodes(flat)
    } catch (e) {
      console.error('Failed to load design:', e)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectNode = (nodeId: string) => {
    setSelectedNodeId(nodeId)
    // Sync selection to Figma
    figma.sendCommand('set_selections', { nodeIds: [nodeId] }).catch(() => {})
  }

  const handleSaveAnnotation = (nodeId: string, text: string) => {
    const node = flatNodes.find((n) => n.id === nodeId)
    if (!node) return
    if (text) {
      setAnnotations((prev) => ({
        ...prev,
        [nodeId]: { text, nodeName: node.name, nodeType: node.type },
      }))
    } else {
      setAnnotations((prev) => {
        const next = { ...prev }
        delete next[nodeId]
        return next
      })
    }
  }

  const handleDeleteAnnotation = (nodeId: string) => {
    setAnnotations((prev) => {
      const next = { ...prev }
      delete next[nodeId]
      return next
    })
  }

  const selectedNode = flatNodes.find((n) => n.id === selectedNodeId) ?? null

  return (
    <div className="flex h-full flex-col">
      {/* Connection bar */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-2">
        <Badge
          variant="outline"
          className={
            figma.state.status === 'connected'
              ? 'border-green-500/50 text-green-400'
              : figma.state.status === 'connecting'
                ? 'border-yellow-500/50 text-yellow-400'
                : 'border-zinc-500/50 text-zinc-400'
          }
        >
          {figma.state.status}
        </Badge>

        <Input
          value={channelId}
          onChange={(e) => setChannelId(e.target.value)}
          placeholder="Channel ID"
          className="w-40 text-[12px] font-mono"
          disabled={figma.state.status === 'connected'}
        />

        {figma.state.status === 'connected' ? (
          <>
            <Button size="sm" variant="outline" onClick={figma.disconnect}>
              <Unplug className="mr-1.5 size-3" /> Disconnect
            </Button>
            <Button size="sm" onClick={handleLoadDesign} disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-1.5 size-3 animate-spin" /> : <Download className="mr-1.5 size-3" />}
              Load Design
            </Button>
          </>
        ) : (
          <Button size="sm" onClick={() => figma.connect(channelId)} disabled={!channelId.trim()}>
            <Plug className="mr-1.5 size-3" /> Connect
          </Button>
        )}

        {figma.state.error && (
          <span className="text-[11px] text-red-400">{figma.state.error}</span>
        )}

        <span className="flex-1" />
        <span className="text-[11px] text-muted-foreground">
          {Object.keys(annotations).length}/{flatNodes.length} annotated
        </span>
      </div>

      {/* 3-panel layout */}
      {imageDataUrl && rootBBox ? (
        <SplitPane orientation="horizontal" className="flex-1">
          {/* Node tree */}
          <SplitPanePanel defaultSize={20} minSize={15}>
            <FigmaNodeTree
              nodes={flatNodes}
              selectedNodeId={selectedNodeId}
              hoveredNodeId={hoveredNodeId}
              annotations={annotations}
              onSelectNode={handleSelectNode}
              onHoverNode={setHoveredNodeId}
            />
          </SplitPanePanel>

          <SplitPaneHandle />

          {/* Canvas */}
          <SplitPanePanel defaultSize={55} minSize={30}>
            <FigmaCanvas
              imageDataUrl={imageDataUrl}
              rootBBox={rootBBox}
              nodes={flatNodes}
              selectedNodeId={selectedNodeId}
              hoveredNodeId={hoveredNodeId}
              annotations={annotations}
              onSelectNode={handleSelectNode}
              onHoverNode={setHoveredNodeId}
            />
          </SplitPanePanel>

          <SplitPaneHandle />

          {/* Annotation panel */}
          <SplitPanePanel defaultSize={25} minSize={15}>
            <FigmaAnnotationPanel
              selectedNode={selectedNode}
              annotations={annotations}
              onSaveAnnotation={handleSaveAnnotation}
              onDeleteAnnotation={handleDeleteAnnotation}
              onSelectNode={handleSelectNode}
            />
          </SplitPanePanel>
        </SplitPane>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
          {isLoading ? (
            <Spinner label="Loading design..." />
          ) : (
            <>
              <div className="text-[14px]">Connect to Figma and load a design</div>
              <p className="text-caption max-w-sm text-center">
                Enter the channel ID from the Figma plugin, click Connect, select a frame in Figma, then click Load Design.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
```

**Commit message:** `feat(desktop): create FigmaViewer composite component with 3-panel layout and connection bar`

---

## Task 6: Create FigmaImportScreen

**Description:** Wraps `FigmaViewer` with an "Overall Description" textarea at the bottom and a "Send to AI Agent" button. This is the entry point from the "Start from Figma" option in the ticket creation modal. On submit, it collects all annotations and the overall description, formats them as `figma_data`, and passes them to the brainstorm start API.

**Files to create:**
- `apps/desktop/src/renderer/screens/figma-import.tsx`

**Props/Types:**

```tsx
interface FigmaImportScreenProps {
  projectId: string
}
```

**Key code:**

```tsx
import { useState, useRef, useCallback } from 'react'
import { Button, Textarea, Separator } from '@agent-coding/ui'
import { Send, Sparkles } from 'lucide-react'
import { FigmaViewer } from 'renderer/components/figma/figma-viewer'
import { useBrainstormStart } from 'renderer/hooks/queries/use-brainstorm'
import { useTabStore } from 'renderer/stores/use-tab-store'
import { generateFigmaMarkdown } from 'renderer/lib/figma-export'
import type { FigmaNode } from 'renderer/hooks/use-figma-connection'

interface Annotation {
  text: string
  nodeName: string
  nodeType: string
}

export function FigmaImportScreen({ projectId }: FigmaImportScreenProps) {
  const [overallDescription, setOverallDescription] = useState('')
  const [figmaData, setFigmaData] = useState<{
    annotations: Record<string, Annotation>
    nodeTree: FigmaNode
    imageDataUrl: string
  } | null>(null)

  const startBrainstorm = useBrainstormStart(projectId)

  const handleAnnotationsReady = useCallback(
    (annotations: Record<string, Annotation>, nodeTree: FigmaNode, imageDataUrl: string) => {
      setFigmaData({ annotations, nodeTree, imageDataUrl })
    },
    [],
  )

  const handleSendToAI = () => {
    if (!figmaData) return

    const markdown = generateFigmaMarkdown(
      figmaData.nodeTree,
      figmaData.annotations,
      false, // includeStyles
    )

    startBrainstorm.mutate(
      {
        figma_data: {
          overall_description: overallDescription,
          design_markdown: markdown,
          annotations: figmaData.annotations,
          node_tree_name: figmaData.nodeTree.name,
          node_tree_type: figmaData.nodeTree.type,
        },
      },
      {
        onSuccess: (data) => {
          // Open brainstorm tab with the new session
          useTabStore.getState().openBrainstormTab(projectId, `Brainstorm: ${figmaData.nodeTree.name}`)
        },
      },
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Figma viewer takes most of the space */}
      <div className="flex-1 overflow-hidden">
        <FigmaViewer onAnnotationsReady={handleAnnotationsReady} />
      </div>

      {/* Bottom bar: overall description + send button */}
      <div className="border-t border-border p-4">
        <div className="mx-auto max-w-3xl">
          <label className="text-[11px] text-muted-foreground uppercase block mb-1.5">
            Overall Description
          </label>
          <Textarea
            value={overallDescription}
            onChange={(e) => setOverallDescription(e.target.value)}
            placeholder="Describe the overall feature, user flow, or context for this design..."
            rows={3}
            className="text-[13px]"
          />
          <div className="mt-3 flex items-center justify-between">
            <span className="text-caption text-muted-foreground">
              {figmaData
                ? `${Object.keys(figmaData.annotations).length} annotations ready`
                : 'Load a Figma design first'}
            </span>
            <Button
              onClick={handleSendToAI}
              disabled={!figmaData || startBrainstorm.isPending}
            >
              <Sparkles className="mr-1.5 size-3.5" />
              Send to AI Agent
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

**Commit message:** `feat(desktop): create FigmaImportScreen with overall description and send-to-AI flow`

---

## Task 7: Wire into ticket creation flow

**Description:** Connect the "Start from Figma" option in the Create Ticket modal to open the `FigmaImportScreen` as a tab. On submit from the Figma import screen, the brainstorm session starts with `figma_data` context, and the user is taken to the brainstorm chat screen where the AI has design context. Update tab routing to handle `'figma-import'` tab type.

**Files to modify:**
- `apps/desktop/src/renderer/components/tab-content.tsx` — add case for `'figma-import'` tab type
- `apps/desktop/src/renderer/types/tabs.ts` — add `FigmaImportTab` to union type
- `apps/desktop/src/renderer/components/create-ticket-modal.tsx` — already wired from Task 2

**Key code for tab-content.tsx:**

```tsx
import { FigmaImportScreen } from 'renderer/screens/figma-import'

// In the switch:
case 'figma-import':
  return <FigmaImportScreen projectId={tab.projectId} />
```

**Key code for tabs.ts:**

```tsx
interface FigmaImportTab {
  id: string
  type: 'figma-import'
  projectId: string
  label: string
  pinned: false
}
```

**Commit message:** `feat(desktop): wire Figma import into ticket creation flow and tab routing`

---

## Task 8: Export annotations as structured data

**Description:** Create a utility function that converts Figma annotations into structured Markdown matching the design doc output format. The function walks the node tree, includes text content for TEXT nodes, image placeholders for IMAGE fills, user annotations as blockquotes, and respects heading depth based on node depth. This is called by `FigmaImportScreen` before sending to the brainstorm API.

**Files to create:**
- `apps/desktop/src/renderer/lib/figma-export.ts`

**Key code:**

```tsx
import type { FigmaNode } from 'renderer/hooks/use-figma-connection'

interface Annotation {
  text: string
  nodeName: string
  nodeType: string
}

/**
 * Generate structured Markdown from a Figma node tree with annotations.
 * Matches the output format from the Figma Design Annotator design doc.
 */
export function generateFigmaMarkdown(
  nodeTree: FigmaNode,
  annotations: Record<string, Annotation>,
  includeStyles = false,
): string {
  const lines: string[] = []
  const bbox = nodeTree.absoluteBoundingBox

  lines.push(`# Screen: ${nodeTree.name}`)
  lines.push(`> Type: ${nodeTree.type} | Size: ${bbox ? `${Math.round(bbox.width)}x${Math.round(bbox.height)}` : 'unknown'}`)
  lines.push('')
  lines.push('## Structure')
  lines.push('')

  function hasImageFill(node: FigmaNode): boolean {
    return node.fills?.some((f) => f.type === 'IMAGE') ?? false
  }

  function formatStyle(node: FigmaNode): string {
    if (!includeStyles) return ''
    const parts: string[] = []
    if (node.style) {
      const s = node.style
      if (s.fontFamily) {
        parts.push(`${s.fontFamily} ${s.fontStyle ?? ''} ${s.fontSize ? `${Math.round(s.fontSize)}px` : ''}`.trim())
      }
      if (s.fontWeight) parts.push(`weight: ${s.fontWeight}`)
      if (s.letterSpacing) parts.push(`spacing: ${s.letterSpacing}`)
      if (s.lineHeightPx) parts.push(`line-height: ${Math.round(s.lineHeightPx)}px`)
      if (s.textAlignHorizontal) parts.push(`align: ${s.textAlignHorizontal}`)
    }
    if (node.fills?.length) {
      const solid = node.fills.find((f) => f.type === 'SOLID' && f.color)
      if (solid) parts.push(`color: ${solid.color}`)
    }
    if (node.cornerRadius) parts.push(`radius: ${Math.round(node.cornerRadius)}px`)
    const nb = node.absoluteBoundingBox
    if (nb) parts.push(`${Math.round(nb.width)}x${Math.round(nb.height)}`)
    return parts.length ? `\n  _Style: ${parts.join(' | ')}_` : ''
  }

  function walkNode(node: FigmaNode, depth: number): void {
    const nb = node.absoluteBoundingBox
    const size = nb ? `${Math.round(nb.width)}x${Math.round(nb.height)}` : ''
    const anno = annotations[node.id]

    if (depth === 1) {
      lines.push(`### ${node.name} (${node.type})`)
      if (node.characters) lines.push(`> Text: "${node.characters}"`)
      if (hasImageFill(node)) lines.push(`> [Image: ${node.name}, ${size}]`)
      lines.push(formatStyle(node))
      if (anno) lines.push(`\n**Note:** ${anno.text}`)
      lines.push('')
    } else if (depth >= 2) {
      const indent = '  '.repeat(depth - 2)
      let line = `${indent}- **${node.name}** (${node.type})`
      if (node.characters) line += `: "${node.characters}"`
      lines.push(line)
      if (hasImageFill(node)) lines.push(`${indent}  > [Image: ${node.name}, ${size}]`)
      if (includeStyles) {
        const style = formatStyle(node)
        if (style) lines.push(`${indent}  ${style.trim()}`)
      }
      if (anno) lines.push(`${indent}  > **Note:** ${anno.text}`)
    }

    if (node.children) {
      for (const child of node.children) {
        walkNode(child, depth + 1)
      }
    }
  }

  walkNode(nodeTree, 0)
  return lines.join('\n')
}
```

**Verification:** The output format matches the Figma Design Annotator design doc:

```markdown
# Screen: [Frame Name]
> Type: FRAME | Size: 1440x900

## Structure

### Header (FRAME)
**Note:** Horizontal flex, gap 16px, full width

- **Logo** (INSTANCE)
  > **Note:** 32x32, links to home page

- **Navigation** (FRAME):
  > **Note:** Horizontal flex, gap 8px

- **Title** (TEXT): "Dashboard"
  > **Note:** H1, semibold, left aligned
```

**Commit message:** `feat(desktop): create figma-export utility for generating structured Markdown from annotations`
