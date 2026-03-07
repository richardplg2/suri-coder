# Ticket System — Plan 01: Data Layer

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create all new database tables, enums, models, and schemas for the ticket system.

**Architecture:** 4 new tables (ticket_specs, ticket_spec_references, notifications, brainstorm_messages) + modifications to tickets and workflow_steps tables.

**Tech Stack:** SQLAlchemy 2.0 (async), Alembic, Pydantic v2

**Depends on:** None
**Required by:** [Plan 02](./2026-03-08-ticket-system-plan-02-notifications.md), [Plan 03](./2026-03-08-ticket-system-plan-03-spec-management.md), [Plan 04](./2026-03-08-ticket-system-plan-04-project-seeding.md)

---

## Task 1: Add new enums

**Files:**
- Modify: `apps/backend/app/models/enums.py`

Add these enums to the end of the file:

```python
class SpecType(str, enum.Enum):
    feature = "feature"
    design = "design"
    plan = "plan"
    test = "test"


class SpecRefType(str, enum.Enum):
    derives_from = "derives_from"
    implements = "implements"
    verifies = "verifies"
    relates_to = "relates_to"


class BrainstormMessageType(str, enum.Enum):
    text = "text"
    quiz = "quiz"
    summary = "summary"
    figma_context = "figma_context"


class BrainstormRole(str, enum.Enum):
    user = "user"
    assistant = "assistant"
    system = "system"


class TicketSource(str, enum.Enum):
    ai_brainstorm = "ai_brainstorm"
    figma = "figma"
    manual = "manual"
```

**Steps:**
1. Add enums to `apps/backend/app/models/enums.py`
2. Run `cd apps/backend && uv run ruff check app/models/enums.py` — Expected: no errors
3. Commit: `git add apps/backend/app/models/enums.py && git commit -m "feat(backend): add ticket system enums"`

---

## Task 2: Create TicketSpec model

**Files:**
- Create: `apps/backend/app/models/ticket_spec.py`

```python
from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin, UUIDMixin
from app.models.enums import SpecRefType, SpecType

if TYPE_CHECKING:
    from app.models.ticket import Ticket
    from app.models.user import User
    from app.models.workflow_step import WorkflowStep


class TicketSpec(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "ticket_specs"

    ticket_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tickets.id", ondelete="CASCADE"), index=True
    )
    type: Mapped[SpecType] = mapped_column()
    title: Mapped[str] = mapped_column(String(255))
    content: Mapped[str] = mapped_column(Text)
    revision: Mapped[int] = mapped_column(Integer, default=1)
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    agent_step_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("workflow_steps.id"), nullable=True
    )

    # Relationships
    ticket: Mapped["Ticket"] = relationship(back_populates="specs")
    creator: Mapped["User"] = relationship()
    agent_step: Mapped["WorkflowStep | None"] = relationship()
    source_references: Mapped[list["TicketSpecReference"]] = relationship(
        foreign_keys="TicketSpecReference.source_spec_id",
        back_populates="source_spec",
        cascade="all, delete-orphan",
    )
    target_references: Mapped[list["TicketSpecReference"]] = relationship(
        foreign_keys="TicketSpecReference.target_spec_id",
        back_populates="target_spec",
        cascade="all, delete-orphan",
    )
```

**Steps:**
1. Create the file at `apps/backend/app/models/ticket_spec.py`
2. Run `cd apps/backend && uv run ruff check app/models/ticket_spec.py` — Expected: no errors
3. Commit: `git add apps/backend/app/models/ticket_spec.py && git commit -m "feat(backend): add TicketSpec model"`

---

## Task 3: Create TicketSpecReference model

**Files:**
- Modify: `apps/backend/app/models/ticket_spec.py` (add to same file)

Append this class to the end of `apps/backend/app/models/ticket_spec.py`:

```python
class TicketSpecReference(UUIDMixin, Base):
    __tablename__ = "ticket_spec_references"

    source_spec_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("ticket_specs.id", ondelete="CASCADE"), index=True
    )
    target_spec_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("ticket_specs.id", ondelete="CASCADE"), index=True
    )
    ref_type: Mapped[SpecRefType] = mapped_column()
    section: Mapped[str | None] = mapped_column(String(255), nullable=True)

    source_spec: Mapped["TicketSpec"] = relationship(
        foreign_keys=[source_spec_id], back_populates="source_references"
    )
    target_spec: Mapped["TicketSpec"] = relationship(
        foreign_keys=[target_spec_id], back_populates="target_references"
    )
```

