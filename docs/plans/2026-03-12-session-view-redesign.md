# Session View Redesign — Compact 2-Panel with Detail Drawer

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the session transcript view as a reusable 2-panel layout (compact transcript + detail drawer) that works for agent sessions, workflow steps, and brainstorming — matching the Stitch `agent-session-compact.html` design.

**Architecture:** Replace the existing session components (`session-view.tsx`, `session-message.tsx`, `inspector-panel.tsx`) with a compact card-row transcript on the left (60%) and a detail drawer on the right (40%). Each transcript row has a colored left border per tool type, icon, label, content summary, timestamp, and chevron. Clicking a row opens its detail in the drawer. The component is generic — it takes `SessionData[]` and optional config for header/input bar.

**Tech Stack:** React, Tailwind CSS v4, Lucide React icons, CSS variables (design system tokens), existing shadcn/ui primitives from `@agent-coding/ui`.

**Stitch Reference:** `.stitch/designs/agent-session-compact.html` (compact 2-panel) + `.stitch/designs/agent-session-compact.png` (screenshot)

---

## Token Mapping

| Stitch Color | CSS Variable | Usage |
|-------------|-------------|-------|
| `#BF5AF2` purple | `--tool-thinking` | Thinking blocks |
| `#64D2FF` teal | `--tool-search` | Glob/Search tools |
| `#32D74B` success | `--tool-read` | Read tool (reuse `--success`) |
| `#FF9F0A` orange | `--tool-grep` | Grep tool |
| `#FF453A` destructive | `--tool-bash` | Bash tool (reuse `--destructive`) |
| `#5AC8FA` cyan | `--tool-write` | Write tool |
| `#FFD60A` warning | `--tool-edit` | Edit tool (reuse `--warning`) |
| `#FF375F` magenta | `--tool-subagent` | Subagent dispatch |
| `#0A84FF` accent | `--primary` | User msg, Plan, Tasks, Response |

## Icon Mapping (Material Symbols → Lucide)

| Material Symbol | Lucide Icon | Import Name | Usage |
|----------------|-------------|-------------|-------|
| `arrow_back` | `ArrowLeft` | `ArrowLeft` | Back button |
| `terminal` | `Terminal` | `Terminal` | Session icon, Bash |
| `token` | `Coins` | `Coins` | Token count |
| `payments` | `DollarSign` | `DollarSign` | Cost |
| `schedule` | `Clock` | `Clock` | Duration |
| `pause` | `Pause` | `Pause` | Pause button |
| `stop` | `Square` | `Square` | Stop button |
| `person` | `User` | `User` | User message |
| `psychology` | `Brain` | `Brain` | Thinking |
| `search` | `Search` | `Search` | Glob tool |
| `description` | `FileText` | `FileText` | Read tool |
| `code` | `Code` | `Code` | Grep tool |
| `map` | `Map` | `Map` | Plan mode |
| `checklist` | `ListChecks` | `ListChecks` | Tasks/Todo |
| `note_add` | `FilePlus` | `FilePlus` | Write tool |
| `edit_note` | `Pencil` | `Pencil` | Edit tool |
| `account_tree` | `GitBranch` | `GitBranch` | Subagent |
| `smart_toy` | `Bot` | `Bot` | AI response |
| `chevron_right` | `ChevronRight` | `ChevronRight` | Row expand |
| `close` | `X` | `X` | Close drawer |
| `shield` | `Shield` | `Shield` | Permission mode |
| `arrow_upward` | `ArrowUp` | `ArrowUp` | Send message |
| `arrow_forward` | `ArrowRight` | `ArrowRight` | Continue |
| `data_usage` | `HardDrive` | `HardDrive` | File size |

## Component Tree

```
SessionPanel (new top-level, replaces SessionView)
├── SessionHeader (top bar — title, stats, status, actions)
├── Main 2-Panel
│   ├── TranscriptPanel (left 60%)
│   │   ├── TranscriptRow[] (compact card-row per message)
│   │   │   └── SubagentRows[] (indented nested rows)
│   │   ├── QuizCard (brainstorm single/multi choice — inline)
│   │   └── SessionInputBar (bottom — input + model select + permission)
│   └── DetailDrawer (right 40%)
│       ├── DrawerHeader (tool icon + title + file info + close)
│       ├── DrawerContent (code view / diff view / text / todo list)
│       └── DrawerFooter (stats + copy/open actions)
```

