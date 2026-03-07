# Ticket System — Plan 03: Spec Management

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build spec CRUD service, API endpoints, spec reference management, and scoped custom MCP tools for agent spec access.

**Architecture:** Specs stored in DB with revision history. References link specs for traceability. Custom MCP tools (via create_sdk_mcp_server) provide scoped read/write access for agents.

**Tech Stack:** FastAPI, SQLAlchemy, Claude Agent SDK (create_sdk_mcp_server, @tool decorator)

**Depends on:** [Plan 01: Data Layer](./2026-03-08-ticket-system-plan-01-data-layer.md)
**Required by:** [Plan 05: Workflow Engine](./2026-03-08-ticket-system-plan-05-workflow-engine.md), [Plan 06: Brainstorm Backend](./2026-03-08-ticket-system-plan-06-brainstorm-backend.md)

---

## Task 1: Create spec service

**Files:**
- Create: `apps/backend/app/services/spec.py`

```python
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.ticket_spec import TicketSpec, TicketSpecReference


class SpecService:
    @staticmethod
    async def create_spec(
        db: AsyncSession,
        ticket_id: uuid.UUID,
        type: str,
        title: str,
        content: str,
        created_by: uuid.UUID | None,
        agent_step_id: uuid.UUID | None = None,
        references: list[dict] | None = None,
    ) -> TicketSpec:
        """Create a new spec with optional references.

        references: list of {"target_spec_id": uuid, "ref_type": str, "section": str|None}
        """
        spec = TicketSpec(
            ticket_id=ticket_id,
            type=type,
            title=title,
            content=content,
            revision=1,
            created_by=created_by,
            agent_step_id=agent_step_id,
        )
        db.add(spec)
        await db.flush()

        if references:
            for ref in references:
                spec_ref = TicketSpecReference(
                    source_spec_id=spec.id,
                    target_spec_id=ref["target_spec_id"],
                    ref_type=ref["ref_type"],
                    section=ref.get("section"),
                )
                db.add(spec_ref)

        await db.commit()
        await db.refresh(spec)
        return spec

    @staticmethod
    async def update_spec(
        db: AsyncSession,
        spec_id: uuid.UUID,
        content: str,
        title: str | None = None,
    ) -> TicketSpec:
        """Create a NEW TicketSpec record with revision+1 (versioned, not in-place update)."""
        result = await db.execute(
            select(TicketSpec).where(TicketSpec.id == spec_id)
        )
        current = result.scalar_one()

        new_spec = TicketSpec(
            ticket_id=current.ticket_id,
            type=current.type,
            title=title if title is not None else current.title,
            content=content,
            revision=current.revision + 1,
            created_by=current.created_by,
            agent_step_id=current.agent_step_id,
        )
        db.add(new_spec)
        await db.commit()
        await db.refresh(new_spec)
        return new_spec

    @staticmethod
    async def get_spec(
        db: AsyncSession,
        spec_id: uuid.UUID,
    ) -> TicketSpec | None:
        """Get a single spec with its source and target references loaded."""
        result = await db.execute(
            select(TicketSpec)
            .where(TicketSpec.id == spec_id)
            .options(
                selectinload(TicketSpec.source_references),
                selectinload(TicketSpec.target_references),
            )
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def get_specs(
        db: AsyncSession,
        ticket_id: uuid.UUID,
        type: str | None = None,
    ) -> list[TicketSpec]:
        """List specs for a ticket, latest revision each.

        Groups by (ticket_id, type) and returns only the highest revision per group.
        Optionally filtered by spec type.
        """
        from sqlalchemy import func

        # Subquery: max revision per (ticket_id, type)
        max_rev = (
            select(
                TicketSpec.ticket_id,
                TicketSpec.type,
                func.max(TicketSpec.revision).label("max_revision"),
            )
            .where(TicketSpec.ticket_id == ticket_id)
            .group_by(TicketSpec.ticket_id, TicketSpec.type)
        )

        if type is not None:
            max_rev = max_rev.where(TicketSpec.type == type)

        max_rev_sub = max_rev.subquery()

        stmt = (
            select(TicketSpec)
            .join(
                max_rev_sub,
                (TicketSpec.ticket_id == max_rev_sub.c.ticket_id)
                & (TicketSpec.type == max_rev_sub.c.type)
                & (TicketSpec.revision == max_rev_sub.c.max_revision),
            )
            .order_by(TicketSpec.type)
        )

        result = await db.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def get_spec_history(
        db: AsyncSession,
        spec_id: uuid.UUID,
    ) -> list[TicketSpec]:
        """Get all revisions of a spec (same ticket_id + type), ordered by revision desc."""
        # First, get the spec to know its ticket_id and type
        result = await db.execute(
            select(TicketSpec).where(TicketSpec.id == spec_id)
        )
        spec = result.scalar_one_or_none()
        if spec is None:
            return []

        stmt = (
            select(TicketSpec)
            .where(
                TicketSpec.ticket_id == spec.ticket_id,
                TicketSpec.type == spec.type,
            )
            .order_by(TicketSpec.revision.desc())
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def get_latest_spec(
        db: AsyncSession,
        ticket_id: uuid.UUID,
        type: str,
    ) -> TicketSpec | None:
        """Get the latest revision of a specific spec type for a ticket."""
        stmt = (
            select(TicketSpec)
            .where(
                TicketSpec.ticket_id == ticket_id,
                TicketSpec.type == type,
            )
            .order_by(TicketSpec.revision.desc())
            .limit(1)
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def add_reference(
        db: AsyncSession,
        source_spec_id: uuid.UUID,
        target_spec_id: uuid.UUID,
        ref_type: str,
        section: str | None = None,
    ) -> TicketSpecReference:
        """Create a reference link between two specs."""
        ref = TicketSpecReference(
            source_spec_id=source_spec_id,
            target_spec_id=target_spec_id,
            ref_type=ref_type,
            section=section,
        )
        db.add(ref)
        await db.commit()
        await db.refresh(ref)
        return ref

    @staticmethod
    async def remove_reference(
        db: AsyncSession,
        reference_id: uuid.UUID,
    ) -> None:
        """Delete a reference link."""
        result = await db.execute(
            select(TicketSpecReference).where(
                TicketSpecReference.id == reference_id
            )
        )
        ref = result.scalar_one_or_none()
        if ref:
            await db.delete(ref)
            await db.commit()
```