**Steps:**
1. Append TicketSpecReference class to `apps/backend/app/models/ticket_spec.py`
2. Run `cd apps/backend && uv run ruff check app/models/ticket_spec.py` — Expected: no errors
3. Commit: `git add apps/backend/app/models/ticket_spec.py && git commit -m "feat(backend): add TicketSpecReference model"`

---

## Task 4: Create Notification model

**Files:**
- Create: `apps/backend/app/models/notification.py`

```python
from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.user import User


class Notification(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "notifications"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    type: Mapped[str] = mapped_column(String(50))
    title: Mapped[str] = mapped_column(String(255))
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    resource_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    resource_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True)
    read: Mapped[bool] = mapped_column(Boolean, default=False)

    user: Mapped["User"] = relationship()
```

**Steps:**
1. Create the file at `apps/backend/app/models/notification.py`
2. Run `cd apps/backend && uv run ruff check app/models/notification.py` — Expected: no errors
3. Commit: `git add apps/backend/app/models/notification.py && git commit -m "feat(backend): add Notification model"`

---

## Task 5: Create BrainstormMessage model

**Files:**
- Create: `apps/backend/app/models/brainstorm_message.py`

```python
from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import JSON, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin, UUIDMixin
from app.models.enums import BrainstormMessageType, BrainstormRole

if TYPE_CHECKING:
    from app.models.ticket import Ticket


class BrainstormMessage(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "brainstorm_messages"

    ticket_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("tickets.id", ondelete="CASCADE"), nullable=True, index=True
    )
    session_id: Mapped[str] = mapped_column(String(255), index=True)
    role: Mapped[BrainstormRole] = mapped_column()
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    message_type: Mapped[BrainstormMessageType] = mapped_column(
        default=BrainstormMessageType.text
    )
    structured_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    ticket: Mapped["Ticket | None"] = relationship()
```

Note: `ticket_id` is nullable because brainstorm messages are created before the ticket exists. `session_id` links messages to a brainstorm session.

**Steps:**
1. Create the file at `apps/backend/app/models/brainstorm_message.py`
2. Run `cd apps/backend && uv run ruff check app/models/brainstorm_message.py` — Expected: no errors
3. Commit: `git add apps/backend/app/models/brainstorm_message.py && git commit -m "feat(backend): add BrainstormMessage model"`

---

## Task 6: Modify Ticket model — add new fields

**Files:**
- Modify: `apps/backend/app/models/ticket.py`

Add these imports to the existing import block:

```python
from sqlalchemy import Boolean, ForeignKey, JSON, Numeric, String, Text
from app.models.enums import TicketPriority, TicketSource, TicketStatus, TicketType
```

Add `TicketSpec` to the `TYPE_CHECKING` block:

```python
if TYPE_CHECKING:
    from app.models.ticket_spec import TicketSpec
    from app.models.workflow_step import WorkflowStep
```

Add these fields to the `Ticket` class (after the existing `created_by` field):

```python
    auto_approval: Mapped[bool] = mapped_column(Boolean, default=False)
    source: Mapped[TicketSource] = mapped_column(default=TicketSource.manual)
    figma_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
```

Add this relationship (after the existing `steps` relationship):

```python
    specs: Mapped[list["TicketSpec"]] = relationship(
        back_populates="ticket", cascade="all, delete-orphan"
    )
```

**Steps:**
1. Modify `apps/backend/app/models/ticket.py` to add imports, fields, and relationship
2. Run `cd apps/backend && uv run ruff check app/models/ticket.py` — Expected: no errors
3. Commit: `git add apps/backend/app/models/ticket.py && git commit -m "feat(backend): add ticket system fields to Ticket model"`

---

## Task 7: Modify WorkflowStep model — add new fields

**Files:**
- Modify: `apps/backend/app/models/workflow_step.py`

Add these fields to the `WorkflowStep` class (after the existing `step_breakdown` field):

```python
    auto_approval: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    retry_count: Mapped[int] = mapped_column(Integer, default=0)
    max_retries: Mapped[int] = mapped_column(Integer, default=2)
    parent_step_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("workflow_steps.id"), nullable=True
    )
    repo_ids: Mapped[list | None] = mapped_column(JSON, nullable=True)
```

