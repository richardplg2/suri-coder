import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const statusBadgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      status: {
        running: 'bg-primary/10 text-primary',
        passed: 'bg-[var(--success)]/10 text-[var(--success)]',
        failed: 'bg-destructive/10 text-destructive',
        pending: 'bg-muted text-muted-foreground',
        warning: 'bg-[var(--warning)]/10 text-[var(--warning)]',
        idle: 'bg-muted text-muted-foreground',
        connected: 'bg-[var(--success)]/10 text-[var(--success)]',
        disconnected: 'bg-destructive/10 text-destructive',
      },
    },
    defaultVariants: {
      status: 'idle',
    },
  }
)

const dotColorMap: Record<string, string> = {
  running: 'bg-primary',
  passed: 'bg-[var(--success)]',
  failed: 'bg-destructive',
  pending: 'bg-muted-foreground',
  warning: 'bg-[var(--warning)]',
  idle: 'bg-muted-foreground',
  connected: 'bg-[var(--success)]',
  disconnected: 'bg-destructive',
}

interface StatusBadgeProps
  extends React.ComponentProps<'span'>,
    VariantProps<typeof statusBadgeVariants> {
  showDot?: boolean
}

function StatusBadge({
  className,
  status = 'idle',
  showDot = true,
  children,
  ...props
}: StatusBadgeProps) {
  return (
    <span
      className={cn(statusBadgeVariants({ status }), className)}
      data-slot="status-badge"
      {...props}
    >
      {showDot && (
        <span
          className={cn('h-1.5 w-1.5 rounded-full', dotColorMap[status ?? 'idle'])}
          aria-hidden
        />
      )}
      {children ?? status}
    </span>
  )
}

export { StatusBadge, statusBadgeVariants }
export type { StatusBadgeProps }
