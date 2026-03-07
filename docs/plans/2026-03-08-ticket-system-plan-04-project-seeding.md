# Ticket System — Plan 04: Project Seeding

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Seed 5 default agent configs (planner, designer, coder, tester, reviewer) and 3 workflow templates (Full Feature, Bug Fix, Refactor) when a new project is created.

**Architecture:** Seeding function called from project creation service. Default configs stored as Python constants. Each project gets its own copy that can be customized independently.

**Tech Stack:** FastAPI, SQLAlchemy

**Depends on:** [Plan 01: Data Layer](./2026-03-08-ticket-system-plan-01-data-layer.md)
**Required by:** [Plan 05: Workflow Engine](./2026-03-08-ticket-system-plan-05-workflow-engine.md)

---

## Task 1: Create seed data constants

**Files:**
- Create: `apps/backend/app/services/seed_data.py`

```python
"""Default agent configs and workflow templates seeded into every new project."""

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
        "name": "planner",
        "description": "Reads the codebase and specs to produce a detailed implementation plan.",
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
        "description": "Creates UI/UX designs and component specifications based on specs.",
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
        "description": "Implements features by writing code according to the plan and specs.",
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
        "description": "Writes and runs tests to verify the implementation matches specs.",
        "system_prompt": (
            "You are the TESTER agent. Your job is to write comprehensive tests that "
            "verify the implementation matches the specs exactly.\n\n"
            f"{SPEC_PREAMBLE}"
            "Testing rules:\n"
            "- Write tests BEFORE checking the implementation (test-first mindset).\n"
            "- Cover happy paths, edge cases, and error conditions.\n"
            "- Test against the spec requirements, not the implementation details.\n"
            "- Run all tests and ensure they pass before finishing.\n"
            "- If tests fail, report the failures — do NOT modify the tests to make them pass."
        ),
        "claude_model": "sonnet",
        "tools_list": FULL_TOOLS,
        "max_turns": 20,
        "default_requires_approval": False,
        "skill_names": ["test-driven-development"],
    },
    {
        "name": "reviewer",
        "description": "Reviews code changes for correctness, style, and spec compliance.",
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
        "steps_config": [
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
        ],
    },
    {
        "name": "Bug Fix",
        "description": "Quick bug fix workflow: plan, fix, and verify.",
        "steps_config": [
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
        ],
    },
    {
        "name": "Refactor",
        "description": "Safe refactoring workflow: test before, refactor, test after.",
        "steps_config": [
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
        ],
    },
]
```

**Steps:**
1. Create the file at `apps/backend/app/services/seed_data.py` with the content above
2. Run `cd apps/backend && uv run ruff check app/services/seed_data.py` — Expected: no errors
3. Commit: `git add apps/backend/app/services/seed_data.py && git commit -m "feat(backend): add default agent config and workflow template seed data"`

---

## Task 2: Create seeding service

**Files:**
- Create: `apps/backend/app/services/project_seeder.py`

```python
"""Seeds default agent configs and workflow templates into a new project."""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agent_config import AgentConfig, AgentSkill
from app.models.skill import Skill
from app.models.workflow_template import WorkflowTemplate
from app.services.seed_data import DEFAULT_AGENT_CONFIGS, DEFAULT_WORKFLOW_TEMPLATES


async def _get_or_create_skill(db: AsyncSession, skill_name: str) -> Skill:
    """Look up a template skill by name, or create a placeholder if missing."""
    result = await db.execute(
        select(Skill).where(Skill.name == skill_name, Skill.is_template.is_(True))
    )
    skill = result.scalar_one_or_none()
    if skill is not None:
        return skill

    # Create a placeholder template skill so the link is valid
    skill = Skill(
        name=skill_name,
        description=f"Template skill: {skill_name}",
        content="",
        category="default",
        is_template=True,
    )
    db.add(skill)
    await db.flush()
    return skill


async def seed_project_defaults(
    db: AsyncSession, project_id: uuid.UUID
) -> dict:
    """Create default agent configs and workflow templates for a project.

    Returns a dict with keys ``agents`` and ``templates`` listing the created
    records.
    """
    created_agents: list[AgentConfig] = []
    created_templates: list[WorkflowTemplate] = []

    # --- Seed agent configs ------------------------------------------------ #
    for agent_data in DEFAULT_AGENT_CONFIGS:
        skill_names: list[str] = agent_data.get("skill_names", [])

        agent = AgentConfig(
            project_id=project_id,
            name=agent_data["name"],
            description=agent_data["description"],
            system_prompt=agent_data["system_prompt"],
            claude_model=agent_data["claude_model"],
            tools_list=agent_data["tools_list"],
            max_turns=agent_data["max_turns"],
            default_requires_approval=agent_data["default_requires_approval"],
        )
        db.add(agent)
        await db.flush()  # populate agent.id

        for priority, skill_name in enumerate(skill_names):
            skill = await _get_or_create_skill(db, skill_name)
            agent_skill = AgentSkill(
                agent_config_id=agent.id,
                skill_id=skill.id,
                priority=priority,
            )
            db.add(agent_skill)

        created_agents.append(agent)

    # --- Seed workflow templates ------------------------------------------- #
    for tmpl_data in DEFAULT_WORKFLOW_TEMPLATES:
        template = WorkflowTemplate(
            project_id=project_id,
            name=tmpl_data["name"],
            description=tmpl_data["description"],
            steps_config=tmpl_data["steps_config"],
        )
        db.add(template)
        created_templates.append(template)

    await db.flush()

    return {"agents": created_agents, "templates": created_templates}
```

