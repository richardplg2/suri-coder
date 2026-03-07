# GitHub Repository Connection (Phase 1) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let users connect GitHub accounts via OAuth, browse repos, and link multiple repos to projects.

**Architecture:** User-level GitHub accounts (OAuth tokens stored in DB) + project-level repo associations. Backend-driven OAuth flow. Frontend browse & select UI.

**Tech Stack:** FastAPI, SQLAlchemy (async), Alembic, httpx (GitHub API), React, React Query, Zustand, shadcn/ui

---

## Task 1: Add GitHub OAuth Config

**Files:**
- Modify: `apps/backend/app/config.py`

**Step 1: Add GitHub OAuth settings to config**

```python
# apps/backend/app/config.py
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Agent Coding API"
    debug: bool = False
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/agent_coding"
    anthropic_api_key: str = ""
    redis_url: str = "redis://localhost:6379"
    jwt_secret: str = "change-me-in-production"
    jwt_expire_minutes: int = 60 * 24  # 24 hours
    github_client_id: str = ""
    github_client_secret: str = ""
    github_redirect_uri: str = "http://localhost:8000/auth/github/callback"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
```

**Step 2: Commit**

```bash
cd apps/backend
git add app/config.py
git commit -m "feat: add GitHub OAuth config settings"
```

---

## Task 2: Create UserGitHubAccount Model

**Files:**
- Create: `apps/backend/app/models/github_account.py`
- Modify: `apps/backend/app/models/__init__.py`

**Step 1: Create the model file**

```python
# apps/backend/app/models/github_account.py
import uuid

from sqlalchemy import BigInteger, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.base import TimestampMixin, UUIDMixin


class UserGitHubAccount(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "user_github_accounts"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    github_user_id: Mapped[int] = mapped_column(BigInteger)
    username: Mapped[str] = mapped_column(String(255))
    display_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    access_token: Mapped[str] = mapped_column(Text)
    scopes: Mapped[str] = mapped_column(String(512), default="")
```

**Step 2: Register in models/__init__.py**

Add to `apps/backend/app/models/__init__.py`:

```python
from app.models.github_account import UserGitHubAccount

# Add to __all__:
"UserGitHubAccount",
```

**Step 3: Commit**

```bash
cd apps/backend
git add app/models/github_account.py app/models/__init__.py
git commit -m "feat: add UserGitHubAccount model"
```

---

## Task 3: Create ProjectRepository Model

**Files:**
- Create: `apps/backend/app/models/project_repository.py`
- Modify: `apps/backend/app/models/__init__.py`

**Step 1: Create the model file**

```python
# apps/backend/app/models/project_repository.py
import uuid
from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.base import UUIDMixin


class ProjectRepository(UUIDMixin, Base):
    __tablename__ = "project_repositories"

    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    github_account_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("user_github_accounts.id", ondelete="CASCADE")
    )
    github_repo_id: Mapped[int] = mapped_column(BigInteger)
    repo_full_name: Mapped[str] = mapped_column(String(512))
    repo_url: Mapped[str] = mapped_column(String(512))
    default_branch: Mapped[str] = mapped_column(String(255), default="main")
    is_private: Mapped[bool] = mapped_column(Boolean, default=False)
    connected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    connected_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
```

**Step 2: Register in models/__init__.py**

Add to `apps/backend/app/models/__init__.py`:

```python
from app.models.project_repository import ProjectRepository

# Add to __all__:
"ProjectRepository",
```

**Step 3: Commit**

```bash
cd apps/backend
git add app/models/project_repository.py app/models/__init__.py
git commit -m "feat: add ProjectRepository model"
```

---

## Task 4: Create Alembic Migration

**Files:**
- Create: `apps/backend/alembic/versions/<auto>_add_github_accounts_and_project_repos.py`

**Step 1: Generate migration**

```bash
cd apps/backend
uv run alembic revision --autogenerate -m "add github accounts and project repositories"
```

**Step 2: Review generated migration**

Verify it creates both `user_github_accounts` and `project_repositories` tables with correct columns and foreign keys.

**Step 3: Run migration**

```bash
cd apps/backend
uv run alembic upgrade head
```

**Step 4: Commit**

```bash
cd apps/backend
git add alembic/versions/
git commit -m "feat: add migration for github accounts and project repositories"
```

---

## Task 5: Create GitHub Schemas

**Files:**
- Create: `apps/backend/app/schemas/github.py`

**Step 1: Create schemas**

```python
# apps/backend/app/schemas/github.py
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class GitHubAccountResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    github_user_id: int
    username: str
    display_name: str | None = None
    avatar_url: str | None = None
    scopes: str
    created_at: datetime


class GitHubRepoItem(BaseModel):
    """A repo from the GitHub API (not stored in DB yet)."""
    github_repo_id: int
    full_name: str
    clone_url: str
    default_branch: str
    is_private: bool
    description: str | None = None
    updated_at: str | None = None


class ConnectReposRequest(BaseModel):
    github_account_id: uuid.UUID
    repos: list[GitHubRepoItem]


class ProjectRepositoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    github_account_id: uuid.UUID
    github_repo_id: int
    repo_full_name: str
    repo_url: str
    default_branch: str
    is_private: bool
    connected_at: datetime
    connected_by: uuid.UUID
```

