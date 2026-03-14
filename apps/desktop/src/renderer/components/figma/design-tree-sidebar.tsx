import { ScrollArea, Badge } from '@agent-coding/ui'
import { cn } from '@agent-coding/ui'
import { ChevronDown, ChevronRight, Trash2, Image } from 'lucide-react'
import { useState, useEffect } from 'react'
import { TYPE_BADGE_COLORS } from 'renderer/types/figma'
import type { Design } from 'renderer/types/figma'

interface DesignTreeSidebarProps {
  readonly designs: Design[]
  readonly activeDesignId: string | null
  readonly activeFrameId: string | null
  readonly onSelectDesign: (id: string) => void
  readonly onSelectFrame: (designId: string, frameId: string) => void
  readonly onRemoveDesign: (id: string) => void
}

export function DesignTreeSidebar({
  designs,
  activeDesignId,
  activeFrameId,
  onSelectDesign,
  onSelectFrame,
  onRemoveDesign,
}: DesignTreeSidebarProps) {
  const [expandedDesigns, setExpandedDesigns] = useState<Set<string>>(
    () => new Set(designs.map((d) => d.id)),
  )

  useEffect(() => {
    setExpandedDesigns((prev) => {
      const next = new Set(prev)
      for (const d of designs) {
        if (!next.has(d.id)) next.add(d.id)
      }
      return next
    })
  }, [designs])

  const toggleExpand = (id: string) => {
    setExpandedDesigns((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          Designs ({designs.length})
        </span>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-1">
          {designs.map((design) => {
            const isExpanded = expandedDesigns.has(design.id)
            const isActiveDesign = design.id === activeDesignId

            return (
              <div key={design.id}>
                {/* Design row */}
                <button
                  type="button"
                  onClick={() => {
                    toggleExpand(design.id)
                    onSelectDesign(design.id)
                  }}
                  className={cn(
                    'flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left transition-colors duration-150 cursor-pointer',
                    isActiveDesign && !activeFrameId
                      ? 'bg-(--selection)'
                      : 'hover:bg-surface-hover',
                  )}
                >
                  {isExpanded ? (
                    <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="size-3 shrink-0 text-muted-foreground" />
                  )}
                  <span className="flex-1 truncate text-[13px] font-medium text-foreground">
                    {design.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {design.frames.length}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onRemoveDesign(design.id)
                    }}
                    className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-red-400 transition-colors cursor-pointer"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </button>

                {/* Frame children */}
                {isExpanded &&
                  design.frames.map((frame) => {
                    const isActiveFrame =
                      isActiveDesign && frame.id === activeFrameId
                    const tagCount = frame.annotation.tags.length
                    const hasNotes = frame.annotation.notes.length > 0
                    const badgeColor =
                      TYPE_BADGE_COLORS[frame.type] ??
                      'bg-zinc-500/20 text-zinc-400 border-zinc-500/30'

                    return (
                      <button
                        key={frame.id}
                        type="button"
                        onClick={() =>
                          onSelectFrame(design.id, frame.id)
                        }
                        className={cn(
                          'flex w-full items-center gap-1.5 rounded-md py-1 pl-7 pr-2 text-left transition-colors duration-150 cursor-pointer',
                          isActiveFrame
                            ? 'bg-(--selection) border-l-2 border-accent'
                            : 'hover:bg-surface-hover',
                        )}
                      >
                        <Image className="size-3 shrink-0 text-muted-foreground" />
                        <span className="flex-1 truncate text-[12px] text-foreground">
                          {frame.name}
                        </span>
                        {(tagCount > 0 || hasNotes) && (
                          <div className="flex items-center gap-1">
                            {tagCount > 0 && (
                              <Badge
                                variant="outline"
                                className={cn(
                                  'px-1 py-0 text-[9px]',
                                  badgeColor,
                                )}
                              >
                                {tagCount}
                              </Badge>
                            )}
                            {hasNotes && (
                              <span className="size-1.5 rounded-full bg-yellow-400" />
                            )}
                          </div>
                        )}
                      </button>
                    )
                  })}
              </div>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
}
