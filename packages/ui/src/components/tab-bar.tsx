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
    <div
      className={cn(
        'flex h-9 items-center gap-0 border-b border-border bg-card',
        className
      )}
      role="tablist"
      data-slot="tab-bar"
      {...props}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          type="button"
          aria-selected={activeTab === tab.id}
          onClick={() => onTabChange(tab.id)}
          className={cn(
            'group relative flex h-full cursor-pointer items-center gap-1.5 border-r border-border px-3 text-[13px] transition-colors duration-150',
            activeTab === tab.id
              ? 'bg-background text-foreground'
              : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
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
              className="ml-1 rounded-sm p-0.5 opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
              aria-label={`Close ${tab.label}`}
            >
              <X className="size-3" />
            </span>
          )}
          {activeTab === tab.id && (
            <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" />
          )}
        </button>
      ))}
      {onNewTab && (
        <button
          type="button"
          onClick={onNewTab}
          className="flex h-full cursor-pointer items-center px-2 text-muted-foreground transition-colors duration-150 hover:text-foreground"
          aria-label="New tab"
        >
          <Plus className="size-4" />
        </button>
      )}
    </div>
  )
}

export { TabBar }
export type { TabBarProps, Tab }