---

## Task 1: Add Tool Color CSS Variables

**Files:**
- Modify: `packages/ui/src/globals.css:107-145` (dark section)
- Modify: `packages/ui/src/globals.css:23-32` (light section)

**Step 1: Add light-mode tool colors after `--warning`**

In `:root` block, after line `--warning: #FFCC00;` (line 31), add:

```css
  /* Tool-type accent colors */
  --tool-thinking: #AF52DE;
  --tool-search: #55BEF0;
  --tool-read: #28CD41;
  --tool-grep: #FF9F0A;
  --tool-bash: #FF3B30;
  --tool-write: #5AC8FA;
  --tool-edit: #FFCC00;
  --tool-subagent: #FF2D55;
```

**Step 2: Add dark-mode tool colors after `--warning`**

In `.dark` block, after line `--warning: #FFD60A;` (line 115), add:

```css
  /* Tool-type accent colors */
  --tool-thinking: #BF5AF2;
  --tool-search: #64D2FF;
  --tool-read: #32D74B;
  --tool-grep: #FF9F0A;
  --tool-bash: #FF453A;
  --tool-write: #5AC8FA;
  --tool-edit: #FFD60A;
  --tool-subagent: #FF375F;
```

**Step 3: Verify CSS compiles**

Run: `pnpm --filter @agent-coding/ui build`

**Step 4: Commit**

```bash
git add packages/ui/src/globals.css
git commit -m "feat(ui): add tool-type accent color CSS variables for session transcript"
```

---

## Task 2: Define Session Types

**Files:**
- Modify: `apps/desktop/src/renderer/components/session/session-view.tsx` (replace types at top)

Replace existing `SessionData` and export new types. The types must support all use cases: agent tool calls, brainstorm quizzes, workflow steps.

**Step 1: Create types file**

Create: `apps/desktop/src/renderer/components/session/types.ts`

```typescript
import type { LucideIcon } from 'lucide-react'

// ── Tool-type visual config ──

export type ToolType =
  | 'user'
  | 'thinking'
  | 'glob'
  | 'read'
  | 'grep'
  | 'bash'
  | 'write'
  | 'edit'
  | 'plan'
  | 'tasks'
  | 'subagent'
  | 'response'
  | 'skill'
  | 'error'

// ── Message data ──

export type TranscriptEntry =
  | { kind: 'user'; content: string }
  | { kind: 'thinking'; summary: string }
  | { kind: 'tool_call'; tool: string; input: string; output: string; status: 'success' | 'error'; label?: string; detail?: string }
  | { kind: 'subagent'; description: string; status: 'running' | 'done' | 'error'; children: TranscriptItem[] }
  | { kind: 'plan'; summary: string; stepCount?: number }
  | { kind: 'tasks'; items: { label: string; done: boolean }[] }
  | { kind: 'response'; content: string }
  | { kind: 'quiz'; question: string; mode: 'single' | 'multi'; options: QuizOption[]; selectedIds?: string[] }
  | { kind: 'skill'; name: string; content: string }
  | { kind: 'error'; message: string; stack?: string }

export interface TranscriptItem {
  id: string
  entry: TranscriptEntry
  timestamp: string
}

export interface QuizOption {
  id: string
  label: string
  description?: string
  recommended?: boolean
}

// ── Session data ──

export interface SessionData {
  id: string
  title: string
  status: 'running' | 'completed' | 'failed' | 'paused'
  duration?: string
  tokenCount?: number
  cost?: string
  items: TranscriptItem[]
}

// ── Session panel config ──

export interface SessionPanelConfig {
  /** Show the top header bar with title/stats/actions */
  showHeader?: boolean
  /** Show the bottom input bar */
  showInputBar?: boolean
  /** Called when user sends a message */
  onSendMessage?: (message: string) => void
  /** Called when user answers a quiz */
  onQuizAnswer?: (itemId: string, selectedIds: string[]) => void
  /** Called when Stop is clicked */
  onStop?: () => void
  /** Called when Pause is clicked */
  onPause?: () => void
}
```

**Step 2: Commit**

```bash
git add apps/desktop/src/renderer/components/session/types.ts
git commit -m "feat(session): add comprehensive session types for agent/workflow/brainstorm"
```

