# Feature 1: Session Management + WebSocket Streaming

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire the Claude Code SDK into the ARQ worker for real session execution, connect WebSocket streaming end-to-end, and build the frontend chat interface for interacting with Claude Code sessions.

**Architecture:** Backend worker calls Claude Code SDK, publishes streaming events to Redis PubSub. FastAPI WebSocket endpoint relays events to the Electron app. React chat interface renders messages in real-time using `@agent-coding/ui` components (ChatBubble, ToolCallCard, StreamingText, SessionStatusBar).

**Tech Stack:** claude_agent_sdk, ARQ, Redis PubSub, WebSocket, React 19, @agent-coding/ui

**Depends on:** Feature 0 (app shell, API client, routing), UI Primitives plan (packages/ui built)

**Already built (backend):**
- Session + SessionMessage models (`apps/backend/app/models/session.py`)
- Session router with list/detail/cancel (`apps/backend/app/routers/sessions.py`)
- Session schemas (`apps/backend/app/schemas/session.py`)
- WebSocket endpoints for sessions and tickets (`apps/backend/app/routers/websocket.py`)
- Worker placeholder (`apps/backend/app/worker.py`)
- Agent runner service with `build_agent_options` and `run_agent` (`apps/backend/app/services/agent_runner.py`)

**Already built (UI package — no need to create locally):**
- `ChatBubble` — role-based chat message rendering (user/assistant/system)
- `StreamingText` — real-time text with cursor animation
- `ToolCallCard` — expandable tool call visualization with params/result
- `SessionStatusBar` — status indicator with duration/tokens/cost
- `TabBar` — closable tab bar for multiple sessions
- `EmptyState`, `Spinner`, `StatusBadge`, `ScrollArea`, `Textarea`, `Button`

**Remaining work:**
- Backend: Wire real Claude Code SDK into worker, actual Redis PubSub streaming
- Frontend: Session list, chat interface, WebSocket client, message rendering (using @agent-coding/ui)

**Design ref:** `docs/design/pages/sessions.md`

---

### Task 1: Wire Claude Code SDK into ARQ worker

**Files:**
- Modify: `apps/backend/app/services/agent_runner.py`
- Modify: `apps/backend/app/worker.py`
- Test: `apps/backend/tests/test_agent_runner.py`

**Step 1: Write the failing test**

Create `apps/backend/tests/test_agent_runner.py`:

```python
from unittest.mock import AsyncMock, patch

import pytest

from app.services.agent_runner import build_agent_options


def test_build_agent_options_returns_dict():
    """build_agent_options should return a dict with cwd, system_prompt, etc."""
    # Read the existing build_agent_options to understand its signature
    # Then write a test that verifies the output structure
    pass


@pytest.mark.asyncio
async def test_run_agent_publishes_to_redis():
    """run_agent should publish session events to Redis PubSub."""
    # Mock the Claude SDK client and verify Redis publish calls
    pass
```

**Step 2: Read existing agent_runner.py and worker.py**

Read `apps/backend/app/services/agent_runner.py` and `apps/backend/app/worker.py` to understand the current placeholder implementation.

**Step 3: Update agent_runner.py to use Claude Code SDK**

Replace the placeholder with actual SDK integration. The worker should:
1. Load agent config and skills from DB
2. Build `ClaudeCodeSession` options
3. Stream events, publishing each to Redis PubSub `session:{id}`
4. Save messages to SessionMessage table
5. Update session status (running -> completed/failed)

**Step 4: Run tests**

Run: `cd apps/backend && uv run pytest tests/test_agent_runner.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/app/services/agent_runner.py apps/backend/app/worker.py apps/backend/tests/test_agent_runner.py
git commit -m "feat(backend): wire Claude Code SDK into ARQ worker"
```

---

### Task 2: WebSocket client hook in frontend

**Files:**
- Create: `apps/desktop/src/renderer/hooks/use-websocket.ts`

**Step 1: Create useWebSocket hook**

Create `apps/desktop/src/renderer/hooks/use-websocket.ts`:

