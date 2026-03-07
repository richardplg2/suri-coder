import { useState } from 'react'
import { SplitPane, SplitPanePanel, SplitPaneHandle, Spinner, Badge, ScrollArea } from '@agent-coding/ui'
import { useTicket } from 'renderer/hooks/queries/use-tickets'
import { WorkflowDAG } from 'renderer/components/workflow-dag'
import { StepInspector } from 'renderer/components/step-inspector'
import type { TicketType } from 'renderer/types/api'

const TYPE_COLORS: Record<TicketType, string> = {
  feature: 'bg-blue-500/15 text-blue-400',
  bug: 'bg-red-500/15 text-red-400',
  improvement: 'bg-green-500/15 text-green-400',
  chore: 'bg-zinc-500/15 text-zinc-400',
  spike: 'bg-purple-500/15 text-purple-400',
}

interface TicketScreenProps {
  ticketId: string
  projectId: string
}

export function TicketScreen({ ticketId, projectId }: TicketScreenProps) {
  const { data: ticket, isLoading } = useTicket(projectId, ticketId)
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null)

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner label="Loading ticket..." />
      </div>
    )
  }

  if (!ticket) {
    return <div className="p-6 text-muted-foreground">Ticket not found</div>
  }

  const selectedStep = ticket.steps.find((s) => s.id === selectedStepId)
  const completedCount = ticket.steps.filter((s) => s.status === 'completed').length

  return (
    <SplitPane orientation="horizontal" className="h-full">
      <SplitPanePanel defaultSize={65} minSize={40}>
        <ScrollArea className="h-full">
          {/* Ticket header */}
          <div className="border-b border-border p-4">
            <div className="mb-1.5 flex items-center gap-2">
              <span className="text-caption text-muted-foreground">{ticket.key}</span>
              <Badge className={`text-[10px] px-1.5 py-0 font-medium uppercase ${TYPE_COLORS[ticket.type]}`}>
                {ticket.type}
              </Badge>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {ticket.status.replace('_', ' ')}
              </Badge>
            </div>
            <h2 className="text-base font-semibold">{ticket.title}</h2>
            {ticket.description && (
              <p className="mt-2 text-[13px] text-muted-foreground">{ticket.description}</p>
            )}
            <div className="mt-3 text-caption text-muted-foreground">
              Workflow: {completedCount}/{ticket.steps.length} steps completed
            </div>
          </div>

          {/* DAG */}
          <div className="border-b border-border">
            <div className="section-header px-4 py-2">
              Workflow
            </div>
            <WorkflowDAG
              steps={ticket.steps}
              selectedStepId={selectedStepId ?? undefined}
              onSelectStep={setSelectedStepId}
            />
          </div>
        </ScrollArea>
      </SplitPanePanel>

      <SplitPaneHandle />

      <SplitPanePanel defaultSize={35} minSize={25}>
        {selectedStep ? (
          <StepInspector step={selectedStep} />
        ) : (
          <div className="flex h-full items-center justify-center text-[13px] text-muted-foreground">
            Select a step to inspect
          </div>
        )}
      </SplitPanePanel>
    </SplitPane>
  )
}
