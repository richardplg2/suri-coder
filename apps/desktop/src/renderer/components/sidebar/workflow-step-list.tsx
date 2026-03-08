import type { WorkflowStep } from 'renderer/types/api'
import { WorkflowStepItem } from './workflow-step-item'

interface WorkflowStepListProps {
  steps: WorkflowStep[]
  activeStepId?: string
  onClickStep?: (stepId: string) => void
  onClickSession?: (sessionId: string) => void
}

export function WorkflowStepList({
  steps,
  activeStepId,
  onClickStep,
  onClickSession,
}: WorkflowStepListProps) {
  const sorted = [...steps].sort((a, b) => a.order - b.order)

  return (
    <div className="space-y-0.5 px-2">
      {sorted.map((step) => (
        <WorkflowStepItem
          key={step.id}
          name={step.name}
          status={step.status}
          isActive={step.id === activeStepId}
          sessions={[]}
          onClickStep={() => onClickStep?.(step.id)}
          onClickSession={onClickSession}
        />
      ))}
    </div>
  )
}
