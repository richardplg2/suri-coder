import uuid
from unittest.mock import MagicMock

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
from app.models.project import Project
from app.models.ticket import Ticket
from app.models.user import User
from app.models.workflow_step import WorkflowStep
from app.services.agent_runner import AgentRunner


async def _setup_runner_data(db: AsyncSession) -> dict:
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

    agent_config = AgentConfig(
        id=uuid.uuid4(),
        project_id=project.id,
        name="coder",
        system_prompt="You are a coder.",
        claude_model="sonnet",
        max_turns=25,
    )
    db.add(agent_config)
    await db.flush()

    ticket = Ticket(
        id=uuid.uuid4(),
        project_id=project.id,
        key="TEST-1",
        title="Test",
        type=TicketType.feature,
        status=TicketStatus.in_progress,
        priority=TicketPriority.medium,
        created_by=user.id,
        budget_usd=5.0,
    )
    db.add(ticket)
    await db.flush()

    step = WorkflowStep(
        id=uuid.uuid4(),
        ticket_id=ticket.id,
        template_step_id="code",
        name="code",
        description="Implement feature",
        status=StepStatus.running,
        order=0,
        agent_config_id=agent_config.id,
    )
    db.add(step)
    await db.flush()
    await db.commit()

    return {
        "project": project,
        "agent_config": agent_config,
        "ticket": ticket,
        "step": step,
    }


@pytest.mark.asyncio
async def test_build_agent_options(db_session: AsyncSession):
    """build_agent_options should return dict with all required SDK fields."""
    data = await _setup_runner_data(db_session)
    runner = AgentRunner(db_session)
    options = await runner.build_agent_options(
        data["step"], data["agent_config"], cwd="/tmp/worktree"
    )
    assert options["system_prompt"] == "You are a coder."
    assert options["model"] == "sonnet"
    assert options["cwd"] == "/tmp/worktree"
    assert options["max_turns"] == 25
    assert options["max_budget_usd"] == 5.0


@pytest.mark.asyncio
async def test_build_agent_options_for_brainstorm(db_session: AsyncSession):
    """Brainstorm options should include output_format."""
    data = await _setup_runner_data(db_session)
    schema = {"sections": [{"key": "summary", "type": "text"}]}
    runner = AgentRunner(db_session)
    options = await runner.build_agent_options(
        data["step"],
        data["agent_config"],
        cwd="/tmp/worktree",
        brainstorm_schema=schema,
    )
    assert options["output_format"] == {"type": "json_schema", "schema": schema}


def test_session_registry():
    """Active session registry tracks and retrieves sessions."""
    runner = AgentRunner.__new__(AgentRunner)
    runner._active_sessions = {}

    step_id = uuid.uuid4()
    mock_client = MagicMock()
    runner.register_session(step_id, mock_client)
    assert runner.get_session(step_id) is mock_client

    runner.remove_session(step_id)
    assert runner.get_session(step_id) is None
