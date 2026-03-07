import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agent_config import AgentConfig
from app.models.enums import StepStatus, TicketPriority, TicketStatus, TicketType, UserRole
from app.models.project import Project, ProjectMember
from app.models.ticket import Ticket
from app.models.user import User
from app.models.workflow_step import WorkflowStep, WorkflowStepDependency
from app.models.workflow_template import WorkflowTemplate
from app.services.workflow_engine import WorkflowEngine


async def _setup(db: AsyncSession, **overrides) -> dict:
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
        name="test-flow",
        steps_config={
            "steps": [
                {
                    "id": "design",
                    "agent": "designer",
                    "depends_on": [],
                    "requires_approval": overrides.get("template_requires_approval"),
                },
                {
                    "id": "code",
                    "agent": "coder",
                    "depends_on": ["design"],
                },
            ]
        },
    )
    db.add(template)
    await db.flush()

    agent_config = AgentConfig(
        id=uuid.uuid4(),
        project_id=project.id,
        name="designer",
        system_prompt="You design.",
        claude_model="sonnet",
        default_requires_approval=overrides.get("agent_default_requires_approval", False),
    )
    db.add(agent_config)
    await db.flush()

    ticket = Ticket(
        id=uuid.uuid4(),
        project_id=project.id,
        key=f"TEST-{uuid.uuid4().hex[:6].upper()}",
        title="Test Ticket",
        type=TicketType.feature,
        status=TicketStatus.backlog,
        priority=TicketPriority.medium,
        template_id=template.id,
        created_by=user.id,
        auto_execute=overrides.get("auto_execute", True),
    )
    db.add(ticket)
    await db.flush()

    return {
        "user": user,
        "project": project,
        "template": template,
        "agent_config": agent_config,
        "ticket": ticket,
    }


@pytest.mark.asyncio
async def test_auto_execute_no_approval_needed(db_session: AsyncSession):
    """auto_execute=True, no approval flags -> step goes to ready, not awaiting_approval."""
    data = await _setup(db_session, auto_execute=True)
    ticket = data["ticket"]
    agent_config = data["agent_config"]

    step = WorkflowStep(
        id=uuid.uuid4(),
        ticket_id=ticket.id,
        template_step_id="design",
        name="design",
        status=StepStatus.pending,
        order=0,
        agent_config_id=agent_config.id,
    )
    db_session.add(step)
    await db_session.flush()
    await db_session.commit()

    engine = WorkflowEngine(db_session)
    newly_ready = await engine.tick(ticket.id)

    assert len(newly_ready) == 1
    await db_session.refresh(step)
    assert step.status == StepStatus.ready


@pytest.mark.asyncio
async def test_auto_execute_false_forces_approval(db_session: AsyncSession):
    """auto_execute=False -> all steps go to awaiting_approval."""
    data = await _setup(db_session, auto_execute=False)
    ticket = data["ticket"]
    agent_config = data["agent_config"]

    step = WorkflowStep(
        id=uuid.uuid4(),
        ticket_id=ticket.id,
        template_step_id="design",
        name="design",
        status=StepStatus.pending,
        order=0,
        agent_config_id=agent_config.id,
    )
    db_session.add(step)
    await db_session.flush()
    await db_session.commit()

    engine = WorkflowEngine(db_session)
    newly_ready = await engine.tick(ticket.id)

    assert len(newly_ready) == 1
    await db_session.refresh(step)
    assert step.status == StepStatus.awaiting_approval


@pytest.mark.asyncio
async def test_step_override_requires_approval(db_session: AsyncSession):
    """Step-level requires_approval=True overrides everything."""
    data = await _setup(db_session, auto_execute=True)
    ticket = data["ticket"]
    agent_config = data["agent_config"]

    step = WorkflowStep(
        id=uuid.uuid4(),
        ticket_id=ticket.id,
        template_step_id="design",
        name="design",
        status=StepStatus.pending,
        order=0,
        agent_config_id=agent_config.id,
        requires_approval=True,
    )
    db_session.add(step)
    await db_session.flush()
    await db_session.commit()

    engine = WorkflowEngine(db_session)
    newly_ready = await engine.tick(ticket.id)

    assert len(newly_ready) == 1
    await db_session.refresh(step)
    assert step.status == StepStatus.awaiting_approval


