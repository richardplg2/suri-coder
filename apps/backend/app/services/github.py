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
