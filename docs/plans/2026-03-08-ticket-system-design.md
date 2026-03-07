# Ticket System — AI-Powered Brainstorming & Spec-Driven Workflow

**Date:** 2026-03-08
**Status:** Approved
**Scope:** Full ticket lifecycle — brainstorming, spec management, workflow execution, review, notifications.

## Overview

Ticket system with AI-powered brainstorming, Figma integration, and spec-driven workflow execution. Users create tickets via AI brainstorming or Figma designs. Tickets contain Feature Specs. Plan Writer Agent decomposes specs into tasks. DAG-based workflow engine orchestrates agents (Designer, Coder, Tester). Each step has a review cycle. All agents run via Claude Agent SDK on backend, each agent is a separate Claude Code session.

## Decisions

- **Agent orchestration:** Backend-orchestrated (Claude Agent SDK), streaming via WebSocket
- **Quiz UI:** Structured JSON message types (`type: "quiz"`, options with description + recommendation reason)
- **Review editor:** Rich Markdown Editor (Tiptap) for brainstorm output review
- **Figma integration:** Embed in Desktop app, refactor figma-viewer into React components
- **Workflow execution:** Event-driven DAG (`tick()` on completion)
- **Auto-approval toggle:** ON = skip review after task completes, OFF = must review output
- **Code review UI:** Unified diff + File tree navigation, inline comments, batch process
- **Code tasks strategy:** Sequential on same feature branch, batch if related
- **Plan Writer output:** Fixed agent types + Workflow templates
- **Ticket content format:** Structured markdown (Problem, Solution, Decisions, Requirements, Design Refs, Acceptance Criteria, Technical Notes)
- **Notifications:** In-app + OS native (Electron Notification API)
- **Tester Agent:** Adaptive (Plan Writer decides test type), test results panel + diff view
- **Test failure handling:** Escalation chain — Tester retry, auto-create fix task for Coder, re-run, max 2 rounds, escalate user
- **Spec-driven development:** Enforce Spec > Plan > Design > Code > Test. Each step outputs spec for next. Agent must read specs before implementing.
- **Spec storage:** DB-stored (table `ticket_specs`), not files in repo. Versioned, linked to ticket, loaded via custom tools.
- **Spec injection:** Custom tools via `create_sdk_mcp_server` (in-process). Scoped per ticket — agent cannot read specs from other tickets.
- **Spec linking:** `ticket_spec_references` table with types: `derives_from`, `implements`, `verifies`, `relates_to`
- **Git strategy:** Bare clone cached at `~/.agent-coding/repos/{owner}/{repo}`. Worktrees per ticket. Coder tasks share worktree (sequential). Designer/Tester get separate worktrees.
- **Multi-repo:** Plan Writer assigns repo(s) per task. Single repo = cwd is that worktree. Multi repo = parent workspace folder.
- **Project seeding:** On project creation, seed default agent configs (5) + workflow templates (3) into DB. User can customize after.

## User Flow

```
CREATE TICKET
  Option A: Start with AI
    Chat + Quiz UI brainstorming with agent
    > Review output (Tiptap editor, inline comments, batch update)
    > Create Ticket (Feature Spec saved)

  Option B: Start from Figma
    Embed Figma Viewer > select nodes > annotate > add description
    > Send to AI Agent (same brainstorm flow with Figma context)
    > Review output > Create Ticket

PLAN & EXECUTE
  User clicks "Start"
  > Step 0: Plan Writer Agent
    - Reads Feature Spec, chooses/customizes template
    - Creates Implementation Plan (spec) + tasks + DAG
    - User review > approve

  > Step 1: Designer Agent (if UI)
    - Reads Feature Spec + Figma refs
    - Creates Design Spec
    - auto_approval? > completed : review > approve

  > Step 2-N: Coder Agents (sequential)
    - Reads all linked specs
    - Implements code
    - auto_approval? > completed : review diff > approve

  > Step N+1: Tester Agents
    - Reads Acceptance Criteria
    - Writes + runs tests
    - Pass > completed
    - Fail > Escalation chain (max 2 retries > escalate user)
```

## Spec-Driven Enforcement

```
Feature Spec (ticket)
  |
  v
Implementation Plan (Plan Writer)
  |
  v
Design Spec (Designer) ----> Coder Agent reads ALL upstream specs
                                |
                                v
                          Tester Agent verifies
                          against Acceptance Criteria
```

