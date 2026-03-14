"""Seeds default agent configs and workflow templates into a new project."""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agent_config import AgentConfig, AgentSkill
from app.models.skill import Skill
from app.models.workflow_template import WorkflowTemplate
from app.services.seed_data import (
    DEFAULT_AGENT_CONFIGS,
    DEFAULT_WORKFLOW_TEMPLATES,
)


async def _get_or_create_skill(
    db: AsyncSession, skill_name: str
) -> Skill:
    """Look up a template skill by name, or create a placeholder."""
    result = await db.execute(
        select(Skill).where(
            Skill.name == skill_name,
            Skill.is_template.is_(True),
        )
    )
    skill = result.scalar_one_or_none()
    if skill is not None:
        return skill

    skill = Skill(
        name=skill_name,
        description=f"Template skill: {skill_name}",
        content="",
        category="default",
        is_template=True,
    )
    db.add(skill)
    await db.flush()
    return skill


async def seed_project_defaults(
    db: AsyncSession, project_id: uuid.UUID
) -> dict:
    """Create default agent configs and workflow templates.

    Returns a dict with ``agents`` and ``templates`` listing the
    created records.
    """
    created_agents: list[AgentConfig] = []
    created_templates: list[WorkflowTemplate] = []

    # --- Seed agent configs ----------------------------------------- #
    for agent_data in DEFAULT_AGENT_CONFIGS:
        skill_names: list[str] = agent_data.get("skill_names", [])

        agent = AgentConfig(
            project_id=project_id,
            name=agent_data["name"],
            description=agent_data["description"],
            system_prompt=agent_data["system_prompt"],
            claude_model=agent_data["claude_model"],
            tools_list=agent_data.get("tools_list"),
            max_turns=agent_data["max_turns"],
            default_requires_approval=agent_data[
                "default_requires_approval"
            ],
            agent_type=agent_data.get("agent_type", "backend"),
            output_format=agent_data.get("output_format"),
        )
        db.add(agent)
        await db.flush()

        for priority, skill_name in enumerate(skill_names):
            skill = await _get_or_create_skill(db, skill_name)
            agent_skill = AgentSkill(
                agent_config_id=agent.id,
                skill_id=skill.id,
                priority=priority,
            )
            db.add(agent_skill)

        created_agents.append(agent)

    # --- Seed workflow templates ------------------------------------ #
    for tmpl_data in DEFAULT_WORKFLOW_TEMPLATES:
        template = WorkflowTemplate(
            project_id=project_id,
            name=tmpl_data["name"],
            description=tmpl_data["description"],
            steps_config=tmpl_data["steps_config"],
        )
        db.add(template)
        created_templates.append(template)

    await db.flush()

    return {"agents": created_agents, "templates": created_templates}