---

## Task 3: Build TranscriptRow Component

**Files:**
- Create: `apps/desktop/src/renderer/components/session/transcript-row.tsx`

This is the core compact row — colored left border, icon, label, content, timestamp, chevron. Each tool type has its own color and icon.

**Step 1: Create transcript-row.tsx**

```tsx
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
    return 'read' // fallback
  }
  if (entry.kind === 'quiz') return 'response'
  return entry.kind
}

function getSummary(entry: TranscriptEntry): string {
  switch (entry.kind) {
    case 'user': return entry.content
    case 'thinking': return entry.summary
    case 'tool_call': return entry.detail ?? entry.label ?? entry.tool
    case 'subagent': return entry.description
    case 'plan': return entry.summary
    case 'tasks': {
      const done = entry.items.filter((i) => i.done).length
      return `${done} of ${entry.items.length} tasks completed`
    }
    case 'response': return entry.content
    case 'quiz': return entry.question
    case 'skill': return entry.name
    case 'error': return entry.message
  }
}

function getExitBadge(entry: TranscriptEntry) {
  if (entry.kind !== 'tool_call' || entry.tool.toLowerCase() !== 'bash') return null
  return entry.status === 'success'
    ? { text: 'Exit 0', className: 'bg-[var(--success)]/15 text-[var(--success)]' }
    : { text: 'Exit 1', className: 'bg-[var(--destructive)]/15 text-[var(--destructive)]' }
}

function getSubagentBadge(entry: TranscriptEntry) {
  if (entry.kind !== 'subagent') return null
  if (entry.status === 'done') return { text: 'Done', className: 'bg-[var(--success)]/15 text-[var(--success)]' }
  if (entry.status === 'error') return { text: 'Error', className: 'bg-[var(--destructive)]/15 text-[var(--destructive)]' }
  return null
}

// ── Row Props ──

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
  const exitBadge = getExitBadge(item.entry)
  const subagentBadge = getSubagentBadge(item.entry)

  // Tasks: render inline dots
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

      {/* Label badge — hide for user/response (they use summary directly) */}
      {item.entry.kind !== 'user' && item.entry.kind !== 'response' && (
        <span
          className="shrink-0 text-[10px] font-bold uppercase tracking-wider"
          style={{ color: visual.color }}
        >
          {visual.label}
        </span>
      )}

      {/* Summary text */}
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

      {/* Exit badge for Bash */}
      {exitBadge && (
        <span className={cn('shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold', exitBadge.className)}>
          {exitBadge.text}
        </span>
      )}

      {/* Subagent status badge */}
      {subagentBadge && (
        <span className={cn('shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold', subagentBadge.className)}>
          {subagentBadge.text}
        </span>
      )}

      {/* Task progress dots */}
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

      {/* Timestamp */}
      <span className="shrink-0 text-[10px] font-mono text-muted-foreground">
        {item.timestamp}
      </span>

      {/* Chevron */}
      <ChevronRight
        className={cn(
          'size-3.5 shrink-0',
          isSelected ? 'text-[var(--primary)]' : 'text-muted-foreground',
        )}
      />
    </button>
  )
}
```

**Step 2: Commit**

```bash
git add apps/desktop/src/renderer/components/session/transcript-row.tsx
git commit -m "feat(session): add TranscriptRow with tool-type colors and Lucide icons"
```

---

## Task 4: Build QuizCard Component

**Files:**
- Create: `apps/desktop/src/renderer/components/session/quiz-card.tsx`

Inline brainstorm quiz cards embedded in the transcript (single/multi choice).

**Step 1: Create quiz-card.tsx**

