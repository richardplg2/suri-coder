# Ticket System — Plan 09: Review UI

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build code review UI with file tree, unified diff view, inline comments, test results panel, and batch request changes flow.

**Architecture:** File tree (left panel) + diff viewer (right panel). Comments stored locally until batch submitted. Test results panel shows above diff for tester steps.

**Tech Stack:** React 19, @agent-coding/ui (DiffViewer, FileTree, SplitPane), Tailwind CSS v4

**Depends on:** [Plan 05](./2026-03-08-ticket-system-plan-05-workflow-engine.md), [Plan 07](./2026-03-08-ticket-system-plan-07-ticket-detail-ui.md)

---

## Task 1: Build ReviewPanel component

**Description:** The main review layout component. Uses `SplitPane` with a file tree on the left and a diff viewer on the right. Takes a step ID and loads review data (diff content, file list) from the API. Manages selected file state and comment collection.

**Files to create:**
- `apps/desktop/src/renderer/components/review/review-panel.tsx`

**Props/Types:**

```tsx
interface ReviewPanelProps {
  stepId: string
  ticketId: string
  projectId: string
}

interface ReviewFile {
  path: string
  status: 'added' | 'modified' | 'deleted' | 'renamed'
  additions: number
  deletions: number
}

interface ReviewComment {
  id: string
  file: string
  line_start: number
  line_end: number
  text: string
}
```

**Key code:**

```tsx
import { useState } from 'react'
import { SplitPane, SplitPanePanel, SplitPaneHandle, ScrollArea, Spinner } from '@agent-coding/ui'
import { ReviewFileTree } from 'renderer/components/review/review-file-tree'
import { ReviewDiffView } from 'renderer/components/review/review-diff-view'
import { ReviewCommentList } from 'renderer/components/review/review-comment-list'
import { ReviewActionBar } from 'renderer/components/review/review-action-bar'
import { TestResultsPanel } from 'renderer/components/review/test-results-panel'
import { useStepReviews } from 'renderer/hooks/queries/use-workflow-actions'
import type { StepReview } from 'renderer/types/api'

export function ReviewPanel({ stepId, ticketId, projectId }: ReviewPanelProps) {
  const { data: reviews, isLoading } = useStepReviews(projectId, ticketId, stepId)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [comments, setComments] = useState<ReviewComment[]>([])

  const latestReview = reviews?.[reviews.length - 1]

  // Parse diff content into file list
  const files = parseDiffFiles(latestReview?.diff_content ?? '')
  const selectedDiff = selectedFile ? getDiffForFile(latestReview?.diff_content ?? '', selectedFile) : null

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
        {/* File tree */}
        <SplitPanePanel defaultSize={25} minSize={15}>
          <ReviewFileTree
            files={files}
            selectedFile={selectedFile}
            onSelectFile={setSelectedFile}
            commentCounts={getCommentCountsByFile(comments)}
          />
        </SplitPanePanel>

        <SplitPaneHandle />

        {/* Diff + comments */}
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

            {/* Comment list */}
            {comments.length > 0 && (
              <ReviewCommentList comments={comments} onDelete={removeComment} />
            )}
          </div>
        </SplitPanePanel>
      </SplitPane>

      {/* Action bar */}
      <ReviewActionBar
        stepId={stepId}
        ticketId={ticketId}
        projectId={projectId}
        comments={comments}
        onCommentsCleared={() => setComments([])}
      />
    </div>
  )
}

// Helper to parse unified diff into file list
function parseDiffFiles(diffContent: string): ReviewFile[] {
  const files: ReviewFile[] = []
  const fileHeaders = diffContent.matchAll(/^diff --git a\/(.+?) b\/(.+?)$/gm)
  for (const match of fileHeaders) {
    const path = match[2]
    const additions = (diffContent.match(new RegExp(`^\\+(?!\\+\\+).*$`, 'gm')) ?? []).length
    const deletions = (diffContent.match(new RegExp(`^-(?!--).*$`, 'gm')) ?? []).length
    let status: ReviewFile['status'] = 'modified'
    if (diffContent.includes(`new file mode`)) status = 'added'
    if (diffContent.includes(`deleted file mode`)) status = 'deleted'
    if (match[1] !== match[2]) status = 'renamed'
    files.push({ path, status, additions, deletions })
  }
  return files
}

function getDiffForFile(diffContent: string, filePath: string): string | null {
  const sections = diffContent.split(/^diff --git/m)
  const section = sections.find((s) => s.includes(` b/${filePath}`))
  return section ? `diff --git${section}` : null
}

function getCommentCountsByFile(comments: ReviewComment[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const c of comments) {
    counts[c.file] = (counts[c.file] ?? 0) + 1
  }
  return counts
}
```

