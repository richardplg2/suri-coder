import { useState } from 'react'
import { ScrollArea, Button, Badge, Textarea } from '@agent-coding/ui'
import { cn } from '@agent-coding/ui'
import { Trash2, PlusCircle, FileDown } from 'lucide-react'
import type { DesignEntry } from 'renderer/types/figma'

interface AnnotationsPanelProps {
  readonly entries: DesignEntry[]
  readonly activeDesignId: string | null
  readonly onSelectDesign: (id: string) => void
  readonly onRemoveDesign: (id: string) => void
  readonly onUpdateNotes: (id: string, notes: string) => void
}

const TYPE_BADGE_COLORS: Record<string, string> = {
  FRAME: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  COMPONENT: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  INSTANCE: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  GROUP: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
}

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 60) return 'Just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ago`
}

export function AnnotationsPanel({
  entries,
  activeDesignId,
  onSelectDesign,
  onRemoveDesign,
  onUpdateNotes,
}: Readonly<AnnotationsPanelProps>) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  const handleStartEdit = (id: string, currentNotes: string) => {
    setEditingId(id)
    setEditText(currentNotes)
  }

  const handleSaveEdit = (id: string) => {
    onUpdateNotes(id, editText)
    setEditingId(null)
    setEditText('')
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditText('')
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-[13px] font-semibold text-foreground">
          Annotations ({entries.length})
        </span>
      </div>

      {/* Cards list */}
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-2 p-2">
          {entries.map((entry, index) => {
            const isActive = entry.id === activeDesignId
            const isEditing = editingId === entry.id
            const badgeColor = TYPE_BADGE_COLORS[entry.type] ?? 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30'

            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => onSelectDesign(entry.id)}
                className={cn(
                  'flex flex-col gap-1.5 rounded-lg border p-3 text-left transition-all duration-150 cursor-pointer',
                  isActive
                    ? 'border-accent bg-(--selection)'
                    : 'border-border bg-surface hover:bg-surface-hover',
                )}
              >
                {/* Top row: number, name, trash */}
                <div className="flex items-center gap-2">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-semibold text-accent-foreground">
                    {index + 1}
                  </span>
                  <span className="flex-1 truncate text-[13px] font-semibold text-foreground">
                    {entry.name}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onRemoveDesign(entry.id)
                    }}
                    className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-red-400 transition-colors cursor-pointer"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>

                {/* Type badge */}
                <Badge variant="outline" className={cn('w-fit text-[10px] px-1.5 py-0', badgeColor)}>
                  {entry.type}
                </Badge>

                {/* Notes */}
                {isEditing ? (
                  <div className="flex flex-col gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <Textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      placeholder="Add notes..."
                      className="min-h-[60px] text-[11px] resize-none"
                      autoFocus
                    />
                    <div className="flex gap-1.5">
                      <Button size="sm" className="h-6 text-[11px] px-2" onClick={() => handleSaveEdit(entry.id)}>
                        Save
                      </Button>
                      <Button size="sm" variant="ghost" className="h-6 text-[11px] px-2" onClick={handleCancelEdit}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={(e) => {
                      e.stopPropagation()
                      handleStartEdit(entry.id, entry.notes)
                    }}
                    className="cursor-pointer text-[11px] text-muted-foreground hover:text-foreground transition-colors min-h-[20px]"
                  >
                    {entry.notes || 'Click to add notes...'}
                  </div>
                )}

                {/* Footer: time ago + truncated ID */}
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>{timeAgo(entry.addedAt)}</span>
                  <span className="font-mono truncate max-w-[80px]">{entry.id}</span>
                </div>
              </button>
            )
          })}

          {/* Empty state prompt */}
          <div className="flex flex-col items-center gap-1.5 py-4 text-muted-foreground">
            <PlusCircle className="size-5" />
            <span className="text-[11px] text-center">
              {entries.length === 0
                ? 'Load a design from Figma to start annotating'
                : 'Select more frames in Figma and click Load Design'}
            </span>
          </div>
        </div>
      </ScrollArea>

      {/* Panel footer */}
      <div className="border-t border-border px-3 py-2">
        <Button
          size="sm"
          variant="outline"
          className="w-full text-[11px]"
          disabled={entries.length === 0}
        >
          <FileDown className="mr-1.5 size-3" />
          Export Documentation
        </Button>
      </div>
    </div>
  )
}
