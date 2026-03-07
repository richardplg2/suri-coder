import json
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.brainstorm_message import BrainstormMessage
from app.models.enums import (
    BrainstormMessageType,
    BrainstormRole,
    TicketPriority,
    TicketType,
    UserRole,
)
from app.models.project import Project, ProjectMember
from app.models.user import User
from app.services.brainstorm_agent import (
    QUIZ_OUTPUT_SCHEMA,
    build_initial_prompt,
)
from app.services.brainstorm_service import (
    BrainstormService,
    _active_brainstorm_sessions,
    _parse_agent_response,
)

# --- Fixtures ---


@pytest.fixture
def mock_redis():
    redis = AsyncMock()
    redis.publish = AsyncMock()
    return redis


def _make_mock_result(
    message_type: str = "quiz",
    content: str | None = None,
    quiz: dict | None = None,
):
    """Create a mock agent result with structured output."""
    output = {"message_type": message_type}
    if content is not None:
        output["content"] = content
    if quiz is not None:
        output["quiz"] = quiz
    mock = MagicMock()
    mock.output = json.dumps(output)
    return mock


SAMPLE_QUIZ = {
    "question": "What problem are you solving?",
    "context": "Understanding the core problem helps scope the solution.",
    "options": [
        {
            "id": "a",
            "label": "Performance",
            "description": "App is too slow",
            "recommended": False,
        },
        {
            "id": "b",
            "label": "UX",
            "description": "Users are confused",
            "recommended": True,
            "recommendation_reason": "Most common issue",
        },
    ],
    "allow_multiple": False,
    "allow_custom": True,
}


async def _create_test_user(db: AsyncSession) -> User:
    user = User(
        id=uuid.uuid4(),
        email=f"test-{uuid.uuid4().hex[:8]}@example.com",
        name="Test User",
        role=UserRole.admin,
        hashed_password="fake",
    )
    db.add(user)
    await db.flush()
    return user


async def _create_test_project(
    db: AsyncSession, user: User
) -> Project:
    project = Project(
        id=uuid.uuid4(),
        name="Test Project",
        slug=f"test-{uuid.uuid4().hex[:8]}",
        path="/tmp/test",
        created_by=user.id,
    )
    db.add(project)
    await db.flush()

    member = ProjectMember(
        user_id=user.id,
        project_id=project.id,
        role=UserRole.admin,
    )
    db.add(member)
    await db.flush()
    return project


# --- Unit tests for brainstorm_agent.py ---


def test_build_initial_prompt_ai_source():
    prompt = build_initial_prompt("ai", "I want to add dark mode", None)
    assert "dark mode" in prompt


def test_build_initial_prompt_ai_source_no_message():
    prompt = build_initial_prompt("ai", None, None)
    assert "brainstorm" in prompt.lower()


def test_build_initial_prompt_figma_source():
    figma_data = {
        "file_name": "App Design",
        "page_name": "Login",
        "node_names": ["LoginForm", "SignUpButton"],
        "figma_url": "https://figma.com/file/abc123",
    }
    prompt = build_initial_prompt("figma", None, figma_data)
    assert "App Design" in prompt
    assert "Login" in prompt
    assert "LoginForm" in prompt
    assert "Design Context" in prompt


def test_build_initial_prompt_figma_with_message():
    figma_data = {"file_name": "Design"}
    prompt = build_initial_prompt(
        "figma", "Implement this login form", figma_data
    )
    assert "Implement this login form" in prompt
    assert "Design" in prompt


def test_build_initial_prompt_figma_no_data():
    prompt = build_initial_prompt("figma", None, None)
    assert "figma" in prompt.lower()


def test_quiz_output_schema_structure():
    assert "message_type" in QUIZ_OUTPUT_SCHEMA["properties"]
    assert "quiz" in QUIZ_OUTPUT_SCHEMA["properties"]
    assert "content" in QUIZ_OUTPUT_SCHEMA["properties"]
    assert "message_type" in QUIZ_OUTPUT_SCHEMA["required"]


# --- Unit tests for _parse_agent_response ---


def test_parse_agent_response_quiz():
    result = _make_mock_result(
        message_type="quiz", quiz=SAMPLE_QUIZ
    )
    msg_type, content, data = _parse_agent_response(result)
    assert msg_type == "quiz"
    assert data == SAMPLE_QUIZ


def test_parse_agent_response_text():
    result = _make_mock_result(
        message_type="text", content="Hello!"
    )
    msg_type, content, data = _parse_agent_response(result)
    assert msg_type == "text"
    assert content == "Hello!"
    assert data is None


def test_parse_agent_response_summary():
    result = _make_mock_result(
        message_type="summary", content="## Problem\nSlow app"
    )
    msg_type, content, data = _parse_agent_response(result)
    assert msg_type == "summary"
    assert "Slow app" in content


