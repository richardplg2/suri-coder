import { Button } from '@agent-coding/ui'
import { cn } from '@agent-coding/ui'
import { LayoutGrid, Maximize2 } from 'lucide-react'

interface ViewModeToggleProps {
  readonly viewMode: 'grid' | 'detail'
  readonly onChangeMode: (mode: 'grid' | 'detail') => void
  readonly disabled?: boolean
}

export function ViewModeToggle({
  viewMode,
  onChangeMode,
  disabled,
}: ViewModeToggleProps) {
  return (
    <div className="inline-flex items-center rounded-md border border-border bg-surface p-0.5">
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={disabled}
        onClick={() => onChangeMode('grid')}
        className={cn(
          'size-7 cursor-pointer transition-colors duration-150',
          viewMode === 'grid' && 'bg-accent text-accent-foreground',
        )}
      >
        <LayoutGrid className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={disabled}
        onClick={() => onChangeMode('detail')}
        className={cn(
          'size-7 cursor-pointer transition-colors duration-150',
          viewMode === 'detail' && 'bg-accent text-accent-foreground',
        )}
      >
        <Maximize2 className="size-3.5" />
      </Button>
    </div>
  )
}
