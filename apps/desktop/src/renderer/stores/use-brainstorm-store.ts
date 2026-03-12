import { create } from 'zustand'
import type { SessionData } from 'renderer/components/session/types'

// --- Types ---

export interface SpecSection {
  id: string
  kind: 'problem' | 'solution' | 'requirements' | 'acceptance_criteria' | 'technical_notes'
  title: string
  content: string
  items?: string[]
}

export interface BrainstormSpec {
  title: string
  project: string
  sections: SpecSection[]
}

export interface SpecComment {
  id: string
  sectionId: string
  selectedText?: string
  content: string
  author: string
  authorInitials: string
  authorColor: string
  timestamp: string
}

export interface TicketDraft {
  title: string
  type: 'feature' | 'bug' | 'improvement' | 'chore' | 'spike'
  priority: 'low' | 'medium' | 'high' | 'critical'
}

export interface BrainstormSession {
  id: string
  projectId: string
  title: string
  view: 'session' | 'review'
  sessionData: SessionData
  spec: BrainstormSpec | null
  comments: SpecComment[]
  ticketDraft: TicketDraft
  createdAt: string
}

// --- Mock Data ---

const MOCK_SPEC: BrainstormSpec = {
  title: 'Cost Tracking Features',
  project: 'Suri Coder AI Dashboard',
  sections: [
    {
      id: 'problem',
      kind: 'problem',
      title: 'Problem',
      content:
        'Users currently lack a centralized way to monitor real-time API costs and token usage across different models (GPT-4, Claude 3, Gemini). Without visibility, developer teams risk exceeding monthly budgets and have no insight into which projects are consuming the most resources.',
    },
    {
      id: 'solution',
      kind: 'solution',
      title: 'Solution',
      content:
        'Implement a real-time analytics dashboard that hooks into the internal API proxy. This system will calculate costs based on model-specific pricing tiers and provide visual breakdowns by user, team, and feature tag.',
    },
    {
      id: 'requirements',
      kind: 'requirements',
      title: 'Requirements',
      content: '',
      items: [
        'Fetch daily usage metrics from the `UsageStream` service.',
        'Calculate USD cost using dynamic pricing lookup table.',
        'Support filtering by date range (Today, 7D, 30D, Custom).',
        'Export capability to CSV and PDF for billing departments.',
      ],
    },
    {
      id: 'acceptance',
      kind: 'acceptance_criteria',
      title: 'Acceptance Criteria',
      content: '',
      items: [
        'The dashboard must load data in under 200ms for default time ranges.',
        'Accuracy of cost calculations must be within 0.01% of provider invoices.',
        "Mobile view must include the primary 'Total Spend' card.",
      ],
    },
    {
      id: 'technical',
      kind: 'technical_notes',
      title: 'Technical Notes',
      content:
        'Data Schema & Database References:\n\nSchema: `Billing_Analytics_V2`\nMain Table: `api_consumption_logs`\nService: `PricingCalculator.compute()`',
    },
  ],
}

const MOCK_COMMENTS: SpecComment[] = [
  {
    id: 'c1',
    sectionId: 'requirements',
    content:
      "We should also consider adding alerts when spending hits 80% of the daily quota. It's better to be proactive than reactive.",
    author: 'James Dalton',
    authorInitials: 'JD',
    authorColor: 'blue',
    timestamp: '2h ago',
  },
  {
    id: 'c2',
    sectionId: 'technical',
    selectedText: 'PricingCalculator',
    content:
      "PricingCalculator needs to handle currency conversion if we're dealing with international provider accounts.",
    author: 'Sarah Chen',
    authorInitials: 'SC',
    authorColor: 'purple',
    timestamp: '45m ago',
  },
]

