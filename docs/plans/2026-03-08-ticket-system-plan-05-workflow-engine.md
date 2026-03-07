# Ticket System — Plan 05: Workflow Engine Updates

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Update workflow engine with auto_approval toggle, escalation chain for test failures, git workspace management (bare clone + worktrees), and agent session spawn with scoped custom MCP tools.

**Architecture:** Engine tick() advances DAG. Steps complete with review or auto-approval based on toggle. Test failures trigger escalation (retry > fix task > escalate). Agents spawn with scoped spec tools and work in git worktrees cloned from GitHub repos.

**Tech Stack:** Claude Agent SDK, Git (bare clone, worktrees), asyncio, Redis pub/sub

**Depends on:** [Plan 01](./2026-03-08-ticket-system-plan-01-data-layer.md), [Plan 02](./2026-03-08-ticket-system-plan-02-notifications.md), [Plan 03](./2026-03-08-ticket-system-plan-03-spec-management.md)
**Required by:** [Plan 09: Review UI](./2026-03-08-ticket-system-plan-09-review-ui.md)

---

## Task 1: Add needs_post_approval to WorkflowEngine

**Files:**
- Modify: `apps/backend/app/services/workflow_engine.py`

Update `complete_step` to check an auto_approval toggle before marking a step as completed. Currently `complete_step` sets `status = completed` unconditionally. Add a post-completion review gate:

- **Tier 0:** `ticket.auto_approval` is `True` — skip review (set `status = completed`), UNLESS the step explicitly overrides with `step.auto_approval == False`.
- **Tier 1:** `step.auto_approval` overrides ticket-level. If `step.auto_approval is not None`, use that value. `True` = skip review, `False` = require review.
- **Default:** If neither ticket nor step has auto_approval set (both falsy/None), require review (`status = review`).

Add new method `needs_post_approval(step, ticket) -> bool`:

```python
async def needs_post_approval(self, step: WorkflowStep, ticket: Ticket) -> bool:
    """Determine if a step needs human review after agent completion.

    Two-tier auto_approval resolution:
    - Tier 0: ticket.auto_approval ON → skip review (unless step overrides)
    - Tier 1: step.auto_approval overrides ticket-level
    - Default: needs review
    """
    # Tier 1: step-level override takes priority
    if step.auto_approval is not None:
        return not step.auto_approval  # auto_approval=True means NO post-approval needed

    # Tier 0: ticket-level
    if ticket.auto_approval:
        return False  # ticket says auto-approve, no review needed

    # Default: require review
    return True
```

Update `complete_step` to use the new method:

```python
async def complete_step(self, step: WorkflowStep):
    """Mark step as completed (or review if post-approval needed) and tick the DAG."""
    ticket = await self.db.get(Ticket, step.ticket_id)

    if ticket and await self.needs_post_approval(step, ticket):
        step.status = StepStatus.review
        await self.db.flush()
        return []

    step.status = StepStatus.completed
    await self.db.flush()
    return await self.tick(step.ticket_id)
```

**Steps:**
1. Add the `needs_post_approval` method to `WorkflowEngine`
2. Update `complete_step` to call `needs_post_approval` before setting status
3. Run `cd apps/backend && uv run ruff check app/services/workflow_engine.py` — Expected: no errors
4. Run `cd apps/backend && uv run pytest tests/test_workflow_engine.py -v` — Expected: existing tests still pass (they use `auto_execute=True` default, and `auto_approval` defaults to `False`, so `complete_step` now routes to `review` — update test expectations or set `auto_approval=True` on tickets in tests that expect direct completion)
5. Commit: `git add apps/backend/app/services/workflow_engine.py && git commit -m "feat(backend): add needs_post_approval to WorkflowEngine"`

---

## Task 2: Add escalation chain for test failures

**Files:**
- Modify: `apps/backend/app/services/workflow_engine.py`

Add a new method `handle_test_failure(step, error_context)` that implements a three-tier escalation chain for test step failures. This method is called instead of `fail_step` when a tester agent step fails.

The `WorkflowStep` model (from Plan 01) has `retry_count` (default 0), `max_retries` (default 2), and `parent_step_id` (nullable FK to self).