**Steps:**
1. Create the file at `apps/backend/app/services/spec.py`
2. Run `cd apps/backend && uv run ruff check app/services/spec.py` — Expected: no errors
3. Commit: `git add apps/backend/app/services/spec.py && git commit -m "feat(backend): add spec CRUD service with versioning"`

---

## Task 2: Create spec router

**Files:**
- Create: `apps/backend/app/routers/specs.py`
- Modify: `apps/backend/app/main.py`

### `apps/backend/app/routers/specs.py`

```python
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.ticket_spec import (
    SpecCreate,
    SpecDetailResponse,
    SpecResponse,
    SpecUpdate,
)
from app.services.auth import get_current_user
from app.services.spec import SpecService
from app.services.ticket import get_ticket

router = APIRouter(tags=["specs"])


async def _require_ticket(
    ticket_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Validate ticket exists and user is authenticated. Returns (ticket, user, db)."""
    ticket = await get_ticket(db, ticket_id)
    if ticket is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found",
        )
    return ticket, user, db


@router.get(
    "/tickets/{ticket_id}/specs",
    response_model=list[SpecResponse],
)
async def list_specs(
    ticket_id: uuid.UUID,
    type: str | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[SpecResponse]:
    ticket = await get_ticket(db, ticket_id)
    if ticket is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found",
        )
    specs = await SpecService.get_specs(db, ticket_id, type=type)
    return [SpecResponse.model_validate(s) for s in specs]


@router.get(
    "/tickets/{ticket_id}/specs/{spec_id}",
    response_model=SpecDetailResponse,
)
async def get_spec_detail(
    ticket_id: uuid.UUID,
    spec_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SpecDetailResponse:
    ticket = await get_ticket(db, ticket_id)
    if ticket is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found",
        )
    spec = await SpecService.get_spec(db, spec_id)
    if spec is None or spec.ticket_id != ticket_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Spec not found",
        )
    return SpecDetailResponse.model_validate(spec)


@router.get(
    "/tickets/{ticket_id}/specs/{spec_id}/history",
    response_model=list[SpecResponse],
)
async def get_spec_history(
    ticket_id: uuid.UUID,
    spec_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[SpecResponse]:
    ticket = await get_ticket(db, ticket_id)
    if ticket is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found",
        )
    spec = await SpecService.get_spec(db, spec_id)
    if spec is None or spec.ticket_id != ticket_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Spec not found",
        )
    history = await SpecService.get_spec_history(db, spec_id)
    return [SpecResponse.model_validate(s) for s in history]


@router.post(
    "/tickets/{ticket_id}/specs",
    response_model=SpecResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_spec(
    ticket_id: uuid.UUID,
    data: SpecCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SpecResponse:
    ticket = await get_ticket(db, ticket_id)
    if ticket is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found",
        )
    references = None
    if data.references:
        references = [
            {
                "target_spec_id": ref.target_spec_id,
                "ref_type": ref.ref_type,
                "section": ref.section,
            }
            for ref in data.references
        ]
    spec = await SpecService.create_spec(
        db,
        ticket_id=ticket_id,
        type=data.type,
        title=data.title,
        content=data.content,
        created_by=user.id,
        references=references,
    )
    return SpecResponse.model_validate(spec)


@router.put(
    "/tickets/{ticket_id}/specs/{spec_id}",
    response_model=SpecResponse,
)
async def update_spec(
    ticket_id: uuid.UUID,
    spec_id: uuid.UUID,
    data: SpecUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SpecResponse:
    ticket = await get_ticket(db, ticket_id)
    if ticket is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found",
        )
    existing = await SpecService.get_spec(db, spec_id)
    if existing is None or existing.ticket_id != ticket_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Spec not found",
        )
    new_spec = await SpecService.update_spec(
        db,
        spec_id=spec_id,
        content=data.content,
        title=data.title,
    )
    return SpecResponse.model_validate(new_spec)
```

