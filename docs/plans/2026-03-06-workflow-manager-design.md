# Claude Code Workflow Manager — Design

## Overview

A personal power-user tool to manage development workflows powered by Claude Code SDK (Python). Centralized backend orchestrates Claude Code sessions, streams output via WebSocket to an Electron desktop app.

## Architecture

```
Desktop App (Electron + React) ←→ FastAPI Backend ←→ Claude Code SDK
                                        ↕
                    ┌───────────────────┼───────────────────┐
                    ▼                   ▼                   ▼
                Redis               PostgreSQL          File Storage
              (Queue + PubSub)       (Data)             (assets)
                    │
                ARQ Workers
                (Claude SDK, Cypress runner)
```

### Key decisions

- **ARQ** (async Redis queue) over Celery — native asyncio, fits Claude SDK's async nature.
- **Redis PubSub** bridges workers to FastAPI to WebSocket — workers publish streaming events, FastAPI relays to the correct WebSocket channel.
- **PostgreSQL** stores projects, skills, sessions, review results.
- **File Storage** for Cypress videos/screenshots, Figma assets.

## WebSocket Strategy

- **One main WebSocket** for app-level events (notifications, status updates).
- **Per-session WebSocket** for each Claude Code session's streaming output.
- Workers publish to `Redis PubSub channel: session:{id}`, FastAPI subscribes and relays to the matching WebSocket.

## Data Model

### Project

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| name | str | |
| path | str | Filesystem path to project |
| settings | JSON | Project-specific config |
| created_at | datetime | |

### Skill

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| name | str | |
| description | str | |
| content | text | Markdown skill content |
| category | str | e.g. process, implementation |
| is_template | bool | Built-in template skill |

### ProjectSkill (many-to-many)

| Column | Type | Notes |
|--------|------|-------|
| project_id | UUID | FK → Project |
| skill_id | UUID | FK → Skill |
| enabled | bool | |
| custom_overrides | JSON | Per-project customization |
| priority | int | Injection order |

### Session

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| project_id | UUID | FK → Project |
| type | enum | chat, figma_to_code, test_run, code_review |
| status | enum | pending, running, completed, failed |
| worker_id | str | ARQ worker identifier |
| cost_usd | float | Claude API cost |
| created_at | datetime | |

### SessionMessage

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| session_id | UUID | FK → Session |
| role | str | user, assistant, system |
| content | text | |
| tool_use | JSON | Tool call details |
| timestamp | datetime | |

### FigmaTask

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| project_id | UUID | FK → Project |
| session_id | UUID | FK → Session |
| status | enum | draft, generating, completed, failed |
| figma_file_url | str | |

### FigmaNode

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| task_id | UUID | FK → FigmaTask |
| node_id | str | Figma node ID |
| description | text | User-provided description |
| component_name | str | Target component name |
| props_spec | JSON | Props specification |
| preview_url | str | Figma node preview image |

### TestRun

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| project_id | UUID | FK → Project |
| session_id | UUID | FK → Session (nullable) |
| status | enum | pending, running, passed, failed |
| video_path | str | Path to recorded video |
| created_at | datetime | |

### TestResult

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| run_id | UUID | FK → TestRun |
| spec_file | str | Cypress spec file path |
| status | enum | passed, failed |
| screenshot_path | str | |
| error_message | text | |
| duration_ms | int | |

### ReviewSession

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| project_id | UUID | FK → Project |
| session_id | UUID | FK → Session |
| branch | str | Branch or commit ref |
| status | enum | in_progress, completed |
| created_at | datetime | |

### FileReview

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| review_id | UUID | FK → ReviewSession |
| file_path | str | |
| diff_content | text | |
| ai_comments | JSON | AI-generated comments |
| user_status | enum | pending, approved, rejected |
| conversation | JSON | Per-file Q&A history |

## Feature Flows

### 1. Claude Code Session Management

1. User sends `POST /sessions` with project_id, type, prompt.
2. FastAPI enqueues task to ARQ via Redis.
3. Worker picks up task, builds `ClaudeAgentOptions` dynamically:
   - Loads enabled skills from `ProjectSkill` → injects as system prompt.
   - Sets `cwd` to project path.
   - Configures MCP servers based on project needs.
4. Worker streams via `ClaudeSDKClient`, publishes each event to Redis PubSub `session:{id}`.
5. FastAPI subscribes to the channel, relays to per-session WebSocket.
6. Multi-turn: user sends follow-up via WebSocket → enqueued as continuation task.

### 2. Skills Management

- **Available skills**: list of template + custom skills.
- **Per-project toggle**: enable/disable via `ProjectSkill`.
- **Custom overrides**: edit skill content per project (stored in `custom_overrides`).
- **Clone from template**: create project-specific copy of a template skill.
- Skills injected into `ClaudeAgentOptions.system_prompt` at session start.

### 3. Figma Design-to-Code Pipeline

1. **Setup**: User pastes Figma file URL, app connects via cursor-talk-to-figma MCP.
2. **Map nodes**: User adds Figma nodes — fills in node ID, component name, description, props spec. Form-based UI per node.
3. **Generate**: Each node mapping becomes a structured prompt. Claude reads Figma node via MCP, generates component, writes file. Results stream back via WebSocket.
4. **Review**: User previews generated components, views diffs, can iterate.

### 4. E2E Testing with Cypress

- **Run tests**: Worker executes `cypress run --config video=true` as subprocess.
- **Results**: Videos/screenshots saved to file storage, metadata in `TestResult`.
- **Write new test**: Opens Claude session with Cypress context, user describes what to test.
- **Fix with AI**: Spawns Claude session with failing test + error context.
- **UI**: Test list with status, video player, screenshot gallery.

### 5. File Review Workflow

- **Trigger**: User selects branch/commit to review.
- **Auto-review**: Claude session spawned per file with diff context → generates inline comments.
- **Interactive Q&A**: Per-file conversation with Claude, stored in `FileReview.conversation`.
- **Actions**: Approve, reject, or "Fix" (spawns new Claude session to implement fix).
- **Diff viewer**: Shows file changes with inline AI annotations.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Electron + React + Tailwind (existing) |
| Backend API | FastAPI + async SQLAlchemy + PostgreSQL |
| Task Queue | ARQ + Redis |
| Real-time | WebSocket (FastAPI) + Redis PubSub |
| AI Engine | Claude Code SDK Python (claude_agent_sdk) |
| Figma | cursor-talk-to-figma MCP server |
| E2E Testing | Cypress (video + screenshots) |
| File Storage | Local filesystem |

## Build Priority

1. Claude Code session management + WebSocket streaming (core infrastructure)
2. Skills management per project
3. Git worktree management
4. Figma design-to-code pipeline
5. E2E testing with Cypress
6. File review workflow

## Implementation Plans

Each feature has its own plan doc, designed to be executed independently (in worktrees or branches):

- [Feature 1: Session Management](2026-03-06-feature-1-session-management.md)
- [Feature 2: Skills Management](2026-03-06-feature-2-skills-management.md)
- [Feature 3: Worktree Management](2026-03-06-feature-3-worktree-management.md)
- [Feature 4: Figma Pipeline](2026-03-06-feature-4-figma-pipeline.md)
- [Feature 5: Cypress Testing](2026-03-06-feature-5-cypress-testing.md)
- [Feature 6: File Review](2026-03-06-feature-6-file-review.md)
