import { useState, useRef } from 'react'
import { Badge, Input } from '@agent-coding/ui'
import { cn } from '@agent-coding/ui'
import { X, Plus } from 'lucide-react'
import { PRESET_TAGS } from 'renderer/types/figma'
import type { Tag } from 'renderer/types/figma'

const TAG_COLORS: Record<string, string> = {
  yellow: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  green: 'bg-green-500/20 text-green-400 border-green-500/30',
  blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  red: 'bg-red-500/20 text-red-400 border-red-500/30',
  purple: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  gray: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
}

interface TagPickerProps {
  readonly tags: Tag[]
  readonly customTags: Tag[]
  readonly onAddTag: (tag: Tag) => void
  readonly onRemoveTag: (label: string) => void
  readonly onAddCustomTag: (tag: Tag) => void
}

export function TagPicker({
  tags,
  customTags,
  onAddTag,
  onRemoveTag,
  onAddCustomTag,
}: TagPickerProps) {
  const [customInput, setCustomInput] = useState('')
  const [showInput, setShowInput] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const activeLabels = new Set(tags.map((t) => t.label))

  // Merge preset + custom for the suggestion pool
  const allAvailable = [
    ...PRESET_TAGS,
    ...customTags.filter((ct) => !PRESET_TAGS.some((p) => p.label === ct.label)),
  ]

  // Filter suggestions for autocomplete
  const suggestions = customInput.trim()
    ? allAvailable.filter(
        (t) =>
          t.label.toLowerCase().includes(customInput.toLowerCase()) &&
          !activeLabels.has(t.label),
      )
    : []

  const handleAddCustom = () => {
    const label = customInput.trim().toLowerCase()
    if (!label) return
    const existing = allAvailable.find((t) => t.label === label)
    if (existing) {
      onAddTag(existing)
    } else {
      const newTag: Tag = { label, preset: false, color: 'gray' }
      onAddCustomTag(newTag)
      onAddTag(newTag)
    }
    setCustomInput('')
    setShowInput(false)
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
        Tags
      </span>

      {/* Preset tags */}
      <div className="flex flex-wrap gap-1.5">
        {allAvailable.map((tag) => {
          const isActive = activeLabels.has(tag.label)
          const colorClass = TAG_COLORS[tag.color] ?? TAG_COLORS.gray
          return (
            <button
              key={tag.label}
              type="button"
              onClick={() =>
                isActive ? onRemoveTag(tag.label) : onAddTag(tag)
              }
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase transition-all duration-150 cursor-pointer',
                isActive
                  ? colorClass
                  : 'border-border text-muted-foreground hover:border-border hover:text-foreground',
              )}
            >
              {tag.label}
              {isActive && <X className="size-2.5" />}
            </button>
          )
        })}

        {/* Add custom tag button */}
        {!showInput && (
          <button
            type="button"
            onClick={() => {
              setShowInput(true)
              setTimeout(() => inputRef.current?.focus(), 0)
            }}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <Plus className="size-2.5" />
            Custom
          </button>
        )}
      </div>

      {/* Custom tag input */}
      {showInput && (
        <div className="relative">
          <Input
            ref={inputRef}
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddCustom()
              if (e.key === 'Escape') {
                setShowInput(false)
                setCustomInput('')
              }
            }}
            onBlur={() => {
              if (!customInput.trim()) {
                setShowInput(false)
                setCustomInput('')
              }
            }}
            placeholder="Tag name..."
            className="h-7 text-[11px]"
          />
          {suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-10 mt-1 rounded-md border border-border bg-surface p-1 shadow-md">
              {suggestions.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onAddTag(s)
                    setCustomInput('')
                    setShowInput(false)
                  }}
                  className="flex w-full items-center gap-2 rounded px-2 py-1 text-[11px] text-foreground hover:bg-surface-hover cursor-pointer transition-colors"
                >
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.5 text-[9px] uppercase',
                      TAG_COLORS[s.color] ?? TAG_COLORS.gray,
                    )}
                  >
                    {s.label}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
