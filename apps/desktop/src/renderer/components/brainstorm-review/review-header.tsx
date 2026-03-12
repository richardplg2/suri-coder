import { ArrowLeft, Sparkles, SquarePlus } from 'lucide-react'
import { Button } from '@agent-coding/ui'

interface ReviewHeaderProps {
  onBack?: () => void
  onRevise: () => void
  onCreateTicket: () => void
}

export function ReviewHeader({ onBack, onRevise, onCreateTicket }: Readonly<ReviewHeaderProps>) {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border/50 bg-background/80 px-6 py-3 backdrop-blur-md">
      <div className="flex items-center gap-4">
        {onBack && (
          <Button variant="ghost" size="icon-sm" onClick={onBack} className="cursor-pointer">
            <ArrowLeft className="size-4" />
          </Button>
        )}
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-accent/20 p-1.5">
            <Sparkles className="size-4 text-accent" />
          </div>
          <h1 className="text-lg font-bold tracking-tight">Brainstorm Review</h1>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={onRevise} className="cursor-pointer">
          <Sparkles className="mr-1.5 size-3.5" />
          Revise with AI
        </Button>
        <Button size="sm" onClick={onCreateTicket} className="cursor-pointer">
          <SquarePlus className="mr-1.5 size-3.5" />
          Create Ticket
        </Button>
      </div>
    </header>
  )
}
