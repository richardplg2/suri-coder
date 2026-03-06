import * as React from 'react'
import { useState } from 'react'
import { ChevronDown, Terminal } from 'lucide-react'

import { cn } from '@/lib/utils'

interface ToolCallCardProps extends React.ComponentProps<'div'> {
  toolName: string
  toolIcon?: React.ReactNode
  params?: Record<string, unknown>
  result?: string
  status?: 'running' | 'completed' | 'error'
  defaultExpanded?: boolean
}

function ToolCallCard({
  className,
  toolName,
  toolIcon,
  params,
  result,
  status = 'completed',
  defaultExpanded = false,
  ...props
}: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  return (
    <div
      className={cn(
        'rounded-md border border-border bg-card text-[12px] transition-colors',
        status === 'running' && 'border-primary/30',
        status === 'error' && 'border-destructive/30',
        className
      )}
      data-slot="tool-call-card"
      {...props}
    >
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left"
      >
        <span className="shrink-0 text-muted-foreground">
          {toolIcon ?? <Terminal className="size-3.5" />}
        </span>
        <span className="flex-1 truncate font-medium font-mono text-foreground">
          {toolName}
        </span>
        {status === 'running' && (
          <span className="size-2 shrink-0 animate-pulse rounded-full bg-primary" />
        )}
        <ChevronDown
          className={cn(
            'size-3.5 shrink-0 text-muted-foreground transition-transform duration-150',
            expanded && 'rotate-180'
          )}
        />
      </button>
      {expanded && (
        <div className="space-y-2 border-t border-border px-3 py-2">
          {params && Object.keys(params).length > 0 && (
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Parameters
              </p>
              <pre className="overflow-x-auto rounded bg-muted p-2 font-mono text-[11px] text-foreground">
                {JSON.stringify(params, null, 2)}
              </pre>
            </div>
          )}
          {result && (
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Result
              </p>
              <pre className="max-h-48 overflow-auto rounded bg-muted p-2 font-mono text-[11px] text-foreground">
                {result}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export { ToolCallCard }
export type { ToolCallCardProps }
