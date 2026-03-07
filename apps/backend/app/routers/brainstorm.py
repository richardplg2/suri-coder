import uuid

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.project import Project, ProjectMember
from app.models.user import User
from app.schemas.brainstorm import (
    BrainstormBatchUpdateRequest,
    BrainstormMessageRequest,
    BrainstormMessageResponse,
    BrainstormSessionResponse,
    BrainstormStartRequest,
    CreateTicketFromBrainstormRequest,
)
from app.schemas.ticket import TicketResponse
from app.services.auth import get_current_user
from app.services.brainstorm_service import BrainstormService
from app.services.project import require_project_member

router = APIRouter(tags=["brainstorm"])


async def get_redis(request: Request) -> aioredis.Redis:
    return request.app.state.redis


@router.post(
    "/projects/{project_id}/brainstorm/start",
    response_model=BrainstormSessionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def start_brainstorm(
    data: BrainstormStartRequest,
    project_member: tuple[Project, ProjectMember] = Depends(
        require_project_member
    ),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),
) -> BrainstormSessionResponse:
    project, _ = project_member
    service = BrainstormService(db, redis)
    result = await service.start_session(
        project_id=project.id,
        source=data.source,
        initial_message=data.initial_message,
        figma_data=data.figma_data,
        user_id=user.id,
    )
    return BrainstormSessionResponse(**result)


@router.post(
    "/projects/{project_id}/brainstorm/{session_id}/message",
    response_model=BrainstormMessageResponse,
)
async def send_brainstorm_message(
    session_id: str,
    data: BrainstormMessageRequest,
    project_member: tuple[Project, ProjectMember] = Depends(
        require_project_member
    ),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),
) -> BrainstormMessageResponse:
    service = BrainstormService(db, redis)
    return await service.send_message(
        session_id=session_id,
        content=data.content,
        quiz_response=data.quiz_response,
    )


@router.post(
    "/projects/{project_id}/brainstorm/{session_id}/complete",
)
async def complete_brainstorm(
    session_id: str,
    project_member: tuple[Project, ProjectMember] = Depends(
        require_project_member
    ),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),
) -> dict:
    service = BrainstormService(db, redis)
    return await service.complete_session(session_id)


@router.post(
    "/projects/{project_id}/brainstorm"
    "/{session_id}/batch-update",
)
async def batch_update_brainstorm(
    session_id: str,
    data: BrainstormBatchUpdateRequest,
    project_member: tuple[Project, ProjectMember] = Depends(
        require_project_member
    ),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),
) -> dict:
    service = BrainstormService(db, redis)
    return await service.batch_update(
        session_id=session_id,
        comments=data.comments,
    )


@router.post(
    "/projects/{project_id}/brainstorm"
    "/{session_id}/create-ticket",
    response_model=TicketResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_ticket_from_brainstorm(
    project_id: uuid.UUID,
    session_id: str,
    data: CreateTicketFromBrainstormRequest,
    project_member: tuple[Project, ProjectMember] = Depends(
        require_project_member
    ),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),
) -> TicketResponse:
    service = BrainstormService(db, redis)
    ticket = await service.create_ticket_from_brainstorm(
        session_id=session_id,
        title=data.title,
        type=data.type,
        priority=data.priority,
        template_id=data.template_id,
        user_id=user.id,
        project_id=project_id,
    )
    return TicketResponse.model_validate(ticket)
