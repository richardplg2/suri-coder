# Layout Redesign — Plan 05: Project + Settings Screens

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Simplify ProjectScreen to kanban-only (remove sub-nav switching). Create new consolidated SettingsScreen with all project management sections in a single scrollable page with anchor navigation.

**Architecture:** ProjectScreen becomes a thin wrapper around TicketsBoard. SettingsScreen consolidates General, Repositories, Agents, Templates, GitHub into bento sections with sticky anchor menu. Opens as a tab (SettingsTab) within the project's tab scope.

**Tech Stack:** React, Tailwind CSS, Lucide icons, `@agent-coding/ui` (ScrollArea, SegmentedControl, Button)

**Depends on:** Plan 01 (needs scoped tab store, SettingsTab type)
**Blocks:** Nothing

**Ref:** `docs/plans/2026-03-08-layout-redesign-design.md` §3 (Project View), §5 (Project Settings)

---

## Task 1: Simplify ProjectScreen

**Files:**
- Modify: `apps/desktop/src/renderer/screens/project.tsx`

**Step 1: Rewrite to kanban-only**

Replace the entire file. Remove all sub-nav switching — ProjectScreen now only shows TicketsBoard.

```tsx
import { useProject } from 'renderer/hooks/queries/use-projects'
import { Spinner } from '@agent-coding/ui'
import { TicketsBoard } from './project/tickets-board'

interface ProjectScreenProps {
  projectId: string
}

export function ProjectScreen({ projectId }: ProjectScreenProps) {
  const { data: project, isLoading } = useProject(projectId)

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner label="Loading project..." />
      </div>
    )
  }

  if (!project) {
    return <div className="p-6 text-[13px] text-muted-foreground">Project not found</div>
  }

  return <TicketsBoard project={project} />
}
```

Key changes:
- Removed `useSidebarStore` import and `activeNav` switch
- Removed imports for ProjectSettings, ProjectRepositories, ProjectAgents, GitHubAccounts
- Single return: `<TicketsBoard />`

**Step 2: Commit**

```bash
git add apps/desktop/src/renderer/screens/project.tsx
git commit -m "refactor: simplify project screen to kanban-only (sub-nav moved to settings tab)"
```

---

## Task 2: Create SettingsScreen

**Files:**
- Create: `apps/desktop/src/renderer/screens/settings.tsx`

**Step 1: Write the settings screen**

Consolidated page with all project management sections. Uses intersection observer for active anchor tracking.

```tsx
import { useRef, useState, useEffect } from 'react'
import { ScrollArea } from '@agent-coding/ui'
import { cn } from '@agent-coding/ui'
import { useProject } from 'renderer/hooks/queries/use-projects'
import { Spinner } from '@agent-coding/ui'
import { ProjectSettings } from './project/project-settings'
import { ProjectRepositories } from './project/project-repositories'
import { ProjectAgents } from './project/project-agents'
import { GitHubAccounts } from './settings/github-accounts'

interface SettingsScreenProps {
  projectId: string
}

const SECTIONS = [
  { id: 'general', label: 'General' },
  { id: 'repositories', label: 'Repos' },
  { id: 'agents', label: 'Agents' },
  { id: 'templates', label: 'Templates' },
  { id: 'github', label: 'GitHub' },
] as const

export function SettingsScreen({ projectId }: SettingsScreenProps) {
  const { data: project, isLoading } = useProject(projectId)
  const [activeSection, setActiveSection] = useState<string>('general')
  const scrollRef = useRef<HTMLDivElement>(null)
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({})

  // Intersection observer for active section tracking
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id)
          }
        }
      },
      { rootMargin: '-20% 0px -70% 0px' },
    )

    for (const section of SECTIONS) {
      const el = sectionRefs.current[section.id]
      if (el) observer.observe(el)
    }

    return () => observer.disconnect()
  }, [project])

  const scrollToSection = (sectionId: string) => {
    sectionRefs.current[sectionId]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner label="Loading settings..." />
      </div>
    )
  }

  if (!project) {
    return <div className="p-6 text-[13px] text-muted-foreground">Project not found</div>
  }

  return (
    <div className="flex h-full flex-col">
      {/* Sticky anchor menu */}
      <div className="sticky top-0 z-10 flex items-center gap-1 border-b border-border/50 bg-background/80 backdrop-blur-sm px-6 py-2">
        <h1 className="mr-4 text-sm font-semibold tracking-tight">Project Settings</h1>
        {SECTIONS.map((section) => (
          <button
            key={section.id}
            type="button"
            onClick={() => scrollToSection(section.id)}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs font-medium cursor-pointer transition-colors duration-150',
              activeSection === section.id
                ? 'bg-[var(--selection)] text-[var(--accent)]'
                : 'text-muted-foreground hover:text-foreground hover:bg-[var(--surface-hover)]',
            )}
          >
            {section.label}
          </button>
        ))}
      </div>

      {/* Scrollable content */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="p-6 space-y-10">
          {/* General */}
          <section id="general" ref={(el) => { sectionRefs.current.general = el }}>
            <ProjectSettings project={project} />
          </section>

          {/* Repositories */}
          <section id="repositories" ref={(el) => { sectionRefs.current.repositories = el }}>
            <ProjectRepositories project={project} />
          </section>

          {/* Agents */}
          <section id="agents" ref={(el) => { sectionRefs.current.agents = el }}>
            <ProjectAgents project={project} />
          </section>

          {/* Templates */}
          <section id="templates" ref={(el) => { sectionRefs.current.templates = el }}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-tight uppercase text-muted-foreground">
                Workflow Templates
              </h2>
            </div>
            <div className="bento-cell">
              <p className="text-xs text-muted-foreground">Templates editor — coming soon</p>
            </div>
          </section>

          {/* GitHub */}
          <section id="github" ref={(el) => { sectionRefs.current.github = el }}>
            <GitHubAccounts />
          </section>
        </div>
      </ScrollArea>
    </div>
  )
}
```

Note: This reuses the existing `ProjectSettings`, `ProjectRepositories`, `ProjectAgents`, and `GitHubAccounts` components as-is. Each already has its own section header and bento grid layout. The SettingsScreen just stacks them vertically with anchor navigation.

**Step 2: Commit**

```bash
git add apps/desktop/src/renderer/screens/settings.tsx
git commit -m "feat: add consolidated settings screen with anchor navigation"
```
