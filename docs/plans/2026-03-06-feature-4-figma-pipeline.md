# Feature 4: Figma Design-to-Code Pipeline

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** A 3-step pipeline where users paste a Figma URL, map design nodes to component specs, then Claude Code generates React components by reading the Figma design through MCP.

**Architecture:** FigmaTask/FigmaNode models already exist. Need a Figma REST router, prompt builder service, Figma-aware session runner with MCP config, and a 4-step frontend pipeline UI (Setup -> Map -> Generate -> Review) — all using `@agent-coding/ui` primitives.

**Tech Stack:** FastAPI, claude_agent_sdk with MCP, cursor-talk-to-figma-mcp, React 19, @agent-coding/ui

**Depends on:** Feature 1 (session management, Claude SDK integration), UI Primitives plan (packages/ui built)

**Already built (backend):**
- FigmaTask model (`apps/backend/app/models/figma.py`) — session_id, figma_url, status, result
- FigmaNode model (`apps/backend/app/models/figma.py`) — node_id, node_name, node_type, properties

**Already built (UI package — no need to create locally):**
- `SegmentedControl` — for 4-step pipeline navigation
- `Card` — for step content containers
- `Panel` — compound component for layout sections
- `StatusBadge` — for connection/step status
- `EmptyState`, `Spinner`, `StreamingText`, `CodeBlock`, `DiffViewer`
- `Progress` — for generation progress
- shadcn: `Input`, `Label`, `Button`, `Textarea`, `Badge`, `ScrollArea`, `Separator`, `Alert`, `Tooltip`

**Remaining work:**
- Backend: Figma schemas, prompt builder, Figma runner with MCP, REST router
- Frontend: 4-step pipeline UI

**Design ref:** `docs/design/pages/figma-pipeline.md`

---

### Task 1: Figma Pydantic schemas

**Files:**
- Create: `apps/backend/app/schemas/figma.py`
- Test: `apps/backend/tests/test_figma_schemas.py`

**Step 1: Write the failing test**

```python
import uuid
from app.schemas.figma import FigmaTaskCreate, FigmaNodeCreate, FigmaTaskResponse


def test_figma_task_create():
    data = FigmaTaskCreate(
        figma_url="https://www.figma.com/design/abc123/MyDesign",
        nodes=[
            FigmaNodeCreate(
                node_id="123:456",
                node_name="Button",
                component_name="Button",
                description="Primary CTA button",
            ),
        ],
    )
    assert len(data.nodes) == 1


def test_figma_task_response():
    resp = FigmaTaskResponse(
        id=uuid.uuid4(),
        session_id=None,
        figma_url="https://figma.com/abc",
        status="pending",
        nodes=[],
    )
    assert resp.status == "pending"
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend && uv run pytest tests/test_figma_schemas.py -v`

**Step 3: Write the schemas**

```python
import uuid
from pydantic import BaseModel


class FigmaNodeCreate(BaseModel):
    node_id: str
    node_name: str
    component_name: str
    description: str = ""
    props_spec: dict | None = None


class FigmaNodeResponse(BaseModel):
    id: uuid.UUID
    node_id: str
    node_name: str
    node_type: str | None = None
    properties: dict | None = None

    model_config = {"from_attributes": True}


class FigmaTaskCreate(BaseModel):
    figma_url: str
    nodes: list[FigmaNodeCreate] = []


class FigmaTaskResponse(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID | None = None
    figma_url: str
    status: str
    result: dict | None = None
    nodes: list[FigmaNodeResponse] = []

    model_config = {"from_attributes": True}
```

**Step 4: Run test, commit**

Run: `cd apps/backend && uv run pytest tests/test_figma_schemas.py -v`

```bash
git add apps/backend/app/schemas/figma.py apps/backend/tests/test_figma_schemas.py
git commit -m "feat(backend): add Figma Pydantic schemas"
```

---

### Task 2: Figma prompt builder service

**Files:**
- Create: `apps/backend/app/services/figma_prompt.py`
- Test: `apps/backend/tests/test_figma_prompt.py`

**Step 1: Write the failing test**

```python
from app.services.figma_prompt import build_figma_prompt


def test_build_single_node_prompt():
    nodes = [
        {
            "node_id": "123:456",
            "component_name": "Button",
            "description": "Primary CTA button with hover state",
            "props_spec": {"label": "string", "onClick": "function"},
        }
    ]
    prompt = build_figma_prompt(
        figma_url="https://figma.com/design/abc/MyDesign",
        nodes=nodes,
    )
    assert "123:456" in prompt
    assert "Button" in prompt
    assert "label" in prompt
```

**Step 2: Write the implementation**

