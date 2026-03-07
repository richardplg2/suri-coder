import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.ticket_spec import (
    SpecCreate,
    SpecDetailResponse,
    SpecResponse,
    SpecUpdate,
)
from app.services.auth import get_current_user
from app.services.spec import SpecService
from app.services.ticket import get_ticket

router = APIRouter(tags=["specs"])


@router.get(
    "/tickets/{ticket_id}/specs",
    response_model=list[SpecResponse],
)
async def list_specs(
    ticket_id: uuid.UUID,
    type: str | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[SpecResponse]:
    ticket = await get_ticket(db, ticket_id)
    if ticket is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found",
        )
    specs = await SpecService.get_specs(db, ticket_id, type=type)
    return [SpecResponse.model_validate(s) for s in specs]


@router.get(
    "/tickets/{ticket_id}/specs/{spec_id}",
    response_model=SpecDetailResponse,
)
async def get_spec_detail(
    ticket_id: uuid.UUID,
    spec_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SpecDetailResponse:
    ticket = await get_ticket(db, ticket_id)
    if ticket is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found",
        )
    spec = await SpecService.get_spec(db, spec_id)
    if spec is None or spec.ticket_id != ticket_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Spec not found",
        )
    return SpecDetailResponse.model_validate(spec)


@router.get(
    "/tickets/{ticket_id}/specs/{spec_id}/history",
    response_model=list[SpecResponse],
)
async def get_spec_history(
    ticket_id: uuid.UUID,
    spec_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[SpecResponse]:
    ticket = await get_ticket(db, ticket_id)
    if ticket is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found",
        )
    spec = await SpecService.get_spec(db, spec_id)
    if spec is None or spec.ticket_id != ticket_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Spec not found",
        )
    history = await SpecService.get_spec_history(db, spec_id)
    return [SpecResponse.model_validate(s) for s in history]


@router.post(
    "/tickets/{ticket_id}/specs",
    response_model=SpecResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_spec(
    ticket_id: uuid.UUID,
    data: SpecCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SpecResponse:
    ticket = await get_ticket(db, ticket_id)
    if ticket is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found",
        )
    references = None
    if data.references:
        references = [
            {
                "target_spec_id": ref.target_spec_id,
                "ref_type": ref.ref_type,
                "section": ref.section,
            }
            for ref in data.references
        ]
    spec = await SpecService.create_spec(
        db,
        ticket_id=ticket_id,
        type=data.type,
        title=data.title,
        content=data.content,
        created_by=user.id,
        references=references,
    )
    return SpecResponse.model_validate(spec)


@router.put(
    "/tickets/{ticket_id}/specs/{spec_id}",
    response_model=SpecResponse,
)
async def update_spec(
    ticket_id: uuid.UUID,
    spec_id: uuid.UUID,
    data: SpecUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SpecResponse:
    ticket = await get_ticket(db, ticket_id)
    if ticket is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found",
        )
    existing = await SpecService.get_spec(db, spec_id)
    if existing is None or existing.ticket_id != ticket_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Spec not found",
        )
    new_spec = await SpecService.update_spec(
        db,
        spec_id=spec_id,
        content=data.content,
        title=data.title,
    )
    return SpecResponse.model_validate(new_spec)
