import * as React from 'react'
import { Search, X } from 'lucide-react'

import { cn } from '@/lib/utils'

interface SearchFieldProps extends Omit<React.ComponentProps<'input'>, 'type'> {
  onClear?: () => void
  shortcut?: string
}

function SearchField({
  className,
  value,
  onClear,
  shortcut,
  ...props
}: SearchFieldProps) {
  const hasValue = value !== undefined && value !== ''

  return (
    <div className={cn('relative', className)} data-slot="search-field">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <input
        type="search"
        value={value}
        className={cn(
          'h-8 w-full rounded-md border border-input bg-background pl-8 pr-8 text-[13px] text-foreground outline-none transition-colors duration-150',
          'placeholder:text-muted-foreground',
          'focus:border-primary focus:ring-2 focus:ring-ring/20',
          'disabled:cursor-not-allowed disabled:opacity-50',
          '[&::-webkit-search-cancel-button]:hidden'
        )}
        {...props}
      />
      {hasValue && onClear && (
        <button
          type="button"
          onClick={onClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Clear search"
        >
          <X className="size-3" />
        </button>
      )}
      {!hasValue && shortcut && (
        <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
          {shortcut}
        </kbd>
      )}
    </div>
  )
}

export { SearchField }
export type { SearchFieldProps }
