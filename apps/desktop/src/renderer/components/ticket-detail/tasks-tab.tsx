import { useState } from 'react'
import { ScrollArea, Button, StatusBadge, Separator } from '@agent-coding/ui'
import { Play, Pencil, RotateCcw } from 'lucide-react'
import { WorkflowDAG } from 'renderer/components/workflow-dag'
import { EditTaskModal } from 'renderer/components/ticket-detail/edit-task-modal'
import { useRunStep, useRetryStep, useRunTicketWorkflow } from 'renderer/hooks/queries/use-workflow-actions'
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
  const runStep = useRunStep(projectId, ticket.id)
  const retryStep = useRetryStep(projectId, ticket.id)
  const runWorkflow = useRunTicketWorkflow(projectId, ticket.id)

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
            <div
              key={step.id}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 ${
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
            </div>
          ))}
        </div>
      </div>

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
