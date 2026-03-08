import { useState } from 'react'
import { CheckCircle2, Circle, XCircle, Loader2, ChevronRight } from 'lucide-react'
import { cn } from '@agent-coding/ui'
import type { StepStatus } from 'renderer/types/api'

interface Session {
  id: string
  number: number
  status: 'running' | 'completed' | 'failed'
}

interface WorkflowStepItemProps {
  name: string
  status: StepStatus
  sessions?: Session[]
  isActive?: boolean
  onClickStep?: () => void
  onClickSession?: (sessionId: string) => void
}

const STATUS_ICONS: Record<string, { icon: typeof Circle; className: string }> = {
  completed: { icon: CheckCircle2, className: 'text-[var(--success)]' },
  running: { icon: Loader2, className: 'text-[var(--accent)] animate-spin' },
  ready: { icon: Circle, className: 'text-[var(--accent)] fill-[var(--accent)]' },
  review: { icon: Circle, className: 'text-[var(--accent)] fill-[var(--accent)]' },
  awaiting_approval: { icon: Circle, className: 'text-[var(--accent)] fill-[var(--accent)]' },
  changes_requested: { icon: XCircle, className: 'text-[var(--destructive)]' },
  failed: { icon: XCircle, className: 'text-[var(--destructive)]' },
  pending: { icon: Circle, className: 'text-muted-foreground' },
  skipped: { icon: Circle, className: 'text-muted-foreground/50' },
}

function getStatusIcon(status: StepStatus) {
  return STATUS_ICONS[status] ?? STATUS_ICONS.pending
}

const SESSION_DOT: Record<string, string> = {
  running: 'bg-[var(--success)] animate-pulse',
  completed: 'bg-muted-foreground/50',
  failed: 'bg-[var(--destructive)]',
}

export function WorkflowStepItem({
  name,
  status,
  sessions,
  isActive = false,
  onClickStep,
  onClickSession,
}: WorkflowStepItemProps) {
  const [expanded, setExpanded] = useState(isActive)
  const { icon: Icon, className: iconClass } = getStatusIcon(status)
  const hasSessions = sessions && sessions.length > 0

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          if (hasSessions) setExpanded((p) => !p)
          onClickStep?.()
        }}
        className={cn(
          'flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-sm cursor-pointer',
          'transition-colors duration-150',
          isActive
            ? 'bg-[var(--accent)]/10 border border-[var(--accent)]/20 text-[var(--accent)] font-medium'
            : 'text-muted-foreground hover:bg-[var(--surface-hover)] hover:text-foreground',
        )}
      >
        {hasSessions && (
          <ChevronRight
            className={cn(
              'size-3.5 shrink-0 transition-transform duration-150',
              expanded && 'rotate-90',
            )}
          />
        )}
        {!hasSessions && <div className="w-3.5 shrink-0" />}
        <Icon className={cn('size-4 shrink-0', iconClass)} />
        <span className="truncate">{name}</span>
      </button>

      {/* Nested sessions */}
      {expanded && hasSessions && (
        <div className="ml-6 mt-0.5 space-y-0.5 pl-3 border-l border-border/30">
          {sessions.map((session) => (
            <button
              key={session.id}
              type="button"
              onClick={() => onClickSession?.(session.id)}
              className="flex w-full items-center gap-2 px-2 py-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer rounded transition-colors duration-150"
            >
              <span className={cn('size-1.5 rounded-full shrink-0', SESSION_DOT[session.status] ?? SESSION_DOT.completed)} />
              <span>Session #{session.number}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
