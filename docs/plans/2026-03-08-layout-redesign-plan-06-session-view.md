# Layout Redesign — Plan 06: Session View + Ticket Update

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create session transcript view with smart-collapse message rendering and Inspector panel for message details. Update ticket screen to include Sessions tab alongside Overview.

**Architecture:** SessionView renders a list of SessionMessage components with smart collapse (text full, tools collapsed). Clicking a collapsed message opens InspectorPanel on the right (320px) showing full details. Ticket screen gains a SegmentedControl [Overview | Sessions]. All message types rendered: text, tool calls (Read/Edit/Write/Bash), subagent, todo list, skill, error.

**Tech Stack:** React, Tailwind CSS, Lucide icons, `@agent-coding/ui` (ScrollArea, StatusBadge)

**Depends on:** Plan 01 (needs tab types for ticket context)
**Blocks:** Plan 03 (app shell needs inspector awareness, but can be added incrementally)

**Ref:** `docs/plans/2026-03-08-layout-redesign-design.md` §4 (Ticket Detail + Session View)

---

## Task 1: Create Session Message Component

**Files:**
- Create: `apps/desktop/src/renderer/components/session/session-message.tsx`

**Step 1: Write the component**

Renders a single message in the session transcript. Text messages shown in full, tool calls shown as collapsed summary line.

```tsx
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
  // Extract key info for collapsed view
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
```

**Step 2: Commit**

```bash
git add apps/desktop/src/renderer/components/session/session-message.tsx
git commit -m "feat: add SessionMessage component with smart collapse rendering"
```

---

## Task 2: Create Inspector Panel

**Files:**
- Create: `apps/desktop/src/renderer/components/session/inspector-panel.tsx`

**Step 1: Write the component**

Right panel (320px) that shows full details of a selected message.

```tsx
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
```

**Step 2: Commit**

```bash
git add apps/desktop/src/renderer/components/session/inspector-panel.tsx
git commit -m "feat: add InspectorPanel for session message details"
```

---

## Task 3: Create Session View

**Files:**
- Create: `apps/desktop/src/renderer/components/session/session-view.tsx`

**Step 1: Write the component**

Combines SessionMessage list + InspectorPanel. Manages selected message state.

```tsx
import { useState } from 'react'
import { ScrollArea, StatusBadge } from '@agent-coding/ui'
import { SessionMessage, type SessionMessageData } from './session-message'
import { InspectorPanel } from './inspector-panel'

export interface SessionData {
  id: string
  stepName: string
  status: 'running' | 'completed' | 'failed'
  duration?: string
  tokenCount?: number
  messages: SessionMessageData[]
}

interface SessionViewProps {
  sessions: SessionData[]
}

export function SessionView({ sessions }: SessionViewProps) {
  const [selectedMessage, setSelectedMessage] = useState<SessionMessageData | null>(null)

  return (
    <div className="flex h-full">
      {/* Transcript */}
      <ScrollArea className="flex-1">
        <div className="py-2">
          {sessions.map((session) => (
            <div key={session.id} className="mb-4">
              {/* Session header */}
              <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border/50 bg-background/80 backdrop-blur-sm px-4 py-2">
                <StatusBadge status={session.status === 'running' ? 'running' : session.status === 'completed' ? 'passed' : 'failed'} />
                <span className="text-xs font-semibold">{session.stepName}</span>
                <span className="text-xs text-muted-foreground">Session #{session.id}</span>
                {session.duration && (
                  <span className="text-[11px] text-muted-foreground">{session.duration}</span>
                )}
                {session.tokenCount && (
                  <span className="text-[11px] text-muted-foreground">{session.tokenCount.toLocaleString()} tokens</span>
                )}
              </div>

              {/* Messages */}
              {session.messages.map((msg) => (
                <SessionMessage
                  key={msg.id}
                  message={msg}
                  isSelected={selectedMessage?.id === msg.id}
                  onSelect={setSelectedMessage}
                />
              ))}
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Inspector */}
      {selectedMessage && (
        <InspectorPanel
          message={selectedMessage}
          onClose={() => setSelectedMessage(null)}
        />
      )}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add apps/desktop/src/renderer/components/session/session-view.tsx
git commit -m "feat: add SessionView combining transcript + inspector"
```

