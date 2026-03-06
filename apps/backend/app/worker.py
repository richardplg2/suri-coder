import json
import uuid
from datetime import datetime, timezone

from arq.connections import RedisSettings

from app.config import settings
from app.database import async_session
from app.models.enums import SessionStatus
from app.models.session import Session
from app.models.workflow_step import WorkflowStep
from app.services.workflow_engine import WorkflowEngine


async def run_claude_agent(ctx: dict, session_id: str):
    """ARQ task: execute a Claude Code agent session."""
    redis = ctx.get("redis")
    async with async_session() as db:
        session = await db.get(Session, uuid.UUID(session_id))
        if not session:
            return

        step = await db.get(WorkflowStep, session.step_id)
        if not step:
            return

        try:
            # Placeholder for actual Claude SDK execution
            # In production, this would:
            # 1. Build agent options from AgentConfig
            # 2. Create git worktree
            # 3. Execute Claude SDK session
            # 4. Stream messages via Redis PubSub
            # 5. Save messages to SessionMessage

            # For now, mark as completed
            session.status = SessionStatus.completed.value
            session.finished_at = datetime.now(timezone.utc)

            engine = WorkflowEngine(db)
            await engine.complete_step(step)
            await db.commit()

        except Exception as e:
            session.status = SessionStatus.failed.value
            session.error_message = str(e)
            session.finished_at = datetime.now(timezone.utc)

            engine = WorkflowEngine(db)
            await engine.fail_step(step, str(e))
            await db.commit()

            # Publish failure event
            if redis:
                await redis.publish(
                    f"session:{session_id}",
                    json.dumps({"type": "error", "message": str(e)}),
                )


class WorkerSettings:
    functions = [run_claude_agent]
    redis_settings = RedisSettings.from_dsn(settings.redis_url)
