import { useState } from 'react'
import { SplitPane, SplitPanePanel, SplitPaneHandle, Button, Input, Badge, Spinner } from '@agent-coding/ui'
import { Plug, Unplug, Download, Loader2 } from 'lucide-react'
import { useFigmaConnection } from 'renderer/hooks/use-figma-connection'
import { FigmaNodeTree } from 'renderer/components/figma/figma-node-tree'
import { FigmaCanvas } from 'renderer/components/figma/figma-canvas'
import { FigmaAnnotationPanel } from 'renderer/components/figma/figma-annotation-panel'
import type { FigmaNode } from 'renderer/hooks/use-figma-connection'
import type { FlatNode } from 'renderer/components/figma/figma-node-tree'

interface Annotation {
  text: string
  nodeName: string
  nodeType: string
}

interface FigmaViewerProps {
  onAnnotationsReady?: (annotations: Record<string, Annotation>, nodeTree: FigmaNode, imageDataUrl: string) => void
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

export function FigmaViewer({ onAnnotationsReady }: FigmaViewerProps) {
  const figma = useFigmaConnection()
  const [channelId, setChannelId] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Design state
  const [nodeTree, setNodeTree] = useState<FigmaNode | null>(null)
  const [flatNodes, setFlatNodes] = useState<FlatNode[]>([])
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null)
  const [rootBBox, setRootBBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null)

  // Interaction state
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
  const [annotations, setAnnotations] = useState<Record<string, Annotation>>({})

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

      const selectedNode = selection.selection[0]

      const nodeInfo = await figma.sendCommand<FigmaNode>('get_node_info', { nodeId: selectedNode.id })
      setNodeTree(nodeInfo)
      setRootBBox(nodeInfo.absoluteBoundingBox!)

      const exported = await figma.sendCommand<{ imageData: string }>('export_node_as_image', {
        nodeId: selectedNode.id,
        format: 'PNG',
        scale: 2,
      })

      const imgData = exported.imageData.startsWith('data:')
        ? exported.imageData
        : `data:image/png;base64,${exported.imageData}`
      setImageDataUrl(imgData)

      const flat: FlatNode[] = []
      flattenNodes(nodeInfo, 0, flat)
      setFlatNodes(flat)

      // Notify parent that design is loaded (even with no annotations yet)
      onAnnotationsReady?.(annotations, nodeInfo, imgData)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load design'
      setLoadError(message)
      console.error('Failed to load design:', e)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectNode = (nodeId: string) => {
    setSelectedNodeId(nodeId)
    figma.sendCommand('set_selections', { nodeIds: [nodeId] }).catch(() => {})
  }

  const handleSaveAnnotation = (nodeId: string, text: string) => {
    const node = flatNodes.find((n) => n.id === nodeId)
    if (!node) return
    if (text) {
      const next = {
        ...annotations,
        [nodeId]: { text, nodeName: node.name, nodeType: node.type },
      }
      setAnnotations(next)
      if (nodeTree && imageDataUrl) onAnnotationsReady?.(next, nodeTree, imageDataUrl)
    } else {
      const next = { ...annotations }
      delete next[nodeId]
      setAnnotations(next)
      if (nodeTree && imageDataUrl) onAnnotationsReady?.(next, nodeTree, imageDataUrl)
    }
  }

  const handleDeleteAnnotation = (nodeId: string) => {
    const next = { ...annotations }
    delete next[nodeId]
    setAnnotations(next)
    if (nodeTree && imageDataUrl) onAnnotationsReady?.(next, nodeTree, imageDataUrl)
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
              {isLoading ? (
                <Loader2 className="mr-1.5 size-3 animate-spin" />
              ) : (
                <Download className="mr-1.5 size-3" />
              )}
              Load Design
            </Button>
          </>
        ) : (
          <Button size="sm" onClick={() => figma.connect(channelId)} disabled={!channelId.trim()}>
            <Plug className="mr-1.5 size-3" /> Connect
          </Button>
        )}

        {(figma.state.error || loadError) && (
          <span className="text-[11px] text-red-400">{figma.state.error || loadError}</span>
        )}

        <span className="flex-1" />
        <span className="text-[11px] text-muted-foreground">
          {Object.keys(annotations).length}/{flatNodes.length} annotated
        </span>
      </div>

      {/* 3-panel layout */}
      {imageDataUrl && rootBBox ? (
        <SplitPane orientation="horizontal" className="flex-1">
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
                Enter the channel ID from the Figma plugin, click Connect, select a frame in Figma, then click Load
                Design.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
