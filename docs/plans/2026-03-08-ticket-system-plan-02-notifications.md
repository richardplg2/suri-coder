# Ticket System — Plan 02: Notifications

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a generic notification system with backend CRUD, WebSocket real-time delivery, in-app notification dropdown, and OS native notifications.

**Architecture:** Backend service creates notifications and publishes via Redis pub/sub. WebSocket forwards to connected clients. Electron app shows in-app dropdown + OS native notifications.

**Tech Stack:** FastAPI, Redis pub/sub, WebSocket, Electron Notification API, TanStack Query, Zustand

**Depends on:** [Plan 01: Data Layer](./2026-03-08-ticket-system-plan-01-data-layer.md)
**Required by:** [Plan 05: Workflow Engine](./2026-03-08-ticket-system-plan-05-workflow-engine.md)

---

## Task 1: Create notification service

**Files:**
- Create: `apps/backend/app/services/notification.py`
- Create: `apps/backend/tests/test_notifications_service.py`

**Depends on:** Plan 01 (Notification model at `app/models/notification.py`, schemas at `app/schemas/notification.py`)

### 1a. Write failing test

Create `apps/backend/tests/test_notifications_service.py`:

```python
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
            resource_id=str(uuid.uuid4()),
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
```

### 1b. Run tests — verify they FAIL

```bash
cd apps/backend && uv run pytest tests/test_notifications_service.py -v
```

All tests should fail with `ImportError` or `ModuleNotFoundError` since the service doesn't exist yet.

### 1c. Implement notification service

Create `apps/backend/app/services/notification.py`:

```python
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
        resource_id: str | None = None,
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
        await db.refresh(notification)

        # Publish to Redis for real-time delivery
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
                        "resource_id": notification.resource_id,
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

        await db.commit()
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
    ) -> Notification | None:
        stmt = select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == user_id,
        )
        result = await db.execute(stmt)
        notification = result.scalar_one_or_none()
        if notification is None:
            return None

        notification.read = True
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
```

### 1d. Run tests — verify they PASS

```bash
cd apps/backend && uv run pytest tests/test_notifications_service.py -v
```

### 1e. Commit

```bash
git add apps/backend/app/services/notification.py apps/backend/tests/test_notifications_service.py
git commit -m "feat(backend): add NotificationService with CRUD and Redis pub/sub"
```

---

## Task 2: Create notification router

**Files:**
- Create: `apps/backend/app/routers/notifications.py`
- Create: `apps/backend/tests/test_notifications_router.py`
- Modify: `apps/backend/app/main.py`

**Depends on:** Task 1

### 2a. Write failing test

Create `apps/backend/tests/test_notifications_router.py`:

```python
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
```

### 2b. Run tests — verify they FAIL

```bash
cd apps/backend && uv run pytest tests/test_notifications_router.py -v
```

Tests should fail because the router doesn't exist and isn't registered.

### 2c. Implement notification router

Create `apps/backend/app/routers/notifications.py`:

```python
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.notification import NotificationResponse, NotificationUpdate
from app.services.auth import get_current_user
from app.services.notification import NotificationService

router = APIRouter(tags=["notifications"])


@router.get("/notifications", response_model=list[NotificationResponse])
async def list_notifications(
    read: bool | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[NotificationResponse]:
    notifications = await NotificationService.get_notifications(
        db=db, user_id=user.id, read=read, limit=limit, offset=offset
    )
    return [NotificationResponse.model_validate(n) for n in notifications]


@router.get("/notifications/unread-count")
async def get_unread_count(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, int]:
    count = await NotificationService.get_unread_count(db=db, user_id=user.id)
    return {"count": count}


@router.patch(
    "/notifications/{notification_id}",
    response_model=NotificationResponse,
)
async def mark_notification_read(
    notification_id: uuid.UUID,
    data: NotificationUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> NotificationResponse:
    notification = await NotificationService.mark_read(
        db=db, notification_id=notification_id, user_id=user.id
    )
    if notification is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )
    return NotificationResponse.model_validate(notification)


@router.post("/notifications/mark-all-read")
async def mark_all_read(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, int]:
    updated = await NotificationService.mark_all_read(db=db, user_id=user.id)
    return {"updated": updated}
```

### 2d. Register router in main.py

Add to `apps/backend/app/main.py` imports:

```python
from app.routers import (
    agents,
    auth,
    github,
    notifications,  # <-- add this
    projects,
    sessions,
    templates,
    tickets,
    websocket,
    workflow,
)
```

Add after the existing `include_router` calls:

```python
app.include_router(notifications.router)
```

