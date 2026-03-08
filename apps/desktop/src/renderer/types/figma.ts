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
