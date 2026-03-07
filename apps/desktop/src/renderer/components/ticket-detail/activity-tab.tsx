import { ScrollArea } from '@agent-coding/ui'
import type { Ticket } from 'renderer/types/api'

interface ActivityTabProps {
  ticket: Ticket
  projectId: string
}

export function ActivityTab({ ticket }: ActivityTabProps) {
  return (
    <ScrollArea className="h-full">
      <div className="p-4 text-[13px] text-muted-foreground">Activity tab</div>
    </ScrollArea>
  )
}
