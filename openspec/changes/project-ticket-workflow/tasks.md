## 1. Dependencies & Configuration

- [x] 1.1 Add Python dependencies: `pyjwt`, `passlib[bcrypt]`, `arq`, `redis[hiredis]` to `apps/backend/pyproject.toml`
- [x] 1.2 Add `REDIS_URL`, `JWT_SECRET`, `JWT_EXPIRE_MINUTES` to `apps/backend/app/config.py` Settings class and `.env.example`

## 2. Enums & Base Models

- [x] 2.1 Create `apps/backend/app/models/enums.py` with all enums: UserRole, TicketType, TicketStatus, TicketPriority, StepStatus, SessionStatus
- [x] 2.2 Create `apps/backend/app/models/base.py` with a `TimestampMixin` (created_at, updated_at) and UUID primary key mixin

## 3. User Model & Auth

- [x] 3.1 Create `apps/backend/app/models/user.py` — User model (id, email, name, avatar_url, role, hashed_password, created_at)
- [x] 3.2 Create `apps/backend/app/schemas/user.py` — UserCreate, UserLogin, UserResponse, TokenResponse Pydantic schemas
- [x] 3.3 Create `apps/backend/app/services/auth.py` — password hashing (bcrypt), JWT encode/decode, `get_current_user` dependency
- [x] 3.4 Create `apps/backend/app/routers/auth.py` — POST /auth/register, POST /auth/login, GET /auth/me
- [x] 3.5 Create `apps/backend/tests/test_auth.py` — test registration, login, duplicate email, invalid credentials, get current user

## 4. Project & Membership Models

- [x] 4.1 Create `apps/backend/app/models/project.py` — Project model (id, name, slug, path, repo_url, description, settings, created_by, created_at) and ProjectMember model (project_id, user_id, role)
- [x] 4.2 Create `apps/backend/app/schemas/project.py` — ProjectCreate, ProjectUpdate, ProjectResponse, ProjectMemberCreate Pydantic schemas
- [x] 4.3 Create `apps/backend/app/services/project.py` — project CRUD, membership management, `require_project_member` and `require_project_owner` dependencies
- [x] 4.4 Create `apps/backend/app/routers/projects.py` — CRUD endpoints: GET/POST /projects, GET/PATCH/DELETE /projects/:id, POST/DELETE /projects/:id/members
- [x] 4.5 Create `apps/backend/tests/test_projects.py` — test project CRUD, membership, slug uniqueness, owner-only operations, non-member access

## 5. Skill Model

- [x] 5.1 Create `apps/backend/app/models/skill.py` — Skill model (id, name, description, content, category, is_template)
- [x] 5.2 Create `apps/backend/app/schemas/skill.py` — SkillCreate, SkillUpdate, SkillResponse

## 6. Agent Config Model

- [x] 6.1 Create `apps/backend/app/models/agent_config.py` — AgentConfig model (id, project_id, name, description, system_prompt, claude_model, tools_list, mcp_servers, tools_config, max_turns) and AgentSkill association table
- [x] 6.2 Create `apps/backend/app/schemas/agent_config.py` — AgentConfigCreate, AgentConfigUpdate, AgentConfigResponse
- [x] 6.3 Create `apps/backend/app/routers/agents.py` — GET/POST /projects/:id/agents, PATCH/DELETE /projects/:id/agents/:agent_id
- [x] 6.4 Create `apps/backend/tests/test_agents.py` — test agent CRUD, duplicate name, global agent protection, agent-in-use deletion

## 7. Workflow Template Model

- [x] 7.1 Create `apps/backend/app/models/workflow_template.py` — WorkflowTemplate model (id, project_id, name, description, steps_config, created_at)
- [x] 7.2 Create `apps/backend/app/services/dag_validator.py` — validate DAG (no cycles via topological sort, valid agent references, valid step dependency references)
- [x] 7.3 Create `apps/backend/app/schemas/workflow_template.py` — WorkflowTemplateCreate, WorkflowTemplateUpdate, WorkflowTemplateResponse, StepConfig Pydantic model
- [x] 7.4 Create `apps/backend/app/routers/templates.py` — GET/POST /projects/:id/templates, PATCH/DELETE /templates/:id
- [x] 7.5 Create `apps/backend/tests/test_templates.py` — test template CRUD, DAG validation (valid DAG, cycle detection, invalid agent, invalid dependency)

## 8. Ticket Model & Step Instantiation

