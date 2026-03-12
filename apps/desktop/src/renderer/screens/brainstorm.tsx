import { useEffect } from 'react'
import { SessionPanel } from 'renderer/components/session/session-view'
import { BrainstormReview } from 'renderer/components/brainstorm-review/review-layout'
import { useBrainstormStore } from 'renderer/stores/use-brainstorm-store'
import { useTabStore } from 'renderer/stores/use-tab-store'

interface BrainstormScreenProps {
  projectId: string
  brainstormId: string
}

export function BrainstormScreen({ projectId, brainstormId }: Readonly<BrainstormScreenProps>) {
  const session = useBrainstormStore((s) => s.sessions[brainstormId])
  const setView = useBrainstormStore((s) => s.setView)
  const generateSpec = useBrainstormStore((s) => s.generateSpec)
  const updateTabLabel = useTabStore((s) => s.updateTabLabel)

  const closeTab = useTabStore((s) => s.closeTab)

  useEffect(() => {
    if (!session) {
      closeTab(projectId, `brainstorm-${brainstormId}`)
    }
  }, [session, projectId, brainstormId, closeTab])

  if (!session) {
    return null
  }

  const handleGenerateSpec = () => {
    generateSpec(brainstormId)
    // Update tab label to match spec title
    const updated = useBrainstormStore.getState().sessions[brainstormId]
    if (updated?.spec) {
      updateTabLabel(projectId, `brainstorm-${brainstormId}`, updated.spec.title)
    }
  }

  if (session.view === 'session') {
    return (
      <SessionPanel
        session={session.sessionData}
        config={{
          showHeader: true,
          showInputBar: true,
          onSendMessage: () => {},
          onGenerateSpec: handleGenerateSpec,
        }}
        onBack={session.spec ? () => setView(brainstormId, 'review') : undefined}
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
