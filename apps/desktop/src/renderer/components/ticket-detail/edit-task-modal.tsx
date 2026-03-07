import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@agent-coding/ui'
import type { WorkflowStep, Ticket } from 'renderer/types/api'

interface EditTaskModalProps {
  step: WorkflowStep
  ticket: Ticket
  projectId: string
  onClose: () => void
}

export function EditTaskModal({ step, onClose }: EditTaskModalProps) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Task: {step.name}</DialogTitle>
        </DialogHeader>
        <div className="text-[13px] text-muted-foreground">Edit task form coming soon.</div>
      </DialogContent>
    </Dialog>
  )
}