```python
import json


def build_figma_prompt(figma_url: str, nodes: list[dict]) -> str:
    parts = [
        "Generate React components from the following Figma design.",
        f"Figma file: {figma_url}",
        "",
        "For each component below:",
        "1. Use the Figma MCP tools to read the design node and inspect its properties.",
        "2. Generate a React TypeScript component with Tailwind CSS.",
        "3. Match the design as closely as possible (colors, spacing, typography).",
        "4. Write the component file to the project.",
        "",
        "Components to generate:",
        "",
    ]

    for i, node in enumerate(nodes, 1):
        parts.append(f"### Component {i}: {node['component_name']}")
        parts.append(f"- Figma Node ID: {node['node_id']}")
        parts.append(f"- Description: {node['description']}")
        if node.get("props_spec"):
            parts.append(f"- Props: {json.dumps(node['props_spec'])}")
        parts.append("")

    return "\n".join(parts)
```

**Step 3: Run test, commit**

```bash
git add apps/backend/app/services/figma_prompt.py apps/backend/tests/test_figma_prompt.py
git commit -m "feat(backend): add Figma prompt builder service"
```

---

### Task 3: Figma REST router

**Files:**
- Create: `apps/backend/app/routers/figma.py`
- Modify: `apps/backend/app/main.py`
- Test: `apps/backend/tests/test_figma_router.py`

**Step 1: Write the failing test**

```python
async def test_create_figma_task(client, db_session):
    user = await create_user(db_session)
    headers = auth_headers(user.id)

    # Create a project first
    proj_resp = await client.post(
        "/projects",
        json={"name": "FigmaTest", "slug": "figmatest", "path": "/tmp/figma"},
        headers=headers,
    )
    project_id = proj_resp.json()["id"]

    response = await client.post(
        f"/projects/{project_id}/figma",
        json={
            "figma_url": "https://figma.com/design/abc/Test",
            "nodes": [
                {
                    "node_id": "1:2",
                    "node_name": "Button",
                    "component_name": "Button",
                    "description": "Primary button",
                }
            ],
        },
        headers=headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["figma_url"] == "https://figma.com/design/abc/Test"
    assert len(data["nodes"]) == 1
```

**Step 2: Write the router**

Router endpoints:
- `GET /projects/{id}/figma` — list figma tasks
- `POST /projects/{id}/figma` — create figma task with node mappings
- `GET /projects/{id}/figma/{task_id}` — get task detail
- `POST /projects/{id}/figma/{task_id}/nodes` — add node to task
- `POST /projects/{id}/figma/{task_id}/generate` — trigger generation (enqueue ARQ job)

The generate endpoint should:
1. Load task + nodes
2. Build prompt via `build_figma_prompt()`
3. Create a Session with type appropriate for figma
4. Enqueue the ARQ worker job with MCP config for cursor-talk-to-figma

**Step 3: Register router, run tests, commit**

```bash
git add apps/backend/app/routers/figma.py apps/backend/app/main.py apps/backend/tests/test_figma_router.py
git commit -m "feat(backend): add Figma REST router with generate endpoint"
```

---

### Task 4: Figma pipeline screen in frontend

**Files:**
- Create: `apps/desktop/src/renderer/hooks/use-figma.ts`
- Modify: `apps/desktop/src/renderer/screens/figma.tsx`
- Modify: `apps/desktop/src/renderer/routes.tsx` (add route)

**UI imports from `@agent-coding/ui`:** `SegmentedControl`, `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`, `Panel`, `Input`, `Label`, `Button`, `Textarea`, `Badge`, `StatusBadge`, `Progress`, `EmptyState`, `Spinner`, `StreamingText`, `CodeBlock`, `DiffViewer`, `ScrollArea`, `Separator`, `Alert`, `AlertDescription`, `Tooltip`, `TooltipTrigger`, `TooltipContent`, `TooltipProvider`

**Step 1: Create useFigma hook**

Manages figma task state, node mappings, and generation trigger.

**Step 2: Build 4-step pipeline UI**

Per `docs/design/pages/figma-pipeline.md`:

