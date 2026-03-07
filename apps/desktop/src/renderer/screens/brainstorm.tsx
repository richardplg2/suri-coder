import { useState, useRef, useEffect, useCallback } from 'react'
import { ScrollArea, Button, Input, ChatBubble } from '@agent-coding/ui'
import { Send, Loader2, Sparkles } from 'lucide-react'
import { WsChannel, WsEvent } from '@agent-coding/shared'
import { QuizCard } from 'renderer/components/brainstorm/quiz-card'
import { BrainstormReview } from 'renderer/components/brainstorm/brainstorm-review'
import { useWsChannel } from 'renderer/hooks/use-ws-channel'
import { useBrainstormStart, useBrainstormMessage } from 'renderer/hooks/queries/use-brainstorm'
import type { BrainstormMessage, QuizData } from 'renderer/types/api'

interface BrainstormScreenProps {
  tabId: string
  projectId: string
  sessionId?: string
}

type BrainstormPhase = 'chat' | 'review'

export function BrainstormScreen({ tabId, projectId, sessionId }: BrainstormScreenProps) {
  const [messages, setMessages] = useState<BrainstormMessage[]>([])
  const [input, setInput] = useState('')
  const [currentSessionId, setCurrentSessionId] = useState(sessionId ?? '')
  const [isWaiting, setIsWaiting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [phase, setPhase] = useState<BrainstormPhase>('chat')
  const [summary, setSummary] = useState('')
  const [specs, setSpecs] = useState<Record<string, string>>({})
  const scrollRef = useRef<HTMLDivElement>(null)

  const startBrainstorm = useBrainstormStart(projectId)
  const sendMessage = useBrainstormMessage(projectId)

  // Start session on mount if no sessionId
  useEffect(() => {
    if (!sessionId) {
      startBrainstorm.mutate(undefined, {
        onSuccess: (data) => {
          setCurrentSessionId(data.session_id)
          if (data.initial_message) {
            setMessages([data.initial_message])
          }
        },
        onError: () => {
          setError('Failed to start brainstorm session. Please try again.')
        },
      })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // WebSocket for live messages
  const handleWsEvent = useCallback((event: WsEvent, data: unknown) => {
    if (event === WsEvent.BrainstormMessage || event === WsEvent.BrainstormQuiz) {
      const msg = data as BrainstormMessage
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev
        return [...prev, msg]
      })
      setIsWaiting(false)
    }

    if (event === WsEvent.BrainstormSummary) {
      const result = data as { summary: string; specs: Record<string, string> }
      setSummary(result.summary)
      setSpecs(result.specs)
      setPhase('review')
    }
  }, [])

  useWsChannel(
    currentSessionId ? WsChannel.BrainstormSession : null,
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
      session_id: currentSessionId,
      role: 'user',
      message_type: 'text',
      content: input.trim(),
      structured_data: null,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setIsWaiting(true)
    sendMessage.mutate(
      { sessionId: currentSessionId, content: input.trim() },
      { onError: () => setIsWaiting(false) },
    )
  }

  const handleQuizSubmit = (answer: string) => {
    setIsWaiting(true)
    sendMessage.mutate(
      { sessionId: currentSessionId, content: answer },
      { onError: () => setIsWaiting(false) },
    )
  }

  if (phase === 'review') {
    return (
      <BrainstormReview
        tabId={tabId}
        summary={summary}
        specs={specs}
        sessionId={currentSessionId}
        projectId={projectId}
      />
    )
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <p className="text-[13px] text-destructive">{error}</p>
        <Button size="sm" variant="outline" onClick={() => { setError(null); window.location.reload() }}>
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Messages */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="mx-auto max-w-2xl space-y-4 p-4">
          {messages.map((msg) => {
            // Quiz messages
            if (msg.message_type === 'quiz' && msg.structured_data) {
              return (
                <QuizCard
                  key={msg.id}
                  data={msg.structured_data as QuizData}
                  onSubmit={handleQuizSubmit}
                />
              )
            }

            // Summary messages
            if (msg.message_type === 'summary') {
              return (
                <div key={msg.id} className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="size-4 text-primary" />
                    <span className="text-[13px] font-semibold">Summary Ready</span>
                  </div>
                  <p className="text-[13px] text-muted-foreground line-clamp-4">{msg.content ?? ''}</p>
                  <Button size="sm" variant="outline" className="mt-3" onClick={() => setPhase('review')}>
                    Review & Edit
                  </Button>
                </div>
              )
            }

            // Text messages (user and assistant)
            return (
              <ChatBubble
                key={msg.id}
                role={msg.role}
                timestamp={new Date(msg.created_at).toLocaleTimeString()}
              >
                {msg.content ?? ''}
              </ChatBubble>
            )
          })}

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
          <Button onClick={handleSend} disabled={!input.trim() || isWaiting} aria-label="Send message">
            <Send className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
