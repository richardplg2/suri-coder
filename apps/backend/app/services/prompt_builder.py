def format_section_comments(section_comments: dict[str, str]) -> str:
    """Format brainstorm section comments into a follow-up prompt."""
    if not section_comments:
        return ""

    lines = ["Please revise the following sections based on feedback:\n"]
    for section_key, comment in section_comments.items():
        lines.append(f"### {section_key}\n{comment}\n")
    return "\n".join(lines)


def format_review_comments(comments: list[dict]) -> str:
    """Format code review comments into a follow-up prompt."""
    if not comments:
        return ""

    lines = ["Please address the following code review comments:\n"]
    for c in comments:
        file_path = c.get("file", "unknown")
        line = c.get("line", "?")
        comment = c.get("comment", "")
        lines.append(f"- **{file_path}:{line}** — {comment}")
    return "\n".join(lines)
