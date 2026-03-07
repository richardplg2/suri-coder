"""Tests for project seeding service."""

import uuid

import pytest
from sqlalchemy import select

from app.models.agent_config import AgentConfig, AgentSkill
from app.models.skill import Skill
from app.services.seed_data import (
    DEFAULT_AGENT_CONFIGS,
    DEFAULT_WORKFLOW_TEMPLATES,
)
from tests.conftest import auth_headers


async def _create_project(client, headers, slug="seed-test"):
    resp = await client.post(
        "/projects/",
        json={
            "name": "Seed Test Project",
            "slug": slug,
            "path": "/tmp/seed-test",
        },
        headers=headers,
    )
    assert resp.status_code == 201
    return resp.json()["id"]


@pytest.mark.asyncio
async def test_project_creation_seeds_agents(client):
    """Creating a project should seed default agent configs."""
    headers = await auth_headers(client, email="seed1@example.com")
    project_id = await _create_project(client, headers)

    resp = await client.get(
        f"/projects/{project_id}/agents/",
        headers=headers,
    )
    assert resp.status_code == 200
    agents = resp.json()

    project_agents = [a for a in agents if a["project_id"] is not None]
    expected_names = {cfg["name"] for cfg in DEFAULT_AGENT_CONFIGS}
    actual_names = {a["name"] for a in project_agents}
    assert actual_names == expected_names


@pytest.mark.asyncio
async def test_seed_creates_skill_links(client, db_session):
    """Seeding creates AgentSkill links for agents with skill_names."""
    headers = await auth_headers(
        client, email="seed-skills@example.com"
    )
    project_id = await _create_project(
        client, headers, slug="seed-skills"
    )

    result = await db_session.execute(
        select(AgentConfig).where(
            AgentConfig.project_id == uuid.UUID(project_id)
        )
    )
    agents = result.scalars().all()

    for agent in agents:
        matching_config = next(
            cfg
            for cfg in DEFAULT_AGENT_CONFIGS
            if cfg["name"] == agent.name
        )
        expected_count = len(
            matching_config.get("skill_names", [])
        )

        skills_result = await db_session.execute(
            select(AgentSkill).where(
                AgentSkill.agent_config_id == agent.id
            )
        )
        agent_skills = skills_result.scalars().all()
        assert len(agent_skills) == expected_count


@pytest.mark.asyncio
async def test_seed_creates_placeholder_skills(
    client, db_session
):
    """When template skills don't exist, placeholders are created."""
    headers = await auth_headers(
        client, email="seed-ph@example.com"
    )
    await _create_project(client, headers, slug="seed-ph")

    all_skill_names = set()
    for cfg in DEFAULT_AGENT_CONFIGS:
        all_skill_names.update(cfg.get("skill_names", []))

    for name in all_skill_names:
        skill_result = await db_session.execute(
            select(Skill).where(
                Skill.name == name,
                Skill.is_template.is_(True),
            )
        )
        skill = skill_result.scalar_one_or_none()
        assert skill is not None, f"Skill '{name}' should exist"


@pytest.mark.asyncio
async def test_seed_reuses_template_skills(client, db_session):
    """Seeding two projects reuses the same template skills."""
    headers = await auth_headers(
        client, email="seed-reuse@example.com"
    )
    await _create_project(client, headers, slug="seed-reuse-1")

    skills_before = (
        await db_session.execute(
            select(Skill).where(Skill.is_template.is_(True))
        )
    ).scalars().all()
    count_before = len(skills_before)

    # Second project with different slug but same user
    await _create_project(client, headers, slug="seed-reuse-2")

    skills_after = (
        await db_session.execute(
            select(Skill).where(Skill.is_template.is_(True))
        )
    ).scalars().all()
    count_after = len(skills_after)

    assert count_after == count_before


@pytest.mark.asyncio
async def test_reset_defaults_endpoint(client):
    """POST reset-defaults re-creates default agents."""
    headers = await auth_headers(
        client, email="reset@example.com"
    )
    project_id = await _create_project(
        client, headers, slug="reset-test"
    )

    # Get initial agents
    resp = await client.get(
        f"/projects/{project_id}/agents/",
        headers=headers,
    )
    initial_agents = [
        a for a in resp.json() if a["project_id"] is not None
    ]
    assert len(initial_agents) == len(DEFAULT_AGENT_CONFIGS)

    # Delete one agent
    await client.delete(
        f"/projects/{project_id}/agents/{initial_agents[0]['id']}",
        headers=headers,
    )

    # Reset
    resp = await client.post(
        f"/projects/{project_id}/agents/reset-defaults",
        headers=headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["agent_count"] == len(DEFAULT_AGENT_CONFIGS)

    # Verify all defaults are back
    resp = await client.get(
        f"/projects/{project_id}/agents/",
        headers=headers,
    )
    reset_agents = [
        a for a in resp.json() if a["project_id"] is not None
    ]
    reset_names = {a["name"] for a in reset_agents}
    expected_names = {cfg["name"] for cfg in DEFAULT_AGENT_CONFIGS}
    assert reset_names == expected_names


@pytest.mark.asyncio
async def test_project_creation_seeds_templates(
    client, db_session
):
    """Creating a project should seed default workflow templates."""
    from app.models.workflow_template import WorkflowTemplate

    headers = await auth_headers(
        client, email="seed-tmpl@example.com"
    )
    project_id = await _create_project(
        client, headers, slug="seed-tmpl"
    )

    result = await db_session.execute(
        select(WorkflowTemplate).where(
            WorkflowTemplate.project_id == uuid.UUID(project_id)
        )
    )
    templates = result.scalars().all()
    assert len(templates) == len(DEFAULT_WORKFLOW_TEMPLATES)

    tmpl_names = {t.name for t in templates}
    expected_names = {
        cfg["name"] for cfg in DEFAULT_WORKFLOW_TEMPLATES
    }
    assert tmpl_names == expected_names