**Commit message:** `feat(desktop): build ReviewPanel component with SplitPane file tree and diff layout`

---

## Task 2: Build file tree for changed files

**Description:** A file tree component showing changed files from the diff. Uses the `FileTree` component from `@agent-coding/ui` or a custom list. Each file shows a status icon (green + for added, yellow pencil for modified, red - for deleted). Files with comments show a comment count badge. Click to select and view diff.

**Files to create:**
- `apps/desktop/src/renderer/components/review/review-file-tree.tsx`

**Key code:**

```tsx
import { ScrollArea, Badge } from '@agent-coding/ui'
import { FilePlus, FileEdit, FileMinus, FileSymlink } from 'lucide-react'
import { cn } from '@agent-coding/ui'

interface ReviewFileTreeProps {
  files: ReviewFile[]
  selectedFile: string | null
  onSelectFile: (path: string) => void
  commentCounts: Record<string, number>
}

const STATUS_ICONS = {
  added: FilePlus,
  modified: FileEdit,
  deleted: FileMinus,
  renamed: FileSymlink,
}

const STATUS_COLORS = {
  added: 'text-green-400',
  modified: 'text-yellow-400',
  deleted: 'text-red-400',
  renamed: 'text-blue-400',
}

export function ReviewFileTree({ files, selectedFile, onSelectFile, commentCounts }: ReviewFileTreeProps) {
  return (
    <ScrollArea className="h-full">
      <div className="p-2">
        <div className="section-header px-2 py-1.5 mb-1">
          Files Changed ({files.length})
        </div>
        {files.map((file) => {
          const Icon = STATUS_ICONS[file.status]
          const commentCount = commentCounts[file.path] ?? 0
          const fileName = file.path.split('/').pop()
          const dirPath = file.path.split('/').slice(0, -1).join('/')

          return (
            <button
              key={file.path}
              type="button"
              onClick={() => onSelectFile(file.path)}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] transition-colors',
                selectedFile === file.path
                  ? 'bg-[var(--selection)] text-primary'
                  : 'hover:bg-secondary/50',
              )}
            >
              <Icon className={cn('size-3.5 shrink-0', STATUS_COLORS[file.status])} />
              <div className="flex-1 min-w-0">
                <span className="font-medium">{fileName}</span>
                {dirPath && (
                  <span className="text-muted-foreground ml-1">{dirPath}/</span>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {file.additions > 0 && (
                  <span className="text-green-400 text-[10px]">+{file.additions}</span>
                )}
                {file.deletions > 0 && (
                  <span className="text-red-400 text-[10px]">-{file.deletions}</span>
                )}
                {commentCount > 0 && (
                  <Badge className="bg-yellow-500/15 text-yellow-400 text-[9px] px-1 py-0">
                    {commentCount}
                  </Badge>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </ScrollArea>
  )
}
```

**Commit message:** `feat(desktop): build ReviewFileTree with status icons, diff stats, and comment count badges`

---

## Task 3: Build unified diff view

**Description:** A unified diff viewer with syntax highlighting, line numbers, and +/- coloring. Uses the `DiffViewer` component from `@agent-coding/ui` if available, or builds a custom renderer. Each line is clickable/selectable for adding inline comments. Line numbers for both old and new files are shown in the gutter.

**Files to create:**
- `apps/desktop/src/renderer/components/review/review-diff-view.tsx`

**Key code:**