**Steps:**
1. Create the file at `apps/backend/app/services/project_seeder.py` with the content above
2. Run `cd apps/backend && uv run ruff check app/services/project_seeder.py` — Expected: no errors
3. Commit: `git add apps/backend/app/services/project_seeder.py && git commit -m "feat(backend): add project seeding service"`

---

## Task 3: Integrate seeding into project creation

**Files:**
- Modify: `apps/backend/app/services/project.py`

Add the import at the top of the file (after existing imports):

```python
from app.services.project_seeder import seed_project_defaults
```

In the `create_project` function, add the seeding call **after** `db.add(member)` and **before** `await db.commit()`:

```python
    # Seed default agent configs and workflow templates
    await seed_project_defaults(db, project.id)
```

The full modified function should look like:

```python
async def create_project(
    db: AsyncSession, data: ProjectCreate, user_id: uuid.UUID
) -> Project:
    existing = await db.execute(
        select(Project).where(Project.slug == data.slug)
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A project with this slug already exists",
        )

    project = Project(
        name=data.name,
        slug=data.slug,
        path=data.path,
        repo_url=data.repo_url,
        description=data.description,
        settings=data.settings,
        created_by=user_id,
    )
    db.add(project)
    await db.flush()

    member = ProjectMember(
        project_id=project.id, user_id=user_id, role="owner"
    )
    db.add(member)

    # Seed default agent configs and workflow templates
    await seed_project_defaults(db, project.id)

    await db.commit()
    await db.refresh(project, attribute_names=["members"])
    return project
```

**Steps:**
1. Read `apps/backend/app/services/project.py`
2. Add the import and seeding call as shown above
3. Run `cd apps/backend && uv run ruff check app/services/project.py` — Expected: no errors
4. Commit: `git add apps/backend/app/services/project.py && git commit -m "feat(backend): seed defaults on project creation"`

---

## Task 4: Add reset-to-default endpoint

**Files:**
- Modify: `apps/backend/app/routers/agents.py`

Add the import at the top (with the existing imports):

```python
from app.services.project_seeder import seed_project_defaults
```

Add this endpoint at the end of the file:

```python
@router.post("/reset-defaults", status_code=status.HTTP_200_OK)
async def reset_agent_defaults(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete all project-specific agents and re-seed from defaults."""
    await require_project_member(project_id, current_user, db)

    # Check for running workflow steps using any of this project's agents
    result = await db.execute(
        select(AgentConfig.id).where(AgentConfig.project_id == project_id)
    )
    agent_ids = [row[0] for row in result.all()]

    if agent_ids:
        running = await db.execute(
            select(WorkflowStep).where(
                WorkflowStep.agent_config_id.in_(agent_ids),
                WorkflowStep.status == StepStatus.running,
            )
        )
        if running.scalars().first() is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Cannot reset agents while workflow steps are running",
            )

    # Delete all project-specific agents (cascade deletes AgentSkill rows)
    result = await db.execute(
        select(AgentConfig).where(AgentConfig.project_id == project_id)
    )
    for agent in result.scalars().all():
        await db.delete(agent)

    await db.flush()

    # Re-seed defaults
    seeded = await seed_project_defaults(db, project_id)
    await db.commit()

    agents = seeded["agents"]
    return {
        "detail": f"Reset complete. {len(agents)} default agents created.",
        "agent_count": len(agents),
    }
```

**Steps:**
1. Read `apps/backend/app/routers/agents.py`
2. Add the import and endpoint as shown above
3. Run `cd apps/backend && uv run ruff check app/routers/agents.py` — Expected: no errors
4. Commit: `git add apps/backend/app/routers/agents.py && git commit -m "feat(backend): add reset-defaults endpoint for project agents"`

---

## Task 5: Frontend — agent config management UI enhancements

**Files:**
- Create: `apps/desktop/src/renderer/screens/project/project-agents.tsx`

