from app.services.strategies.base import AgentStrategy

# Populated in Phase 1b (BrainstormStrategy) and 1c (BackendAgentStrategy)
STRATEGY_REGISTRY: dict[str, type[AgentStrategy]] = {}


def get_strategy(agent_type: str) -> AgentStrategy:
    """Return an instantiated strategy for the given agent type."""
    cls = STRATEGY_REGISTRY.get(agent_type)
    if cls is None:
        raise ValueError(
            f"Unknown agent type: '{agent_type}'. "
            f"Registered types: {list(STRATEGY_REGISTRY.keys())}"
        )
    return cls()


def register_strategy(agent_type: str, cls: type[AgentStrategy]) -> None:
    """Register a strategy class. Called at import time in each strategy module."""
    STRATEGY_REGISTRY[agent_type] = cls
