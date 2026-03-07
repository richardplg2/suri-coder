import asyncio
import uuid
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project_repository import ProjectRepository
from app.models.ticket import Ticket
from app.models.workflow_step import WorkflowStep

BASE_DIR = Path.home() / ".agent-coding"
REPOS_DIR = BASE_DIR / "repos"
WORKTREES_DIR = BASE_DIR / "worktrees"


class WorkspaceManager:
    """Manages git bare clones and worktrees for agent execution."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def ensure_bare_clone(
        self, repo: ProjectRepository
    ) -> Path:
        """Clone bare if not exists, or fetch latest."""
        bare_path = REPOS_DIR / f"{repo.repo_full_name}.git"

        if bare_path.exists():
            await self._run_git(
                str(bare_path), "fetch", "--all", "--prune"
            )
            return bare_path

        bare_path.parent.mkdir(parents=True, exist_ok=True)

        clone_url = repo.repo_url
        if not clone_url.endswith(".git"):
            clone_url += ".git"

        proc = await asyncio.create_subprocess_exec(
            "git",
            "clone",
            "--bare",
            clone_url,
            str(bare_path),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await proc.communicate()
        if proc.returncode != 0:
            raise RuntimeError(
                f"Failed to bare clone "
                f"{repo.repo_full_name}: {stderr.decode()}"
            )

        return bare_path

    async def setup_workspace(
        self, step: WorkflowStep, ticket: Ticket
    ) -> str:
        """Set up git worktree(s) for a step.

        Returns the working directory path for the agent.
        """
        repo_ids = step.repo_ids or []

        # Load repos
        repos: list[ProjectRepository] = []
        if repo_ids:
            result = await self.db.execute(
                select(ProjectRepository).where(
                    ProjectRepository.id.in_(
                        [uuid.UUID(r) for r in repo_ids]
                    )
                )
            )
            repos = list(result.scalars().all())
        else:
            result = await self.db.execute(
                select(ProjectRepository).where(
                    ProjectRepository.project_id
                    == ticket.project_id
                )
            )
            repos = list(result.scalars().all())

        if not repos:
            raise RuntimeError(
                f"No repositories found for step {step.id} "
                f"on ticket {ticket.key}"
            )

        # Determine worktree identity
        is_coder = self._is_coder_step(step)
        worktree_key = (
            f"{ticket.key}/coder"
            if is_coder
            else (
                f"{ticket.key}/"
                f"{step.template_step_id}-{str(step.id)[:8]}"
            )
        )

        branch_name = (
            f"agent/{ticket.key}/{step.template_step_id}"
        )

        if len(repos) == 1:
            repo = repos[0]
            bare_path = await self.ensure_bare_clone(repo)
            worktree_path = WORKTREES_DIR / worktree_key
            return await self._create_or_reuse_worktree(
                bare_path,
                worktree_path,
                branch_name,
                repo.default_branch,
                is_coder,
            )
        else:
            # Multi-repo: parent folder with sub-worktrees
            parent_path = WORKTREES_DIR / worktree_key
            parent_path.mkdir(parents=True, exist_ok=True)

            for repo in repos:
                bare_path = await self.ensure_bare_clone(repo)
                repo_name = repo.repo_full_name.split("/")[-1]
                sub_path = parent_path / repo_name
                await self._create_or_reuse_worktree(
                    bare_path,
                    sub_path,
                    branch_name,
                    repo.default_branch,
                    is_coder,
                )

            return str(parent_path)

    async def cleanup_workspace(self, ticket: Ticket) -> None:
        """Remove all worktrees for a ticket when it completes."""
        import shutil

        ticket_dir = WORKTREES_DIR / ticket.key
        if not ticket_dir.exists():
            return

        result = await self.db.execute(
            select(ProjectRepository).where(
                ProjectRepository.project_id == ticket.project_id
            )
        )
        repos = list(result.scalars().all())

        for repo in repos:
            bare_path = REPOS_DIR / f"{repo.repo_full_name}.git"
            if bare_path.exists():
                await self._run_git(
                    str(bare_path), "worktree", "prune"
                )

        shutil.rmtree(str(ticket_dir), ignore_errors=True)

    async def _create_or_reuse_worktree(
        self,
        bare_path: Path,
        worktree_path: Path,
        branch_name: str,
        default_branch: str,
        reuse: bool,
    ) -> str:
        """Create a worktree or reuse an existing one."""
        if reuse and worktree_path.exists():
            await self._run_git(
                str(worktree_path),
                "pull",
                "--ff-only",
                allow_fail=True,
            )
            return str(worktree_path)

        worktree_path.parent.mkdir(parents=True, exist_ok=True)

        # Fetch latest before creating worktree
        await self._run_git(str(bare_path), "fetch", "--all")

        # Create worktree with new branch from default branch
        proc = await asyncio.create_subprocess_exec(
            "git",
            "-C",
            str(bare_path),
            "worktree",
            "add",
            "-b",
            branch_name,
            str(worktree_path),
            f"origin/{default_branch}",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await proc.communicate()

        if proc.returncode != 0:
            stderr_text = stderr.decode()
            if "already exists" in stderr_text:
                # Branch exists — checkout without -b
                proc2 = await asyncio.create_subprocess_exec(
                    "git",
                    "-C",
                    str(bare_path),
                    "worktree",
                    "add",
                    str(worktree_path),
                    branch_name,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
                _, stderr2 = await proc2.communicate()
                if proc2.returncode != 0:
                    raise RuntimeError(
                        "Failed to create worktree: "
                        f"{stderr2.decode()}"
                    )
            else:
                raise RuntimeError(
                    f"Failed to create worktree: {stderr_text}"
                )

        return str(worktree_path)

    def _is_coder_step(self, step: WorkflowStep) -> bool:
        """Determine if this is a coder step."""
        coder_indicators = {
            "coder",
            "implement",
            "code",
            "develop",
        }
        tokens = set(
            step.template_step_id.lower().split("-")
            + step.name.lower().split()
        )
        return bool(tokens & coder_indicators)

    async def _run_git(
        self,
        cwd: str,
        *args: str,
        allow_fail: bool = False,
    ) -> tuple[str, str]:
        """Run a git command and return (stdout, stderr)."""
        proc = await asyncio.create_subprocess_exec(
            "git",
            "-C",
            cwd,
            *args,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate()
        if proc.returncode != 0 and not allow_fail:
            raise RuntimeError(
                f"Git command failed: "
                f"git -C {cwd} {' '.join(args)}\n"
                f"{stderr.decode()}"
            )
        return stdout.decode(), stderr.decode()