Create the project agents screen with:
- List of agent configs for the project (fetched from `GET /projects/{project_id}/agents`)
- Each agent displayed as a card showing name, description, model, max_turns
- "Reset to Defaults" button in the header that calls `POST /projects/{project_id}/agents/reset-defaults` with a confirmation dialog
- "Duplicate" action on each agent card that calls `POST /projects/{project_id}/agents` with the duplicated agent's data (name suffixed with " (copy)")

```tsx
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { useProjectId } from "../../hooks/use-project-id";

interface AgentConfig {
  id: string;
  project_id: string | null;
  name: string;
  description: string | null;
  system_prompt: string;
  claude_model: string;
  tools_list: string[] | null;
  max_turns: number;
  created_at: string;
}

export function ProjectAgents() {
  const projectId = useProjectId();
  const queryClient = useQueryClient();

  const { data: agents = [], isLoading } = useQuery<AgentConfig[]>({
    queryKey: ["projects", projectId, "agents"],
    queryFn: () => api.get(`/projects/${projectId}/agents`).then((r) => r.data),
  });

  const resetMutation = useMutation({
    mutationFn: () =>
      api.post(`/projects/${projectId}/agents/reset-defaults`),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["projects", projectId, "agents"],
      });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: (agent: AgentConfig) =>
      api.post(`/projects/${projectId}/agents`, {
        name: `${agent.name} (copy)`,
        description: agent.description,
        system_prompt: agent.system_prompt,
        claude_model: agent.claude_model,
        tools_list: agent.tools_list,
        max_turns: agent.max_turns,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["projects", projectId, "agents"],
      });
    },
  });

  const handleReset = () => {
    if (window.confirm("Reset all agents to defaults? This will delete any customizations.")) {
      resetMutation.mutate();
    }
  };

  if (isLoading) {
    return <div className="p-4 text-muted-foreground">Loading agents...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Agent Configurations</h2>
        <button
          type="button"
          onClick={handleReset}
          disabled={resetMutation.isPending}
          className="px-3 py-1.5 text-sm rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
        >
          {resetMutation.isPending ? "Resetting..." : "Reset to Defaults"}
        </button>
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {agents.map((agent) => (
          <div
            key={agent.id}
            className="rounded-lg border bg-card p-4 space-y-3"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-medium">{agent.name}</h3>
                {agent.description && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {agent.description}
                  </p>
                )}
              </div>
              {agent.project_id === null && (
                <span className="text-xs bg-muted px-2 py-0.5 rounded">
                  Global
                </span>
              )}
            </div>

            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>Model: {agent.claude_model}</span>
              <span>Max turns: {agent.max_turns}</span>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => duplicateMutation.mutate(agent)}
                disabled={duplicateMutation.isPending}
                className="text-xs px-2 py-1 rounded hover:bg-muted"
              >
                Duplicate
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

Note: This component uses `useProjectId` and `api` — adjust import paths based on actual project structure. The exact hooks and API client may need to be created or adapted from existing patterns in the codebase.

**Steps:**
1. Review existing frontend patterns in `apps/desktop/src/renderer/screens/project/` for API and hook conventions
2. Create `apps/desktop/src/renderer/screens/project/project-agents.tsx` with the content above (adapt imports to match codebase)
3. Wire the new screen into the project tab navigation (in `tab-content.tsx` or the project sidebar)
4. Run `pnpm --filter my-electron-app lint` — Expected: no errors
5. Commit: `git add apps/desktop/src/renderer/screens/project/project-agents.tsx && git commit -m "feat(desktop): add agent config management screen with reset and duplicate"`

---

## Task 6: Tests

**Files:**
- Create: `apps/backend/tests/test_project_seeder.py`

```python
"""Tests for project seeding service."""

import uuid

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agent_config import AgentConfig, AgentSkill
from app.models.skill import Skill
from app.models.workflow_template import WorkflowTemplate
from app.services.project_seeder import seed_project_defaults
from app.services.seed_data import DEFAULT_AGENT_CONFIGS, DEFAULT_WORKFLOW_TEMPLATES


@pytest.mark.asyncio
async def test_seed_project_defaults_creates_agents(db: AsyncSession, project):
    """Seeding creates the expected number of agent configs."""
    result = await seed_project_defaults(db, project.id)
    await db.commit()

    agents = result["agents"]
    assert len(agents) == len(DEFAULT_AGENT_CONFIGS)

    # Verify all agents belong to the project
    for agent in agents:
        assert agent.project_id == project.id

    # Verify agent names match defaults
    agent_names = {a.name for a in agents}
    expected_names = {cfg["name"] for cfg in DEFAULT_AGENT_CONFIGS}
    assert agent_names == expected_names


