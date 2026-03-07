import { useRef, useState, useEffect, useCallback } from 'react'
import { cn } from '@agent-coding/ui'
import type { FlatNode } from 'renderer/components/figma/figma-node-tree'

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
              onClick={(e) => {
                e.stopPropagation()
                onSelectNode(node.id)
              }}
              onMouseEnter={() => onHoverNode(node.id)}
              onMouseLeave={() => onHoverNode(null)}
            >
              {(isSelected || isHovered) && (
                <div className="absolute -top-5 left-0 rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground whitespace-nowrap pointer-events-none">
                  {node.name}
                </div>
              )}

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
