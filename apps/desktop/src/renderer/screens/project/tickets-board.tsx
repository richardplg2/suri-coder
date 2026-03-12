import { useState } from 'react'
import { Plus, Frame, MoreHorizontal, CheckCircle2 } from 'lucide-react'
import { Button, SegmentedControl, EmptyState, Spinner, DataTable, Badge, ScrollArea, cn } from '@agent-coding/ui'
import type { Column } from '@agent-coding/ui'
import { useTickets } from 'renderer/hooks/queries/use-tickets'
import { useTabStore } from 'renderer/stores/use-tab-store'
import { useModalStore } from 'renderer/stores/use-modal-store'

const openCreateTicketModal = (projectId: string) =>
  useModalStore.getState().open('create-ticket', { projectId })
import type { Project, TicketListItem, TicketType, TicketPriority } from 'renderer/types/api'

type ViewMode = 'kanban' | 'list'

const TYPE_VARIANT: Record<TicketType, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  feature: 'default',
  bug: 'destructive',
  improvement: 'secondary',
  chore: 'outline',
  spike: 'secondary',
}

const TYPE_COLORS: Record<TicketType, string> = {
  feature: 'bg-blue-500/15 text-blue-400',
  bug: 'bg-red-500/15 text-red-400',
  improvement: 'bg-green-500/15 text-green-400',
  chore: 'bg-zinc-500/15 text-zinc-400',
  spike: 'bg-purple-500/15 text-purple-400',
}

const PRIORITY_COLORS: Record<TicketPriority, string> = {
  urgent: 'text-[var(--destructive)]',
  high: 'text-orange-400',
  medium: 'text-[var(--warning)]',
  low: 'text-[var(--success)]',
  none: 'text-muted-foreground',
}

const PRIORITY_DOT_COLORS: Record<TicketPriority, string> = {
  urgent: 'bg-[var(--destructive)]',
  high: 'bg-orange-400',
  medium: 'bg-[var(--warning)]',
  low: 'bg-[var(--success)]',
  none: 'bg-muted-foreground',
}

interface TicketsBoardProps {
  project: Project
}

export function TicketsBoard({ project }: TicketsBoardProps) {
  const { data: tickets, isLoading } = useTickets(project.id)
  const openTicketTab = useTabStore((s) => s.openTicketTab)
  const openFigmaTab = useTabStore((s) => s.openFigmaTab)
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
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border/50 px-4">
        <div className="text-sm font-semibold tracking-tight">Tickets</div>
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
          <Button size="sm" variant="outline" onClick={() => openFigmaTab(project.id)} className="cursor-pointer">
            <Frame className="mr-1.5 size-3.5" />
            Figma Import
          </Button>
          <Button size="sm" onClick={() => openCreateTicketModal(project.id)}>
            <Plus className="mr-1.5 size-3.5" />
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
            onTicketClick={(t) => openTicketTab(project.id, t.id, `${t.key}: ${t.title}`)}
          />
        ) : (
          <ListView
            tickets={tickets}
            onTicketClick={(t) => openTicketTab(project.id, t.id, `${t.key}: ${t.title}`)}
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
    <div className="flex gap-6 h-full">
      {KANBAN_COLUMNS.map((col) => {
        const colTickets = tickets.filter((t) => t.status === col.status)
        return (
          <div key={col.status} className="flex w-72 shrink-0 flex-col">
            <div className="mb-3 flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="section-header">{col.label}</span>
                <span className={cn(
                  "flex size-5 items-center justify-center rounded text-[10px] font-bold",
                  col.status === 'in_progress'
                    ? "bg-[var(--accent)]/20 text-[var(--accent)]"
                    : "bg-muted text-muted-foreground"
                )}>
                  {colTickets.length}
                </span>
              </div>
              <button type="button" className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors duration-150">
                <MoreHorizontal className="size-4" />
              </button>
            </div>
            <ScrollArea className="flex-1">
              <div className="space-y-3 pr-2">
                {colTickets.map((ticket) => (
                  <TicketCard key={ticket.id} ticket={ticket} onClick={() => onTicketClick(ticket)} />
                ))}
              </div>
            </ScrollArea>
          </div>
        )
      })}
    </div>
  )
}

// --- Ticket card ---

function TicketCard({ ticket, onClick }: { ticket: TicketListItem; onClick: () => void }) {
  const isDone = ticket.status === 'done'
  const isActive = ticket.status === 'in_progress'
  const isCriticalBug = ticket.type === 'bug' && ticket.priority === 'urgent'

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "bento-cell w-full cursor-pointer p-4 text-left",
        isDone && "opacity-60 grayscale-[0.5]",
        isActive && "border-l-4 border-l-[var(--accent)] shadow-md",
        isCriticalBug && "border-[var(--destructive)]/30",
      )}
    >
      {/* Header: key + priority indicator */}
      <div className="mb-2 flex items-center justify-between">
        <span className={cn(
          "font-mono text-[11px] font-bold rounded px-1.5 py-0.5",
          isDone
            ? "bg-muted text-muted-foreground"
            : isCriticalBug
              ? "bg-red-500/20 text-red-400"
              : "bg-blue-500/20 text-blue-400"
        )}>
          {ticket.key}
        </span>
        {isDone ? (
          <CheckCircle2 className="size-4 text-[var(--success)]" />
        ) : (
          <div className={cn(
            "size-2 rounded-full",
            PRIORITY_DOT_COLORS[ticket.priority],
            isCriticalBug && "animate-pulse"
          )} />
        )}
      </div>

      {/* Title */}
      <p className={cn(
        "text-sm font-medium mb-3 leading-snug line-clamp-2",
        isDone && "line-through text-muted-foreground"
      )}>
        {ticket.title}
      </p>

      {/* Footer: type badge + priority label */}
      <div className="flex items-center gap-2">
        <span className={cn(
          "rounded px-2 py-0.5 text-[10px] font-bold uppercase",
          isDone ? "bg-muted text-muted-foreground" : TYPE_COLORS[ticket.type]
        )}>
          {ticket.type}
        </span>
        {!isDone && ticket.priority !== 'none' && (
          <span className={cn(
            "ml-auto text-[10px]",
            PRIORITY_COLORS[ticket.priority],
            ticket.priority === 'urgent' && "font-black italic"
          )}>
            {ticket.priority === 'urgent' ? 'CRITICAL' : ticket.priority}
          </span>
        )}
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
        <Badge variant={TYPE_VARIANT[t.type]} className="text-[10px] px-1.5 py-0 font-medium uppercase">
          {t.type}
        </Badge>
      ),
    },
    { key: 'status', header: 'Status', width: '120px', render: (t) => t.status.replace('_', ' ') },
    {
      key: 'priority',
      header: 'Priority',
      width: '100px',
      render: (t) => (
        <span className={`font-medium ${PRIORITY_COLORS[t.priority]}`}>{t.priority !== 'none' ? t.priority : '-'}</span>
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
