import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.agent_config import AgentConfig
from app.models.enums import StepStatus, TicketStatus
from app.models.ticket import Ticket
from app.models.workflow_step import WorkflowStep, WorkflowStepDependency
from app.models.workflow_template import WorkflowTemplate


class WorkflowEngine:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def tick(self, ticket_id: uuid.UUID) -> list[WorkflowStep]:
        """Advance the DAG. Returns steps that became ready/awaiting_approval."""
        ticket = await self.db.get(Ticket, ticket_id)
        if not ticket:
            return []

        result = await self.db.execute(
            select(WorkflowStep)
            .where(WorkflowStep.ticket_id == ticket_id)
            .options(selectinload(WorkflowStep.dependencies))
        )
        steps = list(result.scalars().all())
        step_map = {s.id: s for s in steps}

        newly_ready: list[WorkflowStep] = []

        for step in steps:
            if step.status != StepStatus.pending:
                continue

            # Check if all dependencies are completed or skipped
            all_deps_done = True
            for dep in step.dependencies:
                dep_step = step_map.get(dep.depends_on_id)
                if dep_step and dep_step.status not in (
                    StepStatus.completed,
                    StepStatus.skipped,
                ):
                    all_deps_done = False
                    break

            if all_deps_done:
                if await self.needs_approval(step, ticket):
                    step.status = StepStatus.awaiting_approval
                else:
                    step.status = StepStatus.ready
                newly_ready.append(step)

        # Auto-complete ticket if all steps done
        all_done = all(
            s.status in (StepStatus.completed, StepStatus.skipped) for s in steps
        )
        if all_done and steps:
            if ticket.status != TicketStatus.done:
                ticket.status = TicketStatus.done
                await self._notify_step_change(
                    steps[0], ticket, "workflow_completed"
                )

        await self.db.flush()
        return newly_ready

    async def needs_approval(self, step: WorkflowStep, ticket: Ticket) -> bool:
        """Three-tier approval resolution: step > template > agent config."""
        # Tier 0: auto_execute=False forces all steps to need approval
        if not ticket.auto_execute:
            return True

        # Tier 1: step-level override
        if step.requires_approval is not None:
            return step.requires_approval

        # Tier 2: template step config
        if ticket.template_id:
            template = await self.db.get(WorkflowTemplate, ticket.template_id)
            if template and template.steps_config:
                for tmpl_step in template.steps_config.get("steps", []):
                    if tmpl_step["id"] == step.template_step_id:
                        tmpl_approval = tmpl_step.get("requires_approval")
                        if tmpl_approval is not None:
                            return tmpl_approval
                        break

        # Tier 3: agent config default
        if step.agent_config_id:
            agent_config = await self.db.get(AgentConfig, step.agent_config_id)
            if agent_config:
                return agent_config.default_requires_approval

        return False

    async def start_step(self, step: WorkflowStep):
        """Mark step as running and update ticket status."""
        step.status = StepStatus.running

        # Auto-progress ticket
        ticket = await self.db.get(Ticket, step.ticket_id)
        if ticket and ticket.status in (TicketStatus.backlog, TicketStatus.todo):
            ticket.status = TicketStatus.in_progress

        await self.db.flush()

    async def needs_post_approval(self, step: WorkflowStep, ticket: Ticket) -> bool:
        """Determine if a step needs human review after agent completion.

        Two-tier auto_approval resolution:
        - Tier 0: ticket.auto_approval ON → skip review (unless step overrides)
        - Tier 1: step.auto_approval overrides ticket-level
        - Default: needs review
        """
        # Tier 1: step-level override takes priority
        if step.auto_approval is not None:
            return not step.auto_approval

        # Tier 0: ticket-level
        if ticket.auto_approval:
            return False

        # Default: require review
        return True

    async def complete_step(self, step: WorkflowStep):
        """Mark step as completed (or review if post-approval needed)."""
        ticket = await self.db.get(Ticket, step.ticket_id)

        if ticket and await self.needs_post_approval(step, ticket):
            step.status = StepStatus.review
            await self.db.flush()
            await self._notify_step_change(
                step, ticket, "step_awaiting_review"
            )
            return []

        step.status = StepStatus.completed
        await self.db.flush()
        return await self.tick(step.ticket_id)

    async def handle_test_failure(
        self, step: WorkflowStep, error_context: str
    ) -> WorkflowStep:
        """Escalation chain for test failures.

        Tier 1 (retry_count < 1): Retry the tester with error context.
        Tier 2 (retry_count == 1): Auto-create a fix task for coder.
        Tier 3 (retry_count >= 2): Mark as FAILED.

        Note: Uses fixed tier thresholds (1, 2, 3+). The step.max_retries
        field is reserved for future configurable escalation depth.
        """
        step.retry_count += 1

        if step.retry_count == 1:
            # Tier 1: Tester retries with error context
            step.user_prompt_override = (
                f"Previous test run failed. Fix the test code "
                f"based on this error:\n\n"
                f"{error_context}\n\n"
                f"Analyze the failure, fix the issue, "
                f"and re-run the tests."
            )
            step.status = StepStatus.ready
            await self.db.flush()
            return step

        elif step.retry_count == 2:
            # Tier 2: Create a fix task for coder agent
            ticket = await self.db.get(Ticket, step.ticket_id)

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
                description=(
                    f"Auto-created fix task for test failure:"
                    f"\n{error_context}"
                ),
                agent_config_id=(
                    coder_config.id
                    if coder_config
                    else step.agent_config_id
                ),
                status=StepStatus.ready,
                order=step.order,
                parent_step_id=step.id,
                user_prompt_override=(
                    f"A test step failed with this error:\n\n"
                    f"{error_context}\n\n"
                    f"Fix the implementation code to make "
                    f"the tests pass."
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
                "A fix was applied for the previous failure. "
                "Re-run all tests to verify the fix resolved "
                "the issue."
            )
            await self.db.flush()

            return fix_step

        else:
            # Tier 3: Max retries exceeded — fail permanently
            step.status = StepStatus.failed
            await self.db.flush()
            ticket = await self.db.get(Ticket, step.ticket_id)
            if ticket:
                await self._notify_step_change(
                    step, ticket, "step_failed"
                )
            return step

    async def fail_step(self, step: WorkflowStep, error: str | None = None):
        """Mark step as failed."""
        step.status = StepStatus.failed
        await self.db.flush()
        ticket = await self.db.get(Ticket, step.ticket_id)
        if ticket:
            await self._notify_step_change(
                step, ticket, "step_failed"
            )

    async def skip_step(self, step: WorkflowStep):
        """Mark step as skipped and tick the DAG."""
        step.status = StepStatus.skipped
        await self.db.flush()
        return await self.tick(step.ticket_id)

    async def approve_step(self, step: WorkflowStep):
        """Approve an awaiting_approval step -> ready."""
        step.status = StepStatus.ready
        await self.db.flush()

    async def review_step(self, step: WorkflowStep):
        """Transition running step to review status."""
        step.status = StepStatus.review
        await self.db.flush()

    async def request_changes_step(self, step: WorkflowStep):
        """Transition review step to changes_requested."""
        step.status = StepStatus.changes_requested
        await self.db.flush()

    async def approve_review_step(self, step: WorkflowStep):
        """Approve review -> complete step -> tick DAG."""
        step.status = StepStatus.completed
        await self.db.flush()
        return await self.tick(step.ticket_id)

    async def auto_start_step(
        self,
        step: WorkflowStep,
        db_session_factory,
        websocket_manager=None,
    ) -> None:
        """Full agent execution lifecycle for an auto-started step."""
        from datetime import UTC, datetime

        from app.models.enums import SessionStatus
        from app.models.session import Session
        from app.services.agent_runner import AgentRunner
        from app.services.workspace_manager import WorkspaceManager

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

            custom_tools = build_spec_tools(
                ticket.id, db_session_factory
            )
        except ImportError:
            pass  # spec_tools not yet available

        # 3. Build agent options
        agent_config = None
        if step.agent_config_id:
            agent_config = await self.db.get(
                AgentConfig, step.agent_config_id
            )
        if not agent_config:
            await self.fail_step(
                step, error="No agent config assigned to step"
            )
            return

        runner = AgentRunner(self.db)
        options = await runner.build_agent_options(
            step, agent_config, cwd
        )

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
            prompt_suffix += (
                f"\n## Special Instructions\n"
                f"{step.user_prompt_override}\n"
            )
        options["system_prompt"] = (
            options.get("system_prompt", "") + prompt_suffix
        )

        # Build the user prompt
        user_prompt = (
            step.user_prompt_override
            or step.description
            or step.name
        )

        # 4. Create Session record
        branch_name = (
            f"agent/{ticket.key}/{step.template_step_id}"
        )
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
            from claude_code_sdk import ClaudeCodeOptions, query

            result_message = None
            total_cost = 0.0
            total_tokens = 0

            async for event in query(
                prompt=user_prompt,
                options=ClaudeCodeOptions(**options),
            ):
                # Relay events via WebSocket if available
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
            session.finished_at = datetime.now(UTC)
            session.status = SessionStatus.completed.value

            if result_message and hasattr(
                result_message, "exit_code"
            ):
                session.exit_code = result_message.exit_code

            await self.db.flush()

            # Determine success or failure
            is_test = self._is_test_step(step)
            exit_code = (
                getattr(result_message, "exit_code", 0)
                if result_message
                else 0
            )

            if exit_code != 0 and is_test:
                error_text = (
                    getattr(result_message, "error_message", "")
                    if result_message
                    else "Unknown test failure"
                )
                await self.handle_test_failure(
                    step, error_text or "Test execution failed"
                )
            elif exit_code != 0:
                await self.fail_step(
                    step,
                    error="Agent exited with non-zero code",
                )
            else:
                await self.complete_step(step)

        except Exception as e:
            session.status = SessionStatus.failed.value
            session.error_message = str(e)
            session.finished_at = datetime.now(UTC)
            await self.db.flush()
            await self.fail_step(step, error=str(e))

        # Cleanup session tracking
        runner.remove_session(step.id)

    async def _notify_step_change(
        self,
        step: WorkflowStep,
        ticket: Ticket,
        event_type: str,
    ) -> None:
        """Send notification for step status changes."""
        try:
            from app.services.notification import (
                NotificationService,
            )
        except ImportError:
            return

        if event_type == "step_awaiting_review":
            await NotificationService.create(
                self.db,
                user_id=ticket.created_by,
                type="step_awaiting_review",
                title=f"Step ready for review: {step.name}",
                body=(
                    f"Ticket {ticket.key}: {step.name} has "
                    f"completed and needs your review."
                ),
                resource_type="workflow_step",
                resource_id=step.id,
            )
        elif event_type == "step_failed":
            await NotificationService.create(
                self.db,
                user_id=ticket.created_by,
                type="step_failed",
                title=f"Step failed: {step.name}",
                body=(
                    f"Ticket {ticket.key}: {step.name} has "
                    f"failed after all retries."
                ),
                resource_type="workflow_step",
                resource_id=step.id,
            )
        elif event_type == "workflow_completed":
            await NotificationService.create(
                self.db,
                user_id=ticket.created_by,
                type="workflow_completed",
                title=f"Workflow completed: {ticket.key}",
                body=(
                    f"All steps for ticket {ticket.key} "
                    f"({ticket.title}) have completed."
                ),
                resource_type="ticket",
                resource_id=ticket.id,
            )

    def _is_test_step(self, step: WorkflowStep) -> bool:
        """Determine if this is a test/tester step."""
        test_indicators = {"test", "tester", "qa", "verify"}
        tokens = set(
            step.template_step_id.lower().split("-")
            + step.name.lower().split()
        )
        return bool(tokens & test_indicators)