**Step 2: Commit**

```bash
cd apps/backend
git add app/schemas/github.py
git commit -m "feat: add GitHub-related Pydantic schemas"
```

---

## Task 6: Create GitHub OAuth Service

**Files:**
- Create: `apps/backend/app/services/github.py`

**Step 1: Create the service**

```python
# apps/backend/app/services/github.py
import uuid
from urllib.parse import urlencode

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.github_account import UserGitHubAccount


GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize"
GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"
GITHUB_API_URL = "https://api.github.com"


def get_authorize_url(state: str) -> str:
    params = {
        "client_id": settings.github_client_id,
        "redirect_uri": settings.github_redirect_uri,
        "scope": "repo read:org",
        "state": state,
    }
    return f"{GITHUB_AUTHORIZE_URL}?{urlencode(params)}"


async def exchange_code_for_token(code: str) -> dict:
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            GITHUB_TOKEN_URL,
            json={
                "client_id": settings.github_client_id,
                "client_secret": settings.github_client_secret,
                "code": code,
                "redirect_uri": settings.github_redirect_uri,
            },
            headers={"Accept": "application/json"},
        )
        resp.raise_for_status()
        return resp.json()


async def get_github_user(access_token: str) -> dict:
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{GITHUB_API_URL}/user",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/vnd.github+json",
            },
        )
        resp.raise_for_status()
        return resp.json()


async def save_github_account(
    db: AsyncSession, user_id: uuid.UUID, access_token: str, scopes: str, gh_user: dict
) -> UserGitHubAccount:
    # Check if this GitHub account is already linked to this user
    stmt = select(UserGitHubAccount).where(
        UserGitHubAccount.user_id == user_id,
        UserGitHubAccount.github_user_id == gh_user["id"],
    )
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()

    if existing:
        existing.access_token = access_token
        existing.scopes = scopes
        existing.username = gh_user["login"]
        existing.display_name = gh_user.get("name")
        existing.avatar_url = gh_user.get("avatar_url")
        await db.commit()
        await db.refresh(existing)
        return existing

    account = UserGitHubAccount(
        user_id=user_id,
        github_user_id=gh_user["id"],
        username=gh_user["login"],
        display_name=gh_user.get("name"),
        avatar_url=gh_user.get("avatar_url"),
        access_token=access_token,
        scopes=scopes,
    )
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return account


async def get_user_github_accounts(
    db: AsyncSession, user_id: uuid.UUID
) -> list[UserGitHubAccount]:
    stmt = select(UserGitHubAccount).where(UserGitHubAccount.user_id == user_id)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def delete_github_account(
    db: AsyncSession, account_id: uuid.UUID, user_id: uuid.UUID
) -> bool:
    stmt = select(UserGitHubAccount).where(
        UserGitHubAccount.id == account_id,
        UserGitHubAccount.user_id == user_id,
    )
    result = await db.execute(stmt)
    account = result.scalar_one_or_none()
    if account is None:
        return False
    await db.delete(account)
    await db.commit()
    return True


async def list_github_repos(
    access_token: str, page: int = 1, per_page: int = 30, sort: str = "updated"
) -> list[dict]:
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{GITHUB_API_URL}/user/repos",
            params={
                "page": page,
                "per_page": per_page,
                "sort": sort,
                "visibility": "all",
                "affiliation": "owner,collaborator,organization_member",
            },
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/vnd.github+json",
            },
        )
        resp.raise_for_status()
        return resp.json()


async def search_github_repos(access_token: str, query: str) -> list[dict]:
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{GITHUB_API_URL}/search/repositories",
            params={"q": f"{query} user:@me fork:true", "per_page": 30},
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/vnd.github+json",
            },
        )
        resp.raise_for_status()
        data = resp.json()
        return data.get("items", [])
```

**Step 2: Add httpx dependency**

```bash
cd apps/backend
uv add httpx
```

**Step 3: Commit**

```bash
cd apps/backend
git add app/services/github.py pyproject.toml uv.lock
git commit -m "feat: add GitHub OAuth and API service"
```

---

## Task 7: Create Project Repository Service

**Files:**
- Create: `apps/backend/app/services/project_repository.py`

**Step 1: Create the service**

