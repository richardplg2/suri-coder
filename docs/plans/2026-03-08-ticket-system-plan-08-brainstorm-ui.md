# Ticket System — Plan 08: Brainstorming Frontend

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build brainstorming chat UI with quiz components, Tiptap rich markdown editor for review, and ticket creation flow.

**Architecture:** Chat interface streams messages via WebSocket. Quiz messages render as interactive cards. Summary displayed in Tiptap editor with inline commenting. Batch update sends comments back to agent.

**Tech Stack:** React 19, Tiptap editor, @agent-coding/ui, WebSocket

**Depends on:** [Plan 06](./2026-03-08-ticket-system-plan-06-brainstorm-backend.md), [Plan 07](./2026-03-08-ticket-system-plan-07-ticket-detail-ui.md)
**Required by:** [Plan 10](./2026-03-08-ticket-system-plan-10-figma-integration.md)

---

## Task 1: Install Tiptap dependencies

**Description:** Add Tiptap packages to the desktop app. These provide a rich markdown editor used for reviewing brainstorm summaries and editing specs.

**Commands:**

```bash
pnpm --filter my-electron-app add @tiptap/react @tiptap/starter-kit @tiptap/extension-highlight @tiptap/extension-placeholder @tiptap/extension-collaboration @tiptap/pm
```

**Files to modify:**
- `apps/desktop/package.json` — new dependencies added automatically by pnpm

**Verification:** Run `pnpm --filter my-electron-app dev` and confirm no build errors.

**Commit message:** `chore(desktop): add Tiptap editor dependencies`

---

## Task 2: Create ticket creation modal

**Description:** A modal triggered by "New Ticket" button (from project screen). Shows two options as large clickable cards: "Start with AI" (opens brainstorm chat) and "Start from Figma" (opens Figma import screen, Plan 10). The modal uses `useModalStore` to manage visibility.

**Files to create:**
- `apps/desktop/src/renderer/components/create-ticket-modal.tsx`

**Key code:**

```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@agent-coding/ui'
import { Bot, Figma } from 'lucide-react'
import { useModalStore } from 'renderer/stores/use-modal-store'
import { useTabStore } from 'renderer/stores/use-tab-store'

export function CreateTicketModal() {
  const { activeModal, modalData, close } = useModalStore()
  const isOpen = activeModal === 'create-ticket'
  const projectId = (modalData?.projectId as string) ?? ''

  const handleStartWithAI = () => {
    close()
    // Navigate to brainstorm screen — open a new tab
    // Tab type will be 'brainstorm', handled by tab-content.tsx
    useTabStore.getState().openBrainstormTab(projectId, 'New Brainstorm')
  }

  const handleStartFromFigma = () => {
    close()
    // Open Figma import tab (Plan 10)
    useTabStore.getState().openFigmaImportTab(projectId, 'Figma Import')
  }

  return (
    <Dialog open={isOpen} onOpenChange={close}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create New Ticket</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-4">
          {/* Start with AI */}
          <button
            type="button"
            onClick={handleStartWithAI}
            className="flex flex-col items-center gap-3 rounded-xl border-2 border-border p-6 transition-all hover:border-primary hover:bg-primary/5 cursor-pointer"
          >
            <Bot className="size-10 text-blue-400" />
            <div className="text-center">
              <div className="text-[14px] font-semibold">Start with AI</div>
              <p className="mt-1 text-caption text-muted-foreground">
                AI will ask questions to understand your requirements and generate specs.
              </p>
            </div>
          </button>

          {/* Start from Figma */}
          <button
            type="button"
            onClick={handleStartFromFigma}
            className="flex flex-col items-center gap-3 rounded-xl border-2 border-border p-6 transition-all hover:border-primary hover:bg-primary/5 cursor-pointer"
          >
            <Figma className="size-10 text-purple-400" />
            <div className="text-center">
              <div className="text-[14px] font-semibold">Start from Figma</div>
              <p className="mt-1 text-caption text-muted-foreground">
                Import annotated Figma designs and generate specs from them.
              </p>
            </div>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

**Files to modify:**
- `apps/desktop/src/renderer/stores/use-tab-store.ts` — add `openBrainstormTab` and `openFigmaImportTab` methods
- `apps/desktop/src/renderer/types/tabs.ts` — add `'brainstorm'` and `'figma-import'` tab types
- `apps/desktop/src/renderer/components/tab-content.tsx` — add routing for brainstorm and figma-import tab types

**Tab store additions:**

```tsx
openBrainstormTab: (projectId: string, label: string) => {
  const tabId = `brainstorm-${Date.now()}`
  const newTab: AppTab = { id: tabId, type: 'brainstorm', projectId, label, pinned: false }
  set({ tabs: [...get().tabs, newTab], activeTabId: tabId })
}

