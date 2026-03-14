// frame-grid.tsx
import { Badge } from '@agent-coding/ui'
import { cn } from '@agent-coding/ui'
import type { FrameEntry } from 'renderer/types/figma'

const TAG_COLORS: Record<string, string> = {
  yellow: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  green: 'bg-green-500/20 text-green-400 border-green-500/30',
  blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  red: 'bg-red-500/20 text-red-400 border-red-500/30',
  purple: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  gray: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
}

interface FrameGridProps {
  readonly frames: FrameEntry[]
  readonly activeFrameId: string | null
  readonly onSelectFrame: (frameId: string) => void
}

export function FrameGrid({
  frames,
  activeFrameId,
  onSelectFrame,
}: FrameGridProps) {
  return (
    <div className="grid grid-cols-3 gap-3 p-4">
      {frames.map((frame) => {
        const isActive = frame.id === activeFrameId
        const hasNotes = frame.annotation.notes.length > 0

        return (
          <button
            key={frame.id}
            type="button"
            onClick={() => onSelectFrame(frame.id)}
            className={cn(
              'flex flex-col rounded-xl border p-4 text-left transition-all duration-150 cursor-pointer',
              'bg-surface-elevated hover:shadow-md',
              isActive
                ? 'border-accent shadow-md'
                : 'border-border hover:border-border',
            )}
          >
            {/* Thumbnail */}
            <div className="relative mb-3 aspect-video w-full overflow-hidden rounded-lg bg-zinc-950">
              <img
                src={frame.imageDataUrl}
                alt={frame.name}
                className="size-full object-contain"
              />
              {hasNotes && (
                <div className="absolute right-1.5 top-1.5 size-3 rounded-full bg-yellow-400" />
              )}
            </div>

            {/* Name */}
            <span className="truncate text-[13px] font-medium text-foreground">
              {frame.name}
            </span>

            {/* Type + Tags */}
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              <Badge
                variant="outline"
                className="px-1.5 py-0 text-[9px] bg-zinc-500/20 text-zinc-400 border-zinc-500/30"
              >
                {frame.type}
              </Badge>
              {frame.annotation.tags.map((tag) => (
                <Badge
                  key={tag.label}
                  variant="outline"
                  className={cn(
                    'px-1.5 py-0 text-[9px]',
                    TAG_COLORS[tag.color] ?? TAG_COLORS.gray,
                  )}
                >
                  {tag.label}
                </Badge>
              ))}
            </div>
          </button>
        )
      })}
    </div>
  )
}
