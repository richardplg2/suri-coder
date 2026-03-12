import { useState } from 'react'
import { Badge, SegmentedControl, Spinner } from '@agent-coding/ui'
import { useTicket } from 'renderer/hooks/queries/use-tickets'
import { OverviewTab } from 'renderer/components/ticket-detail/overview-tab'
import { SpecsTab } from 'renderer/components/ticket-detail/specs-tab'
import { TasksTab } from 'renderer/components/ticket-detail/tasks-tab'
import { ActivityTab } from 'renderer/components/ticket-detail/activity-tab'
import { SessionPanel, type SessionData } from 'renderer/components/session/session-view'
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

const MOCK_SESSION: SessionData = {
  id: '1',
  title: 'Session #1 — Refactor Auth Module',
  status: 'running',
  duration: '3m 22s',
  tokenCount: 12400,
  cost: '$0.47',
  items: [
    {
      id: 'm1',
      entry: { kind: 'user', content: 'Refactor the auth module to use JWT tokens instead of sessions' },
      timestamp: '0:00',
    },
    {
      id: 'm2',
      entry: { kind: 'thinking', summary: 'Analyzing the current auth middleware structure and session management...' },
      timestamp: '0:02',
    },
    {
      id: 'm3',
      entry: { kind: 'tool_call', tool: 'Glob', input: '**/*auth*.{ts,tsx}', output: '7 files found', status: 'success', label: '**/*auth*.{ts,tsx}', detail: '7 matches' },
      timestamp: '0:03',
    },
    {
      id: 'm4',
      entry: { kind: 'tool_call', tool: 'Read', input: 'src/middleware/auth.ts', output: 'import { Request, Response } from "express";\n\ninterface AuthOptions {\n  requireAuth: boolean;\n  roles?: string[];\n}\n\nexport function authMiddleware(options: AuthOptions = { requireAuth: true }) {\n  const session = req.session;\n  if (!session?.userId) {\n    return res.status(401).json({ error: "Not authenticated" });\n  }\n}', status: 'success', label: 'src/middleware/auth.ts' },
      timestamp: '0:04',
    },
    {
      id: 'm5',
      entry: { kind: 'tool_call', tool: 'Grep', input: 'req.session', output: '14 matches in 5 files', status: 'success', label: 'req.session', detail: '14 matches in 5 files' },
      timestamp: '0:06',
    },
    {
      id: 'm6',
      entry: { kind: 'thinking', summary: 'Planning the migration: need JWT signing, token refresh, and middleware updates...' },
      timestamp: '0:08',
    },
    {
      id: 'm7',
      entry: { kind: 'plan', summary: 'Entered plan mode — 4 implementation steps', stepCount: 4 },
      timestamp: '0:12',
    },
    {
      id: 'm8',
      entry: {
        kind: 'tasks',
        items: [
          { label: 'Install jsonwebtoken', done: true },
          { label: 'Create JWT utility', done: true },
          { label: 'Update auth middleware', done: true },
          { label: 'Update route handlers', done: false },
          { label: 'Run tests', done: false },
        ],
      },
      timestamp: '0:13',
    },
    {
      id: 'm9',
      entry: { kind: 'tool_call', tool: 'Bash', input: 'npm install jsonwebtoken @types/jsonwebtoken', output: 'added 2 packages', status: 'success', label: 'npm install jsonwebtoken @types/jsonwebtoken' },
      timestamp: '0:18',
    },
    {
      id: 'm10',
      entry: { kind: 'tool_call', tool: 'Write', input: 'src/lib/jwt-utils.ts', output: 'File created', status: 'success', label: 'src/lib/jwt-utils.ts', detail: 'new file' },
      timestamp: '0:22',
    },
    {
      id: 'm11',
      entry: { kind: 'tool_call', tool: 'Edit', input: 'src/middleware/auth.ts', output: 'File edited', status: 'success', label: 'src/middleware/auth.ts', detail: 'lines 12–38' },
      timestamp: '0:25',
    },
    {
      id: 'm12',
      entry: {
        kind: 'subagent',
        description: 'Explore: Find all route handlers using session auth',
        status: 'done',
        children: [
          { id: 's1', entry: { kind: 'tool_call', tool: 'Glob', input: 'src/routes/**/*.ts', output: '12 files', status: 'success', label: 'src/routes/**/*.ts' }, timestamp: '+0:02' },
          { id: 's2', entry: { kind: 'tool_call', tool: 'Grep', input: 'req.session', output: '8 route files', status: 'success', label: 'req.session — 8 route files' }, timestamp: '+0:05' },
          { id: 's3', entry: { kind: 'tool_call', tool: 'Read', input: 'src/routes/api/users.ts', output: '...', status: 'success', label: 'src/routes/api/users.ts' }, timestamp: '+0:07' },
        ],
      },
      timestamp: '0:45',
    },
    {
      id: 'm13',
      entry: { kind: 'response', content: "I've refactored the auth module. Here's a summary of changes..." },
      timestamp: '1:15',
    },
    {
      id: 'm14',
      entry: { kind: 'tool_call', tool: 'Bash', input: 'npm run test -- --filter auth', output: 'Tests: 8 passed, 0 failed', status: 'success', label: 'npm run test -- --filter auth' },
      timestamp: '1:42',
    },
    {
      id: 'm15',
      entry: {
        kind: 'quiz',
        question: 'Which token storage strategy do you prefer?',
        mode: 'single',
        options: [
          { id: 'o1', label: 'HTTP-only Cookie', description: 'Most secure, auto-sent with requests' },
          { id: 'o2', label: 'localStorage', description: 'Simple but XSS vulnerable' },
          { id: 'o3', label: 'In-memory + refresh token', description: 'Best for SPAs, no persistence' },
        ],
        selectedIds: ['o1'],
      },
      timestamp: '1:50',
    },
  ],
}

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
        <SessionPanel
          session={MOCK_SESSION}
          config={{ showHeader: true, showInputBar: false }}
        />
      )}
    </div>
  )
}
