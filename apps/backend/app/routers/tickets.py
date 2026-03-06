import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.enums import TicketPriority, TicketStatus, TicketType
from app.models.project import Project, ProjectMember
from app.models.user import User
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
