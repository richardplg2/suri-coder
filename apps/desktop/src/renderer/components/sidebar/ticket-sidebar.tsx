import { ScrollArea, SourceList, StatusBadge } from '@agent-coding/ui'
import type { SourceListItem } from '@agent-coding/ui'
import { useTicket } from 'renderer/hooks/queries/use-tickets'
import type { StepStatus } from 'renderer/types/api'

function stepStatusVariant(status: StepStatus) {
  const map: Record<StepStatus, 'passed' | 'running' | 'failed' | 'pending' | 'idle'> = {
    completed: 'passed',
    running: 'running',
    failed: 'failed',
    ready: 'pending',
    pending: 'idle',
    skipped: 'idle',
  }
  return map[status]
}

interface TicketSidebarProps {
  ticketId: string
  projectId: string
}

export function TicketSidebar({ ticketId, projectId }: TicketSidebarProps) {
  const { data: ticket } = useTicket(projectId, ticketId)

  const stepItems: SourceListItem[] = (ticket?.steps ?? []).map((step) => ({
    id: step.id,
    label: step.name,
    badge: <StatusBadge status={stepStatusVariant(step.status)} className="text-[10px] px-1.5 py-0" />,
  }))

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-3 py-2">
        <div className="text-caption text-muted-foreground">{ticket?.key}</div>
        <div className="window-title truncate">{ticket?.title}</div>
      </div>
      <div className="section-header px-3 py-1.5">
        Workflow
      </div>
      <ScrollArea className="flex-1">
        <SourceList items={stepItems} />
      </ScrollArea>
    </div>
  )
}
