# Brainstorm Tab Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "Brainstorm" tab where users chat with an AI agent via SessionPanel, review a generated feature spec, comment on it, and create tickets.

**Architecture:** New `brainstorm` tab type integrated into the existing tab system. Two views — session (reuses SessionPanel) and review (new Stitch-based components). A dedicated Zustand store manages brainstorm sessions, specs, and comments with mock data for phase 1.

**Tech Stack:** React, TypeScript, Zustand, Tailwind CSS, Lucide React icons, existing `@agent-coding/ui` components (Button, Select, Textarea, Input, Badge)

**Design reference:** `.stitch/designs/brainstorm-review.html` and `.stitch/designs/brainstorm-review.png`

---

### Task 1: Add Brainstorm Tab Type

**Files:**
- Modify: `apps/desktop/src/renderer/types/tabs.ts`

**Step 1: Add BrainstormTab type**

Open `apps/desktop/src/renderer/types/tabs.ts` and update:

```typescript
export type TabType = 'home' | 'ticket' | 'settings' | 'figma' | 'brainstorm'

export interface HomeTab {
  id: 'home'
  type: 'home'
  label: 'Home'
}

export interface TicketTab {
  id: string
  type: 'ticket'
  ticketId: string
  projectId: string
  label: string
}

export interface SettingsTab {
  id: string
  type: 'settings'
  projectId: string
  label: 'Settings'
}

export interface FigmaTab {
  id: string
  type: 'figma'
  projectId: string
  label: string
}

export interface BrainstormTab {
  id: string
  type: 'brainstorm'
  projectId: string
  brainstormId: string
  label: string
}

export type AppTab = HomeTab | TicketTab | SettingsTab | FigmaTab | BrainstormTab
```

**Step 2: Verify typecheck passes**

Run: `cd /home/richard/work/AgentCoding/agent-coding && pnpm --filter my-electron-app exec tsc --noEmit --pretty 2>&1 | head -30`

Expected: No new errors (pre-existing errors in home.tsx are OK).

**Step 3: Commit**

```bash
git add apps/desktop/src/renderer/types/tabs.ts
git commit -m "feat(brainstorm): add BrainstormTab type to tab system"
```

---

### Task 2: Add openBrainstormTab Action to Tab Store

**Files:**
- Modify: `apps/desktop/src/renderer/stores/use-tab-store.ts`

**Step 1: Add openBrainstormTab action**

In `use-tab-store.ts`, add to the `TabStore` interface (after `openFigmaTab`):

```typescript
openBrainstormTab: (projectId: string, brainstormId: string, label?: string) => void
```

Then add the implementation inside the `create` block, after `openFigmaTab`:

```typescript
openBrainstormTab: (projectId, brainstormId, label) => {
  const { tabsByProject, activeTabByProject } = get()
  const tabs = tabsByProject[projectId] ?? []
  const tabId = `brainstorm-${brainstormId}`
  const existing = tabs.find((t) => t.id === tabId)
  if (existing) {
    set({
      activeTabByProject: { ...activeTabByProject, [projectId]: tabId },
    })
    return
  }
  const newTab: AppTab = {
    id: tabId,
    type: 'brainstorm',
    projectId,
    brainstormId,
    label: label ?? 'Brainstorm',
  }
  set({
    tabsByProject: { ...tabsByProject, [projectId]: [...tabs, newTab] },
    activeTabByProject: { ...activeTabByProject, [projectId]: tabId },
  })
},
```

You will also need to import `BrainstormTab` if the `AppTab` import doesn't already cover it (it should via the union type).

**Step 2: Verify typecheck passes**

Run: `cd /home/richard/work/AgentCoding/agent-coding && pnpm --filter my-electron-app exec tsc --noEmit --pretty 2>&1 | head -30`

**Step 3: Commit**

```bash
git add apps/desktop/src/renderer/stores/use-tab-store.ts
git commit -m "feat(brainstorm): add openBrainstormTab action to tab store"
```

