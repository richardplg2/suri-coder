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