```tsx
import { useState } from 'react'
import { Bot, ArrowRight } from 'lucide-react'
import { cn, Button } from '@agent-coding/ui'
import type { TranscriptItem, QuizOption } from './types'

interface QuizCardProps {
  item: TranscriptItem
  onAnswer?: (itemId: string, selectedIds: string[]) => void
}

export function QuizCard({ item, onAnswer }: Readonly<QuizCardProps>) {
  if (item.entry.kind !== 'quiz') return null

  const { question, mode, options, selectedIds: initialSelected } = item.entry
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelected ?? []))

  function toggleOption(optionId: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (mode === 'single') {
        next.clear()
        next.add(optionId)
      } else {
        if (next.has(optionId)) next.delete(optionId)
        else next.add(optionId)
      }
      return next
    })
  }

  function handleSubmit() {
    onAnswer?.(item.id, Array.from(selected))
  }

  return (
    <div className="mx-1 mt-2 rounded-xl border border-border bg-[var(--surface)] p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="size-4 text-[var(--primary)]" />
          <span className="text-[12px] font-semibold text-foreground">{question}</span>
        </div>
        <span
          className={cn(
            'rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider',
            mode === 'single'
              ? 'bg-[var(--primary)]/15 text-[var(--primary)]'
              : 'bg-[var(--tool-grep)]/15 text-[var(--tool-grep)]',
          )}
        >
          {mode === 'single' ? 'Single' : 'Multi'}
        </span>
      </div>

      {/* Options */}
      <div className="space-y-1.5">
        {options.map((opt) => {
          const isSelected = selected.has(opt.id)
          return (
            <label
              key={opt.id}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 cursor-pointer transition-all duration-150',
                isSelected
                  ? 'bg-[var(--primary)]/10 border border-[var(--primary)]/30'
                  : 'border border-border hover:bg-[var(--surface-hover)]',
              )}
            >
              <input
                type={mode === 'single' ? 'radio' : 'checkbox'}
                name={`quiz-${item.id}`}
                checked={isSelected}
                onChange={() => toggleOption(opt.id)}
                className="size-3.5 border-[var(--border)] bg-[var(--surface)] text-[var(--primary)] focus:ring-[var(--primary)]"
              />
              <div>
                <span className={cn('text-[12px] font-medium', isSelected ? 'text-foreground' : 'text-muted-foreground')}>
                  {opt.label}
                </span>
                {opt.description && (
                  <span className="ml-2 text-[10px] text-muted-foreground">{opt.description}</span>
                )}
              </div>
            </label>
          )
        })}
      </div>

      {/* Submit for multi-choice */}
      {mode === 'multi' && (
        <div className="flex justify-end pt-1">
          <Button size="sm" onClick={handleSubmit} className="gap-1.5 text-[12px]">
            Continue
            <ArrowRight className="size-3.5" />
          </Button>
        </div>
      )}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add apps/desktop/src/renderer/components/session/quiz-card.tsx
git commit -m "feat(session): add QuizCard for brainstorm single/multi choice"
```

---

## Task 5: Build DetailDrawer Component

**Files:**
- Modify: `apps/desktop/src/renderer/components/session/inspector-panel.tsx` (full rewrite)

Replace the existing inspector panel with the Stitch detail drawer design.

**Step 1: Rewrite inspector-panel.tsx as detail-drawer.tsx**

Create: `apps/desktop/src/renderer/components/session/detail-drawer.tsx`

