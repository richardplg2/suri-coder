import pytest

from app.models.project import Project
from app.models.ticket import Ticket
from app.models.user import User
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
        created_by=user.id,
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

    # Refresh to pick up the cascade deletion
    reloaded = await SpecService.get_spec(db_session, spec_a.id)
    await db_session.refresh(reloaded, ["source_references"])
    assert len(reloaded.source_references) == 0
