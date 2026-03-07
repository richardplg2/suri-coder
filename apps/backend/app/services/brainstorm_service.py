import json
import logging
import uuid
from typing import Any

import redis.asyncio as aioredis
from fastapi import HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.brainstorm_message import BrainstormMessage
from app.models.enums import (
    BrainstormMessageType,
    BrainstormRole,
    SpecType,
    TicketSource,
)
from app.schemas.brainstorm import BrainstormMessageResponse
from app.schemas.ticket import TicketCreate
from app.services.brainstorm_agent import (
    BRAINSTORM_SYSTEM_PROMPT,
    QUIZ_OUTPUT_SCHEMA,
    build_initial_prompt,
)
from app.services.spec import SpecService
from app.services.ticket import create_ticket

logger = logging.getLogger(__name__)

# Process-local session registry. For multi-worker deployments,
# would need Redis-backed session registry.
_active_brainstorm_sessions: dict[str, Any] = {}


def _create_brainstorm_client() -> Any:
    """Create a Claude SDK client for brainstorm sessions."""
    from claude_agent_sdk import ClaudeAgentOptions, ClaudeSDKClient

    return ClaudeSDKClient(
        ClaudeAgentOptions(
            system_prompt=BRAINSTORM_SYSTEM_PROMPT,
            output_format={
                "type": "json_schema",
                "schema": QUIZ_OUTPUT_SCHEMA,
            },
            max_turns=1,
        )
    )