```tsx
import {
  X, Clock, HardDrive, Copy, ExternalLink,
  CheckCircle2, XCircle,
} from 'lucide-react'
import { cn, ScrollArea, Button } from '@agent-coding/ui'
import type { TranscriptItem } from './types'

interface DetailDrawerProps {
  item: TranscriptItem | null
  onClose: () => void
}

export function DetailDrawer({ item, onClose }: Readonly<DetailDrawerProps>) {
  if (!item) return null

  const { entry } = item
  const headerInfo = getHeaderInfo(entry)

  return (
    <aside className="flex h-full w-[40%] shrink-0 flex-col bg-[var(--surface)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5 shrink-0">
        <div className="flex items-center gap-2.5">
          {headerInfo.icon}
          <span className="text-[12px] font-semibold text-foreground">{headerInfo.title}</span>
        </div>
        <div className="flex items-center gap-3">
          {headerInfo.meta && (
            <span className="text-[10px] text-muted-foreground font-mono">{headerInfo.meta}</span>
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
        <DrawerContent entry={entry} />
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
          <Button variant="outline" size="sm" className="h-6 px-2 text-[10px]">
            <Copy className="size-3 mr-1" />
            Copy
          </Button>
          <Button variant="outline" size="sm" className="h-6 px-2 text-[10px]">
            <ExternalLink className="size-3 mr-1" />
            Open in Editor
          </Button>
        </div>
      </div>
    </aside>
  )
}

// ── Header info resolver ──

function getHeaderInfo(entry: TranscriptItem['entry']) {
  // Import icons lazily based on type to keep this clean
  const { kind } = entry

  if (kind === 'tool_call') {
    const status = entry.status === 'success'
      ? <CheckCircle2 className="size-4 text-[var(--success)]" />
      : <XCircle className="size-4 text-[var(--destructive)]" />
    return {
      icon: status,
      title: `${entry.tool} — ${entry.label ?? entry.tool}`,
      meta: entry.detail,
    }
  }

  if (kind === 'thinking') {
    return { icon: null, title: 'Thinking', meta: undefined }
  }

  if (kind === 'subagent') {
    return { icon: null, title: `Subagent — ${entry.description}`, meta: undefined }
  }

  if (kind === 'tasks') {
    const done = entry.items.filter((i) => i.done).length
    return { icon: null, title: 'Tasks', meta: `${done}/${entry.items.length}` }
  }

  if (kind === 'error') {
    return { icon: <XCircle className="size-4 text-[var(--destructive)]" />, title: 'Error', meta: undefined }
  }

  return { icon: null, title: kind, meta: undefined }
}

// ── Content renderer ──

function DrawerContent({ entry }: Readonly<{ entry: TranscriptItem['entry'] }>) {
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
        <p className="text-[12px] text-muted-foreground italic leading-relaxed">{entry.summary}</p>
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
              {child.entry.kind === 'tool_call' && `${child.entry.tool}: ${child.entry.label ?? child.entry.input.slice(0, 80)}`}
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
                task.done ? 'bg-[var(--success)] border-[var(--success)]' : 'border-border',
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
          <p className="mt-2 text-[11px] text-muted-foreground">{entry.stepCount} implementation steps</p>
        )}
      </div>
    )
  }

  if (entry.kind === 'skill') {
    return (
      <div className="p-4">
        <p className="text-[12px] font-semibold mb-2">Skill: {entry.name}</p>
        <pre className="rounded-lg bg-[var(--surface-elevated)] p-3 text-[11px] font-mono whitespace-pre-wrap">{entry.content}</pre>
      </div>
    )
  }

  if (entry.kind === 'error') {
    return (
      <div className="p-4 space-y-2">
        <p className="text-[12px] font-semibold text-[var(--destructive)]">{entry.message}</p>
        {entry.stack && (
          <pre className="rounded-lg bg-[var(--surface-elevated)] p-3 text-[11px] font-mono text-[var(--destructive)] whitespace-pre-wrap">{entry.stack}</pre>
        )}
      </div>
    )
  }

  return null
}
```

**Step 2: Commit**

```bash
git add apps/desktop/src/renderer/components/session/detail-drawer.tsx
git commit -m "feat(session): add DetailDrawer component for right panel"
```

---

## Task 6: Build SessionHeader Component

**Files:**
- Create: `apps/desktop/src/renderer/components/session/session-header.tsx`

Top bar with back button, title, stats, status badge, pause/stop actions.

**Step 1: Create session-header.tsx**

