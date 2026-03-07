---
name: claude-agent-sdk
description: Use when building AI agents with the Claude Agent SDK (formerly Claude Code SDK), importing claude_agent_sdk or @anthropic-ai/claude-agent-sdk, configuring agent permissions, MCP servers, hooks, subagents, sessions, custom tools, structured outputs, or system prompts programmatically
---

# Claude Agent SDK

Build production AI agents using Claude Code as a programmable library. Available in Python (`claude-agent-sdk`) and TypeScript (`@anthropic-ai/claude-agent-sdk`).

**Official docs:** https://platform.claude.com/docs/en/agent-sdk/overview

## Installation

```bash
# Python
pip install claude-agent-sdk

# TypeScript
npm install @anthropic-ai/claude-agent-sdk
```

**Auth:** Set `ANTHROPIC_API_KEY` env var. Also supports Bedrock (`CLAUDE_CODE_USE_BEDROCK=1`), Vertex AI (`CLAUDE_CODE_USE_VERTEX=1`), Azure (`CLAUDE_CODE_USE_FOUNDRY=1`).

## Core API

Two entry points in Python:

| | `query()` | `ClaudeSDKClient` |
|---|---|---|
| Session | New each time | Reuses same session |
| Multi-turn | No | Yes |
| Interrupts | No | Yes |
| Use case | One-off tasks | Conversations |

### Minimal Example

```python
import asyncio
from claude_agent_sdk import query, ClaudeAgentOptions

async def main():
    async for message in query(
        prompt="Find and fix the bug in auth.py",
        options=ClaudeAgentOptions(
            allowed_tools=["Read", "Edit", "Bash"],
            permission_mode="acceptEdits",
        ),
    ):
        if hasattr(message, "result"):
            print(message.result)

asyncio.run(main())
```

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: "Find and fix the bug in auth.py",
  options: {
    allowedTools: ["Read", "Edit", "Bash"],
    permissionMode: "acceptEdits"
  }
})) {
  if ("result" in message) console.log(message.result);
}
```

## ClaudeAgentOptions Reference

Key fields (Python names / TypeScript names):

| Option | Description |
|--------|-------------|
| `allowed_tools` / `allowedTools` | Auto-approve listed tools |
| `disallowed_tools` / `disallowedTools` | Always block listed tools |
| `permission_mode` / `permissionMode` | `default`, `acceptEdits`, `bypassPermissions`, `plan`, `dontAsk` (TS only) |
| `system_prompt` / `systemPrompt` | Custom string, or `{"type":"preset","preset":"claude_code","append":"..."}` |
| `mcp_servers` / `mcpServers` | MCP server configurations |
| `agents` | Subagent definitions (dict of `AgentDefinition`) |
| `hooks` | Lifecycle hook callbacks |
| `max_turns` / `maxTurns` | Cap tool-use turns |
| `max_budget_usd` / `maxBudgetUsd` | Cost limit |
| `effort` | `"low"`, `"medium"`, `"high"`, `"max"` |
| `model` | Pin model (e.g. `"claude-sonnet-4-6"`) |
| `resume` | Session ID to resume |
| `fork_session` / `forkSession` | Branch from a session |
| `continue_conversation` / `continue` | Resume most recent session |
| `setting_sources` / `settingSources` | `["project"]`, `["user"]` to load CLAUDE.md, skills, hooks |
| `output_format` / `outputFormat` | Structured output JSON schema |
| `include_partial_messages` / `includePartialMessages` | Enable streaming output |
| `enable_file_checkpointing` / `enableFileCheckpointing` | Track file changes for rewind |
| `cwd` | Working directory |
| `env` | Environment variables |
| `plugins` | Plugin paths |
| `can_use_tool` / `canUseTool` | Callback for interactive approval |

## Built-in Tools

| Tool | What it does |
|------|-------------|
| `Read` | Read files |
| `Write` | Create files |
| `Edit` | Edit existing files |
| `Bash` | Run shell commands |
| `Glob` | Find files by pattern |
| `Grep` | Search file contents |
| `WebSearch` | Search the web |
| `WebFetch` | Fetch web pages |
| `Task` | Spawn subagents |
| `Skill` | Invoke skills |
| `AskUserQuestion` | Ask user clarifying questions |
| `TodoWrite` | Track tasks |
| `ToolSearch` | Dynamically discover tools |

## Capabilities & Documentation Links

### 1. Permissions
**Docs:** https://platform.claude.com/docs/en/agent-sdk/permissions

Control tool access with allow/deny rules and permission modes.

```python
ClaudeAgentOptions(
    allowed_tools=["Read", "Glob", "Grep"],
    disallowed_tools=["Bash"],
    permission_mode="default",  # or acceptEdits, bypassPermissions, plan
)
```

**Evaluation order:** Hooks -> Deny rules -> Permission mode -> Allow rules -> `canUseTool` callback.

**Modes:** `default` (callback decides), `acceptEdits` (auto-approve file ops), `bypassPermissions` (approve all), `plan` (no execution), `dontAsk` (TS only, deny unlisted).

### 2. MCP Integration
**Docs:** https://platform.claude.com/docs/en/agent-sdk/mcp

Connect external tools via Model Context Protocol.

```python
ClaudeAgentOptions(
    mcp_servers={
        "github": {
            "command": "npx",
            "args": ["-y", "@modelcontextprotocol/server-github"],
            "env": {"GITHUB_TOKEN": os.environ["GITHUB_TOKEN"]},
        }
    },
    allowed_tools=["mcp__github__*"],  # Wildcard for all server tools
)
```

**Transports:** stdio (local processes), HTTP/SSE (remote), SDK MCP server (in-process custom tools).
**Tool naming:** `mcp__<server-name>__<tool-name>`.
**Tool search:** Auto-loads tools on demand when >10% of context. Configure via `ENABLE_TOOL_SEARCH` env var.

### 3. Custom Tools
**Docs:** https://platform.claude.com/docs/en/agent-sdk/custom-tools

Define in-process tools with `@tool` decorator and `create_sdk_mcp_server`.

```python
from claude_agent_sdk import tool, create_sdk_mcp_server

