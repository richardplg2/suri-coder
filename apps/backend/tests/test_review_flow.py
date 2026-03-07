import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import (
    ReviewStatus,
    StepStatus,
    TicketPriority,
    TicketStatus,
    TicketType,
    UserRole,
)
from app.models.project import Project
from app.models.ticket import Ticket
from app.models.user import User
from app.models.workflow_step import WorkflowStep
from app.services.step_review import StepReviewService
from app.services.workflow_engine import WorkflowEngine
from tests.conftest import auth_headers


async def _setup_review_data(db: AsyncSession) -> dict:
    user = User(
        id=uuid.uuid4(),
        email=f"test-{uuid.uuid4().hex[:8]}@example.com",
        name="Test",
        role=UserRole.admin,
        hashed_password="fake",
    )
    db.add(user)
    await db.flush()

    project = Project(
        id=uuid.uuid4(),
        name="Test",
        slug=f"test-{uuid.uuid4().hex[:8]}",
        path="/tmp/test",
        created_by=user.id,
    )
    db.add(project)
    await db.flush()

    ticket = Ticket(
        id=uuid.uuid4(),
        project_id=project.id,
        key=f"TEST-{uuid.uuid4().hex[:6].upper()}",
        title="Test Ticket",
        type=TicketType.feature,
        status=TicketStatus.in_progress,
        priority=TicketPriority.medium,
        created_by=user.id,
    )
    db.add(ticket)
    await db.flush()

    step = WorkflowStep(
        id=uuid.uuid4(),
        ticket_id=ticket.id,
        template_step_id="code",
        name="code",
        status=StepStatus.review,
        order=0,
    )
    db.add(step)
    await db.flush()
    await db.commit()

    return {
        "user": user,
        "project": project,
        "ticket": ticket,
        "step": step,
    }


@pytest.mark.asyncio
async def test_create_review(db_session: AsyncSession):
    """Creating a review for a step in review status."""
    data = await _setup_review_data(db_session)
    step = data["step"]

    service = StepReviewService(db_session)
    review = await service.create_review(
        step.id, diff_content="diff --git a/file.py"
    )

    assert review.step_id == step.id
    assert review.revision == 1
    assert review.status == ReviewStatus.pending
    assert review.diff_content == "diff --git a/file.py"


@pytest.mark.asyncio
async def test_create_second_revision(db_session: AsyncSession):
    """Second review increments revision number."""
    data = await _setup_review_data(db_session)
    step = data["step"]

    service = StepReviewService(db_session)
    review1 = await service.create_review(
        step.id, diff_content="diff v1"
    )
    review1.status = ReviewStatus.changes_requested
    await db_session.flush()

    review2 = await service.create_review(
        step.id, diff_content="diff v2"
    )
    assert review2.revision == 2


@pytest.mark.asyncio
async def test_approve_review(db_session: AsyncSession):
    """Approving a review sets status to approved."""
    data = await _setup_review_data(db_session)
    step = data["step"]

    service = StepReviewService(db_session)
    review = await service.create_review(
        step.id, diff_content="diff"
    )
    approved = await service.approve_review(review.id)
    assert approved.status == ReviewStatus.approved


@pytest.mark.asyncio
async def test_request_changes(db_session: AsyncSession):
    """Requesting changes stores comments and updates status."""
    data = await _setup_review_data(db_session)
    step = data["step"]

    service = StepReviewService(db_session)
    review = await service.create_review(
        step.id, diff_content="diff"
    )
    comments = [{"file": "file.py", "line": 10, "comment": "Fix this"}]
    updated = await service.request_changes(review.id, comments)

    assert updated.status == ReviewStatus.changes_requested
    assert updated.comments == comments


@pytest.mark.asyncio
async def test_get_reviews_for_step(db_session: AsyncSession):
    """Get all reviews for a step ordered by revision."""
    data = await _setup_review_data(db_session)
    step = data["step"]

    service = StepReviewService(db_session)
    await service.create_review(step.id, diff_content="diff v1")
    r1 = await service.get_latest_review(step.id)
    r1.status = ReviewStatus.changes_requested
    await db_session.flush()
    await service.create_review(step.id, diff_content="diff v2")

    reviews = await service.get_reviews(step.id)
    assert len(reviews) == 2
    assert reviews[0].revision == 1
    assert reviews[1].revision == 2


# --- WorkflowEngine review methods ---


