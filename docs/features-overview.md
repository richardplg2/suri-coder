# Agent Coding — Features Overview

Workflow manager for AI coding. Create tickets, and AI agents automatically execute each step (plan → design → code → test → review).

---

## 1. Tickets

- Create tickets with title, description, type (feature/bug/improvement/chore), and priority
- Tickets automatically transition: **Backlog → In Progress → Done / Cancelled**
- Each ticket has 4 tabs:
  - **Overview** — general info, settings
  - **Specs** — requirement documents with revision history
  - **Tasks** — step diagram, run/stop/retry actions, cost tracking, code review
  - **Activity** — realtime timeline of all events

---

## 2. Workflow Templates

Pre-defined step sequences for each type of work:

| Template | Steps |
|----------|-------|
| Full Feature | Plan → Design (if has UI) → Code → Test |
| Bug Fix | Plan → Fix → Test |
| Refactor | Plan → Test Before → Refactor → Test After |

- Steps can run in parallel if they don't depend on each other
- A step can be split into multiple sub-steps automatically

---

## 3. Automated Execution

- Hit "Run" and steps execute automatically in the defined order
- **Pre-execution approval** — optionally require approval before AI starts a step
- **Post-execution review** — by default, user must review results before a step is marked complete
- **When tests fail:**
  1. Auto-retry
  2. If still failing → auto-create a fix task, then re-test
  3. If still failing → notify user
- **Code review:** View diffs, comment on specific lines, approve or request changes

---

## 4. Sessions

- Each step creates an isolated AI session when it runs
- Each session gets its own git branch, keeping main code safe
- Watch AI work in realtime — streaming messages, tool calls, cost updates

---

## 5. Brainstorming

Two ways to create a ticket:

**Path A: Chat with AI**
1. Click "Create Ticket" → "Start with AI"
2. AI asks 5-8 structured questions (pick options or type freely)
3. AI generates a feature spec summary
4. User reviews and edits
5. Click "Create Ticket" → done

**Path B: From Figma**
1. Click "Create Ticket" → "Start from Figma"
2. Select designs from Figma, annotate with descriptions
3. AI asks follow-up questions based on the design
4. Ticket created with design references attached

---

## 6. Figma Integration

- Figma plugin connects directly to the app
- 3-panel layout: **node tree | design canvas | annotation panel**
- Select nodes, write descriptions for each part → export to create tickets

---

## 7. AI Agent Configs

5 default agents:

| Agent | Role |
|-------|------|
| Planner | Create implementation plans |
| Designer | Design components, write design notes |
| Coder | Write code, make commits |
| Tester | Write and run tests |
| Reviewer | Review code |

Each agent's prompt, model, and available tools are customizable.

---

## 8. Realtime Updates

All changes appear instantly: ticket created/updated, step running/completed/failed, live AI output, system notifications.