@tool("get_weather", "Get temperature for coordinates", {"lat": float, "lon": float})
async def get_weather(args):
    # ... fetch weather
    return {"content": [{"type": "text", "text": f"Temperature: {temp}F"}]}

server = create_sdk_mcp_server(name="my-tools", version="1.0.0", tools=[get_weather])

# Use: mcp_servers={"my-tools": server}, allowed_tools=["mcp__my-tools__get_weather"]
```

**Note:** Custom MCP tools require streaming input mode (async generator for prompt).

### 4. Subagents
**Docs:** https://platform.claude.com/docs/en/agent-sdk/subagents

Spawn isolated agents for focused subtasks via the `Task` tool.

```python
from claude_agent_sdk import AgentDefinition

ClaudeAgentOptions(
    allowed_tools=["Read", "Grep", "Glob", "Task"],  # Task required!
    agents={
        "code-reviewer": AgentDefinition(
            description="Expert code reviewer for security reviews.",
            prompt="You are a code review specialist...",
            tools=["Read", "Grep", "Glob"],  # Restricted tools
            model="sonnet",  # Optional: sonnet, opus, haiku, inherit
        )
    },
)
```

**Benefits:** Context isolation, parallelization, specialized instructions, tool restrictions.
**Limitation:** Subagents cannot spawn their own subagents (no `Task` in subagent tools).

### 5. Sessions
**Docs:** https://platform.claude.com/docs/en/agent-sdk/sessions

Resume, continue, or fork conversations.

```python
# Capture session ID
async for message in query(prompt="Analyze auth module", options=opts):
    if isinstance(message, ResultMessage):
        session_id = message.session_id

# Resume later
async for message in query(
    prompt="Now fix the issues you found",
    options=ClaudeAgentOptions(resume=session_id),
):
    ...

# Or fork to explore alternative
async for message in query(
    prompt="Try OAuth2 instead",
    options=ClaudeAgentOptions(resume=session_id, fork_session=True),
):
    ...
```

**Python `ClaudeSDKClient`** handles session IDs automatically across calls.
**TypeScript `continue: true`** resumes most recent session.

### 6. Hooks
**Docs:** https://platform.claude.com/docs/en/agent-sdk/hooks

Intercept agent behavior at lifecycle points.

```python
from claude_agent_sdk import HookMatcher

async def block_env_writes(input_data, tool_use_id, context):
    file_path = input_data["tool_input"].get("file_path", "")
    if file_path.endswith(".env"):
        return {"hookSpecificOutput": {
            "hookEventName": input_data["hook_event_name"],
            "permissionDecision": "deny",
            "permissionDecisionReason": "Cannot modify .env files",
        }}
    return {}

