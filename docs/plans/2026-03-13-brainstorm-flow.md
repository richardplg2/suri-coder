# Brainstorm Flow Enhancement Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the Brainstorm button create a new session each time (opens fresh tab in session view), and add a "Generate Spec" button in the input bar to transition from session → review.

**Architecture:** Three changes: (1) TicketsBoard creates a new brainstorm session on click instead of using a hardcoded mock ID, (2) SessionInputBar gets an optional `onGenerateSpec` callback that renders a secondary action button, (3) BrainstormScreen wires up `onGenerateSpec` to populate the store's spec with mock data and switch to review view. Tab label updates after spec generation.

**Tech Stack:** React, TypeScript, Zustand, Lucide React icons, existing `@agent-coding/ui` components

---

### Task 1: Add `generateSpec` and `updateTitle` Actions to Brainstorm Store

**Files:**
- Modify: `apps/desktop/src/renderer/stores/use-brainstorm-store.ts`

**Step 1: Add actions to the store interface**

In the `BrainstormStore` interface, after `updateTicketDraft`, add:

```typescript
generateSpec: (sessionId: string) => void
updateTitle: (sessionId: string, title: string) => void
```

**Step 2: Implement `generateSpec`**

Add the implementation after `updateTicketDraft`. This populates the session with the existing `MOCK_SPEC` and `MOCK_COMMENTS`, and switches view to `'review'`:

```typescript
generateSpec: (sessionId) => {
  const sessions = get().sessions
  const session = sessions[sessionId]
  if (!session) return
  set({
    sessions: {
      ...sessions,
      [sessionId]: {
        ...session,
        view: 'review',
        spec: MOCK_SPEC,
        comments: MOCK_COMMENTS,
        ticketDraft: { title: MOCK_SPEC.title, type: 'feature', priority: 'medium' },
      },
    },
  })
},
```

**Step 3: Implement `updateTitle`**

```typescript
updateTitle: (sessionId, title) => {
  const sessions = get().sessions
  const session = sessions[sessionId]
  if (!session) return
  set({
    sessions: {
      ...sessions,
      [sessionId]: { ...session, title },
    },
  })
},
```

**Step 4: Verify typecheck**

Run: `cd /home/richard/work/AgentCoding/agent-coding && pnpm --filter my-electron-app exec tsc --noEmit --pretty 2>&1 | grep "error TS"`

**Step 5: Commit**

```bash
git add apps/desktop/src/renderer/stores/use-brainstorm-store.ts
git commit -m "feat(brainstorm): add generateSpec and updateTitle store actions"
```

---

### Task 2: Add `onGenerateSpec` to SessionInputBar

**Files:**
- Modify: `apps/desktop/src/renderer/components/session/session-input-bar.tsx`

**Step 1: Add optional prop**

Add `onGenerateSpec` to `SessionInputBarProps`:

```typescript
interface SessionInputBarProps {
  onSend: (message: string) => void
  isRunning?: boolean
  statusText?: string
  onGenerateSpec?: () => void
}
```

And destructure it:

```typescript
export function SessionInputBar({
  onSend,
  isRunning,
  statusText,
  onGenerateSpec,
}: Readonly<SessionInputBarProps>) {
```

**Step 2: Add the Generate Spec button**

Add the `Sparkles` import at the top:

```typescript
import { ArrowUp, Shield, Sparkles } from 'lucide-react'
```

In the JSX, between the input `<div className="relative flex-1">` block and the Shield/Auto `<div>`, add:

```tsx
{onGenerateSpec && (
  <button
    type="button"
    onClick={onGenerateSpec}
    className="flex shrink-0 items-center gap-1.5 rounded-lg border border-accent/30 bg-accent/10 px-3 py-1.5 text-[11px] font-bold text-accent cursor-pointer hover:bg-accent/20 transition-colors duration-150"
  >
    <Sparkles className="size-3.5" />
    Generate Spec
  </button>
)}
```

**Step 3: Verify typecheck**

Run: `cd /home/richard/work/AgentCoding/agent-coding && pnpm --filter my-electron-app exec tsc --noEmit --pretty 2>&1 | grep "error TS"`

**Step 4: Commit**

```bash
git add apps/desktop/src/renderer/components/session/session-input-bar.tsx
git commit -m "feat(brainstorm): add optional onGenerateSpec button to SessionInputBar"
```

---

### Task 3: Thread `onGenerateSpec` Through SessionPanel

**Files:**
- Modify: `apps/desktop/src/renderer/components/session/types.ts`
- Modify: `apps/desktop/src/renderer/components/session/session-view.tsx`

**Step 1: Add to SessionPanelConfig**

In `types.ts`, add `onGenerateSpec` to `SessionPanelConfig`:

```typescript
export interface SessionPanelConfig {
  showHeader?: boolean
  showInputBar?: boolean
  onSendMessage?: (message: string) => void
  onQuizAnswer?: (itemId: string, selectedIds: string[]) => void
  onStop?: () => void
  onPause?: () => void
  onGenerateSpec?: () => void
}
```

**Step 2: Pass through in SessionPanel**

In `session-view.tsx`, pass `onGenerateSpec` to `SessionInputBar`. Change the existing `SessionInputBar` usage from:

```tsx
<SessionInputBar
  onSend={config?.onSendMessage ?? (() => {})}
  isRunning={session.status === 'running'}
  statusText={session.status === 'running' ? 'Agent is working...' : undefined}
/>
```

To:

```tsx
<SessionInputBar
  onSend={config?.onSendMessage ?? (() => {})}
  isRunning={session.status === 'running'}
  statusText={session.status === 'running' ? 'Agent is working...' : undefined}
  onGenerateSpec={config?.onGenerateSpec}
/>
```

**Step 3: Verify typecheck**

Run: `cd /home/richard/work/AgentCoding/agent-coding && pnpm --filter my-electron-app exec tsc --noEmit --pretty 2>&1 | grep "error TS"`

**Step 4: Commit**

```bash
git add apps/desktop/src/renderer/components/session/types.ts apps/desktop/src/renderer/components/session/session-view.tsx
git commit -m "feat(brainstorm): thread onGenerateSpec through SessionPanel config"
```

---

### Task 4: Wire Up BrainstormScreen to Generate Spec and Update Tab Label

**Files:**
- Modify: `apps/desktop/src/renderer/screens/brainstorm.tsx`

**Step 1: Update BrainstormScreen**

Replace the entire file content with:

```typescript
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

  if (!session) {
    return <div className="flex h-full items-center justify-center text-muted-foreground">Brainstorm session not found</div>
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
```

Key changes:
- `handleGenerateSpec` calls the store action and updates the tab label
- `onBack` only shows when a spec already exists (so user can navigate back to review)
- `onGenerateSpec` passed through config

**Step 2: Verify typecheck**

Run: `cd /home/richard/work/AgentCoding/agent-coding && pnpm --filter my-electron-app exec tsc --noEmit --pretty 2>&1 | grep "error TS"`

**Step 3: Commit**

```bash
git add apps/desktop/src/renderer/screens/brainstorm.tsx
git commit -m "feat(brainstorm): wire up generate spec and tab label update"
```

---

### Task 5: Update `updateTabLabel` to Support Brainstorm Tabs

**Files:**
- Modify: `apps/desktop/src/renderer/stores/use-tab-store.ts`

**Step 1: Update `updateTabLabel` to handle brainstorm tabs**

The current `updateTabLabel` only updates tabs where `t.type === 'ticket'`. Change it to also support brainstorm tabs. Replace:

```typescript
updateTabLabel: (projectId, tabId, label) => {
  const { tabsByProject } = get()
  const tabs = tabsByProject[projectId] ?? []
  set({
    tabsByProject: {
      ...tabsByProject,
      [projectId]: tabs.map((t) =>
        t.id === tabId && t.type === 'ticket' ? { ...t, label } : t,
      ),
    },
  })
},
```

With:

```typescript
updateTabLabel: (projectId, tabId, label) => {
  const { tabsByProject } = get()
  const tabs = tabsByProject[projectId] ?? []
  set({
    tabsByProject: {
      ...tabsByProject,
      [projectId]: tabs.map((t) =>
        t.id === tabId && (t.type === 'ticket' || t.type === 'brainstorm') ? { ...t, label } : t,
      ),
    },
  })
},
```

**Step 2: Verify typecheck**

Run: `cd /home/richard/work/AgentCoding/agent-coding && pnpm --filter my-electron-app exec tsc --noEmit --pretty 2>&1 | grep "error TS"`

**Step 3: Commit**

```bash
git add apps/desktop/src/renderer/stores/use-tab-store.ts
git commit -m "feat(brainstorm): support brainstorm tabs in updateTabLabel"
```

---

### Task 6: Update TicketsBoard to Create New Sessions

**Files:**
- Modify: `apps/desktop/src/renderer/screens/project/tickets-board.tsx`

**Step 1: Import brainstorm store**

Add import at the top:

```typescript
import { useBrainstormStore } from 'renderer/stores/use-brainstorm-store'
```

**Step 2: Get createSession from store**

Inside the `TicketsBoard` component, add:

```typescript
const createSession = useBrainstormStore((s) => s.createSession)
```

**Step 3: Update the Brainstorm button onClick**

Replace the existing brainstorm button:

```tsx
<Button size="sm" variant="outline" onClick={() => openBrainstormTab(project.id, 'mock-brainstorm-1', 'Brainstorm')} className="cursor-pointer">
```

With:

```tsx
<Button size="sm" variant="outline" onClick={() => {
  const id = createSession(project.id)
  openBrainstormTab(project.id, id, 'New Brainstorm')
}} className="cursor-pointer">
```

**Step 4: Verify typecheck**

Run: `cd /home/richard/work/AgentCoding/agent-coding && pnpm --filter my-electron-app exec tsc --noEmit --pretty 2>&1 | grep "error TS"`

**Step 5: Commit**

```bash
git add apps/desktop/src/renderer/screens/project/tickets-board.tsx
git commit -m "feat(brainstorm): create new session on each Brainstorm button click"
```

---

### Task 7: Remove Pre-seeded Mock Session and Final Verification

**Files:**
- Modify: `apps/desktop/src/renderer/stores/use-brainstorm-store.ts`

**Step 1: Clear the default sessions object**

In the store's `create` block, change the initial `sessions` from the pre-seeded mock to an empty object:

```typescript
sessions: {},
```

Remove the entire `'mock-brainstorm-1': { ... }` block. Keep the `MOCK_SPEC`, `MOCK_COMMENTS`, and `MOCK_SESSION_DATA` constants — they are still used by `generateSpec`.

**Step 2: Verify typecheck**

Run: `cd /home/richard/work/AgentCoding/agent-coding && pnpm --filter my-electron-app exec tsc --noEmit --pretty 2>&1 | grep "error TS"`

**Step 3: Commit**

```bash
git add apps/desktop/src/renderer/stores/use-brainstorm-store.ts
git commit -m "feat(brainstorm): remove pre-seeded mock session, start with empty state"
```