```python
# apps/backend/app/services/project_repository.py
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.github_account import UserGitHubAccount
from app.models.project_repository import ProjectRepository
from app.schemas.github import ConnectReposRequest


async def get_project_repositories(
    db: AsyncSession, project_id: uuid.UUID
) -> list[ProjectRepository]:
    stmt = select(ProjectRepository).where(
        ProjectRepository.project_id == project_id
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def connect_repos(
    db: AsyncSession,
    project_id: uuid.UUID,
    user_id: uuid.UUID,
    data: ConnectReposRequest,
) -> list[ProjectRepository]:
    # Verify the GitHub account belongs to user
    stmt = select(UserGitHubAccount).where(
        UserGitHubAccount.id == data.github_account_id,
        UserGitHubAccount.user_id == user_id,
    )
    result = await db.execute(stmt)
    if result.scalar_one_or_none() is None:
        return []

    connected = []
    for repo in data.repos:
        # Skip if already connected
        existing = await db.execute(
            select(ProjectRepository).where(
                ProjectRepository.project_id == project_id,
                ProjectRepository.github_repo_id == repo.github_repo_id,
            )
        )
        if existing.scalar_one_or_none() is not None:
            continue

        pr = ProjectRepository(
            project_id=project_id,
            github_account_id=data.github_account_id,
            github_repo_id=repo.github_repo_id,
            repo_full_name=repo.full_name,
            repo_url=repo.clone_url,
            default_branch=repo.default_branch,
            is_private=repo.is_private,
            connected_by=user_id,
        )
        db.add(pr)
        connected.append(pr)

    await db.commit()
    for pr in connected:
        await db.refresh(pr)
    return connected


async def disconnect_repo(
    db: AsyncSession, project_id: uuid.UUID, repo_id: uuid.UUID
) -> bool:
    stmt = select(ProjectRepository).where(
        ProjectRepository.id == repo_id,
        ProjectRepository.project_id == project_id,
    )
    result = await db.execute(stmt)
    repo = result.scalar_one_or_none()
    if repo is None:
        return False
    await db.delete(repo)
    await db.commit()
    return True
```

**Step 2: Commit**

```bash
cd apps/backend
git add app/services/project_repository.py
git commit -m "feat: add project repository service"
```

---

## Task 8: Create GitHub Router (OAuth + Account Management)

**Files:**
- Create: `apps/backend/app/routers/github.py`
- Modify: `apps/backend/app/main.py`

**Step 1: Create the router**

```python
# apps/backend/app/routers/github.py
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.github import GitHubAccountResponse, GitHubRepoItem
from app.services.auth import get_current_user
from app.services.github import (
    delete_github_account,
    exchange_code_for_token,
    get_authorize_url,
    get_github_user,
    get_user_github_accounts,
    list_github_repos,
    save_github_account,
    search_github_repos,
)

router = APIRouter(tags=["github"])


@router.get("/auth/github/authorize")
async def github_authorize():
    # In production, generate and store a CSRF state token
    url = get_authorize_url(state="oauth")
    return {"authorize_url": url}


@router.get("/auth/github/callback")
async def github_callback(
    code: str = Query(...),
    state: str = Query(""),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    token_data = await exchange_code_for_token(code)
    access_token = token_data.get("access_token")
    if not access_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to obtain access token from GitHub",
        )

    scopes = token_data.get("scope", "")
    gh_user = await get_github_user(access_token)
    account = await save_github_account(db, user.id, access_token, scopes, gh_user)

    return GitHubAccountResponse.model_validate(account)


@router.get(
    "/users/me/github-accounts",
    response_model=list[GitHubAccountResponse],
)
async def list_accounts(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    accounts = await get_user_github_accounts(db, user.id)
    return [GitHubAccountResponse.model_validate(a) for a in accounts]


@router.delete(
    "/users/me/github-accounts/{account_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def unlink_account(
    account_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    deleted = await delete_github_account(db, account_id, user.id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="GitHub account not found",
        )


@router.get(
    "/users/me/github-accounts/{account_id}/repos",
    response_model=list[GitHubRepoItem],
)
async def browse_repos(
    account_id: uuid.UUID,
    page: int = Query(1, ge=1),
    per_page: int = Query(30, ge=1, le=100),
    sort: str = Query("updated"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import select
    from app.models.github_account import UserGitHubAccount

    stmt = select(UserGitHubAccount).where(
        UserGitHubAccount.id == account_id,
        UserGitHubAccount.user_id == user.id,
    )
    result = await db.execute(stmt)
    account = result.scalar_one_or_none()
    if account is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="GitHub account not found",
        )

    repos = await list_github_repos(account.access_token, page, per_page, sort)
    return [
        GitHubRepoItem(
            github_repo_id=r["id"],
            full_name=r["full_name"],
            clone_url=r["clone_url"],
            default_branch=r.get("default_branch", "main"),
            is_private=r["private"],
            description=r.get("description"),
            updated_at=r.get("updated_at"),
        )
        for r in repos
    ]


@router.get(
    "/users/me/github-accounts/{account_id}/repos/search",
    response_model=list[GitHubRepoItem],
)
async def search_repos(
    account_id: uuid.UUID,
    q: str = Query(..., min_length=1),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import select
    from app.models.github_account import UserGitHubAccount

    stmt = select(UserGitHubAccount).where(
        UserGitHubAccount.id == account_id,
        UserGitHubAccount.user_id == user.id,
    )
    result = await db.execute(stmt)
    account = result.scalar_one_or_none()
    if account is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="GitHub account not found",
        )

    repos = await search_github_repos(account.access_token, q)
    return [
        GitHubRepoItem(
            github_repo_id=r["id"],
            full_name=r["full_name"],
            clone_url=r["clone_url"],
            default_branch=r.get("default_branch", "main"),
            is_private=r["private"],
            description=r.get("description"),
            updated_at=r.get("updated_at"),
        )
        for r in repos
    ]
```

**Step 2: Register router in main.py**

Add to `apps/backend/app/main.py`:

