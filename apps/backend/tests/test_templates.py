import pytest

from tests.conftest import auth_headers


async def _setup_project_and_agent(client, headers, email_prefix="tmpl"):
    """Create a project (agents are seeded automatically), return project_id."""
    resp = await client.post(
        "/projects/",
        json={
            "name": "Template Test Project",
            "slug": f"{email_prefix}-proj",
            "path": f"/tmp/{email_prefix}-proj",
        },
        headers=headers,
    )
    assert resp.status_code == 201
    return resp.json()["id"]


def _valid_steps_config():
    return {
        "steps": [
            {
                "id": "design",
                "agent": "designer",
                "depends_on": [],
                "description": "Design the feature",
            },
            {
                "id": "develop",
                "agent": "coder",
                "depends_on": ["design"],
                "description": "Implement the feature",
            },
        ]
    }


@pytest.mark.asyncio
async def test_create_template(client):
    headers = await auth_headers(client, email="tmpl-create@example.com")
    project_id = await _setup_project_and_agent(client, headers, "tmpl-create")

    resp = await client.post(
        f"/projects/{project_id}/templates",
        json={
            "name": "Feature Workflow",
            "description": "Standard feature workflow",
            "steps_config": _valid_steps_config(),
        },
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Feature Workflow"
    assert data["project_id"] == project_id
    assert len(data["steps_config"]["steps"]) == 2
    assert "id" in data


@pytest.mark.asyncio
async def test_list_templates(client):
    headers = await auth_headers(client, email="tmpl-list@example.com")
    project_id = await _setup_project_and_agent(client, headers, "tmpl-list")

    # Create a template
    await client.post(
        f"/projects/{project_id}/templates",
        json={
            "name": "List Test Workflow",
            "steps_config": _valid_steps_config(),
        },
        headers=headers,
    )

    resp = await client.get(
        f"/projects/{project_id}/templates",
        headers=headers,
    )
    assert resp.status_code == 200
    templates = resp.json()
    names = [t["name"] for t in templates]
    assert "List Test Workflow" in names


@pytest.mark.asyncio
async def test_cycle_detection(client):
    headers = await auth_headers(client, email="tmpl-cycle@example.com")
    project_id = await _setup_project_and_agent(client, headers, "tmpl-cycle")

    cyclic_config = {
        "steps": [
            {
                "id": "step_a",
                "agent": "designer",
                "depends_on": ["step_b"],
                "description": "Step A",
            },
            {
                "id": "step_b",
                "agent": "coder",
                "depends_on": ["step_a"],
                "description": "Step B",
            },
        ]
    }

    resp = await client.post(
        f"/projects/{project_id}/templates",
        json={
            "name": "Cyclic Workflow",
            "steps_config": cyclic_config,
        },
        headers=headers,
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_invalid_agent(client):
    headers = await auth_headers(client, email="tmpl-badagent@example.com")
    project_id = await _setup_project_and_agent(client, headers, "tmpl-badagent")

    bad_agent_config = {
        "steps": [
            {
                "id": "step1",
                "agent": "nonexistent-agent",
                "depends_on": [],
                "description": "Uses a fake agent",
            },
        ]
    }

    resp = await client.post(
        f"/projects/{project_id}/templates",
        json={
            "name": "Bad Agent Workflow",
            "steps_config": bad_agent_config,
        },
        headers=headers,
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_invalid_dependency(client):
    headers = await auth_headers(client, email="tmpl-baddep@example.com")
    project_id = await _setup_project_and_agent(client, headers, "tmpl-baddep")

    bad_dep_config = {
        "steps": [
            {
                "id": "step1",
                "agent": "designer",
                "depends_on": ["nonexistent-step"],
                "description": "Depends on ghost step",
            },
        ]
    }

    resp = await client.post(
        f"/projects/{project_id}/templates",
        json={
            "name": "Bad Dep Workflow",
            "steps_config": bad_dep_config,
        },
        headers=headers,
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_update_template(client):
    headers = await auth_headers(client, email="tmpl-update@example.com")
    project_id = await _setup_project_and_agent(client, headers, "tmpl-update")

    create_resp = await client.post(
        f"/projects/{project_id}/templates",
        json={
            "name": "Update Me",
            "steps_config": _valid_steps_config(),
        },
        headers=headers,
    )
    template_id = create_resp.json()["id"]

    resp = await client.patch(
        f"/templates/{template_id}",
        json={"name": "Updated Workflow"},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "Updated Workflow"


@pytest.mark.asyncio
async def test_delete_template(client):
    headers = await auth_headers(client, email="tmpl-delete@example.com")
    project_id = await _setup_project_and_agent(client, headers, "tmpl-delete")

    create_resp = await client.post(
        f"/projects/{project_id}/templates",
        json={
            "name": "Delete Me",
            "steps_config": _valid_steps_config(),
        },
        headers=headers,
    )
    template_id = create_resp.json()["id"]

    resp = await client.delete(
        f"/templates/{template_id}",
        headers=headers,
    )
    assert resp.status_code == 204
