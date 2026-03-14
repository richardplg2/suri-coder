"""Default agent configs and workflow templates seeded into every new project."""

from app.services.brainstorm_agent import BRAINSTORM_SYSTEM_PROMPT, QUIZ_OUTPUT_SCHEMA

# --------------------------------------------------------------------------- #
# Shared tool lists
# --------------------------------------------------------------------------- #

READ_ONLY_TOOLS = [
    "Read",
    "Grep",
    "Glob",
    "Bash(git log:read)",
    "Bash(git diff:read)",
    "Bash(find:read)",
    "read_spec",
    "list_specs",
]

FULL_TOOLS = [
    "Read",
    "Write",
    "Edit",
    "Bash",
    "Grep",
    "Glob",
    "read_spec",
    "list_specs",
]

# --------------------------------------------------------------------------- #
# Shared prompt fragments
# --------------------------------------------------------------------------- #

SPEC_PREAMBLE = (
    "Before starting any work, ALWAYS use `list_specs` to discover available specs, "
    "then use `read_spec` to read every relevant spec in full.\n\n"
    "Spec-driven rules:\n"
    "1. Read all relevant specs before doing anything else.\n"
    "2. Implement EXACTLY what the spec says — no more, no less.\n"
    "3. NEVER modify spec files. If a spec is wrong, stop and report the issue.\n"
)

# --------------------------------------------------------------------------- #
# Default agent configs
# --------------------------------------------------------------------------- #

DEFAULT_AGENT_CONFIGS: list[dict] = [
    {
        "name": "brainstorm",
        "description": "Interactive brainstorming partner",
        "system_prompt": BRAINSTORM_SYSTEM_PROMPT,
        "claude_model": "sonnet",
        "tools_list": None,
        "max_turns": 1,
        "default_requires_approval": False,
        "skill_names": [],
        "agent_type": "brainstorm",
        "output_format": {
            "type": "json_schema",
            "schema": QUIZ_OUTPUT_SCHEMA,
        },
    },
    {
        "name": "planner",
        "description": (
            "Reads the codebase and specs to produce a detailed"
            " implementation plan."
        ),
        "system_prompt": (
            "You are the PLANNER agent. Your job is to analyze the codebase and specs, "
            "then produce a clear, step-by-step implementation plan.\n\n"
            f"{SPEC_PREAMBLE}"
            "Your output should be a numbered plan with:\n"
            "- Files to create or modify (absolute paths)\n"
            "- Exact changes required in each file\n"
            "- Order of operations and dependencies between steps\n"
            "- Risk areas and edge cases to watch for\n\n"
            "Do NOT write code. Only produce the plan."
        ),
        "claude_model": "sonnet",
        "tools_list": READ_ONLY_TOOLS,
        "max_turns": 15,
        "default_requires_approval": False,
        "skill_names": ["writing-plans"],
    },
    {
        "name": "designer",
        "description": (
            "Creates UI/UX designs and component specifications"
            " based on specs."
        ),
        "system_prompt": (
            "You are the DESIGNER agent. Your job is to create detailed UI/UX designs "
            "and component specifications based on the feature specs.\n\n"
            f"{SPEC_PREAMBLE}"
            "Your output should include:\n"
            "- Component hierarchy and layout\n"
            "- Props and state definitions\n"
            "- Interaction flows and edge cases\n"
            "- Accessibility considerations\n"
            "- Visual design notes referencing the existing design system\n\n"
            "Study the existing codebase patterns before proposing new components."
        ),
        "claude_model": "sonnet",
        "tools_list": READ_ONLY_TOOLS,
        "max_turns": 20,
        "default_requires_approval": False,
        "skill_names": ["ui-ux-pro-max", "feature-design"],
    },
    {
        "name": "coder",
        "description": (
            "Implements features by writing code according to"
            " the plan and specs."
        ),
        "system_prompt": (
            "You are the CODER agent. Your job is to implement features by writing "
            "production-quality code that follows the plan and specs exactly.\n\n"
            f"{SPEC_PREAMBLE}"
            "Implementation rules:\n"
            "- Follow the plan step by step — do not skip or reorder steps.\n"
            "- Match existing code style and patterns in the codebase.\n"
            "- Write clean, well-typed code with proper error handling.\n"
            "- Run linters and type checks after making changes.\n"
            "- Commit after each logical unit of work with a descriptive message."
        ),
        "claude_model": "sonnet",
        "tools_list": FULL_TOOLS,
        "max_turns": 25,
        "default_requires_approval": False,
        "skill_names": ["executing-plans"],
    },
    {
        "name": "tester",
        "description": (
            "Writes and runs tests to verify the implementation"
            " matches specs."
        ),
        "system_prompt": (
            "You are the TESTER agent. Your job is to write comprehensive tests that "
            "verify the implementation matches the specs exactly.\n\n"
            f"{SPEC_PREAMBLE}"
            "Testing rules:\n"
            "- Write tests BEFORE checking the implementation (test-first mindset).\n"
            "- Cover happy paths, edge cases, and error conditions.\n"
            "- Test against the spec requirements, not the implementation details.\n"
            "- Run all tests and ensure they pass before finishing.\n"
            "- If tests fail, report the failures "
            "— do NOT modify the tests to make them pass."
        ),
        "claude_model": "sonnet",
        "tools_list": FULL_TOOLS,
        "max_turns": 20,
        "default_requires_approval": False,
        "skill_names": ["test-driven-development"],
    },
    {
        "name": "reviewer",
        "description": (
            "Reviews code changes for correctness, style,"
            " and spec compliance."
        ),
        "system_prompt": (
            "You are the REVIEWER agent. Your job is to review code changes and verify "
            "they are correct, well-written, and comply with the specs.\n\n"
            f"{SPEC_PREAMBLE}"
            "Review checklist:\n"
            "- Does the code implement exactly what the spec requires?\n"
            "- Are there any missing edge cases or error handling?\n"
            "- Does the code follow existing patterns and style conventions?\n"
            "- Are there any security, performance, or maintainability concerns?\n"
            "- Are tests adequate and passing?\n\n"
            "Provide actionable feedback. Approve only when all checks pass."
        ),
        "claude_model": "sonnet",
        "tools_list": READ_ONLY_TOOLS,
        "max_turns": 10,
        "default_requires_approval": False,
        "skill_names": ["requesting-code-review"],
    },
]

