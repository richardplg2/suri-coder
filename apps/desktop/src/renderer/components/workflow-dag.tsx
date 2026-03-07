import { cn } from '@agent-coding/ui'
import { CheckCircle, Loader2, Circle, XCircle, Eye } from 'lucide-react'
import type { WorkflowStep, StepStatus } from 'renderer/types/api'

const STATUS_COLORS: Record<StepStatus, string> = {
  completed: 'border-green-500 bg-green-500/10',
  running: 'border-blue-500 bg-blue-500/10',
  ready: 'border-gray-400 bg-gray-400/10',
  awaiting_approval: 'border-yellow-500 bg-yellow-500/10',
  review: 'border-yellow-500 bg-yellow-500/10',
  changes_requested: 'border-red-500 bg-red-500/10',
  failed: 'border-red-500 bg-red-500/10',
  pending: 'border-zinc-600 bg-zinc-600/10',
  skipped: 'border-zinc-600 bg-zinc-600/10',
}

const STATUS_ICONS: Record<StepStatus, typeof Circle> = {
  completed: CheckCircle,
  running: Loader2,
  failed: XCircle,
  review: Eye,
  ready: Circle,
  awaiting_approval: Circle,
  changes_requested: XCircle,
  pending: Circle,
  skipped: Circle,
}

const LINE_COLORS: Record<StepStatus, string> = {
  completed: 'bg-green-500',
  running: 'bg-blue-500',
  failed: 'bg-red-500',
  review: 'bg-yellow-500',
  ready: 'bg-zinc-600',
  awaiting_approval: 'bg-zinc-600',
  changes_requested: 'bg-red-500',
  pending: 'bg-zinc-700',
  skipped: 'bg-zinc-700',
}

interface WorkflowDAGProps {
  steps: WorkflowStep[]
  selectedStepId?: string
  onSelectStep: (stepId: string) => void
}

export function WorkflowDAG({ steps, selectedStepId, onSelectStep }: WorkflowDAGProps) {
  const sorted = [...steps].sort((a, b) => a.order - b.order)

  return (
    <div className="flex flex-col items-center gap-0 py-4">
      {sorted.map((step, i) => {
        const Icon = STATUS_ICONS[step.status]
        const isLast = i === sorted.length - 1

        return (
          <div key={step.id} className="flex flex-col items-center">
            <button
              type="button"
              onClick={() => onSelectStep(step.id)}
              className={cn(
                'flex w-56 cursor-pointer items-center gap-2 rounded-lg border-2 px-4 py-2 text-[13px] transition-all',
                STATUS_COLORS[step.status],
                selectedStepId === step.id && 'ring-2 ring-primary ring-offset-1 ring-offset-background'
              )}
            >
              <Icon className={cn('size-4', step.status === 'running' && 'animate-spin')} />
              <span className="truncate">{step.name}</span>
            </button>

            {!isLast && (
              <div className={cn('h-6 w-0.5', LINE_COLORS[step.status])} />
            )}
          </div>
        )
      })}
    </div>
  )
}
