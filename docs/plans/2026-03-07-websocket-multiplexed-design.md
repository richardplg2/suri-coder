# WebSocket Multiplexed Connection Design

## Decision

Use a single multiplexed WebSocket endpoint (`/ws`) instead of multiple per-resource endpoints. Clients subscribe/unsubscribe to channels dynamically over one connection.

**Replaces** the 3-endpoint design in the project-ticket-workflow plan:
- ~~`/ws/app`~~
- ~~`/ws/sessions/:id`~~
- ~~`/ws/tickets/:id`~~

## Protocol

### Client → Server

```json
{"action": "subscribe", "channel": "project:tickets", "params": {"project_id": "uuid"}}
{"action": "subscribe", "channel": "ticket:progress", "params": {"ticket_id": "uuid"}}
{"action": "subscribe", "channel": "session:stream", "params": {"session_id": "uuid"}}
{"action": "unsubscribe", "channel": "session:stream", "params": {"session_id": "uuid"}}
{"action": "ping"}
```

### Server → Client

```json
{"channel": "session:stream", "ref": "session:abc-123", "event": "message", "data": {...}}
{"channel": "_system", "event": "subscribed", "ref": "session:abc-123"}
{"channel": "_system", "event": "unsubscribed", "ref": "session:abc-123"}
{"channel": "_system", "event": "error", "data": {"message": "invalid channel"}}
{"channel": "_system", "event": "pong"}
```

## Channel Types

| Channel | Params | Redis key pattern | Events |
|---------|--------|-------------------|--------|
| `project:tickets` | `project_id` | `project:{id}:tickets` | `ticket_created`, `ticket_updated`, `step_status_changed` |
| `ticket:progress` | `ticket_id` | `ticket:{id}` | `step_started`, `step_completed`, `step_failed`, `workflow_completed` |
| `session:stream` | `session_id` | `session:{id}` | `message`, `tool_use`, `cost_update`, `completed`, `failed` |

## Enum Definitions

Enums are defined in both backend and frontend to keep the protocol typed:

- **Backend (Python):** `apps/backend/app/models/enums.py` — `WsAction`, `WsChannel`, `WsEvent`
- **Frontend (TypeScript):** `packages/shared/src/types/websocket.ts` — `WsAction`, `WsChannel`, `WsEvent`
- **Schemas:** `apps/backend/app/schemas/websocket.py` — `WsClientMessage`, `WsServerMessage`

## Server Architecture

### ConnectionManager

One instance per connected client. Manages subscriptions and bridges Redis pubsub to the WebSocket.

```python
# app/services/ws_manager.py

CHANNEL_MAP = {
    "project:tickets": lambda p: f"project:{p['project_id']}:tickets",
    "ticket:progress": lambda p: f"ticket:{p['ticket_id']}",
    "session:stream":  lambda p: f"session:{p['session_id']}",
}

class ConnectionManager:
    def __init__(self, websocket: WebSocket, redis: Redis):
        self.websocket = websocket
        self.redis = redis
        self.pubsub = redis.pubsub()
        self.subscriptions: dict[str, str] = {}  # redis_key -> channel name

    async def handle(self):
        async with TaskGroup() as tg:
            tg.create_task(self._read_client())
            tg.create_task(self._read_redis())

    async def subscribe(self, channel: str, params: dict):
        redis_key = CHANNEL_MAP[channel](params)
        ref = self._to_ref(channel, params)
        await self.pubsub.subscribe(redis_key)
        self.subscriptions[redis_key] = channel
        await self._send(channel="_system", event="subscribed", ref=ref)

    async def unsubscribe(self, channel: str, params: dict):
        redis_key = CHANNEL_MAP[channel](params)
        ref = self._to_ref(channel, params)
        await self.pubsub.unsubscribe(redis_key)
        self.subscriptions.pop(redis_key, None)
        await self._send(channel="_system", event="unsubscribed", ref=ref)

    async def cleanup(self):
        for key in list(self.subscriptions):
            await self.pubsub.unsubscribe(key)
        await self.redis.aclose()
```

### Router

```python
# app/routers/websocket.py

@router.websocket("/ws")
async def ws_endpoint(websocket: WebSocket):
    await websocket.accept()
    r = aioredis.from_url(settings.redis_url)
    manager = ConnectionManager(websocket, r)
    try:
        await manager.handle()
    except WebSocketDisconnect:
        pass
    finally:
        await manager.cleanup()
```

### Publishing Side

Workers publish JSON with `event` and `data` fields. The ConnectionManager wraps with `channel` and `ref` before forwarding.

```python
# In workflow_engine.py or worker.py
await redis.publish(f"ticket:{ticket_id}", json.dumps({
    "event": "step_completed",
    "data": {"step_id": str(step.id), "status": "completed"}
}))
```

## Frontend Integration

### WebSocket Store (Zustand)

```typescript
// stores/use-ws-store.ts
interface WsStore {
  ws: WebSocket | null
  status: 'connecting' | 'connected' | 'disconnected'
  subscriptions: Map<string, Set<(event: string, data: unknown) => void>>
  connect: () => void
  subscribe: (channel: string, params: Record<string, string>) => void
  unsubscribe: (channel: string, params: Record<string, string>) => void
  addListener: (ref: string, cb: (event: string, data: unknown) => void) => void
  removeListener: (ref: string, cb: (event: string, data: unknown) => void) => void
}
```

Reconnection with exponential backoff. On reconnect, re-sends all active subscriptions.

### Channel Hook

```typescript
// hooks/use-ws-channel.ts
function useWsChannel(
  channel: string | null,
  params: Record<string, string>,
  onEvent: (event: string, data: unknown) => void
) {
  const { subscribe, unsubscribe, addListener, removeListener } = useWsStore()

  useEffect(() => {
    if (!channel) return
    subscribe(channel, params)
    const ref = toRef(channel, params)
    addListener(ref, onEvent)
    return () => {
      removeListener(ref, onEvent)
      unsubscribe(channel, params)
    }
  }, [channel, JSON.stringify(params)])
}
```

### TanStack Query Integration

WebSocket events invalidate or optimistically update query caches:

```typescript
// Ticket board — invalidate list on changes
useWsChannel('project:tickets', { project_id: id }, (event) => {
  if (event === 'ticket_updated' || event === 'step_status_changed') {
    queryClient.invalidateQueries({ queryKey: ['projects', id, 'tickets'] })
  }
})

// Session detail — append messages optimistically
useWsChannel('session:stream', { session_id: id }, (event, data) => {
  if (event === 'message') {
    queryClient.setQueryData(['sessions', id, 'messages'], (old) => [...old, data])
  }
})
```

### Usage Example — Ticket Detail

```typescript
function TicketDetail({ ticketId }: { ticketId: string }) {
  const { data: ticket } = useTicket(ticketId)
  const activeSessionId = ticket?.activeStep?.session?.id

  useWsChannel('ticket:progress', { ticket_id: ticketId }, handleTicketEvent)
  useWsChannel(
    activeSessionId ? 'session:stream' : null,
    { session_id: activeSessionId ?? '' },
    handleSessionEvent
  )
}
```
