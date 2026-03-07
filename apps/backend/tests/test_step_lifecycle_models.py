import pytest
from app.models.enums import StepStatus


def test_step_status_has_awaiting_approval():
    assert StepStatus.awaiting_approval == "awaiting_approval"


def test_step_status_has_review():
    assert StepStatus.review == "review"


def test_step_status_has_changes_requested():
    assert StepStatus.changes_requested == "changes_requested"


from app.models.agent_config import AgentConfig


def test_agent_config_has_default_requires_approval():
    config = AgentConfig(
        name="test",
        system_prompt="test",
        claude_model="sonnet",
        default_requires_approval=True,
    )
    assert config.default_requires_approval is True


def test_agent_config_default_requires_approval_accepts_no_value():
    config = AgentConfig(
        name="test",
        system_prompt="test",
        claude_model="sonnet",
    )
    # Column default=False is applied on INSERT, not construction
    assert hasattr(config, "default_requires_approval")