```tsx
import { useState } from 'react'
import { ScrollArea, Button, Textarea, Popover, PopoverContent, PopoverTrigger } from '@agent-coding/ui'
import { MessageSquare, Plus } from 'lucide-react'

interface DiffLine {
  type: 'addition' | 'deletion' | 'context' | 'header'
  content: string
  oldLineNum: number | null
  newLineNum: number | null
}

interface ReviewDiffViewProps {
  diff: string
  filePath: string
  comments: ReviewComment[]
  onAddComment: (lineStart: number, lineEnd: number, text: string) => void
}

export function ReviewDiffView({ diff, filePath, comments, onAddComment }: ReviewDiffViewProps) {
  const lines = parseDiffLines(diff)
  const [commentingLine, setCommentingLine] = useState<number | null>(null)
  const [commentText, setCommentText] = useState('')

  const handleSubmitComment = () => {
    if (commentingLine !== null && commentText.trim()) {
      onAddComment(commentingLine, commentingLine, commentText.trim())
      setCommentText('')
      setCommentingLine(null)
    }
  }

  return (
    <ScrollArea className="flex-1">
      <div className="font-mono text-[12px]">
        {/* File header */}
        <div className="sticky top-0 z-10 border-b border-border bg-card px-4 py-2 text-[13px] font-medium">
          {filePath}
        </div>

        {/* Diff lines */}
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((line, i) => {
              const lineComments = comments.filter(
                (c) => c.line_start <= (line.newLineNum ?? 0) && c.line_end >= (line.newLineNum ?? 0),
              )
              const lineNum = line.newLineNum ?? line.oldLineNum ?? i

              return (
                <tr key={i} className="group">
                  {line.type === 'header' ? (
                    <>
                      <td className="bg-blue-500/10 text-blue-400 px-2 py-0.5" colSpan={4}>
                        {line.content}
                      </td>
                    </>
                  ) : (
                    <>
                      {/* Old line number */}
                      <td className="w-12 select-none text-right pr-1 text-muted-foreground/50 border-r border-border">
                        {line.oldLineNum ?? ''}
                      </td>
                      {/* New line number */}
                      <td className="w-12 select-none text-right pr-1 text-muted-foreground/50 border-r border-border">
                        {line.newLineNum ?? ''}
                      </td>
                      {/* Add comment button gutter */}
                      <td className="w-6 text-center">
                        {line.type !== 'header' && (
                          <button
                            type="button"
                            className="invisible group-hover:visible text-blue-400 hover:text-blue-300"
                            onClick={() => setCommentingLine(lineNum)}
                          >
                            <Plus className="size-3" />
                          </button>
                        )}
                      </td>
                      {/* Content */}
                      <td
                        className={`px-2 py-0.5 whitespace-pre-wrap ${
                          line.type === 'addition'
                            ? 'bg-green-500/10 text-green-300'
                            : line.type === 'deletion'
                              ? 'bg-red-500/10 text-red-300'
                              : ''
                        }`}
                      >
                        <span className="select-none text-muted-foreground/50 mr-2">
                          {line.type === 'addition' ? '+' : line.type === 'deletion' ? '-' : ' '}
                        </span>
                        {line.content}
                      </td>
                    </>
                  )}
                </tr>
              )
            })}

            {/* Inline comment form */}
            {commentingLine !== null && (
              <tr>
                <td colSpan={4} className="p-3 bg-card border-y border-border">
                  <div className="flex items-start gap-2">
                    <MessageSquare className="mt-1 size-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Textarea
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
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
          </tbody>
        </table>
      </div>
    </ScrollArea>
  )
}

function parseDiffLines(diff: string): DiffLine[] {
  const rawLines = diff.split('\n')
  const result: DiffLine[] = []
  let oldLine = 0
  let newLine = 0

  for (const raw of rawLines) {
    if (raw.startsWith('@@')) {
      const match = raw.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/)
      if (match) {
        oldLine = parseInt(match[1], 10)
        newLine = parseInt(match[2], 10)
      }
      result.push({ type: 'header', content: raw, oldLineNum: null, newLineNum: null })
    } else if (raw.startsWith('+') && !raw.startsWith('+++')) {
      result.push({ type: 'addition', content: raw.substring(1), oldLineNum: null, newLineNum: newLine })
      newLine++
    } else if (raw.startsWith('-') && !raw.startsWith('---')) {
      result.push({ type: 'deletion', content: raw.substring(1), oldLineNum: oldLine, newLineNum: null })
      oldLine++
    } else if (!raw.startsWith('diff') && !raw.startsWith('index') && !raw.startsWith('---') && !raw.startsWith('+++')) {
      result.push({ type: 'context', content: raw.startsWith(' ') ? raw.substring(1) : raw, oldLineNum: oldLine, newLineNum: newLine })
      oldLine++
      newLine++
    }
  }

  return result
}
```