---

## Task 4: Update Ticket Screen

**Files:**
- Modify: `apps/desktop/src/renderer/screens/ticket.tsx`

**Step 1: Add Sessions tab to ticket screen**

Add a SegmentedControl with [Overview | Sessions]. Sessions tab renders SessionView with mock data for now. The existing ticket sub-tabs (Overview, Specs, Tasks, Activity) become the Overview view.

Read the current ticket.tsx first, then add the Sessions tab alongside existing content. Key changes:

1. Import `SessionView` and mock session data
2. Add top-level segmented control: [Overview | Sessions]
3. Overview shows existing ticket detail (header + sub-tabs)
4. Sessions shows `<SessionView sessions={mockSessions} />`

```tsx
// Add to existing imports:
import { SessionView, type SessionData } from 'renderer/components/session/session-view'

// Mock session data (replace with real API later)
const MOCK_SESSIONS: SessionData[] = [
  {
    id: '1',
    stepName: 'Brainstorm',
    status: 'completed',
    duration: '2m 30s',
    tokenCount: 4200,
    messages: [
      { id: 'm1', type: { kind: 'text', content: 'Let me analyze the requirements for this feature...', role: 'assistant' }, timestamp: '' },
      { id: 'm2', type: { kind: 'tool_call', tool: 'Read', input: '{"file_path": "src/auth/login.tsx"}', output: 'import React from...', status: 'success' }, timestamp: '' },
      { id: 'm3', type: { kind: 'text', content: 'Based on the codebase, I recommend the following approach...', role: 'assistant' }, timestamp: '' },
      { id: 'm4', type: { kind: 'todo_list', items: [{ label: 'Add auth provider', done: true }, { label: 'Create login form', done: true }, { label: 'Add route guards', done: false }] }, timestamp: '' },
    ],
  },
  {
    id: '2',
    stepName: 'Code',
    status: 'running',
    tokenCount: 1800,
    messages: [
      { id: 'm5', type: { kind: 'text', content: 'Implementing the authentication flow...', role: 'assistant' }, timestamp: '' },
      { id: 'm6', type: { kind: 'tool_call', tool: 'Edit', input: '{"file_path": "src/auth/login.tsx"}', output: 'File edited successfully', status: 'success' }, timestamp: '' },
      { id: 'm7', type: { kind: 'tool_call', tool: 'Bash', input: '{"command": "npm test -- --watch"}', output: 'PASS src/auth/login.test.tsx', status: 'success' }, timestamp: '' },
      { id: 'm8', type: { kind: 'subagent', description: 'Run test suite', transcript: [] }, timestamp: '' },
    ],
  },
]
```

In the ticket screen's JSX, wrap the existing content with a top-level segmented control:

```tsx
// Top-level view toggle (add above existing header)
const [view, setView] = useState<'overview' | 'sessions'>('overview')

// In JSX:
<div className="flex h-full flex-col">
  {/* Ticket header with view toggle */}
  <div className="flex items-center gap-3 border-b border-border/50 px-6 py-3">
    {/* existing ticket key, badges, title... */}
    <div className="ml-auto">
      <SegmentedControl
        value={view}
        onValueChange={(v) => setView(v as 'overview' | 'sessions')}
        options={[
          { value: 'overview', label: 'Overview' },
          { value: 'sessions', label: 'Sessions' },
        ]}
      />
    </div>
  </div>

  {/* Content */}
  {view === 'overview' ? (
    // existing ticket sub-tabs content
  ) : (
    <SessionView sessions={MOCK_SESSIONS} />
  )}
</div>
```

Note: Integrate carefully with the existing ticket screen structure. Preserve all existing functionality — just add the view toggle and sessions content.

**Step 2: Commit**

```bash
git add apps/desktop/src/renderer/screens/ticket.tsx
git commit -m "feat: add Sessions tab to ticket screen with mock session data"
```
