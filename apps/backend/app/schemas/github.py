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
