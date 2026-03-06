# WebSocket Multiplexed Connection — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace multiple WebSocket endpoints with a single multiplexed `/ws` connection using subscribe/unsubscribe protocol with typed enums.

**Architecture:** Single WebSocket endpoint with a `ConnectionManager` per client. Clients send typed subscribe/unsubscribe messages, server bridges Redis pubsub channels to the WebSocket. All actions, channels, and events use enums on both backend (Python `StrEnum`) and frontend (TypeScript `as const`).

**Tech Stack:** FastAPI WebSocket, Redis pubsub, asyncio TaskGroup, Zustand (frontend store), Pydantic schemas

**Design doc:** `docs/plans/2026-03-07-websocket-multiplexed-design.md`

---

### Task 1: Add WebSocket enums to backend

**Files:**
- Modify: `apps/backend/app/models/enums.py`

**Step 1: Add the enum classes**

Append to `apps/backend/app/models/enums.py`:

```python
class WsAction(str, enum.Enum):
    subscribe = "subscribe"
    unsubscribe = "unsubscribe"
    ping = "ping"


class WsChannel(str, enum.Enum):
    project_tickets = "project:tickets"
    ticket_progress = "ticket:progress"
    session_stream = "session:stream"


class WsEvent(str, enum.Enum):
    # System
    subscribed = "subscribed"
    unsubscribed = "unsubscribed"
    error = "error"
    pong = "pong"

    # project:tickets
    ticket_created = "ticket_created"
    ticket_updated = "ticket_updated"
    step_status_changed = "step_status_changed"

    # ticket:progress
    step_started = "step_started"
    step_completed = "step_completed"
    step_failed = "step_failed"
    workflow_completed = "workflow_completed"

    # session:stream
    message = "message"
    tool_use = "tool_use"
    cost_update = "cost_update"
    completed = "completed"
    failed = "failed"
```

**Step 2: Run lint**

Run: `cd apps/backend && uv run ruff check app/models/enums.py`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/backend/app/models/enums.py
git commit -m "feat(ws): add WebSocket action, channel, and event enums"
```

---

### Task 2: Add WebSocket Pydantic schemas

**Files:**
- Create: `apps/backend/app/schemas/websocket.py`

**Step 1: Write the schemas**

```python
from __future__ import annotations

from typing import Any

from pydantic import BaseModel

from app.models.enums import WsAction, WsChannel, WsEvent


class WsClientMessage(BaseModel):
    action: WsAction
    channel: WsChannel | None = None
    params: dict[str, str] | None = None


class WsServerMessage(BaseModel):
    channel: str  # WsChannel value or "_system"
    ref: str | None = None
    event: WsEvent
    data: Any | None = None


SYSTEM_CHANNEL = "_system"
```

**Step 2: Run lint**

Run: `cd apps/backend && uv run ruff check app/schemas/websocket.py`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/backend/app/schemas/websocket.py
git commit -m "feat(ws): add WebSocket Pydantic schemas for client/server messages"
```

---

### Task 3: Write ConnectionManager tests

**Files:**
- Create: `apps/backend/app/services/ws_manager.py` (empty placeholder)
- Modify: `apps/backend/tests/test_websocket.py`

**Step 1: Create empty service file**

```python
# apps/backend/app/services/ws_manager.py
```

**Step 2: Write failing tests**

Replace `apps/backend/tests/test_websocket.py` with:

