import * as React from 'react'
import { Group, Panel, Separator, type GroupProps, type PanelProps, type SeparatorProps } from 'react-resizable-panels'

import { cn } from '@/lib/utils'

interface SplitPaneProps extends GroupProps {
  children: React.ReactNode
}

function SplitPane({ className, ...props }: SplitPaneProps) {
  return (
    <Group
      className={cn('flex h-full', className)}
      data-slot="split-pane"
      {...props}
    />
  )
}

interface SplitPanePanelProps extends PanelProps {
  children: React.ReactNode
}

function SplitPanePanel({ className, ...props }: SplitPanePanelProps) {
  return <Panel className={cn('overflow-auto', className)} {...props} />
}

interface SplitPaneHandleProps extends SeparatorProps {}

function SplitPaneHandle({ className, ...props }: SplitPaneHandleProps) {
  return (
    <Separator
      className={cn(
        'relative flex w-px items-center justify-center bg-border transition-colors duration-150',
        'after:absolute after:inset-y-0 after:-left-0.5 after:-right-0.5 after:cursor-col-resize',
        'data-[resize-handle-active]:bg-primary',
        'hover:bg-primary/50',
        // Vertical variant styles
        'data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full',
        'data-[panel-group-direction=vertical]:after:inset-x-0 data-[panel-group-direction=vertical]:after:-top-0.5 data-[panel-group-direction=vertical]:after:-bottom-0.5 data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:right-0 data-[panel-group-direction=vertical]:after:cursor-row-resize',
        className
      )}
      data-slot="split-pane-handle"
      {...props}
    />
  )
}

export { SplitPane, SplitPanePanel, SplitPaneHandle }
export type { SplitPaneProps, SplitPanePanelProps, SplitPaneHandleProps }