```python
from app.routers import auth, projects, agents, templates, tickets, sessions, workflow, websocket, github

# After existing include_router calls:
app.include_router(github.router)
```

**Step 3: Commit**

```bash
cd apps/backend
git add app/routers/github.py app/main.py
git commit -m "feat: add GitHub OAuth and repo browsing router"
```

---

## Task 9: Create Project Repositories Router

**Files:**
- Modify: `apps/backend/app/routers/projects.py`

**Step 1: Read current projects router to understand exact structure**

Read `apps/backend/app/routers/projects.py` before modifying.

**Step 2: Add repo endpoints to projects router**

Add to the end of `apps/backend/app/routers/projects.py`:

```python
# Add these imports at top:
from app.schemas.github import ConnectReposRequest, ProjectRepositoryResponse
from app.services.project_repository import (
    connect_repos,
    disconnect_repo,
    get_project_repositories,
)

# Add these endpoints:

@router.get(
    "/{project_id}/repositories",
    response_model=list[ProjectRepositoryResponse],
)
async def list_repositories(
    access: tuple = Depends(require_project_member),
    db: AsyncSession = Depends(get_db),
):
    project, _member = access
    repos = await get_project_repositories(db, project.id)
    return [ProjectRepositoryResponse.model_validate(r) for r in repos]


@router.post(
    "/{project_id}/repositories",
    response_model=list[ProjectRepositoryResponse],
    status_code=status.HTTP_201_CREATED,
)
async def add_repositories(
    data: ConnectReposRequest,
    access: tuple = Depends(require_project_owner),
    db: AsyncSession = Depends(get_db),
):
    project, member = access
    repos = await connect_repos(db, project.id, member.user_id, data)
    return [ProjectRepositoryResponse.model_validate(r) for r in repos]


@router.delete(
    "/{project_id}/repositories/{repo_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_repository(
    repo_id: uuid.UUID,
    access: tuple = Depends(require_project_owner),
    db: AsyncSession = Depends(get_db),
):
    project, _member = access
    deleted = await disconnect_repo(db, project.id, repo_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Repository not found",
        )
```

**Step 3: Commit**

```bash
cd apps/backend
git add app/routers/projects.py
git commit -m "feat: add project repository endpoints"
```

---

## Task 10: Backend Smoke Test

**Step 1: Run the backend**

```bash
cd apps/backend
uv run fastapi dev app/main.py --port 8000
```

Expected: Server starts without import errors.

**Step 2: Check API docs**

Open `http://localhost:8000/docs` — verify new endpoints appear:
- `/auth/github/authorize`
- `/auth/github/callback`
- `/users/me/github-accounts`
- `/users/me/github-accounts/{account_id}`
- `/users/me/github-accounts/{account_id}/repos`
- `/users/me/github-accounts/{account_id}/repos/search`
- `/projects/{project_id}/repositories`

**Step 3: Commit (if any fixes needed)**

---

## Task 11: Add Frontend TypeScript Types

**Files:**
- Modify: `apps/desktop/src/renderer/types/api.ts`

**Step 1: Add GitHub types**

Add to the end of `apps/desktop/src/renderer/types/api.ts`:

```typescript
export interface GitHubAccount {
  id: string
  github_user_id: number
  username: string
  display_name: string | null
  avatar_url: string | null
  scopes: string
  created_at: string
}

export interface GitHubRepoItem {
  github_repo_id: number
  full_name: string
  clone_url: string
  default_branch: string
  is_private: boolean
  description: string | null
  updated_at: string | null
}

export interface ConnectReposRequest {
  github_account_id: string
  repos: GitHubRepoItem[]
}

export interface ProjectRepository {
  id: string
  project_id: string
  github_account_id: string
  github_repo_id: number
  repo_full_name: string
  repo_url: string
  default_branch: string
  is_private: boolean
  connected_at: string
  connected_by: string
}
```

**Step 2: Commit**

```bash
git add apps/desktop/src/renderer/types/api.ts
git commit -m "feat: add GitHub and project repository frontend types"
```

---

## Task 12: Add GitHub React Query Hooks

**Files:**
- Create: `apps/desktop/src/renderer/hooks/queries/use-github.ts`

**Step 1: Create the hooks file**

```typescript
// apps/desktop/src/renderer/hooks/queries/use-github.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from 'renderer/lib/api-client'
import type {
  GitHubAccount,
  GitHubRepoItem,
  ProjectRepository,
  ConnectReposRequest,
} from 'renderer/types/api'

// --- GitHub Accounts ---

export function useGitHubAccounts() {
  return useQuery({
    queryKey: ['github-accounts'],
    queryFn: () => apiClient<GitHubAccount[]>('/users/me/github-accounts'),
  })
}

export function useDeleteGitHubAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (accountId: string) =>
      apiClient<void>(`/users/me/github-accounts/${accountId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['github-accounts'] }),
  })
}

// --- GitHub Repo Browsing ---

export function useGitHubRepos(accountId: string, page = 1, perPage = 30) {
  return useQuery({
    queryKey: ['github-accounts', accountId, 'repos', { page, perPage }],
    queryFn: () =>
      apiClient<GitHubRepoItem[]>(
        `/users/me/github-accounts/${accountId}/repos?page=${page}&per_page=${perPage}`
      ),
    enabled: !!accountId,
  })
}

