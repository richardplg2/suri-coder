import { useState, useEffect } from 'react'
import { Button, Input, Label, Textarea, Separator, ScrollArea } from '@agent-coding/ui'
import { useUpdateProject } from 'renderer/hooks/queries/use-projects'
import { useModalStore } from 'renderer/stores/use-modal-store'
import type { Project } from 'renderer/types/api'

interface ProjectSettingsProps {
  project: Project
}

export function ProjectSettings({ project }: ProjectSettingsProps) {
  const updateProject = useUpdateProject(project.id)
  const { open } = useModalStore()

  const [name, setName] = useState(project.name)
  const [path, setPath] = useState(project.path)
  const [repoUrl, setRepoUrl] = useState(project.repo_url ?? '')
  const [description, setDescription] = useState(project.description ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setName(project.name)
    setPath(project.path)
    setRepoUrl(project.repo_url ?? '')
    setDescription(project.description ?? '')
  }, [project])

  const isDirty =
    name !== project.name ||
    path !== project.path ||
    repoUrl !== (project.repo_url ?? '') ||
    description !== (project.description ?? '')

  async function handleSave() {
    setError(null)
    setSaved(false)
    try {
      await updateProject.mutateAsync({
        name: name.trim(),
        path: path.trim(),
        repo_url: repoUrl.trim() || undefined,
        description: description.trim() || undefined,
      })
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes')
    }
  }

  return (
    <ScrollArea className="h-full">
      <div className="mx-auto max-w-lg p-6 space-y-6">
        <h2 className="text-base font-semibold">Project Settings</h2>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-label">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-label">Slug</Label>
            <Input value={project.slug} disabled className="opacity-60" />
            <p className="text-caption text-muted-foreground">Slug cannot be changed after creation.</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-label">Path</Label>
            <Input value={path} onChange={(e) => setPath(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-label">Repo URL</Label>
            <Input value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-label">Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>

          {error && <p className="text-[13px] text-destructive">{error}</p>}
          {saved && <p className="text-[13px] text-[var(--success)]">Changes saved.</p>}
          <Button onClick={handleSave} disabled={!isDirty || updateProject.isPending}>
            Save Changes
          </Button>
        </div>

        <Separator />

        <div className="space-y-3">
          <h3 className="text-[13px] font-semibold text-destructive">Danger Zone</h3>
          <p className="text-caption text-muted-foreground">
            Deleting this project will remove all tickets, workflows, and sessions.
          </p>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => open('delete-project', { projectId: project.id, projectName: project.name })}
          >
            Delete Project
          </Button>
        </div>
      </div>
    </ScrollArea>
  )
}
