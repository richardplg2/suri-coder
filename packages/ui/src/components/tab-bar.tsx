import * as React from 'react'
import { Plus, X } from 'lucide-react'

import { cn } from '@/lib/utils'

interface Tab {
  id: string
  label: string
  icon?: React.ReactNode
  closable?: boolean
}

interface TabBarProps extends React.ComponentProps<'div'> {
  tabs: Tab[]
  activeTab: string
  onTabChange: (id: string) => void
  onTabClose?: (id: string) => void
  onNewTab?: () => void
}

function TabBar({
  className,
  tabs,
  activeTab,
  onTabChange,
  onTabClose,
  onNewTab,
  ...props
}: TabBarProps) {
  return (
    <nav
      className={cn(
        'flex items-center bg-background/50 rounded-lg p-0.5 border border-border',
        className
      )}
      role="tablist"
      data-slot="tab-bar"
      {...props}
    >
      {tabs.map((tab, index) => {
        const isActive = activeTab === tab.id
        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={isActive}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'group relative flex items-center gap-1.5 px-4 py-1 text-xs font-medium rounded-md transition-colors duration-150',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground',
              !isActive && index > 0 && 'border-l border-border rounded-none' // border separator if needed
            )}
          >
            {tab.icon}
            <span className="max-w-[120px] truncate">{tab.label}</span>
            {tab.closable !== false && onTabClose && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation()
                  onTabClose(tab.id)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.stopPropagation()
                    onTabClose(tab.id)
                  }
                }}
                className={cn(
                  'ml-1 cursor-pointer rounded-sm p-0.5 opacity-0 transition-opacity hover:opacity-100',
                  isActive ? 'hover:bg-primary/80' : 'hover:bg-secondary'
                )}
                aria-label={`Close ${tab.label}`}
              >
                <X className="size-3" />
              </span>
            )}
          </button>
        )
      })}
      {onNewTab && (
        <button
          type="button"
          onClick={onNewTab}
          className="flex h-full cursor-pointer items-center px-4 py-1 text-muted-foreground transition-colors duration-150 hover:text-foreground border-l border-border"
          aria-label="New tab"
        >
          <Plus className="size-3.5" />
        </button>
      )}
    </nav>
  )
}

export { TabBar }
export type { TabBarProps, Tab }