```python
async def handle_test_failure(
    self, step: WorkflowStep, error_context: str
) -> WorkflowStep:
    """Escalation chain for test failures.

    Tier 1 (retry_count < 1): Retry the tester — set user_prompt_override
        with error context so the agent can fix its own test code.
    Tier 2 (retry_count == 1): Auto-create a fix task — spawn a new
        WorkflowStep with parent_step_id pointing to the failing test step,
        assign coder agent, add dependency, then re-queue the tester.
    Tier 3 (retry_count >= max_retries): Mark as FAILED, notify user.

    Returns the step that should be executed next (or the failed step).
    """
    step.retry_count += 1

    if step.retry_count == 1:
        # Tier 1: Tester retries with error context
        step.user_prompt_override = (
            f"Previous test run failed. Fix the test code based on this error:\n\n"
            f"{error_context}\n\n"
            f"Analyze the failure, fix the issue, and re-run the tests."
        )
        step.status = StepStatus.ready
        await self.db.flush()
        return step

    elif step.retry_count == 2:
        # Tier 2: Create a fix task for coder agent
        ticket = await self.db.get(Ticket, step.ticket_id)

        # Find the coder agent config (look for agent with "coder" in name)
        from sqlalchemy import select
        from app.models.agent_config import AgentConfig

        result = await self.db.execute(
            select(AgentConfig).where(
                AgentConfig.project_id == ticket.project_id,
                AgentConfig.name.ilike("%coder%"),
            )
        )
        coder_config = result.scalars().first()

        fix_step = WorkflowStep(
            id=uuid.uuid4(),
            ticket_id=step.ticket_id,
            template_step_id=f"fix-{step.template_step_id}",
            name=f"Fix: {step.name}",
            description=f"Auto-created fix task for test failure:\n{error_context}",
            agent_config_id=coder_config.id if coder_config else step.agent_config_id,
            status=StepStatus.ready,
            order=step.order,
            parent_step_id=step.id,
            user_prompt_override=(
                f"A test step failed with this error:\n\n{error_context}\n\n"
                f"Fix the implementation code to make the tests pass."
            ),
            repo_ids=step.repo_ids,
        )
        self.db.add(fix_step)
        await self.db.flush()

        # Add dependency: test step depends on fix step
        dep = WorkflowStepDependency(
            step_id=step.id,
            depends_on_id=fix_step.id,
        )
        self.db.add(dep)

        # Re-queue the tester after fix completes
        step.status = StepStatus.pending
        step.user_prompt_override = (
            f"A fix was applied for the previous failure. Re-run all tests "
            f"to verify the fix resolved the issue."
        )
        await self.db.flush()

        return fix_step

    else:
        # Tier 3: Max retries exceeded — fail permanently
        step.status = StepStatus.failed
        await self.db.flush()
        return step
```

Import `WorkflowStepDependency` at the top of the file:

```python
from app.models.workflow_step import WorkflowStep, WorkflowStepDependency
```

**Steps:**
1. Add the `WorkflowStepDependency` import to the top of `workflow_engine.py`
2. Add the `handle_test_failure` method to `WorkflowEngine`
3. Run `cd apps/backend && uv run ruff check app/services/workflow_engine.py` — Expected: no errors
4. Run `cd apps/backend && uv run pytest tests/test_workflow_engine.py -v` — Expected: existing tests pass
5. Commit: `git add apps/backend/app/services/workflow_engine.py && git commit -m "feat(backend): add escalation chain for test failures"`

---

## Task 3: Git workspace manager

**Files:**
- Create: `apps/backend/app/services/workspace_manager.py`

Create a `WorkspaceManager` class that handles bare clones and worktree creation for agent steps. This replaces direct usage of `git_worktree.py` functions with a higher-level abstraction that understands tickets, steps, and multi-repo setups.

Key design decisions:
- Bare clones live at `~/.agent-coding/repos/{owner}/{repo}.git`
- Worktrees live at `~/.agent-coding/worktrees/{ticket_key}/{step_template_id}`
- Coder tasks reuse the same worktree (sequential execution on same branch)
- Non-coder tasks (tester, reviewer) get separate worktrees per step
- Multi-repo tickets get a parent folder with sub-worktrees

