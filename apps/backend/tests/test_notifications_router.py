import uuid
from unittest.mock import AsyncMock, patch

import pytest

from tests.conftest import auth_headers


@pytest.mark.asyncio
async def test_list_notifications(client):
    headers = await auth_headers(client, email="notif-r-list@example.com")

    resp = await client.get("/notifications", headers=headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_list_notifications_filter_unread(client):
    headers = await auth_headers(client, email="notif-r-filter@example.com")

    resp = await client.get("/notifications?read=false", headers=headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_get_unread_count(client):
    headers = await auth_headers(client, email="notif-r-count@example.com")

    resp = await client.get("/notifications/unread-count", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "count" in data
    assert data["count"] == 0


@pytest.mark.asyncio
async def test_mark_notification_read(client, db_session):
    headers = await auth_headers(client, email="notif-r-mark@example.com")
    me_resp = await client.get("/auth/me", headers=headers)
    user_id = uuid.UUID(me_resp.json()["id"])

    # Create a notification directly via service
    with patch("app.services.notification.get_redis", new_callable=AsyncMock) as mock_redis:
        mock_redis.return_value = AsyncMock()
        from app.services.notification import NotificationService

        notif = await NotificationService.create(
            db=db_session, user_id=user_id, type="info", title="Mark me read"
        )

    resp = await client.patch(
        f"/notifications/{notif.id}",
        json={"read": True},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["read"] is True


@pytest.mark.asyncio
async def test_mark_all_read(client, db_session):
    headers = await auth_headers(client, email="notif-r-markall@example.com")
    me_resp = await client.get("/auth/me", headers=headers)
    user_id = uuid.UUID(me_resp.json()["id"])

    with patch("app.services.notification.get_redis", new_callable=AsyncMock) as mock_redis:
        mock_redis.return_value = AsyncMock()
        from app.services.notification import NotificationService

        for i in range(2):
            await NotificationService.create(
                db=db_session, user_id=user_id, type="info", title=f"N{i}"
            )

    resp = await client.post("/notifications/mark-all-read", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["updated"] >= 2

    # Verify all read
    count_resp = await client.get("/notifications/unread-count", headers=headers)
    assert count_resp.json()["count"] == 0


@pytest.mark.asyncio
async def test_mark_nonexistent_notification_returns_404(client):
    headers = await auth_headers(client, email="notif-r-404@example.com")

    fake_id = uuid.uuid4()
    resp = await client.patch(
        f"/notifications/{fake_id}",
        json={"read": True},
        headers=headers,
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_notifications_require_auth(client):
    resp = await client.get("/notifications")
    assert resp.status_code == 401
