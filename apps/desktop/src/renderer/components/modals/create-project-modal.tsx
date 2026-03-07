import { useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  Button, Input, Label, Textarea,
} from '@agent-coding/ui'
import { useModalStore } from 'renderer/stores/use-modal-store'
import { useCreateProject } from 'renderer/hooks/queries/use-projects'
import { useTabStore } from 'renderer/stores/use-tab-store'

function slugify(name: string): string {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 10)
}

export function CreateProjectModal() {
  const { activeModal, close } = useModalStore()
  const createProject = useCreateProject()
  const { openProjectTab } = useTabStore()

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [path, setPath] = useState('')
  const [repoUrl, setRepoUrl] = useState('')
  const [description, setDescription] = useState('')
  const [slugManual, setSlugManual] = useState(false)

  const isOpen = activeModal === 'create-project'

  function reset() {
    setName('')
    setSlug('')
    setPath('')
    setRepoUrl('')
    setDescription('')
    setSlugManual(false)
  }

  function handleNameChange(value: string) {
    setName(value)
    if (!slugManual) setSlug(slugify(value))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!name.trim() || !slug.trim() || !path.trim()) return

    const project = await createProject.mutateAsync({
      name: name.trim(),
      slug: slug.trim(),
      path: path.trim(),
      repo_url: repoUrl.trim() || undefined,
      description: description.trim() || undefined,
    })
    close()
    reset()
    openProjectTab(project.id, project.name)
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) { close(); reset() } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="project-name">Name</Label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="My Project"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-slug">Slug (ticket prefix)</Label>
            <Input
              id="project-slug"
              value={slug}
              onChange={(e) => { setSlug(e.target.value.toUpperCase()); setSlugManual(true) }}
              placeholder="PROJ"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-path">Path</Label>
            <Input
              id="project-path"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="/home/user/projects/my-project"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-repo">Repo URL (optional)</Label>
            <Input
              id="project-repo"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-desc">Description (optional)</Label>
            <Textarea
              id="project-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { close(); reset() }}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || !slug.trim() || !path.trim() || createProject.isPending}>
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
