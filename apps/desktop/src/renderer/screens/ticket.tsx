import { useState } from 'react'
import { Badge, SegmentedControl, Spinner } from '@agent-coding/ui'
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
    </div>
  )
}