```tsx
import {
  ArrowLeft, Terminal, Coins, DollarSign, Clock,
  Square, Pause,
} from 'lucide-react'
import { cn, Button } from '@agent-coding/ui'
import type { SessionData } from './types'

interface SessionHeaderProps {
  session: SessionData
  onBack?: () => void
  onStop?: () => void
  onPause?: () => void
}

export function SessionHeader({ session, onBack, onStop, onPause }: Readonly<SessionHeaderProps>) {
  return (
    <header
      className="flex items-center justify-between border-b px-5 py-2.5 shrink-0"
      style={{
        height: 44,
        background: 'var(--glass-bg)',
        backdropFilter: `blur(var(--glass-blur))`,
        WebkitBackdropFilter: `blur(var(--glass-blur))`,
        borderColor: 'var(--glass-border)',
      }}
    >
      <div className="flex items-center gap-4">
        {/* Back */}
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="rounded p-1 cursor-pointer text-muted-foreground hover:bg-[var(--surface-hover)] transition-colors duration-150"
          >
            <ArrowLeft className="size-[18px]" />
          </button>
        )}

        {/* Title */}
        <div className="flex items-center gap-2.5">
          <div className="rounded-md bg-[var(--primary)]/15 p-1">
            <Terminal className="size-4 text-[var(--primary)]" />
          </div>
          <h1 className="text-[13px] font-semibold leading-tight">
            {session.title}
          </h1>
        </div>

        <div className="h-4 w-px bg-border" />

        {/* Stats */}
        <div className="flex items-center gap-3.5 text-[11px] font-mono text-muted-foreground">
          {session.tokenCount != null && (
            <span className="flex items-center gap-1">
              <Coins className="size-[13px]" />
              {session.tokenCount >= 1000
                ? `${(session.tokenCount / 1000).toFixed(1)}K`
                : session.tokenCount}
            </span>
          )}
          {session.cost && (
            <span className="flex items-center gap-1">
              <DollarSign className="size-[13px]" />
              {session.cost}
            </span>
          )}
          {session.duration && (
            <span className="flex items-center gap-1 text-[var(--primary)]">
              <Clock className="size-[13px]" />
              {session.duration}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        {/* Status badge */}
        <StatusPill status={session.status} />

        {/* Pause */}
        {session.status === 'running' && onPause && (
          <Button
            variant="outline"
            size="sm"
            onClick={onPause}
            className="gap-1 border-[var(--warning)]/20 bg-[var(--warning)]/10 text-[var(--warning)] hover:bg-[var(--warning)]/20 text-[11px] font-semibold h-7"
          >
            <Pause className="size-3.5" />
            Pause
          </Button>
        )}

        {/* Stop */}
        {(session.status === 'running' || session.status === 'paused') && onStop && (
          <Button
            variant="outline"
            size="sm"
            onClick={onStop}
            className="gap-1 border-[var(--destructive)]/20 bg-[var(--destructive)]/10 text-[var(--destructive)] hover:bg-[var(--destructive)]/20 text-[11px] font-semibold h-7"
          >
            <Square className="size-3.5" />
            Stop
          </Button>
        )}
      </div>
    </header>
  )
}

function StatusPill({ status }: Readonly<{ status: SessionData['status'] }>) {
  const config = {
    running: { dot: 'bg-[var(--success)]', text: 'text-[var(--success)]', bg: 'bg-[var(--success)]/10 border-[var(--success)]/20', pulse: true },
    paused: { dot: 'bg-[var(--warning)]', text: 'text-[var(--warning)]', bg: 'bg-[var(--warning)]/10 border-[var(--warning)]/20', pulse: false },
    completed: { dot: 'bg-[var(--success)]', text: 'text-[var(--success)]', bg: 'bg-[var(--success)]/10 border-[var(--success)]/20', pulse: false },
    failed: { dot: 'bg-[var(--destructive)]', text: 'text-[var(--destructive)]', bg: 'bg-[var(--destructive)]/10 border-[var(--destructive)]/20', pulse: false },
  }[status]

  return (
    <div className={cn('flex items-center gap-1.5 rounded-full border px-2.5 py-1', config.bg)}>
      <div className={cn('size-1.5 rounded-full', config.dot, config.pulse && 'animate-pulse')} />
      <span className={cn('text-[10px] font-bold uppercase tracking-wider', config.text)}>
        {status}
      </span>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add apps/desktop/src/renderer/components/session/session-header.tsx
git commit -m "feat(session): add SessionHeader with stats, status pill, and actions"
```

---

## Task 7: Build SessionInputBar Component

**Files:**
- Create: `apps/desktop/src/renderer/components/session/session-input-bar.tsx`

Bottom input bar with text field, send button, model selector, and permission indicator.

**Step 1: Create session-input-bar.tsx**

