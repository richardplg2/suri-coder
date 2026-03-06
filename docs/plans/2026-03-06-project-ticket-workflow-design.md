# Project / Ticket / Workflow Agent System — Design

## Overview

A project management and agent orchestration system for the Workflow Manager app. Manages projects with tickets (Linear/Jira-style), where each ticket has a DAG-based workflow of agent steps. Each step is a Claude Code SDK session executed by a configured agent (designer, coder, tester, reviewer, etc.).

**Target users**: Small team (2-5 developers)

> **Note**: Workflow execution, step lifecycle, brainstorm step, review flow, SDK integration, and related API/data model changes have been moved to [Ticket Workflow Execution — Revised Design](2026-03-07-ticket-workflow-execution-design.md). This file retains the base data models and architecture overview.

## Architecture

```
Desktop App (Electron + React)
    |
    | REST API + WebSocket
    v
FastAPI Backend
    |
    +-- PostgreSQL (data)
    +-- Redis (queue + pubsub)
    +-- ARQ Workers (Claude Code SDK sessions, Cypress runner)
    +-- File Storage (videos, screenshots, Figma assets)
```

### Key decisions

- **App-managed DAG** (Option B): Each workflow step is a separate Claude Code SDK session. The app controls the DAG execution, not the SDK's built-in sub-agent system. This gives per-step visibility, cost tracking, failure recovery, and parallel execution control.
- **Workflow Templates**: Each ticket type has a default DAG template. Steps and dependencies are predefined but customizable per project.
- **Git artifacts**: Agents work on git worktrees. Output is files/commits. Each step gets its own branch.
- **Claude Code SDK Python** (`claude_agent_sdk`): Each agent step uses `ClaudeAgentOptions` + `ClaudeSDKClient` with per-project `AgentConfig`.

## Data Model

### User

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| email | str | unique |
| name | str | |
| avatar_url | str | nullable |
| role | enum | `admin`, `member` |
| created_at | datetime | |

### Project

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| name | str | |
| slug | str | unique, e.g. "PROJ" for ticket prefixes |
| path | str | filesystem path to project |
| repo_url | str | nullable |
| description | text | nullable |
| settings | JSON | project-specific config |
| created_by | UUID | FK -> User |
| created_at | datetime | |

### ProjectMember

| Column | Type | Notes |
|--------|------|-------|
| project_id | UUID | FK -> Project |
| user_id | UUID | FK -> User |
| role | enum | `owner`, `member` |

### AgentConfig

Defines an agent type, customizable per project.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| project_id | UUID | FK -> Project, nullable (null = global/built-in) |
| name | str | e.g. "designer", "coder", "tester", "reviewer" |
| description | text | |
| system_prompt | text | base system prompt for this agent |
| claude_model | str | "opus", "sonnet", "haiku" |
| tools_list | JSON | allowed tools array |
| mcp_servers | JSON | MCP server configs |
| tools_config | JSON | additional tool settings |
| max_turns | int | default 25 |
| created_at | datetime | |