```python
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.models.enums import WsAction, WsChannel, WsEvent
from app.schemas.websocket import SYSTEM_CHANNEL, WsClientMessage, WsServerMessage
from app.services.ws_manager import CHANNEL_TO_REDIS_KEY, ConnectionManager


@pytest.fixture
def mock_websocket():
    ws = AsyncMock()
    ws.send_text = AsyncMock()
    return ws


@pytest.fixture
def mock_redis():
    r = AsyncMock()
    r.pubsub = MagicMock(return_value=AsyncMock())
    return r


class TestChannelToRedisKey:
    def test_project_tickets(self):
        key = CHANNEL_TO_REDIS_KEY[WsChannel.project_tickets]({"project_id": "abc"})
        assert key == "project:abc:tickets"

    def test_ticket_progress(self):
        key = CHANNEL_TO_REDIS_KEY[WsChannel.ticket_progress]({"ticket_id": "def"})
        assert key == "ticket:def"

    def test_session_stream(self):
        key = CHANNEL_TO_REDIS_KEY[WsChannel.session_stream]({"session_id": "ghi"})
        assert key == "session:ghi"


class TestConnectionManager:
    @pytest.mark.asyncio
    async def test_subscribe_sends_confirmation(self, mock_websocket, mock_redis):
        manager = ConnectionManager(mock_websocket, mock_redis)
        await manager.subscribe(WsChannel.session_stream, {"session_id": "abc-123"})

        mock_redis.pubsub().subscribe.assert_called_once_with("session:abc-123")
        assert "session:abc-123" in manager.subscriptions

        sent = json.loads(mock_websocket.send_text.call_args[0][0])
        assert sent["channel"] == SYSTEM_CHANNEL
        assert sent["event"] == WsEvent.subscribed.value
        assert sent["ref"] == "session:stream:abc-123"

    @pytest.mark.asyncio
    async def test_unsubscribe_sends_confirmation(self, mock_websocket, mock_redis):
        manager = ConnectionManager(mock_websocket, mock_redis)
        # Subscribe first
        await manager.subscribe(WsChannel.session_stream, {"session_id": "abc-123"})
        mock_websocket.send_text.reset_mock()

        await manager.unsubscribe(WsChannel.session_stream, {"session_id": "abc-123"})

        mock_redis.pubsub().unsubscribe.assert_called_once_with("session:abc-123")
        assert "session:abc-123" not in manager.subscriptions

        sent = json.loads(mock_websocket.send_text.call_args[0][0])
        assert sent["channel"] == SYSTEM_CHANNEL
        assert sent["event"] == WsEvent.unsubscribed.value

    @pytest.mark.asyncio
    async def test_ping_sends_pong(self, mock_websocket, mock_redis):
        manager = ConnectionManager(mock_websocket, mock_redis)
        await manager.handle_client_message(
            WsClientMessage(action=WsAction.ping)
        )

        sent = json.loads(mock_websocket.send_text.call_args[0][0])
        assert sent["channel"] == SYSTEM_CHANNEL
        assert sent["event"] == WsEvent.pong.value

    @pytest.mark.asyncio
    async def test_subscribe_invalid_channel_sends_error(self, mock_websocket, mock_redis):
        manager = ConnectionManager(mock_websocket, mock_redis)
        # Missing required params
        await manager.subscribe(WsChannel.session_stream, {})

        sent = json.loads(mock_websocket.send_text.call_args[0][0])
        assert sent["channel"] == SYSTEM_CHANNEL
        assert sent["event"] == WsEvent.error.value

    @pytest.mark.asyncio
    async def test_cleanup_unsubscribes_all(self, mock_websocket, mock_redis):
        manager = ConnectionManager(mock_websocket, mock_redis)
        await manager.subscribe(WsChannel.session_stream, {"session_id": "a"})
        await manager.subscribe(WsChannel.ticket_progress, {"ticket_id": "b"})

        await manager.cleanup()

        assert len(manager.subscriptions) == 0
```

**Step 3: Run tests to verify they fail**

Run: `cd apps/backend && uv run pytest tests/test_websocket.py -v`
Expected: FAIL — `ImportError: cannot import name 'CHANNEL_TO_REDIS_KEY' from 'app.services.ws_manager'`

**Step 4: Commit**

```bash
git add apps/backend/tests/test_websocket.py apps/backend/app/services/ws_manager.py
git commit -m "test(ws): add ConnectionManager unit tests (red)"
```

---

### Task 4: Implement ConnectionManager

**Files:**
- Modify: `apps/backend/app/services/ws_manager.py`

**Step 1: Implement the service**

