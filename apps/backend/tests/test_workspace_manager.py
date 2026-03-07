import uuid
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import (
    StepStatus,
    TicketPriority,
    TicketStatus,
    TicketType,
    UserRole,
)
from app.models.project import Project, ProjectMember
from app.models.project_repository import ProjectRepository
from app.models.ticket import Ticket
from app.models.user import User
from app.models.workflow_step import WorkflowStep
from app.services.workspace_manager import (
    REPOS_DIR,
    WORKTREES_DIR,
    WorkspaceManager,
)


async def _setup_workspace_test_data(db: AsyncSession) -> dict:
    """Create user, project, repo, ticket for workspace tests."""
    user = User(
        id=uuid.uuid4(),
        email=f"ws-test-{uuid.uuid4().hex[:8]}@example.com",
        name="WS Test User",
        role=UserRole.admin,
        hashed_password="fakehashed",
    )
    db.add(user)
    await db.flush()

    project = Project(
        id=uuid.uuid4(),
        name="WS Test Project",
        slug=f"ws-test-{uuid.uuid4().hex[:8]}",
        path="/tmp/ws-test-project",
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

    repo = ProjectRepository(
        id=uuid.uuid4(),
        project_id=project.id,
        github_account_id=uuid.uuid4(),
        github_repo_id=12345,
        repo_full_name="acme/my-app",
        repo_url="https://github.com/acme/my-app",
        default_branch="main",
        connected_by=user.id,
    )
    db.add(repo)
    await db.flush()

    ticket = Ticket(
        id=uuid.uuid4(),
        project_id=project.id,
        key="WS-001",
        title="Workspace Test Ticket",
        type=TicketType.feature,
        status=TicketStatus.in_progress,
        priority=TicketPriority.medium,
        created_by=user.id,
    )
    db.add(ticket)
    await db.flush()

    return {
        "user": user,
        "project": project,
        "repo": repo,
        "ticket": ticket,
    }


@pytest.mark.asyncio
async def test_is_coder_step(db_session: AsyncSession):
    """_is_coder_step correctly identifies coder steps."""
    data = await _setup_workspace_test_data(db_session)
    mgr = WorkspaceManager(db_session)

    coder_step = WorkflowStep(
        id=uuid.uuid4(),
        ticket_id=data["ticket"].id,
        template_step_id="coder",
        name="Implement Feature",
        status=StepStatus.ready,
        order=0,
    )
    assert mgr._is_coder_step(coder_step) is True

    test_step = WorkflowStep(
        id=uuid.uuid4(),
        ticket_id=data["ticket"].id,
        template_step_id="tester",
        name="Run Tests",
        status=StepStatus.ready,
        order=1,
    )
    assert mgr._is_coder_step(test_step) is False


@pytest.mark.asyncio
async def test_ensure_bare_clone_creates_dir(
    db_session: AsyncSession,
):
    """ensure_bare_clone calls git clone --bare when dir doesn't exist."""
    data = await _setup_workspace_test_data(db_session)
    mgr = WorkspaceManager(db_session)
    repo = data["repo"]

    mock_proc = AsyncMock()
    mock_proc.returncode = 0
    mock_proc.communicate = AsyncMock(
        return_value=(b"", b"")
    )

    with (
        patch(
            "asyncio.create_subprocess_exec",
            return_value=mock_proc,
        ) as mock_exec,
        patch.object(Path, "exists", return_value=False),
        patch.object(Path, "mkdir"),
    ):
        result = await mgr.ensure_bare_clone(repo)

    expected_path = REPOS_DIR / "acme/my-app.git"
    assert result == expected_path
    mock_exec.assert_called_once()
    call_args = mock_exec.call_args[0]
    assert "clone" in call_args
    assert "--bare" in call_args


@pytest.mark.asyncio
async def test_ensure_bare_clone_fetches_existing(
    db_session: AsyncSession,
):
    """ensure_bare_clone fetches when bare dir already exists."""
    data = await _setup_workspace_test_data(db_session)
    mgr = WorkspaceManager(db_session)
    repo = data["repo"]

    with patch.object(Path, "exists", return_value=True):
        with patch.object(
            mgr, "_run_git", new_callable=AsyncMock
        ) as mock_git:
            mock_git.return_value = ("", "")
            result = await mgr.ensure_bare_clone(repo)

    expected_path = REPOS_DIR / "acme/my-app.git"
    assert result == expected_path
    mock_git.assert_called_once_with(
        str(expected_path), "fetch", "--all", "--prune"
    )


@pytest.mark.asyncio
async def test_cleanup_workspace_removes_dir(
    db_session: AsyncSession,
):
    """cleanup_workspace removes the ticket worktree directory."""
    data = await _setup_workspace_test_data(db_session)
    mgr = WorkspaceManager(db_session)
    ticket = data["ticket"]

    with (
        patch.object(Path, "exists", return_value=True),
        patch.object(
            mgr, "_run_git", new_callable=AsyncMock
        ),
        patch("shutil.rmtree") as mock_rmtree,
    ):
        await mgr.cleanup_workspace(ticket)

    expected_dir = str(WORKTREES_DIR / ticket.key)
    mock_rmtree.assert_called_once_with(
        expected_dir, ignore_errors=True
    )