```typescript
import { useCallback, useEffect, useRef, useState } from 'react'

interface WebSocketMessage {
  type: string
  [key: string]: unknown
}

interface UseWebSocketOptions {
  url: string
  onMessage?: (msg: WebSocketMessage) => void
  enabled?: boolean
}

export function useWebSocket({ url, onMessage, enabled = true }: UseWebSocketOptions) {
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    if (!enabled) return

    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => setConnected(true)
    ws.onclose = () => setConnected(false)
    ws.onerror = () => setConnected(false)
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        onMessage?.(data)
      } catch {
        // ignore non-JSON messages
      }
    }

    return () => {
      ws.close()
      wsRef.current = null
      setConnected(false)
    }
  }, [url, enabled])

  const send = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
    }
  }, [])

  return { connected, send }
}
```

**Step 2: Commit**

```bash
git add apps/desktop/src/renderer/hooks/
git commit -m "feat(desktop): add useWebSocket hook for session streaming"
```

---

### Task 3: Session list API and state

**Files:**
- Create: `apps/desktop/src/renderer/hooks/use-sessions.ts`

**Step 1: Create sessions hook**

Create `apps/desktop/src/renderer/hooks/use-sessions.ts`:

```typescript
import { useCallback, useEffect, useState } from 'react'

import { api } from '../lib/api-client'

interface Session {
  id: string
  step_id: string
  status: string
  git_branch: string | null
  cost_usd: number | null
  tokens_used: number | null
  started_at: string | null
  finished_at: string | null
}

export function useSessions(stepId?: string) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)

  const fetchSessions = useCallback(async () => {
    setLoading(true)
    try {
      const path = stepId ? `/steps/${stepId}/sessions` : '/sessions'
      const data = await api.get<Session[]>(path)
      setSessions(data)
    } catch {
      setSessions([])
    } finally {
      setLoading(false)
    }
  }, [stepId])

  useEffect(() => {
    fetchSessions()
  }, [fetchSessions])

  return { sessions, loading, refresh: fetchSessions }
}
```

**Step 2: Commit**

```bash
git add apps/desktop/src/renderer/hooks/use-sessions.ts
git commit -m "feat(desktop): add useSessions hook for session data fetching"
```

---

### Task 4: Sessions screen with chat interface

**Files:**
- Modify: `apps/desktop/src/renderer/screens/sessions.tsx`

**UI imports from `@agent-coding/ui`:** `ChatBubble`, `StreamingText`, `ToolCallCard`, `SessionStatusBar`, `TabBar`, `SplitPane`, `SplitPanePanel`, `SplitPaneHandle`, `Panel`, `ScrollArea`, `Textarea`, `Button`, `EmptyState`, `Spinner`, `StatusBadge`

**Step 1: Build the sessions screen**

Replace the placeholder with a full sessions screen per `docs/design/pages/sessions.md`:

