import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.enums import StepStatus, TicketPriority, TicketStatus, TicketType
from app.models.project import Project, ProjectMember
from app.models.user import User
from app.models.workflow_step import WorkflowStep
from app.schemas.ticket import (
    TicketCreate,
    TicketListResponse,
    TicketResponse,
    TicketUpdate,
)
from app.services.auth import get_current_user
from app.services.project import require_project_member
from app.services.ticket import (
    create_ticket,
    delete_ticket,
    get_project_tickets,
    get_ticket,
    update_ticket,
)
from app.services.workflow_engine import WorkflowEngine

router = APIRouter(tags=["tickets"])


@router.get(
    "/projects/{project_id}/tickets",
    response_model=list[TicketListResponse],
)
async def list_tickets(
    project_member: tuple[Project, ProjectMember] = Depends(
        require_project_member
    ),
    status_filter: TicketStatus | None = None,
    type: TicketType | None = None,
    priority: TicketPriority | None = None,
    assignee_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[TicketListResponse]:
    project, _ = project_member
    tickets = await get_project_tickets(
        db,
        project.id,
        status=status_filter,
        type=type,
        priority=priority,
        assignee_id=assignee_id,
    )
    return [TicketListResponse.model_validate(t) for t in tickets]


@router.post(
    "/projects/{project_id}/tickets",
    response_model=TicketResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_ticket_endpoint(
    data: TicketCreate,
    project_member: tuple[Project, ProjectMember] = Depends(
        require_project_member
    ),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TicketResponse:
    project, _ = project_member
    ticket = await create_ticket(db, project.id, data, user.id)
    return TicketResponse.model_validate(ticket)


@router.get("/tickets/{ticket_id}", response_model=TicketResponse)
async def get_ticket_detail(
    ticket_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TicketResponse:
    ticket = await get_ticket(db, ticket_id)
    if ticket is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found",
        )
    return TicketResponse.model_validate(ticket)


@router.patch("/tickets/{ticket_id}", response_model=TicketResponse)
async def update_ticket_endpoint(
    ticket_id: uuid.UUID,
    data: TicketUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TicketResponse:
    ticket = await get_ticket(db, ticket_id)
    if ticket is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found",
        )
    updated = await update_ticket(db, ticket, data)
    return TicketResponse.model_validate(updated)


@router.delete(
    "/tickets/{ticket_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_ticket_endpoint(
    ticket_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    ticket = await get_ticket(db, ticket_id)
    if ticket is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found",
        )
    await delete_ticket(db, ticket)


@router.post(
    "/tickets/{ticket_id}/start",
    response_model=TicketResponse,
)
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

    if ticket.status not in (
        TicketStatus.backlog,
        TicketStatus.todo,
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Ticket cannot be started from status "
                f"'{ticket.status.value}'"
            ),
        )

    engine = WorkflowEngine(db)

    # Create Plan Writer step if no steps exist
    if not ticket.steps:
        plan_step = WorkflowStep(
            id=uuid.uuid4(),
            ticket_id=ticket.id,
            template_step_id="plan-writer",
            name="Plan Writer",
            description=(
                "Generate implementation plan from ticket spec"
            ),
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


async def _run_step_in_background(
    ticket_id: uuid.UUID,
    step_id: uuid.UUID,
) -> None:
    """Background task to run a step via the workflow engine."""
    from app.database import async_session

    async with async_session() as db:
        step = await db.get(WorkflowStep, step_id)
        if not step or step.status != StepStatus.ready:
            return

        engine = WorkflowEngine(db)
        await engine.auto_start_step(
            step=step,
            db_session_factory=async_session,
        )
        await db.commit()
