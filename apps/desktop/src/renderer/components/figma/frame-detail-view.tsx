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
