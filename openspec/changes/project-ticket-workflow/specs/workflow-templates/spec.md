## ADDED Requirements

### Requirement: Create workflow template
The system SHALL allow project members to create workflow templates with a name, description, and DAG step definition. Templates can be project-specific or global (project_id null).

#### Scenario: Create template
- **WHEN** a POST request is sent to `/projects/:id/templates` with name, description, and steps_config
- **THEN** the system validates the DAG (no cycles, all agent references valid) and creates a WorkflowTemplate record

#### Scenario: Invalid DAG (cycle detected)
- **WHEN** a POST request is sent with steps_config containing a dependency cycle
- **THEN** the system returns HTTP 422 with error message "Workflow contains a dependency cycle"

#### Scenario: Invalid agent reference
- **WHEN** a POST request is sent with steps_config referencing an agent name that does not exist in the project
- **THEN** the system returns HTTP 422 with error message "Unknown agent: {name}"

### Requirement: Workflow template steps_config format
The system SHALL store workflow DAG definitions as JSON in the following format:
```json
{
  "steps": [
    {"id": "string", "agent": "string", "depends_on": ["string"], "description": "string"}
  ]
}
```
Each step MUST have a unique `id`. The `agent` field MUST reference an AgentConfig name. The `depends_on` array MUST contain valid step IDs from the same template.

#### Scenario: Valid DAG with parallel steps
- **WHEN** a template has steps where two steps have no dependencies and a third depends on both
- **THEN** the system accepts the template as valid

#### Scenario: Step references non-existent dependency
- **WHEN** a step's depends_on references a step ID that does not exist in the template
- **THEN** the system returns HTTP 422 with error message "Step '{id}' depends on unknown step '{dep}'"

### Requirement: List workflow templates
The system SHALL return all templates for a project, including global templates.

#### Scenario: List templates
- **WHEN** a GET request is sent to `/projects/:id/templates`
- **THEN** the system returns all WorkflowTemplate records where project_id matches OR project_id is null

### Requirement: Update workflow template
The system SHALL allow updating template name, description, and steps_config. DAG validation MUST be performed on update.

#### Scenario: Update template
- **WHEN** a PATCH request is sent to `/templates/:id` with updated steps_config
- **THEN** the system validates the new DAG and updates the template

### Requirement: Delete workflow template
The system SHALL allow deleting a template that is not referenced by any active tickets (status not in `done`, `cancelled`).

#### Scenario: Delete unreferenced template
- **WHEN** a DELETE request is sent to `/templates/:id` and no active tickets reference it
- **THEN** the system deletes the template

#### Scenario: Delete template with active tickets
- **WHEN** a DELETE request is sent for a template referenced by tickets with status `in_progress`
- **THEN** the system returns HTTP 409 with error message "Template is in use by active tickets"
