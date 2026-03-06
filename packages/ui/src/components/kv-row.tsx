import * as React from 'react'

import { cn } from '@/lib/utils'

interface KVRowProps extends React.ComponentProps<'div'> {
  label: string
  value: React.ReactNode
}

function KVRow({ className, label, value, ...props }: KVRowProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 py-1.5 text-[12px]',
        className
      )}
      data-slot="kv-row"
      {...props}
    >
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="truncate text-right font-medium text-foreground">{value}</span>
    </div>
  )
}

export { KVRow }
export type { KVRowProps }
