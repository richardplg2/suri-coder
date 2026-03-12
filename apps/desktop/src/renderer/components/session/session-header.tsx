import {
  ArrowLeft, Terminal, Coins, DollarSign, Clock,
  Square, Pause,
} from 'lucide-react'
import { cn, Button } from '@agent-coding/ui'
import type { SessionData } from './types'

interface SessionHeaderProps {
  session: SessionData
  onBack?: () => void
  onStop?: () => void
  onPause?: () => void
}

export function SessionHeader({
  session,
  onBack,
  onStop,
  onPause,
}: Readonly<SessionHeaderProps>) {
  return (
    <header
      className="flex items-center justify-between border-b px-5 py-2.5 shrink-0"
      style={{
        height: 44,
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(var(--glass-blur))',
        WebkitBackdropFilter: 'blur(var(--glass-blur))',
        borderColor: 'var(--glass-border)',
      }}
    >
      <div className="flex items-center gap-4">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="rounded p-1 cursor-pointer text-muted-foreground hover:bg-[var(--surface-hover)] transition-colors duration-150"
          >
            <ArrowLeft className="size-[18px]" />
          </button>
        )}

        <div className="flex items-center gap-2.5">
          <div className="rounded-md bg-[var(--primary)]/15 p-1">
            <Terminal className="size-4 text-[var(--primary)]" />
          </div>
          <h1 className="text-[13px] font-semibold leading-tight">{session.title}</h1>
        </div>

        <div className="h-4 w-px bg-border" />

        <div className="flex items-center gap-3.5 text-[11px] font-mono text-muted-foreground">
          {session.tokenCount != null && (
            <span className="flex items-center gap-1">
              <Coins className="size-[13px]" />
              {session.tokenCount >= 1000
                ? `${(session.tokenCount / 1000).toFixed(1)}K`
                : session.tokenCount}
            </span>
          )}
          {session.cost && (
            <span className="flex items-center gap-1">
              <DollarSign className="size-[13px]" />
              {session.cost}
            </span>
          )}
          {session.duration && (
            <span className="flex items-center gap-1 text-[var(--primary)]">
              <Clock className="size-[13px]" />
              {session.duration}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <StatusPill status={session.status} />

        {session.status === 'running' && onPause && (
          <Button
            variant="outline"
            size="sm"
            onClick={onPause}
            className="gap-1 border-[var(--warning)]/20 bg-[var(--warning)]/10 text-[var(--warning)] hover:bg-[var(--warning)]/20 text-[11px] font-semibold h-7"
          >
            <Pause className="size-3.5" />
            Pause
          </Button>
        )}

        {(session.status === 'running' || session.status === 'paused') && onStop && (
          <Button
            variant="outline"
            size="sm"
            onClick={onStop}
            className="gap-1 border-[var(--destructive)]/20 bg-[var(--destructive)]/10 text-[var(--destructive)] hover:bg-[var(--destructive)]/20 text-[11px] font-semibold h-7"
          >
            <Square className="size-3.5" />
            Stop
          </Button>
        )}
      </div>
    </header>
  )
}

function StatusPill({ status }: Readonly<{ status: SessionData['status'] }>) {
  const config = {
    running: {
      dot: 'bg-[var(--success)]',
      text: 'text-[var(--success)]',
      bg: 'bg-[var(--success)]/10 border-[var(--success)]/20',
      pulse: true,
    },
    paused: {
      dot: 'bg-[var(--warning)]',
      text: 'text-[var(--warning)]',
      bg: 'bg-[var(--warning)]/10 border-[var(--warning)]/20',
      pulse: false,
    },
    completed: {
      dot: 'bg-[var(--success)]',
      text: 'text-[var(--success)]',
      bg: 'bg-[var(--success)]/10 border-[var(--success)]/20',
      pulse: false,
    },
    failed: {
      dot: 'bg-[var(--destructive)]',
      text: 'text-[var(--destructive)]',
      bg: 'bg-[var(--destructive)]/10 border-[var(--destructive)]/20',
      pulse: false,
    },
  }[status]

  return (
    <div className={cn('flex items-center gap-1.5 rounded-full border px-2.5 py-1', config.bg)}>
      <div
        className={cn('size-1.5 rounded-full', config.dot, config.pulse && 'animate-pulse')}
      />
      <span className={cn('text-[10px] font-bold uppercase tracking-wider', config.text)}>
        {status}
      </span>
    </div>
  )
}