### Modify `apps/backend/app/main.py`

Add to the imports:

```python
from app.routers import (
    agents,
    auth,
    github,
    projects,
    sessions,
    specs,
    templates,
    tickets,
    websocket,
    workflow,
)
```

Add after the `app.include_router(tickets.router)` line:

```python
app.include_router(specs.router)
```

**Steps:**
1. Create `apps/backend/app/routers/specs.py`
2. Modify `apps/backend/app/main.py` — add `specs` import and `app.include_router(specs.router)`
3. Run `cd apps/backend && uv run ruff check app/routers/specs.py app/main.py` — Expected: no errors
4. Commit: `git add apps/backend/app/routers/specs.py apps/backend/app/main.py && git commit -m "feat(backend): add spec CRUD router and register in main"`

---

## Task 3: Build scoped custom MCP tools

**Files:**
- Create: `apps/backend/app/services/spec_tools.py`

```python
import json

from claude_agent_sdk import create_sdk_mcp_server, tool

from app.models.ticket import Ticket
from app.services.spec import SpecService


def build_spec_tools(ticket_id: str, db_session_factory):
    """Build scoped MCP tools that can only access specs for the given ticket.

    All tools use ticket_id from the closure. The agent cannot pass a different
    ticket_id — this is the key security boundary.

    Args:
        ticket_id: UUID string of the ticket these tools are scoped to.
        db_session_factory: An async context manager that yields an AsyncSession.
    """

    @tool(
        "read_spec",
        "Read the latest revision of a spec by type for the current ticket",
        {"type": str},
    )
    async def read_spec(args):
        async with db_session_factory() as db:
            spec = await SpecService.get_latest_spec(db, ticket_id, args["type"])
            if not spec:
                return {
                    "content": [
                        {
                            "type": "text",
                            "text": f"No {args['type']} spec found for this ticket.",
                        }
                    ]
                }
            return {
                "content": [
                    {
                        "type": "text",
                        "text": f"# {spec.title}\n\n{spec.content}",
                    }
                ]
            }

    @tool(
        "list_specs",
        "List all available specs for the current ticket",
        {},
    )
    async def list_specs(args):
        async with db_session_factory() as db:
            specs = await SpecService.get_specs(db, ticket_id)
            if not specs:
                return {
                    "content": [
                        {
                            "type": "text",
                            "text": "No specs found for this ticket.",
                        }
                    ]
                }
            lines = [
                f"- **{s.type}**: {s.title} (v{s.revision})" for s in specs
            ]
            return {
                "content": [
                    {
                        "type": "text",
                        "text": "Available specs:\n" + "\n".join(lines),
                    }
                ]
            }

    @tool(
        "save_spec",
        "Save or update a spec for the current ticket",
        {"type": str, "title": str, "content": str},
    )
    async def save_spec(args):
        async with db_session_factory() as db:
            existing = await SpecService.get_latest_spec(
                db, ticket_id, args["type"]
            )
            if existing:
                spec = await SpecService.update_spec(
                    db, existing.id, args["content"], args["title"]
                )
            else:
                spec = await SpecService.create_spec(
                    db,
                    ticket_id,
                    args["type"],
                    args["title"],
                    args["content"],
                    created_by=None,  # system/agent
                )
            return {
                "content": [
                    {
                        "type": "text",
                        "text": f"Spec saved: {spec.title} (v{spec.revision})",
                    }
                ]
            }

    @tool(
        "read_ticket",
        "Read the ticket details and feature spec",
        {},
    )
    async def read_ticket(args):
        async with db_session_factory() as db:
            ticket = await db.get(Ticket, ticket_id)
            if not ticket:
                return {
                    "content": [
                        {"type": "text", "text": "Ticket not found."}
                    ]
                }
            text = (
                f"# {ticket.title}\n\n"
                f"Type: {ticket.type}\n"
                f"Priority: {ticket.priority}\n\n"
                f"{ticket.description or 'No description'}"
            )
            return {"content": [{"type": "text", "text": text}]}

    @tool(
        "read_figma_context",
        "Read Figma annotations and design references for this ticket",
        {},
    )
    async def read_figma_context(args):
        async with db_session_factory() as db:
            ticket = await db.get(Ticket, ticket_id)
            if not ticket or not ticket.figma_data:
                return {
                    "content": [
                        {
                            "type": "text",
                            "text": "No Figma context available for this ticket.",
                        }
                    ]
                }
            return {
                "content": [
                    {
                        "type": "text",
                        "text": (
                            "Figma Design Context:\n"
                            f"```json\n{json.dumps(ticket.figma_data, indent=2)}\n```"
                        ),
                    }
                ]
            }

    return create_sdk_mcp_server(
        name="ticket-specs",
        version="1.0.0",
        tools=[read_spec, list_specs, save_spec, read_ticket, read_figma_context],
    )
```

