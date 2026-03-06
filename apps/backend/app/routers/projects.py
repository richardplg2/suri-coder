import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.project import Project, ProjectMember
from app.models.user import User
from app.schemas.project import (
    ProjectCreate,
    ProjectMemberCreate,
    ProjectResponse,
    ProjectUpdate,
)
from app.services.auth import get_current_user
from app.services.project import (
    add_member,
    create_project,
    delete_project,
    get_user_projects,
    remove_member,
    require_project_member,
    require_project_owner,
    update_project,
)

router = APIRouter(prefix="/projects", tags=["projects"])


def _to_response(project: Project) -> ProjectResponse:
    return ProjectResponse(
        id=project.id,
        name=project.name,
        slug=project.slug,
        path=project.path,
        repo_url=project.repo_url,
        description=project.description,
        settings=project.settings,
        created_by=project.created_by,
        created_at=project.created_at,
        member_count=len(project.members),
    )


@router.get("/", response_model=list[ProjectResponse])
async def list_projects(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ProjectResponse]:
    projects = await get_user_projects(db, user.id)
    return [_to_response(p) for p in projects]


@router.post("/", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project_endpoint(
    data: ProjectCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProjectResponse:
    project = await create_project(db, data, user.id)
    return _to_response(project)


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project_detail(
    project_member: tuple[Project, ProjectMember] = Depends(require_project_member),
) -> ProjectResponse:
    project, _ = project_member
    return _to_response(project)


@router.patch("/{project_id}", response_model=ProjectResponse)
async def update_project_endpoint(
    data: ProjectUpdate,
    project_member: tuple[Project, ProjectMember] = Depends(require_project_owner),
    db: AsyncSession = Depends(get_db),
) -> ProjectResponse:
    project, _ = project_member
    updated = await update_project(db, project, data)
    return _to_response(updated)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project_endpoint(
    project_member: tuple[Project, ProjectMember] = Depends(require_project_owner),
    db: AsyncSession = Depends(get_db),
) -> None:
    project, _ = project_member
    await delete_project(db, project)


@router.post("/{project_id}/members", status_code=status.HTTP_201_CREATED)
async def add_project_member(
    data: ProjectMemberCreate,
    project_member: tuple[Project, ProjectMember] = Depends(require_project_owner),
    db: AsyncSession = Depends(get_db),
) -> dict:
    project, _ = project_member
    try:
        await add_member(db, project.id, data.user_id, data.role)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User is already a member of this project",
        )
    return {"detail": "Member added"}


@router.delete(
    "/{project_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def remove_project_member(
    user_id: uuid.UUID,
    project_member: tuple[Project, ProjectMember] = Depends(require_project_owner),
    db: AsyncSession = Depends(get_db),
) -> None:
    project, _ = project_member
    await remove_member(db, project.id, user_id)
