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
