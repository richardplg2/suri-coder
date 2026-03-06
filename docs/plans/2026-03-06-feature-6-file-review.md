# Feature 6: File Review Workflow

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Per-file code review with AI-generated comments, inline diff viewer, interactive Q&A per file, and approve/reject/fix actions. Users select a branch to review, Claude generates comments per changed file, then users can discuss and resolve.

**Architecture:** ReviewSession/FileReview models already exist. Need a git diff service, review prompt builder, review REST router, and a frontend UI with file tree, diff viewer, and inline comments — all using `@agent-coding/ui` primitives (FileTree, DiffViewer, InlineComment are provided by the UI package).

**Tech Stack:** FastAPI, SQLAlchemy async, claude_agent_sdk, git CLI (subprocess), React 19, @agent-coding/ui

**Depends on:** Feature 1 (session management), Feature 3 (worktrees — review can target worktree branches), UI Primitives plan (packages/ui built)

**Already built (backend):**
- ReviewSession model (`apps/backend/app/models/review.py`) — session_id, status, summary
- FileReview model (`apps/backend/app/models/review.py`) — file_path, status, comments (JSON)

**Already built (UI package — no need to create locally):**
- `FileTree` — file list with status icons (modified/added/deleted)
- `DiffViewer` — unified diff with line annotations
- `InlineComment` — comment card for AI/user feedback
- `SplitPane` — for 2-panel layout
- `Panel` — compound component for layout sections
- `EmptyState`, `Spinner`, `StatusBadge`, `Progress`
- shadcn: `Select`, `Button`, `Textarea`, `ScrollArea`, `Badge`, `Separator`, `Tooltip`

**Remaining work:**
- Backend: Git diff service, review prompt builder, review schemas, review REST router
- Frontend: Branch selector, file tree, diff viewer, inline comments, Q&A panel (using @agent-coding/ui)

**Design ref:** `docs/design/pages/file-review.md`

---

### Task 1: Git diff service

**Files:**
- Create: `apps/backend/app/services/git_diff.py`
- Test: `apps/backend/tests/test_git_diff.py`

**Step 1: Write the failing test**

```python
import os
import tempfile
import pytest

from app.services.git_diff import get_changed_files, get_file_diff


@pytest.fixture
def git_repo_with_changes():
    with tempfile.TemporaryDirectory() as tmpdir:
        os.system(f"cd {tmpdir} && git init && git checkout -b main")
        with open(os.path.join(tmpdir, "hello.py"), "w") as f:
            f.write("print('hello')\n")
        os.system(f"cd {tmpdir} && git add . && git commit -m 'init'")
        os.system(f"cd {tmpdir} && git checkout -b feature/test")
        with open(os.path.join(tmpdir, "hello.py"), "w") as f:
            f.write("print('hello world')\n")
        with open(os.path.join(tmpdir, "new_file.py"), "w") as f:
            f.write("print('new')\n")
        os.system(f"cd {tmpdir} && git add . && git commit -m 'changes'")
        yield tmpdir


@pytest.mark.asyncio
async def test_get_changed_files(git_repo_with_changes):
    files = await get_changed_files(
        repo_path=git_repo_with_changes,
        branch="feature/test",
        base_branch="main",
    )
    assert len(files) == 2
    paths = [f["path"] for f in files]
    assert "hello.py" in paths
    assert "new_file.py" in paths


@pytest.mark.asyncio
async def test_get_file_diff(git_repo_with_changes):
    diff = await get_file_diff(
        repo_path=git_repo_with_changes,
        file_path="hello.py",
        branch="feature/test",
        base_branch="main",
    )
    assert "hello" in diff
```

**Step 2: Write the implementation**

```python
import asyncio


async def _run_git(cmd: list[str], cwd: str) -> tuple[int, str]:
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        cwd=cwd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, _ = await proc.communicate()
    return proc.returncode, stdout.decode()


async def get_changed_files(
    repo_path: str,
    branch: str,
    base_branch: str = "main",
) -> list[dict]:
    rc, stdout = await _run_git(
        ["git", "diff", "--name-status", f"{base_branch}...{branch}"],
        repo_path,
    )
    if rc != 0:
        return []

    files = []
    for line in stdout.strip().split("\n"):
        if not line:
            continue
        parts = line.split("\t")
        files.append({"status": parts[0], "path": parts[1] if len(parts) > 1 else ""})
    return files


async def get_file_diff(
    repo_path: str,
    file_path: str,
    branch: str,
    base_branch: str = "main",
) -> str:
    _, stdout = await _run_git(
        ["git", "diff", f"{base_branch}...{branch}", "--", file_path],
        repo_path,
    )
    return stdout
```

**Step 3: Run test, commit**

```bash
git add apps/backend/app/services/git_diff.py apps/backend/tests/test_git_diff.py
git commit -m "feat(backend): add git diff service"
```