ClaudeAgentOptions(
    hooks={"PreToolUse": [HookMatcher(matcher="Write|Edit", hooks=[block_env_writes])]}
)
```

**Events:** `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `Stop`, `SubagentStart`, `SubagentStop`, `Notification`, `PreCompact`, `PermissionRequest`, `UserPromptSubmit`.
**TS-only events:** `SessionStart`, `SessionEnd`, `Setup`, `TeammateIdle`, `TaskCompleted`, `ConfigChange`, `WorktreeCreate`, `WorktreeRemove`.

**Hook outputs:** `{}` to allow, `permissionDecision: "deny"` to block, `updatedInput` to modify, `systemMessage` to inject context, `async_: True` for fire-and-forget.

### 7. System Prompts
**Docs:** https://platform.claude.com/docs/en/agent-sdk/modifying-system-prompts

Four approaches:

1. **CLAUDE.md files** - Project-level, persistent, requires `setting_sources=["project"]`
2. **Output styles** - Saved configs in `~/.claude/output-styles/`
3. **Preset with append** - `system_prompt={"type":"preset","preset":"claude_code","append":"..."}`
4. **Custom string** - `system_prompt="You are a Python expert..."` (loses default tools/safety)

**Important:** Default SDK uses minimal system prompt. Use `preset: "claude_code"` for full Claude Code behavior. CLAUDE.md only loads with `setting_sources`.

### 8. Streaming Output
**Docs:** https://platform.claude.com/docs/en/agent-sdk/streaming-output

Real-time token streaming.

```python
from claude_agent_sdk.types import StreamEvent

opts = ClaudeAgentOptions(include_partial_messages=True)
async for message in query(prompt="...", options=opts):
    if isinstance(message, StreamEvent):
        event = message.event
        if event.get("type") == "content_block_delta":
            delta = event.get("delta", {})
            if delta.get("type") == "text_delta":
                print(delta.get("text", ""), end="", flush=True)
```

### 9. Structured Outputs
**Docs:** https://platform.claude.com/docs/en/agent-sdk/structured-outputs

Get validated JSON matching a schema.

```python
from pydantic import BaseModel

class FeaturePlan(BaseModel):
    name: str
    steps: list[str]

opts = ClaudeAgentOptions(
    output_format={"type": "json_schema", "schema": FeaturePlan.model_json_schema()}
)
async for msg in query(prompt="Plan dark mode feature", options=opts):
    if isinstance(msg, ResultMessage) and msg.structured_output:
        plan = FeaturePlan.model_validate(msg.structured_output)
```

### 10. User Input & Approvals
**Docs:** https://platform.claude.com/docs/en/agent-sdk/user-input

Handle permission prompts and clarifying questions via `canUseTool` callback.

```python
from claude_agent_sdk.types import PermissionResultAllow, PermissionResultDeny

async def can_use_tool(tool_name, input_data, context):
    if tool_name == "AskUserQuestion":
        return await handle_questions(input_data)
    approved = input(f"Allow {tool_name}? (y/n): ") == "y"
    if approved:
        return PermissionResultAllow(updated_input=input_data)
    return PermissionResultDeny(message="User denied")

ClaudeAgentOptions(can_use_tool=can_use_tool)
```

### 11. File Checkpointing
**Docs:** https://platform.claude.com/docs/en/agent-sdk/file-checkpointing

Track and revert file changes (Write/Edit/NotebookEdit only).

```python
ClaudeAgentOptions(
    enable_file_checkpointing=True,
    permission_mode="acceptEdits",
    extra_args={"replay-user-messages": None},  # Required for checkpoint UUIDs
)
# Capture UserMessage.uuid as checkpoint, then rewind:
# await client.rewind_files(checkpoint_id)
```

### 12. Cost Tracking
**Docs:** https://platform.claude.com/docs/en/agent-sdk/cost-tracking

`ResultMessage` provides `total_cost_usd`, `usage` (token counts), `num_turns`, `session_id`.

### 13. Skills & Plugins
**Docs:** https://platform.claude.com/docs/en/agent-sdk/skills | https://platform.claude.com/docs/en/agent-sdk/plugins

- **Skills:** SKILL.md files in `.claude/skills/`. Require `setting_sources=["project"]` and `"Skill"` in `allowed_tools`.
- **Plugins:** Load via `plugins=[{"type":"local","path":"./my-plugin"}]`. Include commands, agents, skills, hooks, MCP servers.

### 14. Streaming Input
**Docs:** https://platform.claude.com/docs/en/agent-sdk/streaming-vs-single-mode

Use async generators for interactive sessions with image uploads, queued messages, interrupts.

