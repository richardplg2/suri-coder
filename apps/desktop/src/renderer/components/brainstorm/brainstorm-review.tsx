import { useState } from 'react'
import { Button, ScrollArea, Input } from '@agent-coding/ui'
import { MessageSquare, Sparkles, Ticket, Trash2 } from 'lucide-react'
import { TiptapEditor } from 'renderer/components/tiptap-editor'
import { useBrainstormBatchUpdate, useCreateTicketFromBrainstorm } from 'renderer/hooks/queries/use-brainstorm'
import { useTabStore } from 'renderer/stores/use-tab-store'

interface BrainstormReviewProps {
  summary: string
  specs: Record<string, string>
  sessionId: string
  projectId: string
}

interface InlineComment {
  id: string
  section: string
  text: string
  range: { from: number; to: number }
  selectedText: string
}

export function BrainstormReview({ summary, specs, sessionId, projectId }: BrainstormReviewProps) {
  const [comments, setComments] = useState<InlineComment[]>([])
  const [currentSelection, setCurrentSelection] = useState<{
    from: number
    to: number
    text: string
  } | null>(null)
  const [commentInput, setCommentInput] = useState('')
  const [title, setTitle] = useState('')

  const batchUpdate = useBrainstormBatchUpdate(projectId)
  const createTicket = useCreateTicketFromBrainstorm(projectId)

  const handleAddComment = () => {
    if (!currentSelection || !commentInput.trim()) return
    const newComment: InlineComment = {
      id: crypto.randomUUID(),
      section: 'summary',
      text: commentInput.trim(),
      range: { from: currentSelection.from, to: currentSelection.to },
      selectedText: currentSelection.text,
    }
    setComments((prev) => [...prev, newComment])
    setCommentInput('')
    setCurrentSelection(null)
  }

  const handleDeleteComment = (id: string) => {
    setComments((prev) => prev.filter((c) => c.id !== id))
  }

  const handleBatchUpdate = () => {
    batchUpdate.mutate({
      sessionId,
      payload: {
        comments: comments.map((c) => ({
          section: c.section,
          text: c.text,
          range: c.range,
        })),
      },
    })
  }

  const handleCreateTicket = () => {
    createTicket.mutate(
      { session_id: sessionId, title: title || 'Untitled Ticket' },
      {
        onSuccess: (data) => {
          useTabStore.getState().openTicketTab(data.ticket_id, projectId, title || 'Untitled Ticket')
        },
      },
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border p-4">
        <h2 className="text-base font-semibold">Review Brainstorm Output</h2>
        <p className="text-caption text-muted-foreground mt-1">
          Review the summary below. Select text to add comments, then batch update or create ticket.
        </p>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Editor */}
        <div className="flex-1 overflow-auto">
          <TiptapEditor
            content={summary}
            editable={false}
            onSelectionChange={setCurrentSelection}
          />

          {currentSelection && (
            <div className="mx-4 mb-4 flex items-center gap-2 rounded-lg border border-border bg-card p-3">
              <MessageSquare className="size-4 text-muted-foreground shrink-0" />
              <span className="text-caption text-muted-foreground truncate max-w-48">
                &ldquo;{currentSelection.text}&rdquo;
              </span>
              <Input
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                placeholder="Add your comment..."
                className="flex-1 text-[13px]"
                autoFocus
              />
              <Button size="sm" onClick={handleAddComment} disabled={!commentInput.trim()}>
                Add
              </Button>
            </div>
          )}
        </div>

        {/* Comment list sidebar */}
        <div className="w-72 border-l border-border">
          <div className="section-header px-4 py-3">Comments ({comments.length})</div>
          <ScrollArea className="h-full">
            <div className="space-y-2 p-4">
              {comments.map((comment) => (
                <div key={comment.id} className="rounded-lg border border-border bg-card p-3">
                  <div className="text-caption text-muted-foreground italic truncate">
                    &ldquo;{comment.selectedText}&rdquo;
                  </div>
                  <p className="mt-1 text-[13px]">{comment.text}</p>
                  <button
                    type="button"
                    onClick={() => handleDeleteComment(comment.id)}
                    className="mt-1 text-caption text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Action bar */}
      <div className="border-t border-border p-4">
        <div className="flex items-center gap-3">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ticket title..."
            className="flex-1"
          />
          <Button
            variant="outline"
            onClick={handleBatchUpdate}
            disabled={comments.length === 0 || batchUpdate.isPending}
          >
            <Sparkles className="mr-1.5 size-3.5" />
            Batch Update with AI
          </Button>
          <Button onClick={handleCreateTicket} disabled={createTicket.isPending}>
            <Ticket className="mr-1.5 size-3.5" />
            Create Ticket
          </Button>
        </div>
      </div>
    </div>
  )
}