```python
import asyncio
import os
import uuid
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project_repository import ProjectRepository
from app.models.ticket import Ticket
from app.models.workflow_step import WorkflowStep

BASE_DIR = Path.home() / ".agent-coding"
REPOS_DIR = BASE_DIR / "repos"
WORKTREES_DIR = BASE_DIR / "worktrees"


class WorkspaceManager:
    """Manages git bare clones and worktrees for agent execution."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def ensure_bare_clone(self, repo: ProjectRepository) -> Path:
        """Clone bare if not exists at ~/.agent-coding/repos/{owner}/{repo}.git

        Returns the path to the bare clone directory.
        """
        # Parse owner/repo from repo_full_name (e.g. "acme/my-app")
        bare_path = REPOS_DIR / f"{repo.repo_full_name}.git"

        if bare_path.exists():
            # Fetch latest
            await self._run_git(str(bare_path), "fetch", "--all", "--prune")
            return bare_path

        bare_path.parent.mkdir(parents=True, exist_ok=True)

        # Build clone URL with token placeholder
        clone_url = repo.repo_url
        if not clone_url.endswith(".git"):
            clone_url += ".git"

        proc = await asyncio.create_subprocess_exec(
            "git", "clone", "--bare", clone_url, str(bare_path),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await proc.communicate()
        if proc.returncode != 0:
            raise RuntimeError(f"Failed to bare clone {repo.repo_full_name}: {stderr.decode()}")

        return bare_path

    async def setup_workspace(
        self, step: WorkflowStep, ticket: Ticket
    ) -> str:
        """Set up git worktree(s) for a step.

        Returns the working directory path for the agent.

        - Single repo: worktree at ~/.agent-coding/worktrees/{ticket_key}/{step_id}
        - Multi-repo: parent dir with sub-worktrees per repo
        - Coder steps reuse worktree by ticket+role (sequential)
        - Non-coder steps get isolated worktrees
        """
        repo_ids = step.repo_ids or []

        # Load repos
        repos: list[ProjectRepository] = []
        if repo_ids:
            result = await self.db.execute(
                select(ProjectRepository).where(
                    ProjectRepository.id.in_([uuid.UUID(r) for r in repo_ids])
                )
            )
            repos = list(result.scalars().all())
        else:
            # Fallback: use all project repos
            result = await self.db.execute(
                select(ProjectRepository).where(
                    ProjectRepository.project_id == ticket.project_id
                )
            )
            repos = list(result.scalars().all())

        if not repos:
            raise RuntimeError(
                f"No repositories found for step {step.id} on ticket {ticket.key}"
            )

        # Determine worktree identity
        is_coder = self._is_coder_step(step)
        worktree_key = (
            f"{ticket.key}/coder" if is_coder
            else f"{ticket.key}/{step.template_step_id}-{str(step.id)[:8]}"
        )

        branch_name = f"agent/{ticket.key}/{step.template_step_id}"

        if len(repos) == 1:
            # Single repo
            repo = repos[0]
            bare_path = await self.ensure_bare_clone(repo)
            worktree_path = WORKTREES_DIR / worktree_key
            return await self._create_or_reuse_worktree(
                bare_path, worktree_path, branch_name, repo.default_branch, is_coder
            )
        else:
            # Multi-repo: parent folder with sub-worktrees
            parent_path = WORKTREES_DIR / worktree_key
            parent_path.mkdir(parents=True, exist_ok=True)

            for repo in repos:
                bare_path = await self.ensure_bare_clone(repo)
                repo_name = repo.repo_full_name.split("/")[-1]
                sub_path = parent_path / repo_name
                await self._create_or_reuse_worktree(
                    bare_path, sub_path, branch_name, repo.default_branch, is_coder
                )

            return str(parent_path)

    async def cleanup_workspace(self, ticket: Ticket) -> None:
        """Remove all worktrees for a ticket when it completes."""
        ticket_dir = WORKTREES_DIR / ticket.key
        if not ticket_dir.exists():
            return

        # Find all bare repos to unregister worktrees
        result = await self.db.execute(
            select(ProjectRepository).where(
                ProjectRepository.project_id == ticket.project_id
            )
        )
        repos = list(result.scalars().all())

        for repo in repos:
            bare_path = REPOS_DIR / f"{repo.repo_full_name}.git"
            if bare_path.exists():
                # Prune worktrees that no longer exist on disk
                await self._run_git(str(bare_path), "worktree", "prune")

        # Remove the ticket worktree directory
        import shutil
        shutil.rmtree(str(ticket_dir), ignore_errors=True)

    async def _create_or_reuse_worktree(
        self,
        bare_path: Path,
        worktree_path: Path,
        branch_name: str,
        default_branch: str,
        reuse: bool,
    ) -> str:
        """Create a worktree or reuse an existing one."""
        if reuse and worktree_path.exists():
            # Pull latest changes into existing worktree
            await self._run_git(str(worktree_path), "pull", "--ff-only", allow_fail=True)
            return str(worktree_path)

        worktree_path.parent.mkdir(parents=True, exist_ok=True)

        # Fetch latest before creating worktree
        await self._run_git(str(bare_path), "fetch", "--all")

        # Create worktree with new branch from default branch
        proc = await asyncio.create_subprocess_exec(
            "git", "-C", str(bare_path),
            "worktree", "add", "-b", branch_name,
            str(worktree_path), f"origin/{default_branch}",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await proc.communicate()

        if proc.returncode != 0:
            stderr_text = stderr.decode()
            if "already exists" in stderr_text:
                # Branch exists — checkout without -b
                proc2 = await asyncio.create_subprocess_exec(
                    "git", "-C", str(bare_path),
                    "worktree", "add", str(worktree_path), branch_name,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
                _, stderr2 = await proc2.communicate()
                if proc2.returncode != 0:
                    raise RuntimeError(
                        f"Failed to create worktree: {stderr2.decode()}"
                    )
            else:
                raise RuntimeError(f"Failed to create worktree: {stderr_text}")

        return str(worktree_path)

    def _is_coder_step(self, step: WorkflowStep) -> bool:
        """Determine if this is a coder step that should reuse worktrees."""
        coder_indicators = ["coder", "implement", "code", "develop"]
        step_id_lower = step.template_step_id.lower()
        name_lower = step.name.lower()
        return any(
            indicator in step_id_lower or indicator in name_lower
            for indicator in coder_indicators
        )

    async def _run_git(
        self, cwd: str, *args: str, allow_fail: bool = False
    ) -> tuple[str, str]:
        """Run a git command and return (stdout, stderr)."""
        proc = await asyncio.create_subprocess_exec(
            "git", "-C", cwd, *args,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate()
        if proc.returncode != 0 and not allow_fail:
            raise RuntimeError(
                f"Git command failed: git -C {cwd} {' '.join(args)}\n{stderr.decode()}"
            )
        return stdout.decode(), stderr.decode()
```

