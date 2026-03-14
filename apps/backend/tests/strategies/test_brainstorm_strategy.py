import pytest
from unittest.mock import MagicMock

from app.services.strategies.brainstorm import BrainstormStrategy


@pytest.fixture
def strategy():
    return BrainstormStrategy()


def test_get_sdk_type(strategy):
    assert strategy.get_sdk_type() == "claude_agent"


def test_build_sdk_options_basic(strategy):
    session = MagicMock()
    agent_config = MagicMock()
    agent_config.system_prompt = "You are a brainstormer."
    agent_config.output_format = None
    agent_config.mcp_servers = None

    opts = strategy.build_sdk_options(session, agent_config)

    assert opts["system_prompt"] == "You are a brainstormer."
    assert opts["max_turns"] == 1


def test_build_sdk_options_with_output_format(strategy):
    session = MagicMock()
    agent_config = MagicMock()
    agent_config.system_prompt = "sys"
    agent_config.output_format = {"type": "json_schema", "schema": {}}
    agent_config.mcp_servers = None

    opts = strategy.build_sdk_options(session, agent_config)
    assert "output_format" in opts


def test_process_event_quiz(strategy):
    sdk_result = MagicMock()
    sdk_result.output = '{"message_type": "quiz", "content": "What problem?", "quiz": {"question": "Q?", "options": []}}'

    result = strategy.process_event(sdk_result)

    assert result is not None
    assert result["event_type"] == "structured_output"
    assert result["content"]["schema_type"] == "quiz"


def test_process_event_text(strategy):
    sdk_result = MagicMock()
    sdk_result.output = '{"message_type": "text", "content": "Hello!"}'

    result = strategy.process_event(sdk_result)
    assert result["content"]["schema_type"] == "text"
    assert result["content"]["data"]["content"] == "Hello!"


def test_process_event_fallback_to_text(strategy):
    sdk_result = MagicMock()
    sdk_result.output = "not valid json at all"
    # Remove result attribute to test fallback
    del sdk_result.result

    result = strategy.process_event(sdk_result)
    assert result["content"]["schema_type"] == "text"