```python
from __future__ import annotations

import json
import logging

import redis.asyncio as aioredis
from fastapi import WebSocket

from app.models.enums import WsAction, WsChannel, WsEvent
from app.schemas.websocket import SYSTEM_CHANNEL, WsClientMessage, WsServerMessage

logger = logging.getLogger(__name__)

CHANNEL_TO_REDIS_KEY: dict[WsChannel, callable] = {
    WsChannel.project_tickets: lambda p: f"project:{p['project_id']}:tickets",
    WsChannel.ticket_progress: lambda p: f"ticket:{p['ticket_id']}",
    WsChannel.session_stream: lambda p: f"session:{p['session_id']}",
}

# Maps redis key prefix to channel type for reverse lookup
REDIS_PREFIX_TO_CHANNEL: dict[str, WsChannel] = {
    "project:": WsChannel.project_tickets,
    "ticket:": WsChannel.ticket_progress,
    "session:": WsChannel.session_stream,
}


def _make_ref(channel: WsChannel, params: dict[str, str]) -> str:
    """Build a ref string like 'session:stream:abc-123'."""
    param_val = next(iter(params.values()), "")
    return f"{channel.value}:{param_val}"


class ConnectionManager:
    def __init__(self, websocket: WebSocket, redis: aioredis.Redis):
        self.websocket = websocket
        self.redis = redis
        self.pubsub = redis.pubsub()
        self.subscriptions: dict[str, tuple[WsChannel, str]] = {}  # redis_key -> (channel, ref)

    async def subscribe(self, channel: WsChannel, params: dict[str, str]) -> None:
        try:
            redis_key = CHANNEL_TO_REDIS_KEY[channel](params)
        except KeyError:
            await self._send_system(WsEvent.error, data={"message": f"missing params for {channel.value}"})
            return

        ref = _make_ref(channel, params)
        await self.pubsub.subscribe(redis_key)
        self.subscriptions[redis_key] = (channel, ref)
        await self._send_system(WsEvent.subscribed, ref=ref)

    async def unsubscribe(self, channel: WsChannel, params: dict[str, str]) -> None:
        try:
            redis_key = CHANNEL_TO_REDIS_KEY[channel](params)
        except KeyError:
            await self._send_system(WsEvent.error, data={"message": f"missing params for {channel.value}"})
            return

        ref = _make_ref(channel, params)
        await self.pubsub.unsubscribe(redis_key)
        self.subscriptions.pop(redis_key, None)
        await self._send_system(WsEvent.unsubscribed, ref=ref)

    async def handle_client_message(self, msg: WsClientMessage) -> None:
        if msg.action == WsAction.ping:
            await self._send_system(WsEvent.pong)
        elif msg.action == WsAction.subscribe:
            if msg.channel is None:
                await self._send_system(WsEvent.error, data={"message": "channel required"})
                return
            await self.subscribe(msg.channel, msg.params or {})
        elif msg.action == WsAction.unsubscribe:
            if msg.channel is None:
                await self._send_system(WsEvent.error, data={"message": "channel required"})
                return
            await self.unsubscribe(msg.channel, msg.params or {})

    async def forward_redis_message(self, redis_key: str, data: str) -> None:
        """Forward a Redis pubsub message to the WebSocket client."""
        sub = self.subscriptions.get(redis_key)
        if not sub:
            return

        channel, ref = sub
        try:
            payload = json.loads(data)
            event = payload.get("event", "message")
            event_data = payload.get("data")
        except (json.JSONDecodeError, AttributeError):
            event = "message"
            event_data = data

        msg = WsServerMessage(
            channel=channel.value,
            ref=ref,
            event=WsEvent(event),
            data=event_data,
        )
        await self.websocket.send_text(msg.model_dump_json())

    async def cleanup(self) -> None:
        for key in list(self.subscriptions):
            await self.pubsub.unsubscribe(key)
        self.subscriptions.clear()
        await self.redis.aclose()

    async def _send_system(
        self, event: WsEvent, ref: str | None = None, data: dict | None = None
    ) -> None:
        msg = WsServerMessage(
            channel=SYSTEM_CHANNEL, ref=ref, event=event, data=data
        )
        await self.websocket.send_text(msg.model_dump_json())
```

**Step 2: Run tests**

Run: `cd apps/backend && uv run pytest tests/test_websocket.py -v`
Expected: All PASS

**Step 3: Run lint**

Run: `cd apps/backend && uv run ruff check app/services/ws_manager.py`
Expected: No errors

**Step 4: Commit**

```bash
git add apps/backend/app/services/ws_manager.py
git commit -m "feat(ws): implement ConnectionManager with subscribe/unsubscribe"
```

