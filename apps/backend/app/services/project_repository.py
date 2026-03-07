import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.github_account import UserGitHubAccount
from app.models.project_repository import ProjectRepository
from app.schemas.github import ConnectReposRequest


async def get_project_repositories(
    db: AsyncSession, project_id: uuid.UUID
) -> list[ProjectRepository]:
    stmt = select(ProjectRepository).where(
        ProjectRepository.project_id == project_id
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def connect_repos(
    db: AsyncSession,
    project_id: uuid.UUID,
    user_id: uuid.UUID,
    data: ConnectReposRequest,
) -> list[ProjectRepository]:
    # Verify the GitHub account belongs to user
    stmt = select(UserGitHubAccount).where(
        UserGitHubAccount.id == data.github_account_id,
        UserGitHubAccount.user_id == user_id,
    )
    result = await db.execute(stmt)
    if result.scalar_one_or_none() is None:
        return []

    connected = []
    for repo in data.repos:
        # Skip if already connected
        existing = await db.execute(
            select(ProjectRepository).where(
                ProjectRepository.project_id == project_id,
                ProjectRepository.github_repo_id == repo.github_repo_id,
            )
        )
        if existing.scalar_one_or_none() is not None:
            continue

        pr = ProjectRepository(
            project_id=project_id,
            github_account_id=data.github_account_id,
            github_repo_id=repo.github_repo_id,
            repo_full_name=repo.full_name,
            repo_url=repo.clone_url,
            default_branch=repo.default_branch,
            is_private=repo.is_private,
            connected_by=user_id,
        )
        db.add(pr)
        connected.append(pr)

    await db.commit()
    for pr in connected:
        await db.refresh(pr)
    return connected


async def disconnect_repo(
    db: AsyncSession, project_id: uuid.UUID, repo_id: uuid.UUID
) -> bool:
    stmt = select(ProjectRepository).where(
        ProjectRepository.id == repo_id,
        ProjectRepository.project_id == project_id,
    )
    result = await db.execute(stmt)
    repo = result.scalar_one_or_none()
    if repo is None:
        return False
    await db.delete(repo)
    await db.commit()
    return True