---

### Task 3: Create Brainstorm Zustand Store

**Files:**
- Create: `apps/desktop/src/renderer/stores/use-brainstorm-store.ts`

**Step 1: Create the store with types and mock data**

Create `apps/desktop/src/renderer/stores/use-brainstorm-store.ts`:

```typescript
import { create } from 'zustand'
import type { SessionData } from 'renderer/components/session/types'

// --- Types ---

export interface SpecSection {
  id: string
  kind: 'problem' | 'solution' | 'requirements' | 'acceptance_criteria' | 'technical_notes'
  title: string
  content: string
  items?: string[]
}

export interface BrainstormSpec {
  title: string
  project: string
  sections: SpecSection[]
}

export interface SpecComment {
  id: string
  sectionId: string
  selectedText?: string
  content: string
  author: string
  authorInitials: string
  authorColor: string
  timestamp: string
}

export interface TicketDraft {
  title: string
  type: 'feature' | 'bug' | 'improvement' | 'chore' | 'spike'
  priority: 'low' | 'medium' | 'high' | 'critical'
}

export interface BrainstormSession {
  id: string
  projectId: string
  title: string
  view: 'session' | 'review'
  sessionData: SessionData
  spec: BrainstormSpec | null
  comments: SpecComment[]
  ticketDraft: TicketDraft
  createdAt: string
}

// --- Mock Data ---

const MOCK_SPEC: BrainstormSpec = {
  title: 'Cost Tracking Features',
  project: 'Suri Coder AI Dashboard',
  sections: [
    {
      id: 'problem',
      kind: 'problem',
      title: 'Problem',
      content:
        'Users currently lack a centralized way to monitor real-time API costs and token usage across different models (GPT-4, Claude 3, Gemini). Without visibility, developer teams risk exceeding monthly budgets and have no insight into which projects are consuming the most resources.',
    },
    {
      id: 'solution',
      kind: 'solution',
      title: 'Solution',
      content:
        'Implement a real-time analytics dashboard that hooks into the internal API proxy. This system will calculate costs based on model-specific pricing tiers and provide visual breakdowns by user, team, and feature tag.',
    },
    {
      id: 'requirements',
      kind: 'requirements',
      title: 'Requirements',
      content: '',
      items: [
        'Fetch daily usage metrics from the `UsageStream` service.',
        'Calculate USD cost using dynamic pricing lookup table.',
        'Support filtering by date range (Today, 7D, 30D, Custom).',
        'Export capability to CSV and PDF for billing departments.',
      ],
    },
    {
      id: 'acceptance',
      kind: 'acceptance_criteria',
      title: 'Acceptance Criteria',
      content: '',
      items: [
        'The dashboard must load data in under 200ms for default time ranges.',
        'Accuracy of cost calculations must be within 0.01% of provider invoices.',
        "Mobile view must include the primary 'Total Spend' card.",
      ],
    },
    {
      id: 'technical',
      kind: 'technical_notes',
      title: 'Technical Notes',
      content:
        'Data Schema & Database References:\n\nSchema: `Billing_Analytics_V2`\nMain Table: `api_consumption_logs`\nService: `PricingCalculator.compute()`',
    },
  ],
}

const MOCK_COMMENTS: SpecComment[] = [
  {
    id: 'c1',
    sectionId: 'requirements',
    content:
      "We should also consider adding alerts when spending hits 80% of the daily quota. It's better to be proactive than reactive.",
    author: 'James Dalton',
    authorInitials: 'JD',
    authorColor: 'blue',
    timestamp: '2h ago',
  },
  {
    id: 'c2',
    sectionId: 'technical',
    selectedText: 'PricingCalculator',
    content:
      "PricingCalculator needs to handle currency conversion if we're dealing with international provider accounts.",
    author: 'Sarah Chen',
    authorInitials: 'SC',
    authorColor: 'purple',
    timestamp: '45m ago',
  },
]

const MOCK_SESSION_DATA: SessionData = {
  id: 'bs-session-1',
  title: 'Brainstorm: Cost Tracking Features',
  status: 'completed',
  duration: '5m 12s',
  tokenCount: 18200,
  cost: '$0.72',
  items: [
    {
      id: 'b1',
      entry: { kind: 'user', content: 'I need a way to track API costs across our AI models. We use GPT-4, Claude 3, and Gemini.' },
      timestamp: '0:00',
    },
    {
      id: 'b2',
      entry: { kind: 'thinking', summary: 'Analyzing the cost tracking requirements across multiple AI providers...' },
      timestamp: '0:03',
    },
    {
      id: 'b3',
      entry: {
        kind: 'quiz',
        question: 'What level of cost granularity do you need?',
        mode: 'single',
        options: [
          { id: 'q1', label: 'Per-request tracking', description: 'Track every API call individually' },
          { id: 'q2', label: 'Daily aggregates', description: 'Roll up to daily summaries', recommended: true },
          { id: 'q3', label: 'Both', description: 'Detailed logs + daily dashboards' },
        ],
        selectedIds: ['q3'],
      },
      timestamp: '0:15',
    },
    {
      id: 'b4',
      entry: {
        kind: 'quiz',
        question: 'Who needs access to cost data?',
        mode: 'multi',
        options: [
          { id: 'a1', label: 'Individual developers' },
          { id: 'a2', label: 'Team leads' },
          { id: 'a3', label: 'Finance/billing team' },
          { id: 'a4', label: 'Executive dashboard' },
        ],
        selectedIds: ['a1', 'a2', 'a3'],
      },
      timestamp: '0:45',
    },
    {
      id: 'b5',
      entry: { kind: 'response', content: "Based on your requirements, I've drafted a feature specification for Cost Tracking Features. Let me generate the full spec for your review." },
      timestamp: '1:30',
    },
  ],
}

// --- Store ---

interface BrainstormStore {
  sessions: Record<string, BrainstormSession>

  createSession: (projectId: string) => string
  getSession: (sessionId: string) => BrainstormSession | undefined
  getProjectSessions: (projectId: string) => BrainstormSession[]
  setView: (sessionId: string, view: 'session' | 'review') => void
  addComment: (sessionId: string, comment: Omit<SpecComment, 'id'>) => void
  removeComment: (sessionId: string, commentId: string) => void
  updateTicketDraft: (sessionId: string, draft: Partial<TicketDraft>) => void
}

export const useBrainstormStore = create<BrainstormStore>()((set, get) => ({
  sessions: {
    'mock-brainstorm-1': {
      id: 'mock-brainstorm-1',
      projectId: 'mock-project',
      title: 'Cost Tracking Features',
      view: 'review',
      sessionData: MOCK_SESSION_DATA,
      spec: MOCK_SPEC,
      comments: MOCK_COMMENTS,
      ticketDraft: { title: 'Cost tracking dashboard', type: 'feature', priority: 'medium' },
      createdAt: '2026-03-13T10:00:00Z',
    },
  },

  createSession: (projectId) => {
    const id = `brainstorm-${Date.now()}`
    const session: BrainstormSession = {
      id,
      projectId,
      title: 'New Brainstorm',
      view: 'session',
      sessionData: {
        id,
        title: 'New Brainstorm Session',
        status: 'running',
        items: [],
      },
      spec: null,
      comments: [],
      ticketDraft: { title: '', type: 'feature', priority: 'medium' },
      createdAt: new Date().toISOString(),
    }
    set({ sessions: { ...get().sessions, [id]: session } })
    return id
  },

  getSession: (sessionId) => get().sessions[sessionId],

  getProjectSessions: (projectId) =>
    Object.values(get().sessions).filter((s) => s.projectId === projectId),

  setView: (sessionId, view) => {
    const sessions = get().sessions
    const session = sessions[sessionId]
    if (!session) return
    set({ sessions: { ...sessions, [sessionId]: { ...session, view } } })
  },

  addComment: (sessionId, comment) => {
    const sessions = get().sessions
    const session = sessions[sessionId]
    if (!session) return
    const newComment: SpecComment = { ...comment, id: `comment-${Date.now()}` }
    set({
      sessions: {
        ...sessions,
        [sessionId]: { ...session, comments: [...session.comments, newComment] },
      },
    })
  },

  removeComment: (sessionId, commentId) => {
    const sessions = get().sessions
    const session = sessions[sessionId]
    if (!session) return
    set({
      sessions: {
        ...sessions,
        [sessionId]: {
          ...session,
          comments: session.comments.filter((c) => c.id !== commentId),
        },
      },
    })
  },

  updateTicketDraft: (sessionId, draft) => {
    const sessions = get().sessions
    const session = sessions[sessionId]
    if (!session) return
    set({
      sessions: {
        ...sessions,
        [sessionId]: {
          ...session,
          ticketDraft: { ...session.ticketDraft, ...draft },
        },
      },
    })
  },
}))
```

