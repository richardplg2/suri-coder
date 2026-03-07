import { Play, SkipForward, RotateCcw } from 'lucide-react'
import { Button, KVRow, Separator, StatusBadge, ScrollArea } from '@agent-coding/ui'
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
    <ScrollArea className="h-full">
      <div className="space-y-4 p-4">
        <div>
          <h3 className="window-title">{step.name}</h3>
          {step.description && (
            <p className="mt-1 text-caption text-muted-foreground">{step.description}</p>
          )}
        </div>

        <div className="space-y-1">
          <KVRow label="Status" value={<StatusBadge status={stepStatusToStatus(step.status)}>{step.status}</StatusBadge>} />
          <KVRow label="Order" value={step.order} />
          <KVRow label="Step ID" value={<span className="font-mono text-caption">{step.template_step_id}</span>} />
        </div>

        <Separator />

        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={step.status !== 'ready'}>
            <Play className="mr-1.5 size-3.5" />
            Run
          </Button>
          <Button size="sm" variant="outline" disabled={step.status === 'completed'}>
            <SkipForward className="mr-1.5 size-3.5" />
            Skip
          </Button>
          <Button size="sm" variant="outline" disabled={step.status !== 'failed'}>
            <RotateCcw className="mr-1.5 size-3.5" />
            Retry
          </Button>
        </div>
      </div>
    </ScrollArea>
  )
}