export function useSearchGitHubRepos(accountId: string, query: string) {
  return useQuery({
    queryKey: ['github-accounts', accountId, 'repos', 'search', query],
    queryFn: () =>
      apiClient<GitHubRepoItem[]>(
        `/users/me/github-accounts/${accountId}/repos/search?q=${encodeURIComponent(query)}`
      ),
    enabled: !!accountId && query.length > 0,
  })
}

// --- Project Repositories ---

export function useProjectRepositories(projectId: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'repositories'],
    queryFn: () =>
      apiClient<ProjectRepository[]>(`/projects/${projectId}/repositories`),
    enabled: !!projectId,
  })
}

export function useConnectRepos(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ConnectReposRequest) =>
      apiClient<ProjectRepository[]>(`/projects/${projectId}/repositories`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'repositories'] })
      qc.invalidateQueries({ queryKey: ['projects', projectId] })
    },
  })
}

export function useDisconnectRepo(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (repoId: string) =>
      apiClient<void>(`/projects/${projectId}/repositories/${repoId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'repositories'] })
      qc.invalidateQueries({ queryKey: ['projects', projectId] })
    },
  })
}
```

**Step 2: Commit**

```bash
git add apps/desktop/src/renderer/hooks/queries/use-github.ts
git commit -m "feat: add GitHub and project repository React Query hooks"
```

---

## Task 13: Create Connect Repos Modal

**Files:**
- Create: `apps/desktop/src/renderer/components/modals/connect-repos-modal.tsx`
- Modify: `apps/desktop/src/renderer/components/modals/index.tsx`

**Step 1: Create the modal component**

```tsx
// apps/desktop/src/renderer/components/modals/connect-repos-modal.tsx
import { useState } from 'react'
import { GitBranch, Lock, Globe, Search, Check } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
  Button, Input, Spinner, ScrollArea, Badge,
} from '@agent-coding/ui'
import { useModalStore } from 'renderer/stores/use-modal-store'
import {
  useGitHubAccounts,
  useGitHubRepos,
  useSearchGitHubRepos,
  useConnectRepos,
} from 'renderer/hooks/queries/use-github'
import type { GitHubRepoItem } from 'renderer/types/api'

export function ConnectReposModal() {
  const { activeModal, modalData, close } = useModalStore()
  const isOpen = activeModal === 'connect-repos'
  const projectId = (modalData?.projectId as string) ?? ''

  const [selectedAccountId, setSelectedAccountId] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRepos, setSelectedRepos] = useState<GitHubRepoItem[]>([])
  const [error, setError] = useState<string | null>(null)

  const { data: accounts, isLoading: accountsLoading } = useGitHubAccounts()
  const { data: repos, isLoading: reposLoading } = useGitHubRepos(selectedAccountId)
  const { data: searchResults, isLoading: searchLoading } = useSearchGitHubRepos(
    selectedAccountId,
    searchQuery
  )
  const connectRepos = useConnectRepos(projectId)

  const displayedRepos = searchQuery.length > 0 ? searchResults : repos
  const isLoadingRepos = searchQuery.length > 0 ? searchLoading : reposLoading

  function toggleRepo(repo: GitHubRepoItem) {
    setSelectedRepos((prev) => {
      const exists = prev.some((r) => r.github_repo_id === repo.github_repo_id)
      if (exists) return prev.filter((r) => r.github_repo_id !== repo.github_repo_id)
      return [...prev, repo]
    })
  }

  function isSelected(repo: GitHubRepoItem) {
    return selectedRepos.some((r) => r.github_repo_id === repo.github_repo_id)
  }

  async function handleConnect() {
    if (!selectedAccountId || selectedRepos.length === 0) return
    setError(null)
    try {
      await connectRepos.mutateAsync({
        github_account_id: selectedAccountId,
        repos: selectedRepos,
      })
      handleClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect repositories')
    }
  }

  function handleClose() {
    close()
    setSelectedAccountId('')
    setSearchQuery('')
    setSelectedRepos([])
    setError(null)
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Connect Repositories</DialogTitle>
          <DialogDescription>Select repositories to connect to this project.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Account selector */}
          {accountsLoading ? (
            <Spinner label="Loading accounts..." />
          ) : !accounts || accounts.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">
              No GitHub accounts linked. Go to Settings to connect one.
            </p>
          ) : (
            <div className="space-y-1.5">
              <label className="text-label">GitHub Account</label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-[13px]"
                value={selectedAccountId}
                onChange={(e) => {
                  setSelectedAccountId(e.target.value)
                  setSearchQuery('')
                  setSelectedRepos([])
                }}
              >
                <option value="">Select an account...</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.username} {a.display_name ? `(${a.display_name})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Search + repo list */}
          {selectedAccountId && (
            <>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search repositories..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              <ScrollArea className="h-[300px] rounded-md border">
                {isLoadingRepos ? (
                  <div className="flex h-full items-center justify-center">
                    <Spinner label="Loading repos..." />
                  </div>
                ) : !displayedRepos || displayedRepos.length === 0 ? (
                  <p className="p-4 text-[13px] text-muted-foreground">No repositories found.</p>
                ) : (
                  <div className="divide-y">
                    {displayedRepos.map((repo) => (
                      <button
                        key={repo.github_repo_id}
                        type="button"
                        className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-secondary/50 ${
                          isSelected(repo) ? 'bg-primary/5' : ''
                        }`}
                        onClick={() => toggleRepo(repo)}
                      >
                        <div className="flex size-5 items-center justify-center rounded border">
                          {isSelected(repo) && <Check className="size-3.5 text-primary" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <GitBranch className="size-3.5 text-muted-foreground" />
                            <span className="text-[13px] font-medium truncate">
                              {repo.full_name}
                            </span>
                            {repo.is_private ? (
                              <Lock className="size-3 text-muted-foreground" />
                            ) : (
                              <Globe className="size-3 text-muted-foreground" />
                            )}
                          </div>
                          {repo.description && (
                            <p className="text-caption text-muted-foreground truncate mt-0.5">
                              {repo.description}
                            </p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>

              {selectedRepos.length > 0 && (
                <p className="text-[13px] text-muted-foreground">
                  {selectedRepos.length} repositor{selectedRepos.length === 1 ? 'y' : 'ies'} selected
                </p>
              )}
            </>
          )}

          {error && <p className="text-[13px] text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleConnect}
            disabled={selectedRepos.length === 0 || connectRepos.isPending}
          >
            {connectRepos.isPending ? 'Connecting...' : `Connect (${selectedRepos.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

**Step 2: Register modal in provider**

Update `apps/desktop/src/renderer/components/modals/index.tsx`:

```tsx
import { CreateProjectModal } from './create-project-modal'
import { DeleteProjectModal } from './delete-project-modal'
import { ConnectReposModal } from './connect-repos-modal'

export function ModalProvider() {
  return (
    <>
      <CreateProjectModal />
      <DeleteProjectModal />
      <ConnectReposModal />
    </>
  )
}
```

**Step 3: Commit**

```bash
git add apps/desktop/src/renderer/components/modals/connect-repos-modal.tsx
git add apps/desktop/src/renderer/components/modals/index.tsx
git commit -m "feat: add connect repos modal with browse and select"
```

---

## Task 14: Create Project Repositories Tab

**Files:**
- Create: `apps/desktop/src/renderer/screens/project/project-repositories.tsx`

**Step 1: Create the repositories tab component**

```tsx
// apps/desktop/src/renderer/screens/project/project-repositories.tsx
import { GitBranch, Lock, Globe, Plus, Trash2 } from 'lucide-react'
import { Button, ScrollArea, Spinner, EmptyState } from '@agent-coding/ui'
import { useProjectRepositories, useDisconnectRepo } from 'renderer/hooks/queries/use-github'
import { useModalStore } from 'renderer/stores/use-modal-store'
import type { Project } from 'renderer/types/api'

interface ProjectRepositoriesProps {
  project: Project
}

export function ProjectRepositories({ project }: ProjectRepositoriesProps) {
  const { data: repos, isLoading } = useProjectRepositories(project.id)
  const disconnectRepo = useDisconnectRepo(project.id)
  const { open } = useModalStore()

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner label="Loading repositories..." />
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
      <div className="mx-auto max-w-lg p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Repositories</h2>
          <Button
            size="sm"
            onClick={() => open('connect-repos', { projectId: project.id })}
          >
            <Plus className="mr-1.5 size-4" />
            Add Repository
          </Button>
        </div>

        {!repos || repos.length === 0 ? (
          <EmptyState
            icon={<GitBranch className="size-8" />}
            title="No repositories connected"
            description="Connect GitHub repositories to this project."
            action={
              <Button
                size="sm"
                onClick={() => open('connect-repos', { projectId: project.id })}
              >
                Connect Repository
              </Button>
            }
          />
        ) : (
          <div className="space-y-2">
            {repos.map((repo) => (
              <div
                key={repo.id}
                className="flex items-center justify-between rounded-lg border px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <GitBranch className="size-4 text-muted-foreground" />
                    <span className="text-[13px] font-medium truncate">
                      {repo.repo_full_name}
                    </span>
                    {repo.is_private ? (
                      <Lock className="size-3 text-muted-foreground" />
                    ) : (
                      <Globe className="size-3 text-muted-foreground" />
                    )}
                  </div>
                  <p className="text-caption text-muted-foreground mt-0.5">
                    Branch: {repo.default_branch}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => disconnectRepo.mutate(repo.id)}
                  disabled={disconnectRepo.isPending}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </ScrollArea>
  )
}
```

**Step 2: Commit**

```bash
git add apps/desktop/src/renderer/screens/project/project-repositories.tsx
git commit -m "feat: add project repositories tab component"
```

---

## Task 15: Wire Repositories Tab into Project Screen

**Files:**
- Modify: `apps/desktop/src/renderer/screens/project.tsx`
- Modify: `apps/desktop/src/renderer/components/sidebar/project-sidebar.tsx`

**Step 1: Add "Repositories" nav item to project sidebar**

Update `apps/desktop/src/renderer/components/sidebar/project-sidebar.tsx`:

```tsx
import { LayoutGrid, Bot, Workflow, Settings, GitBranch } from 'lucide-react'
import { SourceList } from '@agent-coding/ui'
import type { SourceListItem } from '@agent-coding/ui'
import { useSidebarStore } from 'renderer/stores/use-sidebar-store'

const NAV_ITEMS: SourceListItem[] = [
  { id: 'tickets', label: 'Tickets', icon: <LayoutGrid className="size-4" /> },
  { id: 'repositories', label: 'Repositories', icon: <GitBranch className="size-4" /> },
  { id: 'agents', label: 'Agents', icon: <Bot className="size-4" /> },
  { id: 'templates', label: 'Templates', icon: <Workflow className="size-4" /> },
  { id: 'settings', label: 'Settings', icon: <Settings className="size-4" /> },
]

interface ProjectSidebarProps {
  projectName: string
}

export function ProjectSidebar({ projectName }: ProjectSidebarProps) {
  const { activeNav, setActiveNav } = useSidebarStore()

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-3 py-2">
        <div className="window-title truncate">{projectName}</div>
      </div>
      <div className="section-header px-3 py-1.5">
        Manage
      </div>
      <SourceList
        items={NAV_ITEMS}
        selectedId={activeNav}
        onSelect={setActiveNav}
      />
      <div className="flex-1" />
    </div>
  )
}
```

**Step 2: Add repositories case to project screen**

Update `apps/desktop/src/renderer/screens/project.tsx`:

```tsx
import { useSidebarStore } from 'renderer/stores/use-sidebar-store'
import { useProject } from 'renderer/hooks/queries/use-projects'
import { Spinner } from '@agent-coding/ui'
import { TicketsBoard } from './project/tickets-board'
import { ProjectSettings } from './project/project-settings'
import { ProjectRepositories } from './project/project-repositories'

interface ProjectScreenProps {
  projectId: string
}

export function ProjectScreen({ projectId }: ProjectScreenProps) {
  const { data: project, isLoading } = useProject(projectId)
  const { activeNav } = useSidebarStore()

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner label="Loading project..." />
      </div>
    )
  }

  if (!project) {
    return <div className="p-6 text-[13px] text-muted-foreground">Project not found</div>
  }

  switch (activeNav) {
    case 'settings':
      return <ProjectSettings project={project} />
    case 'repositories':
      return <ProjectRepositories project={project} />
    case 'agents':
      return <div className="p-6 text-[13px] text-muted-foreground">Agents config — coming soon</div>
    case 'templates':
      return <div className="p-6 text-[13px] text-muted-foreground">Templates editor — coming soon</div>
    default:
      return <TicketsBoard project={project} />
  }
}
```

**Step 3: Commit**

```bash
git add apps/desktop/src/renderer/screens/project.tsx
git add apps/desktop/src/renderer/components/sidebar/project-sidebar.tsx
git commit -m "feat: wire repositories tab into project screen and sidebar"
```

---

## Task 16: Add Repo Count to Project Card

**Files:**
- Modify: `apps/desktop/src/renderer/components/project-card.tsx`

**Step 1: Read current project-card.tsx (already read above)**

**Step 2: Add repo count display**

Update `apps/desktop/src/renderer/components/project-card.tsx` — add repo_count display in CardContent:

```tsx
import { Folder, MoreHorizontal, Settings, Trash2, GitBranch } from 'lucide-react'
import {
  Card, CardHeader, CardTitle, CardContent, CardAction,
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  Button,
} from '@agent-coding/ui'
import type { Project } from 'renderer/types/api'
import { useProjectRepositories } from 'renderer/hooks/queries/use-github'

interface ProjectCardProps {
  project: Project
  onClick: () => void
  onSettings: () => void
  onDelete: () => void
}

export function ProjectCard({ project, onClick, onSettings, onDelete }: ProjectCardProps) {
  const { data: repos } = useProjectRepositories(project.id)
  const repoCount = repos?.length ?? 0

  return (
    <Card
      className="cursor-pointer rounded-[var(--radius-card)] transition-all duration-150 hover:bg-secondary/50 hover:shadow-[var(--shadow-sm)]"
      onClick={onClick}
    >
      <CardHeader>
        <div className="flex items-center gap-2">
          <Folder className="size-4 text-primary" />
          <CardTitle className="text-[13px] font-medium">{project.name}</CardTitle>
        </div>
        <CardAction>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon-sm" className="size-7">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onSettings() }}>
                <Settings className="mr-2 size-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={(e) => { e.stopPropagation(); onDelete() }}
              >
                <Trash2 className="mr-2 size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-0.5">
        <p className="text-caption text-muted-foreground truncate">{project.path}</p>
        <div className="flex items-center gap-3">
          <p className="text-caption text-muted-foreground">
            {project.member_count} member{project.member_count !== 1 ? 's' : ''}
          </p>
          {repoCount > 0 && (
            <p className="text-caption text-muted-foreground flex items-center gap-1">
              <GitBranch className="size-3" />
              {repoCount} repo{repoCount !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
```

**Step 3: Commit**

```bash
git add apps/desktop/src/renderer/components/project-card.tsx
git commit -m "feat: show repo count on project card"
```

---

## Task 17: Add GitHub Accounts Section to User Settings

**Files:**
- Create: `apps/desktop/src/renderer/screens/settings/github-accounts.tsx`

Note: This task depends on whether a user settings screen already exists. If not, we need to create a minimal one. Check if there's a user settings screen first. If the project doesn't have one, add a "GitHub Accounts" section to the project settings as a temporary location, or create a simple settings screen.

**Step 1: Create the GitHub accounts component**

```tsx
// apps/desktop/src/renderer/screens/settings/github-accounts.tsx
import { useState } from 'react'
import { Github, Trash2, ExternalLink } from 'lucide-react'
import { Button, ScrollArea, Spinner, EmptyState } from '@agent-coding/ui'
import { useGitHubAccounts, useDeleteGitHubAccount } from 'renderer/hooks/queries/use-github'
import { apiClient } from 'renderer/lib/api-client'

export function GitHubAccounts() {
  const { data: accounts, isLoading } = useGitHubAccounts()
  const deleteAccount = useDeleteGitHubAccount()
  const [connecting, setConnecting] = useState(false)

  async function handleConnect() {
    setConnecting(true)
    try {
      const data = await apiClient<{ authorize_url: string }>('/auth/github/authorize')
      window.open(data.authorize_url, '_blank')
    } catch {
      // ignore
    } finally {
      setConnecting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner label="Loading GitHub accounts..." />
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
      <div className="mx-auto max-w-lg p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">GitHub Accounts</h2>
          <Button size="sm" onClick={handleConnect} disabled={connecting}>
            <Github className="mr-1.5 size-4" />
            {connecting ? 'Opening...' : 'Connect Account'}
          </Button>
        </div>

        {!accounts || accounts.length === 0 ? (
          <EmptyState
            icon={<Github className="size-8" />}
            title="No GitHub accounts connected"
            description="Connect a GitHub account to browse and link repositories to your projects."
            action={
              <Button size="sm" onClick={handleConnect}>
                Connect GitHub Account
              </Button>
            }
          />
        ) : (
          <div className="space-y-2">
            {accounts.map((account) => (
              <div
                key={account.id}
                className="flex items-center justify-between rounded-lg border px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  {account.avatar_url ? (
                    <img
                      src={account.avatar_url}
                      alt={account.username}
                      className="size-8 rounded-full"
                    />
                  ) : (
                    <Github className="size-8 text-muted-foreground" />
                  )}
                  <div>
                    <p className="text-[13px] font-medium">{account.username}</p>
                    {account.display_name && (
                      <p className="text-caption text-muted-foreground">{account.display_name}</p>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => deleteAccount.mutate(account.id)}
                  disabled={deleteAccount.isPending}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </ScrollArea>
  )
}
```

**Step 2: Commit**

```bash
mkdir -p apps/desktop/src/renderer/screens/settings
git add apps/desktop/src/renderer/screens/settings/github-accounts.tsx
git commit -m "feat: add GitHub accounts settings component"
```

---

## Task 18: Wire GitHub Accounts into Navigation

This task depends on the existing navigation structure. The `GitHubAccounts` component needs to be accessible from somewhere. Options:

1. If there's no global settings screen, add a "GitHub" nav item to the home sidebar
2. Or add it as a new tab type

**Step 1: Check if home sidebar or app-level settings exist**

Read `apps/desktop/src/renderer/components/sidebar/home-sidebar.tsx` and decide where to place the link.

**Step 2: Add GitHub Accounts to project sidebar (simplest approach)**

Add a "GitHub" nav item under the "Manage" section in `project-sidebar.tsx`, or create a global settings screen. The exact approach depends on the existing navigation — the implementer should read the home sidebar and decide the best placement.

**Step 3: Commit after wiring**

```bash
git add -A
git commit -m "feat: wire GitHub accounts into navigation"
```

---

## Task 19: Lint and Typecheck

**Step 1: Run linters**

```bash
pnpm lint
pnpm typecheck
```

**Step 2: Fix any issues**

Fix lint/type errors if any. Common issues:
- Missing imports
- Unused variables
- Type mismatches

**Step 3: Commit fixes**

```bash
git add -A
git commit -m "fix: resolve lint and typecheck issues"
```

---

## Task 20: Integration Smoke Test

**Step 1: Start backend**

```bash
cd apps/backend
uv run alembic upgrade head
uv run fastapi dev app/main.py --port 8000
```

**Step 2: Start frontend**

```bash
pnpm --filter my-electron-app dev
```

**Step 3: Manual verification checklist**

- [ ] App loads without errors
- [ ] Project sidebar shows "Repositories" nav item
- [ ] Clicking "Repositories" shows empty state with "Connect Repository" button
- [ ] Clicking "Add Repository" opens connect-repos modal
- [ ] Modal shows "No GitHub accounts linked" if no accounts
- [ ] GitHub accounts endpoint returns empty list (no 500 error)
- [ ] Project card renders without errors

**Step 4: Commit any final fixes**

```bash
git add -A
git commit -m "fix: resolve integration issues"
```
