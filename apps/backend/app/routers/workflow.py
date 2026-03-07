import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.enums import StepStatus
from app.models.session import Session
from app.models.ticket import Ticket
from app.models.user import User
from app.models.workflow_step import WorkflowStep
from app.schemas.session import SessionResponse
from app.schemas.step_review import RegenerateRequest, RequestChangesRequest, StepReviewResponse
from app.services.auth import get_current_user
from app.services.step_review import StepReviewService
from app.services.workflow_engine import WorkflowEngine

router = APIRouter(tags=["workflow"])


async def _get_ticket_or_404(
    db: AsyncSession, ticket_id: uuid.UUID
) -> Ticket:
    ticket = await db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found"
        )
    return ticket


async def _get_step_or_404(
    db: AsyncSession, step_id: uuid.UUID, ticket_id: uuid.UUID
) -> WorkflowStep:
    result = await db.execute(
        select(WorkflowStep).where(
            WorkflowStep.id == step_id,
            WorkflowStep.ticket_id == ticket_id,
        )
    )
    step = result.scalar_one_or_none()
    if not step:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Step not found"
        )
    return step


def _create_session(step: WorkflowStep, ticket: Ticket) -> Session:
    return Session(
        step_id=step.id,
        status="running",
        git_branch=f"{ticket.key}/{step.name}",
    )