**Step 2: Verify typecheck passes**

Run: `cd /home/richard/work/AgentCoding/agent-coding && pnpm --filter my-electron-app exec tsc --noEmit --pretty 2>&1 | head -30`

**Step 3: Commit**

```bash
git add apps/desktop/src/renderer/stores/use-brainstorm-store.ts
git commit -m "feat(brainstorm): create Zustand store with types and mock data"
```

---

### Task 4: Create BrainstormScreen Orchestrator

**Files:**
- Create: `apps/desktop/src/renderer/screens/brainstorm.tsx`

**Step 1: Create the screen component**

This component toggles between the session view (SessionPanel) and the review view. Create `apps/desktop/src/renderer/screens/brainstorm.tsx`:

```typescript
import { SessionPanel } from 'renderer/components/session/session-view'
import { BrainstormReview } from 'renderer/components/brainstorm-review/review-layout'
import { useBrainstormStore } from 'renderer/stores/use-brainstorm-store'

interface BrainstormScreenProps {
  projectId: string
  brainstormId: string
}

export function BrainstormScreen({ projectId, brainstormId }: Readonly<BrainstormScreenProps>) {
  const session = useBrainstormStore((s) => s.sessions[brainstormId])
  const setView = useBrainstormStore((s) => s.setView)

  if (!session) {
    return <div className="flex h-full items-center justify-center text-muted-foreground">Brainstorm session not found</div>
  }

  if (session.view === 'session') {
    return (
      <SessionPanel
        session={session.sessionData}
        config={{
          showHeader: true,
          showInputBar: true,
          onSendMessage: () => {},
        }}
        onBack={() => setView(brainstormId, 'review')}
      />
    )
  }

  return (
    <BrainstormReview
      session={session}
      onRevise={() => setView(brainstormId, 'session')}
    />
  )
}
```

