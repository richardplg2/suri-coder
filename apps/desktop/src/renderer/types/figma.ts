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
