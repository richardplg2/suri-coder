import * as React from 'react'
import { Loader2 } from 'lucide-react'

import { cn } from '@/lib/utils'

interface SpinnerProps extends React.ComponentProps<'div'> {
  size?: 'sm' | 'default' | 'lg'
  label?: string
}

const sizeMap = {
  sm: 'size-3',
  default: 'size-4',
  lg: 'size-6',
}

function Spinner({ className, size = 'default', label, ...props }: SpinnerProps) {
  return (
    <div
      className={cn('inline-flex items-center gap-2 text-muted-foreground', className)}
      role="status"
      data-slot="spinner"
      {...props}
    >
      <Loader2 className={cn('animate-spin', sizeMap[size])} />
      {label && <span className="text-[12px]">{label}</span>}
      {!label && <span className="sr-only">Loading...</span>}
    </div>
  )
}

export { Spinner }
export type { SpinnerProps }
