import { Loader2, PlusCircle } from 'lucide-react'
import { ScrollArea, StatusBadge, Table, TableBody, TableRow, TableCell } from '@agent-coding/ui'
import { useProjectNavStore } from 'renderer/stores/use-project-nav-store'
import { useTabStore } from 'renderer/stores/use-tab-store'

// --- Mock data (replace with real API later) ---

const MOCK_NEEDS_ATTENTION = [
  { id: 't-8', key: 'T-08', title: 'Login refactor needs review', status: 'warning' as const, statusLabel: 'Review Pending', project: 'WebManager', projectId: 'p1' },
  { id: 't-15', key: 'T-15', title: 'API endpoint tests failing', status: 'failed' as const, statusLabel: 'Agent Failed', project: 'ApiTool', projectId: 'p2' },
  { id: 't-21', key: 'T-21', title: 'Clarify auth flow requirements', status: 'running' as const, statusLabel: 'Needs Input', project: 'SuriCoder', projectId: 'p1' },
]

const MOCK_RUNNING = [
  { id: 't-14', key: 'T-14', title: 'Login Flow Implementation', step: 'Design', session: 2, duration: '12m', project: 'my-app', projectId: 'p1' },
  { id: 't-19', key: 'T-19', title: 'Dashboard Widgets', step: 'Implementation', session: 1, duration: '3m', project: 'api-srv', projectId: 'p2' },
]

const MOCK_ACTIVITY = [
  { id: '1', ticketKey: 'T-14', event: 'Design session #2 started', time: '2m ago', projectId: 'p1' },
  { id: '2', ticketKey: 'T-08', event: 'Review requested for auth-refactor-v2', time: '14m ago', projectId: 'p1' },
  { id: '3', ticketKey: 'T-15', event: 'Automated test agent failed on CI/CD Pipeline', time: '45m ago', projectId: 'p2' },
  { id: '4', ticketKey: 'T-19', event: 'Task moved from Backlog to In Progress', time: '1h ago', projectId: 'p1' },
  { id: '5', ticketKey: 'T-05', event: 'Deployment successful to production-web-01', time: '3h ago', projectId: 'p1' },
  { id: '6', ticketKey: 'T-21', event: 'New comment from @alex_dev on requirements', time: '5h ago', projectId: 'p1' },
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
        <section className="mb-10">
          <SectionDivider title="Running Now" />
          <div className="bento-grid-3">
            {MOCK_RUNNING.map((item) => (
              <div
                key={item.id}
                className="bento-cell relative overflow-hidden p-5"
              >
                {/* Left accent bar */}
                <div className="absolute top-0 left-0 w-1 h-full bg-primary" />

                <div className="flex items-center justify-between mb-4">
                  <span className="font-mono text-[11px] text-muted-foreground">{item.key}</span>
                  <div className="flex items-center gap-2">
                    <Loader2 className="size-[18px] text-primary animate-spin" style={{ animationDuration: '3s' }} />
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">{item.step}</span>
                  </div>
                </div>

                <h3 className="text-base font-semibold text-foreground mb-1">{item.title}</h3>
                <p className="text-xs text-muted-foreground">
                  Session #{item.session} running for <span className="text-primary">{item.duration}</span>
                </p>

                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    className="bg-primary/10 hover:bg-primary/20 text-primary text-[11px] font-bold py-1 px-3 rounded-[6px] border border-primary/20 transition-colors duration-150 cursor-pointer"
                  >
                    STOP
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateToTicket(item.projectId, item.id, item.key)}
                    className="bg-muted/50 hover:bg-muted text-muted-foreground text-[11px] font-bold py-1 px-3 rounded-[6px] border border-border transition-colors duration-150 cursor-pointer"
                  >
                    DETAILS
                  </button>
                </div>
              </div>
            ))}

            {/* New Session placeholder */}
            <button
              type="button"
              className="border border-dashed border-border rounded-[var(--bento-radius)] p-5 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground hover:border-muted-foreground cursor-pointer transition-colors duration-150"
            >
              <PlusCircle className="size-8" />
              <span className="text-xs font-medium">New Session</span>
            </button>
          </div>
        </section>

        {/* Recent Activity */}
        <section>
          <SectionDivider title="Recent Activity" />
          <div className="bento-cell p-0 overflow-hidden">
            <Table>
              <TableBody>
                {MOCK_ACTIVITY.map((item) => (
                  <TableRow
                    key={item.id}
                    className="cursor-pointer hover:bg-[var(--surface-hover)] transition-colors duration-150 border-border/50"
                    onClick={() => navigateToTicket(item.projectId, item.id, item.ticketKey)}
                  >
                    <TableCell className="w-20 font-mono text-xs text-muted-foreground py-4 px-4">
                      {item.ticketKey}
                    </TableCell>
                    <TableCell className="text-xs text-foreground py-4 px-4">
                      {item.event}
                    </TableCell>
                    <TableCell className="text-right text-[11px] text-muted-foreground py-4 px-4">
                      {item.time}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      </div>
    </ScrollArea>
  )
}