```tsx
import { useState } from 'react'
import { ArrowUp, Shield } from 'lucide-react'
import { cn } from '@agent-coding/ui'

interface SessionInputBarProps {
  onSend: (message: string) => void
  isRunning?: boolean
  statusText?: string
}

export function SessionInputBar({ onSend, isRunning, statusText }: Readonly<SessionInputBarProps>) {
  const [value, setValue] = useState('')

  function handleSubmit() {
    const trimmed = value.trim()
    if (!trimmed) return
    onSend(trimmed)
    setValue('')
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div
      className="border-t px-4 py-2.5 shrink-0"
      style={{
        background: 'var(--glass-bg)',
        backdropFilter: `blur(var(--glass-blur))`,
        WebkitBackdropFilter: `blur(var(--glass-blur))`,
        borderColor: 'var(--glass-border)',
      }}
    >
      {/* Status text when agent is running */}
      {isRunning && statusText && (
        <div className="flex items-center gap-2 mb-2 px-1">
          <div className="size-1.5 rounded-full bg-[var(--primary)] animate-pulse" />
          <span className="text-[11px] text-muted-foreground">{statusText}</span>
        </div>
      )}

      <div className="flex items-center gap-2.5">
        <div className="relative flex-1">
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="w-full rounded-lg border border-border bg-background py-2 pl-3 pr-10 text-[12px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/50 focus:border-[var(--primary)] transition-all duration-150"
          />
          <button
            type="button"
            onClick={handleSubmit}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 flex size-7 items-center justify-center rounded-md bg-[var(--primary)] cursor-pointer hover:bg-[var(--accent-hover)] transition-colors duration-150"
          >
            <ArrowUp className="size-4 text-white" />
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1 rounded border border-[var(--success)]/20 bg-[var(--success)]/10 px-2 py-1 text-[10px] font-medium text-[var(--success)]">
            <Shield className="size-3" />
            Auto
          </div>
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add apps/desktop/src/renderer/components/session/session-input-bar.tsx
git commit -m "feat(session): add SessionInputBar with send, model select, permission badge"
```

---

## Task 8: Build SessionPanel — Top-Level Orchestrator

**Files:**
- Modify: `apps/desktop/src/renderer/components/session/session-view.tsx` (full rewrite)

This replaces `SessionView` with the new `SessionPanel` — a reusable 2-panel layout that orchestrates header, transcript, quiz cards, detail drawer, and input bar.

**Step 1: Rewrite session-view.tsx**

```tsx
import { useState } from 'react'
import { ScrollArea } from '@agent-coding/ui'
import { SessionHeader } from './session-header'
import { TranscriptRow } from './transcript-row'
import { QuizCard } from './quiz-card'
import { DetailDrawer } from './detail-drawer'
import { SessionInputBar } from './session-input-bar'
import type { SessionData, SessionPanelConfig, TranscriptItem } from './types'

// Re-export types for consumers
export type { SessionData, TranscriptItem, SessionPanelConfig } from './types'

interface SessionPanelProps {
  session: SessionData
  config?: SessionPanelConfig
  onBack?: () => void
}

export function SessionPanel({ session, config, onBack }: Readonly<SessionPanelProps>) {
  const [selectedItem, setSelectedItem] = useState<TranscriptItem | null>(null)

  const showHeader = config?.showHeader !== false
  const showInputBar = config?.showInputBar !== false

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Top Bar */}
      {showHeader && (
        <SessionHeader
          session={session}
          onBack={onBack}
          onStop={config?.onStop}
          onPause={config?.onPause}
        />
      )}

      {/* Main 2-Panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Transcript */}
        <div className="w-[60%] flex flex-col border-r border-border">
          <ScrollArea className="flex-1">
            <div className="space-y-1 px-3 py-3">
              {session.items.map((item) => (
                <TranscriptItemRenderer
                  key={item.id}
                  item={item}
                  selectedId={selectedItem?.id ?? null}
                  onSelect={setSelectedItem}
                  onQuizAnswer={config?.onQuizAnswer}
                />
              ))}
            </div>
          </ScrollArea>

          {/* Input Bar */}
          {showInputBar && config?.onSendMessage && (
            <SessionInputBar
              onSend={config.onSendMessage}
              isRunning={session.status === 'running'}
              statusText={session.status === 'running' ? 'Agent is working...' : undefined}
            />
          )}
        </div>

        {/* Right: Detail Drawer */}
        {selectedItem && (
          <DetailDrawer
            item={selectedItem}
            onClose={() => setSelectedItem(null)}
          />
        )}
      </div>
    </div>
  )
}

// ── Item Renderer (handles subagent nesting + quiz inline) ──

interface TranscriptItemRendererProps {
  item: TranscriptItem
  selectedId: string | null
  onSelect: (item: TranscriptItem) => void
  onQuizAnswer?: (itemId: string, selectedIds: string[]) => void
}

function TranscriptItemRenderer({ item, selectedId, onSelect, onQuizAnswer }: Readonly<TranscriptItemRendererProps>) {
  // Quiz: render inline card instead of row
  if (item.entry.kind === 'quiz') {
    return <QuizCard item={item} onAnswer={onQuizAnswer} />
  }

  return (
    <>
      <TranscriptRow
        item={item}
        isSelected={selectedItem(item, selectedId)}
        onSelect={onSelect}
      />
      {/* Nested subagent children */}
      {item.entry.kind === 'subagent' && item.entry.children.map((child) => (
        <TranscriptRow
          key={child.id}
          item={child}
          isSelected={selectedItem(child, selectedId)}
          onSelect={onSelect}
          indented
        />
      ))}
    </>
  )
}

function selectedItem(item: TranscriptItem, selectedId: string | null): boolean {
  return item.id === selectedId
}
```

