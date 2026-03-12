export type TranscriptEntry =
  | { kind: 'user'; content: string }
  | { kind: 'thinking'; summary: string }
  | {
      kind: 'tool_call'
      tool: string
      input: string
      output: string
      status: 'success' | 'error'
      label?: string
      detail?: string
    }
  | {
      kind: 'subagent'
      description: string
      status: 'running' | 'done' | 'error'
      children: TranscriptItem[]
    }
  | { kind: 'plan'; summary: string; stepCount?: number }
  | { kind: 'tasks'; items: { label: string; done: boolean }[] }
  | { kind: 'response'; content: string }
  | {
      kind: 'quiz'
      question: string
      mode: 'single' | 'multi'
      options: QuizOption[]
      selectedIds?: string[]
    }
  | { kind: 'skill'; name: string; content: string }
  | { kind: 'error'; message: string; stack?: string }

export interface TranscriptItem {
  id: string
  entry: TranscriptEntry
  timestamp: string
}

export interface QuizOption {
  id: string
  label: string
  description?: string
  recommended?: boolean
}

export interface SessionData {
  id: string
  title: string
  status: 'running' | 'completed' | 'failed' | 'paused'
  duration?: string
  tokenCount?: number
  cost?: string
  items: TranscriptItem[]
}

export interface SessionPanelConfig {
  showHeader?: boolean
  showInputBar?: boolean
  onSendMessage?: (message: string) => void
  onQuizAnswer?: (itemId: string, selectedIds: string[]) => void
  onStop?: () => void
  onPause?: () => void
  onGenerateSpec?: () => void
}
