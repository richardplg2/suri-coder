import { ScrollArea, StatusBadge } from '@agent-coding/ui'
import { useProjectNavStore } from 'renderer/stores/use-project-nav-store'
import { useTabStore } from 'renderer/stores/use-tab-store'

// --- Mock data (replace with real API later) ---

const MOCK_NEEDS_ATTENTION = [
  { id: 't-8', key: 'T-08', title: 'Login refactor needs review', status: 'warning' as const, statusLabel: 'Review Pending', project: 'WebManager', projectId: 'p1' },
  { id: 't-15', key: 'T-15', title: 'API endpoint tests failing', status: 'failed' as const, statusLabel: 'Agent Failed', project: 'ApiTool', projectId: 'p2' },
  { id: 't-21', key: 'T-21', title: 'Clarify auth flow requirements', status: 'running' as const, statusLabel: 'Needs Input', project: 'SuriCoder', projectId: 'p1' },
]

const MOCK_RUNNING = [
  { id: 't-14', key: 'T-14', title: 'Refactor database layer', step: 'Coding', project: 'my-app', projectId: 'p1' },
  { id: 't-9', key: 'T-9', title: 'Add API rate limiting', step: 'Testing', project: 'api-srv', projectId: 'p2' },
]

const MOCK_ACTIVITY = [
  { id: '1', ticketKey: 'T-12', event: 'Review completed', time: '2m ago', projectId: 'p1' },
  { id: '2', ticketKey: 'T-14', event: 'Coding started', time: '5m ago', projectId: 'p1' },
  { id: '3', ticketKey: 'T-8', event: 'Test failed (3 errors)', time: '12m ago', projectId: 'p2' },
  { id: '4', ticketKey: 'T-15', event: 'Agent needs input', time: '20m ago', projectId: 'p1' },
]

// --- Component ---

function SectionDivider({ title }: Readonly<{ title: string }>) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <h2 className="section-header shrink-0">{title}</h2>
      <div className="h-px flex-1 bg-border/50" />
    </div>
  )
}

export function HomeScreen() {
  const { setActiveProject } = useProjectNavStore()
  const { openTicketTab } = useTabStore()

  const navigateToTicket = (projectId: string, ticketId: string, label: string) => {
    setActiveProject(projectId)
    openTicketTab(projectId, ticketId, label)
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-6">
        <h1 className="mb-8 text-lg font-semibold tracking-tight">Dashboard</h1>

        {/* Needs Attention */}
        <section className="mb-10">
          <SectionDivider title="Needs Attention" />
          <div className="bento-grid-3">
            {MOCK_NEEDS_ATTENTION.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => navigateToTicket(item.projectId, item.id, item.key)}
                className="bento-cell cursor-pointer text-left flex flex-col gap-3"
              >
                <div className="flex items-start justify-between">
                  <span className="font-mono text-[11px] text-muted-foreground bg-background px-2 py-0.5 rounded border border-border">
                    {item.key}
                  </span>
                  <StatusBadge status={item.status} showDot={false}>
                    {item.statusLabel}
                  </StatusBadge>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground leading-snug">{item.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1">Project: {item.project}</p>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Running Now */}
        <section className="mb-8">
          <SectionDivider title="Running Now" />
          <div className="bento-grid-3">
            {MOCK_RUNNING.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => navigateToTicket(item.projectId, item.id, item.key)}
                className="bento-cell cursor-pointer text-left"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold">{item.key}</span>
                  <StatusBadge status="running" label={item.step} />
                </div>
                <p className="text-xs text-muted-foreground truncate">{item.title}</p>
                <p className="mt-1 text-[11px] text-muted-foreground/70">{item.project}</p>
              </button>
            ))}
          </div>
        </section>

        {/* Recent Activity */}
        <section>
          <SectionDivider title="Recent Activity" />
          <div className="bento-cell p-0">
            {MOCK_ACTIVITY.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => navigateToTicket(item.projectId, item.id, item.ticketKey)}
                className="flex w-full items-center justify-between px-4 py-2.5 text-left cursor-pointer transition-colors duration-150 hover:bg-[var(--surface-hover)] first:rounded-t-[12px] last:rounded-b-[12px]"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-[var(--accent)]">{item.ticketKey}</span>
                  <span className="text-xs text-foreground">{item.event}</span>
                </div>
                <span className="text-[11px] text-muted-foreground">{item.time}</span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </ScrollArea>
  )
}
