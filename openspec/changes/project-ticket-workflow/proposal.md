## Why

The Workflow Manager currently has no project management or agent orchestration layer. Developers need a way to organize work into projects with tickets (Linear/Jira-style), where each ticket automatically executes a DAG-based workflow of Claude Code agents (designer, coder, tester, reviewer). Without this, there is no structured way to manage multi-step AI-assisted development workflows for a small team.

## What Changes

- Add User model with authentication (register/login) and project membership
- Add Project entity with slug-based ticket prefixes and team member management
- Add AgentConfig system — define reusable agent types per project (designer, coder, tester, etc.) with custom system prompts, tools, MCP servers, and skills
- Add WorkflowTemplate system — define DAG-based workflow templates (e.g. feature-flow: designer → coder → tester) with parallel step support
- Add Ticket entity (Linear-style: types, priorities, statuses) that instantiates workflow steps from templates
- Add WorkflowStep + DAG execution engine — auto-advances steps when dependencies complete, supports retry/skip on failure
- Add Session entity — each workflow step executes as a separate Claude Code SDK session with git worktree isolation
- Retain existing Figma, TestRun/TestResult, and ReviewSession/FileReview tables as domain-specific extensions attached to sessions
- Add REST API endpoints for all CRUD operations plus workflow control (run/retry/skip)
- Add WebSocket channels for real-time session streaming and workflow progress

## Capabilities

### New Capabilities

- `user-auth`: User registration, login, JWT authentication, and role-based access (admin/member)
- `project-management`: Project CRUD with slug-based prefixes, settings, team membership (owner/member roles)
- `agent-config`: Define and customize agent types per project — system prompts, Claude model, tools, MCP servers, skills, max turns
- `workflow-templates`: DAG-based workflow template definitions with steps and dependency edges, reusable across tickets
- `ticket-management`: Linear-style tickets (feature/bug/improvement/chore/spike) with priorities, statuses, assignees, and auto-instantiation of workflow steps from templates
- `workflow-engine`: DAG execution engine — step lifecycle (pending/ready/running/completed/failed/skipped), auto-advance on completion, parallel execution, retry/skip controls
- `session-execution`: Claude Code SDK session management per workflow step — git worktree isolation, cost/token tracking, streaming output, context passing between steps

### Modified Capabilities

(none — no existing specs)

## Impact

- **Backend**: All new — models, migrations, routers, schemas, services in `apps/backend/app/`
- **Dependencies**: Add `pyjwt`, `passlib[bcrypt]`, `arq`, `redis` to `pyproject.toml`
- **Database**: New PostgreSQL tables via Alembic migration (User, Project, ProjectMember, Skill, AgentConfig, AgentSkill, WorkflowTemplate, Ticket, WorkflowStep, WorkflowStepDependency, Session, SessionMessage, plus existing Figma/Test/Review tables)
- **Infrastructure**: Requires Redis for ARQ task queue and PubSub
- **Frontend**: New screens needed (Tickets Board, Ticket Detail + DAG, Agent Config, Template Editor) — covered in separate frontend change
- **Config**: Add `REDIS_URL`, `JWT_SECRET` to `.env`
