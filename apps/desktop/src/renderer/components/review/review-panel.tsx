import { useState, useCallback } from 'react'
import { SplitPane, SplitPanePanel, SplitPaneHandle, Spinner } from '@agent-coding/ui'
import { useQueryClient } from '@tanstack/react-query'
import { ReviewFileTree } from 'renderer/components/review/review-file-tree'
import { ReviewDiffView } from 'renderer/components/review/review-diff-view'
import { ReviewCommentList } from 'renderer/components/review/review-comment-list'
import { ReviewActionBar } from 'renderer/components/review/review-action-bar'
import { useStepReviews } from 'renderer/hooks/queries/use-workflow-actions'
import { useWsChannel } from 'renderer/hooks/use-ws-channel'
import { WsChannel, WsEvent } from '@agent-coding/shared'
import type { StepStatus } from 'renderer/types/api'

export interface ReviewFile {
  path: string
  status: 'added' | 'modified' | 'deleted' | 'renamed'
  additions: number
  deletions: number
}

export interface ReviewComment {
  id: string
  file: string
  line_start: number
  line_end: number
  text: string
}

interface ReviewPanelProps {
  stepId: string
  ticketId: string
  projectId: string
}

export function ReviewPanel({ stepId, ticketId, projectId }: ReviewPanelProps) {
  const { data: reviews, isLoading } = useStepReviews(projectId, ticketId, stepId)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [comments, setComments] = useState<ReviewComment[]>([])
  const [submittedChanges, setSubmittedChanges] = useState(false)
  const qc = useQueryClient()

  const handleWsEvent = useCallback((event: WsEvent, data: unknown) => {
    const payload = data as { step_id?: string; status?: StepStatus }
    if (payload.step_id === stepId && payload.status === 'review') {
      qc.invalidateQueries({
        queryKey: ['projects', projectId, 'tickets', ticketId, 'steps', stepId, 'reviews'],
      })
      setSubmittedChanges(false)
    }
  }, [qc, projectId, ticketId, stepId])

  useWsChannel(WsChannel.TicketProgress, { ticket_id: ticketId }, handleWsEvent)

  const latestReview = reviews?.[reviews.length - 1]
  const diffContent = latestReview?.diff_content ?? ''
  const files = parseDiffFiles(diffContent)
  const selectedDiff = selectedFile ? getDiffForFile(diffContent, selectedFile) : null

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner label="Loading review..." />
      </div>
    )
  }

  const addComment = (comment: Omit<ReviewComment, 'id'>) => {
    setComments((prev) => [...prev, { ...comment, id: crypto.randomUUID() }])
  }

  const removeComment = (id: string) => {
    setComments((prev) => prev.filter((c) => c.id !== id))
  }

  return (
    <div className="flex h-full flex-col">
      <SplitPane orientation="horizontal" className="flex-1">
        <SplitPanePanel defaultSize={25} minSize={15}>
          <ReviewFileTree
            files={files}
            selectedFile={selectedFile}
            onSelectFile={setSelectedFile}
            commentCounts={getCommentCountsByFile(comments)}
          />
        </SplitPanePanel>

        <SplitPaneHandle />

        <SplitPanePanel defaultSize={75} minSize={40}>
          <div className="flex h-full flex-col">
            {selectedDiff ? (
              <ReviewDiffView
                diff={selectedDiff}
                filePath={selectedFile!}
                comments={comments.filter((c) => c.file === selectedFile)}
                onAddComment={(lineStart, lineEnd, text) =>
                  addComment({ file: selectedFile!, line_start: lineStart, line_end: lineEnd, text })
                }
              />
            ) : (
              <div className="flex h-full items-center justify-center text-[13px] text-muted-foreground">
                Select a file to view changes
              </div>
            )}

            {comments.length > 0 && (
              <ReviewCommentList comments={comments} onDelete={removeComment} />
            )}
          </div>
        </SplitPanePanel>
      </SplitPane>

      <ReviewActionBar
        stepId={stepId}
        ticketId={ticketId}
        projectId={projectId}
        comments={comments}
        submittedChanges={submittedChanges}
        onCommentsCleared={() => { setComments([]); setSubmittedChanges(true) }}
      />
    </div>
  )
}

function parseDiffFiles(diffContent: string): ReviewFile[] {
  if (!diffContent) return []

  const files: ReviewFile[] = []
  const sections = diffContent.split(/^(?=diff --git)/m).filter(Boolean)

  for (const section of sections) {
    const headerMatch = section.match(/^diff --git a\/(.+?) b\/(.+?)$/m)
    if (!headerMatch) continue

    const path = headerMatch[2]
    let additions = 0
    let deletions = 0

    for (const line of section.split('\n')) {
      if (line.startsWith('+') && !line.startsWith('+++')) additions++
      if (line.startsWith('-') && !line.startsWith('---')) deletions++
    }

    let status: ReviewFile['status'] = 'modified'
    if (section.includes('new file mode')) status = 'added'
    else if (section.includes('deleted file mode')) status = 'deleted'
    else if (headerMatch[1] !== headerMatch[2]) status = 'renamed'

    files.push({ path, status, additions, deletions })
  }

  return files
}

function getDiffForFile(diffContent: string, filePath: string): string | null {
  const sections = diffContent.split(/^(?=diff --git)/m)
  const section = sections.find((s) => s.includes(` b/${filePath}`))
  return section ?? null
}

function getCommentCountsByFile(comments: ReviewComment[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const c of comments) {
    counts[c.file] = (counts[c.file] ?? 0) + 1
  }
  return counts
}