### 2e. Verify NotificationUpdate schema exists

The Plan 01 data layer should have created this in `apps/backend/app/schemas/notification.py`. It needs at minimum:

```python
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    type: str
    title: str
    body: str | None
    resource_type: str | None
    resource_id: str | None
    read: bool
    created_at: datetime


class NotificationUpdate(BaseModel):
    read: bool
```

If the schema file from Plan 01 does not include `NotificationUpdate`, add it.

### 2f. Run tests — verify they PASS

```bash
cd apps/backend && uv run pytest tests/test_notifications_router.py -v
```

### 2g. Commit

```bash
git add apps/backend/app/routers/notifications.py apps/backend/tests/test_notifications_router.py apps/backend/app/main.py
git commit -m "feat(backend): add notification REST endpoints and register router"
```

---

## Task 3: Add WebSocket notification forwarding

**Files:**
- Modify: `apps/backend/app/services/ws_manager.py`
- Modify: `apps/backend/app/models/enums.py`
- Modify: `packages/shared/src/types/websocket.ts`

**Depends on:** Task 1

### 3a. Write failing test

Add to `apps/backend/tests/test_websocket.py` (or create a new test file `apps/backend/tests/test_notifications_ws.py`):

```python
import pytest

from app.models.enums import WsChannel, WsEvent


@pytest.mark.asyncio
async def test_notifications_channel_exists():
    """WsChannel.notifications must be defined."""
    assert hasattr(WsChannel, "notifications")
    assert WsChannel.notifications.value == "notifications"


@pytest.mark.asyncio
async def test_new_notification_event_exists():
    """WsEvent.new_notification must be defined."""
    assert hasattr(WsEvent, "new_notification")
    assert WsEvent.new_notification.value == "new_notification"


@pytest.mark.asyncio
async def test_notifications_channel_in_redis_key_map():
    """The notifications channel must be mapped in CHANNEL_TO_REDIS_KEY."""
    from app.services.ws_manager import CHANNEL_TO_REDIS_KEY

    assert WsChannel.notifications in CHANNEL_TO_REDIS_KEY
    key_fn = CHANNEL_TO_REDIS_KEY[WsChannel.notifications]
    assert key_fn({"user_id": "abc-123"}) == "notifications:abc-123"
```

### 3b. Run tests — verify they FAIL

```bash
cd apps/backend && uv run pytest tests/test_notifications_ws.py -v
```

### 3c. Add enum values (if not already added by Plan 01)

In `apps/backend/app/models/enums.py`, ensure these values exist:

Add to `WsChannel`:
```python
class WsChannel(str, enum.Enum):
    project_tickets = "project:tickets"
    ticket_progress = "ticket:progress"
    session_stream = "session:stream"
    notifications = "notifications"  # <-- add this
```

Add to `WsEvent`:
```python
    # notifications
    new_notification = "new_notification"  # <-- add this
    unread_count_changed = "unread_count_changed"  # <-- add this
```

### 3d. Add notifications channel to ws_manager Redis key map

In `apps/backend/app/services/ws_manager.py`, update `CHANNEL_TO_REDIS_KEY`:

```python
CHANNEL_TO_REDIS_KEY: dict[WsChannel, Callable[[dict[str, str]], str]] = {
    WsChannel.project_tickets: lambda p: f"project:{p['project_id']}:tickets",
    WsChannel.ticket_progress: lambda p: f"ticket:{p['ticket_id']}",
    WsChannel.session_stream: lambda p: f"session:{p['session_id']}",
    WsChannel.notifications: lambda p: f"notifications:{p['user_id']}",  # <-- add this
}
```

### 3e. Update shared TypeScript types

In `packages/shared/src/types/websocket.ts`, add:

```typescript
export const WsChannel = {
  ProjectTickets: 'project:tickets',
  TicketProgress: 'ticket:progress',
  SessionStream: 'session:stream',
  Notifications: 'notifications',  // <-- add this
} as const

export const WsEvent = {
  // ... existing events ...

  // notifications
  NewNotification: 'new_notification',  // <-- add this
  UnreadCountChanged: 'unread_count_changed',  // <-- add this
} as const
```

### 3f. Run tests — verify they PASS

```bash
cd apps/backend && uv run pytest tests/test_notifications_ws.py -v
```

### 3g. Commit

```bash
git add apps/backend/app/services/ws_manager.py apps/backend/app/models/enums.py packages/shared/src/types/websocket.ts apps/backend/tests/test_notifications_ws.py
git commit -m "feat(ws): add notifications channel and events to WebSocket layer"
```

---

