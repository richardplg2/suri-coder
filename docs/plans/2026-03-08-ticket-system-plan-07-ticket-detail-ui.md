# Ticket System — Plan 07: Ticket Detail Frontend

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild ticket detail page with 4 tabs (Overview, Specs, Tasks, Activity), DAG visualization, and live execution view.

**Architecture:** Tab-based layout with TanStack Query for data, WebSocket for real-time updates, Zustand for local UI state.

**Tech Stack:** React 19, TanStack Query, Zustand, @agent-coding/ui, Tailwind CSS v4

**Depends on:** [Plan 01](./2026-03-08-ticket-system-plan-01-data-layer.md), [Plan 02](./2026-03-08-ticket-system-plan-02-notifications.md), [Plan 03](./2026-03-08-ticket-system-plan-03-spec-management.md)
**Required by:** [Plan 08](./2026-03-08-ticket-system-plan-08-brainstorm-ui.md), [Plan 09](./2026-03-08-ticket-system-plan-09-review-ui.md)

---

## Task 1: Refactor ticket screen to tab-based layout

**Description:** Replace the current SplitPane layout in `ticket.tsx` with a tabbed interface using the `Tabs` component from `@agent-coding/ui`. The header (ticket key, title, type/status badges) stays fixed at the top. Below it, a `SegmentedControl` or `Tabs` component switches between Overview, Specs, Tasks, and Activity panels.

**Files to modify:**
- `apps/desktop/src/renderer/screens/ticket.tsx` — gut existing layout, add tab state and tab content routing

**Key code:**

```tsx
import { useState } from 'react'
import { Badge, ScrollArea, Spinner, SegmentedControl } from '@agent-coding/ui'
import { useTicket } from 'renderer/hooks/queries/use-tickets'
import { OverviewTab } from 'renderer/components/ticket-detail/overview-tab'
import { SpecsTab } from 'renderer/components/ticket-detail/specs-tab'
import { TasksTab } from 'renderer/components/ticket-detail/tasks-tab'
import { ActivityTab } from 'renderer/components/ticket-detail/activity-tab'
import type { TicketType } from 'renderer/types/api'

const TYPE_COLORS: Record<TicketType, string> = {
  feature: 'bg-blue-500/15 text-blue-400',
  bug: 'bg-red-500/15 text-red-400',
  improvement: 'bg-green-500/15 text-green-400',
  chore: 'bg-zinc-500/15 text-zinc-400',
  spike: 'bg-purple-500/15 text-purple-400',
}

type TabId = 'overview' | 'specs' | 'tasks' | 'activity'

const TAB_OPTIONS = [
  { value: 'overview', label: 'Overview' },
  { value: 'specs', label: 'Specs' },
  { value: 'tasks', label: 'Tasks' },
  { value: 'activity', label: 'Activity' },
] as const

interface TicketScreenProps {
  ticketId: string
  projectId: string
}

export function TicketScreen({ ticketId, projectId }: TicketScreenProps) {
  const { data: ticket, isLoading } = useTicket(projectId, ticketId)
  const [activeTab, setActiveTab] = useState<TabId>('overview')

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner label="Loading ticket..." />
      </div>
    )
  }
  if (!ticket) {
    return <div className="p-6 text-muted-foreground">Ticket not found</div>
  }

  return (
    <div className="flex h-full flex-col">
      {/* Fixed header */}
      <div className="border-b border-border p-4">
        <div className="mb-1.5 flex items-center gap-2">
          <span className="text-caption text-muted-foreground">{ticket.key}</span>
          <Badge className={`text-[10px] px-1.5 py-0 font-medium uppercase ${TYPE_COLORS[ticket.type]}`}>
            {ticket.type}
          </Badge>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {ticket.status.replace('_', ' ')}
          </Badge>
        </div>
        <h2 className="text-base font-semibold">{ticket.title}</h2>
      </div>

      {/* Tab bar */}
      <div className="border-b border-border px-4 py-2">
        <SegmentedControl
          options={TAB_OPTIONS}
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as TabId)}
        />
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'overview' && <OverviewTab ticket={ticket} projectId={projectId} />}
        {activeTab === 'specs' && <SpecsTab ticket={ticket} projectId={projectId} />}
        {activeTab === 'tasks' && <TasksTab ticket={ticket} projectId={projectId} />}
        {activeTab === 'activity' && <ActivityTab ticket={ticket} projectId={projectId} />}
      </div>
    </div>
  )
}
```