**Step 2: Verify typecheck**

Run: `cd /home/richard/work/AgentCoding/agent-coding && pnpm --filter my-electron-app exec tsc --noEmit --pretty 2>&1 | head -30`

Note: This will fail because `BrainstormReview` doesn't exist yet. That's expected — we'll create it in the next tasks. For now, just create the file. We'll verify the full typecheck after Task 8.

**Step 3: Commit**

```bash
git add apps/desktop/src/renderer/screens/brainstorm.tsx
git commit -m "feat(brainstorm): create BrainstormScreen orchestrator"
```

---

### Task 5: Create Review Header Component

**Files:**
- Create: `apps/desktop/src/renderer/components/brainstorm-review/review-header.tsx`

**Step 1: Create the header**

Maps to `<header>` in the Stitch design. Create `apps/desktop/src/renderer/components/brainstorm-review/review-header.tsx`:

```typescript
import { ArrowLeft, Sparkles, SquarePlus } from 'lucide-react'
import { Button } from '@agent-coding/ui'

interface ReviewHeaderProps {
  onBack?: () => void
  onRevise: () => void
  onCreateTicket: () => void
}

export function ReviewHeader({ onBack, onRevise, onCreateTicket }: Readonly<ReviewHeaderProps>) {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border/50 bg-background/80 px-6 py-3 backdrop-blur-md">
      <div className="flex items-center gap-4">
        {onBack && (
          <Button variant="ghost" size="icon-sm" onClick={onBack} className="cursor-pointer">
            <ArrowLeft className="size-4" />
          </Button>
        )}
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-accent/20 p-1.5">
            <Sparkles className="size-4 text-accent" />
          </div>
          <h1 className="text-lg font-bold tracking-tight">Brainstorm Review</h1>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={onRevise} className="cursor-pointer">
          <Sparkles className="mr-1.5 size-3.5" />
          Revise with AI
        </Button>
        <Button size="sm" onClick={onCreateTicket} className="cursor-pointer">
          <SquarePlus className="mr-1.5 size-3.5" />
          Create Ticket
        </Button>
      </div>
    </header>
  )
}
```

