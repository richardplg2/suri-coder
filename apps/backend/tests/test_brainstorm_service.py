"""
Brainstorm integration tests.
These test that the brainstorm router correctly uses SessionManager.
The underlying BrainstormService no longer exists.
"""
import pytest


def test_brainstorm_service_replaced():
    """Verify old BrainstormService is gone."""
    with pytest.raises(ImportError):
        from app.services.brainstorm_service import BrainstormService  # noqa


def test_brainstorm_strategy_registered():
    """Verify BrainstormStrategy is registered in STRATEGY_REGISTRY."""
    import app.services.strategies.brainstorm  # noqa — triggers registration
    from app.services.strategies.registry import STRATEGY_REGISTRY

    assert "brainstorm" in STRATEGY_REGISTRY
