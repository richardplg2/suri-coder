## ADDED Requirements

### Requirement: Session creation
The system SHALL create a Session record when a workflow step is scheduled for execution. The session MUST include a git branch name derived from the ticket key and step name.

#### Scenario: Session created for step
- **WHEN** a workflow step is scheduled for execution
- **THEN** a Session record is created with status `running`, git_branch `{ticket-key}/{step-name}`, and started_at timestamp

### Requirement: Claude Code SDK execution
The system SHALL execute each session as a Claude Code SDK call using `ClaudeAgentOptions` and `ClaudeSDKClient` with the agent config's system prompt, model, tools, and MCP servers.

#### Scenario: Session uses agent config
- **WHEN** a session executes for a step with agent_config "designer"
- **THEN** the Claude Code SDK is called with the designer's system_prompt, claude_model, tools_list, and mcp_servers

#### Scenario: Session receives dependency context
- **WHEN** a session executes for a step that has completed dependencies
- **THEN** the prompt includes context from the completed dependency steps (file references, branch names)

### Requirement: Git worktree isolation
The system SHALL create a git worktree for each session's execution, providing an isolated copy of the repository.

#### Scenario: Worktree creation
- **WHEN** a session starts executing
- **THEN** a git worktree is created at a unique path with the session's branch name

#### Scenario: Worktree contains dependency work
- **WHEN** a step depends on completed steps
- **THEN** the worktree branch is created from a merge of all dependency branches

### Requirement: Session streaming
The system SHALL stream Claude Code SDK output via WebSocket as messages are generated. Each message MUST be saved to SessionMessage.

#### Scenario: Stream assistant messages
- **WHEN** Claude Code generates a response during a session
- **THEN** the message is published to WebSocket channel `ws/sessions/{id}` and saved as a SessionMessage

#### Scenario: Stream tool use events
- **WHEN** Claude Code uses a tool during a session
- **THEN** the tool use details are published to WebSocket and saved in SessionMessage.tool_use

### Requirement: Session completion
The system SHALL update session status to `completed` or `failed` based on the Claude Code SDK result, and record cost and token usage.

#### Scenario: Successful session
- **WHEN** a Claude Code SDK session completes without error
- **THEN** the session status is set to `completed`, finished_at is recorded, cost_usd and tokens_used are captured from the ResultMessage

#### Scenario: Failed session
- **WHEN** a Claude Code SDK session exits with an error
- **THEN** the session status is set to `failed`, error_message is recorded, and the exit_code is captured

### Requirement: Session cancellation
The system SHALL allow cancelling a running session.

#### Scenario: Cancel session
- **WHEN** a POST request is sent to `/sessions/:id/cancel`
- **THEN** the system terminates the Claude Code process, sets session status to `cancelled`, and triggers the DAG tick

### Requirement: Session cost tracking
The system SHALL track the cost in USD and total tokens used for each session.

#### Scenario: Cost captured from SDK
- **WHEN** a Claude Code SDK session completes and emits a ResultMessage with total_cost_usd
- **THEN** the session's cost_usd and tokens_used fields are updated

### Requirement: Session history
The system SHALL provide an endpoint to list all sessions for a workflow step, ordered by creation time.

#### Scenario: List step sessions
- **WHEN** a GET request is sent to `/steps/:id/sessions`
- **THEN** the system returns all Session records for the step, ordered by started_at descending

### Requirement: Session detail
The system SHALL provide an endpoint to retrieve a single session with its messages.

#### Scenario: Get session with messages
- **WHEN** a GET request is sent to `/sessions/:id`
- **THEN** the system returns the session data including all SessionMessage records ordered by timestamp

### Requirement: ARQ worker execution
The system SHALL execute Claude Code SDK sessions as ARQ background tasks, publishing streaming events via Redis PubSub.

#### Scenario: Session enqueued to ARQ
- **WHEN** a session is created and scheduled
- **THEN** a `run_claude_agent` task is enqueued to ARQ with session_id, cwd, system_prompt, and agent configuration

#### Scenario: Worker publishes to Redis PubSub
- **WHEN** the ARQ worker receives streaming messages from Claude Code SDK
- **THEN** each message is published to Redis PubSub channel `session:{session_id}`

#### Scenario: FastAPI relays PubSub to WebSocket
- **WHEN** a client is connected to WebSocket `ws/sessions/{id}`
- **THEN** the FastAPI server subscribes to Redis PubSub channel `session:{id}` and relays messages to the WebSocket
