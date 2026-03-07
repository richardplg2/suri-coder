import secrets
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.github_account import UserGitHubAccount
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

OAUTH_STATE_TTL = 600  # 10 minutes

router = APIRouter(tags=["github"])


async def _get_user_github_account(
    account_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserGitHubAccount:
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
    return account


@router.get("/auth/github/authorize")
async def github_authorize(
    request: Request,
    user: User = Depends(get_current_user),
):
    state = secrets.token_urlsafe(32)
    redis = request.app.state.redis
    await redis.set(
        f"github_oauth:{state}",
        str(user.id),
        ex=OAUTH_STATE_TTL,
    )
    url = get_authorize_url(state=state)
    return {"authorize_url": url}


@router.get("/auth/github/callback")
async def github_callback(
    request: Request,
    code: str = Query(...),
    state: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    # Validate CSRF state and retrieve user_id
    redis = request.app.state.redis
    user_id_str = await redis.get(f"github_oauth:{state}")
    if user_id_str is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OAuth state",
        )
    await redis.delete(f"github_oauth:{state}")

    if isinstance(user_id_str, bytes):
        user_id_str = user_id_str.decode()
    user_id = uuid.UUID(user_id_str)

    token_data = await exchange_code_for_token(code)
    access_token = token_data.get("access_token")
    if not access_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to obtain access token from GitHub",
        )

    scopes = token_data.get("scope", "")
    gh_user = await get_github_user(access_token)
    await save_github_account(db, user_id, access_token, scopes, gh_user)

    # Redirect to frontend success page
    return RedirectResponse(
        url="http://localhost:5173/github/callback?success=true",
        status_code=302,
    )


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
    account: UserGitHubAccount = Depends(_get_user_github_account),
    page: int = Query(1, ge=1),
    per_page: int = Query(30, ge=1, le=100),
    sort: str = Query("updated"),
):
    repos = await list_github_repos(
        account.access_token, page, per_page, sort
    )
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
    q: str = Query(..., min_length=1),
    account: UserGitHubAccount = Depends(_get_user_github_account),
):
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
