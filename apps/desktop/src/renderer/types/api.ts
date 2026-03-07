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
  | 'awaiting_approval'
  | 'running'
  | 'review'
  | 'changes_requested'
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
  requires_approval: boolean | null
  user_prompt_override: string | null
  brainstorm_output: Record<string, unknown> | null
  step_breakdown: Record<string, unknown> | null
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
  auto_execute: boolean
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
  auto_execute?: boolean
}

export interface TicketUpdate {
  title?: string | null
  description?: string | null
  type?: TicketType | null
  status?: TicketStatus | null
  priority?: TicketPriority | null
  assignee_id?: string | null
  budget_usd?: number | null
  auto_execute?: boolean | null
}

export interface WorkflowTemplate {
  id: string
  project_id: string | null
  name: string
  description: string | null
  steps_config: Record<string, unknown>
  created_at: string
}

export interface User {
  id: string
  email: string
  name: string
  avatar_url: string | null
  role: string
  created_at: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface TokenResponse {
  access_token: string
  token_type: string
  user: User
}

export type ReviewStatus = 'pending' | 'approved' | 'changes_requested'

export interface StepReview {
  id: string
  step_id: string
  revision: number
  diff_content: string | null
  comments: Array<{ file: string; line: number; comment: string }> | null
  status: ReviewStatus
  created_at: string
}

export interface RequestChangesPayload {
  comments: Array<{ file: string; line: number; comment: string }>
}

export interface RegeneratePayload {
  section_comments: Record<string, string>
}

export interface PromptOverridePayload {
  user_prompt_override: string | null
}

export interface GitHubAccount {
  id: string
  github_user_id: number
  username: string
  display_name: string | null
  avatar_url: string | null
  scopes: string
  created_at: string
}

export interface GitHubRepoItem {
  github_repo_id: number
  full_name: string
  clone_url: string
  default_branch: string
  is_private: boolean
  description: string | null
  updated_at: string | null
}

export interface ConnectReposRequest {
  github_account_id: string
  repos: GitHubRepoItem[]
}

export interface ProjectRepository {
  id: string
  project_id: string
  github_account_id: string
  github_repo_id: number
  repo_full_name: string
  repo_url: string
  default_branch: string
  is_private: boolean
  connected_at: string
  connected_by: string
}