**Steps:**
1. Modify `apps/backend/app/models/workflow_step.py` to add new fields
2. Run `cd apps/backend && uv run ruff check app/models/workflow_step.py` — Expected: no errors
3. Commit: `git add apps/backend/app/models/workflow_step.py && git commit -m "feat(backend): add ticket system fields to WorkflowStep model"`

---

## Task 8: Update models/__init__.py

**Files:**
- Modify: `apps/backend/app/models/__init__.py`

Add these imports:

```python
from app.models.brainstorm_message import BrainstormMessage
from app.models.notification import Notification
from app.models.ticket_spec import TicketSpec, TicketSpecReference
```

Add to `__all__`:

```python
    "TicketSpec",
    "TicketSpecReference",
    "Notification",
    "BrainstormMessage",
```

The full updated file should be:

```python
from app.models.agent_config import AgentConfig, AgentSkill
from app.models.brainstorm_message import BrainstormMessage
from app.models.figma import FigmaNode, FigmaTask
from app.models.github_account import UserGitHubAccount
from app.models.notification import Notification
from app.models.project import Project, ProjectMember
from app.models.project_repository import ProjectRepository
from app.models.review import FileReview, ReviewSession
from app.models.session import Session, SessionMessage
from app.models.skill import Skill
from app.models.step_review import StepReview
from app.models.testing import TestResult, TestRun
from app.models.ticket import Ticket
from app.models.ticket_spec import TicketSpec, TicketSpecReference
from app.models.user import User
from app.models.workflow_step import WorkflowStep, WorkflowStepDependency
from app.models.workflow_template import WorkflowTemplate

__all__ = [
    "User",
    "Project",
    "ProjectMember",
    "Skill",
    "AgentConfig",
    "AgentSkill",
    "WorkflowTemplate",
    "Ticket",
    "WorkflowStep",
    "WorkflowStepDependency",
    "Session",
    "SessionMessage",
    "FigmaTask",
    "FigmaNode",
    "TestRun",
    "TestResult",
    "ReviewSession",
    "FileReview",
    "StepReview",
    "UserGitHubAccount",
    "ProjectRepository",
    "TicketSpec",
    "TicketSpecReference",
    "Notification",
    "BrainstormMessage",
]
```

**Steps:**
1. Modify `apps/backend/app/models/__init__.py`
2. Run `cd apps/backend && uv run ruff check app/models/__init__.py` — Expected: no errors
3. Commit: `git add apps/backend/app/models/__init__.py && git commit -m "feat(backend): register new models in __init__"`

---

## Task 9: Create Alembic migration

**Steps:**
1. Run `cd apps/backend && uv run alembic revision --autogenerate -m "add ticket system tables"` — Expected: generates a new migration file in `apps/backend/alembic/versions/`
2. Review the generated migration file — it should contain:
   - `op.create_table("ticket_specs", ...)` with columns: id, ticket_id, type, title, content, revision, created_by, agent_step_id, created_at, updated_at
   - `op.create_table("ticket_spec_references", ...)` with columns: id, source_spec_id, target_spec_id, ref_type, section
   - `op.create_table("notifications", ...)` with columns: id, user_id, type, title, body, resource_type, resource_id, read, created_at, updated_at
   - `op.create_table("brainstorm_messages", ...)` with columns: id, ticket_id, session_id, role, content, message_type, structured_data, created_at, updated_at
   - `op.add_column("tickets", sa.Column("auto_approval", ...))`
   - `op.add_column("tickets", sa.Column("source", ...))`
   - `op.add_column("tickets", sa.Column("figma_data", ...))`
   - `op.add_column("workflow_steps", sa.Column("auto_approval", ...))`
   - `op.add_column("workflow_steps", sa.Column("retry_count", ...))`
   - `op.add_column("workflow_steps", sa.Column("max_retries", ...))`
   - `op.add_column("workflow_steps", sa.Column("parent_step_id", ...))`
   - `op.add_column("workflow_steps", sa.Column("repo_ids", ...))`
3. Run `cd apps/backend && uv run alembic upgrade head` — Expected: migration applies successfully
4. Verify: `cd apps/backend && uv run alembic current` — Expected: should show the new revision as head
5. Commit: `git add apps/backend/alembic/versions/ && git commit -m "feat(backend): add ticket system migration"`

---

## Task 10: Create Pydantic schemas

