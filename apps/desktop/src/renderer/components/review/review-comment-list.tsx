import { ScrollArea } from '@agent-coding/ui'
import { FileText, Trash2, MessageSquare } from 'lucide-react'
import type { ReviewComment } from 'renderer/components/review/review-panel'

interface ReviewCommentListProps {
  comments: ReviewComment[]
  onDelete: (id: string) => void
  onClickComment?: (comment: ReviewComment) => void
}

export function ReviewCommentList({ comments, onDelete, onClickComment }: ReviewCommentListProps) {
  const grouped = comments.reduce<Record<string, ReviewComment[]>>((acc, c) => {
    ;(acc[c.file] ??= []).push(c)
    return acc
  }, {})

  return (
    <div className="border-t border-border">
      <div className="section-header flex items-center gap-2 px-4 py-2">
        <MessageSquare className="size-3.5" />
        Comments ({comments.length})
      </div>
      <ScrollArea className="max-h-48">
        <div className="px-4 pb-3 space-y-3">
          {Object.entries(grouped).map(([file, fileComments]) => (
            <div key={file}>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1">
                <FileText className="size-3" />
                {file}
              </div>
              <div className="space-y-1.5 pl-4">
                {fileComments.map((comment) => (
                  <div
                    key={comment.id}
                    className="flex items-start gap-2 rounded-md border border-border bg-card px-3 py-2 cursor-pointer hover:bg-secondary/30"
                    onClick={() => onClickComment?.(comment)}
                  >
                    <div className="flex-1">
                      <span className="text-[10px] text-muted-foreground">
                        Line {comment.line_start}{comment.line_end !== comment.line_start ? `-${comment.line_end}` : ''}
                      </span>
                      <p className="text-[12px] mt-0.5">{comment.text}</p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onDelete(comment.id) }}
                      className="text-muted-foreground hover:text-red-400 shrink-0"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
