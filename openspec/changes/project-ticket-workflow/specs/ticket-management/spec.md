## ADDED Requirements

### Requirement: Create ticket
The system SHALL allow project members to create tickets with title, description, type, priority, and workflow template reference. The system MUST auto-generate a sequential ticket key using the project slug (e.g. "PROJ-1", "PROJ-2").

#### Scenario: Create feature ticket
- **WHEN** a POST request is sent to `/projects/:id/tickets` with title, type "feature", priority "high", and template_id
- **THEN** the system creates a Ticket record with auto-generated key, instantiates WorkflowSteps from the template, and returns the ticket with its steps

#### Scenario: Auto-generated ticket key
- **WHEN** a project with slug "PROJ" has 5 existing tickets and a new ticket is created
- **THEN** the new ticket receives key "PROJ-6"

### Requirement: Ticket types
The system SHALL support the following ticket types: `feature`, `bug`, `improvement`, `chore`, `spike`.

#### Scenario: Valid ticket type
- **WHEN** a ticket is created with type "bug"
- **THEN** the system accepts and stores the ticket type

#### Scenario: Invalid ticket type
- **WHEN** a ticket is created with an unsupported type
- **THEN** the system returns HTTP 422

### Requirement: Ticket statuses
The system SHALL support ticket statuses: `backlog`, `todo`, `in_progress`, `in_review`, `done`, `cancelled`. New tickets MUST default to `backlog`.

#### Scenario: Default status
- **WHEN** a ticket is created without specifying status
- **THEN** the ticket status is set to `backlog`

#### Scenario: Status transitions on workflow progress
- **WHEN** the first workflow step starts running
- **THEN** the ticket status is automatically updated to `in_progress`

#### Scenario: All steps completed
- **WHEN** all workflow steps reach `completed` or `skipped` status
- **THEN** the ticket status is automatically updated to `done`

### Requirement: Ticket priorities
The system SHALL support priorities: `urgent`, `high`, `medium`, `low`, `none`. Default MUST be `none`.

#### Scenario: Default priority
- **WHEN** a ticket is created without specifying priority
- **THEN** the ticket priority is set to `none`

### Requirement: List tickets
The system SHALL return tickets for a project with filtering by status, type, priority, and assignee.

#### Scenario: List all tickets
- **WHEN** a GET request is sent to `/projects/:id/tickets`
- **THEN** the system returns all tickets for the project

#### Scenario: Filter by status
- **WHEN** a GET request is sent to `/projects/:id/tickets?status=in_progress`
- **THEN** the system returns only tickets with status `in_progress`

### Requirement: Get ticket detail
The system SHALL return a single ticket with its workflow steps and DAG structure.

#### Scenario: Get ticket with steps
- **WHEN** a GET request is sent to `/tickets/:id`
- **THEN** the system returns the ticket data including all workflow steps with their statuses and dependencies

### Requirement: Update ticket
The system SHALL allow updating ticket title, description, type, priority, status, and assignee_id.

#### Scenario: Update ticket
- **WHEN** a PATCH request is sent to `/tickets/:id` with updated fields
- **THEN** the system updates the ticket and returns the updated data

### Requirement: Delete ticket
The system SHALL allow deleting a ticket and all associated workflow steps and sessions.

#### Scenario: Delete ticket
- **WHEN** a DELETE request is sent to `/tickets/:id`
- **THEN** the system cancels any running sessions, deletes all workflow steps, sessions, and the ticket

### Requirement: Workflow step instantiation
The system SHALL instantiate WorkflowSteps from the template's steps_config when a ticket is created. Each template step becomes a WorkflowStep with the correct agent_config_id and dependencies.

#### Scenario: Steps created from template
- **WHEN** a ticket is created with a template that has 5 steps
- **THEN** 5 WorkflowStep records are created with correct agent references and WorkflowStepDependency records for the DAG edges

#### Scenario: Initial step status
- **WHEN** workflow steps are instantiated
- **THEN** steps with no dependencies have status `ready`, steps with dependencies have status `pending`