**Files:**
- Create: `apps/backend/app/schemas/ticket_spec.py`
- Create: `apps/backend/app/schemas/notification.py`
- Create: `apps/backend/app/schemas/brainstorm.py`
- Modify: `apps/backend/app/schemas/ticket.py` (add new fields to TicketCreate/TicketUpdate/TicketResponse)
- Modify: `apps/backend/app/schemas/workflow_template.py` (add condition, expandable to StepConfig)

### `apps/backend/app/schemas/ticket_spec.py`

```python
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class SpecReferenceCreate(BaseModel):
    target_spec_id: uuid.UUID
    ref_type: str  # derives_from, implements, verifies, relates_to
    section: str | None = None


class SpecCreate(BaseModel):
    type: str  # feature, design, plan, test
    title: str
    content: str
    references: list[SpecReferenceCreate] | None = None


class SpecUpdate(BaseModel):
    content: str
    title: str | None = None


class SpecReferenceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    source_spec_id: uuid.UUID
    target_spec_id: uuid.UUID
    ref_type: str
    section: str | None


class SpecResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    ticket_id: uuid.UUID
    type: str
    title: str
    content: str
    revision: int
    created_by: uuid.UUID
    agent_step_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime


class SpecDetailResponse(SpecResponse):
    source_references: list[SpecReferenceResponse]
    target_references: list[SpecReferenceResponse]
```

### `apps/backend/app/schemas/notification.py`

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
    resource_id: uuid.UUID | None
    read: bool
    created_at: datetime


class NotificationUpdate(BaseModel):
    read: bool


class UnreadCountResponse(BaseModel):
    count: int
```

### `apps/backend/app/schemas/brainstorm.py`

```python
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class QuizOption(BaseModel):
    id: str
    label: str
    description: str
    recommended: bool = False
    recommendation_reason: str | None = None


class QuizData(BaseModel):
    question: str
    context: str
    options: list[QuizOption]
    allow_multiple: bool = False
    allow_custom: bool = True


class BrainstormStartRequest(BaseModel):
    source: str  # "ai" or "figma"
    initial_message: str | None = None
    figma_data: dict | None = None


class BrainstormMessageRequest(BaseModel):
    content: str | None = None
    quiz_response: dict | None = None  # { option_ids: [], custom_text: "" }


class BrainstormBatchUpdateRequest(BaseModel):
    comments: list[dict]  # [{ section_id, text }]


class CreateTicketFromBrainstormRequest(BaseModel):
    title: str
    type: str  # feature, bug, etc
    priority: str  # none, low, medium, high, urgent
    template_id: uuid.UUID | None = None


class BrainstormMessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    session_id: str
    role: str
    content: str | None
    message_type: str
    structured_data: dict | None
    created_at: datetime


class BrainstormSessionResponse(BaseModel):
    session_id: str
    first_message: BrainstormMessageResponse | None = None
```

### Modify `apps/backend/app/schemas/ticket.py`

Add `TicketSource` to the import from `app.models.enums`:

```python
from app.models.enums import (
    StepStatus,
    TicketPriority,
    TicketSource,
    TicketStatus,
    TicketType,
)
```

Add new fields to `TicketCreate` (after `auto_execute`):

```python
    source: TicketSource = TicketSource.manual
    figma_data: dict | None = None
```

Add new field to `TicketUpdate` (after `auto_execute`):

```python
    auto_approval: bool | None = None
```

Add new fields to `TicketResponse` (after `auto_execute`):

```python
    auto_approval: bool
    source: TicketSource
    figma_data: dict | None
```

### Modify `apps/backend/app/schemas/workflow_template.py`

Add new fields to `StepConfig` (after `description`):

```python
    condition: str | None = None
    expandable: bool = False
```

**Steps:**
1. Create `apps/backend/app/schemas/ticket_spec.py`
2. Create `apps/backend/app/schemas/notification.py`
3. Create `apps/backend/app/schemas/brainstorm.py`
4. Modify `apps/backend/app/schemas/ticket.py` to add new fields
5. Modify `apps/backend/app/schemas/workflow_template.py` to add new fields to StepConfig
6. Run `cd apps/backend && uv run ruff check app/schemas/ticket_spec.py app/schemas/notification.py app/schemas/brainstorm.py app/schemas/ticket.py app/schemas/workflow_template.py` — Expected: no errors
7. Run `cd apps/backend && uv run pytest tests/ -v --co` — Expected: test collection succeeds (imports work)
8. Commit: `git add apps/backend/app/schemas/ && git commit -m "feat(backend): add ticket system Pydantic schemas"`

---

## Task 11: Add new WebSocket channels and events

**Files:**
- Modify: `packages/shared/src/types/websocket.ts`

Add to `WsChannel` (before `} as const`):

```typescript
  BrainstormSession: 'brainstorm:session',
  Notifications: 'notifications',
