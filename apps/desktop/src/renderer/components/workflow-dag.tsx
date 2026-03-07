import { cn } from '@agent-coding/ui'
import { StatusBadge } from '@agent-coding/ui'
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

interface WorkflowDAGProps {
  steps: WorkflowStep[]
  selectedStepId?: string
  onSelectStep: (stepId: string) => void
}

export function WorkflowDAG({ steps, selectedStepId, onSelectStep }: WorkflowDAGProps) {
  const sorted = [...steps].sort((a, b) => a.order - b.order)

  return (
    <div className="flex flex-wrap gap-3 p-4">
      {sorted.map((step) => (
        <button
          key={step.id}
          type="button"
          onClick={() => onSelectStep(step.id)}
          className={cn(
            'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
            selectedStepId === step.id
              ? 'border-primary bg-primary/10'
              : 'border-border bg-card hover:bg-secondary/50',
            'cursor-pointer'
          )}
        >
          <StatusBadge status={stepStatusToStatus(step.status)} className="text-[10px] px-1.5 py-0" />
          <span>{step.name}</span>
        </button>
      ))}
    </div>
  )
}
