import {
  User, Brain, Search, FileText, Code, Terminal,
  FilePlus, Pencil, Map, ListChecks, GitBranch,
  Bot, BookOpen, AlertTriangle, ChevronRight,
} from 'lucide-react'
import { cn } from '@agent-coding/ui'
import type { TranscriptEntry, TranscriptItem } from './types'

interface ToolVisual {
  icon: React.ElementType
  color: string
  label: string
}

const TOOL_VISUALS: Record<string, ToolVisual> = {
  user: { icon: User, color: 'var(--primary)', label: 'User' },
  thinking: { icon: Brain, color: 'var(--tool-thinking)', label: 'Thinking' },
  glob: { icon: Search, color: 'var(--tool-search)', label: 'Glob' },
  read: { icon: FileText, color: 'var(--tool-read)', label: 'Read' },
  grep: { icon: Code, color: 'var(--tool-grep)', label: 'Grep' },
  bash: { icon: Terminal, color: 'var(--tool-bash)', label: 'Bash' },
  write: { icon: FilePlus, color: 'var(--tool-write)', label: 'Write' },
  edit: { icon: Pencil, color: 'var(--tool-edit)', label: 'Edit' },
  plan: { icon: Map, color: 'var(--primary)', label: 'Plan' },
  tasks: { icon: ListChecks, color: 'var(--primary)', label: 'Tasks' },
  subagent: { icon: GitBranch, color: 'var(--tool-subagent)', label: 'Subagent' },
  response: { icon: Bot, color: 'var(--primary)', label: 'Response' },
  skill: { icon: BookOpen, color: 'var(--primary)', label: 'Skill' },
  error: { icon: AlertTriangle, color: 'var(--destructive)', label: 'Error' },
}

function resolveToolType(entry: TranscriptEntry): string {
  if (entry.kind === 'tool_call') {
    const t = entry.tool.toLowerCase()
    if (t.startsWith('read')) return 'read'
    if (t.startsWith('edit')) return 'edit'
    if (t.startsWith('write')) return 'write'
    if (t.startsWith('bash')) return 'bash'
    if (t.startsWith('glob')) return 'glob'
    if (t.startsWith('grep')) return 'grep'
    return 'read'
  }
  if (entry.kind === 'quiz') return 'response'
  return entry.kind
}

function getSummary(entry: TranscriptEntry): string {
  switch (entry.kind) {
    case 'user':
      return entry.content
    case 'thinking':
      return entry.summary
    case 'tool_call':
      return entry.detail ?? entry.label ?? entry.tool
    case 'subagent':
      return entry.description
    case 'plan':
      return entry.summary
    case 'tasks': {
      const done = entry.items.filter((i) => i.done).length
      return `${done} of ${entry.items.length} tasks completed`
    }
    case 'response':
      return entry.content
    case 'quiz':
      return entry.question
    case 'skill':
      return entry.name
    case 'error':
      return entry.message
  }
}

interface TranscriptRowProps {
  item: TranscriptItem
  isSelected: boolean
  onSelect: (item: TranscriptItem) => void
  indented?: boolean
}

export function TranscriptRow({ item, isSelected, onSelect, indented }: Readonly<TranscriptRowProps>) {
  const toolType = resolveToolType(item.entry)
  const visual = TOOL_VISUALS[toolType] ?? TOOL_VISUALS.response
  const Icon = visual.icon
  const summary = getSummary(item.entry)

  // Bash exit badge
  const exitBadge =
    item.entry.kind === 'tool_call' && item.entry.tool.toLowerCase().startsWith('bash')
      ? item.entry.status === 'success'
        ? { text: 'Exit 0', cls: 'bg-[var(--success)]/15 text-[var(--success)]' }
        : { text: 'Exit 1', cls: 'bg-[var(--destructive)]/15 text-[var(--destructive)]' }
      : null

  // Subagent status badge
  const subBadge =
    item.entry.kind === 'subagent'
      ? item.entry.status === 'done'
        ? { text: 'Done', cls: 'bg-[var(--success)]/15 text-[var(--success)]' }
        : item.entry.status === 'error'
          ? { text: 'Error', cls: 'bg-[var(--destructive)]/15 text-[var(--destructive)]' }
          : null
      : null

  // Task progress dots
  const taskDots = item.entry.kind === 'tasks' ? item.entry.items : null

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-md px-3 cursor-pointer',
        'transition-colors duration-150 hover:bg-[var(--surface-elevated)]',
        indented ? 'py-1.5 border-l-2 opacity-70 ml-6' : 'py-2 border-l-[3px]',
        isSelected && 'bg-[var(--selection)] ring-1 ring-[var(--primary)]/30',
        item.entry.kind === 'user' && 'bg-[var(--surface)]/50',
      )}
      style={{ borderLeftColor: visual.color }}
    >
      <Icon
        className={cn('shrink-0', indented ? 'size-3.5' : 'size-4')}
        style={{ color: visual.color }}
      />

      {item.entry.kind !== 'user' && item.entry.kind !== 'response' && (
        <span
          className="shrink-0 text-[10px] font-bold uppercase tracking-wider"
          style={{ color: visual.color }}
        >
          {visual.label}
        </span>
      )}

      <span
        className={cn(
          'flex-1 truncate text-left',
          indented ? 'text-[11px]' : 'text-[12px]',
          (item.entry.kind === 'tool_call' || item.entry.kind === 'thinking') && 'font-mono',
          isSelected ? 'text-foreground' : 'text-muted-foreground',
          item.entry.kind === 'user' && 'font-medium text-foreground',
        )}
      >
        {summary}
      </span>

      {exitBadge && (
        <span className={cn('shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold', exitBadge.cls)}>
          {exitBadge.text}
        </span>
      )}

      {subBadge && (
        <span className={cn('shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold', subBadge.cls)}>
          {subBadge.text}
        </span>
      )}

      {taskDots && (
        <div className="flex gap-0.5 shrink-0">
          {taskDots.map((t, i) => (
            <div
              key={`${i}-${t.label}`}
              className={cn(
                'size-1.5 rounded-full',
                t.done ? 'bg-[var(--success)]' : 'bg-[var(--border)]',
              )}
            />
          ))}
        </div>
      )}

      <span className="shrink-0 text-[10px] font-mono text-muted-foreground">
        {item.timestamp}
      </span>

      <ChevronRight
        className={cn(
          'size-3.5 shrink-0',
          isSelected ? 'text-[var(--primary)]' : 'text-muted-foreground',
        )}
      />
    </button>
  )
}
