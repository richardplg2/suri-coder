import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import StepStatus, TicketPriority, TicketStatus, TicketType, UserRole
from app.models.project import Project
from app.models.ticket import Ticket
from app.models.user import User
from app.models.workflow_step import WorkflowStep, WorkflowStepDependency
from app.services.prompt_builder import PromptBuilder


async def _setup_prompt_data(db: AsyncSession) -> dict:
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
        key="TEST-1",
        title="Add login",
        description="Add OAuth login to the app",
        type=TicketType.feature,
        status=TicketStatus.in_progress,
        priority=TicketPriority.medium,
        created_by=user.id,
    )
    db.add(ticket)
    await db.flush()

    brainstorm_step = WorkflowStep(
        id=uuid.uuid4(),
        ticket_id=ticket.id,
        template_step_id="brainstorm",
        name="brainstorm",
        description="Brainstorm the approach",
        status=StepStatus.completed,
        order=0,
        brainstorm_output={"summary": "Use NextAuth", "approach": "OAuth flow"},
    )
    db.add(brainstorm_step)
    await db.flush()

    code_step = WorkflowStep(
        id=uuid.uuid4(),
        ticket_id=ticket.id,
        template_step_id="code",
        name="code",
        description="Implement the login feature",
        status=StepStatus.ready,
        order=1,
        step_breakdown={"instructions": "Create LoginForm at src/components/LoginForm.tsx"},
    )
    db.add(code_step)
    await db.flush()

    dep = WorkflowStepDependency(
        step_id=code_step.id, depends_on_id=brainstorm_step.id
    )
    db.add(dep)
    await db.flush()
    await db.commit()

    return {
        "ticket": ticket,
        "brainstorm_step": brainstorm_step,
        "code_step": code_step,
    }


@pytest.mark.asyncio
async def test_build_step_prompt_includes_description(db_session: AsyncSession):
    data = await _setup_prompt_data(db_session)
    builder = PromptBuilder(db_session)
    prompt = await builder.build_step_prompt(data["code_step"])
    assert "Implement the login feature" in prompt


@pytest.mark.asyncio
async def test_build_step_prompt_includes_breakdown(db_session: AsyncSession):
    data = await _setup_prompt_data(db_session)
    builder = PromptBuilder(db_session)
    prompt = await builder.build_step_prompt(data["code_step"])
    assert "LoginForm" in prompt


@pytest.mark.asyncio
async def test_build_step_prompt_includes_dependency_context(db_session: AsyncSession):
    data = await _setup_prompt_data(db_session)
    builder = PromptBuilder(db_session)
    prompt = await builder.build_step_prompt(data["code_step"])
    assert "brainstorm" in prompt.lower()


@pytest.mark.asyncio
async def test_build_step_prompt_includes_user_override(db_session: AsyncSession):
    data = await _setup_prompt_data(db_session)
    data["code_step"].user_prompt_override = "Use TDD approach"
    await db_session.flush()
    await db_session.commit()

    builder = PromptBuilder(db_session)
    prompt = await builder.build_step_prompt(data["code_step"])
    assert "Use TDD approach" in prompt


@pytest.mark.asyncio
async def test_build_step_prompt_no_override(db_session: AsyncSession):
    data = await _setup_prompt_data(db_session)
    builder = PromptBuilder(db_session)
    prompt = await builder.build_step_prompt(data["code_step"])
    assert "Additional instructions" not in prompt