**Files to create:**
- `apps/desktop/src/renderer/components/ticket-detail/overview-tab.tsx` (stub)
- `apps/desktop/src/renderer/components/ticket-detail/specs-tab.tsx` (stub)
- `apps/desktop/src/renderer/components/ticket-detail/tasks-tab.tsx` (stub)
- `apps/desktop/src/renderer/components/ticket-detail/activity-tab.tsx` (stub)

Each stub exports a component that takes `{ ticket: Ticket; projectId: string }` props and renders a placeholder `<ScrollArea>` with the tab name.

**Commit message:** `feat(desktop): refactor ticket screen to tab-based layout with Overview/Specs/Tasks/Activity`

---

## Task 2: Build Overview tab

**Description:** The Overview tab shows ticket metadata and settings. Top section: description (editable textarea), type selector, priority selector, assignee. Middle section: settings toggles for `auto_execute` and `auto_approval` (per-ticket). Bottom section: budget field (editable number input in USD). Uses `useUpdateTicket` mutation to persist changes.

**Files to modify:**
- `apps/desktop/src/renderer/components/ticket-detail/overview-tab.tsx` — full implementation

**Props/Types:**

```tsx
interface OverviewTabProps {
  ticket: Ticket
  projectId: string
}
```

**Key code:**

```tsx
import { useState } from 'react'
import { ScrollArea, Button, Input, Textarea, Badge, Separator, KVRow } from '@agent-coding/ui'
import { Save, DollarSign, Zap, ShieldCheck } from 'lucide-react'
import { useUpdateTicket } from 'renderer/hooks/queries/use-tickets'
import type { Ticket } from 'renderer/types/api'

export function OverviewTab({ ticket, projectId }: OverviewTabProps) {
  const [description, setDescription] = useState(ticket.description ?? '')
  const [budgetUsd, setBudgetUsd] = useState(ticket.budget_usd?.toString() ?? '')
  const [autoExecute, setAutoExecute] = useState(ticket.auto_execute)
  const updateTicket = useUpdateTicket(projectId)

  const handleSave = () => {
    updateTicket.mutate({
      ticketId: ticket.id,
      payload: {
        description: description || null,
        budget_usd: budgetUsd ? Number.parseFloat(budgetUsd) : null,
        auto_execute: autoExecute,
      },
    })
  }

  return (
    <ScrollArea className="h-full">
      <div className="max-w-2xl space-y-6 p-4">
        {/* Description */}
        <div>
          <label className="section-header mb-2 block">Description</label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="Describe the ticket..."
          />
        </div>

        <Separator />

        {/* Settings */}
        <div>
          <h3 className="section-header mb-3">Settings</h3>
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={autoExecute}
                onChange={(e) => setAutoExecute(e.target.checked)}
                className="accent-primary"
              />
              <Zap className="size-4 text-yellow-400" />
              <div>
                <div className="text-[13px] font-medium">Auto Execute</div>
                <div className="text-caption text-muted-foreground">Automatically run steps when ready</div>
              </div>
            </label>
          </div>
        </div>

        <Separator />

        {/* Budget */}
        <div>
          <h3 className="section-header mb-3">Budget</h3>
          <div className="flex items-center gap-2">
            <DollarSign className="size-4 text-muted-foreground" />
            <Input
              type="number"
              value={budgetUsd}
              onChange={(e) => setBudgetUsd(e.target.value)}
              placeholder="0.00"
              className="w-32"
            />
            <span className="text-caption text-muted-foreground">USD</span>
          </div>
        </div>

        <Separator />

        {/* Metadata */}
        <div>
          <h3 className="section-header mb-3">Details</h3>
          <div className="space-y-1">
            <KVRow label="Type" value={ticket.type} />
            <KVRow label="Priority" value={ticket.priority} />
            <KVRow label="Status" value={ticket.status.replace('_', ' ')} />
            <KVRow label="Created" value={new Date(ticket.created_at).toLocaleDateString()} />
          </div>
        </div>

        <Button onClick={handleSave} disabled={updateTicket.isPending}>
          <Save className="mr-1.5 size-3.5" />
          Save Changes
        </Button>
      </div>
    </ScrollArea>
  )
}
```