**Commit message:** `feat(desktop): build ReviewDiffView with line numbers, syntax coloring, and inline comment forms`

---

## Task 4: Build inline comment system

**Description:** When a user clicks the + icon on a diff line (or selects a line range), a comment form appears inline. The comment is added to a local state array. Commented lines show a yellow badge indicator in the gutter. The comment includes file path, line range, and text. This functionality is built into `ReviewDiffView` (Task 3) and `ReviewPanel` (Task 1). This task focuses on the visual indicators for commented lines.

**Files to modify:**
- `apps/desktop/src/renderer/components/review/review-diff-view.tsx` — add comment indicators on lines

**Key code additions to diff line rendering:**

```tsx
{/* Comment indicator badges on lines that have comments */}
{lineComments.length > 0 && (
  <tr>
    <td colSpan={4} className="px-14 py-1.5 bg-yellow-500/5 border-l-2 border-yellow-500">
      {lineComments.map((comment) => (
        <div key={comment.id} className="flex items-start gap-2 text-[12px]">
          <MessageSquare className="mt-0.5 size-3 text-yellow-400 shrink-0" />
          <span className="text-muted-foreground">{comment.text}</span>
        </div>
      ))}
    </td>
  </tr>
)}
```

Add visual highlighting to commented lines:

```tsx
// In the line <td> className, add yellow left border if line has comments
const hasComment = lineComments.length > 0
// Add to the content td:
className={`px-2 py-0.5 whitespace-pre-wrap ${
  hasComment ? 'border-l-2 border-yellow-500' : ''
} ${line.type === 'addition' ? 'bg-green-500/10 text-green-300' : ...}`}
```

**Commit message:** `feat(desktop): add inline comment indicators with yellow badges on commented diff lines`

---

## Task 5: Build comment list panel

**Description:** A collapsible panel below the diff that lists all comments across all files. Each comment shows: file path, line range, comment text, and a delete button. Grouped by file. Clicking a comment scrolls to that file/line in the diff.

**Files to create:**
- `apps/desktop/src/renderer/components/review/review-comment-list.tsx`

**Key code:**

```tsx
import { ScrollArea, Button, Separator } from '@agent-coding/ui'
import { FileText, Trash2, MessageSquare } from 'lucide-react'

interface ReviewCommentListProps {
  comments: ReviewComment[]
  onDelete: (id: string) => void
  onClickComment?: (comment: ReviewComment) => void
}

export function ReviewCommentList({ comments, onDelete, onClickComment }: ReviewCommentListProps) {
  // Group comments by file
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
```

**Commit message:** `feat(desktop): build ReviewCommentList panel with grouped comments, delete, and click-to-navigate`

---

## Task 6: Build "Approve" and "Request Changes" action bar

**Description:** A sticky bottom bar on the review panel with two primary actions. "Approve" calls the approve review API and marks the step as completed. "Request Changes" collects all local comments and sends them as a batch to the request changes API. Both buttons disable while the mutation is pending.

**Files to create:**
- `apps/desktop/src/renderer/components/review/review-action-bar.tsx`

**Key code:**

```tsx
import { Button } from '@agent-coding/ui'
import { Check, MessageSquareWarning } from 'lucide-react'
import { useApproveReview, useRequestChanges } from 'renderer/hooks/queries/use-workflow-actions'

interface ReviewActionBarProps {
  stepId: string
  ticketId: string
  projectId: string
  comments: ReviewComment[]
  onCommentsCleared: () => void
}

export function ReviewActionBar({ stepId, ticketId, projectId, comments, onCommentsCleared }: ReviewActionBarProps) {
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
    <div className="flex items-center justify-between border-t border-border bg-card px-4 py-3">
      <div className="text-caption text-muted-foreground">
        {comments.length > 0
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
```

