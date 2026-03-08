import { ScrollArea } from '@agent-coding/ui'
import { useTicket } from 'renderer/hooks/queries/use-tickets'
import { WorkflowStepList } from './workflow-step-list'

interface TicketSidebarProps {
  ticketId: string
  projectId: string
}

export function TicketSidebar({ ticketId, projectId }: TicketSidebarProps) {
  const { data: ticket } = useTicket(projectId, ticketId)

  // Find the first active/running step for highlight
  const activeStep = ticket?.steps?.find(
    (s) => s.status === 'running' || s.status === 'ready' || s.status === 'review' || s.status === 'awaiting_approval',
  )

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border/50 px-3 py-2">
        <div className="text-caption text-muted-foreground">{ticket?.key}</div>
        <div className="window-title truncate">{ticket?.title}</div>
      </div>
      <div className="section-header px-3 py-1.5">
        Workflow Steps
      </div>
      <ScrollArea className="flex-1">
        <WorkflowStepList
          steps={ticket?.steps ?? []}
          activeStepId={activeStep?.id}
        />
      </ScrollArea>
    </div>
  )
}
