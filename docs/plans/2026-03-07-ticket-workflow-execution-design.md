# Ticket Workflow Execution — Revised Design

Replaces the workflow execution section of [2026-03-06-project-ticket-workflow-design.md](2026-03-06-project-ticket-workflow-design.md). Keeps all data models from the original; this doc covers execution behavior, brainstorm step, review flow, and SDK integration.

## Core Concept

Each ticket picks a workflow template. A ticket-level `auto_execute` toggle controls default behavior. Each step resolves `requires_approval` from a three-tier hierarchy. All steps use `ClaudeSDKClient`.

## Execution Mode Resolution

Priority (high → low):

1. `WorkflowStep.requires_approval` (per-ticket instance override)
2. Template step config `requires_approval`
3. `AgentConfig.default_requires_approval`

When `ticket.auto_execute = false`, all steps require approval regardless of step-level config.

Mid-flight toggle: switching auto → manual takes effect immediately. Running steps continue; the next step to become ready will require approval.

## Step Lifecycle

```
pending → ready → [awaiting_approval] → running → review → completed
                                                  ↘ changes_requested → running → review
                                                  ↘ failed → retry (ready) / skip (skipped)
```

| Mode | Flow |
|------|------|
| Auto | pending → ready → running → review → completed |
| Manual | pending → ready → awaiting_approval → running → review → completed |
| Review loop | review → changes_requested → running → review (repeat) |

### Auto step

Dependencies complete → step becomes `ready` → auto-starts → `running` → agent runs with auto-generated prompt + dependency context → `review` → user reviews files → approve or request changes.

### Manual step

Dependencies complete → `ready` → immediately `awaiting_approval`. User sees dependency outputs, can edit prompt/context. User clicks "Approve & Run" → `running`. Same flow from here.

### Review (every step with file changes)

Step completes → auto-generate git diff → `review` status. User reviews changed files, adds comments. "Approve" → step `completed` → `tick()` advances DAG. "Request Changes" → all comments collected into one follow-up prompt → same `ClaudeSDKClient` session → agent fixes → new diff → back to `review`. Loop until approved.

## Brainstorm Step

### Output format

Structured data driven by a template-defined schema. Each workflow template defines its own brainstorm schema (feature-flow differs from bugfix-flow). Agent uses SDK `output_format` (JSON schema) to produce structured JSON matching the schema.

### Schema example (feature-flow)

```json
{
  "sections": [
    {"key": "summary", "label": "Summary", "type": "text"},
    {"key": "approach", "label": "Proposed Approach", "type": "markdown"},
    {"key": "components", "label": "Components", "type": "list", "item_type": "object",
     "item_schema": {"name": "str", "file_path": "str", "description": "str"}},
    {"key": "files_to_modify", "label": "Files to Modify", "type": "list", "item_type": "string"},
    {"key": "acceptance_criteria", "label": "Acceptance Criteria", "type": "checklist"},
    {"key": "risks", "label": "Risks & Concerns", "type": "list", "item_type": "string"}
  ]
}
```

### Schema example (bugfix-flow)

```json
{
  "sections": [
    {"key": "root_cause", "label": "Root Cause Analysis", "type": "markdown"},
    {"key": "reproduction", "label": "Reproduction Steps", "type": "checklist"},
    {"key": "fix_approach", "label": "Fix Approach", "type": "markdown"},
    {"key": "files_to_modify", "label": "Files to Modify", "type": "list", "item_type": "string"},
    {"key": "regression_risks", "label": "Regression Risks", "type": "list", "item_type": "string"}
  ]
}
```

### UI interaction flow

1. Agent generates structured output → UI renders read-only sections.
2. User reviews, comments on individual sections (e.g. "approach is too complex, simplify").
3. User clicks "Regenerate All" → all comments collected into a follow-up prompt → agent regenerates entire output (sections are interdependent).
4. Repeat until satisfied.
5. User clicks "Approve" → system auto-generates:
   - **Spec document**: markdown committed to `docs/specs/{ticket-key}-spec.md`
   - **Per-step breakdown**: specific instructions for each downstream step in the workflow