**Commit message:** `feat(desktop): build Overview tab with description, settings toggles, budget field`

---

## Task 3: Build Specs tab

**Description:** The Specs tab displays a list of specs associated with the ticket. Each spec shows its type (as a colored badge), current revision number, and reference links. Clicking a spec expands it to show content inline. An "Edit" button opens a Tiptap editor (Plan 08 dependency — use Textarea as placeholder for now). A "History" button shows a revision list dialog.

**Files to modify:**
- `apps/desktop/src/renderer/components/ticket-detail/specs-tab.tsx` — full implementation

**New types needed in `api.ts`:**

```tsx
export interface TicketSpec {
  id: string
  ticket_id: string
  type: 'requirements' | 'technical' | 'design' | 'testing'
  content: string
  revision: number
  references: string[]
  created_at: string
  updated_at: string
}
```

**Key code:**

```tsx
import { useState } from 'react'
import { ScrollArea, Badge, Button, Textarea, Dialog, DialogContent, DialogHeader, DialogTitle } from '@agent-coding/ui'
import { Edit, History, ChevronDown, ChevronRight, FileText } from 'lucide-react'
import type { Ticket, TicketSpec } from 'renderer/types/api'

const SPEC_TYPE_COLORS: Record<string, string> = {
  requirements: 'bg-blue-500/15 text-blue-400',
  technical: 'bg-purple-500/15 text-purple-400',
  design: 'bg-pink-500/15 text-pink-400',
  testing: 'bg-green-500/15 text-green-400',
}

interface SpecsTabProps {
  ticket: Ticket
  projectId: string
}

export function SpecsTab({ ticket, projectId }: SpecsTabProps) {
  const { data: specs = [] } = useTicketSpecs(projectId, ticket.id)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [historySpecId, setHistorySpecId] = useState<string | null>(null)

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-2">
        {specs.length === 0 && (
          <EmptyState icon={FileText} title="No specs yet" description="Specs will appear here after brainstorming." />
        )}
        {specs.map((spec) => (
          <div key={spec.id} className="rounded-lg border border-border bg-card">
            {/* Spec header row */}
            <button
              type="button"
              className="flex w-full items-center gap-3 px-4 py-3 text-left"
              onClick={() => setExpandedId(expandedId === spec.id ? null : spec.id)}
            >
              {expandedId === spec.id ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
              <Badge className={`text-[10px] px-1.5 py-0 ${SPEC_TYPE_COLORS[spec.type]}`}>{spec.type}</Badge>
              <span className="text-[13px] font-medium flex-1">{spec.type} spec</span>
              <span className="text-caption text-muted-foreground">rev {spec.revision}</span>
              <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setEditingId(spec.id) }}>
                <Edit className="size-3.5" />
              </Button>
              <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setHistorySpecId(spec.id) }}>
                <History className="size-3.5" />
              </Button>
            </button>

            {/* Expanded content */}
            {expandedId === spec.id && (
              <div className="border-t border-border px-4 py-3">
                {editingId === spec.id ? (
                  <div className="space-y-2">
                    <Textarea defaultValue={spec.content} rows={10} />
                    <div className="flex gap-2">
                      <Button size="sm">Save</Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <pre className="text-[13px] text-muted-foreground whitespace-pre-wrap">{spec.content}</pre>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* History Dialog */}
      <Dialog open={!!historySpecId} onOpenChange={() => setHistorySpecId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revision History</DialogTitle>
          </DialogHeader>
          {/* Revision list — fetched via useSpecRevisions hook */}
          <div className="text-[13px] text-muted-foreground">Revision history will be loaded here.</div>
        </DialogContent>
      </Dialog>
    </ScrollArea>
  )
}
```

