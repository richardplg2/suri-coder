import json
import uuid

import redis.asyncio as aioredis
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import func

from app.config import settings
from app.models.notification import Notification


async def get_redis() -> aioredis.Redis:
    return aioredis.from_url(settings.redis_url)


class NotificationService:
    @staticmethod
    async def create(
        db: AsyncSession,
        user_id: uuid.UUID,
        type: str,
        title: str,
        body: str | None = None,
        resource_type: str | None = None,
        resource_id: uuid.UUID | None = None,
    ) -> Notification:
        notification = Notification(
            user_id=user_id,
            type=type,
            title=title,
            body=body,
            resource_type=resource_type,
            resource_id=resource_id,
        )
        db.add(notification)
        await db.flush()
        await db.commit()
        await db.refresh(notification)

        # Publish to Redis for real-time delivery (after commit to avoid phantom notifications)
        redis = await get_redis()
        try:
            payload = json.dumps(
                {
                    "event": "new_notification",
                    "data": {
                        "id": str(notification.id),
                        "type": notification.type,
                        "title": notification.title,
                        "body": notification.body,
                        "resource_type": notification.resource_type,
                        "resource_id": str(notification.resource_id)
                        if notification.resource_id
                        else None,
                        "read": notification.read,
                        "created_at": notification.created_at.isoformat()
                        if notification.created_at
                        else None,
                    },
                }
            )
            await redis.publish(f"notifications:{user_id}", payload)
        finally:
            await redis.aclose()

        return notification

    @staticmethod
    async def get_notifications(
        db: AsyncSession,
        user_id: uuid.UUID,
        read: bool | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> list[Notification]:
        stmt = select(Notification).where(Notification.user_id == user_id)

        if read is not None:
            stmt = stmt.where(Notification.read == read)

        stmt = stmt.order_by(Notification.created_at.desc()).limit(limit).offset(offset)
        result = await db.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def mark_read(
        db: AsyncSession,
        notification_id: uuid.UUID,
        user_id: uuid.UUID,
        read: bool = True,
    ) -> Notification | None:
        stmt = select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == user_id,
        )
        result = await db.execute(stmt)
        notification = result.scalar_one_or_none()
        if notification is None:
            return None

        notification.read = read
        await db.commit()
        await db.refresh(notification)
        return notification

    @staticmethod
    async def mark_all_read(
        db: AsyncSession,
        user_id: uuid.UUID,
    ) -> int:
        stmt = (
            update(Notification)
            .where(
                Notification.user_id == user_id,
                Notification.read == False,  # noqa: E712
            )
            .values(read=True)
        )
        result = await db.execute(stmt)
        await db.commit()
        return result.rowcount  # type: ignore[return-value]

    @staticmethod
    async def get_unread_count(
        db: AsyncSession,
        user_id: uuid.UUID,
    ) -> int:
        stmt = (
            select(func.count())
            .select_from(Notification)
            .where(
                Notification.user_id == user_id,
                Notification.read == False,  # noqa: E712
            )
        )
        result = await db.execute(stmt)
        return result.scalar_one()
