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

        references: list of dicts with target_spec_id, ref_type, section.
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
        """Create a NEW TicketSpec record with revision+1.

        Versioned — does not update in place.
        """
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
            .where(TicketSpec.ticket_id == ticket_id)
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
        """Get all revisions of a spec (same ticket_id + type).

        Ordered by revision desc.
        """
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