**KEY SECURITY:** All tools use `ticket_id` from the closure. The agent cannot pass a different `ticket_id` — it is captured at tool-creation time and cannot be overridden.

**Steps:**
1. Create the file at `apps/backend/app/services/spec_tools.py`
2. Run `cd apps/backend && uv run ruff check app/services/spec_tools.py` — Expected: no errors
3. Commit: `git add apps/backend/app/services/spec_tools.py && git commit -m "feat(backend): add scoped MCP tools for agent spec access"`

---

## Task 4: Create frontend spec query hooks

**Files:**
- Create: `apps/desktop/src/renderer/hooks/queries/use-specs.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import { apiClient } from 'renderer/lib/api-client'
import type {
  TicketSpec,
  TicketSpecDetail,
} from 'renderer/types/api'

export function useSpecs(ticketId: string) {
  return useQuery({
    queryKey: ['tickets', ticketId, 'specs'],
    queryFn: () =>
      apiClient<TicketSpec[]>(`/tickets/${ticketId}/specs`),
    enabled: !!ticketId,
  })
}

export function useSpec(ticketId: string, specId: string) {
  return useQuery({
    queryKey: ['tickets', ticketId, 'specs', specId],
    queryFn: () =>
      apiClient<TicketSpecDetail>(`/tickets/${ticketId}/specs/${specId}`),
    enabled: !!ticketId && !!specId,
  })
}

export function useSpecHistory(ticketId: string, specId: string) {
  return useQuery({
    queryKey: ['tickets', ticketId, 'specs', specId, 'history'],
    queryFn: () =>
      apiClient<TicketSpec[]>(`/tickets/${ticketId}/specs/${specId}/history`),
    enabled: !!ticketId && !!specId,
  })
}

export function useCreateSpec(ticketId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { type: string; title: string; content: string }) =>
      apiClient<TicketSpec>(`/tickets/${ticketId}/specs`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['tickets', ticketId, 'specs'] }),
  })
}

export function useUpdateSpec(ticketId: string, specId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { content: string; title?: string }) =>
      apiClient<TicketSpec>(`/tickets/${ticketId}/specs/${specId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tickets', ticketId, 'specs'] })
      qc.invalidateQueries({
        queryKey: ['tickets', ticketId, 'specs', specId],
      })
    },
  })
}
```

**Steps:**
1. Create the file at `apps/desktop/src/renderer/hooks/queries/use-specs.ts`
2. Run `pnpm typecheck` from repo root — Expected: no new type errors introduced by this file
3. Commit: `git add apps/desktop/src/renderer/hooks/queries/use-specs.ts && git commit -m "feat(desktop): add spec query and mutation hooks"`

---

## Task 5: Tests for spec service

**Files:**
- Create: `apps/backend/tests/test_spec_service.py`

```python
import uuid

