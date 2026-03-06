export interface Project {
  id: string
  name: string
  slug: string
  path: string
  repo_url: string | null
  description: string | null
  settings: Record<string, unknown> | null
  created_by: string
  created_at: string
  member_count: number
}

export interface ProjectCreate {
  name: string
  slug: string
  path: string
  repo_url?: string | null
  description?: string | null
  settings?: Record<string, unknown> | null
}

export interface ProjectUpdate {
  name?: string | null
  description?: string | null
  path?: string | null
  repo_url?: string | null
  settings?: Record<string, unknown> | null
}

export type TicketType = 'feature' | 'bug' | 'improvement' | 'chore' | 'spike'
export type TicketStatus =
  | 'backlog'
  | 'todo'
  | 'in_progress'
  | 'in_review'
  | 'done'
  | 'cancelled'
export type TicketPriority = 'none' | 'low' | 'medium' | 'high' | 'urgent'
export type StepStatus =
  | 'pending'
  | 'ready'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped'

export interface WorkflowStep {
  id: string
  template_step_id: string
  name: string
  description: string | null
  agent_config_id: string | null
  status: StepStatus
  order: number
}

export interface Ticket {
  id: string
  project_id: string
  key: string
  title: string
  description: string | null
  type: TicketType
  status: TicketStatus
  priority: TicketPriority
  template_id: string | null
  assignee_id: string | null
  budget_usd: number | null
  created_by: string
  created_at: string
  steps: WorkflowStep[]
}

export interface TicketListItem {
  id: string
  project_id: string
  key: string
  title: string
  type: TicketType
  status: TicketStatus
  priority: TicketPriority
  assignee_id: string | null
  created_at: string
}

export interface TicketCreate {
  title: string
  description?: string | null
  type?: TicketType
  priority?: TicketPriority
  template_id?: string | null
  assignee_id?: string | null
  budget_usd?: number | null
}

export interface TicketUpdate {
  title?: string | null
  description?: string | null
  type?: TicketType | null
  status?: TicketStatus | null
  priority?: TicketPriority | null
  assignee_id?: string | null
  budget_usd?: number | null
}

export interface WorkflowTemplate {
  id: string
  project_id: string | null
  name: string
  description: string | null
  steps_config: Record<string, unknown>
  created_at: string
}
