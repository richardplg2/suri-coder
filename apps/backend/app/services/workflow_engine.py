import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.enums import StepStatus, TicketStatus
from app.models.ticket import Ticket
from app.models.workflow_step import WorkflowStep


class WorkflowEngine:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def tick(self, ticket_id: uuid.UUID) -> list[WorkflowStep]:
        """Advance the DAG. Returns list of steps that became ready."""
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
                step.status = StepStatus.ready
                newly_ready.append(step)

        # Auto-complete ticket if all steps done
        all_done = all(
            s.status in (StepStatus.completed, StepStatus.skipped) for s in steps
        )
        if all_done and steps:
            ticket = await self.db.get(Ticket, ticket_id)
            if ticket and ticket.status != TicketStatus.done:
                ticket.status = TicketStatus.done

        await self.db.flush()
        return newly_ready

    async def start_step(self, step: WorkflowStep):
        """Mark step as running and update ticket status."""
        step.status = StepStatus.running

        # Auto-progress ticket
        ticket = await self.db.get(Ticket, step.ticket_id)
        if ticket and ticket.status in (TicketStatus.backlog, TicketStatus.todo):
            ticket.status = TicketStatus.in_progress

        await self.db.flush()

    async def complete_step(self, step: WorkflowStep):
        """Mark step as completed and tick the DAG."""
        step.status = StepStatus.completed
        await self.db.flush()
        return await self.tick(step.ticket_id)

    async def fail_step(self, step: WorkflowStep, error: str | None = None):
        """Mark step as failed."""
        step.status = StepStatus.failed
        await self.db.flush()

    async def skip_step(self, step: WorkflowStep):
        """Mark step as skipped and tick the DAG."""
        step.status = StepStatus.skipped
        await self.db.flush()
        return await self.tick(step.ticket_id)