import pytest

from app.models.ticket import Ticket
from app.models.ticket_spec import TicketSpec
from app.models.user import User
from app.models.project import Project
from app.services.spec import SpecService


@pytest.fixture
async def seed_data(db_session):
    """Create a user, project, and ticket for spec tests."""
    user = User(
        email="spec-test@example.com",
        name="Spec Tester",
        hashed_password="fakehash",
    )
    db_session.add(user)
    await db_session.flush()

    project = Project(
        name="Spec Project",
        slug="spec-proj",
        path="/tmp/spec-proj",
        owner_id=user.id,
    )
    db_session.add(project)
    await db_session.flush()

    ticket = Ticket(
        project_id=project.id,
        key="SPEC-1",
        title="Test Ticket",
        created_by=user.id,
    )
    db_session.add(ticket)
    await db_session.commit()

    return user, project, ticket


@pytest.mark.asyncio
async def test_create_spec(db_session, seed_data):
    user, _, ticket = seed_data

    spec = await SpecService.create_spec(
        db_session,
        ticket_id=ticket.id,
        type="feature",
        title="Feature Spec",
        content="# Feature\n\nDescription here.",
        created_by=user.id,
    )

    assert spec.id is not None
    assert spec.ticket_id == ticket.id
    assert spec.type == "feature"
    assert spec.title == "Feature Spec"
    assert spec.revision == 1


@pytest.mark.asyncio
async def test_create_spec_with_references(db_session, seed_data):
    user, _, ticket = seed_data

    # Create a target spec first
    target = await SpecService.create_spec(
        db_session,
        ticket_id=ticket.id,
        type="feature",
        title="Feature Spec",
        content="Feature content.",
        created_by=user.id,
    )

    # Create a spec that references it
    source = await SpecService.create_spec(
        db_session,
        ticket_id=ticket.id,
        type="design",
        title="Design Spec",
        content="Design content.",
        created_by=user.id,
        references=[
            {
                "target_spec_id": target.id,
                "ref_type": "derives_from",
                "section": "overview",
            }
        ],
    )

    # Reload with references
    loaded = await SpecService.get_spec(db_session, source.id)
    assert loaded is not None
    assert len(loaded.source_references) == 1
    assert loaded.source_references[0].target_spec_id == target.id
    assert loaded.source_references[0].ref_type == "derives_from"


@pytest.mark.asyncio
async def test_update_spec_creates_new_revision(db_session, seed_data):
    user, _, ticket = seed_data

    spec_v1 = await SpecService.create_spec(
        db_session,
        ticket_id=ticket.id,
        type="feature",
        title="Feature Spec",
        content="Version 1 content.",
        created_by=user.id,
    )
    assert spec_v1.revision == 1

    spec_v2 = await SpecService.update_spec(
        db_session,
        spec_id=spec_v1.id,
        content="Version 2 content.",
        title="Updated Feature Spec",
    )

    # New revision, different ID
    assert spec_v2.id != spec_v1.id
    assert spec_v2.revision == 2
    assert spec_v2.title == "Updated Feature Spec"
    assert spec_v2.content == "Version 2 content."
    assert spec_v2.ticket_id == spec_v1.ticket_id
    assert spec_v2.type == spec_v1.type


