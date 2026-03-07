import { useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  Button, Input, Textarea, Label,
} from '@agent-coding/ui'
import type { WorkflowStep, Ticket } from 'renderer/types/api'

interface EditTaskModalProps {
  step: WorkflowStep
  ticket: Ticket
  projectId: string
  onClose: () => void
}

export function EditTaskModal({ step, ticket, projectId, onClose }: EditTaskModalProps) {
  const [name, setName] = useState(step.name)
  const [description, setDescription] = useState(step.description ?? '')
  const [requiresApproval, setRequiresApproval] = useState(step.requires_approval ?? false)

  const otherSteps = ticket.steps.filter((s) => s.id !== step.id)

  const handleSave = () => {
    // TODO: wire up useUpdateStep mutation once available
    onClose()
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Task: {step.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
          </div>

          <div>
            <Label>Agent</Label>
            <select className="w-full rounded-md border border-border bg-background px-3 py-2 text-[13px]">
              <option value="">Select agent...</option>
            </select>
          </div>

          <div>
            <Label>Repository</Label>
            <select className="w-full rounded-md border border-border bg-background px-3 py-2 text-[13px]">
              <option value="">Select repo...</option>
            </select>
          </div>

          <div>
            <Label>Dependencies</Label>
            <div className="mt-1 space-y-1">
              {otherSteps.map((s) => (
                <label key={s.id} className="flex cursor-pointer items-center gap-2 text-[13px]">
                  <input type="checkbox" className="accent-primary" />
                  {s.name}
                </label>
              ))}
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={requiresApproval}
              onChange={(e) => setRequiresApproval(e.target.checked)}
              className="accent-primary"
            />
            <span className="text-[13px]">Requires approval before running</span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