> **Updated**: See [revised design](2026-03-07-ticket-workflow-execution-design.md#data-model-changes) for additional fields: `default_requires_approval`.

### AgentSkill (many-to-many: AgentConfig <-> Skill)

| Column | Type | Notes |
|--------|------|-------|
| agent_config_id | UUID | FK -> AgentConfig |
| skill_id | UUID | FK -> Skill |
| priority | int | injection order |

### Skill

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| name | str | |
| description | str | |
| content | text | markdown skill content |
| category | str | e.g. process, implementation |
| is_template | bool | built-in template skill |

### WorkflowTemplate

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| project_id | UUID | FK -> Project, nullable (null = global) |
| name | str | e.g. "feature-flow", "bugfix-flow" |
| description | text | |
| steps_config | JSON | DAG definition (see below) |
| created_at | datetime | |

**steps_config JSON format** (see [revised design](2026-03-07-ticket-workflow-execution-design.md#data-model-changes) for additional per-step fields: `requires_approval`, `brainstorm_schema`):
```json
{
  "steps": [
    {"id": "design", "agent": "designer", "depends_on": [], "description": "Design UI/UX"},
    {"id": "research", "agent": "researcher", "depends_on": [], "description": "Research approach"},
    {"id": "code", "agent": "coder", "depends_on": ["design", "research"], "description": "Implement"},
    {"id": "test", "agent": "tester", "depends_on": ["code"], "description": "E2E tests"},
    {"id": "review", "agent": "reviewer", "depends_on": ["code"], "description": "Code review"}
  ]
}
```

### Ticket

> **Updated**: See [revised design](2026-03-07-ticket-workflow-execution-design.md#data-model-changes) for additional field: `auto_execute`.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| project_id | UUID | FK -> Project |
| key | str | auto-generated: "{slug}-{seq}", e.g. "PROJ-1" |
| title | str | |
| description | text | |
| type | enum | `feature`, `bug`, `improvement`, `chore`, `spike` |
| status | enum | `backlog`, `todo`, `in_progress`, `in_review`, `done`, `cancelled` |
| priority | enum | `urgent`, `high`, `medium`, `low`, `none` |
| template_id | UUID | FK -> WorkflowTemplate |
| assignee_id | UUID | FK -> User, nullable |
| budget_usd | float | nullable, max budget for all steps |
| created_by | UUID | FK -> User |
| created_at | datetime | |

### WorkflowStep

Instantiated from template when ticket is created.

> **Updated**: See [revised design](2026-03-07-ticket-workflow-execution-design.md#data-model-changes) for additional fields: `requires_approval`, `user_prompt_override`, `brainstorm_output`, `step_breakdown`. StepStatus enum adds: `awaiting_approval`, `review`, `changes_requested`.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| ticket_id | UUID | FK -> Ticket |
| template_step_id | str | reference to step id in template |
| name | str | e.g. "designer", "coder" |
| description | text | |
| agent_config_id | UUID | FK -> AgentConfig |
| status | enum | `pending`, `ready`, `running`, `completed`, `failed`, `skipped` |
| config | JSON | step-specific overrides |
| order | int | display order |
| created_at | datetime | |

### WorkflowStepDependency

| Column | Type | Notes |
|--------|------|-------|
| step_id | UUID | FK -> WorkflowStep |
| depends_on_id | UUID | FK -> WorkflowStep |

### Session

Actual Claude Code CLI execution for a step.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| step_id | UUID | FK -> WorkflowStep |
| status | enum | `running`, `completed`, `failed`, `cancelled` |
| git_branch | str | branch name for this session |
| git_commit_sha | str | final commit SHA, nullable |
| worktree_path | str | git worktree path |
| cli_session_id | str | Claude Code's own session ID |
| cost_usd | float | |
| tokens_used | int | |
| started_at | datetime | |
| finished_at | datetime | nullable |
| exit_code | int | nullable |
| error_message | text | nullable |

### SessionMessage

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| session_id | UUID | FK -> Session |
| role | str | user, assistant, system |
| content | text | |
| tool_use | JSON | tool call details |
| timestamp | datetime | |

### FigmaTask

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| project_id | UUID | FK -> Project |
| session_id | UUID | FK -> Session, nullable |
| status | enum | `draft`, `generating`, `completed`, `failed` |
| figma_file_url | str | |

### FigmaNode

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| task_id | UUID | FK -> FigmaTask |
| node_id | str | Figma node ID |
| description | text | |
| component_name | str | target component name |
| props_spec | JSON | |
| preview_url | str | |

### TestRun

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| session_id | UUID | FK -> Session |
| status | enum | `pending`, `running`, `passed`, `failed` |
| video_path | str | |
| created_at | datetime | |

### TestResult

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| run_id | UUID | FK -> TestRun |
| spec_file | str | Cypress spec file path |
| status | enum | `passed`, `failed` |
| screenshot_path | str | nullable |
| error_message | text | nullable |
| duration_ms | int | |

### ~~ReviewSession / FileReview~~ → StepReview

> **Superseded**: Replaced by `StepReview` in [revised design](2026-03-07-ticket-workflow-execution-design.md#data-model-changes).

## ~~Workflow Engine~~ → Revised

> **Superseded**: Workflow engine, step lifecycle, SDK integration, and context passing have been moved to [Ticket Workflow Execution — Revised Design](2026-03-07-ticket-workflow-execution-design.md). Key changes: `ClaudeSDKClient` replaces ARQ fire-and-forget, added `needs_approval()` check, review flow with changes-requested loop, brainstorm step with structured output.

## API Design

### Auth
```
POST   /auth/login
POST   /auth/register
GET    /auth/me
```

### Projects
```
GET    /projects
POST   /projects
GET    /projects/:id
PATCH  /projects/:id
DELETE /projects/:id
```

### Agent Configs (per project)
```
GET    /projects/:id/agents
POST   /projects/:id/agents
PATCH  /projects/:id/agents/:agent_id
DELETE /projects/:id/agents/:agent_id
```

### Workflow Templates
```
GET    /projects/:id/templates
POST   /projects/:id/templates
PATCH  /templates/:id
DELETE /templates/:id
```

### Tickets
```
GET    /projects/:id/tickets
POST   /projects/:id/tickets           # auto-creates workflow steps from template
GET    /tickets/:id
PATCH  /tickets/:id
DELETE /tickets/:id
```

### Workflow Steps (per ticket)

> **Updated**: See [revised design](2026-03-07-ticket-workflow-execution-design.md#api-changes) for additional endpoints: `approve`, `approve-review`, `request-changes`, `regenerate`, `prompt`.

```
GET    /tickets/:id/steps              # returns DAG with status
POST   /tickets/:id/steps/:step_id/run # manually trigger a step
POST   /tickets/:id/steps/:step_id/retry
POST   /tickets/:id/steps/:step_id/skip
POST   /tickets/:id/run               # start workflow (run all ready steps)
```

### Sessions (per step)
```
GET    /steps/:id/sessions
GET    /sessions/:id
POST   /sessions/:id/cancel
```

### Figma
```
POST   /projects/:id/figma-tasks
GET    /figma-tasks/:id
POST   /figma-tasks/:id/nodes
```

### Test Results
```
GET    /sessions/:id/test-results
GET    /test-runs/:id/results
```

### ~~File Reviews~~ → StepReview API

> **Superseded**: See [revised design](2026-03-07-ticket-workflow-execution-design.md#api-changes).

### WebSocket

Single multiplexed endpoint. See [WebSocket Multiplexed Design](2026-03-07-websocket-multiplexed-design.md).

```
WS     /ws                            # single connection, subscribe/unsubscribe to channels
```

## UI Screens

### Tickets Board

Kanban board view (backlog / in-progress / done) with ticket cards showing:
- Ticket key and type badge
- Title
- Workflow progress indicator (e.g. "3/5 steps done")
- Priority and assignee

Supports Board, List, and Timeline views.

### Ticket Detail + Workflow DAG

Left panel:
- Ticket metadata (title, description, type, priority)
- Workflow DAG visualization — nodes are steps with status icons
- Activity log (step completions, costs, timestamps)

Right inspector:
- Selected step details (agent, status, session info)
- Git branch, cost, duration
- Actions: View Session, Retry, Skip

### Agent Config Screen

Left: List of agent configs for the current project
Right: Edit form — name, model, system prompt, skills, MCP servers, tools, max turns

### Workflow Template Editor

Left: List of templates for the current project
Right: DAG preview + step list editor. Each step has name, agent reference, and dependency selector.

### Existing Screens (retained from original design)

- **Sessions**: Chat interface for viewing/interacting with Claude Code sessions
- **Skills**: Skill management and discovery
- **Figma Pipeline**: Figma design-to-code workflow
- **Worktrees**: Git worktree management
- **File Review**: Code review with inline AI comments

## Build Priority

1. **Data models + migrations** — User, Project, AgentConfig, WorkflowTemplate, Ticket, WorkflowStep, Session
2. **Core API** — CRUD for projects, tickets, agents, templates
3. **Workflow Engine** — DAG execution, step scheduling, ARQ worker integration
4. **Claude Code SDK integration** — Agent session execution with streaming
5. **WebSocket streaming** — Real-time session output + workflow progress
6. **Desktop UI** — Tickets board, ticket detail, agent config, template editor
7. **Figma/Cypress/Review integration** — Attach to workflow steps
8. **Auth** — User registration, login, project membership
