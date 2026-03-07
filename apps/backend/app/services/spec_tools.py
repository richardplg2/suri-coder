import json

from claude_agent_sdk import create_sdk_mcp_server, tool

from app.models.ticket import Ticket
from app.services.spec import SpecService


def build_spec_tools(ticket_id, db_session_factory):
    """Build scoped MCP tools for the given ticket.

    All tools use ticket_id from the closure. The agent cannot
    pass a different ticket_id — this is the key security boundary.

    Args:
        ticket_id: UUID of the ticket these tools are scoped to.
        db_session_factory: Async context manager yielding AsyncSession.
    """

    @tool(
        "read_spec",
        "Read the latest revision of a spec by type for the current ticket",
        {"type": str},
    )
    async def read_spec(args):
        async with db_session_factory() as db:
            spec = await SpecService.get_latest_spec(
                db, ticket_id, args["type"]
            )
            if not spec:
                return {
                    "content": [
                        {
                            "type": "text",
                            "text": (
                                f"No {args['type']} spec found"
                                " for this ticket."
                            ),
                        }
                    ]
                }
            return {
                "content": [
                    {
                        "type": "text",
                        "text": f"# {spec.title}\n\n{spec.content}",
                    }
                ]
            }

    @tool(
        "list_specs",
        "List all available specs for the current ticket",
        {},
    )
    async def list_specs(args):
        async with db_session_factory() as db:
            specs = await SpecService.get_specs(db, ticket_id)
            if not specs:
                return {
                    "content": [
                        {
                            "type": "text",
                            "text": "No specs found for this ticket.",
                        }
                    ]
                }
            lines = [
                f"- **{s.type}**: {s.title} (v{s.revision})"
                for s in specs
            ]
            return {
                "content": [
                    {
                        "type": "text",
                        "text": "Available specs:\n"
                        + "\n".join(lines),
                    }
                ]
            }

    @tool(
        "save_spec",
        "Save or update a spec for the current ticket",
        {"type": str, "title": str, "content": str},
    )
    async def save_spec(args):
        async with db_session_factory() as db:
            existing = await SpecService.get_latest_spec(
                db, ticket_id, args["type"]
            )
            if existing:
                spec = await SpecService.update_spec(
                    db, existing.id, args["content"], args["title"]
                )
            else:
                spec = await SpecService.create_spec(
                    db,
                    ticket_id,
                    args["type"],
                    args["title"],
                    args["content"],
                    created_by=None,  # system/agent
                )
            return {
                "content": [
                    {
                        "type": "text",
                        "text": (
                            f"Spec saved: {spec.title}"
                            f" (v{spec.revision})"
                        ),
                    }
                ]
            }

    @tool(
        "read_ticket",
        "Read the ticket details and feature spec",
        {},
    )
    async def read_ticket(args):
        async with db_session_factory() as db:
            ticket = await db.get(Ticket, ticket_id)
            if not ticket:
                return {
                    "content": [
                        {"type": "text", "text": "Ticket not found."}
                    ]
                }
            text = (
                f"# {ticket.title}\n\n"
                f"Type: {ticket.type}\n"
                f"Priority: {ticket.priority}\n\n"
                f"{ticket.description or 'No description'}"
            )
            return {"content": [{"type": "text", "text": text}]}

    @tool(
        "read_figma_context",
        "Read Figma annotations and design references for this ticket",
        {},
    )
    async def read_figma_context(args):
        async with db_session_factory() as db:
            ticket = await db.get(Ticket, ticket_id)
            if not ticket or not ticket.figma_data:
                return {
                    "content": [
                        {
                            "type": "text",
                            "text": (
                                "No Figma context available"
                                " for this ticket."
                            ),
                        }
                    ]
                }
            return {
                "content": [
                    {
                        "type": "text",
                        "text": (
                            "Figma Design Context:\n"
                            "```json\n"
                            f"{json.dumps(ticket.figma_data, indent=2)}"
                            "\n```"
                        ),
                    }
                ]
            }

    return create_sdk_mcp_server(
        name="ticket-specs",
        version="1.0.0",
        tools=[
            read_spec,
            list_specs,
            save_spec,
            read_ticket,
            read_figma_context,
        ],
    )