---

### Task 2: Review prompt builder

**Files:**
- Create: `apps/backend/app/services/review_prompt.py`
- Test: `apps/backend/tests/test_review_prompt.py`

**Step 1: Write the failing test**

```python
from app.services.review_prompt import build_review_prompt, build_fix_prompt


def test_build_review_prompt():
    prompt = build_review_prompt(
        file_path="src/auth/login.ts",
        diff_content="- old line\n+ new line",
    )
    assert "src/auth/login.ts" in prompt
    assert "- old line" in prompt


def test_build_fix_prompt():
    prompt = build_fix_prompt(
        file_path="src/auth/login.ts",
        comment="Missing error handling for async call",
    )
    assert "src/auth/login.ts" in prompt
    assert "Missing error handling" in prompt
```

**Step 2: Write the implementation**

```python
def build_review_prompt(file_path: str, diff_content: str) -> str:
    return (
        f"Review the following file changes and provide detailed feedback.\n\n"
        f"File: {file_path}\n\n"
        f"```diff\n{diff_content}\n```\n\n"
        f"For each issue, provide:\n"
        f"1. Line reference\n"
        f"2. Severity (critical, warning, suggestion)\n"
        f"3. Description\n"
        f"4. Suggested fix\n\n"
        f'Respond in JSON: {{"comments": [{{"line": int, "severity": str, "message": str, "suggestion": str}}]}}'
    )


def build_fix_prompt(file_path: str, comment: str) -> str:
    return (
        f"Fix the following issue in {file_path}:\n\n"
        f"{comment}\n\n"
        f"Read the file, understand the context, apply the fix, and verify it works."
    )


def build_question_prompt(
    file_path: str,
    diff_content: str,
    question: str,
    history: list[dict] | None = None,
) -> str:
    parts = [
        f"Context: reviewing changes in {file_path}\n",
        f"```diff\n{diff_content}\n```\n",
    ]
    if history:
        parts.append("Previous conversation:")
        for msg in history:
            parts.append(f"- {msg['role']}: {msg['content']}")
        parts.append("")
    parts.append(f"Question: {question}")
    return "\n".join(parts)
```

**Step 3: Run test, commit**

```bash
git add apps/backend/app/services/review_prompt.py apps/backend/tests/test_review_prompt.py
git commit -m "feat(backend): add review prompt builder service"
```

---

### Task 3: Review schemas and REST router

**Files:**
- Create: `apps/backend/app/schemas/review.py`
- Create: `apps/backend/app/routers/reviews.py`
- Modify: `apps/backend/app/main.py`
- Test: `apps/backend/tests/test_reviews_router.py`

**Step 1: Write schemas**

```python
import uuid
from pydantic import BaseModel


class ReviewCreate(BaseModel):
    branch: str
    base_branch: str = "main"


class FileReviewResponse(BaseModel):
    id: uuid.UUID
    file_path: str
    status: str
    comments: list | None = None

    model_config = {"from_attributes": True}


class ReviewResponse(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID | None = None
    status: str
    summary: str | None = None
    file_reviews: list[FileReviewResponse] = []

    model_config = {"from_attributes": True}


class FileReviewAction(BaseModel):
    status: str  # "approved" or "rejected"


class FileReviewQuestion(BaseModel):
    question: str
```

**Step 2: Write router**

Router endpoints:
- `GET /projects/{id}/reviews` — list reviews for project
- `POST /projects/{id}/reviews` — create review (runs git diff, creates FileReview per changed file, enqueues AI review)
- `GET /projects/{id}/reviews/{review_id}` — get review detail with file reviews
- `PATCH /projects/{id}/reviews/{review_id}/files/{file_id}/status` — approve/reject file
- `POST /projects/{id}/reviews/{review_id}/files/{file_id}/ask` — ask question about file (appends to conversation, enqueues Claude)
- `POST /projects/{id}/reviews/{review_id}/files/{file_id}/fix` — trigger Claude fix session

The create endpoint should:
1. Get project path
2. Call `get_changed_files()` to find modified files
3. Call `get_file_diff()` per file
4. Create ReviewSession + FileReview records
5. For each file, build review prompt and enqueue ARQ job

**Step 3: Write failing test, register router, run tests, commit**

```bash
git add apps/backend/app/schemas/review.py apps/backend/app/routers/reviews.py apps/backend/app/main.py apps/backend/tests/test_reviews_router.py
git commit -m "feat(backend): add Review REST router with ask/fix endpoints"
```

---

### Task 4: File review screen in frontend

**Files:**
- Create: `apps/desktop/src/renderer/hooks/use-reviews.ts`
- Modify: `apps/desktop/src/renderer/screens/reviews.tsx`