- [x] 8.1 Create `apps/backend/app/models/ticket.py` — Ticket model (id, project_id, key, title, description, type, status, priority, template_id, assignee_id, budget_usd, created_by)
- [x] 8.2 Create `apps/backend/app/models/workflow_step.py` — WorkflowStep model (id, ticket_id, template_step_id, name, description, agent_config_id, status, config, order) and WorkflowStepDependency model (step_id, depends_on_id)
- [x] 8.3 Create `apps/backend/app/services/ticket.py` — ticket CRUD with auto-key generation (slug + sequence), workflow step instantiation from template
- [x] 8.4 Create `apps/backend/app/schemas/ticket.py` — TicketCreate, TicketUpdate, TicketResponse, TicketListResponse, WorkflowStepResponse
- [x] 8.5 Create `apps/backend/app/routers/tickets.py` — GET/POST /projects/:id/tickets, GET/PATCH/DELETE /tickets/:id
- [x] 8.6 Create `apps/backend/tests/test_tickets.py` — test ticket CRUD, auto-key generation, step instantiation, initial step statuses, filtering

## 9. Session Model

- [x] 9.1 Create `apps/backend/app/models/session.py` — Session model (id, step_id, status, git_branch, git_commit_sha, worktree_path, cli_session_id, cost_usd, tokens_used, started_at, finished_at, exit_code, error_message) and SessionMessage model (id, session_id, role, content, tool_use, timestamp)
- [x] 9.2 Create `apps/backend/app/schemas/session.py` — SessionResponse, SessionDetailResponse, SessionMessageResponse
- [x] 9.3 Create `apps/backend/app/routers/sessions.py` — GET /steps/:id/sessions, GET /sessions/:id, POST /sessions/:id/cancel

## 10. Workflow Engine

- [x] 10.1 Create `apps/backend/app/services/workflow_engine.py` — WorkflowEngine class with `tick()` method: advance pending steps to ready, schedule ready steps, handle failures, auto-complete tickets
- [x] 10.2 Create `apps/backend/app/routers/workflow.py` — POST /tickets/:id/run, POST /tickets/:id/steps/:step_id/run, POST /tickets/:id/steps/:step_id/retry, POST /tickets/:id/steps/:step_id/skip
- [x] 10.3 Create `apps/backend/tests/test_workflow_engine.py` — test DAG tick (completion triggers downstream, parallel scheduling, failure blocks downstream, skip unblocks, ticket auto-completion, ticket auto-progress)

## 11. Session Execution (Claude Code SDK + ARQ)

- [x] 11.1 Create `apps/backend/app/services/agent_runner.py` — build `ClaudeAgentOptions` from AgentConfig, gather dependency context, execute via `ClaudeSDKClient`, capture cost/tokens from ResultMessage
- [x] 11.2 Create `apps/backend/app/services/git_worktree.py` — create/cleanup git worktrees, merge dependency branches
- [x] 11.3 Create `apps/backend/app/worker.py` — ARQ worker with `run_claude_agent` task function, Redis PubSub publishing for streaming messages
- [x] 11.4 Update `apps/backend/app/main.py` — register all routers, add Redis connection to lifespan

## 12. WebSocket Streaming

- [x] 12.1 Create `apps/backend/app/routers/websocket.py` — WS /ws/sessions/:id (per-session streaming via Redis PubSub subscription), WS /ws/tickets/:id (workflow progress events)
- [x] 12.2 Create `apps/backend/tests/test_websocket.py` — test WebSocket connection, message relay

## 13. Domain Extensions (Figma, Testing, Review)

- [x] 13.1 Create `apps/backend/app/models/figma.py` — FigmaTask and FigmaNode models (retained from original design)
- [x] 13.2 Create `apps/backend/app/models/testing.py` — TestRun and TestResult models
- [x] 13.3 Create `apps/backend/app/models/review.py` — ReviewSession and FileReview models

## 14. Database Migration

- [x] 14.1 Update `apps/backend/app/models/__init__.py` — import all models so Alembic discovers them
- [ ] 14.2 Run `uv run alembic revision --autogenerate -m "add all initial models"` to create the migration
- [ ] 14.3 Run `uv run alembic upgrade head` to apply the migration and verify

## 15. Seed Data

- [x] 15.1 Create `apps/backend/app/seed.py` — seed script that creates default global agent configs (designer, coder, tester, reviewer, researcher) and default workflow templates (feature-flow, bugfix-flow, spike-flow)
