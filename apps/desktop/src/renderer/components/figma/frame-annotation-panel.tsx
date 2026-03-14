// frame-annotation-panel.tsx
import { ScrollArea, Badge, Textarea } from '@agent-coding/ui'
import { cn } from '@agent-coding/ui'
import { TagPicker } from 'renderer/components/figma/tag-picker'
import { TYPE_BADGE_COLORS } from 'renderer/types/figma'
import type { FrameEntry, Tag } from 'renderer/types/figma'

interface FrameAnnotationPanelProps {
  readonly frame: FrameEntry | null
  readonly customTags: Tag[]
  readonly onUpdateNotes: (notes: string) => void
  readonly onAddTag: (tag: Tag) => void
  readonly onRemoveTag: (label: string) => void
  readonly onAddCustomTag: (tag: Tag) => void
}

export function FrameAnnotationPanel({
  frame,
  customTags,
  onUpdateNotes,
  onAddTag,
  onRemoveTag,
  onAddCustomTag,
}: FrameAnnotationPanelProps) {
  if (!frame) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center border-b border-border px-3 py-2">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Annotations
          </span>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <span className="text-[11px] text-muted-foreground">
            Select a frame to annotate
          </span>
        </div>
      </div>
    )
  }

  const badgeColor =
    TYPE_BADGE_COLORS[frame.type] ??
    'bg-zinc-500/20 text-zinc-400 border-zinc-500/30'

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center border-b border-border px-3 py-2">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          Annotations
        </span>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-4 p-3">
          {/* Frame info */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-foreground truncate">
              {frame.name}
            </span>
            <Badge
              variant="outline"
              className={cn('w-fit px-1.5 py-0 text-[10px]', badgeColor)}
            >
              {frame.type}
            </Badge>
            <span className="text-[10px] font-mono text-muted-foreground truncate">
              {frame.id}
            </span>
          </div>

          {/* Tags */}
          <TagPicker
            tags={frame.annotation.tags}
            customTags={customTags}
            onAddTag={onAddTag}
            onRemoveTag={onRemoveTag}
            onAddCustomTag={onAddCustomTag}
          />

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Notes
            </span>
            <Textarea
              value={frame.annotation.notes}
              onChange={(e) => onUpdateNotes(e.target.value)}
              placeholder="Add notes about this frame..."
              className="min-h-[120px] text-[12px] resize-none"
            />
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}
