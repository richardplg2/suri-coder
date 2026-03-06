## ADDED Requirements

### Requirement: Create project
The system SHALL allow authenticated users to create projects with a name, slug, filesystem path, and optional description and repo URL. The slug MUST be unique and uppercase (used as ticket key prefix).

#### Scenario: Successful project creation
- **WHEN** a POST request is sent to `/projects` with name, slug, path, and optional description
- **THEN** the system creates a Project record, adds the creator as an `owner` member, and returns the project data

#### Scenario: Duplicate slug
- **WHEN** a POST request is sent to `/projects` with a slug that already exists
- **THEN** the system returns HTTP 409 with error message "Project slug already exists"

### Requirement: List projects
The system SHALL return all projects the authenticated user is a member of.

#### Scenario: List user's projects
- **WHEN** a GET request is sent to `/projects`
- **THEN** the system returns a list of projects where the user is a member (owner or member role)

### Requirement: Get project detail
The system SHALL return a single project by ID, including member count.

#### Scenario: Get project
- **WHEN** a GET request is sent to `/projects/:id` by a project member
- **THEN** the system returns the project data including member count

#### Scenario: Non-member access
- **WHEN** a GET request is sent to `/projects/:id` by a user who is not a member
- **THEN** the system returns HTTP 403

### Requirement: Update project
The system SHALL allow project owners to update project name, description, path, repo_url, and settings.

#### Scenario: Owner updates project
- **WHEN** a PATCH request is sent to `/projects/:id` by a project owner with updated fields
- **THEN** the system updates the project and returns the updated data

#### Scenario: Member attempts update
- **WHEN** a PATCH request is sent to `/projects/:id` by a member (not owner)
- **THEN** the system returns HTTP 403

### Requirement: Delete project
The system SHALL allow project owners to delete a project and all associated data.

#### Scenario: Owner deletes project
- **WHEN** a DELETE request is sent to `/projects/:id` by a project owner
- **THEN** the system deletes the project and all associated tickets, steps, sessions, agents, and templates

### Requirement: Project membership
The system SHALL support adding and removing team members with `owner` or `member` roles.

#### Scenario: Add member to project
- **WHEN** a POST request is sent to `/projects/:id/members` with user_id and role by a project owner
- **THEN** the system adds the user as a member with the specified role

#### Scenario: Remove member from project
- **WHEN** a DELETE request is sent to `/projects/:id/members/:user_id` by a project owner
- **THEN** the system removes the user from the project

### Requirement: Project settings
The system SHALL store project-specific settings as a JSON object, including default workflow template, git configuration, and MCP server defaults.

#### Scenario: Update project settings
- **WHEN** a PATCH request is sent to `/projects/:id` with a `settings` JSON object
- **THEN** the system merges the new settings with existing settings and persists them
