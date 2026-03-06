import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agent_config import AgentConfig
from app.models.enums import (
    StepStatus,
    TicketPriority,
    TicketStatus,
    TicketType,
    UserRole,
)
from app.models.project import Project, ProjectMember
from app.models.ticket import Ticket
from app.models.user import User
from app.models.workflow_step import WorkflowStep, WorkflowStepDependency
from app.services.workflow_engine import WorkflowEngine


async def _setup_test_data(db: AsyncSession) -> dict:
    """Create User, Project, ProjectMember, AgentConfig, and return their references."""
    user = User(
        id=uuid.uuid4(),
        email=f"test-{uuid.uuid4().hex[:8]}@example.com",
        name="Test User",
        role=UserRole.admin,
        hashed_password="fakehashed",
    )
    db.add(user)
    await db.flush()

    project = Project(
        id=uuid.uuid4(),
        name="Test Project",
        slug=f"test-{uuid.uuid4().hex[:8]}",
        path="/tmp/test-project",
        created_by=user.id,
    )
    db.add(project)
    await db.flush()

    member = ProjectMember(
        project_id=project.id,
        user_id=user.id,
        role="admin",
    )
    db.add(member)
    await db.flush()

    agent_config = AgentConfig(
        id=uuid.uuid4(),
        project_id=project.id,
        name=f"test-agent-{uuid.uuid4().hex[:8]}",
        system_prompt="You are a test agent.",
        claude_model="sonnet",
    )
    db.add(agent_config)
    await db.flush()

    return {
        "user": user,
        "project": project,
        "agent_config": agent_config,
    }


async def _create_ticket(
    db: AsyncSession,
    project_id: uuid.UUID,
    created_by: uuid.UUID,
    status: TicketStatus = TicketStatus.backlog,
) -> Ticket:
    ticket = Ticket(
        id=uuid.uuid4(),
        project_id=project_id,
        key=f"TEST-{uuid.uuid4().hex[:6].upper()}",
        title="Test Ticket",
        type=TicketType.feature,
        status=status,
        priority=TicketPriority.medium,
        created_by=created_by,
    )
    db.add(ticket)
    await db.flush()
    return ticket


async def _create_step(
    db: AsyncSession,
    ticket_id: uuid.UUID,
    name: str,
    status: StepStatus = StepStatus.pending,
    order: int = 0,
    agent_config_id: uuid.UUID | None = None,
) -> WorkflowStep:
    step = WorkflowStep(
        id=uuid.uuid4(),
        ticket_id=ticket_id,
        template_step_id=f"tmpl-{name.lower()}",
        name=name,
        status=status,
        order=order,
        agent_config_id=agent_config_id,
    )
    db.add(step)
    await db.flush()
    return step


async def _add_dependency(
    db: AsyncSession,
    step_id: uuid.UUID,
    depends_on_id: uuid.UUID,
) -> WorkflowStepDependency:
    dep = WorkflowStepDependency(
        step_id=step_id,
        depends_on_id=depends_on_id,
    )
    db.add(dep)
    await db.flush()
    return dep


@pytest.mark.asyncio
async def test_tick_advances_ready_steps(db_session: AsyncSession):
    """Linear DAG: A -> B -> C. A completed. tick() should make B ready."""
    data = await _setup_test_data(db_session)
    ticket = await _create_ticket(
        db_session, data["project"].id, data["user"].id
    )

    step_a = await _create_step(
        db_session, ticket.id, "A", status=StepStatus.completed, order=0
    )
    step_b = await _create_step(
        db_session, ticket.id, "B", status=StepStatus.pending, order=1
    )
    step_c = await _create_step(
        db_session, ticket.id, "C", status=StepStatus.pending, order=2
    )

    await _add_dependency(db_session, step_b.id, step_a.id)
    await _add_dependency(db_session, step_c.id, step_b.id)
    await db_session.commit()

    engine = WorkflowEngine(db_session)
    newly_ready = await engine.tick(ticket.id)

    assert len(newly_ready) == 1
    assert newly_ready[0].id == step_b.id
    await db_session.refresh(step_b)
    assert step_b.status == StepStatus.ready
    await db_session.refresh(step_c)
    assert step_c.status == StepStatus.pending


@pytest.mark.asyncio
async def test_parallel_scheduling(db_session: AsyncSession):
    """A -> B, A -> C. Complete A, tick should make both B and C ready."""
    data = await _setup_test_data(db_session)
    ticket = await _create_ticket(
        db_session, data["project"].id, data["user"].id
    )

    step_a = await _create_step(
        db_session, ticket.id, "A", status=StepStatus.completed, order=0
    )
    step_b = await _create_step(
        db_session, ticket.id, "B", status=StepStatus.pending, order=1
    )
    step_c = await _create_step(
        db_session, ticket.id, "C", status=StepStatus.pending, order=2
    )

    await _add_dependency(db_session, step_b.id, step_a.id)
    await _add_dependency(db_session, step_c.id, step_a.id)
    await db_session.commit()

    engine = WorkflowEngine(db_session)
    newly_ready = await engine.tick(ticket.id)

    assert len(newly_ready) == 2
    ready_ids = {s.id for s in newly_ready}
    assert step_b.id in ready_ids
    assert step_c.id in ready_ids