## Task 4: Create frontend notification query hooks

**Files:**
- Create: `apps/desktop/src/renderer/hooks/queries/use-notifications.ts`

**Depends on:** Task 2

### 4a. Define notification types

Ensure the following type exists in `apps/desktop/src/renderer/types/api.ts` (or create inline):

```typescript
export interface Notification {
  id: string
  user_id: string
  type: string
  title: string
  body: string | null
  resource_type: string | null
  resource_id: string | null
  read: boolean
  created_at: string
}
```

### 4b. Create the hooks file

Create `apps/desktop/src/renderer/hooks/queries/use-notifications.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import { apiClient } from 'renderer/lib/api-client'
import type { Notification } from 'renderer/types/api'

export const notificationKeys = {
  all: ['notifications'] as const,
  list: (read?: boolean) => [...notificationKeys.all, { read }] as const,
  unreadCount: ['notifications', 'unread-count'] as const,
}

export function useNotifications(read?: boolean) {
  const params = new URLSearchParams()
  if (read !== undefined) params.set('read', String(read))
  const qs = params.toString()

  return useQuery({
    queryKey: notificationKeys.list(read),
    queryFn: () => apiClient<Notification[]>(`/notifications${qs ? `?${qs}` : ''}`),
  })
}

export function useUnreadCount() {
  return useQuery({
    queryKey: notificationKeys.unreadCount,
    queryFn: () => apiClient<{ count: number }>('/notifications/unread-count'),
    refetchInterval: 30000,
  })
}

export function useMarkRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (notificationId: string) =>
      apiClient<Notification>(`/notifications/${notificationId}`, {
        method: 'PATCH',
        body: JSON.stringify({ read: true }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notificationKeys.all })
      qc.invalidateQueries({ queryKey: notificationKeys.unreadCount })
    },
  })
}

export function useMarkAllRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiClient<{ updated: number }>('/notifications/mark-all-read', {
        method: 'POST',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notificationKeys.all })
      qc.invalidateQueries({ queryKey: notificationKeys.unreadCount })
    },
  })
}
```

### 4c. Verify build

```bash
cd apps/desktop && pnpm typecheck
```

### 4d. Commit

```bash
git add apps/desktop/src/renderer/hooks/queries/use-notifications.ts
git commit -m "feat(desktop): add TanStack Query hooks for notifications API"
```

---

## Task 5: Create notification store (for OS notifications)

**Files:**
- Create: `apps/desktop/src/renderer/stores/use-notification-store.ts`

**Depends on:** None (independent)

### 5a. Create the store

Create `apps/desktop/src/renderer/stores/use-notification-store.ts`:

```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface NotificationStore {
  osNotificationsEnabled: boolean
  setOsNotificationsEnabled: (enabled: boolean) => void
}

export const useNotificationStore = create<NotificationStore>()(
  persist(
    (set) => ({
      osNotificationsEnabled: true,
      setOsNotificationsEnabled: (enabled) => set({ osNotificationsEnabled: enabled }),
    }),
    { name: 'notification-store' },
  ),
)
```

### 5b. Verify build

```bash
cd apps/desktop && pnpm typecheck
```

### 5c. Commit

```bash
git add apps/desktop/src/renderer/stores/use-notification-store.ts
git commit -m "feat(desktop): add Zustand notification store with OS notification preference"
```

---

## Task 6: Create NotificationDropdown component

**Files:**
- Create: `apps/desktop/src/renderer/components/notification-dropdown.tsx`

**Depends on:** Task 4, Task 5

### 6a. Create the component

Create `apps/desktop/src/renderer/components/notification-dropdown.tsx`:

