import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.agent_config import AgentConfig
from app.models.enums import TicketStatus
from app.models.project import Project, ProjectMember
from app.models.ticket import Ticket
from app.models.workflow_template import WorkflowTemplate
from app.schemas.workflow_template import (
    WorkflowTemplateCreate,
    WorkflowTemplateResponse,
    WorkflowTemplateUpdate,
)
from app.services.auth import get_current_user
from app.services.dag_validator import validate_dag
from app.services.project import require_project_member

router = APIRouter(tags=["templates"])


async def _get_valid_agent_names(
    db: AsyncSession, project_id: uuid.UUID
) -> set[str]:
    """Get valid agent names for a project (project-specific + global)."""
    result = await db.execute(
        select(AgentConfig.name).where(
            or_(
                AgentConfig.project_id == project_id,
                AgentConfig.project_id.is_(None),
            )
        )
    )
    return {row[0] for row in result.all()}


@router.get(
    "/projects/{project_id}/templates",
    response_model=list[WorkflowTemplateResponse],
)
async def list_templates(
    project_member: tuple[Project, ProjectMember] = Depends(require_project_member),
    db: AsyncSession = Depends(get_db),
) -> list[WorkflowTemplateResponse]:
    project, _ = project_member
    result = await db.execute(
        select(WorkflowTemplate).where(
            or_(
                WorkflowTemplate.project_id == project.id,
                WorkflowTemplate.project_id.is_(None),
            )
        )
    )
    templates = result.scalars().all()
    return [WorkflowTemplateResponse.model_validate(t) for t in templates]


@router.post(
    "/projects/{project_id}/templates",
    response_model=WorkflowTemplateResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_template(
    data: WorkflowTemplateCreate,
    project_member: tuple[Project, ProjectMember] = Depends(require_project_member),
    db: AsyncSession = Depends(get_db),
) -> WorkflowTemplateResponse:
    project, _ = project_member

    valid_agent_names = await _get_valid_agent_names(db, project.id)
    errors = validate_dag(data.steps_config.model_dump(), valid_agent_names)
    if errors:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=errors[0],
        )

    template = WorkflowTemplate(
        project_id=project.id,
        name=data.name,
        description=data.description,
        steps_config=data.steps_config.model_dump(),
    )
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return WorkflowTemplateResponse.model_validate(template)


@router.patch(
    "/templates/{template_id}",
    response_model=WorkflowTemplateResponse,
)
async def update_template(
    template_id: uuid.UUID,
    data: WorkflowTemplateUpdate,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> WorkflowTemplateResponse:
    result = await db.execute(
        select(WorkflowTemplate).where(WorkflowTemplate.id == template_id)
    )
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found",
        )

    if data.steps_config is not None:
        project_id = template.project_id
        if project_id is not None:
            valid_agent_names = await _get_valid_agent_names(db, project_id)
        else:
            # Global template: get all agent names
            all_agents = await db.execute(select(AgentConfig.name))
            valid_agent_names = {row[0] for row in all_agents.all()}

        errors = validate_dag(data.steps_config.model_dump(), valid_agent_names)
        if errors:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=errors[0],
            )
        template.steps_config = data.steps_config.model_dump()

    if data.name is not None:
        template.name = data.name
    if data.description is not None:
        template.description = data.description

    await db.commit()
    await db.refresh(template)
    return WorkflowTemplateResponse.model_validate(template)


@router.delete(
    "/templates/{template_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_template(
    template_id: uuid.UUID,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(
        select(WorkflowTemplate).where(WorkflowTemplate.id == template_id)
    )
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found",
        )

    # Check if template is in use by active tickets
    active_statuses = {TicketStatus.done, TicketStatus.cancelled}
    active_ticket_result = await db.execute(
        select(Ticket.id).where(
            Ticket.template_id == template_id,
            Ticket.status.notin_(active_statuses),
        )
    )
    if active_ticket_result.first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Template is in use by active tickets",
        )

    await db.delete(template)
    await db.commit()