**Step 2: Commit**

```bash
git add apps/desktop/src/renderer/components/session/session-view.tsx
git commit -m "feat(session): rewrite SessionPanel as 2-panel compact transcript with detail drawer"
```

---

## Task 9: Update TicketScreen Integration

**Files:**
- Modify: `apps/desktop/src/renderer/screens/ticket.tsx`

Update the mock data and imports to use the new `SessionPanel` and `TranscriptItem` types.

**Step 1: Update ticket.tsx imports and mock data**

Replace old import:
```tsx
import { SessionView, type SessionData } from 'renderer/components/session/session-view'
```
With:
```tsx
import { SessionPanel, type SessionData } from 'renderer/components/session/session-view'
```

Replace `MOCK_SESSIONS` with new format using `TranscriptItem[]` instead of `messages: SessionMessageData[]`. Update the session render to use `<SessionPanel session={...} />` instead of `<SessionView sessions={MOCK_SESSIONS} />`.

**Step 2: Update mock data shape**

The mock data needs to change from the old `SessionMessageData` format to the new `TranscriptItem` format. Key changes:
- `type: { kind: 'text', content, role }` → `entry: { kind: 'user', content }` or `entry: { kind: 'response', content }`
- `type: { kind: 'tool_call', tool, input, output, status }` → `entry: { kind: 'tool_call', tool, input, output, status, label }`
- `type: { kind: 'todo_list', items }` → `entry: { kind: 'tasks', items }`
- `type: { kind: 'subagent', description, transcript }` → `entry: { kind: 'subagent', description, status, children }`

**Step 3: Update the render**

Replace `<SessionView sessions={MOCK_SESSIONS} />` with:
```tsx
<SessionPanel
  session={MOCK_SESSION}
  config={{ showHeader: true, showInputBar: false }}
/>
```

**Step 4: Verify build**

Run: `pnpm --filter my-electron-app typecheck`

**Step 5: Commit**

```bash
git add apps/desktop/src/renderer/screens/ticket.tsx
git commit -m "feat(ticket): integrate new SessionPanel with updated mock data"
```

---

## Task 10: Clean Up Old Files

**Files:**
- Delete: `apps/desktop/src/renderer/components/session/session-message.tsx` (replaced by `transcript-row.tsx`)
- Delete: `apps/desktop/src/renderer/components/session/inspector-panel.tsx` (replaced by `detail-drawer.tsx`)

**Step 1: Remove old files**

```bash
git rm apps/desktop/src/renderer/components/session/session-message.tsx
git rm apps/desktop/src/renderer/components/session/inspector-panel.tsx
```

**Step 2: Verify no other imports reference these files**

Run: `pnpm --filter my-electron-app typecheck`

Fix any broken imports.

**Step 3: Commit**

```bash
git commit -m "refactor(session): remove old session-message and inspector-panel"
```

---

## Task 11: Verify Full Build

**Step 1: Run typecheck**

Run: `pnpm typecheck`

**Step 2: Run lint**

Run: `pnpm lint`

**Step 3: Fix any issues**

**Step 4: Visual check in dev mode**

Run: `pnpm --filter my-electron-app dev`

Navigate to a ticket → Sessions tab. Verify:
- Compact transcript rows with colored left borders
- Tool icons are Lucide (not Material Symbols)
- Clicking a row opens the detail drawer on the right
- Quiz cards render inline for brainstorm entries
- Header shows session stats and status
- Overall layout matches Stitch screenshot

**Step 5: Final commit**

```bash
git commit -m "chore(session): fix lint and type issues from session redesign"
```