**Step 2: Commit**

```bash
git add apps/desktop/src/renderer/components/brainstorm-review/review-header.tsx
git commit -m "feat(brainstorm): create ReviewHeader component"
```

---

### Task 6: Create Spec Viewer Component

**Files:**
- Create: `apps/desktop/src/renderer/components/brainstorm-review/spec-viewer.tsx`

**Step 1: Create the spec viewer**

Maps to the left column in the Stitch design. Renders the feature spec sections with icons. Create `apps/desktop/src/renderer/components/brainstorm-review/spec-viewer.tsx`:

```typescript
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

      {/* Content paragraph */}
      {section.content && (
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
```

Note: The `technical_notes` section renders `content` twice (once as `<p>`, once as `<pre>`). To fix this, update the content rendering logic so paragraph only shows for non-technical sections:

Replace the content paragraph block with:
```typescript
{section.content && section.kind !== 'technical_notes' && (
  <p className="leading-relaxed text-muted-foreground">{section.content}</p>
)}
```

**Step 2: Commit**

```bash
git add apps/desktop/src/renderer/components/brainstorm-review/spec-viewer.tsx
git commit -m "feat(brainstorm): create SpecViewer component with section icons"
```

---

### Task 7: Create Comment Panel Component

**Files:**
- Create: `apps/desktop/src/renderer/components/brainstorm-review/comment-panel.tsx`

**Step 1: Create the comment panel**

Maps to the right column in the Stitch design. Create `apps/desktop/src/renderer/components/brainstorm-review/comment-panel.tsx`:

