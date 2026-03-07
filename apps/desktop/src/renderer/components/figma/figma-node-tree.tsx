import { ScrollArea } from '@agent-coding/ui'
import { cn } from '@agent-coding/ui'

export interface FlatNode {
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
            {annotations[node.id] && <span className="size-2 rounded-full bg-yellow-400 shrink-0" />}
          </button>
        ))}
      </div>
    </ScrollArea>
  )
}
