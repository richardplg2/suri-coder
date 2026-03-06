import uuid

from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.project import Project, ProjectMember
from app.schemas.project import ProjectCreate, ProjectUpdate
from app.services.auth import get_current_user


async def create_project(
    db: AsyncSession, data: ProjectCreate, user_id: uuid.UUID
) -> Project:
    existing = await db.execute(
        select(Project).where(Project.slug == data.slug)
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A project with this slug already exists",
        )

    project = Project(
        name=data.name,
        slug=data.slug,
        path=data.path,
        repo_url=data.repo_url,
        description=data.description,
        settings=data.settings,
        created_by=user_id,
    )
    db.add(project)
    await db.flush()

    member = ProjectMember(
        project_id=project.id, user_id=user_id, role="owner"
    )
    db.add(member)
    await db.commit()
    await db.refresh(project, attribute_names=["members"])
    return project


async def get_user_projects(
    db: AsyncSession, user_id: uuid.UUID
) -> list[Project]:
    stmt = (
        select(Project)
        .join(ProjectMember, ProjectMember.project_id == Project.id)
        .where(ProjectMember.user_id == user_id)
        .options(selectinload(Project.members))
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_project(
    db: AsyncSession, project_id: uuid.UUID
) -> Project | None:
    stmt = (
        select(Project)
        .where(Project.id == project_id)
        .options(selectinload(Project.members))
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def update_project(
    db: AsyncSession, project: Project, data: ProjectUpdate
) -> Project:
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(project, key, value)
    await db.commit()
    await db.refresh(project)
    return project


async def delete_project(db: AsyncSession, project: Project) -> None:
    await db.delete(project)
    await db.commit()


async def add_member(
    db: AsyncSession, project_id: uuid.UUID, user_id: uuid.UUID, role: str
) -> ProjectMember:
    member = ProjectMember(
        project_id=project_id, user_id=user_id, role=role
    )
    db.add(member)
    await db.commit()
    return member


async def remove_member(
    db: AsyncSession, project_id: uuid.UUID, user_id: uuid.UUID
) -> None:
    stmt = select(ProjectMember).where(
        ProjectMember.project_id == project_id,
        ProjectMember.user_id == user_id,
    )
    result = await db.execute(stmt)
    member = result.scalar_one_or_none()
    if member:
        await db.delete(member)
        await db.commit()


async def get_membership(
    db: AsyncSession, project_id: uuid.UUID, user_id: uuid.UUID
) -> ProjectMember | None:
    stmt = select(ProjectMember).where(
        ProjectMember.project_id == project_id,
        ProjectMember.user_id == user_id,
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def require_project_member(
    project_id: uuid.UUID,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> tuple[Project, ProjectMember]:
    project = await get_project(db, project_id)
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )
    member = await get_membership(db, project_id, user.id)
    if member is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a member of this project",
        )
    return project, member


async def require_project_owner(
    project_id: uuid.UUID,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> tuple[Project, ProjectMember]:
    project = await get_project(db, project_id)
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )
    member = await get_membership(db, project_id, user.id)
    if member is None or member.role != "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Owner access required",
        )
    return project, member
