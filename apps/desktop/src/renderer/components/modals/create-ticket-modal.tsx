import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@agent-coding/ui'
import { Bot, Figma } from 'lucide-react'
import { useModalStore } from 'renderer/stores/use-modal-store'
import { useTabStore } from 'renderer/stores/use-tab-store'

export function CreateTicketModal() {
  const { activeModal, modalData, close } = useModalStore()
  const isOpen = activeModal === 'create-ticket'
  const projectId = (modalData?.projectId as string) ?? ''

  const handleStartWithAI = () => {
    close()
    useTabStore.getState().openBrainstormTab(projectId, 'New Brainstorm')
  }

  const handleStartFromFigma = () => {
    close()
    useTabStore.getState().openFigmaImportTab(projectId, 'Figma Import')
  }

  return (
    <Dialog open={isOpen} onOpenChange={close}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create New Ticket</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-4">
          <button
            type="button"
            onClick={handleStartWithAI}
            className="flex flex-col items-center gap-3 rounded-xl border-2 border-border p-6 transition-all hover:border-primary hover:bg-primary/5 cursor-pointer"
          >
            <Bot className="size-10 text-blue-400" />
            <div className="text-center">
              <div className="text-[14px] font-semibold">Start with AI</div>
              <p className="mt-1 text-caption text-muted-foreground">
                AI will ask questions to understand your requirements and generate specs.
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={handleStartFromFigma}
            className="flex flex-col items-center gap-3 rounded-xl border-2 border-border p-6 transition-all hover:border-primary hover:bg-primary/5 cursor-pointer"
          >
            <Figma className="size-10 text-purple-400" />
            <div className="text-center">
              <div className="text-[14px] font-semibold">Start from Figma</div>
              <p className="mt-1 text-caption text-muted-foreground">
                Import annotated Figma designs and generate specs from them.
              </p>
            </div>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
