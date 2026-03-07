from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ticket import Ticket
from app.models.workflow_step import WorkflowStep
from app.models.workflow_template import WorkflowTemplate


class BrainstormService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_brainstorm_schema(self, step: WorkflowStep) -> dict | None:
        """Get brainstorm schema from template step config."""
        ticket = await self.db.get(Ticket, step.ticket_id)
        if not ticket or not ticket.template_id:
            return None

        template = await self.db.get(WorkflowTemplate, ticket.template_id)
        if not template or not template.steps_config:
            return None

        for tmpl_step in template.steps_config.get("steps", []):
            if tmpl_step["id"] == step.template_step_id:
                return tmpl_step.get("brainstorm_schema")

        return None

    async def is_brainstorm_step(self, step: WorkflowStep) -> bool:
        """Check if this step has a brainstorm schema."""
        schema = await self.get_brainstorm_schema(step)
        return schema is not None

    async def save_brainstorm_output(
        self, step: WorkflowStep, output: dict
    ) -> None:
        """Save structured brainstorm output to step."""
        step.brainstorm_output = output
        await self.db.flush()

    async def get_downstream_steps(
        self, step: WorkflowStep
    ) -> list[WorkflowStep]:
        """Get all steps in the same ticket that are not this step."""
        result = await self.db.execute(
            select(WorkflowStep).where(
                WorkflowStep.ticket_id == step.ticket_id,
                WorkflowStep.id != step.id,
            )
        )
        return list(result.scalars().all())

    async def save_step_breakdowns(
        self, brainstorm_step: WorkflowStep, breakdowns: dict[str, dict]
    ) -> None:
        """Save per-step breakdown to each downstream step."""
        downstream = await self.get_downstream_steps(brainstorm_step)
        for ds_step in downstream:
            if ds_step.name in breakdowns:
                ds_step.step_breakdown = breakdowns[ds_step.name]
        await self.db.flush()
