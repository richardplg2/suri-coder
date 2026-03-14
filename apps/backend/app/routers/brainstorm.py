import uuid

import redis.asyncio as aioredis
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.agent_config import AgentConfig
from app.models.enums import SpecType, TicketSource
from app.models.project import Project, ProjectMember
from app.models.session_event import SessionEvent
from app.models.user import User
from app.schemas.brainstorm import (
    BrainstormBatchUpdateRequest,
    BrainstormMessageRequest,
    BrainstormStartRequest,
    CreateTicketFromBrainstormRequest,
)
from app.schemas.ticket import TicketResponse
from app.services.auth import get_current_user
from app.services.project import require_project_member
from app.services.session_manager import SessionManager
from app.services.spec import SpecService
from app.services.ticket import create_ticket

router = APIRouter(tags=["brainstorm"])


async def get_redis(request: Request) -> aioredis.Redis:
    return request.app.state.redis


async def _get_brainstorm_agent_config(
    project_id: uuid.UUID, db: AsyncSession
) -> AgentConfig:
    """Find the brainstorm AgentConfig for this project (or global)."""
    result = await db.execute(
        select(AgentConfig).where(
            AgentConfig.agent_type == "brainstorm",
            AgentConfig.project_id == project_id,
        )
    )
    config = result.scalar_one_or_none()
    if config is None:
        # Fall back to global brainstorm config
        result = await db.execute(
            select(AgentConfig).where(
                AgentConfig.agent_type == "brainstorm",
                AgentConfig.project_id.is_(None),
            )
        )
        config = result.scalar_one_or_none()
    if config is None:
        raise HTTPException(
            status_code=500,
            detail="No brainstorm AgentConfig found. Run seeding.",
        )
    return config


@router.post(
    "/projects/{project_id}/brainstorm/start",
    status_code=status.HTTP_201_CREATED,
)
async def start_brainstorm(
    project_id: uuid.UUID,
    data: BrainstormStartRequest,
    background_tasks: BackgroundTasks,
    project_member: tuple[Project, ProjectMember] = Depends(require_project_member),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),
) -> dict:
    """Create and start a brainstorm session.

    Events stream via session:stream WebSocket.
    """
    from app.services.brainstorm_agent import build_initial_prompt

    agent_config = await _get_brainstorm_agent_config(project_id, db)
    manager = SessionManager(db=db, redis=redis)

    session = await manager.create_session(
        agent_config_id=agent_config.id,
        project_id=project_id,
    )
    await db.commit()

    prompt = build_initial_prompt(
        source=data.source,
        initial_message=data.initial_message,
        figma_data=data.figma_data,
    )
    background_tasks.add_task(manager.start_session, session.id, prompt)

    return {
        "session_id": str(session.id),
        "status": "starting",
        "ws_channel": "session:stream",
        "ws_ref": f"session:stream:{session.id}",
    }


@router.post(
    "/projects/{project_id}/brainstorm/{session_id}/message",
)
async def send_brainstorm_message(
    project_id: uuid.UUID,
    session_id: uuid.UUID,
    data: BrainstormMessageRequest,
    background_tasks: BackgroundTasks,
    project_member: tuple[Project, ProjectMember] = Depends(require_project_member),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),
) -> dict:
    manager = SessionManager(db=db, redis=redis)

    # Format quiz response if provided
    if data.quiz_response:
        labels = (
            data.quiz_response.get("option_labels", [])
            or data.quiz_response.get("option_ids", [])
        )
        custom = data.quiz_response.get("custom_text", "")
        content = f"Selected: {', '.join(labels)}"
        if custom:
            content += f". {custom}"
    else:
        content = data.content or ""

    background_tasks.add_task(manager.send_message, session_id, content)
    return {"status": "sent", "session_id": str(session_id)}


@router.post(
    "/projects/{project_id}/brainstorm/{session_id}/complete",
)
async def complete_brainstorm(
    project_id: uuid.UUID,
    session_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    project_member: tuple[Project, ProjectMember] = Depends(require_project_member),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),
) -> dict:
    """Request final summary generation."""
    manager = SessionManager(db=db, redis=redis)
    summary_prompt = (
        "Please generate the final summary now. "
        "Output as message_type: summary with the full content."
    )
    background_tasks.add_task(manager.send_message, session_id, summary_prompt)
    return {"status": "generating_summary", "session_id": str(session_id)}


@router.post(
    "/projects/{project_id}/brainstorm/{session_id}/batch-update",
)
async def batch_update_brainstorm(
    project_id: uuid.UUID,
    session_id: uuid.UUID,
    data: BrainstormBatchUpdateRequest,
    background_tasks: BackgroundTasks,
    project_member: tuple[Project, ProjectMember] = Depends(require_project_member),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),
) -> dict:
    manager = SessionManager(db=db, redis=redis)
    formatted = "\n".join(
        f"- [{c.get('section_id', 'general')}]: {c.get('text', '')}"
        for c in data.comments
    )
    prompt = f"Please update the summary based on these comments:\n{formatted}"
    background_tasks.add_task(manager.send_message, session_id, prompt)
    return {"status": "updating", "session_id": str(session_id)}


@router.post(
    "/projects/{project_id}/brainstorm/{session_id}/create-ticket",
    response_model=TicketResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_ticket_from_brainstorm(
    project_id: uuid.UUID,
    session_id: uuid.UUID,
    data: CreateTicketFromBrainstormRequest,
    project_member: tuple[Project, ProjectMember] = Depends(require_project_member),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),
) -> TicketResponse:
    """Create a ticket from the latest summary event in this brainstorm session."""
    from app.schemas.ticket import TicketCreate

    # Find the latest summary event for this session
    result = await db.execute(
        select(SessionEvent)
        .where(
            SessionEvent.session_id == session_id,
            SessionEvent.event_type == "structured_output",
        )
        .order_by(SessionEvent.sequence.desc())
        .limit(10)
    )
    events = list(result.scalars().all())
    summary_event = next(
        (e for e in events if e.content.get("schema_type") == "summary"),
        None,
    )
    if summary_event is None:
        raise HTTPException(
            status_code=400, detail="No summary found for this session"
        )

    summary_content = summary_event.content.get("data", {}).get("content", "")

    ticket_data = TicketCreate(
        title=data.title,
        description=summary_content,
        type=data.type,
        priority=data.priority,
        template_id=data.template_id,
        source=TicketSource.ai_brainstorm,
    )
    ticket = await create_ticket(db, project_id, ticket_data, user.id)

    await SpecService.create_spec(
        db=db,
        ticket_id=ticket.id,
        type=SpecType.feature,
        title=data.title,
        content=summary_content,
        created_by=user.id,
    )

    await db.commit()
    return TicketResponse.model_validate(ticket)
