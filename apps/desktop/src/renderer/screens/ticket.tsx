import { useState } from 'react'
import { SplitPane, SplitPanePanel, SplitPaneHandle, Spinner } from '@agent-coding/ui'
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
        <div className="h-full overflow-auto">
          {/* Ticket header */}
          <div className="border-b border-border p-4">
            <div className="mb-1 flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{ticket.key}</span>
              <span className={`text-[10px] font-medium uppercase ${TYPE_COLORS[ticket.type]} rounded px-1.5 py-0.5`}>
                {ticket.type}
              </span>
              <span className="text-xs text-muted-foreground">
                {ticket.status.replace('_', ' ')}
              </span>
            </div>
            <h2 className="text-base font-semibold">{ticket.title}</h2>
            {ticket.description && (
              <p className="mt-2 text-sm text-muted-foreground">{ticket.description}</p>
            )}
            <div className="mt-3 text-xs text-muted-foreground">
              Workflow: {completedCount}/{ticket.steps.length} steps completed
            </div>
          </div>

          {/* DAG */}
          <div className="border-b border-border">
            <div className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Workflow
            </div>
            <WorkflowDAG
              steps={ticket.steps}
              selectedStepId={selectedStepId ?? undefined}
              onSelectStep={setSelectedStepId}
            />
          </div>
        </div>
      </SplitPanePanel>

      <SplitPaneHandle />

      <SplitPanePanel defaultSize={35} minSize={25}>
        {selectedStep ? (
          <StepInspector step={selectedStep} />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Select a step to inspect
          </div>
        )}
      </SplitPanePanel>
    </SplitPane>
  )
}
