import pytest

from tests.conftest import auth_headers, create_user


async def _create_project(client, headers):
    """Create a project and return its ID."""
    resp = await client.post(
        "/projects/",
        json={
            "name": "Agent Test Project",
            "slug": "agent-test",
            "path": "/tmp/agent-test",
        },
        headers=headers,
    )
    assert resp.status_code == 201
    return resp.json()["id"]


def _agent_payload(name="test-agent"):
    return {
        "name": name,
        "system_prompt": "You are a helpful assistant.",
        "claude_model": "claude-sonnet-4-20250514",
    }


@pytest.mark.asyncio
async def test_create_agent(client):
    headers = await auth_headers(client)
    project_id = await _create_project(client, headers)

    resp = await client.post(
        f"/projects/{project_id}/agents/",
        json=_agent_payload("custom-agent"),
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "custom-agent"
    assert data["project_id"] == project_id
    assert data["claude_model"] == "claude-sonnet-4-20250514"
    assert "id" in data


@pytest.mark.asyncio
async def test_list_agents(client):
    headers = await auth_headers(client, email="list-agents@example.com")
    project_id = await _create_project(client, headers)

    # Create an agent
    await client.post(
        f"/projects/{project_id}/agents/",
        json=_agent_payload("lister"),
        headers=headers,
    )

    resp = await client.get(
        f"/projects/{project_id}/agents/",
        headers=headers,
    )
    assert resp.status_code == 200
    agents = resp.json()
    names = [a["name"] for a in agents]
    assert "lister" in names


@pytest.mark.asyncio
async def test_duplicate_agent_name(client):
    headers = await auth_headers(client, email="dup-agent@example.com")
    project_id = await _create_project(client, headers)

    payload = _agent_payload("dup-name")
    resp1 = await client.post(
        f"/projects/{project_id}/agents/",
        json=payload,
        headers=headers,
    )
    assert resp1.status_code == 201

    resp2 = await client.post(
        f"/projects/{project_id}/agents/",
        json=payload,
        headers=headers,
    )
    assert resp2.status_code == 409


@pytest.mark.asyncio
async def test_update_agent(client):
    headers = await auth_headers(client, email="update-agent@example.com")
    project_id = await _create_project(client, headers)

    create_resp = await client.post(
        f"/projects/{project_id}/agents/",
        json=_agent_payload("to-update"),
        headers=headers,
    )
    agent_id = create_resp.json()["id"]

    resp = await client.patch(
        f"/projects/{project_id}/agents/{agent_id}",
        json={"name": "updated-agent", "max_turns": 10},
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "updated-agent"
    assert data["max_turns"] == 10


@pytest.mark.asyncio
async def test_delete_agent(client):
    headers = await auth_headers(client, email="delete-agent@example.com")
    project_id = await _create_project(client, headers)

    create_resp = await client.post(
        f"/projects/{project_id}/agents/",
        json=_agent_payload("to-delete"),
        headers=headers,
    )
    agent_id = create_resp.json()["id"]

    resp = await client.delete(
        f"/projects/{project_id}/agents/{agent_id}",
        headers=headers,
    )
    assert resp.status_code == 204

    # Verify it's gone from the list (only project-scoped agents with this name)
    list_resp = await client.get(
        f"/projects/{project_id}/agents/",
        headers=headers,
    )
    names = [a["name"] for a in list_resp.json()]
    assert "to-delete" not in names


@pytest.mark.asyncio
async def test_cannot_modify_global_agent(client, db_session):
    """If a global agent exists (project_id=None), PATCH should return 403."""
    from app.models.agent_config import AgentConfig

    # Insert a global agent directly via DB
    global_agent = AgentConfig(
        project_id=None,
        name="global-agent",
        system_prompt="Global prompt",
        claude_model="claude-sonnet-4-20250514",
    )
    db_session.add(global_agent)
    await db_session.commit()
    await db_session.refresh(global_agent)

    headers = await auth_headers(client, email="global-test@example.com")
    project_id = await _create_project(client, headers)

    resp = await client.patch(
        f"/projects/{project_id}/agents/{global_agent.id}",
        json={"name": "hacked"},
        headers=headers,
    )
    assert resp.status_code == 403
