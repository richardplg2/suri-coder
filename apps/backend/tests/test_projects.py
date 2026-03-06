import pytest

from tests.conftest import auth_headers, create_user


PROJECT_DATA = {
    "name": "My Project",
    "slug": "my-project",
    "path": "/tmp/my-project",
}


async def _create_project(client, headers, **overrides):
    payload = {**PROJECT_DATA, **overrides}
    return await client.post("/projects/", json=payload, headers=headers)


@pytest.mark.asyncio
async def test_create_project(client):
    headers = await auth_headers(client)
    resp = await _create_project(client, headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "My Project"
    assert data["slug"] == "my-project"
    assert data["member_count"] == 1


@pytest.mark.asyncio
async def test_list_projects(client):
    headers = await auth_headers(client)
    await _create_project(client, headers, slug="list-proj")
    resp = await client.get("/projects/", headers=headers)
    assert resp.status_code == 200
    projects = resp.json()
    assert len(projects) >= 1
    slugs = [p["slug"] for p in projects]
    assert "list-proj" in slugs


@pytest.mark.asyncio
async def test_get_project(client):
    headers = await auth_headers(client)
    create_resp = await _create_project(client, headers, slug="get-proj")
    project_id = create_resp.json()["id"]
    resp = await client.get(f"/projects/{project_id}", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["slug"] == "get-proj"


@pytest.mark.asyncio
async def test_update_project(client):
    headers = await auth_headers(client)
    create_resp = await _create_project(client, headers, slug="update-proj")
    project_id = create_resp.json()["id"]
    resp = await client.patch(
        f"/projects/{project_id}",
        json={"name": "Updated Name"},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "Updated Name"


@pytest.mark.asyncio
async def test_delete_project(client):
    headers = await auth_headers(client)
    create_resp = await _create_project(client, headers, slug="delete-proj")
    project_id = create_resp.json()["id"]
    resp = await client.delete(f"/projects/{project_id}", headers=headers)
    assert resp.status_code == 204

    # Verify it's gone
    resp = await client.get(f"/projects/{project_id}", headers=headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_duplicate_slug(client):
    headers = await auth_headers(client)
    resp1 = await _create_project(client, headers, slug="dup-slug")
    assert resp1.status_code == 201
    resp2 = await _create_project(client, headers, slug="dup-slug")
    assert resp2.status_code == 409


@pytest.mark.asyncio
async def test_non_member_access(client):
    # User A creates a project
    headers_a = await auth_headers(client, email="a@example.com")
    create_resp = await _create_project(client, headers_a, slug="private-proj")
    project_id = create_resp.json()["id"]

    # User B tries to access it
    headers_b = await auth_headers(client, email="b@example.com")
    resp = await client.get(f"/projects/{project_id}", headers=headers_b)
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_add_member(client):
    # User A creates a project
    headers_a = await auth_headers(client, email="owner@example.com")
    create_resp = await _create_project(client, headers_a, slug="member-proj")
    project_id = create_resp.json()["id"]

    # Register user B and get their ID
    user_b_data = await create_user(client, email="newmember@example.com")
    user_b_id = user_b_data["user"]["id"]

    # Owner adds user B
    resp = await client.post(
        f"/projects/{project_id}/members",
        json={"user_id": user_b_id, "role": "member"},
        headers=headers_a,
    )
    assert resp.status_code == 201

    # User B can now access the project
    headers_b = {
        "Authorization": f"Bearer {user_b_data['access_token']}"
    }
    resp = await client.get(f"/projects/{project_id}", headers=headers_b)
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_member_cannot_update(client):
    # User A creates a project
    headers_a = await auth_headers(client, email="projowner@example.com")
    create_resp = await _create_project(client, headers_a, slug="no-update-proj")
    project_id = create_resp.json()["id"]

    # Register user B and add as member
    user_b_data = await create_user(client, email="projmember@example.com")
    user_b_id = user_b_data["user"]["id"]
    await client.post(
        f"/projects/{project_id}/members",
        json={"user_id": user_b_id, "role": "member"},
        headers=headers_a,
    )

    # User B tries to update (should fail — not owner)
    headers_b = {
        "Authorization": f"Bearer {user_b_data['access_token']}"
    }
    resp = await client.patch(
        f"/projects/{project_id}",
        json={"name": "Hacked Name"},
        headers=headers_b,
    )
    assert resp.status_code == 403