### Per-step breakdown

After brainstorm approval, a Haiku call generates concrete instructions per step:

```
Step: coder
Instructions:
- Create LoginForm component at src/components/auth/LoginForm.tsx
- Use react-hook-form + Zod schema (see spec for field definitions)
- Files to create: LoginForm.tsx, login-schema.ts, OAuthButtons.tsx
- Files to modify: src/app/login/page.tsx

Step: tester
Instructions:
- Write Cypress E2E tests for login flow
- Test cases: valid login, invalid password, OAuth redirect, empty fields
- Test file: cypress/e2e/auth/login.cy.ts

Step: reviewer
Instructions:
- Focus on: auth security, XSS prevention, password handling
- Check: Zod validation covers all edge cases
```

## Context Passing (Git + Summary)

Each step receives:

- **Git worktree** with dependency branches merged
- **Structured summary** auto-generated (Haiku) from dependency steps
- **Per-step breakdown** from brainstorm step (specific instructions)

### Prompt assembly

```python
async def build_step_prompt(step):
    dep_summaries = await get_dependency_summaries(step)
    breakdown = await get_step_breakdown(step)
    user_additions = step.user_prompt_override

    return f"""## Your task
{step.description}

## Specific instructions (from brainstorm)
{breakdown}

## Context from completed steps
{format_summaries(dep_summaries)}

## Working directory
Git worktree with all dependency changes merged.

{f"## Additional instructions\\n{user_additions}" if user_additions else ""}
"""
```

### Summary generation

When a step is approved, auto-generate summary using Haiku:

```python
async def generate_step_summary(step):
    diff = await get_git_diff(step.worktree_path)
    messages = await get_session_messages(step)

    async for msg in query(
        prompt=f"Summarize: {step.description}\nDiff: {diff}\nKey messages: {messages}",
        options=ClaudeAgentOptions(model="haiku", max_turns=1),
    ):
        if isinstance(msg, ResultMessage):
            step.summary = msg.result
```

## SDK Integration

All steps use `ClaudeSDKClient` for interrupt support, follow-up capability, and session resume.

### Standard step execution

```python
async def run_step(step):
    options = ClaudeAgentOptions(
        system_prompt=step.agent_config.system_prompt,
        cwd=step.worktree_path,
        model=step.agent_config.claude_model,
        allowed_tools=step.agent_config.tools_list,
        mcp_servers=step.agent_config.mcp_servers,
        permission_mode="acceptEdits",
        max_turns=step.agent_config.max_turns,
        max_budget_usd=step.ticket.budget_usd,
        setting_sources=["project"],
        include_partial_messages=True,
    )

    async with ClaudeSDKClient(options=options) as client:
        prompt = await build_step_prompt(step)
        await client.query(prompt)

        async for msg in client.receive_response():
            await save_message(step, msg)
            await stream_to_websocket(step, msg)

        register_active_session(step.id, client)
```

### Brainstorm step execution

```python
async def run_brainstorm_step(step):
    schema = get_brainstorm_schema(step.ticket.template)
    options = ClaudeAgentOptions(
        system_prompt=step.agent_config.system_prompt,
        cwd=step.worktree_path,
        model=step.agent_config.claude_model,
        allowed_tools=step.agent_config.tools_list,
        permission_mode="acceptEdits",
        setting_sources=["project"],
        include_partial_messages=True,
        output_format={"type": "json_schema", "schema": schema},
    )

    async with ClaudeSDKClient(options=options) as client:
        prompt = await build_step_prompt(step)
        await client.query(prompt)

        async for msg in client.receive_response():
            await save_message(step, msg)
            await stream_to_websocket(step, msg)
            if isinstance(msg, ResultMessage):
                step.brainstorm_output = msg.structured_output

        register_active_session(step.id, client)
```

### Follow-up (review changes requested)

```python
async def handle_changes_requested(step, comments):
    client = get_active_session(step.id)
    feedback = format_comments_as_prompt(comments)

    await client.query(feedback)
    async for msg in client.receive_response():
        await save_message(step, msg)
        await stream_to_websocket(step, msg)
```