class BrainstormService:
    def __init__(self, db: AsyncSession, redis: aioredis.Redis):
        self.db = db
        self.redis = redis

    async def start_session(
        self,
        project_id: uuid.UUID,
        source: str,
        initial_message: str | None,
        figma_data: dict | None,
        user_id: uuid.UUID,
    ) -> dict:
        session_id = str(uuid.uuid4())
        prompt = build_initial_prompt(source, initial_message, figma_data)

        client = _create_brainstorm_client()

        result = await client.query(prompt)
        msg_type, content, structured_data = _parse_agent_response(
            result
        )

        # Save figma context message first if applicable
        if source == "figma" and figma_data:
            figma_msg = BrainstormMessage(
                session_id=session_id,
                role=BrainstormRole.system,
                content=None,
                message_type=BrainstormMessageType.figma_context,
                structured_data=figma_data,
            )
            self.db.add(figma_msg)

        # Save user's initial message
        user_msg = BrainstormMessage(
            session_id=session_id,
            role=BrainstormRole.user,
            content=prompt,
            message_type=BrainstormMessageType.text,
        )
        self.db.add(user_msg)
        await self.db.flush()

        # Save agent's response
        assistant_msg = BrainstormMessage(
            session_id=session_id,
            role=BrainstormRole.assistant,
            content=content,
            message_type=BrainstormMessageType(msg_type),
            structured_data=structured_data,
        )
        self.db.add(assistant_msg)
        await self.db.flush()

        _active_brainstorm_sessions[session_id] = client

        response = BrainstormMessageResponse.model_validate(
            assistant_msg
        )
        await self._publish_brainstorm_event(
            session_id, f"brainstorm_{msg_type}", response.model_dump()
        )

        await self.db.commit()

        return {
            "session_id": session_id,
            "first_message": response,
        }

    async def send_message(
        self,
        session_id: str,
        content: str | None,
        quiz_response: dict | None,
    ) -> BrainstormMessageResponse:
        client = _active_brainstorm_sessions.get(session_id)
        if client is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Brainstorm session not found",
            )

        # Format user message
        if quiz_response:
            selected = quiz_response.get("option_ids", [])
            custom = quiz_response.get("custom_text", "")
            formatted = f"Selected: {', '.join(selected)}"
            if custom:
                formatted += f". {custom}"
        else:
            formatted = content or ""

        # Save user message
        user_msg = BrainstormMessage(
            session_id=session_id,
            role=BrainstormRole.user,
            content=formatted,
            message_type=BrainstormMessageType.text,
        )
        self.db.add(user_msg)
        await self.db.flush()

        # Query agent
        result = await client.query(formatted)
        msg_type, resp_content, structured_data = (
            _parse_agent_response(result)
        )

        # Save agent response
        assistant_msg = BrainstormMessage(
            session_id=session_id,
            role=BrainstormRole.assistant,
            content=resp_content,
            message_type=BrainstormMessageType(msg_type),
            structured_data=structured_data,
        )
        self.db.add(assistant_msg)
        await self.db.flush()

        response = BrainstormMessageResponse.model_validate(
            assistant_msg
        )
        await self._publish_brainstorm_event(
            session_id, f"brainstorm_{msg_type}", response.model_dump()
        )

        await self.db.commit()
        return response

    async def complete_session(self, session_id: str) -> dict:
        client = _active_brainstorm_sessions.get(session_id)
        if client is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Brainstorm session not found",
            )

        result = await client.query(
            "Please generate the final summary now. "
            'Output as message_type: summary with the full content.'
        )
        msg_type, content, structured_data = _parse_agent_response(
            result
        )

        assistant_msg = BrainstormMessage(
            session_id=session_id,
            role=BrainstormRole.assistant,
            content=content,
            message_type=BrainstormMessageType.summary,
            structured_data=structured_data,
        )
        self.db.add(assistant_msg)
        await self.db.flush()

        response = BrainstormMessageResponse.model_validate(
            assistant_msg
        )
        await self._publish_brainstorm_event(
            session_id,
            "brainstorm_summary",
            response.model_dump(),
        )

        _active_brainstorm_sessions.pop(session_id, None)
        await self.db.commit()

        return {"summary": content}

    async def batch_update(
        self, session_id: str, comments: list[dict]
    ) -> dict:
        client = _active_brainstorm_sessions.get(session_id)
        if client is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Brainstorm session not found",
            )

        formatted_comments = "\n".join(
            f"- [{c.get('section_id', 'general')}]: {c.get('text', '')}"
            for c in comments
        )
        prompt = (
            "Please update the summary based on these comments:\n"
            f"{formatted_comments}"
        )

        # Save user message
        user_msg = BrainstormMessage(
            session_id=session_id,
            role=BrainstormRole.user,
            content=prompt,
            message_type=BrainstormMessageType.text,
        )
        self.db.add(user_msg)
        await self.db.flush()

        result = await client.query(prompt)
        _, content, structured_data = _parse_agent_response(result)

        assistant_msg = BrainstormMessage(
            session_id=session_id,
            role=BrainstormRole.assistant,
            content=content,
            message_type=BrainstormMessageType.summary,
            structured_data=structured_data,
        )
        self.db.add(assistant_msg)
        await self.db.flush()

        response = BrainstormMessageResponse.model_validate(
            assistant_msg
        )
        await self._publish_brainstorm_event(
            session_id,
            "brainstorm_summary",
            response.model_dump(),
        )

        await self.db.commit()
        return {"summary": content}

    async def create_ticket_from_brainstorm(
        self,
        session_id: str,
        title: str,
        type: str,
        priority: str,
        template_id: uuid.UUID | None,
        user_id: uuid.UUID,
        project_id: uuid.UUID,
    ) -> Any:
        # Find latest summary message
        result = await self.db.execute(
            select(BrainstormMessage)
            .where(
                BrainstormMessage.session_id == session_id,
                BrainstormMessage.message_type
                == BrainstormMessageType.summary,
            )
            .order_by(BrainstormMessage.created_at.desc())
            .limit(1)
        )
        summary_msg = result.scalar_one_or_none()
        if not summary_msg:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No summary found for this session",
            )

        # Create ticket
        ticket_data = TicketCreate(
            title=title,
            description=summary_msg.content,
            type=type,
            priority=priority,
            template_id=template_id,
            source=TicketSource.ai_brainstorm,
        )
        ticket = await create_ticket(
            self.db, project_id, ticket_data, user_id
        )

        # Create spec from summary
        await SpecService.create_spec(
            db=self.db,
            ticket_id=ticket.id,
            type=SpecType.feature,
            title=title,
            content=summary_msg.content or "",
            created_by=user_id,
        )

        # Link brainstorm messages to ticket
        await self.db.execute(
            update(BrainstormMessage)
            .where(BrainstormMessage.session_id == session_id)
            .values(ticket_id=ticket.id)
        )
        await self.db.commit()

        return ticket

    async def _publish_brainstorm_event(
        self,
        session_id: str,
        event_type: str,
        data: Any,
    ) -> None:
        payload = json.dumps(
            {"event": event_type, "data": data},
            default=str,
        )
        await self.redis.publish(
            f"brainstorm:{session_id}", payload
        )


def _parse_agent_response(
    result: Any,
) -> tuple[str, str | None, dict | None]:
    try:
        if hasattr(result, "output"):
            output = result.output
            if isinstance(output, str):
                output = json.loads(output)
        elif hasattr(result, "result"):
            output = result.result
            if isinstance(output, str):
                output = json.loads(output)
        else:
            output = result

        if isinstance(output, dict):
            msg_type = output.get("message_type", "text")
            content = output.get("content")
            if msg_type == "quiz":
                return msg_type, content, output.get("quiz")
            return msg_type, content, None
    except (json.JSONDecodeError, AttributeError, TypeError):
        logger.warning(
            "Failed to parse agent response, treating as text"
        )

    # Fallback: treat as plain text
    raw = str(result) if result else ""
    return "text", raw, None
