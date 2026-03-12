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
  duration: '8m 34s',
  tokenCount: 42600,
  cost: '$1.87',
  items: [
    // 1. User message
    {
      id: 'b1',
      entry: { kind: 'user', content: 'I need a way to track API costs across our AI models. We use GPT-4, Claude 3, and Gemini. Can you explore the codebase and figure out the best approach?' },
      timestamp: '0:00',
    },
    // 2. Thinking
    {
      id: 'b2',
      entry: { kind: 'thinking', summary: 'Analyzing the cost tracking requirements across multiple AI providers. Need to explore the existing codebase structure, check for existing billing/usage modules, and understand the data flow...' },
      timestamp: '0:03',
    },
    // 3. Skill activation
    {
      id: 'b3',
      entry: { kind: 'skill', name: 'brainstorming', content: 'Exploring user intent, requirements and design before implementation.' },
      timestamp: '0:05',
    },
    // 4. Plan
    {
      id: 'b4',
      entry: { kind: 'plan', summary: 'Explore codebase → Identify integration points → Design data schema → Propose architecture → Gather feedback', stepCount: 5 },
      timestamp: '0:08',
    },
    // 5. Tasks
    {
      id: 'b5',
      entry: {
        kind: 'tasks',
        items: [
          { label: 'Explore existing billing modules', done: true },
          { label: 'Check API proxy configuration', done: true },
          { label: 'Review database schema for usage tables', done: true },
          { label: 'Design cost tracking data model', done: false },
          { label: 'Propose dashboard architecture', done: false },
        ],
      },
      timestamp: '0:10',
    },
    // 6. Glob — find relevant files
    {
      id: 'b6',
      entry: {
        kind: 'tool_call',
        tool: 'Glob',
        input: 'pattern: "src/**/*billing*", "src/**/*usage*", "src/**/*cost*"',
        output: 'src/services/billing/billing-service.ts\nsrc/services/billing/usage-stream.ts\nsrc/models/api-usage-log.ts\nsrc/config/pricing-tiers.json',
        status: 'success',
        label: 'Found 4 billing-related files',
      },
      timestamp: '0:12',
    },
    // 7. Read file — examine billing service
    {
      id: 'b7',
      entry: {
        kind: 'tool_call',
        tool: 'Read',
        input: 'file_path: "src/services/billing/billing-service.ts"',
        output: 'export class BillingService {\n  private usageStream: UsageStream\n  private pricingCalculator: PricingCalculator\n\n  async getUsageMetrics(dateRange: DateRange): Promise<UsageMetrics[]> {\n    const raw = await this.usageStream.fetch(dateRange)\n    return raw.map(r => ({\n      model: r.model,\n      tokens: r.tokenCount,\n      cost: this.pricingCalculator.compute(r.model, r.tokenCount),\n    }))\n  }\n\n  async getDailyAggregates(days: number): Promise<DailyAggregate[]> {\n    // TODO: implement daily rollups\n    throw new Error("Not implemented")\n  }\n}',
        status: 'success',
        label: 'Read billing-service.ts (42 lines)',
        detail: 'BillingService has getUsageMetrics() but getDailyAggregates() is not yet implemented. Uses UsageStream for raw data and PricingCalculator for cost computation.',
      },
      timestamp: '0:15',
    },
    // 8. Grep — search for pricing configuration
    {
      id: 'b8',
      entry: {
        kind: 'tool_call',
        tool: 'Grep',
        input: 'pattern: "PricingCalculator", type: "ts"',
        output: 'src/services/billing/pricing-calculator.ts:3:export class PricingCalculator {\nsrc/services/billing/pricing-calculator.ts:12:  compute(model: string, tokens: number): number {\nsrc/services/billing/billing-service.ts:8:  private pricingCalculator: PricingCalculator\nsrc/tests/billing.test.ts:15:  const calc = new PricingCalculator(tiers)',
        status: 'success',
        label: 'Found 4 matches in 3 files',
      },
      timestamp: '0:18',
    },
    // 9. Read file — check pricing calculator
    {
      id: 'b9',
      entry: {
        kind: 'tool_call',
        tool: 'Read',
        input: 'file_path: "src/services/billing/pricing-calculator.ts"',
        output: 'import tiers from "../../config/pricing-tiers.json"\n\nexport class PricingCalculator {\n  private tiers: PricingTier[]\n\n  constructor(customTiers?: PricingTier[]) {\n    this.tiers = customTiers ?? tiers\n  }\n\n  compute(model: string, tokens: number): number {\n    const tier = this.tiers.find(t => t.model === model)\n    if (!tier) throw new Error(`Unknown model: ${model}`)\n    return (tokens / 1000) * tier.pricePerKToken\n  }\n}',
        status: 'success',
        label: 'Read pricing-calculator.ts (14 lines)',
        detail: 'Simple per-1K-token pricing. Does not handle input vs output token pricing separately — will need updating for accurate cost tracking.',
      },
      timestamp: '0:20',
    },
    // 10. Thinking — analysis
    {
      id: 'b10',
      entry: { kind: 'thinking', summary: 'The existing PricingCalculator uses a flat per-1K-token rate but modern APIs charge differently for input vs output tokens. The BillingService has the structure but needs daily aggregation. Let me check the database schema and then explore parallel options...' },
      timestamp: '0:25',
    },
    // 11. Subagent — parallel exploration (2 agents running concurrently)
    {
      id: 'b11',
      entry: {
        kind: 'subagent',
        description: 'Explore database schema and API proxy config',
        status: 'done',
        children: [
          {
            id: 'b11-a',
            entry: {
              kind: 'tool_call',
              tool: 'Read',
              input: 'file_path: "src/models/api-usage-log.ts"',
              output: 'export interface ApiUsageLog {\n  id: string\n  timestamp: Date\n  model: string\n  inputTokens: number\n  outputTokens: number\n  userId: string\n  teamId: string\n  featureTag?: string\n  latencyMs: number\n}',
              status: 'success',
              label: 'Read api-usage-log.ts (11 lines)',
            },
            timestamp: '0:27',
          },
          {
            id: 'b11-b',
            entry: {
              kind: 'tool_call',
              tool: 'Glob',
              input: 'pattern: "src/config/api-proxy*"',
              output: 'src/config/api-proxy.config.ts\nsrc/config/api-proxy.routes.json',
              status: 'success',
              label: 'Found 2 proxy config files',
            },
            timestamp: '0:27',
          },
          {
            id: 'b11-c',
            entry: {
              kind: 'tool_call',
              tool: 'Read',
              input: 'file_path: "src/config/api-proxy.config.ts"',
              output: 'export const proxyConfig = {\n  providers: [\n    { name: "openai", baseUrl: "https://api.openai.com/v1", models: ["gpt-4", "gpt-4-turbo"] },\n    { name: "anthropic", baseUrl: "https://api.anthropic.com/v1", models: ["claude-3-opus", "claude-3-sonnet"] },\n    { name: "google", baseUrl: "https://generativelanguage.googleapis.com/v1", models: ["gemini-pro", "gemini-ultra"] },\n  ],\n  logging: { enabled: true, table: "api_consumption_logs" },\n}',
              status: 'success',
              label: 'Read api-proxy.config.ts (8 lines)',
            },
            timestamp: '0:29',
          },
        ],
      },
      timestamp: '0:26',
    },
    // 12. Another subagent — parallel research tasks
    {
      id: 'b12',
      entry: {
        kind: 'subagent',
        description: 'Research pricing models for each provider',
        status: 'done',
        children: [
          {
            id: 'b12-a',
            entry: {
              kind: 'tool_call',
              tool: 'Bash',
              input: 'cat src/config/pricing-tiers.json',
              output: '[\n  { "model": "gpt-4", "pricePerKToken": 0.03 },\n  { "model": "gpt-4-turbo", "pricePerKToken": 0.01 },\n  { "model": "claude-3-opus", "pricePerKToken": 0.015 },\n  { "model": "claude-3-sonnet", "pricePerKToken": 0.003 },\n  { "model": "gemini-pro", "pricePerKToken": 0.00025 },\n  { "model": "gemini-ultra", "pricePerKToken": 0.005 }\n]',
              status: 'success',
              label: 'Read pricing tiers config',
            },
            timestamp: '0:28',
          },
          {
            id: 'b12-b',
            entry: {
              kind: 'tool_call',
              tool: 'Grep',
              input: 'pattern: "inputTokens|outputTokens", path: "src/services/"',
              output: 'src/services/billing/usage-stream.ts:18:    inputTokens: raw.prompt_tokens,\nsrc/services/billing/usage-stream.ts:19:    outputTokens: raw.completion_tokens,\nsrc/services/billing/usage-stream.ts:34:    totalTokens: log.inputTokens + log.outputTokens,',
              status: 'success',
              label: 'Found 3 matches in usage-stream.ts',
            },
            timestamp: '0:30',
          },
        ],
      },
      timestamp: '0:27',
    },
    // 13. Edit — fix pricing calculator to handle input/output tokens
    {
      id: 'b13',
      entry: {
        kind: 'tool_call',
        tool: 'Edit',
        input: 'file_path: "src/services/billing/pricing-calculator.ts"\nold_string: "compute(model: string, tokens: number)"\nnew_string: "compute(model: string, inputTokens: number, outputTokens: number)"',
        output: 'File updated successfully.',
        status: 'success',
        label: 'Updated PricingCalculator.compute() signature',
        detail: 'Split single token param into inputTokens + outputTokens for accurate per-direction pricing.',
      },
      timestamp: '0:35',
    },
    // 14. Bash — run tests to verify
    {
      id: 'b14',
      entry: {
        kind: 'tool_call',
        tool: 'Bash',
        input: 'cd /workspace && npm test -- --grep "billing" 2>&1 | tail -8',
        output: '  BillingService\n    ✓ calculates cost for GPT-4 (12ms)\n    ✓ calculates cost for Claude 3 (8ms)\n    ✓ handles unknown model gracefully (3ms)\n    ✗ daily aggregates returns correct rollup\n      Error: Not implemented\n\n  3 passing, 1 failing',
        status: 'error',
        label: 'Tests: 3 passing, 1 failing',
        detail: 'getDailyAggregates() is still unimplemented — expected failure. The pricing changes pass correctly.',
      },
      timestamp: '0:42',
    },
    // 15. Error entry
    {
      id: 'b15',
      entry: {
        kind: 'error',
        message: 'Test suite "daily aggregates" failed: getDailyAggregates() throws "Not implemented"',
        stack: 'at BillingService.getDailyAggregates (src/services/billing/billing-service.ts:18:11)\nat Context.<anonymous> (src/tests/billing.test.ts:42:30)',
      },
      timestamp: '0:43',
    },
    // 16. Thinking — process results
    {
      id: 'b16',
      entry: { kind: 'thinking', summary: 'The failing test is expected — getDailyAggregates needs implementation as part of the cost tracking feature. I have enough context now to ask clarifying questions and generate the spec.' },
      timestamp: '0:48',
    },
    // 17. Quiz — single select
    {
      id: 'b17',
      entry: {
        kind: 'quiz',
        question: 'What level of cost granularity do you need?',
        mode: 'single',
        options: [
          { id: 'q1', label: 'Per-request tracking', description: 'Track every API call individually with full metadata' },
          { id: 'q2', label: 'Daily aggregates', description: 'Roll up to daily summaries per model/team', recommended: true },
          { id: 'q3', label: 'Both', description: 'Detailed logs + daily dashboards for different audiences' },
        ],
        selectedIds: ['q3'],
      },
      timestamp: '1:00',
    },
    // 18. Quiz — multi select
    {
      id: 'b18',
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
      timestamp: '1:15',
    },
    // 19. Response — summary
    {
      id: 'b19',
      entry: {
        kind: 'response',
        content: "Great choices. Here's what I found:\n\n**Existing infrastructure:**\n- `BillingService` with `UsageStream` and `PricingCalculator` already in place\n- API proxy logs all requests to `api_consumption_logs` table with input/output token counts\n- Pricing tiers configured for all 6 models across 3 providers\n\n**Gaps to fill:**\n- `getDailyAggregates()` is unimplemented\n- `PricingCalculator` needs input/output token split pricing (I've already updated the signature)\n- No dashboard UI exists yet\n- No alerting system for budget thresholds\n\nI'll generate the full spec for your review now.",
      },
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
  generateSpec: (sessionId: string) => void
  updateTitle: (sessionId: string, title: string) => void
}

export const useBrainstormStore = create<BrainstormStore>()((set, get) => ({
  sessions: {},

  createSession: (projectId) => {
    const id = `brainstorm-${Date.now()}`
    const session: BrainstormSession = {
      id,
      projectId,
      title: 'New Brainstorm',
      view: 'session',
      sessionData: { ...MOCK_SESSION_DATA, id },
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