**Commit message:** `feat(desktop): build ReviewActionBar with Approve and Request Changes buttons`

---

## Task 7: Build TestResultsPanel component

**Description:** A panel shown above the diff view when the current step is a tester step. Shows a summary bar (e.g., "12 passed, 3 failed") and expandable cards for each failed test. Failed test cards show the test name, error message, stack trace (in a `CodeBlock`), and optionally a screenshot button. Test results come from the step's review data or a dedicated API endpoint.

**Files to create:**
- `apps/desktop/src/renderer/components/review/test-results-panel.tsx`

**Props/Types:**

```tsx
interface TestResult {
  name: string
  status: 'passed' | 'failed' | 'skipped'
  duration_ms: number
  error_message?: string
  stack_trace?: string
  screenshot_url?: string
}

interface TestResultsPanelProps {
  results: TestResult[]
}
```

**Key code:**

```tsx
import { useState } from 'react'
import { Badge, Button, CodeBlock } from '@agent-coding/ui'
import { CheckCircle, XCircle, ChevronDown, ChevronRight, Camera, SkipForward } from 'lucide-react'

export function TestResultsPanel({ results }: TestResultsPanelProps) {
  const [expandedTests, setExpandedTests] = useState<Set<string>>(new Set())
  const passed = results.filter((r) => r.status === 'passed').length
  const failed = results.filter((r) => r.status === 'failed').length
  const skipped = results.filter((r) => r.status === 'skipped').length
  const failedTests = results.filter((r) => r.status === 'failed')

  const toggleExpand = (name: string) => {
    setExpandedTests((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  return (
    <div className="border-b border-border">
      {/* Summary bar */}
      <div className="flex items-center gap-3 px-4 py-2 bg-card">
        <span className="text-[13px] font-medium">Test Results</span>
        <div className="flex items-center gap-2 text-[12px]">
          <span className="flex items-center gap-1 text-green-400">
            <CheckCircle className="size-3" /> {passed} passed
          </span>
          {failed > 0 && (
            <span className="flex items-center gap-1 text-red-400">
              <XCircle className="size-3" /> {failed} failed
            </span>
          )}
          {skipped > 0 && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <SkipForward className="size-3" /> {skipped} skipped
            </span>
          )}
        </div>
      </div>

      {/* Failed test cards */}
      {failedTests.length > 0 && (
        <div className="px-4 pb-3 space-y-2">
          {failedTests.map((test) => (
            <div key={test.name} className="rounded-lg border border-red-500/30 bg-red-500/5">
              <button
                type="button"
                onClick={() => toggleExpand(test.name)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left"
              >
                {expandedTests.has(test.name) ? (
                  <ChevronDown className="size-3.5" />
                ) : (
                  <ChevronRight className="size-3.5" />
                )}
                <XCircle className="size-3.5 text-red-400" />
                <span className="text-[12px] font-medium flex-1">{test.name}</span>
                <span className="text-[10px] text-muted-foreground">{test.duration_ms}ms</span>
              </button>

              {expandedTests.has(test.name) && (
                <div className="border-t border-red-500/20 px-3 py-2 space-y-2">
                  {test.error_message && (
                    <p className="text-[12px] text-red-300">{test.error_message}</p>
                  )}
                  {test.stack_trace && (
                    <CodeBlock
                      code={test.stack_trace}
                      language="text"
                      className="text-[11px] max-h-48 overflow-y-auto"
                    />
                  )}
                  {test.screenshot_url && (
                    <Button size="sm" variant="outline" className="text-[11px]">
                      <Camera className="mr-1 size-3" /> View Screenshot
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

**Commit message:** `feat(desktop): build TestResultsPanel with summary bar and expandable failed test cards`

---

## Task 8: Wire ReviewPanel into ticket detail

**Description:** When a step's status is `"review"`, the ticket detail Tasks tab shows a "Review" button that opens the `ReviewPanel`. The ReviewPanel loads the step's diff from the review API. After approval or request changes, the UI refreshes.

**Files to modify:**
- `apps/desktop/src/renderer/components/ticket-detail/tasks-tab.tsx` — add review button and ReviewPanel toggle
- `apps/desktop/src/renderer/components/step-inspector.tsx` — add "Open Review" button when step status is review

**Key code for tasks-tab.tsx:**

```tsx
const [reviewStepId, setReviewStepId] = useState<string | null>(null)