- Each agent MUST read upstream specs via `read_spec` tool before work
- If agent discovers spec is incomplete/wrong, flag to user — do not modify spec
- Specs linked via references for traceability

## Data Model

### New Tables

#### `ticket_specs`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID, PK | |
| ticket_id | FK > tickets.id, CASCADE | |
| type | Enum: `feature`, `design`, `plan`, `test` | |
| title | String | |
| content | Text | Markdown |
| revision | Int, default=1 | Increments on update |
| created_by | FK > users.id | User or agent |
| agent_step_id | FK > workflow_steps.id, nullable | Step that created this spec |
| created_at | Timestamp | |
| updated_at | Timestamp | |

#### `ticket_spec_references`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID, PK | |
| source_spec_id | FK > ticket_specs.id, CASCADE | Spec containing reference |
| target_spec_id | FK > ticket_specs.id, CASCADE | Spec being referenced |
| ref_type | Enum: `derives_from`, `implements`, `verifies`, `relates_to` | |
| section | String, nullable | Specific section in target spec |

#### `notifications`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID, PK | |
| user_id | FK > users.id | Recipient |
| type | String | `step_started`, `step_completed`, `step_failed`, etc. Extensible. |
| title | String | |
| body | String, nullable | |
| resource_type | String, nullable | `ticket`, `project`, `step` — polymorphic |
| resource_id | UUID, nullable | ID of related resource |
| read | Boolean, default=False | |
| created_at | Timestamp | |

#### `brainstorm_messages`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID, PK | |
| ticket_id | FK > tickets.id, CASCADE | |
| role | Enum: `user`, `assistant`, `system` | |
| content | Text, nullable | Text message |
| message_type | Enum: `text`, `quiz`, `summary`, `figma_context` | |
| structured_data | JSON, nullable | Quiz options, figma nodes, etc. |
| created_at | Timestamp | |

### Modified Tables

#### `tickets` — new fields

| Column | Type | Notes |
|--------|------|-------|
| auto_approval | Boolean, default=False | Skip review after task completes |
| source | Enum: `ai_brainstorm`, `figma`, `manual` | How ticket was created |
| figma_data | JSON, nullable | Figma nodes + annotations if source=figma |

#### `workflow_steps` — new fields

| Column | Type | Notes |
|--------|------|-------|
| auto_approval | Boolean, nullable | Override ticket-level toggle |
| retry_count | Int, default=0 | Current retry count (escalation chain) |
| max_retries | Int, default=2 | Max retries before escalate |
| parent_step_id | FK > workflow_steps.id, nullable | Parent step if auto-created fix task |
| repo_ids | JSON, nullable | Assigned repo UUIDs. null = all project repos |

### ER Diagram

```
tickets
  +-- 1:N ticket_specs
  |         +-- N:N ticket_spec_references (self-referencing)
  |         +-- N:1 workflow_steps (agent_step_id)
  +-- 1:N brainstorm_messages
  +-- 1:N workflow_steps
  |         +-- 1:N sessions
  |         +-- 1:N step_reviews
  |         +-- N:N workflow_step_dependencies
  +-- 1:N notifications (via resource_type + resource_id)
  +-- N:1 workflow_templates (template_id)
```

## Brainstorming Flow

### Option A: Start with AI

1. User clicks "Create Ticket" > "Start with AI"
2. Opens Chat UI with brainstorm agent
3. Agent asks questions one at a time — structured quiz format:

```typescript
type QuizData = {
  question: string
  context: string                        // why this question matters
  options: {
    id: string
    label: string
    description: string                  // explains this direction
    recommended: boolean                 // AI recommendation
    recommendation_reason: string | null // why recommended
  }[]
  allow_multiple: boolean
  allow_custom: boolean
}
```

4. User selects options or types free-text
5. After 5-8 questions, agent confirms "anything else?" > generates summary
6. Summary displayed in Tiptap Rich Markdown Editor
7. User can: edit directly, select text > add comment, or "Batch Update with AI"
8. When satisfied > "Create Ticket" saves Feature Spec + creates ticket

### Option B: Start from Figma

1. User clicks "Create Ticket" > "Start from Figma"
2. Opens embedded Figma Viewer (refactored from figma-viewer.html):
   - Connect via WebSocket to Figma plugin
   - Node tree (left), design canvas with overlays (center), annotation panel (right)
