import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy.sql import func

from app.models.agent_config import AgentConfig
from app.models.enums import StepStatus
from app.models.project import Project
from app.models.ticket import Ticket
from app.models.workflow_step import WorkflowStep, WorkflowStepDependency
from app.models.workflow_template import WorkflowTemplate
from app.schemas.ticket import TicketCreate, TicketUpdate


async def create_ticket(
    db: AsyncSession,
    project_id: uuid.UUID,
    data: TicketCreate,
    user_id: uuid.UUID,
) -> Ticket:
    # Load project to get slug
    result = await db.execute(
        select(Project).where(Project.id == project_id)
    )
    project = result.scalar_one()

    # Auto-generate key
    count_result = await db.execute(
        select(func.count()).select_from(Ticket).where(
            Ticket.project_id == project_id
        )
    )
    seq = count_result.scalar_one() + 1
    key = f"{project.slug.upper()}-{seq}"

    ticket = Ticket(
        project_id=project_id,
        key=key,
        title=data.title,
        description=data.description,
        type=data.type,
        priority=data.priority,
        template_id=data.template_id,
        assignee_id=data.assignee_id,
        budget_usd=data.budget_usd,
        created_by=user_id,
    )
    db.add(ticket)
    await db.flush()

    # If template is set, instantiate workflow steps
    if data.template_id:
        tmpl_result = await db.execute(
            select(WorkflowTemplate).where(
                WorkflowTemplate.id == data.template_id
            )
        )
        template = tmpl_result.scalar_one_or_none()

        if template and template.steps_config:
            steps_def = template.steps_config.get("steps", [])
            step_map: dict[str, WorkflowStep] = {}

            for idx, step_def in enumerate(steps_def):
                # Look up agent config by name for this project (or global)
                agent_config_id = None
                agent_name = step_def.get("agent")
                if agent_name:
                    agent_result = await db.execute(
                        select(AgentConfig).where(
                            AgentConfig.name == agent_name,
                            (
                                (AgentConfig.project_id == project_id)
                                | (AgentConfig.project_id.is_(None))
                            ),
                        )
                    )
                    agent_config = agent_result.scalar_one_or_none()
                    if agent_config:
                        agent_config_id = agent_config.id

                step = WorkflowStep(
                    ticket_id=ticket.id,
                    template_step_id=step_def["id"],
                    name=step_def["id"],
                    description=step_def.get("description"),
                    agent_config_id=agent_config_id,
                    order=idx,
                )
                db.add(step)
                await db.flush()
                step_map[step_def["id"]] = step

            # Create dependency records
            for step_def in steps_def:
                depends_on = step_def.get("depends_on", [])
                step = step_map[step_def["id"]]
                for dep_id in depends_on:
                    if dep_id in step_map:
                        dep = WorkflowStepDependency(
                            step_id=step.id,
                            depends_on_id=step_map[dep_id].id,
                        )
                        db.add(dep)

            # Set initial statuses
            for step_def in steps_def:
                step = step_map[step_def["id"]]
                depends_on = step_def.get("depends_on", [])
                if not depends_on:
                    step.status = StepStatus.ready
                else:
                    step.status = StepStatus.pending

    await db.commit()

    # Reload with steps
    return await get_ticket(db, ticket.id)  # type: ignore[return-value]


async def get_ticket(
    db: AsyncSession, ticket_id: uuid.UUID
) -> Ticket | None:
    stmt = (
        select(Ticket)
        .where(Ticket.id == ticket_id)
        .options(
            selectinload(Ticket.steps).selectinload(
                WorkflowStep.dependencies
            )
        )
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def get_project_tickets(
    db: AsyncSession,
    project_id: uuid.UUID,
    status: str | None = None,
    type: str | None = None,
    priority: str | None = None,
    assignee_id: uuid.UUID | None = None,
) -> list[Ticket]:
    stmt = select(Ticket).where(Ticket.project_id == project_id)

    if status is not None:
        stmt = stmt.where(Ticket.status == status)
    if type is not None:
        stmt = stmt.where(Ticket.type == type)
    if priority is not None:
        stmt = stmt.where(Ticket.priority == priority)
    if assignee_id is not None:
        stmt = stmt.where(Ticket.assignee_id == assignee_id)

    stmt = stmt.order_by(Ticket.created_at.desc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def update_ticket(
    db: AsyncSession, ticket: Ticket, data: TicketUpdate
) -> Ticket:
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(ticket, key, value)
    await db.commit()
    await db.refresh(ticket)
    return ticket


async def delete_ticket(db: AsyncSession, ticket: Ticket) -> None:
    await db.delete(ticket)
    await db.commit()