```python
async def message_generator():
    yield {"type": "user", "message": {"role": "user", "content": "Analyze this code"}}
    # ... yield more messages dynamically

async with ClaudeSDKClient(options) as client:
    await client.query(message_generator())
    async for msg in client.receive_response():
        print(msg)
```

## Message Types

| Type | Description |
|------|-------------|
| `SystemMessage` | Session init (`subtype="init"`) and compaction boundary |
| `AssistantMessage` | Claude's response (text + tool calls) |
| `UserMessage` | Tool results sent back to Claude |
| `StreamEvent` | Real-time streaming deltas (when enabled) |
| `ResultMessage` | Final result with cost, usage, session_id |

**Result subtypes:** `success`, `error_max_turns`, `error_max_budget_usd`, `error_during_execution`, `error_max_structured_output_retries`.

## Agent Loop

1. Receive prompt + system prompt + tool definitions
2. Claude evaluates and responds (text and/or tool calls)
3. SDK executes tools, feeds results back
4. Repeat until no tool calls remain
5. Return `ResultMessage`

Context accumulates across turns. Auto-compaction summarizes older history when nearing limits. Use subagents to keep context lean.

## Quick Reference: Common Patterns

**Read-only agent:**
```python
ClaudeAgentOptions(allowed_tools=["Read", "Glob", "Grep"])
```

**Full automation:**
```python
ClaudeAgentOptions(
    allowed_tools=["Read", "Edit", "Write", "Bash", "Glob", "Grep"],
    permission_mode="acceptEdits",
)
```

**With MCP + subagents:**
```python
ClaudeAgentOptions(
    allowed_tools=["Read", "Edit", "Bash", "Task", "mcp__github__*"],
    mcp_servers={"github": {...}},
    agents={"reviewer": AgentDefinition(...)},
)
```

**CI/headless agent:**
```python
ClaudeAgentOptions(
    allowed_tools=["Read", "Edit", "Bash", "Glob", "Grep"],
    permission_mode="bypassPermissions",
    max_turns=30,
    max_budget_usd=5.0,
)
```

## Related Links

| Topic | URL |
|-------|-----|
| Overview | https://platform.claude.com/docs/en/agent-sdk/overview |
| Quickstart | https://platform.claude.com/docs/en/agent-sdk/quickstart |
| Python API Reference | https://platform.claude.com/docs/en/agent-sdk/python |
| TypeScript API Reference | https://platform.claude.com/docs/en/agent-sdk/typescript |
| Agent Loop | https://platform.claude.com/docs/en/agent-sdk/agent-loop |
| Permissions | https://platform.claude.com/docs/en/agent-sdk/permissions |
| MCP Integration | https://platform.claude.com/docs/en/agent-sdk/mcp |
| Custom Tools | https://platform.claude.com/docs/en/agent-sdk/custom-tools |
| Subagents | https://platform.claude.com/docs/en/agent-sdk/subagents |
| Sessions | https://platform.claude.com/docs/en/agent-sdk/sessions |
| Hooks | https://platform.claude.com/docs/en/agent-sdk/hooks |
| System Prompts | https://platform.claude.com/docs/en/agent-sdk/modifying-system-prompts |
| Streaming Output | https://platform.claude.com/docs/en/agent-sdk/streaming-output |
| Streaming Input | https://platform.claude.com/docs/en/agent-sdk/streaming-vs-single-mode |
| Structured Outputs | https://platform.claude.com/docs/en/agent-sdk/structured-outputs |
| User Input & Approvals | https://platform.claude.com/docs/en/agent-sdk/user-input |
| File Checkpointing | https://platform.claude.com/docs/en/agent-sdk/file-checkpointing |
| Cost Tracking | https://platform.claude.com/docs/en/agent-sdk/cost-tracking |
| Skills | https://platform.claude.com/docs/en/agent-sdk/skills |
| Plugins | https://platform.claude.com/docs/en/agent-sdk/plugins |
| Slash Commands | https://platform.claude.com/docs/en/agent-sdk/slash-commands |
| Hosting/Deployment | https://platform.claude.com/docs/en/agent-sdk/hosting |
| Example Agents | https://github.com/anthropics/claude-agent-sdk-demos |
| Migration Guide | https://platform.claude.com/docs/en/agent-sdk/migration-guide |
| Python Changelog | https://github.com/anthropics/claude-agent-sdk-python/blob/main/CHANGELOG.md |
| TS Changelog | https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md |