**New query hooks needed:**
- `useTicketSpecs(projectId, ticketId)` — `GET /projects/{projectId}/tickets/{ticketId}/specs`
- `useUpdateSpec(projectId, ticketId)` — `PATCH /projects/{projectId}/tickets/{ticketId}/specs/{specId}`
- `useSpecRevisions(projectId, ticketId, specId)` — `GET /projects/{projectId}/tickets/{ticketId}/specs/{specId}/revisions`

**Files to create:**
- `apps/desktop/src/renderer/hooks/queries/use-specs.ts`

**Commit message:** `feat(desktop): build Specs tab with expandable spec list, edit, and revision history`

---

## Task 4: Build Tasks tab

**Description:** The Tasks tab shows the DAG visualization at the top and a task list table below. The DAG is the existing `WorkflowDAG` component (enhanced in Task 6). The table shows each task with name, agent, status badge, and action buttons. An "Edit Task" button opens the Edit Task modal (Task 7). Start/Stop buttons call workflow action hooks.

**Files to modify:**
- `apps/desktop/src/renderer/components/ticket-detail/tasks-tab.tsx` — full implementation

**Key code:**

```tsx
import { useState } from 'react'
import { ScrollArea, Button, Badge, StatusBadge, Separator, DataTable } from '@agent-coding/ui'
import { Play, Square, Pencil, RotateCcw } from 'lucide-react'
import { WorkflowDAG } from 'renderer/components/workflow-dag'
import { EditTaskModal } from 'renderer/components/ticket-detail/edit-task-modal'
import { useRunStep, useRetryStep, useSkipStep, useRunTicketWorkflow } from 'renderer/hooks/queries/use-workflow-actions'
import type { Ticket, WorkflowStep } from 'renderer/types/api'

interface TasksTabProps {
  ticket: Ticket
  projectId: string
}

export function TasksTab({ ticket, projectId }: TasksTabProps) {
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null)
  const [editingStep, setEditingStep] = useState<WorkflowStep | null>(null)
  const runStep = useRunStep(projectId, ticket.id)
  const retryStep = useRetryStep(projectId, ticket.id)
  const runWorkflow = useRunTicketWorkflow(projectId, ticket.id)

  const sorted = [...ticket.steps].sort((a, b) => a.order - b.order)

  return (
    <ScrollArea className="h-full">
      <div className="p-4">
        {/* DAG visualization */}
        <div className="mb-4">
          <div className="section-header mb-2">Workflow</div>
          <WorkflowDAG steps={ticket.steps} selectedStepId={selectedStepId ?? undefined} onSelectStep={setSelectedStepId} />
        </div>

        {/* Action bar */}
        <div className="mb-4 flex gap-2">
          <Button size="sm" onClick={() => runWorkflow.mutate()} disabled={runWorkflow.isPending}>
            <Play className="mr-1.5 size-3.5" /> Run All
          </Button>
        </div>

        <Separator />

        {/* Task list */}
        <div className="mt-4 space-y-2">
          {sorted.map((step) => (
            <div
              key={step.id}
              className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${
                selectedStepId === step.id ? 'border-primary bg-[var(--selection)]' : 'border-border bg-card'
              }`}
              onClick={() => setSelectedStepId(step.id)}
            >
              <StatusBadge status={stepStatusToStatus(step.status)} />
              <span className="text-[13px] font-medium flex-1">{step.name}</span>
              <span className="text-caption text-muted-foreground">{step.status.replace('_', ' ')}</span>
              <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setEditingStep(step) }}>
                <Pencil className="size-3.5" />
              </Button>
              {step.status === 'ready' && (
                <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); runStep.mutate(step.id) }}>
                  <Play className="size-3.5" />
                </Button>
              )}
              {step.status === 'failed' && (
                <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); retryStep.mutate(step.id) }}>
                  <RotateCcw className="size-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Edit Task Modal */}
      {editingStep && (
        <EditTaskModal
          step={editingStep}
          ticket={ticket}
          projectId={projectId}
          onClose={() => setEditingStep(null)}
        />
      )}
    </ScrollArea>
  )
}
```

**Files to create:**
- `apps/desktop/src/renderer/components/ticket-detail/edit-task-modal.tsx` (stub, full impl in Task 7)

**Commit message:** `feat(desktop): build Tasks tab with DAG, task list, and action buttons`

---

## Task 5: Build Activity tab

**Description:** The Activity tab shows a timeline of events for the ticket. It combines historical events from the API with live events from the WebSocket `ticket:progress` channel. Events include status changes, step execution starts/completions, review actions, and comments. Each event has a timestamp, icon, and description.

**Files to modify:**
- `apps/desktop/src/renderer/components/ticket-detail/activity-tab.tsx` — full implementation

**New types:**

```tsx
export interface TicketActivity {
  id: string
  ticket_id: string
  event_type: 'status_change' | 'step_started' | 'step_completed' | 'step_failed' | 'review_submitted' | 'comment_added'
  description: string
  metadata: Record<string, unknown> | null
  created_at: string
  user_id: string | null
}
```

**Key code:**

```tsx
import { useState, useCallback } from 'react'
import { ScrollArea, Badge } from '@agent-coding/ui'
import { Activity, CheckCircle, XCircle, Play, MessageSquare, Eye } from 'lucide-react'
import { useWsChannel } from 'renderer/hooks/use-ws-channel'
import type { Ticket, TicketActivity } from 'renderer/types/api'
import type { WsEvent } from '@agent-coding/shared'