@router.post(
    "/tickets/{ticket_id}/run", response_model=list[SessionResponse]
)
async def run_ticket_workflow(
    ticket_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[SessionResponse]:
    ticket = await _get_ticket_or_404(db, ticket_id)
    engine = WorkflowEngine(db)

    # Find all ready steps
    result = await db.execute(
        select(WorkflowStep).where(
            WorkflowStep.ticket_id == ticket_id,
            WorkflowStep.status == StepStatus.ready,
        )
    )
    ready_steps = list(result.scalars().all())

    sessions: list[Session] = []
    for step in ready_steps:
        session = _create_session(step, ticket)
        db.add(session)
        await engine.start_step(step)
        sessions.append(session)

    await db.commit()
    for s in sessions:
        await db.refresh(s)
    return [SessionResponse.model_validate(s) for s in sessions]


@router.post(
    "/tickets/{ticket_id}/steps/{step_id}/run",
    response_model=SessionResponse,
)
async def run_step(
    ticket_id: uuid.UUID,
    step_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SessionResponse:
    ticket = await _get_ticket_or_404(db, ticket_id)
    step = await _get_step_or_404(db, step_id, ticket_id)

    if step.status != StepStatus.ready:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Step is not ready (current status: {step.status.value})",
        )

    engine = WorkflowEngine(db)
    session = _create_session(step, ticket)
    db.add(session)
    await engine.start_step(step)
    await db.commit()
    await db.refresh(session)
    return SessionResponse.model_validate(session)


@router.post(
    "/tickets/{ticket_id}/steps/{step_id}/retry",
    response_model=SessionResponse,
)
async def retry_step(
    ticket_id: uuid.UUID,
    step_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SessionResponse:
    ticket = await _get_ticket_or_404(db, ticket_id)
    step = await _get_step_or_404(db, step_id, ticket_id)

    if step.status != StepStatus.failed:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Step is not failed (current status: {step.status.value})",
        )

    step.status = StepStatus.ready
    session = _create_session(step, ticket)
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return SessionResponse.model_validate(session)


@router.post(
    "/tickets/{ticket_id}/steps/{step_id}/skip",
    status_code=status.HTTP_200_OK,
)
async def skip_step(
    ticket_id: uuid.UUID,
    step_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    await _get_ticket_or_404(db, ticket_id)
    step = await _get_step_or_404(db, step_id, ticket_id)

    engine = WorkflowEngine(db)
    newly_ready = await engine.skip_step(step)
    await db.commit()
    return {
        "detail": "Step skipped",
        "newly_ready_steps": [str(s.id) for s in newly_ready],
    }


@router.post(
    "/tickets/{ticket_id}/steps/{step_id}/approve",
    status_code=status.HTTP_200_OK,
)
async def approve_step(
    ticket_id: uuid.UUID,
    step_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    await _get_ticket_or_404(db, ticket_id)
    step = await _get_step_or_404(db, step_id, ticket_id)

    if step.status != StepStatus.awaiting_approval:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Step is not awaiting approval (status: {step.status.value})",
        )

    engine = WorkflowEngine(db)
    await engine.approve_step(step)
    await db.commit()
    return {"detail": "Step approved", "step_id": str(step.id)}


class PromptOverrideRequest(BaseModel):
    user_prompt_override: str | None


@router.patch(
    "/tickets/{ticket_id}/steps/{step_id}/prompt",
    status_code=status.HTTP_200_OK,
)
async def update_step_prompt(
    ticket_id: uuid.UUID,
    step_id: uuid.UUID,
    data: PromptOverrideRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    await _get_ticket_or_404(db, ticket_id)
    step = await _get_step_or_404(db, step_id, ticket_id)

    step.user_prompt_override = data.user_prompt_override
    await db.commit()
    return {
        "step_id": str(step.id),
        "user_prompt_override": step.user_prompt_override,
    }


@router.post(
    "/tickets/{ticket_id}/steps/{step_id}/approve-review",
    status_code=status.HTTP_200_OK,
)
async def approve_review(
    ticket_id: uuid.UUID,
    step_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    await _get_ticket_or_404(db, ticket_id)
    step = await _get_step_or_404(db, step_id, ticket_id)

    if step.status != StepStatus.review:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Step is not in review"
                f" (status: {step.status.value})"
            ),
        )

    # Update review record status
    review_service = StepReviewService(db)
    review = await review_service.get_latest_review(step.id)
    if review:
        await review_service.approve_review(review.id)

    engine = WorkflowEngine(db)
    newly_ready = await engine.approve_review_step(step)
    await db.commit()
    return {
        "detail": "Review approved",
        "step_id": str(step.id),
        "newly_ready_steps": [str(s.id) for s in newly_ready],
    }


@router.post(
    "/tickets/{ticket_id}/steps/{step_id}/request-changes",
    status_code=status.HTTP_200_OK,
)
async def request_changes(
    ticket_id: uuid.UUID,
    step_id: uuid.UUID,
    data: RequestChangesRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    await _get_ticket_or_404(db, ticket_id)
    step = await _get_step_or_404(db, step_id, ticket_id)

    if step.status != StepStatus.review:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Step is not in review"
                f" (status: {step.status.value})"
            ),
        )

    review_service = StepReviewService(db)
    review = await review_service.get_latest_review(step.id)
    if not review:
        review = await review_service.create_review(step.id)
    await review_service.request_changes(review.id, data.comments)

    engine = WorkflowEngine(db)
    await engine.request_changes_step(step)
    await db.commit()
    return {"detail": "Changes requested", "step_id": str(step.id)}


@router.get(
    "/tickets/{ticket_id}/steps/{step_id}/reviews",
    response_model=list[StepReviewResponse],
)
async def get_step_reviews(
    ticket_id: uuid.UUID,
    step_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[StepReviewResponse]:
    await _get_ticket_or_404(db, ticket_id)
    await _get_step_or_404(db, step_id, ticket_id)

    review_service = StepReviewService(db)
    reviews = await review_service.get_reviews(step_id)
    return [StepReviewResponse.model_validate(r) for r in reviews]


@router.post(
    "/tickets/{ticket_id}/steps/{step_id}/regenerate",
    status_code=status.HTTP_200_OK,
)
async def regenerate_brainstorm(
    ticket_id: uuid.UUID,
    step_id: uuid.UUID,
    data: RegenerateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    await _get_ticket_or_404(db, ticket_id)
    step = await _get_step_or_404(db, step_id, ticket_id)

    if step.status != StepStatus.review:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Step is not in review (current status: {step.status.value})",
        )

    # Transition back to running for regeneration
    step.status = StepStatus.running
    await db.commit()

    # Note: actual SDK follow-up happens in agent_runner (feature 05)
    return {
        "detail": "Regeneration started",
        "step_id": str(step.id),
        "section_comments": data.section_comments,
    }