@pytest.mark.asyncio
async def test_get_specs_returns_latest_revision(db_session, seed_data):
    user, _, ticket = seed_data

    spec_v1 = await SpecService.create_spec(
        db_session,
        ticket_id=ticket.id,
        type="feature",
        title="Feature Spec",
        content="Version 1.",
        created_by=user.id,
    )
    await SpecService.update_spec(
        db_session, spec_id=spec_v1.id, content="Version 2."
    )

    specs = await SpecService.get_specs(db_session, ticket.id)
    assert len(specs) == 1
    assert specs[0].revision == 2
    assert specs[0].content == "Version 2."


@pytest.mark.asyncio
async def test_get_specs_filtered_by_type(db_session, seed_data):
    user, _, ticket = seed_data

    await SpecService.create_spec(
        db_session,
        ticket_id=ticket.id,
        type="feature",
        title="Feature Spec",
        content="Feature content.",
        created_by=user.id,
    )
    await SpecService.create_spec(
        db_session,
        ticket_id=ticket.id,
        type="design",
        title="Design Spec",
        content="Design content.",
        created_by=user.id,
    )

    feature_specs = await SpecService.get_specs(
        db_session, ticket.id, type="feature"
    )
    assert len(feature_specs) == 1
    assert feature_specs[0].type == "feature"


@pytest.mark.asyncio
async def test_get_spec_history(db_session, seed_data):
    user, _, ticket = seed_data

    spec_v1 = await SpecService.create_spec(
        db_session,
        ticket_id=ticket.id,
        type="feature",
        title="Feature Spec",
        content="Version 1.",
        created_by=user.id,
    )
    spec_v2 = await SpecService.update_spec(
        db_session, spec_id=spec_v1.id, content="Version 2."
    )
    await SpecService.update_spec(
        db_session, spec_id=spec_v2.id, content="Version 3."
    )

    history = await SpecService.get_spec_history(db_session, spec_v1.id)
    assert len(history) == 3
    # Ordered by revision desc
    assert history[0].revision == 3
    assert history[1].revision == 2
    assert history[2].revision == 1


@pytest.mark.asyncio
async def test_get_latest_spec(db_session, seed_data):
    user, _, ticket = seed_data

    spec_v1 = await SpecService.create_spec(
        db_session,
        ticket_id=ticket.id,
        type="feature",
        title="Feature Spec",
        content="Version 1.",
        created_by=user.id,
    )
    await SpecService.update_spec(
        db_session, spec_id=spec_v1.id, content="Version 2."
    )

    latest = await SpecService.get_latest_spec(
        db_session, ticket.id, "feature"
    )
    assert latest is not None
    assert latest.revision == 2


@pytest.mark.asyncio
async def test_get_latest_spec_not_found(db_session, seed_data):
    _, _, ticket = seed_data

    latest = await SpecService.get_latest_spec(
        db_session, ticket.id, "nonexistent"
    )
    assert latest is None


@pytest.mark.asyncio
async def test_add_and_remove_reference(db_session, seed_data):
    user, _, ticket = seed_data

    spec_a = await SpecService.create_spec(
        db_session,
        ticket_id=ticket.id,
        type="feature",
        title="Feature",
        content="Feature content.",
        created_by=user.id,
    )
    spec_b = await SpecService.create_spec(
        db_session,
        ticket_id=ticket.id,
        type="design",
        title="Design",
        content="Design content.",
        created_by=user.id,
    )

    ref = await SpecService.add_reference(
        db_session,
        source_spec_id=spec_a.id,
        target_spec_id=spec_b.id,
        ref_type="relates_to",
        section="overview",
    )
    assert ref.id is not None
    assert ref.source_spec_id == spec_a.id
    assert ref.target_spec_id == spec_b.id

    # Verify reference is loaded
    loaded = await SpecService.get_spec(db_session, spec_a.id)
    assert len(loaded.source_references) == 1

    # Remove the reference
    await SpecService.remove_reference(db_session, ref.id)

    reloaded = await SpecService.get_spec(db_session, spec_a.id)
    assert len(reloaded.source_references) == 0
