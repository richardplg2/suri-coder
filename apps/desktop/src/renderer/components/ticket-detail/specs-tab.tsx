import { useState } from 'react'
import {
  ScrollArea, Badge, Button, Textarea, EmptyState,
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@agent-coding/ui'
import { Edit, History, ChevronDown, ChevronRight, FileText } from 'lucide-react'
import { useSpecs, useUpdateSpec, useSpecHistory } from 'renderer/hooks/queries/use-specs'
import type { Ticket, SpecType, TicketSpec } from 'renderer/types/api'

const SPEC_TYPE_COLORS: Record<SpecType, string> = {
  feature: 'bg-blue-500/15 text-blue-400',
  design: 'bg-pink-500/15 text-pink-400',
  plan: 'bg-purple-500/15 text-purple-400',
  test: 'bg-green-500/15 text-green-400',
}

interface SpecsTabProps {
  ticket: Ticket
  projectId: string
}

function HistoryDialog({ ticketId, specId, onClose }: { ticketId: string; specId: string; onClose: () => void }) {
  const { data: history = [] } = useSpecHistory(ticketId, specId)
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Revision History</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {history.length === 0 && (
            <div className="text-[13px] text-muted-foreground">No revision history.</div>
          )}
          {history.map((rev) => (
            <div key={rev.id} className="rounded border border-border p-3">
              <div className="flex items-center justify-between text-[13px]">
                <span className="font-medium">Revision {rev.revision}</span>
                <span className="text-caption text-muted-foreground">
                  {new Date(rev.updated_at).toLocaleString()}
                </span>
              </div>
              <pre className="mt-1 whitespace-pre-wrap text-[12px] text-muted-foreground">{rev.content}</pre>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function SpecsTab({ ticket }: SpecsTabProps) {
  const { data: specs = [] } = useSpecs(ticket.id)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [historySpecId, setHistorySpecId] = useState<string | null>(null)

  const handleStartEdit = (spec: TicketSpec) => {
    setEditingId(spec.id)
    setEditContent(spec.content)
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-2 p-4">
        {specs.length === 0 && (
          <EmptyState icon={FileText} title="No specs yet" description="Specs will appear here after brainstorming." />
        )}
        {specs.map((spec) => (
          <SpecRow
            key={spec.id}
            spec={spec}
            ticketId={ticket.id}
            isExpanded={expandedId === spec.id}
            isEditing={editingId === spec.id}
            editContent={editContent}
            onToggle={() => setExpandedId(expandedId === spec.id ? null : spec.id)}
            onStartEdit={() => handleStartEdit(spec)}
            onCancelEdit={() => setEditingId(null)}
            onEditContentChange={setEditContent}
            onShowHistory={() => setHistorySpecId(spec.id)}
          />
        ))}
      </div>

      {historySpecId && (
        <HistoryDialog ticketId={ticket.id} specId={historySpecId} onClose={() => setHistorySpecId(null)} />
      )}
    </ScrollArea>
  )
}

interface SpecRowProps {
  spec: TicketSpec
  ticketId: string
  isExpanded: boolean
  isEditing: boolean
  editContent: string
  onToggle: () => void
  onStartEdit: () => void
  onCancelEdit: () => void
  onEditContentChange: (content: string) => void
  onShowHistory: () => void
}

function SpecRow({
  spec, ticketId, isExpanded, isEditing, editContent,
  onToggle, onStartEdit, onCancelEdit, onEditContentChange, onShowHistory,
}: SpecRowProps) {
  const updateSpec = useUpdateSpec(ticketId, spec.id)

  const handleSave = () => {
    updateSpec.mutate({ content: editContent }, { onSuccess: onCancelEdit })
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <button
        type="button"
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
        onClick={onToggle}
      >
        {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        <Badge className={`text-[10px] px-1.5 py-0 ${SPEC_TYPE_COLORS[spec.type]}`}>{spec.type}</Badge>
        <span className="flex-1 text-[13px] font-medium">{spec.title}</span>
        <span className="text-caption text-muted-foreground">rev {spec.revision}</span>
        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); onStartEdit() }}>
          <Edit className="size-3.5" />
        </Button>
        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); onShowHistory() }}>
          <History className="size-3.5" />
        </Button>
      </button>

      {isExpanded && (
        <div className="border-t border-border px-4 py-3">
          {isEditing ? (
            <div className="space-y-2">
              <Textarea value={editContent} onChange={(e) => onEditContentChange(e.target.value)} rows={10} />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSave} disabled={updateSpec.isPending}>Save</Button>
                <Button size="sm" variant="outline" onClick={onCancelEdit}>Cancel</Button>
              </div>
            </div>
          ) : (
            <pre className="whitespace-pre-wrap text-[13px] text-muted-foreground">{spec.content}</pre>
          )}
        </div>
      )}
    </div>
  )
}