```

Add to `WsEvent` (before `} as const`):

```typescript
  // Brainstorm
  BrainstormMessage: 'brainstorm_message',
  BrainstormQuiz: 'brainstorm_quiz',
  BrainstormSummary: 'brainstorm_summary',

  // Notifications
  NewNotification: 'new_notification',
  UnreadCountChanged: 'unread_count_changed',

  // Specs
  SpecCreated: 'spec_created',
  SpecUpdated: 'spec_updated',

  // Escalation
  EscalationTriggered: 'escalation_triggered',
```

The full updated `WsChannel` should be:

```typescript
export const WsChannel = {
  ProjectTickets: 'project:tickets',
  TicketProgress: 'ticket:progress',
  SessionStream: 'session:stream',
  BrainstormSession: 'brainstorm:session',
  Notifications: 'notifications',
} as const
```

The full updated `WsEvent` should be:

```typescript
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

  // Brainstorm
  BrainstormMessage: 'brainstorm_message',
  BrainstormQuiz: 'brainstorm_quiz',
  BrainstormSummary: 'brainstorm_summary',

  // Notifications
  NewNotification: 'new_notification',
  UnreadCountChanged: 'unread_count_changed',

  // Specs
  SpecCreated: 'spec_created',
  SpecUpdated: 'spec_updated',

  // Escalation
  EscalationTriggered: 'escalation_triggered',
} as const
```

**Steps:**
1. Modify `packages/shared/src/types/websocket.ts`
2. Run `pnpm typecheck` from repo root — Expected: no type errors
3. Commit: `git add packages/shared/src/types/websocket.ts && git commit -m "feat(shared): add brainstorm and notification WebSocket channels"`

---

## Task 12: Add frontend TypeScript types

**Files:**
- Modify: `apps/desktop/src/renderer/types/api.ts`

Add these types at the end of the file (before the closing, or appended):

```typescript
// Specs
export type SpecType = 'feature' | 'design' | 'plan' | 'test'
export type SpecRefType = 'derives_from' | 'implements' | 'verifies' | 'relates_to'

export interface TicketSpec {
  id: string
  ticket_id: string
  type: SpecType
  title: string
  content: string
  revision: number
  created_by: string
  agent_step_id: string | null
  created_at: string
  updated_at: string
}

export interface SpecReference {
  id: string
  source_spec_id: string
  target_spec_id: string
  ref_type: SpecRefType
  section: string | null
}

export interface TicketSpecDetail extends TicketSpec {
  source_references: SpecReference[]
  target_references: SpecReference[]
}

// Notifications
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

// Brainstorm
export interface QuizOption {
  id: string
  label: string
  description: string
  recommended: boolean
  recommendation_reason: string | null
}

export interface QuizData {
  question: string
  context: string
  options: QuizOption[]
  allow_multiple: boolean
  allow_custom: boolean
}

export type BrainstormMessageType = 'text' | 'quiz' | 'summary' | 'figma_context'

export interface BrainstormMessage {
  id: string
  session_id: string
  role: 'user' | 'assistant' | 'system'
  content: string | null
  message_type: BrainstormMessageType
  structured_data: QuizData | Record<string, unknown> | null
  created_at: string
}

export type TicketSource = 'ai_brainstorm' | 'figma' | 'manual'
```

Update the existing `Ticket` interface to add new fields (after `auto_execute: boolean`):

```typescript
  auto_approval: boolean
  source: TicketSource
  figma_data: Record<string, unknown> | null
```

Update the existing `TicketCreate` interface to add new fields (after `auto_execute`):

```typescript
  source?: TicketSource
  figma_data?: Record<string, unknown> | null
```

Update the existing `TicketUpdate` interface to add new field (after `auto_execute`):

```typescript
  auto_approval?: boolean | null
```

**Steps:**
1. Modify `apps/desktop/src/renderer/types/api.ts`
2. Run `pnpm typecheck` from repo root — Expected: no type errors (may show existing unrelated errors; new types should not introduce new ones)
3. Commit: `git add apps/desktop/src/renderer/types/api.ts && git commit -m "feat(desktop): add ticket system TypeScript types"`
