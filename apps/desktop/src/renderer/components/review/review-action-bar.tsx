import { Button } from '@agent-coding/ui'
import { Check, MessageSquareWarning, Loader2 } from 'lucide-react'
import { useApproveReview, useRequestChanges } from 'renderer/hooks/queries/use-workflow-actions'
import type { ReviewComment } from 'renderer/components/review/review-panel'

interface ReviewActionBarProps {
  stepId: string
  ticketId: string
  projectId: string
  comments: ReviewComment[]
  submittedChanges: boolean
  onCommentsCleared: () => void
}

export function ReviewActionBar({ stepId, ticketId, projectId, comments, submittedChanges, onCommentsCleared }: ReviewActionBarProps) {
  const approveReview = useApproveReview(projectId, ticketId)
  const requestChanges = useRequestChanges(projectId, ticketId)

  const handleApprove = () => {
    approveReview.mutate(stepId)
  }

  const handleRequestChanges = () => {
    requestChanges.mutate(
      {
        stepId,
        payload: {
          comments: comments.map((c) => ({
            file: c.file,
            line: c.line_start,
            comment: c.text,
          })),
        },
      },
      { onSuccess: () => onCommentsCleared() },
    )
  }

  return (
    <div className="flex items-center justify-between border-t border-border/50 glass-panel px-4 py-3">
      <div className="text-caption text-muted-foreground">
        {submittedChanges ? (
          <span className="flex items-center gap-1.5 text-yellow-400">
            <Loader2 className="size-3 animate-spin" />
            Agent is processing changes...
          </span>
        ) : comments.length > 0
          ? `${comments.length} comment${comments.length > 1 ? 's' : ''} pending`
          : 'No comments'}
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={handleRequestChanges}
          disabled={comments.length === 0 || requestChanges.isPending}
        >
          <MessageSquareWarning className="mr-1.5 size-3.5" />
          Request Changes
        </Button>
        <Button
          onClick={handleApprove}
          disabled={approveReview.isPending}
        >
          <Check className="mr-1.5 size-3.5" />
          Approve
        </Button>
      </div>
    </div>
  )
}