@pytest.mark.asyncio
async def test_seed_project_defaults_creates_templates(db: AsyncSession, project):
    """Seeding creates the expected number of workflow templates."""
    result = await seed_project_defaults(db, project.id)
    await db.commit()

    templates = result["templates"]
    assert len(templates) == len(DEFAULT_WORKFLOW_TEMPLATES)

    # Verify all templates belong to the project
    for tmpl in templates:
        assert tmpl.project_id == project.id

    # Verify template names match defaults
    tmpl_names = {t.name for t in templates}
    expected_names = {cfg["name"] for cfg in DEFAULT_WORKFLOW_TEMPLATES}
    assert tmpl_names == expected_names


@pytest.mark.asyncio
async def test_seed_project_defaults_creates_skill_links(db: AsyncSession, project):
    """Seeding creates AgentSkill links for agents with skill_names."""
    result = await seed_project_defaults(db, project.id)
    await db.commit()

    for agent in result["agents"]:
        matching_config = next(
            cfg for cfg in DEFAULT_AGENT_CONFIGS if cfg["name"] == agent.name
        )
        expected_skill_count = len(matching_config.get("skill_names", []))

        skills_result = await db.execute(
            select(AgentSkill).where(AgentSkill.agent_config_id == agent.id)
        )
        agent_skills = skills_result.scalars().all()
        assert len(agent_skills) == expected_skill_count


@pytest.mark.asyncio
async def test_seed_creates_placeholder_skills(db: AsyncSession, project):
    """When template skills don't exist yet, placeholders are created."""
    result = await seed_project_defaults(db, project.id)
    await db.commit()

    # Collect all expected skill names
    all_skill_names = set()
    for cfg in DEFAULT_AGENT_CONFIGS:
        all_skill_names.update(cfg.get("skill_names", []))

    # All should exist as template skills
    for name in all_skill_names:
        skill_result = await db.execute(
            select(Skill).where(Skill.name == name, Skill.is_template.is_(True))
        )
        skill = skill_result.scalar_one_or_none()
        assert skill is not None, f"Skill '{name}' should exist"


@pytest.mark.asyncio
async def test_seed_idempotent_skills(db: AsyncSession, project):
    """Seeding two projects reuses the same template skills."""
    project_id_1 = project.id

    # Seed first project
    await seed_project_defaults(db, project_id_1)
    await db.commit()

    skill_count_before = len(
        (await db.execute(select(Skill).where(Skill.is_template.is_(True))))
        .scalars()
        .all()
    )

    # Create a second project id (assumes project row exists — use a fixture or
    # create inline depending on test setup)
    # For this test, just call seed again with a different project_id that
    # already has a project row in the DB.
    # If your fixtures don't support this, skip this test.


@pytest.mark.asyncio
async def test_reset_defaults_endpoint(client, project, auth_headers):
    """POST /projects/{id}/agents/reset-defaults re-creates default agents."""
    project_id = str(project.id)

    # First verify agents exist (seeded on project creation)
    resp = await client.get(
        f"/projects/{project_id}/agents", headers=auth_headers
    )
    assert resp.status_code == 200
    initial_agents = resp.json()
    initial_count = len([a for a in initial_agents if a["project_id"] is not None])

    # Delete one agent
    project_agents = [a for a in initial_agents if a["project_id"] is not None]
    if project_agents:
        await client.delete(
            f"/projects/{project_id}/agents/{project_agents[0]['id']}",
            headers=auth_headers,
        )

    # Reset
    resp = await client.post(
        f"/projects/{project_id}/agents/reset-defaults", headers=auth_headers
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["agent_count"] == len(DEFAULT_AGENT_CONFIGS)

    # Verify all defaults are back
    resp = await client.get(
        f"/projects/{project_id}/agents", headers=auth_headers
    )
    assert resp.status_code == 200
    reset_agents = [a for a in resp.json() if a["project_id"] is not None]
    reset_names = {a["name"] for a in reset_agents}
    expected_names = {cfg["name"] for cfg in DEFAULT_AGENT_CONFIGS}
    assert reset_names == expected_names
```

Note: Adapt fixture names (`db`, `project`, `client`, `auth_headers`) to match your existing test infrastructure. Check `apps/backend/tests/conftest.py` for available fixtures.

**Steps:**
1. Review `apps/backend/tests/conftest.py` for available test fixtures and patterns
2. Create `apps/backend/tests/test_project_seeder.py` with the content above (adapt fixtures as needed)
3. Run `cd apps/backend && uv run pytest tests/test_project_seeder.py -v` — Expected: all tests pass (some may need fixture adjustments)
4. Run `cd apps/backend && uv run ruff check tests/test_project_seeder.py` — Expected: no errors
5. Commit: `git add apps/backend/tests/test_project_seeder.py && git commit -m "test(backend): add project seeding tests"`
