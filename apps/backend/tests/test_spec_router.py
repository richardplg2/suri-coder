import pytest

from tests.conftest import auth_headers


async def _setup_project_and_ticket(client, headers, slug="spec"):
    """Create a project and a ticket. Return (project_id, ticket_id)."""
    proj_resp = await client.post(
        "/projects/",
        json={
            "name": "Spec Router Project",
            "slug": slug,
            "path": f"/tmp/{slug}",
        },
        headers=headers,
    )
    assert proj_resp.status_code == 201
    project_id = proj_resp.json()["id"]

    ticket_resp = await client.post(
        f"/projects/{project_id}/tickets",
        json={"title": "Spec Router Ticket"},
        headers=headers,
    )
    assert ticket_resp.status_code == 201
    ticket_id = ticket_resp.json()["id"]

    return project_id, ticket_id


@pytest.mark.asyncio
async def test_create_spec_endpoint(client):
    headers = await auth_headers(client, email="spec-create@example.com")
    _, ticket_id = await _setup_project_and_ticket(
        client, headers, slug="sp-create"
    )

    resp = await client.post(
        f"/tickets/{ticket_id}/specs",
        json={
            "type": "feature",
            "title": "Feature Spec",
            "content": "# Feature\n\nDetails here.",
        },
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["type"] == "feature"
    assert data["title"] == "Feature Spec"
    assert data["revision"] == 1
    assert data["ticket_id"] == ticket_id


@pytest.mark.asyncio
async def test_list_specs_endpoint(client):
    headers = await auth_headers(client, email="spec-list@example.com")
    _, ticket_id = await _setup_project_and_ticket(
        client, headers, slug="sp-list"
    )

    # Create two specs
    await client.post(
        f"/tickets/{ticket_id}/specs",
        json={
            "type": "feature",
            "title": "Feature",
            "content": "Feature.",
        },
        headers=headers,
    )
    await client.post(
        f"/tickets/{ticket_id}/specs",
        json={
            "type": "design",
            "title": "Design",
            "content": "Design.",
        },
        headers=headers,
    )

    resp = await client.get(
        f"/tickets/{ticket_id}/specs",
        headers=headers,
    )
    assert resp.status_code == 200
    specs = resp.json()
    assert len(specs) == 2
    types = {s["type"] for s in specs}
    assert types == {"feature", "design"}


@pytest.mark.asyncio
async def test_list_specs_filtered_by_type(client):
    headers = await auth_headers(
        client, email="spec-filter@example.com"
    )
    _, ticket_id = await _setup_project_and_ticket(
        client, headers, slug="sp-filt"
    )

    await client.post(
        f"/tickets/{ticket_id}/specs",
        json={
            "type": "feature",
            "title": "Feature",
            "content": "Feature.",
        },
        headers=headers,
    )
    await client.post(
        f"/tickets/{ticket_id}/specs",
        json={
            "type": "design",
            "title": "Design",
            "content": "Design.",
        },
        headers=headers,
    )

    resp = await client.get(
        f"/tickets/{ticket_id}/specs",
        params={"type": "feature"},
        headers=headers,
    )
    assert resp.status_code == 200
    specs = resp.json()
    assert len(specs) == 1
    assert specs[0]["type"] == "feature"


@pytest.mark.asyncio
async def test_get_spec_detail_endpoint(client):
    headers = await auth_headers(
        client, email="spec-detail@example.com"
    )
    _, ticket_id = await _setup_project_and_ticket(
        client, headers, slug="sp-dtl"
    )

    create_resp = await client.post(
        f"/tickets/{ticket_id}/specs",
        json={
            "type": "feature",
            "title": "Feature",
            "content": "Content.",
        },
        headers=headers,
    )
    spec_id = create_resp.json()["id"]

    resp = await client.get(
        f"/tickets/{ticket_id}/specs/{spec_id}",
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == spec_id
    assert "source_references" in data
    assert "target_references" in data


@pytest.mark.asyncio
async def test_update_spec_creates_new_revision(client):
    headers = await auth_headers(
        client, email="spec-update@example.com"
    )
    _, ticket_id = await _setup_project_and_ticket(
        client, headers, slug="sp-upd"
    )

    create_resp = await client.post(
        f"/tickets/{ticket_id}/specs",
        json={
            "type": "feature",
            "title": "Feature",
            "content": "V1.",
        },
        headers=headers,
    )
    spec_id = create_resp.json()["id"]

    resp = await client.put(
        f"/tickets/{ticket_id}/specs/{spec_id}",
        json={"content": "V2.", "title": "Updated Feature"},
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    # New revision should have a different ID
    assert data["id"] != spec_id
    assert data["revision"] == 2
    assert data["content"] == "V2."
    assert data["title"] == "Updated Feature"


@pytest.mark.asyncio
async def test_spec_history_endpoint(client):
    headers = await auth_headers(
        client, email="spec-hist@example.com"
    )
    _, ticket_id = await _setup_project_and_ticket(
        client, headers, slug="sp-hist"
    )

    create_resp = await client.post(
        f"/tickets/{ticket_id}/specs",
        json={
            "type": "feature",
            "title": "Feature",
            "content": "V1.",
        },
        headers=headers,
    )
    spec_id = create_resp.json()["id"]

    await client.put(
        f"/tickets/{ticket_id}/specs/{spec_id}",
        json={"content": "V2."},
        headers=headers,
    )

    resp = await client.get(
        f"/tickets/{ticket_id}/specs/{spec_id}/history",
        headers=headers,
    )
    assert resp.status_code == 200
    history = resp.json()
    assert len(history) == 2
    # Ordered by revision desc
    assert history[0]["revision"] == 2
    assert history[1]["revision"] == 1


@pytest.mark.asyncio
async def test_spec_not_found_for_wrong_ticket(client):
    headers = await auth_headers(
        client, email="spec-wrong@example.com"
    )
    _, ticket_id_a = await _setup_project_and_ticket(
        client, headers, slug="sp-wrnga"
    )

    # Create another ticket
    proj_resp = await client.post(
        "/projects/",
        json={
            "name": "Other Project",
            "slug": "sp-wrngb",
            "path": "/tmp/sp-wrngb",
        },
        headers=headers,
    )
    other_project_id = proj_resp.json()["id"]
    other_ticket_resp = await client.post(
        f"/projects/{other_project_id}/tickets",
        json={"title": "Other Ticket"},
        headers=headers,
    )
    ticket_id_b = other_ticket_resp.json()["id"]

    # Create spec on ticket A
    create_resp = await client.post(
        f"/tickets/{ticket_id_a}/specs",
        json={
            "type": "feature",
            "title": "Feature",
            "content": "Content.",
        },
        headers=headers,
    )
    spec_id = create_resp.json()["id"]

    # Try to access it via ticket B — should 404
    resp = await client.get(
        f"/tickets/{ticket_id_b}/specs/{spec_id}",
        headers=headers,
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_spec_on_nonexistent_ticket(client):
    headers = await auth_headers(
        client, email="spec-noticket@example.com"
    )
    fake_ticket_id = "00000000-0000-0000-0000-000000000000"

    resp = await client.get(
        f"/tickets/{fake_ticket_id}/specs",
        headers=headers,
    )
    assert resp.status_code == 404