```tsx
import { useCallback, useRef, useState } from 'react'
import { MessageSquare, Send } from 'lucide-react'
import {
  ChatBubble,
  StreamingText,
  ToolCallCard,
  SessionStatusBar,
  TabBar,
  SplitPane,
  SplitPanePanel,
  SplitPaneHandle,
  Panel,
  ScrollArea,
  Textarea,
  Button,
  EmptyState,
  Spinner,
  StatusBadge,
} from '@agent-coding/ui'

import { useSessions } from '../hooks/use-sessions'
import { useWebSocket } from '../hooks/use-websocket'

interface Message {
  id: string
  role: 'user' | 'assistant' | 'tool'
  content: string
  tool_use?: { tool: string; input: Record<string, unknown>; result?: string }
}

export function SessionsScreen() {
  const { sessions, loading } = useSessions()
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [streamingContent, setStreamingContent] = useState('')
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const selectedSession = sessions.find((s) => s.id === selectedSessionId)

  const { connected, send } = useWebSocket({
    url: selectedSessionId
      ? `ws://localhost:8000/ws/sessions/${selectedSessionId}`
      : '',
    enabled: !!selectedSessionId,
    onMessage: useCallback((msg) => {
      if (msg.type === 'text') {
        setStreamingContent((prev) => prev + (msg.content as string))
      } else if (msg.type === 'tool_use') {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'tool',
            content: '',
            tool_use: {
              tool: msg.tool as string,
              input: msg.input as Record<string, unknown>,
            },
          },
        ])
      } else if (msg.type === 'complete') {
        setStreamingContent((prev) => {
          if (prev) {
            setMessages((msgs) => [
              ...msgs,
              { id: crypto.randomUUID(), role: 'assistant', content: prev },
            ])
          }
          return ''
        })
      }
    }, []),
  })

  function handleSend() {
    if (!input.trim()) return
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: 'user', content: input },
    ])
    send({ type: 'message', content: input })
    setInput('')
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner label="Loading sessions..." />
      </div>
    )
  }

  return (
    <SplitPane direction="horizontal">
      {/* Session list panel */}
      <SplitPanePanel defaultSize={25} minSize={15}>
        <Panel>
          <Panel.Header>
            <Panel.Title>Sessions</Panel.Title>
          </Panel.Header>
          <Panel.Content>
            <ScrollArea className="h-full">
              {sessions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedSessionId(s.id)}
                  className={`w-full cursor-pointer border-b border-border px-3 py-2 text-left text-[13px] transition-colors duration-150 ${
                    selectedSessionId === s.id
                      ? 'bg-[var(--selection)] text-primary'
                      : 'text-muted-foreground hover:bg-secondary'
                  }`}
                >
                  <p className="truncate text-foreground">{s.id.slice(0, 8)}</p>
                  <StatusBadge status={s.status as any} showDot className="mt-1">
                    {s.status}
                  </StatusBadge>
                </button>
              ))}
            </ScrollArea>
          </Panel.Content>
        </Panel>
      </SplitPanePanel>

      <SplitPaneHandle />

      {/* Chat panel */}
      <SplitPanePanel defaultSize={75}>
        <Panel>
          <Panel.Content className="flex flex-col">
            {!selectedSessionId ? (
              <EmptyState
                icon={MessageSquare}
                title="No session selected"
                description="Select a session from the list to view its chat"
              />
            ) : (
              <>
                {/* Messages */}
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-3">
                    {messages.map((msg) =>
                      msg.tool_use ? (
                        <ToolCallCard
                          key={msg.id}
                          toolName={msg.tool_use.tool}
                          params={msg.tool_use.input}
                          result={msg.tool_use.result}
                          status="completed"
                        />
                      ) : (
                        <ChatBubble key={msg.id} role={msg.role as 'user' | 'assistant'}>
                          {msg.content}
                        </ChatBubble>
                      ),
                    )}
                    {streamingContent && (
                      <ChatBubble role="assistant">
                        <StreamingText content={streamingContent} isStreaming />
                      </ChatBubble>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                {/* Input */}
                <div className="border-t border-border p-3">
                  <div className="flex gap-2">
                    <Textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          handleSend()
                        }
                      }}
                      placeholder="Send a message..."
                      rows={1}
                      className="flex-1 resize-none"
                    />
                    <Button onClick={handleSend} size="icon">
                      <Send size={16} />
                    </Button>
                  </div>
                </div>

                {/* Status bar */}
                <SessionStatusBar
                  status={selectedSession?.status === 'running' ? 'running' : selectedSession?.status === 'completed' ? 'completed' : 'idle'}
                  tokenCount={selectedSession?.tokens_used ?? undefined}
                  cost={selectedSession?.cost_usd ?? undefined}
                />
              </>
            )}
          </Panel.Content>
        </Panel>
      </SplitPanePanel>
    </SplitPane>
  )
}
```

**Step 2: Verify the screen renders**

Run: `pnpm --filter my-electron-app dev`
Expected: Sessions screen shows session list + chat interface with @agent-coding/ui components

**Step 3: Commit**

```bash
git add apps/desktop/src/renderer/screens/sessions.tsx
git commit -m "feat(desktop): build sessions screen with @agent-coding/ui chat components"
```

---

### Task 5: End-to-end streaming test

**Step 1: Start backend and verify WebSocket**

Run: `cd apps/backend && uv run fastapi dev app/main.py --port 8000`

**Step 2: Test WebSocket connection with wscat**

Run: `npx wscat -c ws://localhost:8000/ws/sessions/test-id`
Expected: Connection established

**Step 3: Create a session via API and verify streaming**

```bash
# Create a ticket with a workflow step, then run the step
# The session should stream events through WebSocket
```

**Step 4: Verify frontend receives and renders messages**

Run: `pnpm --filter my-electron-app dev`
Expected: Messages stream into the chat interface in real-time
