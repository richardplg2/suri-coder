## Context

The Workflow Manager is an Electron + FastAPI monorepo. The backend (`apps/backend/`) has async SQLAlchemy + PostgreSQL configured with Alembic migrations, but all models/routers/schemas/services directories are empty. Only a `/health` endpoint exists. The frontend (`apps/desktop/`) has a single placeholder screen.

We need to build the entire backend data layer, API, and workflow orchestration engine from scratch. The system serves a small team (2-5 developers) managing AI-assisted development workflows.

The existing design doc at `docs/plans/2026-03-06-workflow-manager-design.md` established the ARQ + Redis PubSub architecture and original data model. This change evolves that into a project/ticket/workflow system with DAG-based agent orchestration.

## Goals / Non-Goals

**Goals:**

- Establish the complete backend data model with all entities (User through Session)
- Provide CRUD APIs for projects, tickets, agents, templates
- Implement DAG-based workflow execution engine with auto-advance, retry, and skip
- Integrate Claude Code SDK Python (`claude_agent_sdk`) for agent session execution
- Stream session output and workflow progress via WebSocket
- Support per-project agent customization (system prompts, tools, MCP servers, skills)
- Git worktree isolation per workflow step

**Non-Goals:**

- Frontend/desktop UI implementation (separate change)
- OAuth / SSO integration (simple JWT auth for now)
- Multi-organization / tenant isolation
- Billing or usage quotas
- CI/CD pipeline integration
- Agent performance analytics or optimization

## Decisions

### 1. App-managed DAG over SDK sub-agents

**Decision**: Each workflow step is a separate Claude Code SDK session managed by the app. The app controls DAG execution, not the SDK's built-in sub-agent system.

**Alternatives considered**:
- SDK native sub-agents (`ClaudeAgentOptions.agents`): Simpler but single session — no per-step cost tracking, failure recovery limited to restarting entire session, less visibility
- Hybrid (SDK + hooks): Track sub-agent delegation via hooks — complex hook management, SDK may change delegation behavior

**Rationale**: Per-step sessions give clear cost tracking, individual retry/skip, parallel execution control, and visible progress per step. Worth the extra orchestration code.

### 2. Workflow Templates over free-form steps

**Decision**: Predefined DAG templates per ticket type. Steps and dependencies are defined in `WorkflowTemplate.steps_config` as JSON.

**Alternatives considered**:
- Free-form: User defines steps per ticket — flexible but repetitive and error-prone
- Hybrid: Templates with per-ticket override — added complexity for v1

**Rationale**: Templates enforce consistency for a team. Start simple; can add per-ticket overrides later.

### 3. ARQ + Redis for task queue

**Decision**: Use ARQ (async Redis queue) for background Claude Code SDK session execution, Redis PubSub for streaming events.

**Alternatives considered**:
- Celery: More mature but synchronous by default, doesn't fit async Claude SDK
- In-process asyncio tasks: Simple but no persistence, no worker scaling, no retry

**Rationale**: ARQ is native asyncio, fits Claude SDK's async nature, and Redis PubSub bridges workers to WebSocket cleanly.

### 4. Git worktree per step

**Decision**: Each workflow step gets its own git worktree and branch (`{ticket-key}/{step-name}`).

**Rationale**: Isolation prevents agents from conflicting. Each step can commit independently. Merging happens explicitly when downstream steps start (they merge upstream branches).

### 5. JWT auth with simple User model

**Decision**: Stateless JWT tokens, bcrypt password hashing, no refresh tokens in v1.

**Rationale**: Simplest auth that works for a small team. Can add OAuth/SSO later.

### 6. Session data model

**Decision**: `Session` belongs to `WorkflowStep`, not directly to `Ticket`. A step can have multiple sessions (retries). `SessionMessage` stores the conversation history.

**Rationale**: Ties sessions to the step lifecycle. Retry creates a new session on the same step. Historical sessions are preserved.

## Risks / Trade-offs

- **[DAG complexity]** → Keep the engine simple: only `pending/ready/running/completed/failed/skipped` states. No conditional branching or loops in v1.
- **[Git worktree cleanup]** → Worktrees accumulate. Add a cleanup mechanism when tickets are completed or archived.
- **[Claude SDK API changes]** → Pin SDK version. The `ClaudeAgentOptions`/`ClaudeSDKClient` API is new and may change.
- **[Redis dependency]** → Required even for single-user dev. Consider making ARQ optional with an in-process fallback later.
- **[Large migration]** → Single Alembic migration with many tables. If any table needs changes early on, migration history stays clean since this is the first migration.
- **[Cost overruns]** → Budget tracking per step and per ticket, but no hard enforcement in v1 (only tracking). Add budget limits later.