**Steps:**
1. Create `apps/backend/app/services/workspace_manager.py` with the `WorkspaceManager` class
2. Run `cd apps/backend && uv run ruff check app/services/workspace_manager.py` — Expected: no errors
3. Run `cd apps/backend && uv run pytest tests/ -v --co` — Expected: test collection succeeds
4. Commit: `git add apps/backend/app/services/workspace_manager.py && git commit -m "feat(backend): add WorkspaceManager for git bare clones and worktrees"`

---

## Task 4: Update agent session spawn

**Files:**
- Modify: `apps/backend/app/services/workflow_engine.py`

Add a new method `auto_start_step` that orchestrates the full agent execution lifecycle. This method is called when a step transitions to `ready` status (either directly from `tick()` or after manual approval).

The method:
1. Builds scoped spec tools via `build_spec_tools(ticket_id, db_session_factory)` (from Plan 03)
2. Sets up workspace via `WorkspaceManager`
3. Builds `ClaudeAgentOptions` with system_prompt preset + append, model, tools, mcp_servers
4. Creates a `Session` record
5. Streams execution via WebSocket relay
6. On `ResultMessage`: updates session cost/tokens, calls `complete_step` or `handle_test_failure`

```python
async def auto_start_step(
    self,
    step: WorkflowStep,
    db_session_factory,
    websocket_manager=None,
) -> None:
    """Full agent execution lifecycle for an auto-started step.

    1. Setup workspace (git worktree)
    2. Build spec tools (scoped to ticket)
    3. Build agent options
    4. Create Session record
    5. Execute via Claude SDK with streaming
    6. Handle result (complete or escalate)
    """
    import asyncio
    from datetime import datetime, timezone

    from app.models.agent_config import AgentConfig
    from app.models.session import Session
    from app.models.enums import SessionStatus
    from app.services.workspace_manager import WorkspaceManager
    from app.services.agent_runner import AgentRunner

    ticket = await self.db.get(Ticket, step.ticket_id)
    if not ticket:
        return

    # Mark step as running
    await self.start_step(step)

    # 1. Setup workspace
    workspace_mgr = WorkspaceManager(self.db)
    try:
        cwd = await workspace_mgr.setup_workspace(step, ticket)
    except RuntimeError as e:
        await self.fail_step(step, error=str(e))
        return

    # 2. Build spec tools (scoped to this ticket)
    custom_tools = []
    try:
        from app.services.spec_tools import build_spec_tools
        custom_tools = build_spec_tools(ticket.id, db_session_factory)
    except ImportError:
        pass  # spec_tools not yet available

    # 3. Build agent options
    agent_config = None
    if step.agent_config_id:
        agent_config = await self.db.get(AgentConfig, step.agent_config_id)
    if not agent_config:
        await self.fail_step(step, error="No agent config assigned to step")
        return

    runner = AgentRunner(self.db)
    options = await runner.build_agent_options(step, agent_config, cwd)

    # Append spec tools to existing tools
    if custom_tools:
        existing_tools = options.get("tools") or []
        options["tools"] = existing_tools + custom_tools

    # Append ticket context to system prompt
    prompt_suffix = (
        f"\n\n## Ticket Context\n"
        f"Ticket: {ticket.key} — {ticket.title}\n"
        f"Step: {step.name}\n"
    )
    if step.description:
        prompt_suffix += f"Description: {step.description}\n"
    if step.user_prompt_override:
        prompt_suffix += f"\n## Special Instructions\n{step.user_prompt_override}\n"
    options["system_prompt"] = options.get("system_prompt", "") + prompt_suffix

    # Build the user prompt
    user_prompt = step.user_prompt_override or step.description or step.name

    # 4. Create Session record
    branch_name = f"agent/{ticket.key}/{step.template_step_id}"
    session = Session(
        id=uuid.uuid4(),
        step_id=step.id,
        status=SessionStatus.running.value,
        git_branch=branch_name,
        worktree_path=cwd,
    )
    self.db.add(session)
    await self.db.flush()

    # 5. Execute via Claude SDK
    try:
        from claude_code_sdk import query, ClaudeCodeOptions

        result_message = None
        total_cost = 0.0
        total_tokens = 0

        async for event in query(
            prompt=user_prompt,
            options=ClaudeCodeOptions(**options),
        ):
            # Relay events via WebSocket if manager is available
            if websocket_manager:
                await websocket_manager.broadcast_session_event(
                    session_id=session.id,
                    step_id=step.id,
                    ticket_id=ticket.id,
                    event=event,
                )

            # Track result
            if hasattr(event, "is_result") and event.is_result:
                result_message = event
            if hasattr(event, "cost_usd"):
                total_cost = event.cost_usd
            if hasattr(event, "total_tokens"):
                total_tokens = event.total_tokens

        # 6. Handle result
        session.cost_usd = total_cost
        session.tokens_used = total_tokens
        session.finished_at = datetime.now(timezone.utc)
        session.status = SessionStatus.completed.value

        if result_message and hasattr(result_message, "exit_code"):
            session.exit_code = result_message.exit_code

        await self.db.flush()

        # Determine success or failure
        is_test_step = self._is_test_step(step)
        exit_code = getattr(result_message, "exit_code", 0) if result_message else 0

        if exit_code != 0 and is_test_step:
            error_text = (
                getattr(result_message, "error_message", "")
                if result_message else "Unknown test failure"
            )
            await self.handle_test_failure(step, error_text or "Test execution failed")
        elif exit_code != 0:
            await self.fail_step(step, error="Agent exited with non-zero code")
        else:
            await self.complete_step(step)

    except Exception as e:
        session.status = SessionStatus.failed.value
        session.error_message = str(e)
        session.finished_at = datetime.now(timezone.utc)
        await self.db.flush()
        await self.fail_step(step, error=str(e))

    # Register/cleanup session tracking
    runner.remove_session(step.id)

def _is_test_step(self, step: WorkflowStep) -> bool:
    """Determine if this is a test/tester step."""
    test_indicators = ["test", "tester", "qa", "verify"]
    step_id_lower = step.template_step_id.lower()
    name_lower = step.name.lower()
    return any(
        indicator in step_id_lower or indicator in name_lower
        for indicator in test_indicators
    )
```

