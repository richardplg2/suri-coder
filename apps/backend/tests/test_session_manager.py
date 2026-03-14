import uuid
import pytest
from unittest.mock import AsyncMock, MagicMock
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import SessionStatus
from app.models.session import Session
from app.models.agent_config import AgentConfig
from app.services.session_manager import SessionManager


@pytest.fixture
def mock_db():
    db = AsyncMock(spec=AsyncSession)
    db.get = AsyncMock()
    db.execute = AsyncMock()
    db.add = MagicMock()
    db.flush = AsyncMock()
    return db


@pytest.fixture
def mock_redis():
    return AsyncMock()


@pytest.fixture
def manager(mock_db, mock_redis):
    return SessionManager(db=mock_db, redis=mock_redis)


@pytest.mark.asyncio
async def test_create_session_returns_session(manager, mock_db):
    project_id = uuid.uuid4()
    agent_config_id = uuid.uuid4()

    # Mock agent_config
    agent_config = MagicMock(spec=AgentConfig)
    agent_config.agent_type = "brainstorm"
    mock_db.get.return_value = agent_config

    # Mock no existing active session
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_db.execute.return_value = mock_result

    session = await manager.create_session(
        agent_config_id=agent_config_id,
        project_id=project_id,
    )

    assert session.status == SessionStatus.created
    assert session.project_id == project_id
    mock_db.add.assert_called_once()
    mock_db.flush.assert_called_once()


@pytest.mark.asyncio
async def test_create_session_raises_on_concurrency_conflict(manager, mock_db):
    from fastapi import HTTPException

    agent_config = MagicMock(spec=AgentConfig)
    agent_config.agent_type = "brainstorm"
    mock_db.get.return_value = agent_config

    # Mock existing active session
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = MagicMock(spec=Session)
    mock_db.execute.return_value = mock_result

    with pytest.raises(HTTPException) as exc_info:
        await manager.create_session(
            agent_config_id=uuid.uuid4(),
            project_id=uuid.uuid4(),
        )

    assert exc_info.value.status_code == 409
