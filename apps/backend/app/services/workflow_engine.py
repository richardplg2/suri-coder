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
        Tier 3 (retry_count >= max_retries): Mark as FAILED.
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
            return step

    async def fail_step(self, step: WorkflowStep, error: str | None = None):
        """Mark step as failed."""
        step.status = StepStatus.failed
        await self.db.flush()

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