@pytest.mark.asyncio
async def test_multiple_deps_not_ready(db_session: AsyncSession):
    """A -> C, B -> C. Complete A but B still running. tick should NOT make C ready."""
    data = await _setup_test_data(db_session)
    ticket = await _create_ticket(
        db_session, data["project"].id, data["user"].id
    )

    step_a = await _create_step(
        db_session, ticket.id, "A", status=StepStatus.completed, order=0
    )
    step_b = await _create_step(
        db_session, ticket.id, "B", status=StepStatus.running, order=1
    )
    step_c = await _create_step(
        db_session, ticket.id, "C", status=StepStatus.pending, order=2
    )

    await _add_dependency(db_session, step_c.id, step_a.id)
    await _add_dependency(db_session, step_c.id, step_b.id)
    await db_session.commit()

    engine = WorkflowEngine(db_session)
    newly_ready = await engine.tick(ticket.id)

    assert len(newly_ready) == 0
    await db_session.refresh(step_c)
    assert step_c.status == StepStatus.pending


@pytest.mark.asyncio
async def test_multiple_deps_all_done(db_session: AsyncSession):
    """A -> C, B -> C. Complete both A and B. tick should make C ready."""
    data = await _setup_test_data(db_session)
    ticket = await _create_ticket(
        db_session, data["project"].id, data["user"].id
    )

    step_a = await _create_step(
        db_session, ticket.id, "A", status=StepStatus.completed, order=0
    )
    step_b = await _create_step(
        db_session, ticket.id, "B", status=StepStatus.completed, order=1
    )
    step_c = await _create_step(
        db_session, ticket.id, "C", status=StepStatus.pending, order=2
    )

    await _add_dependency(db_session, step_c.id, step_a.id)
    await _add_dependency(db_session, step_c.id, step_b.id)
    await db_session.commit()

    engine = WorkflowEngine(db_session)
    newly_ready = await engine.tick(ticket.id)

    assert len(newly_ready) == 1
    assert newly_ready[0].id == step_c.id
    await db_session.refresh(step_c)
    assert step_c.status == StepStatus.ready


@pytest.mark.asyncio
async def test_failure_blocks_downstream(db_session: AsyncSession):
    """A -> B. Fail A. tick should NOT make B ready."""
    data = await _setup_test_data(db_session)
    ticket = await _create_ticket(
        db_session, data["project"].id, data["user"].id
    )

    step_a = await _create_step(
        db_session, ticket.id, "A", status=StepStatus.failed, order=0
    )
    step_b = await _create_step(
        db_session, ticket.id, "B", status=StepStatus.pending, order=1
    )

    await _add_dependency(db_session, step_b.id, step_a.id)
    await db_session.commit()

    engine = WorkflowEngine(db_session)
    newly_ready = await engine.tick(ticket.id)

    assert len(newly_ready) == 0
    await db_session.refresh(step_b)
    assert step_b.status == StepStatus.pending


@pytest.mark.asyncio
async def test_skip_unblocks(db_session: AsyncSession):
    """A -> B. Skip A. tick should make B ready."""
    data = await _setup_test_data(db_session)
    ticket = await _create_ticket(
        db_session, data["project"].id, data["user"].id
    )

    step_a = await _create_step(
        db_session, ticket.id, "A", status=StepStatus.pending, order=0
    )
    step_b = await _create_step(
        db_session, ticket.id, "B", status=StepStatus.pending, order=1
    )

    await _add_dependency(db_session, step_b.id, step_a.id)
    await db_session.commit()

    engine = WorkflowEngine(db_session)
    # Use skip_step which sets status to skipped and calls tick
    await db_session.refresh(step_a)
    newly_ready = await engine.skip_step(step_a)

    assert len(newly_ready) == 1
    assert newly_ready[0].id == step_b.id
    await db_session.refresh(step_b)
    assert step_b.status == StepStatus.ready


@pytest.mark.asyncio
async def test_ticket_auto_completion(db_session: AsyncSession):
    """All steps completed -> ticket status becomes 'done'."""
    data = await _setup_test_data(db_session)
    ticket = await _create_ticket(
        db_session,
        data["project"].id,
        data["user"].id,
        status=TicketStatus.in_progress,
    )

    step_a = await _create_step(
        db_session, ticket.id, "A", status=StepStatus.completed, order=0
    )
    step_b = await _create_step(
        db_session, ticket.id, "B", status=StepStatus.completed, order=1
    )

    await _add_dependency(db_session, step_b.id, step_a.id)
    await db_session.commit()

    engine = WorkflowEngine(db_session)
    await engine.tick(ticket.id)

    await db_session.refresh(ticket)
    assert ticket.status == TicketStatus.done


@pytest.mark.asyncio
async def test_ticket_auto_progress(db_session: AsyncSession):
    """start_step should set ticket to 'in_progress' if it was 'backlog'."""
    data = await _setup_test_data(db_session)
    ticket = await _create_ticket(
        db_session,
        data["project"].id,
        data["user"].id,
        status=TicketStatus.backlog,
    )

    step_a = await _create_step(
        db_session, ticket.id, "A", status=StepStatus.ready, order=0
    )
    await db_session.commit()

    engine = WorkflowEngine(db_session)
    await db_session.refresh(step_a)
    await engine.start_step(step_a)

    await db_session.refresh(ticket)
    assert ticket.status == TicketStatus.in_progress
    await db_session.refresh(step_a)
    assert step_a.status == StepStatus.running