const MOCK_SESSION_DATA: SessionData = {
  id: 'bs-session-1',
  title: 'Brainstorm: Cost Tracking Features',
  status: 'completed',
  duration: '5m 12s',
  tokenCount: 18200,
  cost: '$0.72',
  items: [
    {
      id: 'b1',
      entry: { kind: 'user', content: 'I need a way to track API costs across our AI models. We use GPT-4, Claude 3, and Gemini.' },
      timestamp: '0:00',
    },
    {
      id: 'b2',
      entry: { kind: 'thinking', summary: 'Analyzing the cost tracking requirements across multiple AI providers...' },
      timestamp: '0:03',
    },
    {
      id: 'b3',
      entry: {
        kind: 'quiz',
        question: 'What level of cost granularity do you need?',
        mode: 'single',
        options: [
          { id: 'q1', label: 'Per-request tracking', description: 'Track every API call individually' },
          { id: 'q2', label: 'Daily aggregates', description: 'Roll up to daily summaries', recommended: true },
          { id: 'q3', label: 'Both', description: 'Detailed logs + daily dashboards' },
        ],
        selectedIds: ['q3'],
      },
      timestamp: '0:15',
    },
    {
      id: 'b4',
      entry: {
        kind: 'quiz',
        question: 'Who needs access to cost data?',
        mode: 'multi',
        options: [
          { id: 'a1', label: 'Individual developers' },
          { id: 'a2', label: 'Team leads' },
          { id: 'a3', label: 'Finance/billing team' },
          { id: 'a4', label: 'Executive dashboard' },
        ],
        selectedIds: ['a1', 'a2', 'a3'],
      },
      timestamp: '0:45',
    },
    {
      id: 'b5',
      entry: { kind: 'response', content: "Based on your requirements, I've drafted a feature specification for Cost Tracking Features. Let me generate the full spec for your review." },
      timestamp: '1:30',
    },
  ],
}

// --- Store ---

interface BrainstormStore {
  sessions: Record<string, BrainstormSession>

  createSession: (projectId: string) => string
  getSession: (sessionId: string) => BrainstormSession | undefined
  getProjectSessions: (projectId: string) => BrainstormSession[]
  setView: (sessionId: string, view: 'session' | 'review') => void
  addComment: (sessionId: string, comment: Omit<SpecComment, 'id'>) => void
  removeComment: (sessionId: string, commentId: string) => void
  updateTicketDraft: (sessionId: string, draft: Partial<TicketDraft>) => void
}

export const useBrainstormStore = create<BrainstormStore>()((set, get) => ({
  sessions: {
    'mock-brainstorm-1': {
      id: 'mock-brainstorm-1',
      projectId: 'mock-project',
      title: 'Cost Tracking Features',
      view: 'review',
      sessionData: MOCK_SESSION_DATA,
      spec: MOCK_SPEC,
      comments: MOCK_COMMENTS,
      ticketDraft: { title: 'Cost tracking dashboard', type: 'feature', priority: 'medium' },
      createdAt: '2026-03-13T10:00:00Z',
    },
  },

  createSession: (projectId) => {
    const id = `brainstorm-${Date.now()}`
    const session: BrainstormSession = {
      id,
      projectId,
      title: 'New Brainstorm',
      view: 'session',
      sessionData: {
        id,
        title: 'New Brainstorm Session',
        status: 'running',
        items: [],
      },
      spec: null,
      comments: [],
      ticketDraft: { title: '', type: 'feature', priority: 'medium' },
      createdAt: new Date().toISOString(),
    }
    set({ sessions: { ...get().sessions, [id]: session } })
    return id
  },

  getSession: (sessionId) => get().sessions[sessionId],

  getProjectSessions: (projectId) =>
    Object.values(get().sessions).filter((s) => s.projectId === projectId),

  setView: (sessionId, view) => {
    const sessions = get().sessions
    const session = sessions[sessionId]
    if (!session) return
    set({ sessions: { ...sessions, [sessionId]: { ...session, view } } })
  },

  addComment: (sessionId, comment) => {
    const sessions = get().sessions
    const session = sessions[sessionId]
    if (!session) return
    const newComment: SpecComment = { ...comment, id: `comment-${Date.now()}` }
    set({
      sessions: {
        ...sessions,
        [sessionId]: { ...session, comments: [...session.comments, newComment] },
      },
    })
  },

  removeComment: (sessionId, commentId) => {
    const sessions = get().sessions
    const session = sessions[sessionId]
    if (!session) return
    set({
      sessions: {
        ...sessions,
        [sessionId]: {
          ...session,
          comments: session.comments.filter((c) => c.id !== commentId),
        },
      },
    })
  },

  updateTicketDraft: (sessionId, draft) => {
    const sessions = get().sessions
    const session = sessions[sessionId]
    if (!session) return
    set({
      sessions: {
        ...sessions,
        [sessionId]: {
          ...session,
          ticketDraft: { ...session.ticketDraft, ...draft },
        },
      },
    })
  },
}))
