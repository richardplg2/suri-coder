# Backend (`apps/backend`)

FastAPI + async SQLAlchemy + PostgreSQL + Redis (Python 3.12, uv).

## Commands

```bash
cd apps/backend
uv sync                                              # Install Python deps
cp .env.example .env                                  # First-time env setup
uv run fastapi dev app/main.py --port 8000           # Dev server
uv run pytest tests/ -v                              # Run all tests
uv run pytest tests/test_health.py -v                # Run single test file
uv run alembic upgrade head                           # Run DB migrations
uv run alembic revision --autogenerate -m "desc"     # Create migration
uv run ruff check .                                  # Lint
uv run ruff check --fix .                            # Auto-fix lint
```

## Layout

```
app/
├── main.py                  # App factory, lifespan (Redis), CORS, router registration
├── config.py                # Pydantic Settings (reads .env)
├── database.py              # Async SQLAlchemy engine + session factory, Base
├── worker.py                # Background task worker
├── seed.py                  # Database seeding
├── models/                  # SQLAlchemy ORM models
│   ├── base.py              # UUIDMixin, TimestampMixin
│   ├── enums.py             # All str enums
│   └── *.py                 # project, ticket, session, skill, workflow_*, figma, review, testing
├── schemas/                 # Pydantic request/response schemas
├── routers/                 # FastAPI route handlers
│   └── websocket.py         # WebSocket endpoint
└── services/                # Business logic
    ├── workflow_engine.py   # DAG-based step execution
    ├── agent_runner.py      # Claude agent orchestration
    ├── git_worktree.py      # Git worktree management
    └── dag_validator.py     # Workflow DAG validation
```

Requires `.env` file (copy `.env.example`): `DATABASE_URL`, `ANTHROPIC_API_KEY`, `REDIS_URL`, `JWT_SECRET`, `JWT_EXPIRE_MINUTES`, `DEBUG`.

## Model Patterns

All models inherit mixins from `models/base.py`:
- **UUIDMixin** — `id: UUID` primary key with `uuid4` default
- **TimestampMixin** — `created_at`, `updated_at` with server-side `func.now()`

### Enums

All enums are `str, enum.Enum` (serializable as strings):

| Enum | Values |
|------|--------|
| `TicketStatus` | backlog, todo, in_progress, in_review, done, cancelled |
| `TicketType` | feature, bug, improvement, chore, spike |
| `TicketPriority` | urgent, high, medium, low, none |
| `StepStatus` | pending, ready, running, completed, failed, skipped |
| `SessionStatus` | running, completed, failed, cancelled |
| `UserRole` | admin, member |

## Router Registration

Routers are registered in `main.py`. Current routers: `auth`, `projects`, `agents`, `templates`, `tickets`, `sessions`, `workflow`, `websocket`.

## Workflow Engine

`services/workflow_engine.py` implements DAG-based workflow step execution:

- **`tick(ticket_id)`** — advances the DAG: finds pending steps whose dependencies are all completed/skipped, marks them as `ready`. Auto-completes the ticket when all steps are done.
- **`start_step(step)`** — marks step as `running`, auto-progresses ticket to `in_progress`
- **`complete_step(step)`** — marks step as `completed`, then calls `tick()`
- **`fail_step(step)`** / **`skip_step(step)`** — marks step accordingly

## Lifespan

Redis connection is managed via FastAPI lifespan context manager in `main.py`. Access via `request.app.state.redis`.

## Migrations

Alembic with async SQLAlchemy. Migrations in `alembic/versions/`.
```bash
uv run alembic upgrade head                          # Apply
uv run alembic revision --autogenerate -m "desc"     # Create
```
