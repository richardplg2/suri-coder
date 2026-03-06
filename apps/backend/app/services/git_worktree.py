import asyncio
import os


async def create_worktree(repo_path: str, branch: str, worktree_path: str) -> str:
    """Create a git worktree for isolated step execution."""
    os.makedirs(os.path.dirname(worktree_path), exist_ok=True)
    proc = await asyncio.create_subprocess_exec(
        "git",
        "-C",
        repo_path,
        "worktree",
        "add",
        "-b",
        branch,
        worktree_path,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate()
    if proc.returncode != 0:
        raise RuntimeError(f"Failed to create worktree: {stderr.decode()}")
    return worktree_path


async def cleanup_worktree(repo_path: str, worktree_path: str):
    """Remove a git worktree."""
    proc = await asyncio.create_subprocess_exec(
        "git",
        "-C",
        repo_path,
        "worktree",
        "remove",
        worktree_path,
        "--force",
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    await proc.communicate()


async def merge_branches(worktree_path: str, branches: list[str]):
    """Merge dependency branches into the current worktree."""
    for branch in branches:
        proc = await asyncio.create_subprocess_exec(
            "git",
            "-C",
            worktree_path,
            "merge",
            branch,
            "--no-edit",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate()
        if proc.returncode != 0:
            raise RuntimeError(
                f"Failed to merge branch {branch}: {stderr.decode()}"
            )
