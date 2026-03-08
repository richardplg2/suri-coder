import { useState, useCallback } from 'react'
import { ScrollArea, EmptyState } from '@agent-coding/ui'
import { Activity, CheckCircle, XCircle, Play, Award } from 'lucide-react'
import { useWsChannel } from 'renderer/hooks/use-ws-channel'
import { WsChannel, WsEvent } from '@agent-coding/shared'
import type { Ticket } from 'renderer/types/api'

interface LiveEvent {
  id: string
  event: string
  description: string
  timestamp: string
}

const EVENT_ICONS: Record<string, typeof Activity> = {
  [WsEvent.StepStarted]: Play,
  [WsEvent.StepCompleted]: CheckCircle,
  [WsEvent.StepFailed]: XCircle,
  [WsEvent.WorkflowCompleted]: Award,
}

function describeEvent(event: string, data: Record<string, unknown>): string {
  const stepName = (data.step_name as string) ?? 'Step'
  switch (event) {
    case WsEvent.StepStarted:
      return `${stepName} started`
    case WsEvent.StepCompleted:
      return `${stepName} completed`
    case WsEvent.StepFailed:
      return `${stepName} failed`
    case WsEvent.WorkflowCompleted:
      return 'Workflow completed'
    default:
      return event
  }
}

interface ActivityTabProps {
  ticket: Ticket
  projectId: string
}

export function ActivityTab({ ticket }: ActivityTabProps) {
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([])

  const handleWsEvent = useCallback((event: WsEvent, data: unknown) => {
    const payload = (data ?? {}) as Record<string, unknown>
    setLiveEvents((prev) => [
      {
        id: `${Date.now()}-${event}`,
        event,
        description: describeEvent(event, payload),
        timestamp: new Date().toISOString(),
      },
      ...prev,
    ])
  }, [])

  useWsChannel(WsChannel.TicketProgress, { ticket_id: ticket.id }, handleWsEvent)

  return (
    <ScrollArea className="h-full">
      <div className="space-y-3 p-4">
        {liveEvents.length === 0 && (
          <EmptyState icon={Activity} title="No activity yet" description="Events will appear here as the workflow runs." />
        )}
        {liveEvents.map((evt) => {
          const Icon = EVENT_ICONS[evt.event] ?? Activity
          return (
            <div key={evt.id} className="bento-cell flex items-start gap-3 p-3">
              <Icon className="mt-0.5 size-4 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-[13px]">{evt.description}</p>
                <span className="text-caption text-muted-foreground">
                  {new Date(evt.timestamp).toLocaleString()}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </ScrollArea>
  )
}
