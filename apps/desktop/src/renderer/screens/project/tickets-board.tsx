import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button, SegmentedControl, EmptyState, Spinner, DataTable } from '@agent-coding/ui'
import type { Column } from '@agent-coding/ui'
import { useTickets } from 'renderer/hooks/queries/use-tickets'
import { useTabStore } from 'renderer/stores/use-tab-store'
import type { Project, TicketListItem, TicketType, TicketPriority } from 'renderer/types/api'

type ViewMode = 'kanban' | 'list'

const TYPE_COLORS: Record<TicketType, string> = {
  feature: 'bg-blue-500/15 text-blue-400',
  bug: 'bg-red-500/15 text-red-400',
  improvement: 'bg-green-500/15 text-green-400',
  chore: 'bg-zinc-500/15 text-zinc-400',
  spike: 'bg-purple-500/15 text-purple-400',
}

const PRIORITY_COLORS: Record<TicketPriority, string> = {
  urgent: 'text-red-400',
  high: 'text-orange-400',
  medium: 'text-yellow-400',
  low: 'text-blue-400',
  none: 'text-zinc-400',
}

interface TicketsBoardProps {
  project: Project
}

export function TicketsBoard({ project }: TicketsBoardProps) {
  const { data: tickets, isLoading } = useTickets(project.id)
  const { openTicketTab } = useTabStore()
  const [viewMode, setViewMode] = useState<ViewMode>('kanban')

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner label="Loading tickets..." />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border px-4">
        <div className="text-sm font-medium">Tickets</div>
        <div className="flex items-center gap-2">
          <SegmentedControl
            value={viewMode}
            onValueChange={(v) => setViewMode(v as ViewMode)}
            items={[
              { value: 'kanban', label: 'Board' },
              { value: 'list', label: 'List' },
            ]}
            size="sm"
          />
          <Button size="sm">
            <Plus className="mr-1.5 size-4" />
            New Ticket
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {(!tickets || tickets.length === 0) ? (
          <EmptyState
            title="No tickets yet"
            description="Create a ticket to start your workflow."
          />
        ) : viewMode === 'kanban' ? (
          <KanbanView
            tickets={tickets}
            onTicketClick={(t) => openTicketTab(t.id, project.id, `${t.key}: ${t.title}`)}
          />
        ) : (
          <ListView
            tickets={tickets}
            onTicketClick={(t) => openTicketTab(t.id, project.id, `${t.key}: ${t.title}`)}
          />
        )}
      </div>
    </div>
  )
}

// --- Kanban sub-component ---

const KANBAN_COLUMNS = [
  { status: 'backlog', label: 'Backlog' },
  { status: 'todo', label: 'Todo' },
  { status: 'in_progress', label: 'In Progress' },
  { status: 'in_review', label: 'In Review' },
  { status: 'done', label: 'Done' },
] as const

function KanbanView({
  tickets,
  onTicketClick,
}: {
  tickets: TicketListItem[]
  onTicketClick: (t: TicketListItem) => void
}) {
  return (
    <div className="flex gap-4 h-full">
      {KANBAN_COLUMNS.map((col) => {
        const colTickets = tickets.filter((t) => t.status === col.status)
        return (
          <div key={col.status} className="flex w-64 shrink-0 flex-col">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {col.label}
              </span>
              <span className="text-xs text-muted-foreground">{colTickets.length}</span>
            </div>
            <div className="flex-1 space-y-2 overflow-auto">
              {colTickets.map((ticket) => (
                <TicketCard key={ticket.id} ticket={ticket} onClick={() => onTicketClick(ticket)} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// --- Ticket card ---

function TicketCard({ ticket, onClick }: { ticket: TicketListItem; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full cursor-pointer rounded-lg border border-border bg-card p-3 text-left transition-colors hover:bg-secondary/50"
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{ticket.key}</span>
        <span className={`text-[10px] font-medium uppercase ${TYPE_COLORS[ticket.type]} rounded px-1.5 py-0.5`}>
          {ticket.type}
        </span>
      </div>
      <div className="mb-2 text-sm leading-snug line-clamp-2">{ticket.title}</div>
      <div className="flex items-center justify-between">
        <span className={`text-xs ${PRIORITY_COLORS[ticket.priority]}`}>
          {ticket.priority !== 'none' ? ticket.priority : ''}
        </span>
      </div>
    </button>
  )
}

// --- List sub-component ---

function ListView({
  tickets,
  onTicketClick,
}: {
  tickets: TicketListItem[]
  onTicketClick: (t: TicketListItem) => void
}) {
  const columns: Column<TicketListItem>[] = [
    { key: 'key', header: 'Key', width: '100px' },
    { key: 'title', header: 'Title', render: (t) => <span className="truncate">{t.title}</span> },
    {
      key: 'type',
      header: 'Type',
      width: '100px',
      render: (t) => (
        <span className={`text-[10px] font-medium uppercase ${TYPE_COLORS[t.type]} rounded px-1.5 py-0.5`}>
          {t.type}
        </span>
      ),
    },
    { key: 'status', header: 'Status', width: '120px', render: (t) => t.status.replace('_', ' ') },
    {
      key: 'priority',
      header: 'Priority',
      width: '100px',
      render: (t) => (
        <span className={PRIORITY_COLORS[t.priority]}>{t.priority !== 'none' ? t.priority : '-'}</span>
      ),
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={tickets}
      rowKey={(t) => t.id}
      onRowClick={onTicketClick}
    />
  )
}
