import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.agent_config import AgentConfig, AgentSkill
from app.models.enums import StepStatus
from app.models.user import User
from app.models.workflow_step import WorkflowStep
from app.schemas.agent_config import (
    AgentConfigCreate,
    AgentConfigResponse,
    AgentConfigUpdate,
)
from app.services.auth import get_current_user
from app.services.project import require_project_member

router = APIRouter(prefix="/projects/{project_id}/agents", tags=["agents"])


@router.get("/", response_model=list[AgentConfigResponse])
async def list_agents(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await require_project_member(project_id, current_user, db)

    result = await db.execute(
        select(AgentConfig).where(
            or_(
                AgentConfig.project_id == project_id,
                AgentConfig.project_id.is_(None),
            )
        )
    )
    agents = result.scalars().all()
    return [AgentConfigResponse.model_validate(a) for a in agents]


@router.post("/", response_model=AgentConfigResponse, status_code=status.HTTP_201_CREATED)
async def create_agent(
    project_id: uuid.UUID,
    body: AgentConfigCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await require_project_member(project_id, current_user, db)

    # Check duplicate name within project
    result = await db.execute(
        select(AgentConfig).where(
            AgentConfig.project_id == project_id,
            AgentConfig.name == body.name,
        )
    )
    if result.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Agent config with this name already exists in the project",
        )

    agent = AgentConfig(
        project_id=project_id,
        name=body.name,
        description=body.description,
        system_prompt=body.system_prompt,
        claude_model=body.claude_model,
        tools_list=body.tools_list,
        mcp_servers=body.mcp_servers,
        tools_config=body.tools_config,
        max_turns=body.max_turns,
    )
    db.add(agent)
    await db.flush()

    if body.skill_ids:
        for i, skill_id in enumerate(body.skill_ids):
            agent_skill = AgentSkill(
                agent_config_id=agent.id,
                skill_id=skill_id,
                priority=i,
            )
            db.add(agent_skill)

    await db.commit()
    await db.refresh(agent)
    return AgentConfigResponse.model_validate(agent)


@router.patch("/{agent_id}", response_model=AgentConfigResponse)
async def update_agent(
    project_id: uuid.UUID,
    agent_id: uuid.UUID,
    body: AgentConfigUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await require_project_member(project_id, current_user, db)

    result = await db.execute(select(AgentConfig).where(AgentConfig.id == agent_id))
    agent = result.scalar_one_or_none()

    if agent is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent config not found",
        )

    if agent.project_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot modify global agent config",
        )

    if agent.project_id != project_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent config not found in this project",
        )

    update_data = body.model_dump(exclude_unset=True)
    skill_ids = update_data.pop("skill_ids", None)

    for field, value in update_data.items():
        setattr(agent, field, value)

    if skill_ids is not None:
        # Remove existing skills
        await db.execute(
            select(AgentSkill).where(AgentSkill.agent_config_id == agent_id)
        )
        existing = (
            await db.execute(
                select(AgentSkill).where(AgentSkill.agent_config_id == agent_id)
            )
        ).scalars().all()
        for s in existing:
            await db.delete(s)

        for i, skill_id in enumerate(skill_ids):
            agent_skill = AgentSkill(
                agent_config_id=agent_id,
                skill_id=skill_id,
                priority=i,
            )
            db.add(agent_skill)

    await db.commit()
    await db.refresh(agent)
    return AgentConfigResponse.model_validate(agent)


@router.delete("/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_agent(
    project_id: uuid.UUID,
    agent_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await require_project_member(project_id, current_user, db)

    result = await db.execute(select(AgentConfig).where(AgentConfig.id == agent_id))
    agent = result.scalar_one_or_none()

    if agent is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent config not found",
        )

    if agent.project_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot modify global agent config",
        )

    if agent.project_id != project_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent config not found in this project",
        )

    # Check if agent is in use by running workflow steps
    running_check = await db.execute(
        select(WorkflowStep).where(
            WorkflowStep.agent_config_id == agent_id,
            WorkflowStep.status == StepStatus.running,
        )
    )
    if running_check.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete agent config while it is in use by running workflow steps",
        )

    await db.delete(agent)
    await db.commit()
