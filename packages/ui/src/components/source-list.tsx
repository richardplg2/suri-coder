import * as React from 'react'
import { ChevronRight } from 'lucide-react'

import { cn } from '@/lib/utils'

interface SourceListItem {
  id: string
  label: string
  icon?: React.ReactNode
  badge?: React.ReactNode
  children?: SourceListItem[]
}

interface SourceListProps extends Omit<React.ComponentProps<'div'>, 'onSelect'> {
  items: SourceListItem[]
  selectedId?: string
  onSelect?: (id: string) => void
  expandedIds?: Set<string>
  onToggleExpand?: (id: string) => void
}

function SourceListRow({
  item,
  depth,
  selectedId,
  onSelect,
  expandedIds,
  onToggleExpand,
}: {
  item: SourceListItem
  depth: number
  selectedId?: string
  onSelect?: (id: string) => void
  expandedIds?: Set<string>
  onToggleExpand?: (id: string) => void
}) {
  const hasChildren = item.children && item.children.length > 0
  const isExpanded = expandedIds?.has(item.id) ?? false
  const isSelected = selectedId === item.id

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (hasChildren) onToggleExpand?.(item.id)
          onSelect?.(item.id)
        }}
        className={cn(
          'flex w-full cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-[13px] transition-colors duration-150',
          isSelected
            ? 'bg-[var(--selection)] text-primary'
            : 'text-foreground hover:bg-secondary'
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {hasChildren && (
          <ChevronRight
            className={cn(
              'size-3.5 shrink-0 text-muted-foreground transition-transform duration-150',
              isExpanded && 'rotate-90'
            )}
          />
        )}
        {!hasChildren && <span className="w-3.5" />}
        {item.icon && <span className="shrink-0">{item.icon}</span>}
        <span className="flex-1 truncate text-left">{item.label}</span>
        {item.badge && <span className="shrink-0">{item.badge}</span>}
      </button>
      {hasChildren && isExpanded &&
        item.children!.map((child) => (
          <SourceListRow
            key={child.id}
            item={child}
            depth={depth + 1}
            selectedId={selectedId}
            onSelect={onSelect}
            expandedIds={expandedIds}
            onToggleExpand={onToggleExpand}
          />
        ))}
    </>
  )
}

function SourceList({
  className,
  items,
  selectedId,
  onSelect,
  expandedIds,
  onToggleExpand,
  ...props
}: SourceListProps) {
  return (
    <div
      className={cn('space-y-0.5 py-1', className)}
      role="tree"
      data-slot="source-list"
      {...props}
    >
      {items.map((item) => (
        <SourceListRow
          key={item.id}
          item={item}
          depth={0}
          selectedId={selectedId}
          onSelect={onSelect}
          expandedIds={expandedIds}
          onToggleExpand={onToggleExpand}
        />
      ))}
    </div>
  )
}

export { SourceList }
export type { SourceListProps, SourceListItem }
