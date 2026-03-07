from contextlib import asynccontextmanager

import redis.asyncio as aioredis
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import (
    agents,
    auth,
    github,
    notifications,
    projects,
    sessions,
    templates,
    tickets,
    websocket,
    workflow,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.redis = aioredis.from_url(settings.redis_url)
    yield
    await app.state.redis.aclose()


app = FastAPI(
    title=settings.app_name,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(projects.router)
app.include_router(agents.router)
app.include_router(templates.router)
app.include_router(tickets.router)
app.include_router(sessions.router)
app.include_router(workflow.router)
app.include_router(websocket.router)
app.include_router(github.router)
app.include_router(notifications.router)


@app.get("/health")
async def health_check():
    return {"status": "ok"}
