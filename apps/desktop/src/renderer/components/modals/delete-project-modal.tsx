import { useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
  Button, Input, Label,
} from '@agent-coding/ui'
import { useModalStore } from 'renderer/stores/use-modal-store'
import { useDeleteProject } from 'renderer/hooks/queries/use-projects'
import { useProjectNavStore } from 'renderer/stores/use-project-nav-store'

export function DeleteProjectModal() {
  const { activeModal, modalData, close } = useModalStore()
  const deleteProject = useDeleteProject()
  const { activeProjectId, setActiveProject } = useProjectNavStore()

  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)

  const isOpen = activeModal === 'delete-project'
  const projectId = modalData?.projectId as string | undefined
  const projectName = modalData?.projectName as string | undefined

  async function handleDelete() {
    if (!projectId || confirm !== projectName) return
    setError(null)
    try {
      await deleteProject.mutateAsync(projectId)
      // If we deleted the active project, go back to home
      if (activeProjectId === projectId) {
        setActiveProject(null)
      }
      close()
      setConfirm('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete project')
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) { close(); setConfirm('') } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete Project</DialogTitle>
          <DialogDescription>
            This action cannot be undone. Type <span className="font-semibold">{projectName}</span> to confirm.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="confirm-name">Project name</Label>
          <Input
            id="confirm-name"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={projectName}
            autoFocus
          />
        </div>
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => { close(); setConfirm('') }}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={confirm !== projectName || deleteProject.isPending}
            onClick={handleDelete}
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
