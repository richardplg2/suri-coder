import { Folder } from 'lucide-react'
import { ScrollArea, SearchField, SourceList } from '@agent-coding/ui'
import type { SourceListItem } from '@agent-coding/ui'
import { useProjects } from 'renderer/hooks/queries/use-projects'
import { useProjectNavStore } from 'renderer/stores/use-project-nav-store'
import { useState } from 'react'

export function HomeSidebar() {
  const { data: projects } = useProjects()
  const { setActiveProject } = useProjectNavStore()
  const [search, setSearch] = useState('')

  const filtered = (projects ?? []).filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  const items: SourceListItem[] = filtered.map((p) => ({
    id: p.id,
    label: p.name,
    icon: <Folder className="size-4 text-muted-foreground" />,
  }))

  return (
    <div className="flex h-full flex-col">
      <div className="p-2">
        <SearchField
          placeholder="Filter projects..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClear={() => setSearch('')}
        />
      </div>
      <div className="section-header px-3 py-1.5">
        All Projects
      </div>
      <ScrollArea className="flex-1">
        <SourceList
          items={items}
          onSelect={(id) => setActiveProject(id)}
        />
      </ScrollArea>
    </div>
  )
}