**Steps:**
1. Add `auto_start_step` and `_is_test_step` methods to `WorkflowEngine`
2. Run `cd apps/backend && uv run ruff check app/services/workflow_engine.py` — Expected: no errors
3. Run `cd apps/backend && uv run pytest tests/test_workflow_engine.py -v` — Expected: existing tests pass
4. Commit: `git add apps/backend/app/services/workflow_engine.py && git commit -m "feat(backend): add auto_start_step for agent session spawn"`

---

## Task 5: Add workflow start endpoint updates

**Files:**
- Modify: `apps/backend/app/routers/tickets.py`

Add a new endpoint `POST /tickets/{ticket_id}/start` that kicks off workflow execution for a ticket. This endpoint:
1. Validates the ticket exists and is in a startable state (`backlog` or `todo`)
2. Creates a "Plan Writer" step as the first step if no steps exist
3. Calls `tick()` to advance the DAG
4. For any steps that become `ready`, fires `auto_start_step` as a background task
5. Returns the updated ticket with steps

```python
from fastapi import BackgroundTasks

@router.post("/tickets/{ticket_id}/start", response_model=TicketResponse)
async def start_ticket_workflow(
    ticket_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TicketResponse:
    """Start workflow execution for a ticket."""
    ticket = await get_ticket(db, ticket_id)
    if ticket is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found",
        )

    if ticket.status not in (TicketStatus.backlog, TicketStatus.todo):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ticket cannot be started from status '{ticket.status.value}'",
        )

    engine = WorkflowEngine(db)

    # Create Plan Writer step if no steps exist
    if not ticket.steps:
        from app.models.workflow_step import WorkflowStep
        plan_step = WorkflowStep(
            id=uuid.uuid4(),
            ticket_id=ticket.id,
            template_step_id="plan-writer",
            name="Plan Writer",
            description="Generate implementation plan from ticket spec",
            status=StepStatus.pending,
            order=0,
        )
        db.add(plan_step)
        await db.flush()

    # Advance the DAG
    newly_ready = await engine.tick(ticket_id)
    await db.commit()

    # Schedule auto-start for ready steps
    for step in newly_ready:
        if step.status == StepStatus.ready:
            background_tasks.add_task(
                _run_step_in_background,
                ticket_id=ticket.id,
                step_id=step.id,
            )

    await db.refresh(ticket)
    return TicketResponse.model_validate(ticket)


async def _run_step_in_background(ticket_id: uuid.UUID, step_id: uuid.UUID):
    """Background task to run a step via the workflow engine."""
    from app.database import async_session_factory

    async with async_session_factory() as db:
        step = await db.get(WorkflowStep, step_id)
        if not step or step.status != StepStatus.ready:
            return

        engine = WorkflowEngine(db)
        await engine.auto_start_step(
            step=step,
            db_session_factory=async_session_factory,
        )
        await db.commit()
```

Add necessary imports at the top of the file:

```python
from app.models.enums import StepStatus, TicketPriority, TicketStatus, TicketType
from app.services.workflow_engine import WorkflowEngine
```

**Steps:**
1. Add the imports to `apps/backend/app/routers/tickets.py`
2. Add the `start_ticket_workflow` endpoint and `_run_step_in_background` helper
3. Run `cd apps/backend && uv run ruff check app/routers/tickets.py` — Expected: no errors
4. Run `cd apps/backend && uv run pytest tests/ -v --co` — Expected: test collection succeeds
5. Commit: `git add apps/backend/app/routers/tickets.py && git commit -m "feat(backend): add POST /tickets/{ticket_id}/start endpoint"`

---

## Task 6: Add notification triggers

**Files:**
- Modify: `apps/backend/app/services/workflow_engine.py`

After each step status change, call `NotificationService.create()` (from Plan 02) for relevant events. Add a helper method `_notify_step_change` and call it from `complete_step`, `fail_step`, `review_step`, and the ticket-completion path in `tick()`.

