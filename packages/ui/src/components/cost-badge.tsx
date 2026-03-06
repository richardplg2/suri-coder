import * as React from 'react'
import { DollarSign } from 'lucide-react'

import { cn } from '@/lib/utils'

interface CostBadgeProps extends React.ComponentProps<'span'> {
  amount: number
  currency?: string
}

function CostBadge({ className, amount, currency = '$', ...props }: CostBadgeProps) {
  const formatted = amount < 0.01 ? `<${currency}0.01` : `${currency}${amount.toFixed(2)}`

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground',
        className
      )}
      data-slot="cost-badge"
      {...props}
    >
      <DollarSign className="size-3" />
      {formatted}
    </span>
  )
}

export { CostBadge }
export type { CostBadgeProps }
