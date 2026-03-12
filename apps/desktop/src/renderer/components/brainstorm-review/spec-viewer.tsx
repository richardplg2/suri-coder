import { AlertCircle, CheckCircle, List, ClipboardCheck, Code } from 'lucide-react'
import type { BrainstormSpec, SpecSection } from 'renderer/stores/use-brainstorm-store'

const SECTION_ICONS: Record<SpecSection['kind'], { icon: React.ComponentType<{ className?: string }>; color: string }> = {
  problem: { icon: AlertCircle, color: 'text-accent' },
  solution: { icon: CheckCircle, color: 'text-green-400' },
  requirements: { icon: List, color: 'text-blue-400' },
  acceptance_criteria: { icon: ClipboardCheck, color: 'text-amber-400' },
  technical_notes: { icon: Code, color: 'text-purple-400' },
}

interface SpecViewerProps {
  spec: BrainstormSpec
}

export function SpecViewer({ spec }: Readonly<SpecViewerProps>) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto pr-4">
      <div className="rounded-xl border border-border bg-surface p-8">
        {/* Header */}
        <div className="mb-8">
          <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-accent">
            Feature Specification
          </span>
          <h2 className="text-3xl font-black leading-tight">{spec.title}</h2>
          <p className="mt-1 text-muted-foreground">{spec.project}</p>
        </div>

        {/* Sections */}
        {spec.sections.map((section) => (
          <SpecSectionBlock key={section.id} section={section} />
        ))}
      </div>
    </div>
  )
}

function SpecSectionBlock({ section }: Readonly<{ section: SpecSection }>) {
  const { icon: Icon, color } = SECTION_ICONS[section.kind]

  return (
    <section className="mb-10 last:mb-0">
      <h3 className="mb-3 flex items-center gap-2 text-xl font-bold">
        <Icon className={`size-5 ${color}`} />
        {section.title}
      </h3>

      {/* Content paragraph (not for technical_notes which uses pre block) */}
      {section.content && section.kind !== 'technical_notes' && (
        <p className="leading-relaxed text-muted-foreground">{section.content}</p>
      )}

      {/* List items — for requirements */}
      {section.kind === 'requirements' && section.items && (
        <ul className="space-y-3">
          {section.items.map((item, i) => (
            <li key={i} className="flex gap-3 text-muted-foreground">
              <span className="text-accent">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Numbered items — for acceptance criteria */}
      {section.kind === 'acceptance_criteria' && section.items && (
        <div className="space-y-4">
          {section.items.map((item, i) => (
            <div key={i} className="flex items-start gap-4">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded bg-muted text-xs font-bold text-muted-foreground">
                {i + 1}
              </span>
              <p className="text-muted-foreground">{item}</p>
            </div>
          ))}
        </div>
      )}

      {/* Technical notes — code block style */}
      {section.kind === 'technical_notes' && section.content && (
        <div className="mt-3 rounded-lg border border-border bg-muted/50 p-5">
          <pre className="whitespace-pre-wrap font-mono text-sm text-muted-foreground">
            {section.content}
          </pre>
        </div>
      )}
    </section>
  )
}