@pytest.mark.asyncio
async def test_agent_default_requires_approval(db_session: AsyncSession):
    """Agent default_requires_approval=True, no step/template override."""
    data = await _setup(
        db_session, auto_execute=True, agent_default_requires_approval=True
    )
    ticket = data["ticket"]
    agent_config = data["agent_config"]

    step = WorkflowStep(
        id=uuid.uuid4(),
        ticket_id=ticket.id,
        template_step_id="code",  # template step has no requires_approval
        name="code",
        status=StepStatus.pending,
        order=1,
        agent_config_id=agent_config.id,
    )
    db_session.add(step)
    await db_session.flush()
    await db_session.commit()

    engine = WorkflowEngine(db_session)
    newly_ready = await engine.tick(ticket.id)

    assert len(newly_ready) == 1
    await db_session.refresh(step)
    assert step.status == StepStatus.awaiting_approval


@pytest.mark.asyncio
async def test_approve_step_endpoint(client, db_session):
    """POST /tickets/:id/steps/:step_id/approve transitions awaiting_approval -> ready."""
    from tests.conftest import auth_headers

    headers = await auth_headers(client)

    # Create project
    proj_resp = await client.post(
        "/projects/",
        json={"name": "Test", "slug": "test-approve", "path": "/tmp/test"},
        headers=headers,
    )
    assert proj_resp.status_code == 201
    project_id = proj_resp.json()["id"]

    # Create agent referenced by template
    agent_resp = await client.post(
        f"/projects/{project_id}/agents/",
        json={
            "name": "designer",
            "system_prompt": "You design.",
            "claude_model": "sonnet",
        },
        headers=headers,
    )
    assert agent_resp.status_code == 201

    # Create template
    tmpl_resp = await client.post(
        f"/projects/{project_id}/templates",
        json={
            "name": "flow",
            "steps_config": {
                "steps": [
                    {"id": "design", "agent": "designer", "depends_on": []},
                ]
            },
        },
        headers=headers,
    )
    assert tmpl_resp.status_code == 201
    template_id = tmpl_resp.json()["id"]

    # Create ticket (steps start as ready by default)
    ticket_resp = await client.post(
        f"/projects/{project_id}/tickets",
        json={"title": "Test", "template_id": template_id},
        headers=headers,
    )
    assert ticket_resp.status_code == 201
    ticket = ticket_resp.json()
    step = ticket["steps"][0]

    # Manually set step to awaiting_approval via DB
    from sqlalchemy import select

    from app.models.workflow_step import WorkflowStep as WS

    result = await db_session.execute(select(WS).where(WS.id == uuid.UUID(step["id"])))
    db_step = result.scalar_one()
    db_step.status = StepStatus.awaiting_approval
    await db_session.commit()

    # Approve
    resp = await client.post(
        f"/tickets/{ticket['id']}/steps/{step['id']}/approve",
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["step_id"] == step["id"]


@pytest.mark.asyncio
async def test_update_step_prompt(client):
    """PATCH /tickets/:id/steps/:step_id/prompt updates user_prompt_override."""
    from tests.conftest import auth_headers

    headers = await auth_headers(client, email="prompt@test.com")

    proj_resp = await client.post(
        "/projects/",
        json={"name": "PromptTest", "slug": "pt", "path": "/tmp/pt"},
        headers=headers,
    )
    project_id = proj_resp.json()["id"]

    agent_resp = await client.post(
        f"/projects/{project_id}/agents/",
        json={
            "name": "coder",
            "system_prompt": "You code.",
            "claude_model": "sonnet",
        },
        headers=headers,
    )
    assert agent_resp.status_code == 201

    tmpl_resp = await client.post(
        f"/projects/{project_id}/templates",
        json={
            "name": "flow",
            "steps_config": {
                "steps": [{"id": "code", "agent": "coder", "depends_on": []}],
            },
        },
        headers=headers,
    )
    assert tmpl_resp.status_code == 201

    ticket_resp = await client.post(
        f"/projects/{project_id}/tickets",
        json={"title": "Test", "template_id": tmpl_resp.json()["id"]},
        headers=headers,
    )
    assert ticket_resp.status_code == 201
    ticket = ticket_resp.json()
    step = ticket["steps"][0]

    resp = await client.patch(
        f"/tickets/{ticket['id']}/steps/{step['id']}/prompt",
        json={"user_prompt_override": "Use TDD approach"},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["user_prompt_override"] == "Use TDD approach"