---

### Task 5: Replace WebSocket router

**Files:**
- Modify: `apps/backend/app/routers/websocket.py`

**Step 1: Rewrite the router**

Replace entire contents of `apps/backend/app/routers/websocket.py`:

```python
import asyncio
import json
import logging

import redis.asyncio as aioredis
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import ValidationError

from app.config import settings
from app.schemas.websocket import WsClientMessage
from app.services.ws_manager import ConnectionManager

logger = logging.getLogger(__name__)

router = APIRouter(tags=["websocket"])


@router.websocket("/ws")
async def ws_endpoint(websocket: WebSocket):
    await websocket.accept()
    r = aioredis.from_url(settings.redis_url)
    manager = ConnectionManager(websocket, r)

    async def read_client():
        while True:
            raw = await websocket.receive_text()
            try:
                msg = WsClientMessage.model_validate_json(raw)
                await manager.handle_client_message(msg)
            except ValidationError as e:
                from app.models.enums import WsEvent
                await manager._send_system(WsEvent.error, data={"message": str(e)})

    async def read_redis():
        while True:
            message = await manager.pubsub.get_message(
                ignore_subscribe_messages=True, timeout=0.1
            )
            if message and message["type"] == "message":
                data = message["data"]
                if isinstance(data, bytes):
                    data = data.decode()
                redis_channel = message["channel"]
                if isinstance(redis_channel, bytes):
                    redis_channel = redis_channel.decode()
                await manager.forward_redis_message(redis_channel, data)
            else:
                await asyncio.sleep(0.01)

    try:
        async with asyncio.TaskGroup() as tg:
            tg.create_task(read_client())
            tg.create_task(read_redis())
    except* WebSocketDisconnect:
        pass
    finally:
        await manager.cleanup()
```

**Step 2: Run all tests**

Run: `cd apps/backend && uv run pytest tests/ -v`
Expected: All PASS

**Step 3: Run lint**

Run: `cd apps/backend && uv run ruff check app/routers/websocket.py`
Expected: No errors

**Step 4: Commit**

```bash
git add apps/backend/app/routers/websocket.py
git commit -m "feat(ws): replace multi-endpoint WebSocket with single multiplexed /ws"
```

---

### Task 6: Update worker to publish typed events

**Files:**
- Modify: `apps/backend/app/worker.py`
- Modify: `apps/backend/app/services/workflow_engine.py`

**Step 1: Update worker publish calls**

In `apps/backend/app/worker.py`, update the failure publish (line 54-58):

Replace:
```python
                await redis.publish(
                    f"session:{session_id}",
                    json.dumps({"type": "error", "message": str(e)}),
                )
```

With:
```python
                await redis.publish(
                    f"session:{session_id}",
                    json.dumps({"event": "failed", "data": {"message": str(e)}}),
                )
```

**Step 2: Run tests**

Run: `cd apps/backend && uv run pytest tests/ -v`
Expected: All PASS

**Step 3: Commit**

```bash
git add apps/backend/app/worker.py
git commit -m "feat(ws): update worker to publish typed event payloads"
```

---

### Task 7: Add shared WebSocket types to frontend

**Files:**
- Create: `packages/shared/src/types/websocket.ts`
- Modify: `packages/shared/src/types/index.ts`
- Modify: `packages/shared/src/index.ts`

**Step 1: Create WebSocket types**

```typescript
// packages/shared/src/types/websocket.ts

export const WsAction = {
  Subscribe: 'subscribe',
  Unsubscribe: 'unsubscribe',
  Ping: 'ping',
} as const
export type WsAction = (typeof WsAction)[keyof typeof WsAction]

export const WsChannel = {
  ProjectTickets: 'project:tickets',
  TicketProgress: 'ticket:progress',
  SessionStream: 'session:stream',
} as const
export type WsChannel = (typeof WsChannel)[keyof typeof WsChannel]

export const WsEvent = {
  // System
  Subscribed: 'subscribed',
  Unsubscribed: 'unsubscribed',
  Error: 'error',
  Pong: 'pong',

  // project:tickets
  TicketCreated: 'ticket_created',
  TicketUpdated: 'ticket_updated',
  StepStatusChanged: 'step_status_changed',

  // ticket:progress
  StepStarted: 'step_started',
  StepCompleted: 'step_completed',
  StepFailed: 'step_failed',
  WorkflowCompleted: 'workflow_completed',

  // session:stream
  Message: 'message',
  ToolUse: 'tool_use',
  CostUpdate: 'cost_update',
  Completed: 'completed',
  Failed: 'failed',
} as const
export type WsEvent = (typeof WsEvent)[keyof typeof WsEvent]

export const SYSTEM_CHANNEL = '_system' as const

export interface WsClientMessage {
  action: WsAction
  channel?: WsChannel
  params?: Record<string, string>
}

export interface WsServerMessage {
  channel: WsChannel | typeof SYSTEM_CHANNEL
  ref?: string
  event: WsEvent
  data?: unknown
}
```

