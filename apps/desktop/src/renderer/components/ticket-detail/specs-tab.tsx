import { ScrollArea } from '@agent-coding/ui'
import type { Ticket } from 'renderer/types/api'

interface SpecsTabProps {
  ticket: Ticket
  projectId: string
}

export function SpecsTab({ ticket }: SpecsTabProps) {
  return (
    <ScrollArea className="h-full">
      <div className="p-4 text-[13px] text-muted-foreground">Specs tab</div>
    </ScrollArea>
  )
}