```typescript
import { useState } from 'react'
import { Send } from 'lucide-react'
import { Badge, Button, Textarea } from '@agent-coding/ui'
import type { SpecComment, SpecSection } from 'renderer/stores/use-brainstorm-store'

const SECTION_COLORS: Record<string, string> = {
  problem: 'bg-accent/20 text-accent',
  solution: 'bg-green-500/20 text-green-400',
  requirements: 'bg-blue-500/20 text-blue-400',
  acceptance_criteria: 'bg-amber-500/20 text-amber-400',
  technical_notes: 'bg-purple-500/20 text-purple-400',
}

const AUTHOR_COLORS: Record<string, string> = {
  blue: 'bg-blue-500/20 border-blue-500/40 text-blue-400',
  purple: 'bg-purple-500/20 border-purple-500/40 text-purple-400',
  green: 'bg-green-500/20 border-green-500/40 text-green-400',
  amber: 'bg-amber-500/20 border-amber-500/40 text-amber-400',
}

const FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'problem', label: 'Problem' },
  { value: 'solution', label: 'Solution' },
  { value: 'requirements', label: 'Requirements' },
] as const

interface CommentPanelProps {
  comments: SpecComment[]
  onAddComment: (comment: Omit<SpecComment, 'id'>) => void
  onRemoveComment: (commentId: string) => void
}

export function CommentPanel({ comments, onAddComment, onRemoveComment }: Readonly<CommentPanelProps>) {
  const [filter, setFilter] = useState<string>('all')
  const [newComment, setNewComment] = useState('')

  const filtered = filter === 'all' ? comments : comments.filter((c) => c.sectionId === filter)

  const handleSend = () => {
    if (!newComment.trim()) return
    onAddComment({
      sectionId: 'requirements',
      content: newComment.trim(),
      author: 'You',
      authorInitials: 'YO',
      authorColor: 'blue',
      timestamp: 'Just now',
    })
    setNewComment('')
  }

  return (
    <div className="flex h-full flex-col rounded-xl border border-border bg-surface">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-muted/20 px-6 py-4">
        <h3 className="flex items-center gap-2 font-bold">
          Comments ({comments.length})
        </h3>
        <Badge className="bg-accent/20 text-accent text-[10px] font-black uppercase">Active</Badge>
      </div>

      {/* Comment List */}
      <div className="flex-1 space-y-6 overflow-y-auto p-6">
        {filtered.map((comment) => (
          <CommentCard key={comment.id} comment={comment} />
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">No comments yet</p>
        )}
      </div>

      {/* Add Comment */}
      <div className="border-t border-border bg-muted/30 p-4">
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setFilter(opt.value)}
              className={`shrink-0 cursor-pointer rounded-full px-3 py-1 text-[11px] font-bold transition-colors ${
                filter === opt.value
                  ? 'bg-accent text-white'
                  : 'border border-border bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            rows={2}
            className="pr-10 text-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
          />
          <Button
            variant="ghost"
            size="icon-xs"
            className="absolute bottom-2 right-2 cursor-pointer text-accent hover:text-accent"
            onClick={handleSend}
          >
            <Send className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

function CommentCard({ comment }: Readonly<{ comment: SpecComment }>) {
  const authorStyle = AUTHOR_COLORS[comment.authorColor] ?? AUTHOR_COLORS.blue
  const sectionStyle = SECTION_COLORS[comment.sectionId] ?? SECTION_COLORS.requirements

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`flex size-8 items-center justify-center rounded-full border ${authorStyle}`}>
            <span className="text-xs font-bold">{comment.authorInitials}</span>
          </div>
          <p className="text-sm font-bold">{comment.author}</p>
        </div>
        <span className="text-[10px] text-muted-foreground">{comment.timestamp}</span>
      </div>
      <div className="rounded-lg border border-border/50 bg-muted/30 p-4">
        <span className={`mb-2 inline-block rounded px-2 py-0.5 text-[10px] font-bold ${sectionStyle}`}>
          {comment.sectionId.replace('_', ' ')}
        </span>
        <p className="text-sm leading-relaxed text-muted-foreground">{comment.content}</p>
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add apps/desktop/src/renderer/components/brainstorm-review/comment-panel.tsx
git commit -m "feat(brainstorm): create CommentPanel with filter pills and comment cards"
```

---

### Task 8: Create Ticket Action Bar Component

**Files:**
- Create: `apps/desktop/src/renderer/components/brainstorm-review/ticket-action-bar.tsx`

**Step 1: Create the action bar**

Maps to `<footer>` in the Stitch design. Create `apps/desktop/src/renderer/components/brainstorm-review/ticket-action-bar.tsx`:

```typescript
import { ArrowRight } from 'lucide-react'
import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@agent-coding/ui'
import type { TicketDraft } from 'renderer/stores/use-brainstorm-store'

const PRIORITY_DOTS: Record<string, string> = {
  low: 'bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.5)]',
  medium: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]',
  high: 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]',
  critical: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]',
}

