import pytest
from app.services.strategies.registry import (
    STRATEGY_REGISTRY,
    get_strategy,
    register_strategy,
)
from app.services.strategies.base import AgentStrategy


class _FakeStrategy(AgentStrategy):
    def get_sdk_type(self): return "claude_agent"
    def build_sdk_options(self, session, agent_config): return {}
    def process_event(self, event): return None
    async def on_session_complete(self, session, db): pass


def test_register_and_get_strategy():
    register_strategy("fake", _FakeStrategy)
    strategy = get_strategy("fake")
    assert isinstance(strategy, _FakeStrategy)


def test_get_unknown_strategy_raises():
    with pytest.raises(ValueError, match="Unknown agent type"):
        get_strategy("nonexistent_xyz")
