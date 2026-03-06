## ADDED Requirements

### Requirement: Create agent config
The system SHALL allow project members to create agent configurations within a project. Each agent config MUST have a name, system_prompt, and claude_model. Optional fields: description, tools_list, mcp_servers, tools_config, max_turns.

#### Scenario: Create agent config
- **WHEN** a POST request is sent to `/projects/:id/agents` with name, system_prompt, claude_model
- **THEN** the system creates an AgentConfig record linked to the project and returns it

#### Scenario: Duplicate agent name in project
- **WHEN** a POST request is sent to create an agent with a name that already exists in the same project
- **THEN** the system returns HTTP 409 with error message "Agent name already exists in this project"

### Requirement: List agent configs
The system SHALL return all agent configs for a project, including both project-specific and global (built-in) agents.

#### Scenario: List agents for project
- **WHEN** a GET request is sent to `/projects/:id/agents`
- **THEN** the system returns all AgentConfig records where project_id matches OR project_id is null (global)

### Requirement: Update agent config
The system SHALL allow project members to update any field of a project-specific agent config.

#### Scenario: Update agent
- **WHEN** a PATCH request is sent to `/projects/:id/agents/:agent_id` with updated fields
- **THEN** the system updates the agent config and returns the updated data

#### Scenario: Cannot update global agent
- **WHEN** a PATCH request is sent to update an agent config where project_id is null
- **THEN** the system returns HTTP 403 with error message "Cannot modify global agent config"

### Requirement: Delete agent config
The system SHALL allow project members to delete a project-specific agent config, provided it is not referenced by any active workflow step.

#### Scenario: Delete unused agent
- **WHEN** a DELETE request is sent to `/projects/:id/agents/:agent_id` and no running workflow steps reference it
- **THEN** the system deletes the agent config

#### Scenario: Delete agent in use
- **WHEN** a DELETE request is sent for an agent config referenced by running workflow steps
- **THEN** the system returns HTTP 409 with error message "Agent is in use by active workflow steps"

### Requirement: Agent skills association
The system SHALL allow associating skills with an agent config, with a priority order for injection into the agent's system prompt.

#### Scenario: Attach skill to agent
- **WHEN** skills are specified in the agent config's skills list
- **THEN** the system creates AgentSkill records linking the agent to each skill with the specified priority

### Requirement: Agent config fields
The system SHALL support the following agent configuration fields:
- `name` (string, required): Agent identifier
- `description` (text, optional): Human-readable description
- `system_prompt` (text, required): Base system prompt injected into Claude Code session
- `claude_model` (string, required): One of "opus", "sonnet", "haiku"
- `tools_list` (JSON array, optional): Allowed Claude Code tools (e.g. ["Read", "Write", "Bash"])
- `mcp_servers` (JSON object, optional): MCP server configurations
- `tools_config` (JSON object, optional): Additional tool settings
- `max_turns` (integer, optional, default 25): Maximum conversation turns

#### Scenario: Agent with full configuration
- **WHEN** an agent config is created with all fields populated
- **THEN** all fields are persisted and returned in API responses