```tsx
import { useState } from 'react'
import { Figma, Link, Plus, Sparkles, Trash2 } from 'lucide-react'
import {
  SegmentedControl,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Panel,
  Input,
  Label,
  Button,
  Textarea,
  Badge,
  StatusBadge,
  Progress,
  EmptyState,
  Spinner,
  StreamingText,
  CodeBlock,
  DiffViewer,
  ScrollArea,
  Separator,
  Alert,
  AlertDescription,
} from '@agent-coding/ui'

import { useFigma } from '../hooks/use-figma'

type PipelineStep = 'setup' | 'map' | 'generate' | 'review'

const STEPS = [
  { value: 'setup', label: 'Setup' },
  { value: 'map', label: 'Map' },
  { value: 'generate', label: 'Generate' },
  { value: 'review', label: 'Review' },
]

export function FigmaScreen() {
  const [step, setStep] = useState<PipelineStep>('setup')
  const { task, nodes, isGenerating, streamOutput, generatedCode, setFigmaUrl, addNode, removeNode, updateNode, startGeneration } = useFigma()

  return (
    <Panel>
      <Panel.Header>
        <Panel.Title>Figma Pipeline</Panel.Title>
        <Panel.Actions>
          <SegmentedControl
            value={step}
            onValueChange={(v) => setStep(v as PipelineStep)}
            items={STEPS}
            size="sm"
          />
        </Panel.Actions>
      </Panel.Header>
      <Panel.Content>
        <ScrollArea className="h-full">
          <div className="mx-auto max-w-3xl space-y-6 p-6">

            {/* Step 1: Setup */}
            {step === 'setup' && (
              <Card>
                <CardHeader>
                  <CardTitle>Figma URL</CardTitle>
                  <CardDescription>Paste your Figma design file URL to get started</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="https://www.figma.com/design/..."
                      value={task?.figma_url ?? ''}
                      onChange={(e) => setFigmaUrl(e.target.value)}
                      className="flex-1"
                    />
                    <StatusBadge status={task?.figma_url ? 'connected' : 'disconnected'}>
                      {task?.figma_url ? 'Ready' : 'No URL'}
                    </StatusBadge>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button onClick={() => setStep('map')} disabled={!task?.figma_url}>
                    Next: Map Components
                  </Button>
                </CardFooter>
              </Card>
            )}

            {/* Step 2: Map */}
            {step === 'map' && (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-[15px] font-semibold text-foreground">Component Mapping</h2>
                  <Button size="sm" onClick={addNode}>
                    <Plus size={14} /> Add Component
                  </Button>
                </div>

                {nodes.length === 0 ? (
                  <EmptyState
                    icon={Figma}
                    title="No components mapped"
                    description="Add Figma nodes and map them to React components"
                    action={<Button size="sm" onClick={addNode}>Add Component</Button>}
                  />
                ) : (
                  nodes.map((node, i) => (
                    <Card key={i}>
                      <CardContent className="space-y-3 pt-4">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline">Component {i + 1}</Badge>
                          <Button variant="ghost" size="icon-xs" onClick={() => removeNode(i)}>
                            <Trash2 size={14} />
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label>Figma Node ID</Label>
                            <Input
                              placeholder="123:456"
                              value={node.node_id}
                              onChange={(e) => updateNode(i, { node_id: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Component Name</Label>
                            <Input
                              placeholder="Button"
                              value={node.component_name}
                              onChange={(e) => updateNode(i, { component_name: e.target.value })}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Description</Label>
                          <Textarea
                            placeholder="Describe the component behavior..."
                            value={node.description}
                            onChange={(e) => updateNode(i, { description: e.target.value })}
                            rows={2}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}

                {nodes.length > 0 && (
                  <div className="flex justify-end">
                    <Button onClick={() => { startGeneration(); setStep('generate') }}>
                      <Sparkles size={14} /> Generate Components
                    </Button>
                  </div>
                )}
              </>
            )}

            {/* Step 3: Generate */}
            {step === 'generate' && (
              <Card>
                <CardHeader>
                  <CardTitle>Generating Components</CardTitle>
                  <CardDescription>Claude is reading the Figma design and generating React components</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isGenerating ? (
                    <>
                      <Progress value={undefined} className="w-full" />
                      <div className="flex items-center gap-2">
                        <Spinner size="sm" />
                        <span className="text-[12px] text-muted-foreground">Processing...</span>
                      </div>
                      <Separator />
                      <div className="rounded-md border border-border bg-card p-3">
                        <StreamingText content={streamOutput} isStreaming />
                      </div>
                    </>
                  ) : (
                    <div className="space-y-2">
                      <StatusBadge status="passed">Generation Complete</StatusBadge>
                      <Button variant="outline" onClick={() => setStep('review')}>
                        Review Generated Code
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Step 4: Review */}
            {step === 'review' && (
              <>
                {generatedCode.length === 0 ? (
                  <EmptyState
                    icon={Sparkles}
                    title="No generated code"
                    description="Run the generation step first"
                    action={<Button size="sm" onClick={() => setStep('generate')}>Go to Generate</Button>}
                  />
                ) : (
                  generatedCode.map((file, i) => (
                    <div key={i} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline">{file.path}</Badge>
                        <Button variant="outline" size="sm">Iterate</Button>
                      </div>
                      <CodeBlock
                        code={file.code}
                        language="tsx"
                        showLineNumbers
                        showCopyButton
                      />
                    </div>
                  ))
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </Panel.Content>
    </Panel>
  )
}
```

**Step 3: Add figma route**

Add `/figma` route to routes.tsx pointing to the FigmaScreen.

**Step 4: Commit**

```bash
git add apps/desktop/src/renderer/
git commit -m "feat(desktop): build Figma pipeline screen with @agent-coding/ui"
```
