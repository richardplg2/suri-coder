import { useState } from 'react'
import { ScrollArea, StatusBadge } from '@agent-coding/ui'
import { SessionMessage, type SessionMessageData } from './session-message'
import { InspectorPanel } from './inspector-panel'

export interface SessionData {
  id: string
  stepName: string
  status: 'running' | 'completed' | 'failed'
  duration?: string
  tokenCount?: number
  messages: SessionMessageData[]
}

interface SessionViewProps {
  sessions: SessionData[]
}

export function SessionView({ sessions }: SessionViewProps) {
  const [selectedMessage, setSelectedMessage] = useState<SessionMessageData | null>(null)

  return (
    <div className="flex h-full">
      {/* Transcript */}
      <ScrollArea className="flex-1">
        <div className="py-2">
          {sessions.map((session) => (
            <div key={session.id} className="mb-4">
              {/* Session header */}
              <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border/50 bg-background/80 backdrop-blur-sm px-4 py-2">
                <StatusBadge status={session.status === 'running' ? 'running' : session.status === 'completed' ? 'passed' : 'failed'} />
                <span className="text-xs font-semibold">{session.stepName}</span>
                <span className="text-xs text-muted-foreground">Session #{session.id}</span>
                {session.duration && (
                  <span className="text-[11px] text-muted-foreground">{session.duration}</span>
                )}
                {session.tokenCount && (
                  <span className="text-[11px] text-muted-foreground">{session.tokenCount.toLocaleString()} tokens</span>
                )}
              </div>

              {/* Messages */}
              {session.messages.map((msg) => (
                <SessionMessage
                  key={msg.id}
                  message={msg}
                  isSelected={selectedMessage?.id === msg.id}
                  onSelect={setSelectedMessage}
                />
              ))}
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Inspector */}
      {selectedMessage && (
        <InspectorPanel
          message={selectedMessage}
          onClose={() => setSelectedMessage(null)}
        />
      )}
    </div>
  )
}
