import { SessionPanel } from 'renderer/components/session/session-view'
import { BrainstormReview } from 'renderer/components/brainstorm-review/review-layout'
import { useBrainstormStore } from 'renderer/stores/use-brainstorm-store'

interface BrainstormScreenProps {
  projectId: string
  brainstormId: string
}

export function BrainstormScreen({ projectId, brainstormId }: Readonly<BrainstormScreenProps>) {
  const session = useBrainstormStore((s) => s.sessions[brainstormId])
  const setView = useBrainstormStore((s) => s.setView)

  if (!session) {
    return <div className="flex h-full items-center justify-center text-muted-foreground">Brainstorm session not found</div>
  }

  if (session.view === 'session') {
    return (
      <SessionPanel
        session={session.sessionData}
        config={{
          showHeader: true,
          showInputBar: true,
          onSendMessage: () => {},
        }}
        onBack={() => setView(brainstormId, 'review')}
      />
    )
  }

  return (
    <BrainstormReview
      session={session}
      onRevise={() => setView(brainstormId, 'session')}
    />
  )
}