```python
async def _notify_step_change(
    self, step: WorkflowStep, ticket: Ticket, event_type: str
) -> None:
    """Send notification for step status changes.

    event_type values:
    - step_awaiting_review: agent completed, needs human review
    - step_failed: step failed (after escalation exhausted)
    - workflow_completed: all steps done, ticket is complete
    """
    try:
        from app.services.notification_service import NotificationService
    except ImportError:
        return  # notification service not yet available

    notifier = NotificationService(self.db)

    if event_type == "step_awaiting_review":
        await notifier.create(
            user_id=ticket.created_by,
            type="step_awaiting_review",
            title=f"Step ready for review: {step.name}",
            body=f"Ticket {ticket.key}: {step.name} has completed and needs your review.",
            resource_type="workflow_step",
            resource_id=step.id,
        )

    elif event_type == "step_failed":
        await notifier.create(
            user_id=ticket.created_by,
            type="step_failed",
            title=f"Step failed: {step.name}",
            body=f"Ticket {ticket.key}: {step.name} has failed after all retries.",
            resource_type="workflow_step",
            resource_id=step.id,
        )

    elif event_type == "workflow_completed":
        await notifier.create(
            user_id=ticket.created_by,
            type="workflow_completed",
            title=f"Workflow completed: {ticket.key}",
            body=f"All steps for ticket {ticket.key} ({ticket.title}) have completed.",
            resource_type="ticket",
            resource_id=ticket.id,
        )
```

Update existing methods to call `_notify_step_change`:

- In `complete_step`: when routing to `StepStatus.review`, call `_notify_step_change(step, ticket, "step_awaiting_review")`
- In `fail_step`: call `_notify_step_change(step, ticket, "step_failed")`
- In `tick()`: when setting `ticket.status = TicketStatus.done`, call `_notify_step_change(step=steps[0], ticket=ticket, "workflow_completed")` (use any step as reference, the notification is ticket-level)
- In `handle_test_failure`: at tier 3 (final failure), call `_notify_step_change(step, ticket, "step_failed")`

**Steps:**
1. Add `_notify_step_change` method to `WorkflowEngine`
2. Update `complete_step` to send `step_awaiting_review` notification when entering review
3. Update `fail_step` to send `step_failed` notification
4. Update `tick()` to send `workflow_completed` notification when ticket auto-completes
5. Update `handle_test_failure` tier 3 to send `step_failed` notification
6. Run `cd apps/backend && uv run ruff check app/services/workflow_engine.py` — Expected: no errors
7. Run `cd apps/backend && uv run pytest tests/test_workflow_engine.py -v` — Expected: tests pass (notifications silently skip if service unavailable)
8. Commit: `git add apps/backend/app/services/workflow_engine.py && git commit -m "feat(backend): add notification triggers on step status changes"`

---

## Task 7: Tests for workflow engine updates

**Files:**
- Modify: `apps/backend/tests/test_workflow_engine.py`

Add tests for the new workflow engine functionality. Write each test first, verify it fails, implement any missing pieces, verify it passes.

### Test cases to add:

