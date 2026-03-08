import { useState } from 'react'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
  Button,
} from '@agent-coding/ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Sparkles, PenTool } from 'lucide-react'
import { apiClient } from 'renderer/lib/api-client'
import { useModalStore } from 'renderer/stores/use-modal-store'
import { useTabStore } from 'renderer/stores/use-tab-store'
import type { Ticket, TicketSource } from 'renderer/types/api'

type TicketMode = 'ai_brainstorm' | 'figma'

const modes: { id: TicketMode; icon: typeof Sparkles; iconBg: string; iconColor: string; label: string; description: string }[] = [
  {
    id: 'ai_brainstorm',
    icon: Sparkles,
    iconBg: 'bg-purple-500/20',
    iconColor: 'text-purple-400',
    label: 'AI Brainstorm',
    description: 'Let AI guide you through discovery...',
  },
  {
    id: 'figma',
    icon: PenTool,
    iconBg: 'bg-orange-500/20',
    iconColor: 'text-orange-400',
    label: 'From Figma',
    description: 'Import Figma designs and components...',
  },
]

export function CreateTicketModal() {
  const { activeModal, modalData, close } = useModalStore()
  const isOpen = activeModal === 'create-ticket'
  const projectId = (modalData?.projectId as string) ?? ''
  const qc = useQueryClient()
  const openTicketTab = useTabStore((s) => s.openTicketTab)
  const [selected, setSelected] = useState<TicketMode>('ai_brainstorm')

  const createAndOpen = useMutation({
    mutationFn: ({ pid, source }: { pid: string; source: TicketSource }) =>
      apiClient<Ticket>(`/projects/${pid}/tickets`, {
        method: 'POST',
        body: JSON.stringify({ title: 'Untitled ticket', source }),
      }),
    onSuccess: (ticket, { pid }) => {
      qc.invalidateQueries({ queryKey: ['projects', pid, 'tickets'] })
      openTicketTab(pid, ticket.id, `${ticket.key}: ${ticket.title}`)
    },
  })

  const handleContinue = () => {
    const pid = projectId
    close()
    createAndOpen.mutate({ pid, source: selected })
  }

  return (
    <Dialog open={isOpen} onOpenChange={close}>
      <DialogContent className="max-w-[480px] gap-0 p-0 overflow-hidden" showCloseButton={false}>
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="text-base">New Ticket</DialogTitle>
          <DialogDescription>How would you like to start?</DialogDescription>
        </DialogHeader>

        {/* Mode cards */}
        <div className="px-6 grid grid-cols-2 gap-3">
          {modes.map((mode) => {
            const Icon = mode.icon
            const isSelected = selected === mode.id
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => setSelected(mode.id)}
                className={`flex flex-col items-start p-4 rounded-lg text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'border-2 border-primary bg-primary/5 shadow-[0_0_12px_rgba(10,133,255,0.15)]'
                    : 'border border-border bg-surface-elevated hover:bg-surface-elevated-hover'
                }`}
              >
                <div className={`size-8 rounded-md ${mode.iconBg} flex items-center justify-center mb-3`}>
                  <Icon className={`size-4 ${mode.iconColor}`} />
                </div>
                <p className="text-[13px] font-medium text-foreground">{mode.label}</p>
                <p className="text-[11px] leading-tight text-muted-foreground mt-1">{mode.description}</p>
              </button>
            )
          })}
        </div>

        {/* Spacer for content area (future: Figma URL input, etc.) */}
        <div className="px-6 py-6 min-h-[60px]" />

        {/* Footer */}
        <DialogFooter className="px-6 py-4 bg-muted/50 border-t border-border flex-row justify-between sm:justify-between">
          <Button variant="ghost" onClick={close} className="text-muted-foreground">
            Cancel
          </Button>
          <Button onClick={handleContinue} disabled={createAndOpen.isPending}>
            {selected === 'figma' ? 'Import & Continue' : 'Start Brainstorm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