### Brainstorm regenerate

```python
async def handle_brainstorm_regenerate(step, section_comments):
    client = get_active_session(step.id)
    feedback = format_section_comments(section_comments)

    await client.query(feedback)
    async for msg in client.receive_response():
        await save_message(step, msg)
        await stream_to_websocket(step, msg)
        if isinstance(msg, ResultMessage):
            step.brainstorm_output = msg.structured_output
```

### Step breakdown generation

```python
async def generate_step_breakdowns(brainstorm_step):
    output = brainstorm_step.brainstorm_output
    workflow_steps = await get_downstream_steps(brainstorm_step)

    async for msg in query(
        prompt=f"""Given this brainstorm spec:
{json.dumps(output)}

Generate specific instructions for each workflow step:
{[s.name for s in workflow_steps]}

Be concrete: mention file paths, patterns, specific requirements.""",
        options=ClaudeAgentOptions(model="haiku", max_turns=1),
    ):
        if isinstance(msg, ResultMessage):
            breakdowns = json.loads(msg.result)
            for step in workflow_steps:
                step.step_breakdown = breakdowns.get(step.name)
```

## Data Model Changes

### AgentConfig — add

| Column | Type | Notes |
|--------|------|-------|
| default_requires_approval | bool | default false |

### WorkflowTemplate steps_config — add per step

```json
{"id": "brainstorm", "agent": "brainstormer", "requires_approval": true, "brainstorm_schema": {...}}
```

### Ticket — add

| Column | Type | Notes |
|--------|------|-------|
| auto_execute | bool | default true, toggle auto/manual mode |

### WorkflowStep — add

| Column | Type | Notes |
|--------|------|-------|
| requires_approval | bool | nullable, null = inherit from template/agent |
| user_prompt_override | text | nullable, user-edited prompt before run |
| brainstorm_output | JSON | nullable, structured output from brainstorm step |
| step_breakdown | JSON | nullable, per-step instructions from brainstorm |

### StepStatus enum — add values

```
awaiting_approval, review, changes_requested
```

### StepReview (new table)

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| step_id | UUID | FK → WorkflowStep |
| revision | int | 1, 2, 3... increments on each changes_requested |
| diff_content | text | git diff |
| comments | JSON | all user comments for this revision |
| status | enum | `pending`, `approved`, `changes_requested` |
| created_at | datetime | |

## Workflow Engine

```python
class WorkflowEngine:
    async def tick(self, ticket_id):
        steps = await get_steps(ticket_id)
        ticket = await get_ticket(ticket_id)

        for step in steps:
            if step.status == "pending":
                deps = get_dependencies(step, steps)
                if all(d.status == "completed" for d in deps):
                    if self.needs_approval(step, ticket):
                        step.status = "awaiting_approval"
                    else:
                        step.status = "ready"
                        await self.schedule_step(step)

        if all(s.status in ("completed", "skipped") for s in steps):
            await self.complete_ticket(ticket_id)

    def needs_approval(self, step, ticket):
        if not ticket.auto_execute:
            return True
        if step.requires_approval is not None:
            return step.requires_approval
        template_step = get_template_step(step)
        if template_step.get("requires_approval") is not None:
            return template_step["requires_approval"]
        return step.agent_config.default_requires_approval

    async def on_step_approved(self, step):
        """After review approved."""
        await generate_step_summary(step)
        if is_brainstorm_step(step):
            await generate_spec_document(step)
            await generate_step_breakdowns(step)
        step.status = "completed"
        await self.tick(step.ticket_id)
```

## API Changes

### Workflow Steps — add/modify

```
POST   /tickets/:id/steps/:step_id/approve          # approve & run (manual step)
POST   /tickets/:id/steps/:step_id/approve-review    # approve review output
POST   /tickets/:id/steps/:step_id/request-changes   # request changes with comments
POST   /tickets/:id/steps/:step_id/regenerate        # brainstorm regenerate with comments
PATCH  /tickets/:id/steps/:step_id/prompt            # edit prompt override
```

### Ticket — add

```
PATCH  /tickets/:id    # includes auto_execute toggle
```
