import {
  FileText, Terminal, Bot, ListChecks, BookOpen, AlertTriangle,
  Pencil, Eye, FolderOpen
} from 'lucide-react'
import { cn } from '@agent-coding/ui'

export type MessageType =
  | { kind: 'text'; content: string; role: 'assistant' | 'user' }
  | { kind: 'tool_call'; tool: string; input: string; output: string; status: 'success' | 'error' }
  | { kind: 'subagent'; description: string; transcript: SessionMessageData[] }
  | { kind: 'todo_list'; items: { label: string; done: boolean }[] }
  | { kind: 'skill'; name: string; content: string }
  | { kind: 'error'; message: string; stack?: string }

export interface SessionMessageData {
  id: string
  type: MessageType
  timestamp: string
}

function getToolIcon(tool: string) {
  if (tool.startsWith('Read')) return Eye
  if (tool.startsWith('Edit')) return Pencil
  if (tool.startsWith('Write')) return FileText
  if (tool.startsWith('Bash')) return Terminal
  if (tool.startsWith('Glob') || tool.startsWith('Grep')) return FolderOpen
  return FileText
}

function getToolSummary(tool: string, input: string): string {
  try {
    const parsed = JSON.parse(input)
    if (tool.startsWith('Read') && parsed.file_path) return parsed.file_path.split('/').pop() ?? tool
    if (tool.startsWith('Edit') && parsed.file_path) return parsed.file_path.split('/').pop() ?? tool
    if (tool.startsWith('Write') && parsed.file_path) return parsed.file_path.split('/').pop() ?? tool
    if (tool.startsWith('Bash') && parsed.command) return parsed.command.slice(0, 60)
    if (tool.startsWith('Glob') && parsed.pattern) return parsed.pattern
    if (tool.startsWith('Grep') && parsed.pattern) return parsed.pattern
  } catch {
    // input is not JSON
  }
  return tool
}

interface SessionMessageProps {
  message: SessionMessageData
  isSelected: boolean
  onSelect: (message: SessionMessageData) => void
}

export function SessionMessage({ message, isSelected, onSelect }: SessionMessageProps) {
  const { type } = message

  // Text messages: render full content inline
  if (type.kind === 'text') {
    return (
      <div className={cn('px-4 py-2', type.role === 'user' && 'bg-[var(--surface-elevated)]')}>
        <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{type.content}</p>
      </div>
    )
  }

  // Tool calls: collapsed summary line
  if (type.kind === 'tool_call') {
    const Icon = getToolIcon(type.tool)
    const summary = getToolSummary(type.tool, type.input)
    return (
      <button
        type="button"
        onClick={() => onSelect(message)}
        className={cn(
          'flex w-full items-center gap-2 px-4 py-1.5 text-left cursor-pointer',
          'transition-colors duration-150 hover:bg-[var(--surface-hover)]',
          isSelected && 'bg-[var(--selection)]',
          type.status === 'error' && 'text-[var(--destructive)]',
        )}
      >
        <Icon className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">{type.tool}</span>
        <span className="text-xs text-foreground truncate">{summary}</span>
      </button>
    )
  }

  // Subagent: collapsed summary
  if (type.kind === 'subagent') {
    return (
      <button
        type="button"
        onClick={() => onSelect(message)}
        className={cn(
          'flex w-full items-center gap-2 px-4 py-1.5 text-left cursor-pointer',
          'transition-colors duration-150 hover:bg-[var(--surface-hover)]',
          isSelected && 'bg-[var(--selection)]',
        )}
      >
        <Bot className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">Subagent</span>
        <span className="text-xs text-foreground truncate">{type.description}</span>
      </button>
    )
  }

  // Todo list: collapsed summary with count
  if (type.kind === 'todo_list') {
    const done = type.items.filter((i) => i.done).length
    return (
      <button
        type="button"
        onClick={() => onSelect(message)}
        className={cn(
          'flex w-full items-center gap-2 px-4 py-1.5 text-left cursor-pointer',
          'transition-colors duration-150 hover:bg-[var(--surface-hover)]',
          isSelected && 'bg-[var(--selection)]',
        )}
      >
        <ListChecks className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">Todo</span>
        <span className="text-xs text-foreground">{done}/{type.items.length} done</span>
      </button>
    )
  }

  // Skill: collapsed summary
  if (type.kind === 'skill') {
    return (
      <button
        type="button"
        onClick={() => onSelect(message)}
        className={cn(
          'flex w-full items-center gap-2 px-4 py-1.5 text-left cursor-pointer',
          'transition-colors duration-150 hover:bg-[var(--surface-hover)]',
          isSelected && 'bg-[var(--selection)]',
        )}
      >
        <BookOpen className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">Skill</span>
        <span className="text-xs text-foreground truncate">{type.name}</span>
      </button>
    )
  }

  // Error: summary with red styling
  if (type.kind === 'error') {
    return (
      <button
        type="button"
        onClick={() => onSelect(message)}
        className={cn(
          'flex w-full items-center gap-2 px-4 py-1.5 text-left cursor-pointer',
          'transition-colors duration-150 hover:bg-[var(--surface-hover)]',
          isSelected && 'bg-[var(--selection)]',
        )}
      >
        <AlertTriangle className="size-3.5 shrink-0 text-[var(--destructive)]" />
        <span className="text-xs font-medium text-[var(--destructive)]">Error</span>
        <span className="text-xs text-[var(--destructive)] truncate">{type.message}</span>
      </button>
    )
  }

  return null
}