openFigmaImportTab: (projectId: string, label: string) => {
  const tabId = `figma-import-${Date.now()}`
  const newTab: AppTab = { id: tabId, type: 'figma-import', projectId, label, pinned: false }
  set({ tabs: [...get().tabs, newTab], activeTabId: tabId })
}
```

**Commit message:** `feat(desktop): create ticket creation modal with AI and Figma options`

---

## Task 3: Build brainstorm chat screen

**Description:** The brainstorm chat screen is a full-screen tab that shows a message list in a `ScrollArea` with an input bar at the bottom. Messages are loaded from WebSocket events and the brainstorm API. The input bar has a text input and send button. On mount, it calls the brainstorm start API to initiate a session.

**Files to create:**
- `apps/desktop/src/renderer/screens/brainstorm.tsx`

**Props/Types:**

```tsx
interface BrainstormScreenProps {
  projectId: string
  sessionId?: string  // undefined for new sessions
}

// Message types for the chat
interface BrainstormMessage {
  id: string
  role: 'user' | 'assistant'
  type: 'text' | 'quiz' | 'summary'
  content: string
  quiz_data?: QuizData
  created_at: string
}

interface QuizData {
  question: string
  description?: string
  type: 'single' | 'multi'
  options: QuizOption[]
  allow_custom: boolean
}

interface QuizOption {
  id: string
  label: string
  description?: string
  recommended?: boolean
}
```

**Key code:**

```tsx
import { useState, useRef, useEffect, useCallback } from 'react'
import { ScrollArea, Button, Input } from '@agent-coding/ui'
import { Send, Loader2 } from 'lucide-react'
import { ChatBubble } from '@agent-coding/ui'
import { QuizCard } from 'renderer/components/brainstorm/quiz-card'
import { useWsChannel } from 'renderer/hooks/use-ws-channel'
import { useBrainstormStart, useBrainstormMessage } from 'renderer/hooks/queries/use-brainstorm'
import type { WsEvent } from '@agent-coding/shared'

