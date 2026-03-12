# Brainstorm Tab Design

## Goal

Add a "Brainstorm" tab type that lets users brainstorm feature ideas with a Claude Code agent, review AI-generated specs, comment/annotate, revise, and create tickets — all within a reusable SessionPanel UI.

## Flow

1. User clicks "Brainstorm" on project view → opens new brainstorm tab
2. **Session view**: User chats with AI agent via SessionPanel (shared UI with agent/workflow sessions)
3. Session completes → transitions to **Review view** (Stitch design `60fb2a5d631a4221b3231e7df49ae582`)
4. Review view: 2-panel layout — left: feature spec (Problem, Solution, Requirements, Acceptance Criteria, Technical Notes), right: comments panel
5. User selects text → adds comments tagged by section
6. "Revise with AI" → returns to session view, agent revises based on comments
7. Satisfied → fill ticket title/type/priority → "Create Ticket"

## Architecture

### New Tab Type

- Add `'brainstorm'` to `TabType` union in `types/tabs.ts`
- Add `BrainstormTab` interface: `{ type: 'brainstorm'; projectId: string; brainstormId?: string }`
- Add `openBrainstormTab(projectId)` to `use-tab-store.ts`
- Route in `tab-content.tsx` → `BrainstormScreen`

### Brainstorm Store (`stores/use-brainstorm-store.ts`)

Zustand store managing brainstorm state per project:

```ts
interface BrainstormSession {
  id: string
  projectId: string
  title: string
  status: 'active' | 'reviewing' | 'completed'
  sessionData: SessionData        // reuses session/types.ts
  spec: BrainstormSpec | null     // generated after session
  comments: SpecComment[]
  ticketDraft: TicketDraft | null
  createdAt: string
}

interface BrainstormSpec {
  title: string
  project: string
  sections: SpecSection[]
}

interface SpecSection {
  id: string
  kind: 'problem' | 'solution' | 'requirements' | 'acceptance_criteria' | 'technical_notes'
  title: string
  content: string                 // markdown
  items?: string[]                // for list sections
}

interface SpecComment {
  id: string
  sectionId: string
  selectedText?: string
  content: string
  author: string
  timestamp: string
}

interface TicketDraft {
  title: string
  type: 'feature' | 'bug' | 'improvement' | 'chore' | 'spike'
  priority: 'low' | 'medium' | 'high' | 'critical'
}
```

Store actions:
- `createSession(projectId)` → new brainstorm session
- `setView(sessionId, 'session' | 'review')`
- `addComment(sessionId, comment)`
- `removeComment(sessionId, commentId)`
- `updateTicketDraft(sessionId, draft)`
- `setSpec(sessionId, spec)`

### Screen Components

**`screens/brainstorm.tsx`** — orchestrator
- Reads brainstorm store
- Toggles between SessionPanel (session view) and BrainstormReview (review view)

**`components/brainstorm-review/review-layout.tsx`** — 2-panel container
- Left 60%: spec viewer
- Right 40%: comments panel

**`components/brainstorm-review/spec-viewer.tsx`** — left panel
- Renders spec sections with icons per kind
- Text selection support for commenting

**`components/brainstorm-review/comment-panel.tsx`** — right panel
- Comment list with author avatars, section tags, timestamps
- Section filter pills (All, Problem, Solution, etc.)
- Add comment textarea

**`components/brainstorm-review/ticket-action-bar.tsx`** — bottom bar
- Ticket title input, type dropdown, priority selector
- Discard + "Create Ticket" buttons

**`components/brainstorm-review/review-header.tsx`** — top bar
- Back button, title, "Revise with AI" button, "Create Ticket" button

### Stitch Design Mapping

| Stitch (HTML) | React Component |
|---------------|-----------------|
| `<header>` with back + actions | `review-header.tsx` |
| Left column spec card | `spec-viewer.tsx` |
| Right column comments | `comment-panel.tsx` |
| `<footer>` action bar | `ticket-action-bar.tsx` |
| Material Symbols icons | Lucide React |
| Hardcoded hex colors | CSS variables from design system |

### Icon Mapping (Material Symbols → Lucide)

| Material Symbol | Lucide Icon |
|----------------|-------------|
| `arrow_back` | `ArrowLeft` |
| `psychology` | `Brain` |
| `auto_awesome` | `Sparkles` |
| `add_task` | `SquarePlus` |
| `error_outline` | `AlertCircle` |
| `check_circle` | `CheckCircle` |
| `list` | `List` |
| `fact_check` | `ClipboardCheck` |
| `code` | `Code` |
| `forum` | `MessageSquare` |
| `send` | `Send` |
| `expand_more` | `ChevronDown` |
| `arrow_forward` | `ArrowRight` |

## Phase 1 Scope (Mock Data)

- All data is mock/hardcoded — no backend integration
- SessionPanel uses existing MOCK_SESSION pattern
- Spec is hardcoded mock matching Stitch design content
- Comments are local state only
- "Create Ticket" and "Revise with AI" are UI-only (no actual action)
- Brainstorm store with full structure but mock initial data

## Out of Scope

- Backend brainstorm session API
- Actual Claude Code agent integration
- Real ticket creation
- Text selection → comment popover (phase 2)
- Persistence across app restarts
