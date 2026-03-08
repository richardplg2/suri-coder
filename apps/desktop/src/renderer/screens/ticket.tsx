import { useState } from 'react'
import { Badge, SegmentedControl, Spinner } from '@agent-coding/ui'
import { useTicket } from 'renderer/hooks/queries/use-tickets'
import { OverviewTab } from 'renderer/components/ticket-detail/overview-tab'
import { SpecsTab } from 'renderer/components/ticket-detail/specs-tab'
import { TasksTab } from 'renderer/components/ticket-detail/tasks-tab'
import { ActivityTab } from 'renderer/components/ticket-detail/activity-tab'
import { SessionView, type SessionData } from 'renderer/components/session/session-view'
import type { TicketType } from 'renderer/types/api'

const TYPE_COLORS: Record<TicketType, string> = {
  feature: 'bg-blue-500/15 text-blue-400',
  bug: 'bg-red-500/15 text-red-400',
  improvement: 'bg-green-500/15 text-green-400',
  chore: 'bg-zinc-500/15 text-zinc-400',
  spike: 'bg-purple-500/15 text-purple-400',
}

type ViewId = 'overview' | 'sessions'

const VIEW_ITEMS = [
  { value: 'overview', label: 'Overview' },
  { value: 'sessions', label: 'Sessions' },
]

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

type TabId = 'overview' | 'specs' | 'tasks' | 'activity'

const TAB_ITEMS = [
  { value: 'overview', label: 'Overview' },
  { value: 'specs', label: 'Specs' },
  { value: 'tasks', label: 'Tasks' },
  { value: 'activity', label: 'Activity' },
]

interface TicketScreenProps {
  ticketId: string
  projectId: string
}

export function TicketScreen({ ticketId, projectId }: TicketScreenProps) {
  const { data: ticket, isLoading } = useTicket(projectId, ticketId)
  const [view, setView] = useState<ViewId>('overview')
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
      <div className="border-b border-border/50 p-4 pb-3">
        <div className="mb-1.5 flex items-center gap-2">
          <span className="text-caption text-muted-foreground">{ticket.key}</span>
          <Badge className={`text-[10px] px-1.5 py-0 font-medium uppercase ${TYPE_COLORS[ticket.type]}`}>
            {ticket.type}
          </Badge>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {ticket.status.replace('_', ' ')}
          </Badge>
          <div className="ml-auto">
            <SegmentedControl
              items={VIEW_ITEMS}
              value={view}
              onValueChange={(v) => setView(v as ViewId)}
              size="sm"
            />
          </div>
        </div>
        <h2 className="text-base font-semibold tracking-tight">{ticket.title}</h2>
      </div>

      {view === 'overview' ? (
        <>
          {/* Tab bar */}
          <div className="border-b border-border/50 px-4 py-2">
            <SegmentedControl
              items={TAB_ITEMS}
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
        </>
      ) : (
        <SessionView sessions={MOCK_SESSIONS} />
      )}
    </div>
  )
}
