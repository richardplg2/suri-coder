import json

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import StepStatus
from app.models.workflow_step import WorkflowStep, WorkflowStepDependency


class PromptBuilder:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def build_step_prompt(self, step: WorkflowStep) -> str:
        """Assemble the full prompt for a step execution."""
        sections = []

        # Task description
        sections.append(f"## Your task\n{step.description or step.name}")

        # Step breakdown from brainstorm
        if step.step_breakdown:
            breakdown_text = (
                json.dumps(step.step_breakdown, indent=2)
                if isinstance(step.step_breakdown, dict)
                else str(step.step_breakdown)
            )
            sections.append(
                f"## Specific instructions (from brainstorm)\n{breakdown_text}"
            )

        # Dependency context
        dep_context = await self._get_dependency_context(step)
        if dep_context:
            sections.append(f"## Context from completed steps\n{dep_context}")

        # Working directory note
        sections.append(
            "## Working directory\nGit worktree with all dependency changes merged."
        )

        # User override
        if step.user_prompt_override:
            sections.append(
                f"## Additional instructions\n{step.user_prompt_override}"
            )

        return "\n\n".join(sections)

    async def _get_dependency_context(self, step: WorkflowStep) -> str:
        """Get summaries/output from dependency steps."""
        result = await self.db.execute(
            select(WorkflowStep).where(WorkflowStep.ticket_id == step.ticket_id)
        )
        all_steps = {s.id: s for s in result.scalars().all()}

        # Reload step dependencies
        result2 = await self.db.execute(
            select(WorkflowStepDependency).where(
                WorkflowStepDependency.step_id == step.id
            )
        )
        deps = list(result2.scalars().all())

        if not deps:
            return ""

        lines = []
        for dep in deps:
            dep_step = all_steps.get(dep.depends_on_id)
            if not dep_step or dep_step.status not in (
                StepStatus.completed,
                StepStatus.skipped,
            ):
                continue
            lines.append(f"### {dep_step.name} ({dep_step.status.value})")
            if dep_step.brainstorm_output:
                output = json.dumps(dep_step.brainstorm_output, indent=2)
                lines.append(
                    f"Brainstorm output:\n```json\n{output}\n```"
                )
            elif dep_step.description:
                lines.append(dep_step.description)

        return "\n\n".join(lines)


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
