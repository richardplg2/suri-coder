import { ReviewHeader } from './review-header'
import { SpecViewer } from './spec-viewer'
import { CommentPanel } from './comment-panel'
import { TicketActionBar } from './ticket-action-bar'
import { useBrainstormStore } from 'renderer/stores/use-brainstorm-store'
import type { BrainstormSession } from 'renderer/stores/use-brainstorm-store'

interface BrainstormReviewProps {
  session: BrainstormSession
  onRevise: () => void
}

export function BrainstormReview({ session, onRevise }: Readonly<BrainstormReviewProps>) {
  const addComment = useBrainstormStore((s) => s.addComment)
  const removeComment = useBrainstormStore((s) => s.removeComment)
  const updateTicketDraft = useBrainstormStore((s) => s.updateTicketDraft)

  if (!session.spec) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        No spec generated yet. Continue brainstorming first.
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <ReviewHeader
        onRevise={onRevise}
        onCreateTicket={() => {}}
      />

      <main className="flex min-h-0 flex-1 gap-8 overflow-hidden p-8">
        {/* Left: Spec (60%) */}
        <div className="flex min-h-0 flex-[0.6] flex-col">
          <SpecViewer spec={session.spec} />
        </div>

        {/* Right: Comments (40%) */}
        <div className="flex min-h-0 flex-[0.4] flex-col">
          <CommentPanel
            comments={session.comments}
            onAddComment={(comment) => addComment(session.id, comment)}
            onRemoveComment={(commentId) => removeComment(session.id, commentId)}
          />
        </div>
      </main>

      <TicketActionBar
        draft={session.ticketDraft}
        onUpdate={(draft) => updateTicketDraft(session.id, draft)}
        onDiscard={() => {}}
        onCreateTicket={() => {}}
      />
    </div>
  )
}
