import { ScrollArea } from '@agent-coding/ui'
import type { Ticket } from 'renderer/types/api'

interface TasksTabProps {
  ticket: Ticket
  projectId: string
}

export function TasksTab({ ticket }: TasksTabProps) {
  return (
    <ScrollArea className="h-full">
      <div className="p-4 text-[13px] text-muted-foreground">Tasks tab</div>
    </ScrollArea>
  )
}