**Step 2: Re-export from index files**

Update `packages/shared/src/types/index.ts`:
```typescript
export * from './websocket'
```

Check `packages/shared/src/index.ts` re-exports types (if not, add `export * from './types'`).

**Step 3: Run typecheck**

Run: `pnpm --filter shared typecheck` (or `pnpm typecheck`)
Expected: No errors

**Step 4: Commit**

```bash
git add packages/shared/src/types/websocket.ts packages/shared/src/types/index.ts packages/shared/src/index.ts
git commit -m "feat(ws): add shared WebSocket types with const enums"
```

---

### Task 8: Create Zustand WebSocket store

**Files:**
- Create: `apps/desktop/src/renderer/src/stores/use-ws-store.ts`

**Step 1: Implement the store**

```typescript
// apps/desktop/src/renderer/src/stores/use-ws-store.ts
import { create } from 'zustand'
import type { WsChannel, WsClientMessage, WsEvent, WsServerMessage } from '@agent-coding/shared'
import { SYSTEM_CHANNEL, WsAction } from '@agent-coding/shared'

type EventCallback = (event: WsEvent, data: unknown) => void

interface WsState {
  ws: WebSocket | null
  status: 'connecting' | 'connected' | 'disconnected'
  listeners: Map<string, Set<EventCallback>>
  activeChannels: Map<string, { channel: WsChannel; params: Record<string, string> }>
}

interface WsActions {
  connect: (url: string) => void
  disconnect: () => void
  subscribe: (channel: WsChannel, params: Record<string, string>) => void
  unsubscribe: (channel: WsChannel, params: Record<string, string>) => void
  addListener: (ref: string, cb: EventCallback) => void
  removeListener: (ref: string, cb: EventCallback) => void
}

function makeRef(channel: WsChannel, params: Record<string, string>): string {
  const val = Object.values(params)[0] ?? ''
  return `${channel}:${val}`
}

export const useWsStore = create<WsState & WsActions>((set, get) => ({
  ws: null,
  status: 'disconnected',
  listeners: new Map(),
  activeChannels: new Map(),

  connect: (url: string) => {
    const ws = new WebSocket(url)
    set({ ws, status: 'connecting' })

    ws.onopen = () => {
      set({ status: 'connected' })
      // Re-subscribe all active channels on reconnect
      const { activeChannels } = get()
      for (const [, { channel, params }] of activeChannels) {
        const msg: WsClientMessage = { action: WsAction.Subscribe, channel, params }
        ws.send(JSON.stringify(msg))
      }
    }

    ws.onmessage = (e) => {
      const msg: WsServerMessage = JSON.parse(e.data)
      if (msg.channel === SYSTEM_CHANNEL) return
      const { listeners } = get()
      const cbs = listeners.get(msg.ref ?? '')
      if (cbs) {
        for (const cb of cbs) cb(msg.event, msg.data)
      }
    }

    ws.onclose = () => {
      set({ status: 'disconnected', ws: null })
      // Reconnect with backoff
      setTimeout(() => get().connect(url), 1000)
    }
  },

  disconnect: () => {
    get().ws?.close()
    set({ ws: null, status: 'disconnected', activeChannels: new Map() })
  },

  subscribe: (channel, params) => {
    const ref = makeRef(channel, params)
    const { ws, activeChannels } = get()
    activeChannels.set(ref, { channel, params })
    set({ activeChannels: new Map(activeChannels) })

    if (ws?.readyState === WebSocket.OPEN) {
      const msg: WsClientMessage = { action: WsAction.Subscribe, channel, params }
      ws.send(JSON.stringify(msg))
    }
  },

  unsubscribe: (channel, params) => {
    const ref = makeRef(channel, params)
    const { ws, activeChannels, listeners } = get()
    activeChannels.delete(ref)
    listeners.delete(ref)
    set({ activeChannels: new Map(activeChannels), listeners: new Map(listeners) })

    if (ws?.readyState === WebSocket.OPEN) {
      const msg: WsClientMessage = { action: WsAction.Unsubscribe, channel, params }
      ws.send(JSON.stringify(msg))
    }
  },

  addListener: (ref, cb) => {
    const { listeners } = get()
    const cbs = listeners.get(ref) ?? new Set()
    cbs.add(cb)
    listeners.set(ref, cbs)
    set({ listeners: new Map(listeners) })
  },

  removeListener: (ref, cb) => {
    const { listeners } = get()
    const cbs = listeners.get(ref)
    if (cbs) {
      cbs.delete(cb)
      if (cbs.size === 0) listeners.delete(ref)
      set({ listeners: new Map(listeners) })
    }
  },
}))
```

**Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/desktop/src/renderer/src/stores/use-ws-store.ts
git commit -m "feat(ws): add Zustand WebSocket store with reconnection"
```

---

### Task 9: Create useWsChannel hook

**Files:**
- Create: `apps/desktop/src/renderer/src/hooks/use-ws-channel.ts`

**Step 1: Implement the hook**

```typescript
// apps/desktop/src/renderer/src/hooks/use-ws-channel.ts
import { useEffect, useRef } from 'react'
import type { WsChannel, WsEvent } from '@agent-coding/shared'
import { useWsStore } from '../stores/use-ws-store'

type EventHandler = (event: WsEvent, data: unknown) => void

function makeRef(channel: WsChannel, params: Record<string, string>): string {
  const val = Object.values(params)[0] ?? ''
  return `${channel}:${val}`
}

/**
 * Subscribe to a WebSocket channel for the lifetime of the component.
 * Pass `null` as channel to skip subscription.
 */
export function useWsChannel(
  channel: WsChannel | null,
  params: Record<string, string>,
  onEvent: EventHandler
): void {
  const subscribe = useWsStore((s) => s.subscribe)
  const unsubscribe = useWsStore((s) => s.unsubscribe)
  const addListener = useWsStore((s) => s.addListener)
  const removeListener = useWsStore((s) => s.removeListener)

  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent

  const paramsKey = JSON.stringify(params)

  useEffect(() => {
    if (!channel) return

    const parsedParams: Record<string, string> = JSON.parse(paramsKey)
    const ref = makeRef(channel, parsedParams)
    const handler: EventHandler = (event, data) => onEventRef.current(event, data)

    subscribe(channel, parsedParams)
    addListener(ref, handler)

    return () => {
      removeListener(ref, handler)
      unsubscribe(channel, parsedParams)
    }
  }, [channel, paramsKey, subscribe, unsubscribe, addListener, removeListener])
}
```

**Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/desktop/src/renderer/src/hooks/use-ws-channel.ts
git commit -m "feat(ws): add useWsChannel hook for component-scoped subscriptions"
```

---

### Task 10: Update design doc WebSocket section

**Files:**
- Modify: `docs/plans/2026-03-07-websocket-multiplexed-design.md`

**Step 1: Add enum references to the design doc**

Add a section after "## Channel Types" noting the enum locations:

```markdown
## Enum Definitions

Enums are defined in both backend and frontend to keep the protocol typed:

- **Backend (Python):** `apps/backend/app/models/enums.py` — `WsAction`, `WsChannel`, `WsEvent`
- **Frontend (TypeScript):** `packages/shared/src/types/websocket.ts` — `WsAction`, `WsChannel`, `WsEvent`
- **Schemas:** `apps/backend/app/schemas/websocket.py` — `WsClientMessage`, `WsServerMessage`
```

**Step 2: Commit all docs**

```bash
git add docs/plans/
git commit -m "docs(ws): finalize WebSocket multiplexed design and implementation plan"
```