interface TicketActionBarProps {
  draft: TicketDraft
  onUpdate: (draft: Partial<TicketDraft>) => void
  onDiscard: () => void
  onCreateTicket: () => void
}

export function TicketActionBar({ draft, onUpdate, onDiscard, onCreateTicket }: Readonly<TicketActionBarProps>) {
  return (
    <footer className="flex h-20 items-center justify-between border-t border-border bg-background/90 px-8">
      <div className="flex flex-1 items-center gap-6">
        {/* Title */}
        <div className="flex-1">
          <label className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">
            Ticket Title
          </label>
          <Input
            value={draft.title}
            onChange={(e) => onUpdate({ title: e.target.value })}
            className="h-8 text-sm"
          />
        </div>

        {/* Type */}
        <div className="w-40">
          <label className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">
            Type
          </label>
          <Select value={draft.type} onValueChange={(v) => onUpdate({ type: v as TicketDraft['type'] })}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="feature">Feature</SelectItem>
              <SelectItem value="bug">Bug</SelectItem>
              <SelectItem value="improvement">Improvement</SelectItem>
              <SelectItem value="chore">Chore</SelectItem>
              <SelectItem value="spike">Spike</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Priority */}
        <div className="w-40">
          <label className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">
            Priority
          </label>
          <Select value={draft.priority} onValueChange={(v) => onUpdate({ priority: v as TicketDraft['priority'] })}>
            <SelectTrigger className="h-8 text-sm">
              <div className="flex items-center gap-2">
                <div className={`size-2.5 rounded-full ${PRIORITY_DOTS[draft.priority]}`} />
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-4 pl-8">
        <Button variant="ghost" onClick={onDiscard} className="cursor-pointer text-muted-foreground">
          Discard
        </Button>
        <Button onClick={onCreateTicket} className="cursor-pointer px-10 shadow-lg">
          Create Ticket
          <ArrowRight className="ml-1.5 size-4" />
        </Button>
      </div>
    </footer>
  )
}
```

**Step 2: Commit**

```bash
git add apps/desktop/src/renderer/components/brainstorm-review/ticket-action-bar.tsx
git commit -m "feat(brainstorm): create TicketActionBar with draft fields"
```

---

### Task 9: Create Review Layout (Assembles All Review Components)

**Files:**
- Create: `apps/desktop/src/renderer/components/brainstorm-review/review-layout.tsx`

**Step 1: Create the layout**

This is the main review component that assembles header, spec viewer, comment panel, and action bar. Create `apps/desktop/src/renderer/components/brainstorm-review/review-layout.tsx`:

```typescript
import { ReviewHeader } from './review-header'
import { SpecViewer } from './spec-viewer'
import { CommentPanel } from './comment-panel'
import { TicketActionBar } from './ticket-action-bar'
import { useBrainstormStore } from 'renderer/stores/use-brainstorm-store'
import type { BrainstormSession } from 'renderer/stores/use-brainstorm-store'

interface BrainstormReviewProps {
  session: BrainstormSession
  onRevise: () => void
}

