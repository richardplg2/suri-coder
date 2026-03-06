from collections import deque


def validate_dag(steps_config: dict, valid_agent_names: set[str]) -> list[str]:
    """Validate a workflow DAG. Returns list of error messages (empty = valid)."""
    steps = steps_config.get("steps", [])
    step_ids = {s["id"] for s in steps}
    errors: list[str] = []

    # Check for duplicate step IDs
    if len(step_ids) != len(steps):
        errors.append("Duplicate step IDs found")
        return errors

    # Check agent references
    for step in steps:
        if step["agent"] not in valid_agent_names:
            errors.append(f"Unknown agent: {step['agent']}")

    # Check dependency references
    for step in steps:
        for dep in step.get("depends_on", []):
            if dep not in step_ids:
                errors.append(f"Step '{step['id']}' depends on unknown step '{dep}'")

    if errors:
        return errors

    # Check for cycles using topological sort (Kahn's algorithm)
    in_degree = {s["id"]: 0 for s in steps}
    adj: dict[str, list[str]] = {s["id"]: [] for s in steps}
    for step in steps:
        for dep in step.get("depends_on", []):
            adj[dep].append(step["id"])
            in_degree[step["id"]] += 1

    queue = deque(sid for sid, deg in in_degree.items() if deg == 0)
    visited = 0
    while queue:
        node = queue.popleft()
        visited += 1
        for neighbor in adj[node]:
            in_degree[neighbor] -= 1
            if in_degree[neighbor] == 0:
                queue.append(neighbor)

    if visited != len(steps):
        errors.append("Workflow contains a dependency cycle")

    return errors
