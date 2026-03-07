import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import StepStatus, TicketPriority, TicketStatus, TicketType, UserRole
from app.models.project import Project
from app.models.ticket import Ticket
from app.models.user import User
from app.models.workflow_step import WorkflowStep
from app.models.workflow_template import WorkflowTemplate
from app.services.brainstorm import BrainstormService


async def _setup_brainstorm_data(db: AsyncSession) -> dict:
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

    template = WorkflowTemplate(
        id=uuid.uuid4(),
        project_id=project.id,
        name="feature-flow",
        steps_config={
            "steps": [
                {
                    "id": "brainstorm",
                    "agent": "brainstormer",
                    "depends_on": [],
                    "requires_approval": True,
                    "brainstorm_schema": {
                        "sections": [
                            {"key": "summary", "label": "Summary", "type": "text"},
                            {"key": "approach", "label": "Approach", "type": "markdown"},
                            {
                                "key": "files_to_modify",
                                "label": "Files",
                                "type": "list",
                                "item_type": "string",
                            },
                        ]
                    },
                },
                {"id": "code", "agent": "coder", "depends_on": ["brainstorm"]},
                {"id": "test", "agent": "tester", "depends_on": ["brainstorm"]},
            ]
        },
    )
    db.add(template)
    await db.flush()

    ticket = Ticket(
        id=uuid.uuid4(),
        project_id=project.id,
        key=f"TEST-{uuid.uuid4().hex[:6].upper()}",
        title="Add login feature",
        type=TicketType.feature,
        status=TicketStatus.in_progress,
        priority=TicketPriority.medium,
        template_id=template.id,
        created_by=user.id,
    )
    db.add(ticket)
    await db.flush()

    brainstorm_step = WorkflowStep(
        id=uuid.uuid4(),
        ticket_id=ticket.id,
        template_step_id="brainstorm",
        name="brainstorm",
        status=StepStatus.review,
        order=0,
    )
    db.add(brainstorm_step)

    code_step = WorkflowStep(
        id=uuid.uuid4(),
        ticket_id=ticket.id,
        template_step_id="code",
        name="code",
        status=StepStatus.pending,
        order=1,
    )
    db.add(code_step)

    test_step = WorkflowStep(
        id=uuid.uuid4(),
        ticket_id=ticket.id,
        template_step_id="test",
        name="test",
        status=StepStatus.pending,
        order=2,
    )
    db.add(test_step)
    await db.flush()
    await db.commit()

    return {
        "template": template,
        "ticket": ticket,
        "brainstorm_step": brainstorm_step,
        "code_step": code_step,
        "test_step": test_step,
    }


@pytest.mark.asyncio
async def test_get_brainstorm_schema(db_session: AsyncSession):
    data = await _setup_brainstorm_data(db_session)
    service = BrainstormService(db_session)
    schema = await service.get_brainstorm_schema(data["brainstorm_step"])
    assert schema is not None
    assert len(schema["sections"]) == 3
    assert schema["sections"][0]["key"] == "summary"


@pytest.mark.asyncio
async def test_get_brainstorm_schema_returns_none_for_non_brainstorm(db_session: AsyncSession):
    data = await _setup_brainstorm_data(db_session)
    service = BrainstormService(db_session)
    schema = await service.get_brainstorm_schema(data["code_step"])
    assert schema is None


@pytest.mark.asyncio
async def test_is_brainstorm_step(db_session: AsyncSession):
    data = await _setup_brainstorm_data(db_session)
    service = BrainstormService(db_session)
    assert await service.is_brainstorm_step(data["brainstorm_step"]) is True
    assert await service.is_brainstorm_step(data["code_step"]) is False


@pytest.mark.asyncio
async def test_save_brainstorm_output(db_session: AsyncSession):
    data = await _setup_brainstorm_data(db_session)
    service = BrainstormService(db_session)

    output = {
        "summary": "Add OAuth login",
        "approach": "Use NextAuth.js",
        "files_to_modify": ["src/auth.ts", "src/login.tsx"],
    }
    await service.save_brainstorm_output(data["brainstorm_step"], output)

    await db_session.refresh(data["brainstorm_step"])
    assert data["brainstorm_step"].brainstorm_output == output


@pytest.mark.asyncio
async def test_get_downstream_steps(db_session: AsyncSession):
    data = await _setup_brainstorm_data(db_session)
    service = BrainstormService(db_session)
    downstream = await service.get_downstream_steps(data["brainstorm_step"])
    names = {s.name for s in downstream}
    assert "code" in names
    assert "test" in names
    assert "brainstorm" not in names


@pytest.mark.asyncio
async def test_save_step_breakdowns(db_session: AsyncSession):
    data = await _setup_brainstorm_data(db_session)
    service = BrainstormService(db_session)

    breakdowns = {
        "code": {"instructions": "Create LoginForm component"},
        "test": {"instructions": "Write Cypress tests for login"},
    }
    await service.save_step_breakdowns(data["brainstorm_step"], breakdowns)

    await db_session.refresh(data["code_step"])
    await db_session.refresh(data["test_step"])
    assert data["code_step"].step_breakdown == {"instructions": "Create LoginForm component"}
    assert data["test_step"].step_breakdown == {"instructions": "Write Cypress tests for login"}
