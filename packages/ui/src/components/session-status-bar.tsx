import * as React from 'react'
import { Clock, Coins, Zap } from 'lucide-react'

import { cn } from '@/lib/utils'

interface SessionStatusBarProps extends React.ComponentProps<'div'> {
  status: 'idle' | 'running' | 'completed' | 'error'
  duration?: string
  tokenCount?: number
  cost?: number
}

const statusConfig = {
  idle: { color: 'bg-muted-foreground', label: 'Idle' },
  running: { color: 'bg-primary animate-pulse', label: 'Running' },
  completed: { color: 'bg-[var(--success)]', label: 'Completed' },
  error: { color: 'bg-destructive', label: 'Error' },
}

function SessionStatusBar({
  className,
  status,
  duration,
  tokenCount,
  cost,
  ...props
}: SessionStatusBarProps) {
  const { color, label } = statusConfig[status]

  return (
    <div
      className={cn(
        'flex h-7 items-center justify-between border-t border-border bg-card px-3 text-[11px] text-muted-foreground',
        className
      )}
      data-slot="session-status-bar"
      {...props}
    >
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1.5">
          <span className={cn('inline-block size-1.5 rounded-full', color)} />
          {label}
        </span>
        {duration && (
          <span className="flex items-center gap-1">
            <Clock className="size-3" />
            {duration}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        {tokenCount !== undefined && (
          <span className="flex items-center gap-1">
            <Zap className="size-3" />
            {tokenCount.toLocaleString()} tokens
          </span>
        )}
        {cost !== undefined && (
          <span className="flex items-center gap-1">
            <Coins className="size-3" />
            ${cost.toFixed(2)}
          </span>
        )}
      </div>
    </div>
  )
}

export { SessionStatusBar }
export type { SessionStatusBarProps }
