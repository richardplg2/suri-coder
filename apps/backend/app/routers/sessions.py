import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.session import Session
from app.models.user import User
from app.schemas.session import SessionDetailResponse, SessionResponse
from app.services.auth import get_current_user

router = APIRouter(tags=["sessions"])


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
    session.finished_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(session)
    return SessionResponse.model_validate(session)
