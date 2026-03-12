import {
  X, Clock, Copy, ExternalLink,
  CheckCircle2, XCircle,
} from 'lucide-react'
import { cn, ScrollArea, Button } from '@agent-coding/ui'
import type { TranscriptItem, TranscriptEntry } from './types'

interface DetailDrawerProps {
  item: TranscriptItem | null
  onClose: () => void
}

export function DetailDrawer({ item, onClose }: Readonly<DetailDrawerProps>) {
  if (!item) return null

  const header = getHeaderInfo(item.entry)

  return (
    <aside className="flex h-full w-[40%] shrink-0 flex-col bg-[var(--surface)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5 shrink-0">
        <div className="flex items-center gap-2.5">
          {header.icon}
          <span className="text-[12px] font-semibold text-foreground">{header.title}</span>
        </div>
        <div className="flex items-center gap-3">
          {header.meta && (
            <span className="text-[10px] text-muted-foreground font-mono">{header.meta}</span>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close detail"
            className="rounded p-0.5 cursor-pointer hover:bg-[var(--surface-hover)] transition-colors duration-150"
          >
            <X className="size-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <DrawerContent entry={item.entry} />
      </ScrollArea>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-border px-4 py-2 shrink-0">
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          {item.timestamp && (
            <span className="flex items-center gap-1">
              <Clock className="size-3" />
              {item.timestamp}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="xs">
            <Copy className="size-3" />
            Copy
          </Button>
          <Button variant="outline" size="xs">
            <ExternalLink className="size-3" />
            Open in Editor
          </Button>
        </div>
      </div>
    </aside>
  )
}

function getHeaderInfo(entry: TranscriptEntry) {
  if (entry.kind === 'tool_call') {
    const icon =
      entry.status === 'success' ? (
        <CheckCircle2 className="size-4 text-[var(--success)]" />
      ) : (
        <XCircle className="size-4 text-[var(--destructive)]" />
      )
    return {
      icon,
      title: `${entry.tool} — ${entry.label ?? entry.tool}`,
      meta: entry.detail,
    }
  }

  if (entry.kind === 'thinking') {
    return { icon: null, title: 'Thinking', meta: undefined }
  }

  if (entry.kind === 'subagent') {
    return { icon: null, title: `Subagent — ${entry.description}`, meta: undefined }
  }

  if (entry.kind === 'tasks') {
    const done = entry.items.filter((i) => i.done).length
    return { icon: null, title: 'Tasks', meta: `${done}/${entry.items.length}` }
  }

  if (entry.kind === 'error') {
    return {
      icon: <XCircle className="size-4 text-[var(--destructive)]" />,
      title: 'Error',
      meta: undefined,
    }
  }

  return { icon: null, title: entry.kind, meta: undefined }
}

function DrawerContent({ entry }: Readonly<{ entry: TranscriptEntry }>) {
  if (entry.kind === 'tool_call') {
    return (
      <div className="font-mono text-[11px] leading-[18px]">
        <pre className="p-4 whitespace-pre-wrap break-all text-foreground">{entry.output}</pre>
      </div>
    )
  }

  if (entry.kind === 'thinking') {
    return (
      <div className="p-4">
        <p className="text-[12px] text-muted-foreground italic leading-relaxed">
          {entry.summary}
        </p>
      </div>
    )
  }

  if (entry.kind === 'user' || entry.kind === 'response') {
    return (
      <div className="p-4">
        <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{entry.content}</p>
      </div>
    )
  }

  if (entry.kind === 'subagent') {
    return (
      <div className="p-4 space-y-2">
        <p className="text-[12px] font-semibold">{entry.description}</p>
        <div className="space-y-1 rounded-lg bg-[var(--surface-elevated)] p-3">
          {entry.children.map((child) => (
            <div key={child.id} className="text-[11px] font-mono text-muted-foreground">
              {child.entry.kind === 'tool_call' &&
                `${child.entry.tool}: ${child.entry.label ?? child.entry.input.slice(0, 80)}`}
              {child.entry.kind === 'thinking' && child.entry.summary}
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (entry.kind === 'tasks') {
    return (
      <div className="p-4 space-y-2">
        {entry.items.map((task, i) => (
          <div key={`${i}-${task.label}`} className="flex items-center gap-2 text-[12px]">
            <div
              className={cn(
                'size-4 rounded-sm border flex items-center justify-center',
                task.done
                  ? 'bg-[var(--success)] border-[var(--success)]'
                  : 'border-border',
              )}
            >
              {task.done && <CheckCircle2 className="size-3 text-white" />}
            </div>
            <span className={cn(task.done && 'line-through text-muted-foreground')}>
              {task.label}
            </span>
          </div>
        ))}
      </div>
    )
  }

  if (entry.kind === 'plan') {
    return (
      <div className="p-4">
        <p className="text-[12px] leading-relaxed">{entry.summary}</p>
        {entry.stepCount && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            {entry.stepCount} implementation steps
          </p>
        )}
      </div>
    )
  }

  if (entry.kind === 'skill') {
    return (
      <div className="p-4">
        <p className="text-[12px] font-semibold mb-2">Skill: {entry.name}</p>
        <pre className="rounded-lg bg-[var(--surface-elevated)] p-3 text-[11px] font-mono whitespace-pre-wrap">
          {entry.content}
        </pre>
      </div>
    )
  }

  if (entry.kind === 'error') {
    return (
      <div className="p-4 space-y-2">
        <p className="text-[12px] font-semibold text-[var(--destructive)]">{entry.message}</p>
        {entry.stack && (
          <pre className="rounded-lg bg-[var(--surface-elevated)] p-3 text-[11px] font-mono text-[var(--destructive)] whitespace-pre-wrap">
            {entry.stack}
          </pre>
        )}
      </div>
    )
  }

  return null
}
