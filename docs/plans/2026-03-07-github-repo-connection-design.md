# GitHub Repository Connection — Design

**Date:** 2026-03-07
**Status:** Approved
**Scope:** Phase 1 (Connect only). Clone/worktree/execution deferred to Phase 2.

## Overview

Allow users to connect multiple GitHub repositories to a project via OAuth. When agents execute tickets (Phase 2), they will clone repos and use git worktrees for isolated execution.

Phase 1 covers: GitHub OAuth, account linking, repo browsing, and connecting repos to projects.

## Decisions

- **Auth:** GitHub OAuth App, backend-driven (client secret stays on server)
- **Account model:** User-level GitHub accounts, reusable across projects. Users can link multiple GitHub accounts (personal + work).
- **Repo browsing:** Browse & select from GitHub API (personal + org repos)
- **Disconnect:** Remove association in DB. Phase 2 will also clean up local clones.
- **Post-execution (Phase 2):** Configurable per project — do nothing / push branch (default) / push + auto PR

## Data Model

### `user_github_accounts`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID, PK | |
| user_id | FK -> users.id | |
| github_user_id | BigInt | GitHub's user ID |
| username | String | GitHub username |
| display_name | String, nullable | |
| avatar_url | String, nullable | |
| access_token | String, encrypted | OAuth token |
| scopes | String | Granted scopes (e.g. "repo,read:org") |
| created_at | Timestamp | |
| updated_at | Timestamp | |

### `project_repositories`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID, PK | |
| project_id | FK -> projects.id | |
| github_account_id | FK -> user_github_accounts.id | |
| github_repo_id | BigInt | GitHub's repo ID |
| repo_full_name | String | e.g. "owner/repo-name" |
| repo_url | String | Clone URL |
| default_branch | String | e.g. "main" |
| is_private | Boolean | |
| connected_at | Timestamp | |
| connected_by | FK -> users.id | |

## Backend API

### GitHub OAuth

```
GET  /auth/github/authorize     -> Returns redirect URL to GitHub OAuth page
GET  /auth/github/callback      -> Handles callback, exchanges code for token, saves account
```

### User GitHub Accounts

```
GET    /users/me/github-accounts           -> List linked GitHub accounts
DELETE /users/me/github-accounts/{id}      -> Unlink GitHub account
```

### GitHub Repo Browsing (proxied via backend using stored token)

```
GET /users/me/github-accounts/{id}/repos?page=1&per_page=30&sort=updated
    -> List repos from GitHub API (personal + org repos)
GET /users/me/github-accounts/{id}/repos/search?q=keyword
    -> Search repos
```

### Project Repositories

```
GET    /projects/{project_id}/repositories              -> List connected repos
POST   /projects/{project_id}/repositories              -> Connect repo(s) to project
DELETE /projects/{project_id}/repositories/{repo_id}    -> Disconnect repo from project
```

## Frontend Flow

### User Settings — GitHub Accounts Tab

- List connected GitHub accounts (avatar, username, scopes)
- "Connect GitHub Account" button -> opens browser for OAuth flow
- Backend polling/callback detects success -> refresh list
- Option to disconnect account

### Project Settings — Repositories Tab

- "Add Repository" button opens modal:
  1. **Step 1:** Select GitHub account (dropdown from linked accounts, or "Connect new account" link)
  2. **Step 2:** Browse repos — list with search bar, filter by owner/org, sort by updated/name
  3. User selects multiple repos via checkboxes
  4. "Connect" button -> POST to backend
- Connected repos displayed as list: repo name, owner, visibility badge (public/private), connected date
- Option to disconnect individual repos (with confirmation)

### Project Card

- Display repo count badge on project card (e.g. "3 repos")

## Phase 2 — Clone, Worktree & Execution (Deferred)

This section documents the planned approach for future implementation.

### Clone & Worktree Strategy

- **Bare clone** repo into `~/.agent-coding/repos/{owner}/{repo}` (on connect or lazy on first execution)
- **`git worktree add`** creates isolated working directory per ticket
- Worktree path: `~/.agent-coding/worktrees/{project-slug}/{ticket-slug}/{repo-name}`
- **`git fetch`** before each execution to update
- Cleanup worktree when ticket completes (configurable)

### Ticket and Repos

- One ticket can access all repos connected to the project
- Each repo gets its own worktree per ticket
- Agent (Claude Code) receives list of worktree paths as working directories

### Post-Execution Actions (configurable per project)

- Do nothing (keep local only)
- Push branch (default) — branch name pattern: `ticket/{PROJ-42}`
- Push branch + auto create Pull Request

### Disconnect Cleanup

- Remove bare repo + all related worktrees from local filesystem