@pytest.mark.asyncio
async def test_review_step_transitions_to_review(
    db_session: AsyncSession,
):
    """review_step() should set status to review."""
    data = await _setup_review_data(db_session)
    step = data["step"]
    step.status = StepStatus.running
    await db_session.flush()
    await db_session.commit()

    engine = WorkflowEngine(db_session)
    await engine.review_step(step)

    await db_session.refresh(step)
    assert step.status == StepStatus.review


@pytest.mark.asyncio
async def test_request_changes_transitions(db_session: AsyncSession):
    """request_changes_step() sets status to changes_requested."""
    data = await _setup_review_data(db_session)
    step = data["step"]

    engine = WorkflowEngine(db_session)
    await engine.request_changes_step(step)

    await db_session.refresh(step)
    assert step.status == StepStatus.changes_requested


@pytest.mark.asyncio
async def test_approve_review_completes_step_and_ticks(
    db_session: AsyncSession,
):
    """approve_review_step() should complete step and tick DAG."""
    data = await _setup_review_data(db_session)
    step = data["step"]

    engine = WorkflowEngine(db_session)
    await engine.approve_review_step(step)

    await db_session.refresh(step)
    assert step.status == StepStatus.completed


# --- Endpoint tests ---


@pytest.mark.asyncio
async def test_approve_review_endpoint(client, db_session):
    """POST approve-review returns 409 when step not in review."""
    headers = await auth_headers(client)

    proj_resp = await client.post(
        "/projects/",
        json={
            "name": "ReviewTest",
            "slug": "rt",
            "path": "/tmp/rt",
        },
        headers=headers,
    )
    project_id = proj_resp.json()["id"]

    await client.post(
        f"/projects/{project_id}/agents/",
        json={
            "name": "coder",
            "system_prompt": "You code.",
            "claude_model": "sonnet",
        },
        headers=headers,
    )

    tmpl_resp = await client.post(
        f"/projects/{project_id}/templates",
        json={
            "name": "flow",
            "steps_config": {
                "steps": [
                    {
                        "id": "code",
                        "agent": "coder",
                        "depends_on": [],
                    }
                ],
            },
        },
        headers=headers,
    )
    assert tmpl_resp.status_code == 201

    ticket_resp = await client.post(
        f"/projects/{project_id}/tickets",
        json={
            "title": "Test",
            "template_id": tmpl_resp.json()["id"],
        },
        headers=headers,
    )
    ticket = ticket_resp.json()
    step_id = ticket["steps"][0]["id"]

    # Run the step so it becomes running
    await client.post(
        f"/tickets/{ticket['id']}/steps/{step_id}/run",
        headers=headers,
    )

    # Step is running, not review — expect 409
    resp = await client.post(
        f"/tickets/{ticket['id']}/steps/{step_id}/approve-review",
        headers=headers,
    )
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_request_changes_endpoint_404(client):
    """POST request-changes returns 404 for missing ticket."""
    headers = await auth_headers(client, email="changes@test.com")
    fake = "00000000-0000-0000-0000-000000000001"
    fake2 = "00000000-0000-0000-0000-000000000002"

    resp = await client.post(
        f"/tickets/{fake}/steps/{fake2}/request-changes",
        json={
            "comments": [
                {"file": "f.py", "line": 10, "comment": "Fix"}
            ]
        },
        headers=headers,
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_get_step_reviews_endpoint(client):
    """GET reviews returns empty list for step with no reviews."""
    headers = await auth_headers(client, email="reviews@test.com")

    proj_resp = await client.post(
        "/projects/",
        json={
            "name": "ReviewList",
            "slug": "rl",
            "path": "/tmp/rl",
        },
        headers=headers,
    )
    project_id = proj_resp.json()["id"]

    await client.post(
        f"/projects/{project_id}/agents/",
        json={
            "name": "coder",
            "system_prompt": "You code.",
            "claude_model": "sonnet",
        },
        headers=headers,
    )

    tmpl_resp = await client.post(
        f"/projects/{project_id}/templates",
        json={
            "name": "flow",
            "steps_config": {
                "steps": [
                    {
                        "id": "code",
                        "agent": "coder",
                        "depends_on": [],
                    }
                ],
            },
        },
        headers=headers,
    )

    ticket_resp = await client.post(
        f"/projects/{project_id}/tickets",
        json={
            "title": "Test",
            "template_id": tmpl_resp.json()["id"],
        },
        headers=headers,
    )
    ticket = ticket_resp.json()
    step_id = ticket["steps"][0]["id"]

    resp = await client.get(
        f"/tickets/{ticket['id']}/steps/{step_id}/reviews",
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json() == []
