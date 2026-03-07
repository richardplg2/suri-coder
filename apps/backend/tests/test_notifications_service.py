import uuid

import pytest
from unittest.mock import AsyncMock, patch

from tests.conftest import auth_headers


@pytest.mark.asyncio
async def test_create_notification(client, db_session):
    headers = await auth_headers(client, email="notif-create@example.com")

    # Get user id from token
    me_resp = await client.get("/auth/me", headers=headers)
    user_id = uuid.UUID(me_resp.json()["id"])

    with patch("app.services.notification.get_redis", new_callable=AsyncMock) as mock_redis:
        mock_redis_instance = AsyncMock()
        mock_redis.return_value = mock_redis_instance

        from app.services.notification import NotificationService

        notif = await NotificationService.create(
            db=db_session,
            user_id=user_id,
            type="step_completed",
            title="Step completed",
            body="The design step finished successfully.",
            resource_type="ticket",
            resource_id=uuid.uuid4(),
        )

        assert notif.id is not None
        assert notif.user_id == user_id
        assert notif.type == "step_completed"
        assert notif.title == "Step completed"
        assert notif.read is False
        mock_redis_instance.publish.assert_called_once()


@pytest.mark.asyncio
async def test_get_notifications(client, db_session):
    headers = await auth_headers(client, email="notif-list@example.com")
    me_resp = await client.get("/auth/me", headers=headers)
    user_id = uuid.UUID(me_resp.json()["id"])

    with patch("app.services.notification.get_redis", new_callable=AsyncMock) as mock_redis:
        mock_redis.return_value = AsyncMock()

        from app.services.notification import NotificationService

        for i in range(3):
            await NotificationService.create(
                db=db_session,
                user_id=user_id,
                type="info",
                title=f"Notification {i}",
            )

        notifs = await NotificationService.get_notifications(db=db_session, user_id=user_id)
        assert len(notifs) == 3


@pytest.mark.asyncio
async def test_get_notifications_filter_read(client, db_session):
    headers = await auth_headers(client, email="notif-filter@example.com")
    me_resp = await client.get("/auth/me", headers=headers)
    user_id = uuid.UUID(me_resp.json()["id"])

    with patch("app.services.notification.get_redis", new_callable=AsyncMock) as mock_redis:
        mock_redis.return_value = AsyncMock()

        from app.services.notification import NotificationService

        n1 = await NotificationService.create(
            db=db_session, user_id=user_id, type="info", title="Read me"
        )
        await NotificationService.create(
            db=db_session, user_id=user_id, type="info", title="Unread"
        )
        await NotificationService.mark_read(db=db_session, notification_id=n1.id, user_id=user_id)

        unread = await NotificationService.get_notifications(db=db_session, user_id=user_id, read=False)
        assert len(unread) == 1
        assert unread[0].title == "Unread"


@pytest.mark.asyncio
async def test_mark_all_read(client, db_session):
    headers = await auth_headers(client, email="notif-markall@example.com")
    me_resp = await client.get("/auth/me", headers=headers)
    user_id = uuid.UUID(me_resp.json()["id"])

    with patch("app.services.notification.get_redis", new_callable=AsyncMock) as mock_redis:
        mock_redis.return_value = AsyncMock()

        from app.services.notification import NotificationService

        for i in range(3):
            await NotificationService.create(
                db=db_session, user_id=user_id, type="info", title=f"N{i}"
            )

        count_before = await NotificationService.get_unread_count(db=db_session, user_id=user_id)
        assert count_before == 3

        await NotificationService.mark_all_read(db=db_session, user_id=user_id)

        count_after = await NotificationService.get_unread_count(db=db_session, user_id=user_id)
        assert count_after == 0


@pytest.mark.asyncio
async def test_get_unread_count(client, db_session):
    headers = await auth_headers(client, email="notif-count@example.com")
    me_resp = await client.get("/auth/me", headers=headers)
    user_id = uuid.UUID(me_resp.json()["id"])

    with patch("app.services.notification.get_redis", new_callable=AsyncMock) as mock_redis:
        mock_redis.return_value = AsyncMock()

        from app.services.notification import NotificationService

        await NotificationService.create(
            db=db_session, user_id=user_id, type="info", title="Count me"
        )
        await NotificationService.create(
            db=db_session, user_id=user_id, type="info", title="Count me too"
        )

        count = await NotificationService.get_unread_count(db=db_session, user_id=user_id)
        assert count == 2
