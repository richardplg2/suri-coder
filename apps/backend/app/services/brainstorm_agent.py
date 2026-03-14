BRAINSTORM_SYSTEM_PROMPT = (
    "You are a brainstorming partner that helps users "
    "define features, bugs, and improvements.\n\n"
    "Your job is to ask structured questions ONE AT A TIME "
    "to understand what the user wants to build.\n\n"
    "## How to Ask Questions\n\n"
    "Use the structured quiz format for each question. "
    "Each response must be a JSON object with:\n"
    '- `message_type`: one of "quiz", "text", or "summary"\n'
    "- `content`: plain text (for text and summary messages)\n"
    "- `quiz`: structured question data (for quiz messages)\n\n"
    "For quiz messages, include:\n"
    "- `question`: the main question being asked\n"
    "- `context`: why this question matters, background info\n"
    "- `options`: array of options, each with `id`, `label`, "
    "`description`, `recommended` (bool), "
    "and optional `recommendation_reason`\n"
    "- `allow_multiple`: whether user can pick multiple\n"
    "- `allow_custom`: whether user can provide free-text\n\n"
    "## Flow\n\n"
    "1. Ask 5-8 questions using quiz format to understand "
    "the problem, solution approach, and requirements\n"
    "2. After sufficient questions, confirm with the user "
    "that brainstorming is complete\n"
    '3. When confirmed, generate a summary with '
    'message_type "summary"\n\n'
    "## Summary Format\n\n"
    "When generating the final summary, use this format "
    "in the `content` field:\n\n"
    "## Problem\n"
    "What problem does this solve?\n\n"
    "## Solution\n"
    "High-level approach and key decisions.\n\n"
    "## Decisions\n"
    "Summary of each quiz answer and the rationale.\n\n"
    "## Requirements\n"
    "- Functional requirements (bulleted list)\n"
    "- Non-functional requirements\n\n"
    "## Design References\n"
    "Any Figma links, mockup descriptions, or UI notes.\n\n"
    "## Acceptance Criteria\n"
    "- [ ] Criterion 1\n"
    "- [ ] Criterion 2\n\n"
    "## Technical Notes\n"
    "Implementation considerations, constraints, "
    "dependencies.\n"
)

QUIZ_OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "message_type": {
            "type": "string",
            "enum": ["quiz", "text", "summary"],
            "description": (
                "Type of message: quiz for structured questions, "
                "text for plain responses, summary for final output"
            ),
        },
        "content": {
            "type": "string",
            "description": (
                "Plain text content "
                "(used for text and summary message types)"
            ),
        },
        "quiz": {
            "type": "object",
            "properties": {
                "question": {"type": "string"},
                "context": {"type": "string"},
                "options": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "id": {"type": "string"},
                            "label": {"type": "string"},
                            "description": {"type": "string"},
                            "recommended": {"type": "boolean"},
                            "recommendation_reason": {
                                "type": ["string", "null"]
                            },
                        },
                        "required": [
                            "id",
                            "label",
                            "description",
                            "recommended",
                        ],
                    },
                },
                "allow_multiple": {"type": "boolean"},
                "allow_custom": {"type": "boolean"},
            },
            "required": [
                "question",
                "context",
                "options",
                "allow_multiple",
                "allow_custom",
            ],
        },
    },
    "required": ["message_type"],
}


def build_initial_prompt(
    source: str,
    initial_message: str | None,
    figma_data: dict | None,
) -> str:
    parts: list[str] = []

    if source == "figma" and figma_data:
        parts.append("## Design Context (from Figma)\n")

        # Legacy flat fields
        if figma_data.get("file_name"):
            parts.append(f"**File:** {figma_data['file_name']}")
        if figma_data.get("page_name"):
            parts.append(f"**Page:** {figma_data['page_name']}")
        if figma_data.get("figma_url"):
            parts.append(f"**Figma URL:** {figma_data['figma_url']}")
        if figma_data.get("description"):
            parts.append(f"**Description:** {figma_data['description']}")

        # New hierarchical designs → frames structure
        designs = figma_data.get("designs", [])
        if designs:
            for design in designs:
                parts.append(f"\n### Design: {design.get('name', 'Unnamed')}")
                frames = design.get("frames", [])
                for frame in frames:
                    parts.append(
                        f"\n#### Frame: {frame.get('name', 'Unnamed')} "
                        f"({frame.get('type', 'FRAME')})"
                    )
                    tags = frame.get("tags", [])
                    if tags:
                        parts.append(f"**Tags:** {', '.join(tags)}")
                    notes = frame.get("notes", "")
                    if notes:
                        parts.append(f"**Notes:** {notes}")
                    markdown = frame.get("markdown", "")
                    if markdown:
                        parts.append(f"\n{markdown}")
        elif figma_data.get("node_names"):
            # Legacy: flat node_names list
            parts.append(
                "**Selected elements:** "
                f"{', '.join(figma_data['node_names'])}"
            )

        parts.append("")
        parts.append(
            "Use this design context to inform your questions. "
            "Include relevant Design References in the final "
            "summary."
        )
        parts.append("")

    if initial_message:
        parts.append(initial_message)
    elif source == "figma":
        parts.append(
            "I'd like to create a ticket based on this Figma "
            "design. Please help me brainstorm the "
            "implementation details."
        )
    else:
        parts.append(
            "I'd like to brainstorm a new feature. Please start "
            "by asking me what problem I'm trying to solve."
        )

    return "\n".join(parts)