```

**Steps:**
1. Create the test file at `apps/backend/tests/test_spec_service.py`
2. Run `cd apps/backend && uv run pytest tests/test_spec_service.py -v` — Expected: tests FAIL (service file not yet created if running before Task 1, or PASS if Task 1 is done)
3. If Task 1 is already done, verify all tests pass
4. Run `cd apps/backend && uv run ruff check tests/test_spec_service.py` — Expected: no errors
5. Commit: `git add apps/backend/tests/test_spec_service.py && git commit -m "test(backend): add spec service unit tests"`

---

## Task 6: Tests for spec router

**Files:**
- Create: `apps/backend/tests/test_spec_router.py`

```python
import pytest

from tests.conftest import auth_headers


async def _setup_project_and_ticket(client, headers, slug="spec"):
    """Create a project and a ticket. Return (project_id, ticket_id)."""
    proj_resp = await client.post(
        "/projects/",
        json={
            "name": "Spec Router Project",
            "slug": slug,
            "path": f"/tmp/{slug}",
        },
        headers=headers,
    )
    assert proj_resp.status_code == 201
    project_id = proj_resp.json()["id"]

    ticket_resp = await client.post(
        f"/projects/{project_id}/tickets",
        json={"title": "Spec Router Ticket"},
        headers=headers,
    )
    assert ticket_resp.status_code == 201
    ticket_id = ticket_resp.json()["id"]

    return project_id, ticket_id


