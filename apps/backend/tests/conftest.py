import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app as fastapi_app

# Import all models so Base.metadata knows about every table
import app.models  # noqa: F401


@pytest_asyncio.fixture
async def db_engine():
    engine = create_async_engine(
        "sqlite+aiosqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(db_engine):
    session_factory = async_sessionmaker(
        db_engine, class_=AsyncSession, expire_on_commit=False
    )
    async with session_factory() as session:
        yield session


@pytest_asyncio.fixture
async def client(db_engine):
    session_factory = async_sessionmaker(
        db_engine, class_=AsyncSession, expire_on_commit=False
    )

    async def override_get_db():
        async with session_factory() as session:
            yield session

    fastapi_app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(
        transport=ASGITransport(app=fastapi_app), base_url="http://test"
    ) as c:
        yield c
    fastapi_app.dependency_overrides.clear()


async def create_user(
    client: AsyncClient,
    email: str = "test@example.com",
    name: str = "Test User",
    password: str = "testpass123",
) -> dict:
    resp = await client.post(
        "/auth/register",
        json={"email": email, "name": name, "password": password},
    )
    return resp.json()


async def auth_headers(
    client: AsyncClient,
    email: str = "test@example.com",
    name: str = "Test User",
    password: str = "testpass123",
) -> dict[str, str]:
    data = await create_user(client, email, name, password)
    return {"Authorization": f"Bearer {data['access_token']}"}
