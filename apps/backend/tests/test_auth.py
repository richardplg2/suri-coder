import pytest

from tests.conftest import auth_headers, create_user


@pytest.mark.asyncio
async def test_register_success(client):
    resp = await client.post(
        "/auth/register",
        json={
            "email": "new@example.com",
            "name": "New User",
            "password": "securepass1",
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert "access_token" in data
    assert data["user"]["email"] == "new@example.com"
    assert data["user"]["name"] == "New User"


@pytest.mark.asyncio
async def test_register_duplicate_email(client):
    await create_user(client, email="dup@example.com")
    resp = await client.post(
        "/auth/register",
        json={
            "email": "dup@example.com",
            "name": "Another",
            "password": "securepass1",
        },
    )
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_login_success(client):
    await create_user(client, email="login@example.com", password="mypassword1")
    resp = await client.post(
        "/auth/login",
        json={"email": "login@example.com", "password": "mypassword1"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["user"]["email"] == "login@example.com"


@pytest.mark.asyncio
async def test_login_invalid_credentials(client):
    await create_user(client, email="fail@example.com", password="correctpass")
    resp = await client.post(
        "/auth/login",
        json={"email": "fail@example.com", "password": "wrongpassword"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_get_current_user(client):
    headers = await auth_headers(client, email="me@example.com")
    resp = await client.get("/auth/me", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == "me@example.com"
    assert data["name"] == "Test User"
    assert "id" in data
