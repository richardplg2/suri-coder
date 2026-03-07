import { useState, useCallback } from 'react'
import { ScrollArea, Button, StatusBadge, Separator } from '@agent-coding/ui'
import { Play, Pencil, RotateCcw, Eye } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { WorkflowDAG } from 'renderer/components/workflow-dag'
import { EditTaskModal } from 'renderer/components/ticket-detail/edit-task-modal'
import { useRunStep, useRetryStep, useRunTicketWorkflow } from 'renderer/hooks/queries/use-workflow-actions'
import { useWsChannel } from 'renderer/hooks/use-ws-channel'
import { WsChannel, WsEvent } from '@agent-coding/shared'
import { ReviewPanel } from 'renderer/components/review/review-panel'
import type { Ticket, WorkflowStep, StepStatus } from 'renderer/types/api'

function stepStatusToStatus(status: StepStatus) {
  const map: Record<StepStatus, 'passed' | 'running' | 'failed' | 'pending' | 'idle'> = {
    completed: 'passed',
    running: 'running',
    failed: 'failed',
    ready: 'pending',
    awaiting_approval: 'pending',
    review: 'pending',
    changes_requested: 'failed',
    pending: 'idle',
    skipped: 'idle',
  }
  return map[status]
}

interface TasksTabProps {
  ticket: Ticket
  projectId: string
}

export function TasksTab({ ticket, projectId }: TasksTabProps) {
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null)
  const [editingStep, setEditingStep] = useState<WorkflowStep | null>(null)
  const [reviewStepId, setReviewStepId] = useState<string | null>(null)
  const [liveOutput, setLiveOutput] = useState<Record<string, string[]>>({})
  const qc = useQueryClient()
  const runStep = useRunStep(projectId, ticket.id)
  const retryStep = useRetryStep(projectId, ticket.id)
  const runWorkflow = useRunTicketWorkflow(projectId, ticket.id)

  const handleWsEvent = useCallback((event: WsEvent, data: unknown) => {
    const payload = (data ?? {}) as { step_id?: string; output_line?: string }

    if (event === WsEvent.StepStarted || event === WsEvent.StepCompleted || event === WsEvent.StepFailed || event === WsEvent.WorkflowCompleted) {
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'tickets', ticket.id] })
    }

    // Future: handle step:output events for live streaming
    if (payload.step_id && payload.output_line) {
      setLiveOutput((prev) => ({
        ...prev,
        [payload.step_id as string]: [...(prev[payload.step_id as string] ?? []), payload.output_line as string],
      }))
    }
  }, [qc, projectId, ticket.id])

  useWsChannel(WsChannel.TicketProgress, { ticket_id: ticket.id }, handleWsEvent)

  const sorted = [...ticket.steps].sort((a, b) => a.order - b.order)

  return (
    <ScrollArea className="h-full">
      <div className="p-4">
        {/* DAG visualization */}
        <div className="mb-4">
          <div className="section-header mb-2">Workflow</div>
          <WorkflowDAG steps={ticket.steps} selectedStepId={selectedStepId ?? undefined} onSelectStep={setSelectedStepId} />
        </div>

        {/* Action bar */}
        <div className="mb-4 flex gap-2">
          <Button size="sm" onClick={() => runWorkflow.mutate()} disabled={runWorkflow.isPending}>
            <Play className="mr-1.5 size-3.5" /> Run All
          </Button>
        </div>

        <Separator />

        {/* Task list */}
        <div className="mt-4 space-y-2">
          {sorted.map((step) => (
            <div key={step.id}>
              <button
                type="button"
                className={`flex w-full cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-left ${
                  selectedStepId === step.id ? 'border-primary bg-[var(--selection)]' : 'border-border bg-card'
                }`}
                onClick={() => setSelectedStepId(step.id)}
              >
                <StatusBadge status={stepStatusToStatus(step.status)} />
                <span className="flex-1 text-[13px] font-medium">{step.name}</span>
                <span className="text-caption text-muted-foreground">{step.status.replace('_', ' ')}</span>
                <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setEditingStep(step) }}>
                  <Pencil className="size-3.5" />
                </Button>
                {step.status === 'ready' && (
                  <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); runStep.mutate(step.id) }}>
                    <Play className="size-3.5" />
                  </Button>
                )}
                {step.status === 'failed' && (
                  <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); retryStep.mutate(step.id) }}>
                    <RotateCcw className="size-3.5" />
                  </Button>
                )}
                {step.status === 'review' && (
                  <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setReviewStepId(step.id) }}>
                    <Eye className="mr-1.5 size-3.5" /> Review
                  </Button>
                )}
              </button>
              {step.status === 'running' && liveOutput[step.id]?.length > 0 && (
                <div className="mt-2 max-h-48 overflow-y-auto rounded border border-border bg-background p-2 font-mono text-[11px]">
                  {liveOutput[step.id].map((line, j) => (
                    <div key={j} className="text-muted-foreground">{line}</div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {reviewStepId && (
        <div className="border-t border-border" style={{ height: '60vh' }}>
          <ReviewPanel
            stepId={reviewStepId}
            ticketId={ticket.id}
            projectId={projectId}
          />
        </div>
      )}

      {editingStep && (
        <EditTaskModal
          step={editingStep}
          ticket={ticket}
          projectId={projectId}
          onClose={() => setEditingStep(null)}
        />
      )}
    </ScrollArea>
  )
}
