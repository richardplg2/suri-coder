import uuid
from datetime import UTC, datetime

import redis.asyncio as aioredis
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.session import Session
from app.models.session_event import SessionEvent
from app.models.user import User
from app.schemas.session import (
    CreateSessionRequest,
    SendMessageRequest,
    SessionDetailResponse,
    SessionEventResponse,
    SessionResponse,
    StartSessionRequest,
    UnifiedSessionResponse,
)
from app.services.auth import get_current_user
from app.services.project import require_project_member
from app.services.session_manager import SessionManager

router = APIRouter(tags=["sessions"])


async def get_redis(request: Request) -> aioredis.Redis:
    return request.app.state.redis


@router.get(
    "/steps/{step_id}/sessions", response_model=list[SessionResponse]
)
async def list_sessions_for_step(
    step_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[SessionResponse]:
    result = await db.execute(
        select(Session)
        .where(Session.step_id == step_id)
        .order_by(Session.started_at.desc())
    )
    sessions = result.scalars().all()
    return [SessionResponse.model_validate(s) for s in sessions]


@router.get("/sessions/{session_id}", response_model=SessionDetailResponse)
async def get_session(
    session_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SessionDetailResponse:
    result = await db.execute(
        select(Session)
        .where(Session.id == session_id)
        .options(selectinload(Session.messages))
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Session not found"
        )
    return SessionDetailResponse.model_validate(session)


@router.post("/sessions/{session_id}/cancel", response_model=SessionResponse)
async def cancel_session(
    session_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SessionResponse:
    session = await db.get(Session, session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Session not found"
        )
    session.status = "cancelled"
    session.finished_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(session)
    return SessionResponse.model_validate(session)


@router.post(
    "/projects/{project_id}/sessions",
    response_model=UnifiedSessionResponse,
    status_code=201,
)
async def create_unified_session(
    project_id: uuid.UUID,
    data: CreateSessionRequest,
    project_member: tuple = Depends(require_project_member),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),
) -> UnifiedSessionResponse:
    manager = SessionManager(db=db, redis=redis)
    session = await manager.create_session(
        agent_config_id=data.agent_config_id,
        project_id=project_id,
        ticket_id=data.ticket_id,
        workflow_step_id=data.workflow_step_id,
    )
    await db.commit()
    return UnifiedSessionResponse.model_validate(session)


@router.post("/sessions/{session_id}/start", status_code=202)
async def start_unified_session(
    session_id: uuid.UUID,
    data: StartSessionRequest,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),
) -> dict:
    """Start session execution. Events stream via WebSocket session:stream channel."""
    manager = SessionManager(db=db, redis=redis)
    background_tasks.add_task(manager.start_session, session_id, data.prompt)
    return {"status": "starting", "session_id": str(session_id)}


@router.post("/sessions/{session_id}/message", status_code=202)
async def send_session_message(
    session_id: uuid.UUID,
    data: SendMessageRequest,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),
) -> dict:
    manager = SessionManager(db=db, redis=redis)
    background_tasks.add_task(manager.send_message, session_id, data.content)
    return {"status": "sent", "session_id": str(session_id)}


@router.post("/sessions/{session_id}/resume", response_model=UnifiedSessionResponse)
async def resume_unified_session(
    session_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),
) -> UnifiedSessionResponse:
    manager = SessionManager(db=db, redis=redis)
    session = await manager.resume_session(session_id)
    await db.commit()
    return UnifiedSessionResponse.model_validate(session)


@router.get(
    "/projects/{project_id}/sessions",
    response_model=list[UnifiedSessionResponse],
)
async def list_project_sessions(
    project_id: uuid.UUID,
    project_member: tuple = Depends(require_project_member),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[UnifiedSessionResponse]:
    result = await db.execute(
        select(Session)
        .where(Session.project_id == project_id)
        .order_by(Session.started_at.desc())
    )
    sessions = list(result.scalars().all())
    return [UnifiedSessionResponse.model_validate(s) for s in sessions]


@router.get(
    "/projects/{project_id}/sessions/active",
    response_model=list[UnifiedSessionResponse],
)
async def list_active_sessions(
    project_id: uuid.UUID,
    project_member: tuple = Depends(require_project_member),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),
) -> list[UnifiedSessionResponse]:
    manager = SessionManager(db=db, redis=redis)
    sessions = await manager.get_active_sessions(project_id)
    return [UnifiedSessionResponse.model_validate(s) for s in sessions]


@router.get(
    "/sessions/{session_id}/events",
    response_model=list[SessionEventResponse],
)
async def list_session_events(
    session_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[SessionEventResponse]:
    result = await db.execute(
        select(SessionEvent)
        .where(SessionEvent.session_id == session_id)
        .order_by(SessionEvent.sequence)
    )
    events = list(result.scalars().all())
    return [SessionEventResponse.model_validate(e) for e in events]
