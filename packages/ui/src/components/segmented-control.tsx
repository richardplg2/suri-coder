import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const segmentedControlVariants = cva(
  'inline-flex items-center rounded-lg bg-muted p-0.5 text-muted-foreground',
  {
    variants: {
      size: {
        default: 'h-8',
        sm: 'h-7',
        lg: 'h-9',
      },
    },
    defaultVariants: {
      size: 'default',
    },
  }
)

interface SegmentedControlProps
  extends React.ComponentProps<'div'>,
    VariantProps<typeof segmentedControlVariants> {
  value: string
  onValueChange: (value: string) => void
  items: { value: string; label: string; disabled?: boolean }[]
}

function SegmentedControl({
  className,
  size,
  value,
  onValueChange,
  items,
  ...props
}: SegmentedControlProps) {
  return (
    <div
      className={cn(segmentedControlVariants({ size }), className)}
      role="tablist"
      data-slot="segmented-control"
      {...props}
    >
      {items.map((item) => (
        <button
          key={item.value}
          role="tab"
          type="button"
          aria-selected={value === item.value}
          disabled={item.disabled}
          onClick={() => onValueChange(item.value)}
          className={cn(
            'inline-flex cursor-pointer items-center justify-center whitespace-nowrap rounded-md px-3 text-[13px] font-medium transition-all duration-150',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'disabled:pointer-events-none disabled:opacity-50',
            size === 'sm' ? 'h-6 px-2 text-xs' : size === 'lg' ? 'h-7 px-4' : 'h-6.5 px-3',
            value === item.value
              ? 'bg-background text-foreground shadow-sm'
              : 'hover:text-foreground'
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

export { SegmentedControl, segmentedControlVariants }
export type { SegmentedControlProps }
