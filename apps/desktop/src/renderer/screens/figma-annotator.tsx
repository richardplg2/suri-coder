import { useState, useCallback } from 'react'
import {
  SplitPane, SplitPanePanel, SplitPaneHandle,
  Button, Input, Badge, Spinner,
} from '@agent-coding/ui'
import {
  ArrowLeft, LayoutGrid, Plug, Unplug, Download, Loader2, Sparkles,
} from 'lucide-react'
import { useFigmaConnection } from 'renderer/hooks/use-figma-connection'
import type { FigmaNode } from 'renderer/hooks/use-figma-connection'
import { FigmaNodeTree } from 'renderer/components/figma/figma-node-tree'
import type { FlatNode } from 'renderer/components/figma/figma-node-tree'
import { FigmaCanvas } from 'renderer/components/figma/figma-canvas'
import { AnnotationsPanel } from 'renderer/components/figma/annotations-panel'
import type { DesignEntry } from 'renderer/types/figma'
import { useBrainstormStart } from 'renderer/hooks/queries/use-brainstorm'
import { generateFigmaMarkdown } from 'renderer/lib/figma-export'
import { useTabStore } from 'renderer/stores/use-tab-store'

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
  const closeTab = useTabStore((s) => s.closeTab)
  const brainstorm = useBrainstormStart(projectId)

  // Connection
  const [channelId, setChannelId] = useState('')

  // Design entries
  const [designEntries, setDesignEntries] = useState<DesignEntry[]>([])
  const [activeDesignId, setActiveDesignId] = useState<string | null>(null)

  // Interaction within active design
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)

  // Loading
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const activeDesign = designEntries.find((e) => e.id === activeDesignId) ?? null

  const handleBack = useCallback(() => {
    closeTab(projectId, `figma-${projectId}`)
  }, [closeTab, projectId])

  const handleLoadDesign = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    try {
      const selection = await figma.sendCommand<{
        selection: Array<{ id: string; name: string; type: string }>
      }>('get_selection')

      if (!selection.selection?.length) {
        throw new Error('No node selected in Figma. Please select a frame.')
      }

      const selectedNode = selection.selection[0]

      // Prevent duplicates — check via ref to avoid stale closure
      let isDuplicate = false
      setDesignEntries((prev) => {
        if (prev.some((e) => e.id === selectedNode.id)) {
          isDuplicate = true
        }
        return prev
      })
      if (isDuplicate) {
        setActiveDesignId(selectedNode.id)
        return
      }

      const nodeInfo = await figma.sendCommand<FigmaNode>('get_node_info', {
        nodeId: selectedNode.id,
      })

      const exported = await figma.sendCommand<{ imageData: string }>(
        'export_node_as_image',
        { nodeId: selectedNode.id, format: 'PNG', scale: 2 },
      )

      const imgData = exported.imageData.startsWith('data:')
        ? exported.imageData
        : `data:image/png;base64,${exported.imageData}`

      if (!nodeInfo.absoluteBoundingBox) {
        throw new Error(`Node "${selectedNode.name}" has no bounding box. Select a frame with dimensions.`)
      }

      const flat: FlatNode[] = []
      flattenNodes(nodeInfo, 0, flat)

      const entry: DesignEntry = {
        id: selectedNode.id,
        name: selectedNode.name,
        type: selectedNode.type,
        nodeTree: nodeInfo,
        flatNodes: flat,
        imageDataUrl: imgData,
        rootBBox: nodeInfo.absoluteBoundingBox,
        notes: '',
        addedAt: Date.now(),
      }

      setDesignEntries((prev) => [...prev, entry])
      setActiveDesignId(entry.id)
      setSelectedNodeId(null)
      setHoveredNodeId(null)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load design'
      setLoadError(message)
      console.error('Failed to load design:', e)
    } finally {
      setIsLoading(false)
    }
  }, [figma])

  const handleRemoveDesign = useCallback(
    (id: string) => {
      setDesignEntries((prev) => prev.filter((e) => e.id !== id))
      if (activeDesignId === id) {
        setActiveDesignId(null)
        setSelectedNodeId(null)
        setHoveredNodeId(null)
      }
    },
    [activeDesignId],
  )

  const handleUpdateNotes = useCallback((id: string, notes: string) => {
    setDesignEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, notes } : e)),
    )
  }, [])

  const handleSelectNode = useCallback(
    (nodeId: string) => {
      setSelectedNodeId(nodeId)
      figma.sendCommand('set_selections', { nodeIds: [nodeId] }).catch(() => {})
    },
    [figma],
  )

  const handleSelectDesign = useCallback((id: string) => {
    setActiveDesignId(id)
    setSelectedNodeId(null)
    setHoveredNodeId(null)
  }, [])

  const handleStartBrainstorm = useCallback(() => {
    // Combine all entries into brainstorm data
    const figmaData: Record<string, unknown> = {
      designs: designEntries.map((entry) => ({
        id: entry.id,
        name: entry.name,
        type: entry.type,
        notes: entry.notes,
        markdown: generateFigmaMarkdown(entry.nodeTree, {}),
      })),
    }
    brainstorm.mutate({ figma_data: figmaData })
  }, [designEntries, brainstorm])

  const isConnected = figma.state.status === 'connected'
  const errorMessage = figma.state.error || loadError

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4">
        <Button variant="ghost" size="icon-sm" className="size-7 cursor-pointer" onClick={handleBack}>
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
            <span className="text-[11px] font-mono text-muted-foreground">{channelId}</span>
            <Button size="sm" variant="outline" onClick={figma.disconnect} className="cursor-pointer">
              <Unplug className="mr-1.5 size-3" /> Disconnect
            </Button>
            <Button size="sm" onClick={handleLoadDesign} disabled={isLoading} className="cursor-pointer">
              {isLoading ? (
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
          disabled={designEntries.length === 0 || brainstorm.isPending}
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
      {activeDesign ? (
        <SplitPane orientation="horizontal" className="flex-1">
          <SplitPanePanel defaultSize={20} minSize={15}>
            <div className="flex h-full flex-col">
              <div className="flex items-center border-b border-border px-3 py-2">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Layers
                </span>
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

          <SplitPanePanel defaultSize={30} minSize={15}>
            <AnnotationsPanel
              entries={designEntries}
              activeDesignId={activeDesignId}
              onSelectDesign={handleSelectDesign}
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
            <div className="max-w-md text-center">
              <div className="text-[13px] font-semibold tracking-tight mb-2">
                {isConnected
                  ? 'Select a frame in Figma and click Load Design'
                  : 'Connect to Figma to get started'}
              </div>
              <p className="text-[11px]">
                {isConnected
                  ? 'You can load multiple frames to annotate and compare them.'
                  : 'Enter the channel ID from the Figma plugin and click Connect.'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex h-8 shrink-0 items-center gap-2 border-t border-border px-4 text-[11px] text-muted-foreground">
        <span
          className={`size-2 rounded-full ${
            isConnected ? 'bg-green-500' : 'bg-zinc-500'
          }`}
        />
        <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
        <span className="mx-1">|</span>
        <span>{designEntries.length} design{designEntries.length !== 1 ? 's' : ''} loaded</span>
      </div>
    </div>
  )
}
