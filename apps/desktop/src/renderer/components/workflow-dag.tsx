import { cn, StatusBadge } from '@agent-coding/ui'
import type { WorkflowStep, StepStatus } from 'renderer/types/api'

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
            'flex items-center gap-2 rounded-[var(--radius-button)] border px-3 py-2 text-[13px] transition-all duration-150 cursor-pointer',
            selectedStepId === step.id
              ? 'border-primary bg-[var(--selection)] text-primary'
              : 'border-border bg-card hover:bg-secondary/50'
          )}
        >
          <StatusBadge status={stepStatusToStatus(step.status)} className="text-[10px] px-1.5 py-0" />
          <span>{step.name}</span>
        </button>
      ))}
    </div>
  )
}