```python
@pytest.mark.asyncio
async def test_complete_step_routes_to_review_by_default(db_session: AsyncSession):
    """complete_step should set status to 'review' when auto_approval is off."""
    data = await _setup_test_data(db_session)
    ticket = await _create_ticket(db_session, data["project"].id, data["user"].id)
    # ticket.auto_approval defaults to False
    step = await _create_step(
        db_session, ticket.id, "Code", status=StepStatus.running, order=0
    )
    await db_session.commit()

    engine = WorkflowEngine(db_session)
    await db_session.refresh(step)
    result = await engine.complete_step(step)

    await db_session.refresh(step)
    assert step.status == StepStatus.review
    assert result == []  # No DAG advancement when going to review


@pytest.mark.asyncio
async def test_complete_step_skips_review_with_ticket_auto_approval(
    db_session: AsyncSession,
):
    """complete_step should skip review when ticket.auto_approval is True."""
    data = await _setup_test_data(db_session)
    ticket = await _create_ticket(db_session, data["project"].id, data["user"].id)
    ticket.auto_approval = True
    await db_session.flush()

    step_a = await _create_step(
        db_session, ticket.id, "Code", status=StepStatus.running, order=0
    )
    step_b = await _create_step(
        db_session, ticket.id, "Test", status=StepStatus.pending, order=1
    )
    await _add_dependency(db_session, step_b.id, step_a.id)
    await db_session.commit()

    engine = WorkflowEngine(db_session)
    await db_session.refresh(step_a)
    result = await engine.complete_step(step_a)

    await db_session.refresh(step_a)
    assert step_a.status == StepStatus.completed
    assert len(result) == 1  # step_b became ready


@pytest.mark.asyncio
async def test_step_auto_approval_overrides_ticket(db_session: AsyncSession):
    """step.auto_approval=False should force review even if ticket.auto_approval=True."""
    data = await _setup_test_data(db_session)
    ticket = await _create_ticket(db_session, data["project"].id, data["user"].id)
    ticket.auto_approval = True
    await db_session.flush()

    step = await _create_step(
        db_session, ticket.id, "Code", status=StepStatus.running, order=0
    )
    step.auto_approval = False
    await db_session.flush()
    await db_session.commit()

    engine = WorkflowEngine(db_session)
    await db_session.refresh(step)
    await engine.complete_step(step)

    await db_session.refresh(step)
    assert step.status == StepStatus.review


@pytest.mark.asyncio
async def test_escalation_tier1_retry(db_session: AsyncSession):
    """First test failure: tester retries with error context."""
    data = await _setup_test_data(db_session)
    ticket = await _create_ticket(db_session, data["project"].id, data["user"].id)
    step = await _create_step(
        db_session, ticket.id, "Tester", status=StepStatus.running, order=0
    )
    step.retry_count = 0
    await db_session.commit()

    engine = WorkflowEngine(db_session)
    await db_session.refresh(step)
    result = await engine.handle_test_failure(step, "AssertionError: expected 1, got 2")

    await db_session.refresh(step)
    assert step.status == StepStatus.ready
    assert step.retry_count == 1
    assert "AssertionError" in step.user_prompt_override
    assert result.id == step.id


@pytest.mark.asyncio
async def test_escalation_tier2_creates_fix_step(db_session: AsyncSession):
    """Second test failure: creates a fix task step."""
    data = await _setup_test_data(db_session)
    ticket = await _create_ticket(db_session, data["project"].id, data["user"].id)
    step = await _create_step(
        db_session, ticket.id, "Tester", status=StepStatus.running, order=0,
        agent_config_id=data["agent_config"].id,
    )
    step.retry_count = 1  # Already retried once
    await db_session.commit()

    engine = WorkflowEngine(db_session)
    await db_session.refresh(step)
    fix_step = await engine.handle_test_failure(step, "TypeError: undefined is not a function")

    # Fix step was created
    assert fix_step.id != step.id
    assert fix_step.status == StepStatus.ready
    assert fix_step.parent_step_id == step.id
    assert "Fix:" in fix_step.name

    # Original step re-queued as pending
    await db_session.refresh(step)
    assert step.status == StepStatus.pending
    assert step.retry_count == 2


@pytest.mark.asyncio
async def test_escalation_tier3_fails_permanently(db_session: AsyncSession):
    """Third+ test failure: step fails permanently."""
    data = await _setup_test_data(db_session)
    ticket = await _create_ticket(db_session, data["project"].id, data["user"].id)
    step = await _create_step(
        db_session, ticket.id, "Tester", status=StepStatus.running, order=0
    )
    step.retry_count = 2  # Already at max
    step.max_retries = 2
    await db_session.commit()

    engine = WorkflowEngine(db_session)
    await db_session.refresh(step)
    result = await engine.handle_test_failure(step, "Fatal error")

    await db_session.refresh(step)
    assert step.status == StepStatus.failed
    assert step.retry_count == 3
    assert result.id == step.id
```

Update the `_create_step` helper to accept the new fields:

```python
async def _create_step(
    db: AsyncSession,
    ticket_id: uuid.UUID,
    name: str,
    status: StepStatus = StepStatus.pending,
    order: int = 0,
    agent_config_id: uuid.UUID | None = None,
    auto_approval: bool | None = None,
) -> WorkflowStep:
    step = WorkflowStep(
        id=uuid.uuid4(),
        ticket_id=ticket_id,
        template_step_id=f"tmpl-{name.lower()}",
        name=name,
        status=status,
        order=order,
        agent_config_id=agent_config_id,
        auto_approval=auto_approval,
    )
    db.add(step)
    await db.flush()
    return step
```

Note: some existing tests that call `complete_step` and expect immediate completion will need updating. Those tests should either:
- Set `ticket.auto_approval = True` on the ticket, OR
- Use `approve_review_step` after `complete_step` to simulate the full flow

Check each existing test that calls `complete_step` and update accordingly.

**Steps:**
1. Update `_create_step` helper to accept `auto_approval` parameter
2. Update existing tests that call `complete_step` to set `ticket.auto_approval = True` where they expect direct completion
3. Add all new test cases listed above
4. Run `cd apps/backend && uv run pytest tests/test_workflow_engine.py -v` — Expected: all tests pass
5. Commit: `git add apps/backend/tests/test_workflow_engine.py && git commit -m "test(backend): add tests for auto_approval and escalation chain"`

---

## Task 8: Tests for workspace manager

**Files:**
- Create: `apps/backend/tests/test_workspace_manager.py`

Add unit tests for `WorkspaceManager`. These tests mock git subprocess calls since we do not want to actually clone repos in tests.