3. User selects multiple nodes, writes annotations for each
4. User writes overall description
5. Clicks "Send to AI Agent" > Figma context injected into brainstorm session
6. Same Chat UI brainstorming flow with Figma context available
7. Result: Feature Spec with Design References section

## Workflow Execution Engine

### tick() — DAG advancement (event-driven)

```python
async def tick(ticket_id):
    steps = get_all_steps(ticket_id)
    for step in steps:
        if step.status != PENDING:
            continue
        if all dependencies completed/skipped:
            if needs_pre_approval(step, ticket):
                step.status = AWAITING_APPROVAL
            else:
                step.status = READY
                auto_start_step(step, ticket)
    if all steps completed/skipped/failed:
        ticket.status = DONE
        notify(ticket, "workflow_completed")
```

### Step completion — auto_approval toggle

```python
async def complete_step(step, ticket):
    if needs_post_approval(step, ticket):
        step.status = REVIEW        # user must review
    else:
        step.status = COMPLETED     # auto-approve
        tick(ticket.id)

def needs_post_approval(step, ticket) -> bool:
    # Tier 0: ticket-level
    if ticket.auto_approval:
        if step.auto_approval is not None:
            return not step.auto_approval   # step override
        return False
    # Tier 1: step-level
    if step.auto_approval is not None:
        return not step.auto_approval
    return True  # default: needs review
```

### Escalation chain (test failure)

```
Tester run
  +-- All pass > completed
  +-- Some fail
        > Retry 1: Tester fixes test code, re-runs
        +-- Pass > completed
        +-- Still fail
              > Retry 2: Auto-create fix task > Coder Agent
              > Re-run Tester
              +-- Pass > completed
              +-- Still fail > status: failed, notify user
```

### Agent session spawn

- Build scoped custom tools via `create_sdk_mcp_server` (in-process)
- Tools scoped to ticket_id via closure — agent cannot access other tickets
- System prompt: `preset: "claude_code"` + append with instructions (not spec content)
- Agent loads specs on-demand via `read_spec` tool
- Stream execution to WebSocket channel `session:stream`

### Custom tools (scoped per ticket)

| Tool | Purpose |
|------|---------|
| `read_spec(type)` | Load latest spec by type for current ticket |
| `list_specs()` | List available specs for current ticket |
| `save_spec(type, title, content)` | Save spec to current ticket |
| `read_ticket()` | Load ticket content |
| `read_figma_context()` | Load Figma annotations if available |

All tools hardcode `ticket_id` via closure. Agent cannot specify ticket_id.

### Git strategy

```
Project connects repo (GitHub OAuth)

User clicks "Start" ticket
  > Bare clone if not cached: ~/.agent-coding/repos/{owner}/{repo}
  > git fetch (update)
  > git worktree add: ~/.agent-coding/worktrees/{project}/{ticket}/{repo}

Coder tasks: reuse same worktree (sequential)
Designer/Tester: separate worktree per step

Multi-repo:
  - Plan Writer assigns repo_ids per task
  - Single repo: cwd = that worktree
  - Multi repo: cwd = parent folder containing all worktrees

Post-execution (configurable per project):
  - Do nothing (local only)
  - Push branch (default): ticket/{PROJ-42}
  - Push branch + auto create PR

Ticket completed > cleanup worktrees (configurable)
Bare clone kept (cached for future tickets)
```

## Agent Types & Templates

### Fixed Agent Types (seeded per project)

| Type | Model | Tools | Skills |
|------|-------|-------|--------|
| `planner` | sonnet | Read, Glob, Grep, specs | writing-plans |
| `designer` | sonnet | Read, Glob, Grep, specs | ui-ux-pro-max, feature-design |
| `coder` | sonnet | Read, Edit, Write, Bash, Glob, Grep, specs | executing-plans |
| `tester` | sonnet | Read, Edit, Write, Bash, Glob, Grep, specs | test-driven-development |
| `reviewer` | sonnet | Read, Glob, Grep, specs | requesting-code-review |

All seeded on project creation. User can customize: system prompt, model, tools, skills, MCP servers.

### Workflow Templates (seeded per project)

#### Full Feature
```
plan (planner) > design (designer, condition: has_ui) > implement (coder, expandable) > test (tester, expandable)
```

#### Bug Fix
```
plan (planner) > fix (coder) > test (tester)
```

#### Refactor
```
plan (planner) > test_before (tester) > refactor (coder) > test_after (tester)
```

### Template features

