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
