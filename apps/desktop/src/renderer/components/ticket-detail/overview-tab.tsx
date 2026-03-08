import { useState } from 'react'
import { ScrollArea, Button, Input, Textarea, KVRow } from '@agent-coding/ui'
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
      <div className="p-4">
        <div className="bento-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          {/* Description — spans 2 columns */}
          <div className="bento-cell-lg bento-span-2">
            <label className="section-header mb-2 block">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Describe the ticket..."
            />
          </div>

          {/* Details — right column, spans 2 rows */}
          <div className="bento-cell bento-span-row-2">
            <h3 className="section-header mb-3">Details</h3>
            <div className="space-y-1">
              <KVRow label="Type" value={ticket.type} />
              <KVRow label="Priority" value={ticket.priority} />
              <KVRow label="Status" value={ticket.status.replace('_', ' ')} />
              <KVRow label="Created" value={new Date(ticket.created_at).toLocaleDateString()} />
            </div>
          </div>

          {/* Settings */}
          <div className="bento-cell">
            <h3 className="section-header mb-3">Settings</h3>
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
                <div className="text-caption text-muted-foreground">Run steps automatically</div>
              </div>
            </label>
          </div>

          {/* Budget */}
          <div className="bento-cell">
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
        </div>

        <div className="mt-4">
          <Button onClick={handleSave} disabled={updateTicket.isPending}>
            <Save className="mr-1.5 size-3.5" />
            Save Changes
          </Button>
        </div>
      </div>
    </ScrollArea>
  )
}
