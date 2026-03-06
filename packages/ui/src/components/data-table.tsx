import * as React from 'react'

import { cn } from '@/lib/utils'

interface Column<T> {
  key: string
  header: string
  width?: string
  render?: (item: T, index: number) => React.ReactNode
  className?: string
}

interface DataTableProps<T> extends React.ComponentProps<'div'> {
  columns: Column<T>[]
  data: T[]
  rowKey: (item: T) => string
  selectedKey?: string
  onRowClick?: (item: T) => void
  emptyState?: React.ReactNode
}

function DataTable<T>({
  className,
  columns,
  data,
  rowKey,
  selectedKey,
  onRowClick,
  emptyState,
  ...props
}: DataTableProps<T>) {
  if (data.length === 0 && emptyState) {
    return <>{emptyState}</>
  }

  return (
    <div className={cn('w-full overflow-auto', className)} data-slot="data-table" {...props}>
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-border">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  'h-8 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground',
                  col.className
                )}
                style={col.width ? { width: col.width } : undefined}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item, index) => {
            const key = rowKey(item)
            const isSelected = selectedKey === key
            return (
              <tr
                key={key}
                onClick={() => onRowClick?.(item)}
                className={cn(
                  'h-8 border-b border-border transition-colors duration-150',
                  isSelected
                    ? 'bg-[var(--selection)]'
                    : 'even:bg-[rgba(255,255,255,0.02)] hover:bg-secondary',
                  onRowClick && 'cursor-pointer'
                )}
              >
                {columns.map((col) => (
                  <td key={col.key} className={cn('px-3', col.className)}>
                    {col.render
                      ? col.render(item, index)
                      : String((item as Record<string, unknown>)[col.key] ?? '')}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export { DataTable }
export type { DataTableProps, Column }