```typescript
import { useState } from 'react'
import { Bell, Check, AlertCircle, CheckCircle2, XCircle, Info } from 'lucide-react'
import {
  Button,
  Popover,
  PopoverTrigger,
  PopoverContent,
  ScrollArea,
  Badge,
} from '@agent-coding/ui'

import { useNotifications, useUnreadCount, useMarkRead, useMarkAllRead } from 'renderer/hooks/queries/use-notifications'
import type { Notification } from 'renderer/types/api'

function notificationIcon(type: string) {
  switch (type) {
    case 'step_completed':
    case 'workflow_completed':
      return <CheckCircle2 className="size-4 text-green-500 shrink-0" />
    case 'step_failed':
    case 'workflow_failed':
      return <XCircle className="size-4 text-destructive shrink-0" />
    case 'step_awaiting_approval':
    case 'review_requested':
      return <AlertCircle className="size-4 text-yellow-500 shrink-0" />
    default:
      return <Info className="size-4 text-muted-foreground shrink-0" />
  }
}

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const seconds = Math.floor((now - then) / 1000)

  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function NotificationItem({
  notification,
  onMarkRead,
}: {
  notification: Notification
  onMarkRead: (id: string) => void
}) {
  return (
    <button
      type="button"
      className={`flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/50 ${
        !notification.read ? 'bg-muted/30' : ''
      }`}
      onClick={() => {
        if (!notification.read) onMarkRead(notification.id)
      }}
    >
      {notificationIcon(notification.type)}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-tight truncate">{notification.title}</p>
        {notification.body && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notification.body}</p>
        )}
        <p className="text-xs text-muted-foreground mt-1">{timeAgo(notification.created_at)}</p>
      </div>
      {!notification.read && (
        <div className="size-2 rounded-full bg-primary shrink-0 mt-1.5" />
      )}
    </button>
  )
}

export function NotificationDropdown() {
  const [open, setOpen] = useState(false)
  const { data: notifications = [] } = useNotifications()
  const { data: unreadData } = useUnreadCount()
  const markRead = useMarkRead()
  const markAllRead = useMarkAllRead()

  const unreadCount = unreadData?.count ?? 0

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="size-7 relative">
          <Bell className="size-3.5 text-muted-foreground" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -right-1 -top-1 size-4 rounded-full p-0 text-[10px] flex items-center justify-center"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0" sideOffset={8}>
        <div className="flex items-center justify-between border-b px-3 py-2">
          <h4 className="text-sm font-semibold">Notifications</h4>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto px-2 py-1 text-xs"
              onClick={() => markAllRead.mutate()}
            >
              <Check className="size-3 mr-1" />
              Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-96">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Bell className="size-8 mb-2 opacity-50" />
              <p className="text-sm">No notifications</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notif) => (
                <NotificationItem
                  key={notif.id}
                  notification={notif}
                  onMarkRead={(id) => markRead.mutate(id)}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
```

### 6b. Verify build

```bash
cd apps/desktop && pnpm typecheck
```

### 6c. Commit

```bash
git add apps/desktop/src/renderer/components/notification-dropdown.tsx
git commit -m "feat(desktop): add NotificationDropdown component with popover UI"
```

---

## Task 7: Add notification dropdown to app toolbar

**Files:**
- Modify: `apps/desktop/src/renderer/components/app-layout.tsx`

**Depends on:** Task 6

### 7a. Replace the placeholder Bell button

In `apps/desktop/src/renderer/components/app-layout.tsx`:

1. Add import at the top:
```typescript
import { NotificationDropdown } from './notification-dropdown'
```

2. Replace the existing Bell button tooltip block (lines ~56-63):

**Remove:**
```typescript
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" className="size-7">
                  <Bell className="size-3.5 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Notifications</TooltipContent>
            </Tooltip>
```

**Replace with:**
```typescript
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <NotificationDropdown />
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom">Notifications</TooltipContent>
            </Tooltip>
```