const EVENT_ICONS: Record<string, typeof Activity> = {
  status_change: Activity,
  step_started: Play,
  step_completed: CheckCircle,
  step_failed: XCircle,
  review_submitted: Eye,
  comment_added: MessageSquare,
}

interface ActivityTabProps {
  ticket: Ticket
  projectId: string
}

export function ActivityTab({ ticket, projectId }: ActivityTabProps) {
  const { data: history = [] } = useTicketActivity(projectId, ticket.id)
  const [liveEvents, setLiveEvents] = useState<TicketActivity[]>([])

  const handleWsEvent = useCallback((_event: WsEvent, data: unknown) => {
    const activity = data as TicketActivity
    setLiveEvents((prev) => [activity, ...prev])
  }, [])

  useWsChannel('ticket:progress', { ticket_id: ticket.id }, handleWsEvent)

  const allEvents = [...liveEvents, ...history]

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-3">
        {allEvents.map((event) => {
          const Icon = EVENT_ICONS[event.event_type] ?? Activity
          return (
            <div key={event.id} className="flex items-start gap-3">
              <Icon className="mt-0.5 size-4 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-[13px]">{event.description}</p>
                <span className="text-caption text-muted-foreground">
                  {new Date(event.created_at).toLocaleString()}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </ScrollArea>
  )
}
```

**New query hooks needed:**
- `useTicketActivity(projectId, ticketId)` — `GET /projects/{projectId}/tickets/{ticketId}/activity`

**Files to create:**
- `apps/desktop/src/renderer/hooks/queries/use-activity.ts`

**Commit message:** `feat(desktop): build Activity tab with timeline and live WebSocket events`

---

## Task 6: Build DAG visualization component

**Description:** Enhance the existing `WorkflowDAG` component from a flat button layout to a vertical flow DAG. Each node is a rounded card showing step name and status icon. Nodes are connected with vertical lines. Status colors: green (completed), blue (running), gray (pending), red (failed), yellow (review). Clicking a node selects it.

**Files to modify:**
- `apps/desktop/src/renderer/components/workflow-dag.tsx` — rewrite with vertical flow layout

**Key code:**

```tsx
import { cn, StatusBadge } from '@agent-coding/ui'
import { CheckCircle, Loader2, Circle, XCircle, Eye } from 'lucide-react'
import type { WorkflowStep, StepStatus } from 'renderer/types/api'

const STATUS_COLORS: Record<StepStatus, string> = {
  completed: 'border-green-500 bg-green-500/10',
  running: 'border-blue-500 bg-blue-500/10',
  ready: 'border-gray-400 bg-gray-400/10',
  awaiting_approval: 'border-yellow-500 bg-yellow-500/10',
  review: 'border-yellow-500 bg-yellow-500/10',
  changes_requested: 'border-red-500 bg-red-500/10',
  failed: 'border-red-500 bg-red-500/10',
  pending: 'border-zinc-600 bg-zinc-600/10',
  skipped: 'border-zinc-600 bg-zinc-600/10',
}

const STATUS_ICONS: Record<StepStatus, typeof Circle> = {
  completed: CheckCircle,
  running: Loader2,
  failed: XCircle,
  review: Eye,
  ready: Circle,
  awaiting_approval: Circle,
  changes_requested: XCircle,
  pending: Circle,
  skipped: Circle,
}

const LINE_COLORS: Record<StepStatus, string> = {
  completed: 'bg-green-500',
  running: 'bg-blue-500',
  failed: 'bg-red-500',
  review: 'bg-yellow-500',
  ready: 'bg-zinc-600',
  awaiting_approval: 'bg-zinc-600',
  changes_requested: 'bg-red-500',
  pending: 'bg-zinc-700',
  skipped: 'bg-zinc-700',
}

interface WorkflowDAGProps {
  steps: WorkflowStep[]
  selectedStepId?: string
  onSelectStep: (stepId: string) => void
}

export function WorkflowDAG({ steps, selectedStepId, onSelectStep }: WorkflowDAGProps) {
  const sorted = [...steps].sort((a, b) => a.order - b.order)

  return (
    <div className="flex flex-col items-center gap-0 py-4">
      {sorted.map((step, i) => {
        const Icon = STATUS_ICONS[step.status]
        const isLast = i === sorted.length - 1

        return (
          <div key={step.id} className="flex flex-col items-center">
            {/* Node */}
            <button
              type="button"
              onClick={() => onSelectStep(step.id)}
              className={cn(
                'flex items-center gap-2 rounded-lg border-2 px-4 py-2 text-[13px] transition-all cursor-pointer w-56',
                STATUS_COLORS[step.status],
                selectedStepId === step.id && 'ring-2 ring-primary ring-offset-1 ring-offset-background'
              )}
            >
              <Icon className={cn('size-4', step.status === 'running' && 'animate-spin')} />
              <span className="truncate">{step.name}</span>
            </button>

            {/* Connector line */}
            {!isLast && (
              <div className={cn('h-6 w-0.5', LINE_COLORS[step.status])} />
            )}
          </div>
        )
      })}
    </div>
  )
}
```

**Commit message:** `feat(desktop): enhance WorkflowDAG with vertical flow layout, status colors, and connector lines`

---

## Task 7: Build Edit Task modal

**Description:** A modal dialog for editing a workflow step/task. Fields: name (text input), agent (dropdown of available agent configs), repo (dropdown of connected repos), description (textarea), dependencies (checkboxes of other steps), auto_approval override (toggle). Save calls the step update API.

**Files to create:**
- `apps/desktop/src/renderer/components/ticket-detail/edit-task-modal.tsx`

**Props/Types:**

```tsx
interface EditTaskModalProps {
  step: WorkflowStep
  ticket: Ticket
  projectId: string
  onClose: () => void
}
```

**Key code:**

```tsx
import { useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  Button, Input, Textarea, Label,
} from '@agent-coding/ui'
import type { WorkflowStep, Ticket } from 'renderer/types/api'

export function EditTaskModal({ step, ticket, projectId, onClose }: EditTaskModalProps) {
  const [name, setName] = useState(step.name)
  const [description, setDescription] = useState(step.description ?? '')
  const [requiresApproval, setRequiresApproval] = useState(step.requires_approval ?? false)

  // Other steps as potential dependencies
  const otherSteps = ticket.steps.filter((s) => s.id !== step.id)

  const handleSave = () => {
    // Call update step API mutation
    // updateStep.mutate({ stepId: step.id, payload: { name, description, requires_approval: requiresApproval } })
    onClose()
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Task: {step.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
          </div>

          <div>
            <Label>Agent</Label>
            {/* Dropdown of agent configs — populated from useAgentConfigs hook */}
            <select className="w-full rounded-md border border-border bg-background px-3 py-2 text-[13px]">
              <option value="">Select agent...</option>
            </select>
          </div>

          <div>
            <Label>Repository</Label>
            {/* Dropdown of connected repos — populated from useProjectRepositories hook */}
            <select className="w-full rounded-md border border-border bg-background px-3 py-2 text-[13px]">
              <option value="">Select repo...</option>
            </select>
          </div>

          <div>
            <Label>Dependencies</Label>
            <div className="space-y-1 mt-1">
              {otherSteps.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-[13px] cursor-pointer">
                  <input type="checkbox" className="accent-primary" />
                  {s.name}
                </label>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={requiresApproval}
              onChange={(e) => setRequiresApproval(e.target.checked)}
              className="accent-primary"
            />
            <span className="text-[13px]">Requires approval before running</span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

**Commit message:** `feat(desktop): build Edit Task modal with agent, repo, dependencies, and approval override`

---

## Task 8: Add WebSocket listener for ticket:progress channel

**Description:** Add real-time updates to the Tasks tab. When a WebSocket event arrives on `ticket:progress`, update the corresponding step's status in the TanStack Query cache. For running steps, show a live output section (collapsible) with streaming text from the `step:output` event type.

**Files to modify:**
- `apps/desktop/src/renderer/components/ticket-detail/tasks-tab.tsx` — add `useWsChannel` hook, update local state on events

**Key code (additions to TasksTab):**

```tsx
import { useWsChannel } from 'renderer/hooks/use-ws-channel'
import { useQueryClient } from '@tanstack/react-query'
import type { WsEvent } from '@agent-coding/shared'

// Inside TasksTab component:
const qc = useQueryClient()
const [liveOutput, setLiveOutput] = useState<Record<string, string[]>>({})

const handleWsEvent = useCallback((event: WsEvent, data: unknown) => {
  const payload = data as { step_id: string; status?: StepStatus; output_line?: string }

  if (event === 'step:status_changed') {
    // Invalidate ticket query to refresh step statuses
    qc.invalidateQueries({ queryKey: ['projects', projectId, 'tickets', ticket.id] })
  }

  if (event === 'step:output') {
    setLiveOutput((prev) => ({
      ...prev,
      [payload.step_id]: [...(prev[payload.step_id] ?? []), payload.output_line ?? ''],
    }))
  }
}, [qc, projectId, ticket.id])

useWsChannel('ticket:progress', { ticket_id: ticket.id }, handleWsEvent)
```

Add a collapsible output viewer below each running step in the task list:

```tsx
{step.status === 'running' && liveOutput[step.id]?.length > 0 && (
  <div className="mt-2 rounded border border-border bg-background p-2 font-mono text-[11px] max-h-48 overflow-y-auto">
    {liveOutput[step.id].map((line, i) => (
      <div key={i} className="text-muted-foreground">{line}</div>
    ))}
  </div>
)}
```

**Commit message:** `feat(desktop): add WebSocket listener for live task status and output streaming`

---

## Task 9: Add query hooks for workflow actions

**Description:** Extend `use-workflow-actions.ts` with additional hooks for new endpoints: `useUpdateStep` (PATCH step fields), `useStopStep` (POST stop), `useRunAllSteps` (already exists as `useRunTicketWorkflow`). Also add `useTicketActivity` in a new file.

**Files to modify:**
- `apps/desktop/src/renderer/hooks/queries/use-workflow-actions.ts` — add new mutation hooks

**Key code to add:**

```tsx
export function useUpdateStep(projectId: string, ticketId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ stepId, payload }: { stepId: string; payload: Partial<WorkflowStep> }) =>
      apiClient(`/tickets/${ticketId}/steps/${stepId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'tickets', ticketId] })
    },
  })
}

export function useStopStep(projectId: string, ticketId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (stepId: string) =>
      apiClient(`/tickets/${ticketId}/steps/${stepId}/stop`, {
        method: 'POST',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'tickets', ticketId] })
    },
  })
}
```

**Files to create:**
- `apps/desktop/src/renderer/hooks/queries/use-activity.ts`

```tsx
import { useQuery } from '@tanstack/react-query'
import { apiClient } from 'renderer/lib/api-client'
import type { TicketActivity } from 'renderer/types/api'

export function useTicketActivity(projectId: string, ticketId: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'tickets', ticketId, 'activity'],
    queryFn: () =>
      apiClient<TicketActivity[]>(`/projects/${projectId}/tickets/${ticketId}/activity`),
    enabled: !!projectId && !!ticketId,
  })
}
```

**Commit message:** `feat(desktop): add useUpdateStep, useStopStep, and useTicketActivity query hooks`
