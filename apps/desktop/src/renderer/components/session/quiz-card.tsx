import { useState } from 'react'
import { Bot, ArrowRight } from 'lucide-react'
import { cn, Button } from '@agent-coding/ui'
import type { TranscriptItem } from './types'

interface QuizCardProps {
  item: TranscriptItem
  onAnswer?: (itemId: string, selectedIds: string[]) => void
}

export function QuizCard({ item, onAnswer }: Readonly<QuizCardProps>) {
  if (item.entry.kind !== 'quiz') return null

  const { question, mode, options, selectedIds: initialSelected } = item.entry
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelected ?? []))

  function toggleOption(optionId: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (mode === 'single') {
        next.clear()
        next.add(optionId)
      } else {
        if (next.has(optionId)) next.delete(optionId)
        else next.add(optionId)
      }
      return next
    })
  }

  function handleSubmit() {
    onAnswer?.(item.id, Array.from(selected))
  }

  return (
    <div className="mx-1 mt-2 rounded-xl border border-border bg-[var(--surface)] p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="size-4 text-[var(--primary)]" />
          <span className="text-[12px] font-semibold text-foreground">{question}</span>
        </div>
        <span
          className={cn(
            'rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider',
            mode === 'single'
              ? 'bg-[var(--primary)]/15 text-[var(--primary)]'
              : 'bg-[var(--tool-grep)]/15 text-[var(--tool-grep)]',
          )}
        >
          {mode === 'single' ? 'Single' : 'Multi'}
        </span>
      </div>

      {/* Options */}
      <div className="space-y-1.5">
        {options.map((opt) => {
          const isSelected = selected.has(opt.id)
          return (
            <label
              key={opt.id}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 cursor-pointer transition-all duration-150',
                isSelected
                  ? 'bg-[var(--primary)]/10 border border-[var(--primary)]/30'
                  : 'border border-border hover:bg-[var(--surface-hover)]',
              )}
            >
              <input
                type={mode === 'single' ? 'radio' : 'checkbox'}
                name={`quiz-${item.id}`}
                checked={isSelected}
                onChange={() => toggleOption(opt.id)}
                className="size-3.5 border-[var(--border)] bg-[var(--surface)] text-[var(--primary)] focus:ring-[var(--primary)]"
              />
              <div>
                <span
                  className={cn(
                    'text-[12px] font-medium',
                    isSelected ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {opt.label}
                </span>
                {opt.description && (
                  <span className="ml-2 text-[10px] text-muted-foreground">{opt.description}</span>
                )}
              </div>
            </label>
          )
        })}
      </div>

      {/* Submit for multi-choice */}
      {mode === 'multi' && (
        <div className="flex justify-end pt-1">
          <Button size="sm" onClick={handleSubmit} className="gap-1.5 text-[12px]">
            Continue
            <ArrowRight className="size-3.5" />
          </Button>
        </div>
      )}
    </div>
  )
}
