export const WsAction = {
  Subscribe: 'subscribe',
  Unsubscribe: 'unsubscribe',
  Ping: 'ping',
} as const
export type WsAction = (typeof WsAction)[keyof typeof WsAction]

export const WsChannel = {
  ProjectTickets: 'project:tickets',
  TicketProgress: 'ticket:progress',
  SessionStream: 'session:stream',
  BrainstormSession: 'brainstorm:session',
  Notifications: 'notifications',
} as const
export type WsChannel = (typeof WsChannel)[keyof typeof WsChannel]

export const WsEvent = {
  // System
  Subscribed: 'subscribed',
  Unsubscribed: 'unsubscribed',
  Error: 'error',
  Pong: 'pong',

  // project:tickets
  TicketCreated: 'ticket_created',
  TicketUpdated: 'ticket_updated',
  StepStatusChanged: 'step_status_changed',

  // ticket:progress
  StepStarted: 'step_started',
  StepCompleted: 'step_completed',
  StepFailed: 'step_failed',
  WorkflowCompleted: 'workflow_completed',

  // session:stream
  Message: 'message',
  ToolUse: 'tool_use',
  CostUpdate: 'cost_update',
  Completed: 'completed',
  Failed: 'failed',

  // Brainstorm
  BrainstormMessage: 'brainstorm_message',
  BrainstormQuiz: 'brainstorm_quiz',
  BrainstormSummary: 'brainstorm_summary',

  // Notifications
  NewNotification: 'new_notification',
  UnreadCountChanged: 'unread_count_changed',

  // Specs
  SpecCreated: 'spec_created',
  SpecUpdated: 'spec_updated',

  // Escalation
  EscalationTriggered: 'escalation_triggered',
} as const
export type WsEvent = (typeof WsEvent)[keyof typeof WsEvent]

export const SYSTEM_CHANNEL = '_system' as const

export interface WsClientMessage {
  action: WsAction
  channel?: WsChannel
  params?: Record<string, string>
}

export interface WsServerMessage {
  channel: WsChannel | typeof SYSTEM_CHANNEL
  ref?: string
  event: WsEvent
  data?: unknown
}
