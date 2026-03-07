import pytest

from tests.conftest import auth_headers


async def _setup_project_template(client, headers, slug="tkt"):
    """Create a project, agents, and a template. Return (project_id, template_id)."""
    # Create project
    proj_resp = await client.post(
        "/projects/",
        json={
            "name": "Ticket Test Project",
            "slug": slug,
            "path": f"/tmp/{slug}",
        },
        headers=headers,
    )
    assert proj_resp.status_code == 201
    project_id = proj_resp.json()["id"]

    # Agents are seeded automatically on project creation
    # (designer, coder, etc.)

    # Create template
    tmpl_resp = await client.post(
        f"/projects/{project_id}/templates",
        json={
            "name": "Standard Workflow",
            "steps_config": {
                "steps": [
                    {
                        "id": "design",
                        "agent": "designer",
                        "depends_on": [],
                        "description": "Design phase",
                    },
                    {
                        "id": "develop",
                        "agent": "coder",
                        "depends_on": ["design"],
                        "description": "Development phase",
                    },
                ]
            },
        },
        headers=headers,
    )
    assert tmpl_resp.status_code == 201
    template_id = tmpl_resp.json()["id"]

    return project_id, template_id


@pytest.mark.asyncio
async def test_create_ticket(client):
    headers = await auth_headers(client, email="tkt-create@example.com")
    project_id, template_id = await _setup_project_template(
        client, headers, "tkt-create"
    )

    resp = await client.post(
        f"/projects/{project_id}/tickets",
        json={
            "title": "Implement login",
            "description": "Add login page",
            "template_id": template_id,
        },
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "Implement login"
    assert data["project_id"] == project_id
    assert data["template_id"] == template_id
    assert "id" in data
    assert "key" in data
    assert len(data["steps"]) > 0


@pytest.mark.asyncio
async def test_auto_key_generation(client):
    headers = await auth_headers(client, email="tkt-key@example.com")
    project_id, template_id = await _setup_project_template(
        client, headers, "tktkey"
    )

    resp1 = await client.post(
        f"/projects/{project_id}/tickets",
        json={"title": "First ticket", "template_id": template_id},
        headers=headers,
    )
    resp2 = await client.post(
        f"/projects/{project_id}/tickets",
        json={"title": "Second ticket", "template_id": template_id},
        headers=headers,
    )
    assert resp1.status_code == 201
    assert resp2.status_code == 201

    key1 = resp1.json()["key"]
    key2 = resp2.json()["key"]

    # Keys should follow the pattern SLUG-N
    assert key1 == "TKTKEY-1"
    assert key2 == "TKTKEY-2"


@pytest.mark.asyncio
async def test_step_instantiation(client):
    headers = await auth_headers(client, email="tkt-steps@example.com")
    project_id, template_id = await _setup_project_template(
        client, headers, "tkt-steps"
    )

    resp = await client.post(
        f"/projects/{project_id}/tickets",
        json={"title": "Step test", "template_id": template_id},
        headers=headers,
    )
    assert resp.status_code == 201
    steps = resp.json()["steps"]

    step_ids = {s["template_step_id"] for s in steps}
    assert "design" in step_ids
    assert "develop" in step_ids


@pytest.mark.asyncio
async def test_initial_step_statuses(client):
    headers = await auth_headers(client, email="tkt-status@example.com")
    project_id, template_id = await _setup_project_template(
        client, headers, "tkt-stat"
    )

    resp = await client.post(
        f"/projects/{project_id}/tickets",
        json={"title": "Status test", "template_id": template_id},
        headers=headers,
    )
    assert resp.status_code == 201
    steps = resp.json()["steps"]

    status_by_step = {s["template_step_id"]: s["status"] for s in steps}
    # "design" has no dependencies -> should be "ready"
    assert status_by_step["design"] == "ready"
    # "develop" depends on "design" -> should be "pending"
    assert status_by_step["develop"] == "pending"


@pytest.mark.asyncio
async def test_list_tickets(client):
    headers = await auth_headers(client, email="tkt-list@example.com")
    project_id, template_id = await _setup_project_template(
        client, headers, "tkt-list"
    )

    await client.post(
        f"/projects/{project_id}/tickets",
        json={"title": "Listed ticket", "template_id": template_id},
        headers=headers,
    )

    resp = await client.get(
        f"/projects/{project_id}/tickets",
        headers=headers,
    )
    assert resp.status_code == 200
    tickets = resp.json()
    titles = [t["title"] for t in tickets]
    assert "Listed ticket" in titles


@pytest.mark.asyncio
async def test_filter_by_status(client):
    headers = await auth_headers(client, email="tkt-filter@example.com")
    project_id, template_id = await _setup_project_template(
        client, headers, "tkt-filt"
    )

    await client.post(
        f"/projects/{project_id}/tickets",
        json={"title": "Backlog ticket", "template_id": template_id},
        headers=headers,
    )

    # Default status should be "backlog"
    resp = await client.get(
        f"/projects/{project_id}/tickets",
        params={"status_filter": "backlog"},
        headers=headers,
    )
    assert resp.status_code == 200
    tickets = resp.json()
    assert len(tickets) >= 1
    assert all(t["status"] == "backlog" for t in tickets)

    # Filter by a status that shouldn't match
    resp2 = await client.get(
        f"/projects/{project_id}/tickets",
        params={"status_filter": "done"},
        headers=headers,
    )
    assert resp2.status_code == 200
    assert len(resp2.json()) == 0


@pytest.mark.asyncio
async def test_get_ticket_detail(client):
    headers = await auth_headers(client, email="tkt-detail@example.com")
    project_id, template_id = await _setup_project_template(
        client, headers, "tkt-dtl"
    )

    create_resp = await client.post(
        f"/projects/{project_id}/tickets",
        json={"title": "Detail ticket", "template_id": template_id},
        headers=headers,
    )
    ticket_id = create_resp.json()["id"]

    resp = await client.get(
        f"/tickets/{ticket_id}",
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == ticket_id
    assert data["title"] == "Detail ticket"
    assert "steps" in data
    assert len(data["steps"]) == 2


@pytest.mark.asyncio
async def test_update_ticket(client):
    headers = await auth_headers(client, email="tkt-update@example.com")
    project_id, template_id = await _setup_project_template(
        client, headers, "tkt-upd"
    )

    create_resp = await client.post(
        f"/projects/{project_id}/tickets",
        json={"title": "Update me", "template_id": template_id},
        headers=headers,
    )
    ticket_id = create_resp.json()["id"]

    resp = await client.patch(
        f"/tickets/{ticket_id}",
        json={"title": "Updated title", "priority": "high"},
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == "Updated title"
    assert data["priority"] == "high"


@pytest.mark.asyncio
async def test_delete_ticket(client):
    headers = await auth_headers(client, email="tkt-delete@example.com")
    project_id, template_id = await _setup_project_template(
        client, headers, "tkt-del"
    )

    create_resp = await client.post(
        f"/projects/{project_id}/tickets",
        json={"title": "Delete me", "template_id": template_id},
        headers=headers,
    )
    ticket_id = create_resp.json()["id"]

    resp = await client.delete(
        f"/tickets/{ticket_id}",
        headers=headers,
    )
    assert resp.status_code == 204

    # Verify it's gone
    get_resp = await client.get(
        f"/tickets/{ticket_id}",
        headers=headers,
    )
    assert get_resp.status_code == 404