def test_parse_agent_response_fallback():
    result = "raw string response"
    msg_type, content, data = _parse_agent_response(result)
    assert msg_type == "text"
    assert "raw string" in content
    assert data is None


# --- Unit tests for BrainstormService ---


@pytest.mark.asyncio
async def test_start_session_returns_session_id(
    db_session, mock_redis
):
    user = await _create_test_user(db_session)
    project = await _create_test_project(db_session, user)
    await db_session.commit()

    mock_result = _make_mock_result(
        message_type="quiz", quiz=SAMPLE_QUIZ
    )
    mock_client = AsyncMock()
    mock_client.query = AsyncMock(return_value=mock_result)

    with patch(
        "app.services.brainstorm_service._create_brainstorm_client",
        return_value=mock_client,
    ):
        service = BrainstormService(db_session, mock_redis)
        result = await service.start_session(
            project_id=project.id,
            source="ai",
            initial_message="I want dark mode",
            figma_data=None,
            user_id=user.id,
        )

    assert "session_id" in result
    assert result["first_message"] is not None
    # Cleanup
    _active_brainstorm_sessions.pop(
        result["session_id"], None
    )


@pytest.mark.asyncio
async def test_start_session_saves_messages(
    db_session, mock_redis
):
    user = await _create_test_user(db_session)
    project = await _create_test_project(db_session, user)
    await db_session.commit()

    mock_result = _make_mock_result(
        message_type="quiz", quiz=SAMPLE_QUIZ
    )
    mock_client = AsyncMock()
    mock_client.query = AsyncMock(return_value=mock_result)

    with patch(
        "app.services.brainstorm_service._create_brainstorm_client",
        return_value=mock_client,
    ):
        service = BrainstormService(db_session, mock_redis)
        result = await service.start_session(
            project_id=project.id,
            source="ai",
            initial_message="Test",
            figma_data=None,
            user_id=user.id,
        )

    session_id = result["session_id"]
    msgs = await db_session.execute(
        select(BrainstormMessage).where(
            BrainstormMessage.session_id == session_id
        )
    )
    messages = list(msgs.scalars().all())
    roles = {m.role for m in messages}
    assert BrainstormRole.user in roles
    assert BrainstormRole.assistant in roles
    _active_brainstorm_sessions.pop(session_id, None)


@pytest.mark.asyncio
async def test_start_session_saves_figma_context(
    db_session, mock_redis
):
    user = await _create_test_user(db_session)
    project = await _create_test_project(db_session, user)
    await db_session.commit()

    figma_data = {"file_name": "Design", "page_name": "Home"}
    mock_result = _make_mock_result(
        message_type="quiz", quiz=SAMPLE_QUIZ
    )
    mock_client = AsyncMock()
    mock_client.query = AsyncMock(return_value=mock_result)

    with patch(
        "app.services.brainstorm_service._create_brainstorm_client",
        return_value=mock_client,
    ):
        service = BrainstormService(db_session, mock_redis)
        result = await service.start_session(
            project_id=project.id,
            source="figma",
            initial_message=None,
            figma_data=figma_data,
            user_id=user.id,
        )

    session_id = result["session_id"]
    msgs = await db_session.execute(
        select(BrainstormMessage).where(
            BrainstormMessage.session_id == session_id,
            BrainstormMessage.message_type
            == BrainstormMessageType.figma_context,
        )
    )
    figma_msgs = list(msgs.scalars().all())
    assert len(figma_msgs) == 1
    assert figma_msgs[0].structured_data == figma_data
    _active_brainstorm_sessions.pop(session_id, None)


@pytest.mark.asyncio
async def test_send_message_text(db_session, mock_redis):
    mock_result = _make_mock_result(
        message_type="quiz", quiz=SAMPLE_QUIZ
    )
    mock_client = AsyncMock()
    mock_client.query = AsyncMock(return_value=mock_result)

    session_id = str(uuid.uuid4())
    _active_brainstorm_sessions[session_id] = mock_client

    try:
        service = BrainstormService(db_session, mock_redis)
        response = await service.send_message(
            session_id=session_id,
            content="I think performance is the issue",
            quiz_response=None,
        )

        assert response.message_type == "quiz"
        mock_client.query.assert_called_once_with(
            "I think performance is the issue"
        )
    finally:
        _active_brainstorm_sessions.pop(session_id, None)


