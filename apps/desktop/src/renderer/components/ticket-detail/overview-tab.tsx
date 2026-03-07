import { ScrollArea } from '@agent-coding/ui'
import type { Ticket } from 'renderer/types/api'

interface OverviewTabProps {
  ticket: Ticket
  projectId: string
}

export function OverviewTab({ ticket }: OverviewTabProps) {
  return (
    <ScrollArea className="h-full">
      <div className="p-4 text-[13px] text-muted-foreground">Overview tab</div>
    </ScrollArea>
  )
}