3. Remove `Bell` from the lucide-react import (it is no longer used directly in this file — it's used inside `NotificationDropdown`):

```typescript
import { Home, Folder, Search, Sun, Moon } from 'lucide-react'
```

### 7b. Verify build

```bash
cd apps/desktop && pnpm typecheck
```

### 7c. Commit

```bash
git add apps/desktop/src/renderer/components/app-layout.tsx
git commit -m "feat(desktop): replace placeholder Bell button with NotificationDropdown in toolbar"
```

---

## Task 8: Add WebSocket listener for real-time notifications

**Files:**
- Create: `apps/desktop/src/renderer/hooks/use-notifications-ws.ts`

**Depends on:** Task 3, Task 4, Task 5

### 8a. Create the hook

Create `apps/desktop/src/renderer/hooks/use-notifications-ws.ts`:

```typescript
import { useEffect, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { WsChannel, WsEvent } from '@agent-coding/shared'

import { useWsStore } from 'renderer/stores/use-ws-store'
import { useNotificationStore } from 'renderer/stores/use-notification-store'
import { useAuthStore } from 'renderer/stores/use-auth-store'
import { notificationKeys } from 'renderer/hooks/queries/use-notifications'

export function useNotificationsWs() {
  const qc = useQueryClient()
  const { subscribe, unsubscribe, addListener, removeListener } = useWsStore()
  const osNotificationsEnabled = useNotificationStore((s) => s.osNotificationsEnabled)
  const token = useAuthStore((s) => s.token)

  // Extract user_id from JWT (simple base64 decode of payload)
  const userId = (() => {
    if (!token) return null
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      return payload.sub ?? payload.user_id ?? null
    } catch {
      return null
    }
  })()

  const handleEvent = useCallback(
    (event: string, data: unknown) => {
      if (event === WsEvent.NewNotification) {
        // Invalidate notification queries to refetch
        qc.invalidateQueries({ queryKey: notificationKeys.all })
        qc.invalidateQueries({ queryKey: notificationKeys.unreadCount })

        // Show OS notification if enabled
        const notifData = data as { title?: string; body?: string } | null
        if (osNotificationsEnabled && notifData?.title && 'Notification' in window) {
          new Notification(notifData.title, {
            body: notifData.body ?? undefined,
          })
        }
      }

      if (event === WsEvent.UnreadCountChanged) {
        qc.invalidateQueries({ queryKey: notificationKeys.unreadCount })
      }
    },
    [qc, osNotificationsEnabled],
  )

  useEffect(() => {
    if (!userId) return

    const channel = WsChannel.Notifications
    const params = { user_id: userId }
    const ref = `${channel}:${userId}`

    subscribe(channel, params)
    addListener(ref, handleEvent)

    return () => {
      removeListener(ref, handleEvent)
      unsubscribe(channel, params)
    }
  }, [userId, subscribe, unsubscribe, addListener, removeListener, handleEvent])
}
```

### 8b. Verify build

```bash
cd apps/desktop && pnpm typecheck
```

### 8c. Commit

```bash
git add apps/desktop/src/renderer/hooks/use-notifications-ws.ts
git commit -m "feat(desktop): add WebSocket hook for real-time notification delivery"
```

---

## Task 9: Wire up notifications WebSocket in app

**Files:**
- Modify: `apps/desktop/src/renderer/components/app-layout.tsx`

**Depends on:** Task 7, Task 8

### 9a. Add the hook call

In `apps/desktop/src/renderer/components/app-layout.tsx`:

1. Add import:
```typescript
import { useNotificationsWs } from 'renderer/hooks/use-notifications-ws'
```

2. Inside the `AppLayout` component function body, add the hook call right after `useKeyboardShortcuts()`:
```typescript
export function AppLayout({ children }: { children: React.ReactNode }) {
  useKeyboardShortcuts()
  useNotificationsWs()  // <-- add this line
  const { tabs, activeTabId, setActiveTab, closeTab } = useTabStore()
  // ... rest unchanged
```

### 9b. Verify build

```bash
cd apps/desktop && pnpm typecheck
```

### 9c. Run all backend tests

```bash
cd apps/backend && uv run pytest tests/ -v
```

### 9d. Run lint

```bash
pnpm lint
```

### 9e. Commit

```bash
git add apps/desktop/src/renderer/components/app-layout.tsx
git commit -m "feat(desktop): wire useNotificationsWs hook into AppLayout for real-time notifications"
```

---

## Summary of all files changed

### Created
| File | Description |
|------|-------------|
| `apps/backend/app/services/notification.py` | NotificationService with CRUD + Redis pub/sub |
| `apps/backend/app/routers/notifications.py` | REST endpoints for notifications |
| `apps/backend/tests/test_notifications_service.py` | Service-level tests |
| `apps/backend/tests/test_notifications_router.py` | Router/endpoint tests |
| `apps/backend/tests/test_notifications_ws.py` | WebSocket channel/enum tests |
| `apps/desktop/src/renderer/hooks/queries/use-notifications.ts` | TanStack Query hooks |
| `apps/desktop/src/renderer/stores/use-notification-store.ts` | Zustand store for OS notification pref |
| `apps/desktop/src/renderer/components/notification-dropdown.tsx` | Notification popover component |
| `apps/desktop/src/renderer/hooks/use-notifications-ws.ts` | WebSocket real-time listener hook |

### Modified
| File | Change |
|------|--------|
| `apps/backend/app/main.py` | Register `notifications.router` |
| `apps/backend/app/models/enums.py` | Add `WsChannel.notifications`, `WsEvent.new_notification`, `WsEvent.unread_count_changed` |
| `apps/backend/app/services/ws_manager.py` | Add notifications channel to `CHANNEL_TO_REDIS_KEY` |
| `packages/shared/src/types/websocket.ts` | Add `Notifications` channel, `NewNotification`/`UnreadCountChanged` events |
| `apps/desktop/src/renderer/components/app-layout.tsx` | Replace Bell placeholder with `NotificationDropdown`, call `useNotificationsWs()` |
| `apps/desktop/src/renderer/types/api.ts` | Add `Notification` type (if not already present) |
