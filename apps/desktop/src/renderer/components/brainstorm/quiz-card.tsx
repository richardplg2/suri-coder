import { useState } from 'react'
import { Button, Badge, Input } from '@agent-coding/ui'
import { CheckCircle } from 'lucide-react'
import type { QuizData } from 'renderer/types/api'

interface QuizCardProps {
  data: QuizData
  onSubmit: (answer: string) => void
  disabled?: boolean
}

export function QuizCard({ data, onSubmit, disabled }: QuizCardProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [customText, setCustomText] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const handleToggle = (optionId: string) => {
    if (submitted) return
    setSelected((prev) => {
      const next = new Set(prev)
      if (!data.allow_multiple) {
        return new Set([optionId])
      }
      if (next.has(optionId)) next.delete(optionId)
      else next.add(optionId)
      return next
    })
  }

  const handleSubmit = () => {
    if (submitted) return
    const selectedLabels = data.options
      .filter((o) => selected.has(o.id))
      .map((o) => o.label)
    const parts = [...selectedLabels]
    if (customText.trim()) parts.push(customText.trim())
    const answer = parts.join(', ')
    setSubmitted(true)
    onSubmit(answer)
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div>
        <h4 className="text-[14px] font-semibold">{data.question}</h4>
        {data.context && (
          <p className="mt-1 text-caption text-muted-foreground">{data.context}</p>
        )}
      </div>

      <div className="space-y-2">
        {data.options.map((option) => (
          <button
            key={option.id}
            type="button"
            disabled={submitted || disabled}
            onClick={() => handleToggle(option.id)}
            className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-all ${
              selected.has(option.id)
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50'
            } ${submitted ? 'opacity-70 cursor-default' : 'cursor-pointer'}`}
          >
            <div
              className={`mt-0.5 flex size-4 shrink-0 items-center justify-center border ${
                data.allow_multiple ? 'rounded-sm' : 'rounded-full'
              } ${selected.has(option.id) ? 'border-primary bg-primary' : 'border-muted-foreground'}`}
            >
              {selected.has(option.id) && (
                <CheckCircle className="size-3 text-primary-foreground" />
              )}
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-medium">{option.label}</span>
                {option.recommended && (
                  <Badge className="bg-yellow-500/15 text-yellow-400 text-[10px] px-1.5 py-0">
                    Recommended
                  </Badge>
                )}
              </div>
              {option.description && (
                <p className="mt-0.5 text-caption text-muted-foreground">{option.description}</p>
              )}
            </div>
          </button>
        ))}
      </div>

      {data.allow_custom && !submitted && (
        <Input
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          placeholder="Or type your own answer..."
          className="text-[13px]"
        />
      )}

      {!submitted && (
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={selected.size === 0 && !customText.trim()}
        >
          Submit Answer
        </Button>
      )}

      {submitted && (
        <div className="flex items-center gap-1.5 text-caption text-green-400">
          <CheckCircle className="size-3.5" /> Answer submitted
        </div>
      )}
    </div>
  )
}