@pytest.mark.asyncio
async def test_create_spec_endpoint(client):
    headers = await auth_headers(client, email="spec-create@example.com")
    _, ticket_id = await _setup_project_and_ticket(
        client, headers, slug="sp-create"
    )

    resp = await client.post(
        f"/tickets/{ticket_id}/specs",
        json={
            "type": "feature",
            "title": "Feature Spec",
            "content": "# Feature\n\nDetails here.",
        },
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["type"] == "feature"
    assert data["title"] == "Feature Spec"
    assert data["revision"] == 1
    assert data["ticket_id"] == ticket_id


@pytest.mark.asyncio
async def test_list_specs_endpoint(client):
    headers = await auth_headers(client, email="spec-list@example.com")
    _, ticket_id = await _setup_project_and_ticket(
        client, headers, slug="sp-list"
    )

    # Create two specs
    await client.post(
        f"/tickets/{ticket_id}/specs",
        json={"type": "feature", "title": "Feature", "content": "Feature."},
        headers=headers,
    )
    await client.post(
        f"/tickets/{ticket_id}/specs",
        json={"type": "design", "title": "Design", "content": "Design."},
        headers=headers,
    )

    resp = await client.get(
        f"/tickets/{ticket_id}/specs",
        headers=headers,
    )
    assert resp.status_code == 200
    specs = resp.json()
    assert len(specs) == 2
    types = {s["type"] for s in specs}
    assert types == {"feature", "design"}


@pytest.mark.asyncio
async def test_list_specs_filtered_by_type(client):
    headers = await auth_headers(client, email="spec-filter@example.com")
    _, ticket_id = await _setup_project_and_ticket(
        client, headers, slug="sp-filt"
    )

    await client.post(
        f"/tickets/{ticket_id}/specs",
        json={"type": "feature", "title": "Feature", "content": "Feature."},
        headers=headers,
    )
    await client.post(
        f"/tickets/{ticket_id}/specs",
        json={"type": "design", "title": "Design", "content": "Design."},
        headers=headers,
    )

    resp = await client.get(
        f"/tickets/{ticket_id}/specs",
        params={"type": "feature"},
        headers=headers,
    )
    assert resp.status_code == 200
    specs = resp.json()
    assert len(specs) == 1
    assert specs[0]["type"] == "feature"


@pytest.mark.asyncio
async def test_get_spec_detail_endpoint(client):
    headers = await auth_headers(client, email="spec-detail@example.com")
    _, ticket_id = await _setup_project_and_ticket(
        client, headers, slug="sp-dtl"
    )

    create_resp = await client.post(
        f"/tickets/{ticket_id}/specs",
        json={"type": "feature", "title": "Feature", "content": "Content."},
        headers=headers,
    )
    spec_id = create_resp.json()["id"]

    resp = await client.get(
        f"/tickets/{ticket_id}/specs/{spec_id}",
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == spec_id
    assert "source_references" in data
    assert "target_references" in data


@pytest.mark.asyncio
async def test_update_spec_creates_new_revision(client):
    headers = await auth_headers(client, email="spec-update@example.com")
    _, ticket_id = await _setup_project_and_ticket(
        client, headers, slug="sp-upd"
    )

    create_resp = await client.post(
        f"/tickets/{ticket_id}/specs",
        json={"type": "feature", "title": "Feature", "content": "V1."},
        headers=headers,
    )
    spec_id = create_resp.json()["id"]

    resp = await client.put(
        f"/tickets/{ticket_id}/specs/{spec_id}",
        json={"content": "V2.", "title": "Updated Feature"},
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    # New revision should have a different ID
    assert data["id"] != spec_id
    assert data["revision"] == 2
    assert data["content"] == "V2."
    assert data["title"] == "Updated Feature"


@pytest.mark.asyncio
async def test_spec_history_endpoint(client):
    headers = await auth_headers(client, email="spec-hist@example.com")
    _, ticket_id = await _setup_project_and_ticket(
        client, headers, slug="sp-hist"
    )

    create_resp = await client.post(
        f"/tickets/{ticket_id}/specs",
        json={"type": "feature", "title": "Feature", "content": "V1."},
        headers=headers,
    )
    spec_id = create_resp.json()["id"]

    await client.put(
        f"/tickets/{ticket_id}/specs/{spec_id}",
        json={"content": "V2."},
        headers=headers,
    )

    resp = await client.get(
        f"/tickets/{ticket_id}/specs/{spec_id}/history",
        headers=headers,
    )
    assert resp.status_code == 200
    history = resp.json()
    assert len(history) == 2
    # Ordered by revision desc
    assert history[0]["revision"] == 2
    assert history[1]["revision"] == 1


@pytest.mark.asyncio
async def test_spec_not_found_for_wrong_ticket(client):
    headers = await auth_headers(client, email="spec-wrong@example.com")
    _, ticket_id_a = await _setup_project_and_ticket(
        client, headers, slug="sp-wrnga"
    )

    # Create another ticket
    proj_resp = await client.post(
        "/projects/",
        json={
            "name": "Other Project",
            "slug": "sp-wrngb",
            "path": "/tmp/sp-wrngb",
        },
        headers=headers,
    )
    other_project_id = proj_resp.json()["id"]
    other_ticket_resp = await client.post(
        f"/projects/{other_project_id}/tickets",
        json={"title": "Other Ticket"},
        headers=headers,
    )
    ticket_id_b = other_ticket_resp.json()["id"]

    # Create spec on ticket A
    create_resp = await client.post(
        f"/tickets/{ticket_id_a}/specs",
        json={"type": "feature", "title": "Feature", "content": "Content."},
        headers=headers,
    )
    spec_id = create_resp.json()["id"]

    # Try to access it via ticket B — should 404
    resp = await client.get(
        f"/tickets/{ticket_id_b}/specs/{spec_id}",
        headers=headers,
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_spec_on_nonexistent_ticket(client):
    headers = await auth_headers(client, email="spec-noticket@example.com")
    fake_ticket_id = "00000000-0000-0000-0000-000000000000"

    resp = await client.get(
        f"/tickets/{fake_ticket_id}/specs",
        headers=headers,
    )
    assert resp.status_code == 404
```

**Steps:**
1. Create the test file at `apps/backend/tests/test_spec_router.py`
2. Run `cd apps/backend && uv run pytest tests/test_spec_router.py -v` — Expected: tests FAIL (router not yet created if running before Task 2, or PASS if Task 2 is done)
3. If Task 2 is already done, verify all tests pass
4. Run `cd apps/backend && uv run ruff check tests/test_spec_router.py` — Expected: no errors
5. Commit: `git add apps/backend/tests/test_spec_router.py && git commit -m "test(backend): add spec router integration tests"`
