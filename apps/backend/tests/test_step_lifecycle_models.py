import pytest
from app.models.enums import StepStatus


def test_step_status_has_awaiting_approval():
    assert StepStatus.awaiting_approval == "awaiting_approval"


def test_step_status_has_review():
    assert StepStatus.review == "review"


def test_step_status_has_changes_requested():
    assert StepStatus.changes_requested == "changes_requested"
