import { useState, useCallback } from 'react'
import { ScrollArea, DiffViewer, InlineComment, Button, Textarea } from '@agent-coding/ui'
import type { DiffLine } from '@agent-coding/ui'
import { MessageSquare, Plus } from 'lucide-react'
import type { ReviewComment } from 'renderer/components/review/review-panel'

interface ReviewDiffViewProps {
  diff: string
  filePath: string
  comments: ReviewComment[]
  onAddComment: (lineStart: number, lineEnd: number, text: string) => void
}

export function ReviewDiffView({ diff, filePath, comments, onAddComment }: ReviewDiffViewProps) {
  const lines = parseDiffToLines(diff)
  const [commentingLine, setCommentingLine] = useState<number | null>(null)
  const [commentText, setCommentText] = useState('')

  const handleSubmitComment = () => {
    if (commentingLine !== null && commentText.trim()) {
      onAddComment(commentingLine, commentingLine, commentText.trim())
      setCommentText('')
      setCommentingLine(null)
    }
  }

  const handleLineClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const row = (e.target as HTMLElement).closest('tr')
    if (!row) return
    const tbody = row.closest('tbody')
    if (!tbody) return
    const rowIndex = Array.from(tbody.children).indexOf(row)
    // Account for annotation rows interleaved — find the actual diff line index
    const line = lines[rowIndex]
    if (!line || line.lineNumber === undefined) return
    const lineNum = line.lineNumber?.new ?? line.lineNumber?.old ?? 0
    if (lineNum > 0) {
      setCommentingLine(lineNum)
    }
  }, [lines])

  const renderLineAnnotation = (lineIndex: number) => {
    const line = lines[lineIndex]
    if (!line) return null

    const lineNum = line.lineNumber?.new ?? line.lineNumber?.old ?? 0
    const lineComments = comments.filter(
      (c) => c.line_start <= lineNum && c.line_end >= lineNum,
    )

    const hasComment = lineComments.length > 0
    const isCommenting = commentingLine === lineNum

    // Don't render annotations for hunk header lines
    if (line.isHunkHeader) return null

    return (
      <>
        {hasComment &&
          lineComments.map((comment) => (
            <InlineComment
              key={comment.id}
              author="user"
              content={comment.text}
            />
          ))}
        {isCommenting && (
          <tr>
            <td colSpan={4} className="p-3 bg-card border-y border-border">
              <div className="flex items-start gap-2">
                <MessageSquare className="mt-1 size-4 text-muted-foreground shrink-0" />
                <div className="flex-1 space-y-2">
                  <Textarea
                    value={commentText}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCommentText(e.target.value)}
                    placeholder="Write a comment..."
                    rows={3}
                    autoFocus
                    className="text-[12px]"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSubmitComment} disabled={!commentText.trim()}>
                      Add Comment
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setCommentingLine(null); setCommentText('') }}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            </td>
          </tr>
        )}
      </>
    )
  }

  return (
    <ScrollArea className="flex-1">
      <div className="sticky top-0 z-10 border-b border-border bg-card px-4 py-2 text-[13px] font-medium font-mono">
        {filePath}
      </div>
      <div className="relative" onClick={handleLineClick}>
        <DiffViewer
          lines={lines}
          renderLineAnnotation={renderLineAnnotation}
        />
        <style>{`
          [data-slot="diff-viewer"] tr:has(+ tr [data-slot="inline-comment"]) {
            background: color-mix(in srgb, var(--warning) 8%, transparent);
          }
          [data-slot="diff-viewer"] tr:has(+ tr [data-slot="inline-comment"]) td:first-child {
            border-left: 2px solid var(--warning);
          }
          [data-slot="diff-viewer"] tr[data-hunk-header] {
            background: color-mix(in srgb, var(--info, #3b82f6) 10%, transparent);
          }
          [data-slot="diff-viewer"] tr[data-hunk-header] td {
            color: var(--info, #3b82f6);
            font-style: italic;
          }
          [data-slot="diff-viewer"] tbody tr:not([data-hunk-header]) {
            cursor: pointer;
          }
          [data-slot="diff-viewer"] tbody tr:not([data-hunk-header]):hover {
            background: color-mix(in srgb, var(--primary) 5%, transparent);
          }
        `}</style>
      </div>
    </ScrollArea>
  )
}

interface ParsedDiffLine extends DiffLine {
  isHunkHeader?: boolean
}

function parseDiffToLines(diff: string): ParsedDiffLine[] {
  const rawLines = diff.split('\n')
  const result: ParsedDiffLine[] = []
  let oldLine = 0
  let newLine = 0

  for (const raw of rawLines) {
    if (raw.startsWith('@@')) {
      const match = raw.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/)
      if (match) {
        oldLine = parseInt(match[1], 10)
        newLine = parseInt(match[2], 10)
      }
      result.push({ type: 'unchanged', content: raw, lineNumber: {}, isHunkHeader: true })
    } else if (raw.startsWith('+') && !raw.startsWith('+++')) {
      result.push({
        type: 'added',
        content: raw.substring(1),
        lineNumber: { new: newLine },
      })
      newLine++
    } else if (raw.startsWith('-') && !raw.startsWith('---')) {
      result.push({
        type: 'removed',
        content: raw.substring(1),
        lineNumber: { old: oldLine },
      })
      oldLine++
    } else if (!raw.startsWith('diff') && !raw.startsWith('index') && !raw.startsWith('---') && !raw.startsWith('+++')) {
      result.push({
        type: 'unchanged',
        content: raw.startsWith(' ') ? raw.substring(1) : raw,
        lineNumber: { old: oldLine, new: newLine },
      })
      oldLine++
      newLine++
    }
  }

  return result
}