# --------------------------------------------------------------------------- #
# Default workflow templates
# --------------------------------------------------------------------------- #

DEFAULT_WORKFLOW_TEMPLATES: list[dict] = [
    {
        "name": "Full Feature",
        "description": "Complete feature workflow: plan, design, implement, and test.",
        "steps_config": {
            "steps": [
                {
                    "id": "plan",
                    "agent": "planner",
                    "description": "Analyze specs and produce implementation plan",
                    "depends_on": [],
                    "requires_approval": True,
                    "condition": None,
                    "expandable": False,
                },
                {
                    "id": "design",
                    "agent": "designer",
                    "description": "Create UI/UX design and component specs",
                    "depends_on": ["plan"],
                    "requires_approval": True,
                    "condition": "has_ui",
                    "expandable": False,
                },
                {
                    "id": "implement",
                    "agent": "coder",
                    "description": "Implement the feature according to plan",
                    "depends_on": ["plan", "design"],
                    "requires_approval": False,
                    "condition": None,
                    "expandable": True,
                },
                {
                    "id": "test",
                    "agent": "tester",
                    "description": "Write and run tests to verify implementation",
                    "depends_on": ["implement"],
                    "requires_approval": False,
                    "condition": None,
                    "expandable": True,
                },
            ]
        },
    },
    {
        "name": "Bug Fix",
        "description": "Quick bug fix workflow: plan, fix, and verify.",
        "steps_config": {
            "steps": [
                {
                    "id": "plan",
                    "agent": "planner",
                    "description": "Analyze the bug and plan the fix",
                    "depends_on": [],
                    "requires_approval": True,
                    "condition": None,
                    "expandable": False,
                },
                {
                    "id": "fix",
                    "agent": "coder",
                    "description": "Implement the bug fix",
                    "depends_on": ["plan"],
                    "requires_approval": False,
                    "condition": None,
                    "expandable": False,
                },
                {
                    "id": "test",
                    "agent": "tester",
                    "description": "Write regression test and verify fix",
                    "depends_on": ["fix"],
                    "requires_approval": False,
                    "condition": None,
                    "expandable": False,
                },
            ]
        },
    },
    {
        "name": "Refactor",
        "description": "Safe refactoring workflow: test before, refactor, test after.",
        "steps_config": {
            "steps": [
                {
                    "id": "plan",
                    "agent": "planner",
                    "description": "Analyze code and plan refactoring steps",
                    "depends_on": [],
                    "requires_approval": True,
                    "condition": None,
                    "expandable": False,
                },
                {
                    "id": "test_before",
                    "agent": "tester",
                    "description": "Ensure existing tests pass before refactoring",
                    "depends_on": ["plan"],
                    "requires_approval": False,
                    "condition": None,
                    "expandable": False,
                },
                {
                    "id": "refactor",
                    "agent": "coder",
                    "description": "Perform the refactoring according to plan",
                    "depends_on": ["test_before"],
                    "requires_approval": False,
                    "condition": None,
                    "expandable": False,
                },
                {
                    "id": "test_after",
                    "agent": "tester",
                    "description": "Run all tests to verify refactoring is safe",
                    "depends_on": ["refactor"],
                    "requires_approval": False,
                    "condition": None,
                    "expandable": False,
                },
            ]
        },
    },
]