- **`expandable`**: Plan Writer can split into multiple sequential tasks
- **`condition`**: Step only created if condition met (`has_ui`, `multi_repo`)
- User can clone global templates, customize, or create from scratch

## Backend API

### Brainstorming

```
POST   /projects/{project_id}/brainstorm/start
       Body: { source: "ai" | "figma", initial_message?, figma_data? }

POST   /projects/{project_id}/brainstorm/{session_id}/message
       Body: { content?, quiz_response?: { option_ids[], custom_text? } }

POST   /projects/{project_id}/brainstorm/{session_id}/complete

POST   /projects/{project_id}/brainstorm/{session_id}/batch-update
       Body: { comments: [{ section_id, text }] }

POST   /projects/{project_id}/brainstorm/{session_id}/create-ticket
       Body: { title, type, priority, template_id? }
```

### Specs

```
GET    /tickets/{ticket_id}/specs
GET    /tickets/{ticket_id}/specs/{spec_id}
GET    /tickets/{ticket_id}/specs/{spec_id}/history
PUT    /tickets/{ticket_id}/specs/{spec_id}
POST   /tickets/{ticket_id}/specs
```

### Workflow Execution

```
POST   /tickets/{ticket_id}/start
POST   /tickets/{ticket_id}/steps/{step_id}/approve-review
POST   /tickets/{ticket_id}/steps/{step_id}/request-changes
       Body: { comments: [{ file, start_line, end_line, text }] }
POST   /tickets/{ticket_id}/steps/{step_id}/skip
POST   /tickets/{ticket_id}/stop
```

### Notifications

```
GET    /notifications?read=false&limit=20&offset=0
PATCH  /notifications/{notification_id}
POST   /notifications/mark-all-read
GET    /notifications/unread-count
```

### Project (extend)

```
POST   /projects
       > Creates project + seeds default agents + templates
```

### WebSocket Events

```
brainstorm:{session_id}
  > message, quiz, summary, error

notifications:{user_id}
  > new_notification, unread_count_changed

ticket:progress (extend)
  > spec_created, spec_updated, escalation_triggered

session:stream (existing)
  > message, tool_use, cost_update, completed, failed
```

## Frontend Screens

### Ticket Detail Page

Tabs: Overview, Specs, Tasks, Activity

- **Overview:** Status, priority, type, source, template, settings (auto-execute toggle, auto-approval toggle, budget)
- **Specs:** List all specs with revision, references, referenced_by. Edit inline (Tiptap). View history.
- **Tasks:** DAG visualization + task list. Edit task (name, agent, repo, dependencies, auto-approval override). Start/Stop workflow.
- **Activity:** Timeline of all events (ticket created, step started/completed/failed, spec saved, comments, approvals).

### Task Execution View

- DAG with live status indicators (completed, running, pending, failed)
- Active task shows live output (agent messages, tool calls)
- Cost tracking per session

### Review UI

- File tree (left) + Unified diff (right)
- Inline comments: select line range > add comment
- Batch "Request Changes" sends all comments to agent
- Tester review: test results panel above diff (pass/fail counts, error logs, screenshots)

### Notification UI

- Bell icon in toolbar with unread badge
- Dropdown list: notification title, time, link to resource
- OS native notifications (Electron Notification API) for: step_awaiting_review, step_failed, workflow_completed, agent_needs_input

### Agent Config Management

- Project Settings > Agents tab
- List all agents (seeded defaults)
- Edit: name, description, model, max_turns, approval, system prompt, tools, skills, MCP servers
- Duplicate agent for variants
- Reset to default

### Template Management

- Project Settings > Templates tab
- List templates (seeded defaults)
- Clone, edit, create from scratch
- DAG editor for step configuration

## Notification Events

| Event | When | OS Notification |
|-------|------|-----------------|
| `step_started` | Agent starts executing | No |
| `step_awaiting_review` | Step done, needs review | Yes |
| `step_completed` | Step approved/auto-approved | No |
| `step_failed` | Max retries, escalate user | Yes |
| `workflow_completed` | All steps done | Yes |
| `agent_needs_input` | Agent asks user via AskUserQuestion | Yes |

## Non-Goals (v1)

- Collaborative brainstorming (multi-user)
- External notifications (Slack, email, webhook)
- Custom agent type creation from UI (only customize seeded agents)
- Real-time collaborative spec editing
- Cost analytics dashboard
- Scheduled/cron ticket execution