// In the step list, add review button:
{step.status === 'review' && (
  <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setReviewStepId(step.id) }}>
    <Eye className="mr-1.5 size-3.5" /> Review
  </Button>
)}

// Below the task list:
{reviewStepId && (
  <div className="border-t border-border" style={{ height: '60vh' }}>
    <ReviewPanel
      stepId={reviewStepId}
      ticketId={ticket.id}
      projectId={projectId}
    />
  </div>
)}
```

**Commit message:** `feat(desktop): wire ReviewPanel into ticket detail Tasks tab for steps in review status`

---

## Task 9: Add query hooks for review actions

**Description:** Extend existing review hooks to support the full review workflow. The `useStepReviews` hook already exists. Add support for passing a comments array to `useRequestChanges` (already supported via `RequestChangesPayload`). Add a hook for fetching test results.

**Files to modify:**
- `apps/desktop/src/renderer/hooks/queries/use-workflow-actions.ts` — add `useStepTestResults` hook

**Key code:**

```tsx
export function useStepTestResults(projectId: string, ticketId: string, stepId: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'tickets', ticketId, 'steps', stepId, 'test-results'],
    queryFn: () =>
      apiClient<TestResult[]>(`/tickets/${ticketId}/steps/${stepId}/test-results`),
    enabled: !!projectId && !!ticketId && !!stepId,
  })
}
```

**New type in api.ts:**

```tsx
export interface TestResult {
  name: string
  status: 'passed' | 'failed' | 'skipped'
  duration_ms: number
  error_message?: string
  stack_trace?: string
  screenshot_url?: string
}
```

**Commit message:** `feat(desktop): add useStepTestResults query hook and TestResult type`

---

## Task 10: Handle request changes response

**Description:** After the user submits "Request Changes", the agent processes the comments and re-submits updated code. The step status changes from `review` to `changes_requested` and then back to `running`. The WebSocket `ticket:progress` channel notifies the UI of status changes. When the step returns to `review`, the `ReviewPanel` re-fetches reviews to show the new diff. The comment list is cleared after successful submission.

**Files to modify:**
- `apps/desktop/src/renderer/components/review/review-panel.tsx` — add WebSocket listener for status changes, auto-refresh on new review
- `apps/desktop/src/renderer/components/review/review-action-bar.tsx` — show success state after request changes submitted

**Key code additions to ReviewPanel:**

```tsx
import { useWsChannel } from 'renderer/hooks/use-ws-channel'
import { useQueryClient } from '@tanstack/react-query'

// Inside ReviewPanel:
const qc = useQueryClient()
const [submittedChanges, setSubmittedChanges] = useState(false)

const handleWsEvent = useCallback((event: WsEvent, data: unknown) => {
  const payload = data as { step_id: string; status: StepStatus }
  if (payload.step_id === stepId) {
    // Refresh review data when step returns to review status
    if (payload.status === 'review') {
      qc.invalidateQueries({
        queryKey: ['projects', projectId, 'tickets', ticketId, 'steps', stepId, 'reviews'],
      })
      setSubmittedChanges(false)
    }
  }
}, [qc, projectId, ticketId, stepId])

useWsChannel('ticket:progress', { ticket_id: ticketId }, handleWsEvent)
```

**Key code additions to ReviewActionBar:**

```tsx
// Show status after request changes
{requestChanges.isSuccess && (
  <div className="flex items-center gap-1.5 text-caption text-yellow-400">
    <Loader2 className="size-3 animate-spin" />
    Agent is processing changes...
  </div>
)}
```

**Commit message:** `feat(desktop): handle request changes response with WebSocket status updates and auto-refresh`
