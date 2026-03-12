import { useState } from 'react'
import { SessionHeader } from './session-header'
import { TranscriptRow } from './transcript-row'
import { QuizCard } from './quiz-card'
import { DetailDrawer } from './detail-drawer'
import { SessionInputBar } from './session-input-bar'
import type { SessionData, SessionPanelConfig, TranscriptItem } from './types'

export type { SessionData, TranscriptItem, SessionPanelConfig } from './types'

interface SessionPanelProps {
  session: SessionData
  config?: SessionPanelConfig
  onBack?: () => void
}

export function SessionPanel({ session, config, onBack }: Readonly<SessionPanelProps>) {
  const [selected, setSelected] = useState<TranscriptItem | null>(null)

  const showHeader = config?.showHeader !== false
  const showInputBar = config?.showInputBar !== false

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {showHeader && (
        <SessionHeader
          session={session}
          onBack={onBack}
          onStop={config?.onStop}
          onPause={config?.onPause}
        />
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Left: Transcript */}
        <div className="flex min-h-0 w-[60%] flex-col border-r border-border">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="space-y-1 px-3 py-3">
              {session.items.map((item) => (
                <TranscriptItemRenderer
                  key={item.id}
                  item={item}
                  selectedId={selected?.id ?? null}
                  onSelect={setSelected}
                  onQuizAnswer={config?.onQuizAnswer}
                />
              ))}
            </div>
          </div>

          {showInputBar && (
            <SessionInputBar
              onSend={config?.onSendMessage ?? (() => {})}
              isRunning={session.status === 'running'}
              statusText={session.status === 'running' ? 'Agent is working...' : undefined}
            />
          )}
        </div>

        {/* Right: Detail Drawer */}
        {selected && (
          <DetailDrawer item={selected} onClose={() => setSelected(null)} />
        )}
      </div>
    </div>
  )
}

interface TranscriptItemRendererProps {
  item: TranscriptItem
  selectedId: string | null
  onSelect: (item: TranscriptItem) => void
  onQuizAnswer?: (itemId: string, selectedIds: string[]) => void
}

function TranscriptItemRenderer({
  item,
  selectedId,
  onSelect,
  onQuizAnswer,
}: Readonly<TranscriptItemRendererProps>) {
  if (item.entry.kind === 'quiz') {
    return <QuizCard item={item} onAnswer={onQuizAnswer} />
  }

  return (
    <>
      <TranscriptRow
        item={item}
        isSelected={item.id === selectedId}
        onSelect={onSelect}
      />
      {item.entry.kind === 'subagent' &&
        item.entry.children.map((child) => (
          <TranscriptRow
            key={child.id}
            item={child}
            isSelected={child.id === selectedId}
            onSelect={onSelect}
            indented
          />
        ))}
    </>
  )
}