**UI imports from `@agent-coding/ui`:** `FileTree`, `DiffViewer`, `InlineComment`, `SplitPane`, `SplitPanePanel`, `SplitPaneHandle`, `Panel`, `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`, `Button`, `Textarea`, `EmptyState`, `Spinner`, `StatusBadge`, `Progress`, `ScrollArea`, `Badge`, `Separator`, `Tooltip`, `TooltipTrigger`, `TooltipContent`, `TooltipProvider`, `type FileTreeNode`, `type DiffLine`

**Step 1: Create useReviews hook**

Manages review state, file selection, comments, Q&A, and actions.

**Step 2: Build reviews screen**

Per `docs/design/pages/file-review.md`:

- Layout: SplitPane 2-panel (FileTree 200px | DiffViewer full-width) — no inspector panel
- Top: Select for branch selection, Button "Start Review"
- FileTree on left with file status icons (modified/added/deleted) + review status
- DiffViewer on right with inline AI comments via renderLineAnnotation + InlineComment
- Per-file actions: Button Approve, Button Reject, Button "Fix" (spawns Claude session)
- Per-comment: Textarea reply input for follow-up questions
- States: EmptyState (no review), Spinner (AI reviewing), comments visible, summary

```tsx
import { useState } from 'react'
import { Check, FileCode2, MessageSquare, X, Wrench } from 'lucide-react'
import {
  FileTree,
  DiffViewer,
  InlineComment,
  SplitPane,
  SplitPanePanel,
  SplitPaneHandle,
  Panel,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Button,
  Textarea,
  EmptyState,
  Spinner,
  StatusBadge,
  Progress,
  ScrollArea,
  Badge,
  Separator,
  type FileTreeNode,
  type DiffLine,
} from '@agent-coding/ui'

import { useReviews } from '../hooks/use-reviews'

// Map git status to FileTree status
function mapGitStatus(gitStatus: string): 'modified' | 'added' | 'deleted' | 'unchanged' {
  if (gitStatus === 'M') return 'modified'
  if (gitStatus === 'A') return 'added'
  if (gitStatus === 'D') return 'deleted'
  return 'unchanged'
}

// Parse unified diff into DiffLine array
function parseDiff(diffContent: string): DiffLine[] {
  const lines: DiffLine[] = []
  let oldLine = 0
  let newLine = 0

  for (const line of diffContent.split('\n')) {
    if (line.startsWith('@@')) {
      const match = line.match(/@@ -(\d+)/)
      if (match) oldLine = parseInt(match[1]) - 1
      const match2 = line.match(/\+(\d+)/)
      if (match2) newLine = parseInt(match2[1]) - 1
      continue
    }
    if (line.startsWith('---') || line.startsWith('+++') || line.startsWith('diff')) continue

    if (line.startsWith('+')) {
      newLine++
      lines.push({ type: 'added', content: line.slice(1), lineNumber: { new: newLine } })
    } else if (line.startsWith('-')) {
      oldLine++
      lines.push({ type: 'removed', content: line.slice(1), lineNumber: { old: oldLine } })
    } else {
      oldLine++
      newLine++
      lines.push({ type: 'unchanged', content: line.slice(1) || '', lineNumber: { old: oldLine, new: newLine } })
    }
  }
  return lines
}

export function ReviewsScreen() {
  const {
    branches,
    selectedBranch,
    setSelectedBranch,
    review,
    fileReviews,
    selectedFilePath,
    setSelectedFilePath,
    diffContent,
    comments,
    isReviewing,
    startReview,
    approveFile,
    rejectFile,
    fixFile,
    askQuestion,
  } = useReviews()

  const [replyInput, setReplyInput] = useState('')
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())

  // Build FileTree nodes from file reviews
  const fileNodes: FileTreeNode[] = fileReviews.map((fr) => ({
    name: fr.file_path.split('/').pop() ?? fr.file_path,
    path: fr.file_path,
    type: 'file' as const,
    status: mapGitStatus(fr.git_status ?? 'M'),
  }))

  // Parse diff into DiffLine array
  const diffLines = diffContent ? parseDiff(diffContent) : []

  // Build comment map by line index
  const commentsByLine = new Map<number, typeof comments>()
  if (comments) {
    for (const comment of comments) {
      const lineIdx = diffLines.findIndex(
        (l) => l.lineNumber?.new === comment.line || l.lineNumber?.old === comment.line
      )
      if (lineIdx >= 0) {
        const existing = commentsByLine.get(lineIdx) ?? []
        existing.push(comment)
        commentsByLine.set(lineIdx, existing)
      }
    }
  }

  const selectedFileReview = fileReviews.find((fr) => fr.file_path === selectedFilePath)

  return (
    <div className="flex h-full flex-col">
      {/* Top bar: branch selector + actions */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-2">
        <Select value={selectedBranch} onValueChange={setSelectedBranch}>
          <SelectTrigger className="w-[250px]">
            <SelectValue placeholder="Select branch..." />
          </SelectTrigger>
          <SelectContent>
            {branches.map((b) => (
              <SelectItem key={b} value={b}>{b}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button onClick={startReview} disabled={!selectedBranch || isReviewing}>
          {isReviewing ? <Spinner size="sm" /> : 'Start Review'}
        </Button>

        {review && (
          <StatusBadge status={review.status === 'completed' ? 'passed' : review.status === 'reviewing' ? 'running' : 'pending'}>
            {review.status}
          </StatusBadge>
        )}

        {isReviewing && <Progress value={undefined} className="w-32" />}
      </div>

      {/* Main content: FileTree | DiffViewer */}
      {!review ? (
        <div className="flex flex-1 items-center justify-center">
          <EmptyState
            icon={FileCode2}
            title="No review active"
            description="Select a branch and start a review to see file changes"
          />
        </div>
      ) : (
        <SplitPane direction="horizontal" className="flex-1">
          {/* File tree */}
          <SplitPanePanel defaultSize={20} minSize={15}>
            <Panel>
              <Panel.Header>
                <Panel.Title>Files</Panel.Title>
                <Panel.Actions>
                  <Badge variant="secondary">{fileReviews.length}</Badge>
                </Panel.Actions>
              </Panel.Header>
              <Panel.Content>
                <ScrollArea className="h-full">
                  <FileTree
                    nodes={fileNodes}
                    selectedPath={selectedFilePath ?? undefined}
                    onSelect={setSelectedFilePath}
                    expandedPaths={expandedPaths}
                    onToggleExpand={(path) => {
                      const next = new Set(expandedPaths)
                      next.has(path) ? next.delete(path) : next.add(path)
                      setExpandedPaths(next)
                    }}
                  />
                </ScrollArea>
              </Panel.Content>
            </Panel>
          </SplitPanePanel>

          <SplitPaneHandle />

          {/* Diff viewer */}
          <SplitPanePanel defaultSize={80}>
            <Panel>
              {selectedFilePath && selectedFileReview ? (
                <>
                  <Panel.Header>
                    <Panel.Title>
                      <span className="font-mono text-[12px]">{selectedFilePath}</span>
                    </Panel.Title>
                    <Panel.Actions>
                      <StatusBadge status={selectedFileReview.status === 'approved' ? 'passed' : selectedFileReview.status === 'rejected' ? 'failed' : 'pending'}>
                        {selectedFileReview.status}
                      </StatusBadge>
                      <Separator orientation="vertical" className="h-4" />
                      <Button variant="outline" size="xs" onClick={() => approveFile(selectedFileReview.id)}>
                        <Check size={12} /> Approve
                      </Button>
                      <Button variant="outline" size="xs" onClick={() => rejectFile(selectedFileReview.id)}>
                        <X size={12} /> Reject
                      </Button>
                      <Button variant="outline" size="xs" onClick={() => fixFile(selectedFileReview.id)}>
                        <Wrench size={12} /> Fix
                      </Button>
                    </Panel.Actions>
                  </Panel.Header>
                  <Panel.Content>
                    <ScrollArea className="h-full">
                      <DiffViewer
                        lines={diffLines}
                        mode="unified"
                        renderLineAnnotation={(lineIndex) => {
                          const lineComments = commentsByLine.get(lineIndex)
                          if (!lineComments) return null
                          return (
                            <>
                              {lineComments.map((comment, i) => (
                                <InlineComment
                                  key={i}
                                  author="ai"
                                  content={comment.message}
                                  actions={
                                    <div className="flex items-center gap-2">
                                      <Textarea
                                        value={replyInput}
                                        onChange={(e) => setReplyInput(e.target.value)}
                                        placeholder="Ask a question..."
                                        rows={1}
                                        className="w-64 resize-none text-[12px]"
                                      />
                                      <Button
                                        size="xs"
                                        variant="outline"
                                        onClick={() => {
                                          askQuestion(selectedFileReview.id, replyInput)
                                          setReplyInput('')
                                        }}
                                      >
                                        <MessageSquare size={12} /> Ask
                                      </Button>
                                    </div>
                                  }
                                />
                              ))}
                            </>
                          )
                        }}
                      />
                    </ScrollArea>
                  </Panel.Content>
                </>
              ) : (
                <Panel.Content>
                  <EmptyState
                    icon={FileCode2}
                    title="No file selected"
                    description="Select a file from the tree to view its diff and review comments"
                  />
                </Panel.Content>
              )}
            </Panel>
          </SplitPanePanel>
        </SplitPane>
      )}
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add apps/desktop/src/renderer/hooks/use-reviews.ts apps/desktop/src/renderer/screens/reviews.tsx
git commit -m "feat(desktop): build file review screen with @agent-coding/ui"
```