export function BrainstormScreen({ projectId, sessionId }: BrainstormScreenProps) {
  const [messages, setMessages] = useState<BrainstormMessage[]>([])
  const [input, setInput] = useState('')
  const [currentSessionId, setCurrentSessionId] = useState(sessionId ?? '')
  const [isWaiting, setIsWaiting] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const startBrainstorm = useBrainstormStart(projectId)
  const sendMessage = useBrainstormMessage(projectId)

  // Start session on mount if no sessionId
  useEffect(() => {
    if (!sessionId) {
      startBrainstorm.mutate(undefined, {
        onSuccess: (data) => {
          setCurrentSessionId(data.session_id)
        },
      })
    }
  }, [])

  // WebSocket for live messages
  const handleWsEvent = useCallback((event: WsEvent, data: unknown) => {
    const msg = data as BrainstormMessage
    if (event === 'brainstorm:message') {
      setMessages((prev) => [...prev, msg])
      setIsWaiting(false)
    }
  }, [])

  useWsChannel(
    currentSessionId ? 'brainstorm:session' : null,
    { session_id: currentSessionId },
    handleWsEvent,
  )

  // Auto-scroll to bottom
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const handleSend = () => {
    if (!input.trim() || !currentSessionId) return
    const userMsg: BrainstormMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      type: 'text',
      content: input.trim(),
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setIsWaiting(true)
    sendMessage.mutate({ sessionId: currentSessionId, content: input.trim() })
  }

  return (
    <div className="flex h-full flex-col">
      {/* Messages */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="mx-auto max-w-2xl space-y-4 p-4">
          {messages.map((msg) => (
            <div key={msg.id}>
              {msg.type === 'quiz' && msg.quiz_data ? (
                <QuizCard
                  data={msg.quiz_data}
                  onSubmit={(answer) => {
                    sendMessage.mutate({ sessionId: currentSessionId, content: answer })
                    setIsWaiting(true)
                  }}
                />
              ) : (
                <ChatBubble
                  role={msg.role}
                  content={msg.content}
                  timestamp={new Date(msg.created_at).toLocaleTimeString()}
                />
              )}
            </div>
          ))}
          {isWaiting && (
            <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> AI is thinking...
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input bar */}
      <div className="border-t border-border p-4">
        <div className="mx-auto flex max-w-2xl gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Type your message..."
            className="flex-1"
          />
          <Button onClick={handleSend} disabled={!input.trim() || isWaiting}>
            <Send className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
```

**Commit message:** `feat(desktop): build brainstorm chat screen with message list and input bar`

---

## Task 4: Build QuizCard component

**Description:** Renders a quiz question from the AI agent. Supports single-select (radio) and multi-select (checkbox) modes. Each option shows its label and optional description. Options marked `recommended` get a yellow "Recommended" badge. If `allow_custom` is true, a text input appears at the bottom for free-form answers. Submit button sends the selected answer(s) back.

**Files to create:**
- `apps/desktop/src/renderer/components/brainstorm/quiz-card.tsx`

**Props/Types:**

```tsx
interface QuizCardProps {
  data: QuizData
  onSubmit: (answer: string) => void
  disabled?: boolean
}
```

**Key code:**

```tsx
import { useState } from 'react'
import { Button, Badge, Input } from '@agent-coding/ui'
import { CheckCircle } from 'lucide-react'

interface QuizCardProps {
  data: QuizData
  onSubmit: (answer: string) => void
  disabled?: boolean
}

export function QuizCard({ data, onSubmit, disabled }: QuizCardProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [customText, setCustomText] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const handleToggle = (optionId: string) => {
    if (submitted) return
    setSelected((prev) => {
      const next = new Set(prev)
      if (data.type === 'single') {
        return new Set([optionId])
      }
      if (next.has(optionId)) next.delete(optionId)
      else next.add(optionId)
      return next
    })
  }

  const handleSubmit = () => {
    if (submitted) return
    const selectedLabels = data.options
      .filter((o) => selected.has(o.id))
      .map((o) => o.label)
    const parts = [...selectedLabels]
    if (customText.trim()) parts.push(customText.trim())
    const answer = parts.join(', ')
    setSubmitted(true)
    onSubmit(answer)
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      {/* Question */}
      <div>
        <h4 className="text-[14px] font-semibold">{data.question}</h4>
        {data.description && (
          <p className="mt-1 text-caption text-muted-foreground">{data.description}</p>
        )}
      </div>

      {/* Options */}
      <div className="space-y-2">
        {data.options.map((option) => (
          <button
            key={option.id}
            type="button"
            disabled={submitted || disabled}
            onClick={() => handleToggle(option.id)}
            className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-all ${
              selected.has(option.id)
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50'
            } ${submitted ? 'opacity-70 cursor-default' : 'cursor-pointer'}`}
          >
            {/* Radio/checkbox indicator */}
            <div className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-${data.type === 'single' ? 'full' : 'sm'} border ${
              selected.has(option.id) ? 'border-primary bg-primary' : 'border-muted-foreground'
            }`}>
              {selected.has(option.id) && <CheckCircle className="size-3 text-primary-foreground" />}
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-medium">{option.label}</span>
                {option.recommended && (
                  <Badge className="bg-yellow-500/15 text-yellow-400 text-[10px] px-1.5 py-0">
                    Recommended
                  </Badge>
                )}
              </div>
              {option.description && (
                <p className="mt-0.5 text-caption text-muted-foreground">{option.description}</p>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Custom text input */}
      {data.allow_custom && !submitted && (
        <Input
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          placeholder="Or type your own answer..."
          className="text-[13px]"
        />
      )}

      {/* Submit button */}
      {!submitted && (
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={selected.size === 0 && !customText.trim()}
        >
          Submit Answer
        </Button>
      )}

      {/* Submitted indicator */}
      {submitted && (
        <div className="flex items-center gap-1.5 text-caption text-green-400">
          <CheckCircle className="size-3.5" /> Answer submitted
        </div>
      )}
    </div>
  )
}
```

**Commit message:** `feat(desktop): build QuizCard component with single/multi select, recommended badges, custom input`

---

## Task 5: Build brainstorm query hooks

**Description:** Create TanStack Query hooks for all brainstorm API endpoints. These manage session lifecycle: start, send message, complete, batch update, and create ticket from brainstorm output.

**Files to create:**
- `apps/desktop/src/renderer/hooks/queries/use-brainstorm.ts`

**Key code:**

```tsx
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from 'renderer/lib/api-client'

interface BrainstormStartResponse {
  session_id: string
  initial_message: BrainstormMessage
}

interface BrainstormMessageResponse {
  message: BrainstormMessage
}

interface BrainstormCompleteResponse {
  summary: string
  specs: Record<string, string>
}

interface BatchUpdatePayload {
  comments: Array<{ section: string; text: string; range?: { from: number; to: number } }>
}

interface CreateTicketFromBrainstormPayload {
  session_id: string
  title: string
  type?: string
  priority?: string
}

export function useBrainstormStart(projectId: string) {
  return useMutation({
    mutationFn: (params?: { figma_data?: Record<string, unknown> }) =>
      apiClient<BrainstormStartResponse>(
        `/projects/${projectId}/brainstorm/start`,
        {
          method: 'POST',
          body: JSON.stringify(params ?? {}),
        },
      ),
  })
}

export function useBrainstormMessage(projectId: string) {
  return useMutation({
    mutationFn: ({ sessionId, content }: { sessionId: string; content: string }) =>
      apiClient<BrainstormMessageResponse>(
        `/projects/${projectId}/brainstorm/${sessionId}/message`,
        {
          method: 'POST',
          body: JSON.stringify({ content }),
        },
      ),
  })
}

export function useBrainstormComplete(projectId: string) {
  return useMutation({
    mutationFn: (sessionId: string) =>
      apiClient<BrainstormCompleteResponse>(
        `/projects/${projectId}/brainstorm/${sessionId}/complete`,
        { method: 'POST' },
      ),
  })
}

export function useBrainstormBatchUpdate(projectId: string) {
  return useMutation({
    mutationFn: ({ sessionId, payload }: { sessionId: string; payload: BatchUpdatePayload }) =>
      apiClient<BrainstormCompleteResponse>(
        `/projects/${projectId}/brainstorm/${sessionId}/batch-update`,
        {
          method: 'POST',
          body: JSON.stringify(payload),
        },
      ),
  })
}

export function useCreateTicketFromBrainstorm(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateTicketFromBrainstormPayload) =>
      apiClient<{ ticket_id: string }>(
        `/projects/${projectId}/brainstorm/create-ticket`,
        {
          method: 'POST',
          body: JSON.stringify(payload),
        },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'tickets'] })
    },
  })
}
```

**Commit message:** `feat(desktop): add brainstorm query hooks for session lifecycle and ticket creation`

---

## Task 6: Build WebSocket listener for brainstorm:session channel

**Description:** Use `useWsChannel` to subscribe to the `brainstorm:session` channel scoped by `session_id`. Handle incoming events: `brainstorm:message` (append text/quiz/summary message to chat), `brainstorm:typing` (show typing indicator), `brainstorm:complete` (transition to review screen). This is integrated directly into the brainstorm screen component (Task 3).

**Files to modify:**
- `apps/desktop/src/renderer/screens/brainstorm.tsx` — already has WebSocket integration from Task 3; this task adds handling for `brainstorm:typing` and `brainstorm:complete` events

**Key code additions:**

```tsx
const handleWsEvent = useCallback((event: WsEvent, data: unknown) => {
  if (event === 'brainstorm:message') {
    const msg = data as BrainstormMessage
    setMessages((prev) => [...prev, msg])
    setIsWaiting(false)
  }

  if (event === 'brainstorm:typing') {
    setIsWaiting(true)
  }

  if (event === 'brainstorm:complete') {
    const result = data as { summary: string; specs: Record<string, string> }
    setSummary(result.summary)
    setSpecs(result.specs)
    setPhase('review')  // Switch from chat to review phase
  }
}, [])
```

Add phase state to brainstorm screen:

```tsx
type BrainstormPhase = 'chat' | 'review'
const [phase, setPhase] = useState<BrainstormPhase>('chat')
const [summary, setSummary] = useState('')
const [specs, setSpecs] = useState<Record<string, string>>({})

// In render:
if (phase === 'review') {
  return <BrainstormReview summary={summary} specs={specs} sessionId={currentSessionId} projectId={projectId} />
}
```

**Commit message:** `feat(desktop): add brainstorm WebSocket event handling for typing, message, and completion`

---

## Task 7: Build TiptapEditor component

**Description:** A reusable rich markdown editor built on Tiptap. Includes a toolbar with bold, italic, heading, list, and code block buttons. Uses the `highlight` extension for text selection (used in review commenting). Uses the `placeholder` extension for empty state text.

**Files to create:**
- `apps/desktop/src/renderer/components/tiptap-editor.tsx`

**Props/Types:**

```tsx
interface TiptapEditorProps {
  content: string
  onChange?: (content: string) => void
  editable?: boolean
  placeholder?: string
  onSelectionChange?: (selection: { from: number; to: number; text: string } | null) => void
  className?: string
}
```

**Key code:**

```tsx
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Highlight from '@tiptap/extension-highlight'
import Placeholder from '@tiptap/extension-placeholder'
import { Button } from '@agent-coding/ui'
import { Bold, Italic, Heading1, Heading2, List, ListOrdered, Code } from 'lucide-react'

export function TiptapEditor({
  content,
  onChange,
  editable = true,
  placeholder = 'Start typing...',
  onSelectionChange,
  className,
}: TiptapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Highlight.configure({ multicolor: true }),
      Placeholder.configure({ placeholder }),
    ],
    content,
    editable,
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML())
    },
    onSelectionUpdate: ({ editor }) => {
      const { from, to } = editor.state.selection
      if (from !== to) {
        const text = editor.state.doc.textBetween(from, to, ' ')
        onSelectionChange?.({ from, to, text })
      } else {
        onSelectionChange?.(null)
      }
    },
  })

  if (!editor) return null

  return (
    <div className={className}>
      {/* Toolbar */}
      {editable && (
        <div className="flex items-center gap-1 border-b border-border px-2 py-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={editor.isActive('bold') ? 'bg-secondary' : ''}
          >
            <Bold className="size-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={editor.isActive('italic') ? 'bg-secondary' : ''}
          >
            <Italic className="size-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={editor.isActive('heading', { level: 1 }) ? 'bg-secondary' : ''}
          >
            <Heading1 className="size-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={editor.isActive('heading', { level: 2 }) ? 'bg-secondary' : ''}
          >
            <Heading2 className="size-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={editor.isActive('bulletList') ? 'bg-secondary' : ''}
          >
            <List className="size-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={editor.isActive('orderedList') ? 'bg-secondary' : ''}
          >
            <ListOrdered className="size-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            className={editor.isActive('codeBlock') ? 'bg-secondary' : ''}
          >
            <Code className="size-3.5" />
          </Button>
        </div>
      )}

      {/* Editor content */}
      <EditorContent
        editor={editor}
        className="prose prose-sm prose-invert max-w-none p-4 focus:outline-none [&_.ProseMirror]:min-h-[200px] [&_.ProseMirror]:outline-none"
      />
    </div>
  )
}
```

**Commit message:** `feat(desktop): build TiptapEditor component with toolbar, highlight, and placeholder`

---

## Task 8: Build review screen

**Description:** The review screen is shown after brainstorm completes. It displays the AI-generated summary in a `TiptapEditor` (read-only or editable). Users can select text and add inline comments via a popover. A comment list below shows all comments. Two action buttons: "Batch Update with AI" (sends comments back to the agent for revision) and "Create Ticket" (finalizes and creates the ticket).

**Files to create:**
- `apps/desktop/src/renderer/components/brainstorm/brainstorm-review.tsx`

**Props/Types:**

```tsx
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
```

**Key code:**

```tsx
import { useState, useCallback } from 'react'
import { Button, ScrollArea, Popover, PopoverContent, PopoverTrigger, Input, Separator } from '@agent-coding/ui'
import { MessageSquare, Sparkles, Ticket, Trash2 } from 'lucide-react'
import { TiptapEditor } from 'renderer/components/tiptap-editor'
import { useBrainstormBatchUpdate, useCreateTicketFromBrainstorm } from 'renderer/hooks/queries/use-brainstorm'
import { useTabStore } from 'renderer/stores/use-tab-store'

