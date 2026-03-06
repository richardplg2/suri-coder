## ADDED Requirements

### Requirement: DAG tick execution
The system SHALL advance the workflow DAG after any step status change. When a step completes, all downstream steps whose dependencies are now fully satisfied MUST be transitioned from `pending` to `ready` and scheduled for execution.

#### Scenario: Step completion triggers downstream
- **WHEN** step "designer" completes and step "coder" depends only on "designer"
- **THEN** step "coder" transitions from `pending` to `ready` and is scheduled for execution

#### Scenario: Step with multiple dependencies
- **WHEN** step "coder" depends on both "designer" and "researcher", and "designer" completes but "researcher" is still running
- **THEN** step "coder" remains in `pending` status

#### Scenario: Parallel step scheduling
- **WHEN** step "coder" completes and both "tester" (depends on coder) and "reviewer" (depends on coder) exist
- **THEN** both "tester" and "reviewer" transition to `ready` and are scheduled simultaneously

### Requirement: Step lifecycle management
The system SHALL enforce the step lifecycle: `pending` -> `ready` -> `running` -> `completed`/`failed`/`skipped`.

#### Scenario: Step starts running
- **WHEN** a `ready` step's session starts executing
- **THEN** the step status changes to `running`

#### Scenario: Step completes
- **WHEN** a running step's session finishes successfully
- **THEN** the step status changes to `completed` and the DAG tick is triggered

#### Scenario: Step fails
- **WHEN** a running step's session exits with an error
- **THEN** the step status changes to `failed` and the DAG tick is triggered

### Requirement: Failure handling
The system SHALL block all downstream steps when a step fails. Downstream steps MUST NOT be scheduled until the failed step is retried and succeeds, or is skipped.

#### Scenario: Failed step blocks downstream
- **WHEN** step "coder" fails and step "tester" depends on "coder"
- **THEN** step "tester" remains in `pending` status and is not scheduled

### Requirement: Retry failed step
The system SHALL allow retrying a failed step by creating a new Session and re-executing the agent.

#### Scenario: Retry creates new session
- **WHEN** a POST request is sent to `/tickets/:id/steps/:step_id/retry`
- **THEN** the system creates a new Session for the step, sets step status to `ready`, and schedules execution

#### Scenario: Retry preserves previous session
- **WHEN** a step is retried
- **THEN** the previous failed session is preserved in the database (not deleted)

### Requirement: Skip failed step
The system SHALL allow skipping a failed or pending step, marking it as `skipped` and unblocking downstream steps.

#### Scenario: Skip step
- **WHEN** a POST request is sent to `/tickets/:id/steps/:step_id/skip`
- **THEN** the step status changes to `skipped` and the DAG tick is triggered to advance downstream steps

### Requirement: Manual step trigger
The system SHALL allow manually triggering a `ready` step for execution.

#### Scenario: Manual run
- **WHEN** a POST request is sent to `/tickets/:id/steps/:step_id/run`
- **THEN** the system creates a Session and schedules the step for execution

#### Scenario: Cannot run non-ready step
- **WHEN** a POST request is sent to run a step that is not in `ready` status
- **THEN** the system returns HTTP 409 with error message "Step is not ready for execution"

### Requirement: Start workflow
The system SHALL allow starting an entire ticket's workflow, scheduling all `ready` steps.

#### Scenario: Start workflow
- **WHEN** a POST request is sent to `/tickets/:id/run`
- **THEN** all steps with status `ready` (no pending dependencies) are scheduled for execution

### Requirement: Ticket auto-completion
The system SHALL automatically mark a ticket as `done` when all workflow steps reach `completed` or `skipped` status.

#### Scenario: All steps done
- **WHEN** the last pending step in a ticket completes
- **THEN** the ticket status is automatically updated to `done`

### Requirement: Ticket auto-progress
The system SHALL automatically update ticket status to `in_progress` when the first step begins running.

#### Scenario: First step starts
- **WHEN** the first step in a ticket transitions to `running`
- **THEN** the ticket status is updated to `in_progress` if it was `backlog` or `todo`