export function BrainstormReview({ session, onRevise }: Readonly<BrainstormReviewProps>) {
  const addComment = useBrainstormStore((s) => s.addComment)
  const removeComment = useBrainstormStore((s) => s.removeComment)
  const updateTicketDraft = useBrainstormStore((s) => s.updateTicketDraft)

  if (!session.spec) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        No spec generated yet. Continue brainstorming first.
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <ReviewHeader
        onRevise={onRevise}
        onCreateTicket={() => {}}
      />

      <main className="flex min-h-0 flex-1 gap-8 overflow-hidden p-8">
        {/* Left: Spec (60%) */}
        <div className="flex min-h-0 flex-[0.6] flex-col">
          <SpecViewer spec={session.spec} />
        </div>

        {/* Right: Comments (40%) */}
        <div className="flex min-h-0 flex-[0.4] flex-col">
          <CommentPanel
            comments={session.comments}
            onAddComment={(comment) => addComment(session.id, comment)}
            onRemoveComment={(commentId) => removeComment(session.id, commentId)}
          />
        </div>
      </main>

      <TicketActionBar
        draft={session.ticketDraft}
        onUpdate={(draft) => updateTicketDraft(session.id, draft)}
        onDiscard={() => {}}
        onCreateTicket={() => {}}
      />
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add apps/desktop/src/renderer/components/brainstorm-review/review-layout.tsx
git commit -m "feat(brainstorm): create BrainstormReview layout assembling all review components"
```

---

### Task 10: Wire Up Tab Routing and Entry Point

**Files:**
- Modify: `apps/desktop/src/renderer/components/tab-content.tsx`
- Modify: `apps/desktop/src/renderer/screens/project/tickets-board.tsx` (add Brainstorm button)

**Step 1: Add brainstorm route to TabContent**

In `apps/desktop/src/renderer/components/tab-content.tsx`, add the import and case:

Add import at top:
```typescript
import { BrainstormScreen } from 'renderer/screens/brainstorm'
```

Add case in the switch statement (before the closing `}`):
```typescript
case 'brainstorm':
  return <BrainstormScreen projectId={activeTab.projectId} brainstormId={activeTab.brainstormId} />
```

**Step 2: Add Brainstorm button to TicketsBoard toolbar**

In `apps/desktop/src/renderer/screens/project/tickets-board.tsx`, add a "Brainstorm" button next to the existing buttons.

Add import:
```typescript
import { Brain } from 'lucide-react'
```

And import the tab store action (if not already imported differently — check the file):
```typescript
import { useTabStore } from 'renderer/stores/use-tab-store'
```

Inside the component, get the action:
```typescript
const openBrainstormTab = useTabStore((s) => s.openBrainstormTab)
```

Add the button in the toolbar `<div className="flex items-center gap-2">`, before the "New Ticket" button:
```tsx
<Button size="sm" variant="outline" onClick={() => openBrainstormTab(project.id, 'mock-brainstorm-1', 'Brainstorm')} className="cursor-pointer">
  <Brain className="mr-1.5 size-3.5" />
  Brainstorm
</Button>
```

Note: We use `'mock-brainstorm-1'` as the brainstorm ID to connect to the mock data in the store.

**Step 3: Verify typecheck passes**

Run: `cd /home/richard/work/AgentCoding/agent-coding && pnpm --filter my-electron-app exec tsc --noEmit --pretty 2>&1 | head -30`

**Step 4: Commit**

```bash
git add apps/desktop/src/renderer/components/tab-content.tsx apps/desktop/src/renderer/screens/project/tickets-board.tsx
git commit -m "feat(brainstorm): wire up tab routing and add Brainstorm button to project toolbar"
```

---

### Task 11: Lint and Final Verification

**Step 1: Run linter**

Run: `cd /home/richard/work/AgentCoding/agent-coding && pnpm lint 2>&1 | tail -30`

Fix any lint issues in new files (biome formatting, unused imports, etc.).

**Step 2: Run typecheck**

Run: `cd /home/richard/work/AgentCoding/agent-coding && pnpm typecheck 2>&1 | tail -30`

Fix any type errors in new files.

**Step 3: Run dev to visual verify**

Run: `pnpm --filter my-electron-app dev`

Verify:
- Navigate to a project → see "Brainstorm" button in toolbar
- Click it → brainstorm tab opens
- Shows review view with spec + comments
- Comments have filter pills, can type new comment
- Bottom bar has ticket draft fields
- "Revise with AI" switches to session view
- Session view shows SessionPanel with brainstorm transcript

**Step 4: Commit fixes**

```bash
git add -u
git commit -m "fix(brainstorm): lint and typecheck fixes"
```
