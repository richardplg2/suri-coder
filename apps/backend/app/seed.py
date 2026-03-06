"""Seed script: creates default global agent configs and workflow templates."""

import asyncio

from app.database import async_session
from app.models.agent_config import AgentConfig
from app.models.workflow_template import WorkflowTemplate

DEFAULT_AGENTS = [
    {
        "name": "designer",
        "description": "Designs features, screens, and UI components based on requirements",
        "system_prompt": "You are a UI/UX designer agent. Analyze requirements and create detailed design specifications including component layouts, user flows, and interaction patterns. Output design documents and component specs.",
        "claude_model": "sonnet",
        "max_turns": 25,
    },
    {
        "name": "coder",
        "description": "Implements features and writes production code",
        "system_prompt": "You are a software engineer agent. Implement features based on design specs and requirements. Write clean, tested, production-quality code. Follow project conventions and best practices.",
        "claude_model": "sonnet",
        "max_turns": 50,
    },
    {
        "name": "tester",
        "description": "Writes and runs tests for implemented features",
        "system_prompt": "You are a QA engineer agent. Write comprehensive tests for the implemented code. Include unit tests, integration tests, and edge case coverage. Run tests and report results.",
        "claude_model": "sonnet",
        "max_turns": 30,
    },
    {
        "name": "reviewer",
        "description": "Reviews code for quality, correctness, and best practices",
        "system_prompt": "You are a code review agent. Review the implemented code for correctness, performance, security, and adherence to best practices. Provide actionable feedback with specific file and line references.",
        "claude_model": "sonnet",
        "max_turns": 20,
    },
    {
        "name": "researcher",
        "description": "Researches technical approaches, libraries, and solutions",
        "system_prompt": "You are a technical research agent. Investigate technical approaches, evaluate libraries, and provide recommendations. Output structured research reports with pros/cons analysis.",
        "claude_model": "sonnet",
        "max_turns": 25,
    },
]

DEFAULT_TEMPLATES = [
    {
        "name": "feature-flow",
        "description": "Standard feature development workflow: design -> code -> test -> review",
        "steps_config": {
            "steps": [
                {"id": "design", "agent": "designer", "depends_on": [], "description": "Design the feature"},
                {"id": "code", "agent": "coder", "depends_on": ["design"], "description": "Implement the feature"},
                {"id": "test", "agent": "tester", "depends_on": ["code"], "description": "Write and run tests"},
                {"id": "review", "agent": "reviewer", "depends_on": ["code"], "description": "Review the implementation"},
            ]
        },
    },
    {
        "name": "bugfix-flow",
        "description": "Bug fix workflow: code fix -> test -> review",
        "steps_config": {
            "steps": [
                {"id": "fix", "agent": "coder", "depends_on": [], "description": "Fix the bug"},
                {"id": "test", "agent": "tester", "depends_on": ["fix"], "description": "Write regression tests"},
                {"id": "review", "agent": "reviewer", "depends_on": ["fix"], "description": "Review the fix"},
            ]
        },
    },
    {
        "name": "spike-flow",
        "description": "Research spike workflow: research -> document findings",
        "steps_config": {
            "steps": [
                {"id": "research", "agent": "researcher", "depends_on": [], "description": "Research the topic"},
                {"id": "document", "agent": "coder", "depends_on": ["research"], "description": "Document findings and create proof of concept"},
            ]
        },
    },
]


async def seed():
    async with async_session() as db:
        # Seed global agents (project_id = None)
        for agent_data in DEFAULT_AGENTS:
            agent = AgentConfig(project_id=None, **agent_data)
            db.add(agent)

        # Seed global templates (project_id = None)
        for template_data in DEFAULT_TEMPLATES:
            template = WorkflowTemplate(project_id=None, **template_data)
            db.add(template)

        await db.commit()
        print(f"Seeded {len(DEFAULT_AGENTS)} global agents and {len(DEFAULT_TEMPLATES)} global templates.")


if __name__ == "__main__":
    asyncio.run(seed())
