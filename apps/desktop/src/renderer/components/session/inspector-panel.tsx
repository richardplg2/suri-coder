import { X, CheckCircle2, XCircle } from 'lucide-react'
import { cn, ScrollArea } from '@agent-coding/ui'
import type { SessionMessageData } from './session-message'

interface InspectorPanelProps {
  message: SessionMessageData | null
  onClose: () => void
}

export function InspectorPanel({ message, onClose }: InspectorPanelProps) {
  if (!message) return null

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col border-l border-border/50 bg-background">
      {/* Header */}
      <div className="flex h-9 items-center justify-between border-b border-border/50 px-3">
        <span className="text-xs font-semibold text-muted-foreground">Detail</span>
        <button
          type="button"
          onClick={onClose}
          className="flex size-6 items-center justify-center rounded-md cursor-pointer text-muted-foreground hover:text-foreground hover:bg-[var(--surface-hover)] transition-colors duration-150"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-3">
          <InspectorContent message={message} />
        </div>
      </ScrollArea>
    </aside>
  )
}

function InspectorContent({ message }: { message: SessionMessageData }) {
  const { type } = message

  if (type.kind === 'tool_call') {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          {type.status === 'success' ? (
            <CheckCircle2 className="size-3.5 text-[var(--success)]" />
          ) : (
            <XCircle className="size-3.5 text-[var(--destructive)]" />
          )}
          <span className="text-xs font-semibold">{type.tool}</span>
        </div>
        {/* Input */}
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Input</p>
          <pre className="rounded-lg bg-[var(--surface-elevated)] p-3 text-xs font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap break-all">
            {type.input}
          </pre>
        </div>
        {/* Output */}
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Output</p>
          <pre className={cn(
            'rounded-lg bg-[var(--surface-elevated)] p-3 text-xs font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap break-all',
            type.status === 'error' && 'text-[var(--destructive)]',
          )}>
            {type.output}
          </pre>
        </div>
      </div>
    )
  }

  if (type.kind === 'subagent') {
    return (
      <div className="space-y-3">
        <p className="text-xs font-semibold">{type.description}</p>
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Transcript</p>
          <div className="space-y-1 rounded-lg bg-[var(--surface-elevated)] p-3">
            {type.transcript.map((msg) => (
              <div key={msg.id} className="text-xs">
                {msg.type.kind === 'text' && (
                  <p className="whitespace-pre-wrap">{msg.type.content}</p>
                )}
                {msg.type.kind === 'tool_call' && (
                  <p className="font-mono text-muted-foreground">
                    {msg.type.tool}: {msg.type.input.slice(0, 100)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (type.kind === 'todo_list') {
    return (
      <div className="space-y-2">
        <p className="text-xs font-semibold">Todo List</p>
        {type.items.map((item, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <div className={cn(
              'size-3.5 rounded-sm border',
              item.done
                ? 'bg-[var(--success)] border-[var(--success)]'
                : 'border-border',
            )} />
            <span className={cn(item.done && 'line-through text-muted-foreground')}>
              {item.label}
            </span>
          </div>
        ))}
      </div>
    )
  }

  if (type.kind === 'skill') {
    return (
      <div className="space-y-3">
        <p className="text-xs font-semibold">Skill: {type.name}</p>
        <pre className="rounded-lg bg-[var(--surface-elevated)] p-3 text-xs font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap break-all">
          {type.content}
        </pre>
      </div>
    )
  }

  if (type.kind === 'error') {
    return (
      <div className="space-y-3">
        <p className="text-xs font-semibold text-[var(--destructive)]">{type.message}</p>
        {type.stack && (
          <pre className="rounded-lg bg-[var(--surface-elevated)] p-3 text-xs font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap break-all text-[var(--destructive)]">
            {type.stack}
          </pre>
        )}
      </div>
    )
  }

  return null
}