```python
import uuid
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import StepStatus, TicketPriority, TicketStatus, TicketType, UserRole
from app.models.project import Project, ProjectMember
from app.models.project_repository import ProjectRepository
from app.models.ticket import Ticket
from app.models.user import User
from app.models.workflow_step import WorkflowStep
from app.services.workspace_manager import WorkspaceManager, REPOS_DIR, WORKTREES_DIR


async def _setup_workspace_test_data(db: AsyncSession) -> dict:
    """Create user, project, repo, ticket, and step for workspace tests."""
    user = User(
        id=uuid.uuid4(),
        email=f"ws-test-{uuid.uuid4().hex[:8]}@example.com",
        name="WS Test User",
        role=UserRole.admin,
        hashed_password="fakehashed",
    )
    db.add(user)
    await db.flush()

    project = Project(
        id=uuid.uuid4(),
        name="WS Test Project",
        slug=f"ws-test-{uuid.uuid4().hex[:8]}",
        path="/tmp/ws-test-project",
        created_by=user.id,
    )
    db.add(project)
    await db.flush()

    member = ProjectMember(
        project_id=project.id,
        user_id=user.id,
        role="admin",
    )
    db.add(member)
    await db.flush()

    repo = ProjectRepository(
        id=uuid.uuid4(),
        project_id=project.id,
        github_account_id=uuid.uuid4(),  # placeholder
        github_repo_id=12345,
        repo_full_name="acme/my-app",
        repo_url="https://github.com/acme/my-app",
        default_branch="main",
        connected_by=user.id,
    )
    db.add(repo)
    await db.flush()

    ticket = Ticket(
        id=uuid.uuid4(),
        project_id=project.id,
        key="WS-001",
        title="Workspace Test Ticket",
        type=TicketType.feature,
        status=TicketStatus.in_progress,
        priority=TicketPriority.medium,
        created_by=user.id,
    )
    db.add(ticket)
    await db.flush()

    return {"user": user, "project": project, "repo": repo, "ticket": ticket}


@pytest.mark.asyncio
async def test_is_coder_step(db_session: AsyncSession):
    """_is_coder_step correctly identifies coder steps."""
    data = await _setup_workspace_test_data(db_session)
    mgr = WorkspaceManager(db_session)

    coder_step = WorkflowStep(
        id=uuid.uuid4(),
        ticket_id=data["ticket"].id,
        template_step_id="coder",
        name="Implement Feature",
        status=StepStatus.ready,
        order=0,
    )
    assert mgr._is_coder_step(coder_step) is True

    test_step = WorkflowStep(
        id=uuid.uuid4(),
        ticket_id=data["ticket"].id,
        template_step_id="tester",
        name="Run Tests",
        status=StepStatus.ready,
        order=1,
    )
    assert mgr._is_coder_step(test_step) is False


@pytest.mark.asyncio
async def test_ensure_bare_clone_creates_dir(db_session: AsyncSession):
    """ensure_bare_clone calls git clone --bare when dir does not exist."""
    data = await _setup_workspace_test_data(db_session)
    mgr = WorkspaceManager(db_session)
    repo = data["repo"]

    mock_proc = AsyncMock()
    mock_proc.returncode = 0
    mock_proc.communicate = AsyncMock(return_value=(b"", b""))

    with patch("asyncio.create_subprocess_exec", return_value=mock_proc) as mock_exec:
        with patch.object(Path, "exists", return_value=False):
            with patch.object(Path, "mkdir"):
                result = await mgr.ensure_bare_clone(repo)

    expected_path = REPOS_DIR / "acme/my-app.git"
    assert result == expected_path
    # Verify git clone --bare was called
    mock_exec.assert_called_once()
    call_args = mock_exec.call_args[0]
    assert "clone" in call_args
    assert "--bare" in call_args


@pytest.mark.asyncio
async def test_ensure_bare_clone_fetches_existing(db_session: AsyncSession):
    """ensure_bare_clone fetches when bare dir already exists."""
    data = await _setup_workspace_test_data(db_session)
    mgr = WorkspaceManager(db_session)
    repo = data["repo"]

    with patch.object(Path, "exists", return_value=True):
        with patch.object(mgr, "_run_git", new_callable=AsyncMock) as mock_git:
            mock_git.return_value = ("", "")
            result = await mgr.ensure_bare_clone(repo)

    expected_path = REPOS_DIR / "acme/my-app.git"
    assert result == expected_path
    mock_git.assert_called_once_with(str(expected_path), "fetch", "--all", "--prune")


@pytest.mark.asyncio
async def test_cleanup_workspace_removes_dir(db_session: AsyncSession):
    """cleanup_workspace removes the ticket worktree directory."""
    data = await _setup_workspace_test_data(db_session)
    mgr = WorkspaceManager(db_session)
    ticket = data["ticket"]

    with patch.object(Path, "exists", return_value=True):
        with patch.object(mgr, "_run_git", new_callable=AsyncMock):
            with patch("shutil.rmtree") as mock_rmtree:
                await mgr.cleanup_workspace(ticket)

    expected_dir = str(WORKTREES_DIR / ticket.key)
    mock_rmtree.assert_called_once_with(expected_dir, ignore_errors=True)
```

**Steps:**
1. Create `apps/backend/tests/test_workspace_manager.py` with the test cases above
2. Run `cd apps/backend && uv run pytest tests/test_workspace_manager.py -v` — Expected: all tests pass
3. Commit: `git add apps/backend/tests/test_workspace_manager.py && git commit -m "test(backend): add tests for WorkspaceManager"`
