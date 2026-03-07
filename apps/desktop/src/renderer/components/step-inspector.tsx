import { Button, KVRow, Separator, StatusBadge } from '@agent-coding/ui'
import type { WorkflowStep, StepStatus } from 'renderer/types/api'

function stepStatusToStatus(status: StepStatus) {
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

interface StepInspectorProps {
  step: WorkflowStep
}

export function StepInspector({ step }: StepInspectorProps) {
  return (
    <div className="space-y-4 p-4">
      <div>
        <h3 className="text-sm font-semibold">{step.name}</h3>
        {step.description && (
          <p className="mt-1 text-xs text-muted-foreground">{step.description}</p>
        )}
      </div>

      <div className="space-y-1">
        <KVRow label="Status" value={<StatusBadge status={stepStatusToStatus(step.status)}>{step.status}</StatusBadge>} />
        <KVRow label="Order" value={step.order} />
        <KVRow label="Step ID" value={step.template_step_id} />
      </div>

      <Separator />

      <div className="flex gap-2">
        <Button size="sm" variant="outline" disabled={step.status !== 'ready'}>
          Run
        </Button>
        <Button size="sm" variant="outline" disabled={step.status === 'completed'}>
          Skip
        </Button>
        <Button size="sm" variant="outline" disabled={step.status !== 'failed'}>
          Retry
        </Button>
      </div>
    </div>
  )
}
