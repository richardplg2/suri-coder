import { useState } from 'react'
import { Send } from 'lucide-react'
import { Badge, Button, Textarea } from '@agent-coding/ui'
import type { SpecComment } from 'renderer/stores/use-brainstorm-store'

const SECTION_COLORS: Record<string, string> = {
  problem: 'bg-accent/20 text-accent',
  solution: 'bg-green-500/20 text-green-400',
  requirements: 'bg-blue-500/20 text-blue-400',
  acceptance_criteria: 'bg-amber-500/20 text-amber-400',
  technical_notes: 'bg-purple-500/20 text-purple-400',
}

const AUTHOR_COLORS: Record<string, string> = {
  blue: 'bg-blue-500/20 border-blue-500/40 text-blue-400',
  purple: 'bg-purple-500/20 border-purple-500/40 text-purple-400',
  green: 'bg-green-500/20 border-green-500/40 text-green-400',
  amber: 'bg-amber-500/20 border-amber-500/40 text-amber-400',
}

const FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'problem', label: 'Problem' },
  { value: 'solution', label: 'Solution' },
  { value: 'requirements', label: 'Requirements' },
] as const

interface CommentPanelProps {
  comments: SpecComment[]
  onAddComment: (comment: Omit<SpecComment, 'id'>) => void
  onRemoveComment: (commentId: string) => void
}

export function CommentPanel({ comments, onAddComment, onRemoveComment }: Readonly<CommentPanelProps>) {
  const [filter, setFilter] = useState<string>('all')
  const [newComment, setNewComment] = useState('')

  const filtered = filter === 'all' ? comments : comments.filter((c) => c.sectionId === filter)

  const handleSend = () => {
    if (!newComment.trim()) return
    onAddComment({
      sectionId: filter !== 'all' ? filter : 'requirements',
      content: newComment.trim(),
      author: 'You',
      authorInitials: 'YO',
      authorColor: 'blue',
      timestamp: 'Just now',
    })
    setNewComment('')
  }

  return (
    <div className="flex h-full flex-col rounded-xl border border-border bg-surface">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-muted/20 px-6 py-4">
        <h3 className="flex items-center gap-2 font-bold">
          Comments ({comments.length})
        </h3>
        <Badge className="bg-accent/20 text-accent text-[10px] font-black uppercase">Active</Badge>
      </div>

      {/* Comment List */}
      <div className="flex-1 space-y-6 overflow-y-auto p-6">
        {filtered.map((comment) => (
          <CommentCard key={comment.id} comment={comment} />
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">No comments yet</p>
        )}
      </div>

      {/* Add Comment */}
      <div className="border-t border-border bg-muted/30 p-4">
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setFilter(opt.value)}
              className={`shrink-0 cursor-pointer rounded-full px-3 py-1 text-[11px] font-bold transition-colors ${
                filter === opt.value
                  ? 'bg-accent text-white'
                  : 'border border-border bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            rows={2}
            className="pr-10 text-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
          />
          <Button
            variant="ghost"
            size="icon-xs"
            className="absolute bottom-2 right-2 cursor-pointer text-accent hover:text-accent"
            onClick={handleSend}
          >
            <Send className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

function CommentCard({ comment }: Readonly<{ comment: SpecComment }>) {
  const authorStyle = AUTHOR_COLORS[comment.authorColor] ?? AUTHOR_COLORS.blue
  const sectionStyle = SECTION_COLORS[comment.sectionId] ?? SECTION_COLORS.requirements

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`flex size-8 items-center justify-center rounded-full border ${authorStyle}`}>
            <span className="text-xs font-bold">{comment.authorInitials}</span>
          </div>
          <p className="text-sm font-bold">{comment.author}</p>
        </div>
        <span className="text-[10px] text-muted-foreground">{comment.timestamp}</span>
      </div>
      <div className="rounded-lg border border-border/50 bg-muted/30 p-4">
        <span className={`mb-2 inline-block rounded px-2 py-0.5 text-[10px] font-bold ${sectionStyle}`}>
          {comment.sectionId.replaceAll('_', ' ')}
        </span>
        <p className="text-sm leading-relaxed text-muted-foreground">{comment.content}</p>
      </div>
    </div>
  )
}
