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


from app.models.ticket import Ticket


def test_ticket_has_auto_execute():
    ticket = Ticket(
        project_id="00000000-0000-0000-0000-000000000001",
        key="TEST-1",
        title="Test",
        created_by="00000000-0000-0000-0000-000000000001",
        auto_execute=False,
    )
    assert ticket.auto_execute is False


def test_ticket_auto_execute_accepts_no_value():
    ticket = Ticket(
        project_id="00000000-0000-0000-0000-000000000001",
        key="TEST-2",
        title="Test",
        created_by="00000000-0000-0000-0000-000000000001",
    )
    # Column default=True is applied on INSERT, not construction
    assert hasattr(ticket, "auto_execute")


from app.models.workflow_step import WorkflowStep


def test_workflow_step_has_new_fields():
    step = WorkflowStep(
        ticket_id="00000000-0000-0000-0000-000000000001",
        template_step_id="brainstorm",
        name="brainstorm",
        requires_approval=True,
        user_prompt_override="Custom prompt",
        brainstorm_output={"summary": "test"},
        step_breakdown={"instructions": "do this"},
    )
    assert step.requires_approval is True
    assert step.user_prompt_override == "Custom prompt"
    assert step.brainstorm_output == {"summary": "test"}
    assert step.step_breakdown == {"instructions": "do this"}


def test_workflow_step_new_fields_nullable():
    step = WorkflowStep(
        ticket_id="00000000-0000-0000-0000-000000000001",
        template_step_id="code",
        name="code",
    )
    assert step.requires_approval is None
    assert step.user_prompt_override is None
    assert step.brainstorm_output is None
    assert step.step_breakdown is None


from app.models.step_review import StepReview
from app.models.enums import ReviewStatus


def test_step_review_model():
    review = StepReview(
        step_id="00000000-0000-0000-0000-000000000001",
        revision=1,
        diff_content="diff --git a/file.py",
        status=ReviewStatus.pending,
    )
    assert review.revision == 1
    assert review.status == ReviewStatus.pending
    assert review.comments is None


def test_step_review_with_comments():
    review = StepReview(
        step_id="00000000-0000-0000-0000-000000000001",
        revision=2,
        diff_content="diff --git a/file.py",
        comments=[{"file": "file.py", "line": 10, "comment": "Fix this"}],
        status=ReviewStatus.changes_requested,
    )
    assert len(review.comments) == 1
    assert review.comments[0]["line"] == 10
