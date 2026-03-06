import * as React from 'react'

import { cn } from '@/lib/utils'

interface PanelProps extends React.ComponentProps<'div'> {
  children: React.ReactNode
}

function PanelRoot({ className, ...props }: PanelProps) {
  return (
    <div
      className={cn('flex h-full flex-col overflow-hidden', className)}
      data-slot="panel"
      {...props}
    />
  )
}

interface PanelHeaderProps extends React.ComponentProps<'div'> {
  children: React.ReactNode
}

function PanelHeader({ className, ...props }: PanelHeaderProps) {
  return (
    <div
      className={cn(
        'flex h-9 shrink-0 items-center justify-between border-b border-border px-3',
        className
      )}
      data-slot="panel-header"
      {...props}
    />
  )
}

function PanelTitle({ className, ...props }: React.ComponentProps<'h3'>) {
  return (
    <h3
      className={cn('text-[11px] font-semibold uppercase tracking-wide text-muted-foreground', className)}
      data-slot="panel-title"
      {...props}
    />
  )
}

function PanelActions({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('flex items-center gap-1', className)}
      data-slot="panel-actions"
      {...props}
    />
  )
}

function PanelContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('flex-1 overflow-auto', className)}
      data-slot="panel-content"
      {...props}
    />
  )
}

const Panel = Object.assign(PanelRoot, {
  Header: PanelHeader,
  Title: PanelTitle,
  Actions: PanelActions,
  Content: PanelContent,
})

export { Panel, PanelHeader, PanelTitle, PanelActions, PanelContent }
export type { PanelProps, PanelHeaderProps }