@pytest.mark.asyncio
async def test_send_message_quiz_response(
    db_session, mock_redis
):
    mock_result = _make_mock_result(
        message_type="quiz", quiz=SAMPLE_QUIZ
    )
    mock_client = AsyncMock()
    mock_client.query = AsyncMock(return_value=mock_result)

    session_id = str(uuid.uuid4())
    _active_brainstorm_sessions[session_id] = mock_client

    try:
        service = BrainstormService(db_session, mock_redis)
        response = await service.send_message(
            session_id=session_id,
            content=None,
            quiz_response={
                "option_ids": ["b"],
                "custom_text": "Especially the nav",
            },
        )

        assert response is not None
        call_arg = mock_client.query.call_args[0][0]
        assert "b" in call_arg
        assert "Especially the nav" in call_arg
    finally:
        _active_brainstorm_sessions.pop(session_id, None)


@pytest.mark.asyncio
async def test_send_message_unknown_session_raises(
    db_session, mock_redis
):
    from fastapi import HTTPException

    service = BrainstormService(db_session, mock_redis)
    with pytest.raises(HTTPException) as exc_info:
        await service.send_message(
            session_id="nonexistent",
            content="hello",
            quiz_response=None,
        )
    assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_complete_session_returns_summary(
    db_session, mock_redis
):
    mock_result = _make_mock_result(
        message_type="summary",
        content="## Problem\nApp is slow",
    )
    mock_client = AsyncMock()
    mock_client.query = AsyncMock(return_value=mock_result)

    session_id = str(uuid.uuid4())
    _active_brainstorm_sessions[session_id] = mock_client

    service = BrainstormService(db_session, mock_redis)
    result = await service.complete_session(session_id)

    assert "summary" in result
    assert "slow" in result["summary"].lower()


@pytest.mark.asyncio
async def test_complete_session_removes_client(
    db_session, mock_redis
):
    mock_result = _make_mock_result(
        message_type="summary", content="Done"
    )
    mock_client = AsyncMock()
    mock_client.query = AsyncMock(return_value=mock_result)

    session_id = str(uuid.uuid4())
    _active_brainstorm_sessions[session_id] = mock_client

    service = BrainstormService(db_session, mock_redis)
    await service.complete_session(session_id)

    assert session_id not in _active_brainstorm_sessions


@pytest.mark.asyncio
async def test_publish_brainstorm_event(
    db_session, mock_redis
):
    service = BrainstormService(db_session, mock_redis)
    await service._publish_brainstorm_event(
        "test-session", "brainstorm_quiz", {"key": "value"}
    )

    mock_redis.publish.assert_called_once()
    call_args = mock_redis.publish.call_args
    assert call_args[0][0] == "brainstorm:test-session"
    payload = json.loads(call_args[0][1])
    assert payload["event"] == "brainstorm_quiz"


@pytest.mark.asyncio
async def test_batch_update(db_session, mock_redis):
    mock_result = _make_mock_result(
        message_type="summary",
        content="## Problem\nUpdated summary",
    )
    mock_client = AsyncMock()
    mock_client.query = AsyncMock(return_value=mock_result)

    session_id = str(uuid.uuid4())
    _active_brainstorm_sessions[session_id] = mock_client

    try:
        service = BrainstormService(db_session, mock_redis)
        result = await service.batch_update(
            session_id=session_id,
            comments=[
                {
                    "section_id": "problem",
                    "text": "Be more specific",
                }
            ],
        )

        assert "summary" in result
        call_arg = mock_client.query.call_args[0][0]
        assert "Be more specific" in call_arg
    finally:
        _active_brainstorm_sessions.pop(session_id, None)


@pytest.mark.asyncio
async def test_create_ticket_from_brainstorm(
    db_session, mock_redis
):
    user = await _create_test_user(db_session)
    project = await _create_test_project(db_session, user)
    await db_session.commit()

    session_id = str(uuid.uuid4())

    # Create a summary message in the DB
    summary_msg = BrainstormMessage(
        session_id=session_id,
        role=BrainstormRole.assistant,
        content="## Problem\nUsers need dark mode",
        message_type=BrainstormMessageType.summary,
    )
    db_session.add(summary_msg)
    await db_session.flush()
    await db_session.commit()

    service = BrainstormService(db_session, mock_redis)
    ticket = await service.create_ticket_from_brainstorm(
        session_id=session_id,
        title="Add Dark Mode",
        type=TicketType.feature,
        priority=TicketPriority.medium,
        template_id=None,
        user_id=user.id,
        project_id=project.id,
    )

    assert ticket is not None
    assert ticket.title == "Add Dark Mode"
    assert ticket.description == "## Problem\nUsers need dark mode"

    # Verify brainstorm messages linked to ticket
    msgs = await db_session.execute(
        select(BrainstormMessage).where(
            BrainstormMessage.session_id == session_id
        )
    )
    for msg in msgs.scalars().all():
        assert msg.ticket_id == ticket.id