export function BrainstormReview({ summary, specs, sessionId, projectId }: BrainstormReviewProps) {
  const [comments, setComments] = useState<InlineComment[]>([])
  const [currentSelection, setCurrentSelection] = useState<{ from: number; to: number; text: string } | null>(null)
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

          {/* Comment popover — appears when text is selected */}
          {currentSelection && (
            <div className="mx-4 mb-4 flex items-center gap-2 rounded-lg border border-border bg-card p-3">
              <MessageSquare className="size-4 text-muted-foreground shrink-0" />
              <span className="text-caption text-muted-foreground truncate max-w-48">
                "{currentSelection.text}"
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
          <div className="section-header px-4 py-3">
            Comments ({comments.length})
          </div>
          <ScrollArea className="h-full">
            <div className="space-y-2 p-4">
              {comments.map((comment) => (
                <div key={comment.id} className="rounded-lg border border-border bg-card p-3">
                  <div className="text-caption text-muted-foreground italic truncate">
                    "{comment.selectedText}"
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
```

**Commit message:** `feat(desktop): build brainstorm review screen with TiptapEditor, inline comments, and ticket creation`

---

## Task 9: Wire up full brainstorm flow

**Description:** Connect all brainstorm pieces: Create Ticket modal opens brainstorm tab, brainstorm chat runs until completion, review screen allows commenting and ticket creation. Update `tab-content.tsx` to route brainstorm tab type to `BrainstormScreen`. Ensure the brainstorm tab closes after ticket creation and opens the new ticket tab.

**Files to modify:**
- `apps/desktop/src/renderer/components/tab-content.tsx` — add case for `'brainstorm'` tab type
- `apps/desktop/src/renderer/types/tabs.ts` — ensure `BrainstormTab` type exists
- `apps/desktop/src/renderer/screens/brainstorm.tsx` — add cleanup on unmount (close WebSocket subscription)

**Key code for tab-content.tsx:**

```tsx
case 'brainstorm':
  return <BrainstormScreen projectId={tab.projectId} />
```

**Key code for tabs.ts:**

```tsx
interface BrainstormTab {
  id: string
  type: 'brainstorm'
  projectId: string
  label: string
  pinned: false
}

// Add to AppTab union type
export type AppTab = HomeTab | ProjectTab | TicketTab | BrainstormTab | FigmaImportTab
```

**Files to modify for project screen (trigger):**
- Wherever the "New Ticket" button exists, wire it to `useModalStore.getState().open('create-ticket', { projectId })`

**Commit message:** `feat(desktop): wire brainstorm flow end-to-end from ticket creation to review`

---

## Task 10: Add brainstorm messages to chat with proper styling

**Description:** Style all message types correctly in the brainstorm chat. Assistant text messages use `ChatBubble` with left alignment and a bot avatar. User messages use `ChatBubble` with right alignment. Quiz messages use `QuizCard` (Task 4). Summary messages render as a highlighted card with a "Review Summary" header. Ensure proper spacing and visual hierarchy.

**Files to modify:**
- `apps/desktop/src/renderer/screens/brainstorm.tsx` — refine message rendering

**Key code:**

```tsx
{messages.map((msg) => {
  // User messages
  if (msg.role === 'user') {
    return (
      <div key={msg.id} className="flex justify-end">
        <ChatBubble role="user" content={msg.content} />
      </div>
    )
  }

  // Quiz messages
  if (msg.type === 'quiz' && msg.quiz_data) {
    return (
      <QuizCard
        key={msg.id}
        data={msg.quiz_data}
        onSubmit={(answer) => {
          sendMessage.mutate({ sessionId: currentSessionId, content: answer })
          setIsWaiting(true)
        }}
      />
    )
  }

  // Summary messages
  if (msg.type === 'summary') {
    return (
      <div key={msg.id} className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="size-4 text-primary" />
          <span className="text-[13px] font-semibold">Summary Ready</span>
        </div>
        <p className="text-[13px] text-muted-foreground line-clamp-4">{msg.content}</p>
        <Button size="sm" variant="outline" className="mt-3" onClick={() => setPhase('review')}>
          Review & Edit
        </Button>
      </div>
    )
  }

  // Default assistant text
  return (
    <div key={msg.id} className="flex justify-start">
      <ChatBubble role="assistant" content={msg.content} />
    </div>
  )
})}
```

**Commit message:** `feat(desktop): style brainstorm messages with ChatBubble, QuizCard, and summary card`
