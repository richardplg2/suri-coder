import { useState } from 'react'
import { ArrowUp, Shield, Sparkles } from 'lucide-react'

interface SessionInputBarProps {
  onSend: (message: string) => void
  isRunning?: boolean
  statusText?: string
  onGenerateSpec?: () => void
}

export function SessionInputBar({
  onSend,
  isRunning,
  statusText,
  onGenerateSpec,
}: Readonly<SessionInputBarProps>) {
  const [value, setValue] = useState('')

  function handleSubmit() {
    const trimmed = value.trim()
    if (!trimmed) return
    onSend(trimmed)
    setValue('')
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div
      className="border-t px-4 py-2.5 shrink-0"
      style={{
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(var(--glass-blur))',
        WebkitBackdropFilter: 'blur(var(--glass-blur))',
        borderColor: 'var(--glass-border)',
      }}
    >
      {isRunning && statusText && (
        <div className="flex items-center gap-2 mb-2 px-1">
          <div className="size-1.5 rounded-full bg-[var(--primary)] animate-pulse" />
          <span className="text-[11px] text-muted-foreground">{statusText}</span>
        </div>
      )}

      <div className="flex items-center gap-2.5">
        <div className="relative flex-1">
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="w-full rounded-lg border border-border bg-background py-2 pl-3 pr-10 text-[12px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/50 focus:border-[var(--primary)] transition-all duration-150"
          />
          <button
            type="button"
            onClick={handleSubmit}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 flex size-7 items-center justify-center rounded-md bg-[var(--primary)] cursor-pointer hover:bg-[var(--accent-hover)] transition-colors duration-150"
          >
            <ArrowUp className="size-4 text-white" />
          </button>
        </div>

        {onGenerateSpec && (
          <button
            type="button"
            onClick={onGenerateSpec}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-accent/30 bg-accent/10 px-3 py-1.5 text-[11px] font-bold text-accent cursor-pointer hover:bg-accent/20 transition-colors duration-150"
          >
            <Sparkles className="size-3.5" />
            Generate Spec
          </button>
        )}

        <div className="flex items-center gap-1 shrink-0 rounded border border-[var(--success)]/20 bg-[var(--success)]/10 px-2 py-1 text-[10px] font-medium text-[var(--success)]">
          <Shield className="size-3" />
          Auto
        </div>
      </div>
    </div>
  )
}
