import { useState } from 'react'
import { ScrollArea, Button, Input, Textarea, Separator, KVRow } from '@agent-coding/ui'
import { Save, DollarSign, Zap } from 'lucide-react'
import { useUpdateTicket } from 'renderer/hooks/queries/use-tickets'
import type { Ticket } from 'renderer/types/api'

interface OverviewTabProps {
  ticket: Ticket
  projectId: string
}

export function OverviewTab({ ticket, projectId }: OverviewTabProps) {
  const [description, setDescription] = useState(ticket.description ?? '')
  const [budgetUsd, setBudgetUsd] = useState(ticket.budget_usd?.toString() ?? '')
  const [autoExecute, setAutoExecute] = useState(ticket.auto_execute)
  const updateTicket = useUpdateTicket(projectId, ticket.id)

  const handleSave = () => {
    updateTicket.mutate({
      description: description || null,
      budget_usd: budgetUsd ? Number.parseFloat(budgetUsd) : null,
      auto_execute: autoExecute,
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
            <label className="flex cursor-pointer items-center gap-3">
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
