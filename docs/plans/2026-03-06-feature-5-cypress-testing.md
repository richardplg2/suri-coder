# Feature 5: E2E Testing with Cypress

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Run Cypress tests via the backend, capture videos/screenshots, store results. Users can trigger test runs, view results with video playback, and use Claude to write new tests or fix failures.

**Architecture:** TestRun/TestResult models already exist. Need a Cypress runner service (subprocess), test REST router, ARQ worker task, and frontend UI with test list, video player, and "Fix with AI" integration — all using `@agent-coding/ui` primitives.

**Tech Stack:** FastAPI, Cypress (subprocess), SQLAlchemy async, file storage (local), React 19, @agent-coding/ui

**Depends on:** Feature 1 (session management, ARQ workers), UI Primitives plan (packages/ui built)

**Already built (backend):**
- TestRun model (`apps/backend/app/models/testing.py`) — command, status, total_tests, passed, failed, skipped, duration_ms
- TestResult model (`apps/backend/app/models/testing.py`) — test_name, status, duration_ms, error_message, stack_trace

**Already built (UI package — no need to create locally):**
- `SegmentedControl` — for view filter tabs
- `DataTable` — for test results table
- `StatusBadge` — for test status indicators
- `Panel` — compound component for layout sections
- `SplitPane` — for list | detail layout
- `EmptyState`, `Spinner`, `KVRow`, `Progress`
- shadcn: `Button`, `Card`, `Badge`, `ScrollArea`, `Separator`, `Alert`, `Tooltip`

**Remaining work:**
- Backend: Cypress runner service, test schemas, test REST router, ARQ task
- Frontend: Test runs list, results table, video player, "Fix with AI" button

**Design ref:** `docs/design/pages/cypress-testing.md`

---

### Task 1: Cypress runner service

**Files:**
- Create: `apps/backend/app/services/cypress_runner.py`
- Test: `apps/backend/tests/test_cypress_runner.py`

**Step 1: Write the failing test**

```python
from app.services.cypress_runner import build_cypress_command, parse_cypress_json


def test_build_cypress_command_all():
    cmd = build_cypress_command(project_path="/home/user/project", video=True)
    assert "cypress" in " ".join(cmd)
    assert "run" in cmd
    assert "video=true" in " ".join(cmd)


def test_build_cypress_command_specific_spec():
    cmd = build_cypress_command(
        project_path="/home/user/project",
        spec="cypress/e2e/login.cy.ts",
    )
    assert "--spec" in cmd
    assert "cypress/e2e/login.cy.ts" in cmd


def test_parse_cypress_json():
    raw = {
        "totalPassed": 3,
        "totalFailed": 1,
        "totalDuration": 5200,
        "runs": [
            {
                "spec": {"relative": "cypress/e2e/login.cy.ts"},
                "stats": {"duration": 1200},
                "tests": [
                    {"title": ["Login", "should login"], "state": "passed"},
                    {"title": ["Login", "should fail"], "state": "failed"},
                ],
                "screenshots": [{"path": "/tmp/screenshots/fail.png"}],
                "video": "/tmp/videos/login.cy.ts.mp4",
            }
        ],
    }
    results = parse_cypress_json(raw)
    assert len(results) == 1
    assert results[0]["spec_file"] == "cypress/e2e/login.cy.ts"
    assert results[0]["video"] == "/tmp/videos/login.cy.ts.mp4"
    assert len(results[0]["screenshots"]) == 1
```

**Step 2: Write the implementation**

```python
import asyncio
import json


def build_cypress_command(
    project_path: str,
    spec: str | None = None,
    video: bool = True,
    browser: str = "electron",
) -> list[str]:
    cmd = ["npx", "cypress", "run", "--reporter", "json"]
    if spec:
        cmd.extend(["--spec", spec])
    cmd.extend(["--browser", browser])
    cmd.extend(["--config", f"video={str(video).lower()}"])
    return cmd


def parse_cypress_json(raw: dict) -> list[dict]:
    results = []
    for run in raw.get("runs", []):
        spec_file = run.get("spec", {}).get("relative", "unknown")
        duration = run.get("stats", {}).get("duration", 0)
        video = run.get("video")
        screenshots = [s.get("path") for s in run.get("screenshots", [])]

        tests = run.get("tests", [])
        all_passed = all(t.get("state") == "passed" for t in tests)
        failed_tests = [t for t in tests if t.get("state") == "failed"]
        error_msg = None
        if failed_tests:
            error_msg = "; ".join(
                " > ".join(t.get("title", [])) for t in failed_tests
            )

        results.append({
            "spec_file": spec_file,
            "status": "passed" if all_passed else "failed",
            "duration_ms": duration,
            "video": video,
            "screenshots": screenshots,
            "error_message": error_msg,
        })
    return results


async def run_cypress(
    project_path: str,
    spec: str | None = None,
    video: bool = True,
) -> dict:
    cmd = build_cypress_command(project_path, spec=spec, video=video)
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        cwd=project_path,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate()

    try:
        raw = json.loads(stdout.decode())
        results = parse_cypress_json(raw)
    except (json.JSONDecodeError, KeyError):
        results = []

    overall_passed = all(r["status"] == "passed" for r in results) if results else False
    return {
        "success": proc.returncode == 0,
        "overall_status": "passed" if overall_passed else "failed",
        "results": results,
        "stderr": stderr.decode() if proc.returncode != 0 else None,
    }
```

**Step 3: Run test, commit**

```bash
git add apps/backend/app/services/cypress_runner.py apps/backend/tests/test_cypress_runner.py
git commit -m "feat(backend): add Cypress runner service with JSON parsing"
```

---

### Task 2: Test schemas and REST router

**Files:**
- Create: `apps/backend/app/schemas/testing.py`
- Create: `apps/backend/app/routers/testing.py`
- Modify: `apps/backend/app/main.py`
- Test: `apps/backend/tests/test_testing_router.py`

**Step 1: Write schemas**

```python
import uuid
from pydantic import BaseModel


class TestRunCreate(BaseModel):
    spec: str | None = None
    video: bool = True


class TestResultResponse(BaseModel):
    id: uuid.UUID
    test_name: str
    status: str
    duration_ms: int | None = None
    error_message: str | None = None

    model_config = {"from_attributes": True}


class TestRunResponse(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID | None = None
    command: str | None = None
    status: str
    total_tests: int | None = None
    passed: int | None = None
    failed: int | None = None
    duration_ms: int | None = None
    results: list[TestResultResponse] = []

    model_config = {"from_attributes": True}


class TestFixRequest(BaseModel):
    spec_file: str
    error_message: str
```

**Step 2: Write test router**

Router endpoints:
- `GET /projects/{id}/tests` — list test runs for project
- `POST /projects/{id}/tests` — trigger test run (enqueue ARQ job)
- `GET /projects/{id}/tests/{run_id}` — get test run detail with results
- `POST /projects/{id}/tests/{run_id}/fix` — spawn Claude session to fix failing test

**Step 3: Write failing test, register router, run tests, commit**

```bash
git add apps/backend/app/schemas/testing.py apps/backend/app/routers/testing.py apps/backend/app/main.py apps/backend/tests/test_testing_router.py
git commit -m "feat(backend): add testing REST router with Cypress integration"
```

---

### Task 3: Cypress ARQ worker task

**Files:**
- Create: `apps/backend/app/services/cypress_task.py`
- Modify: `apps/backend/app/worker.py`

**Step 1: Write the worker task**

The task should:
1. Run `run_cypress()` with the provided spec and options
2. Create TestResult records from parsed output
3. Update TestRun status
4. Publish results to Redis PubSub for WebSocket streaming

**Step 2: Register in worker.py**

Add to WorkerSettings.functions.

**Step 3: Commit**

```bash
git add apps/backend/app/services/cypress_task.py apps/backend/app/worker.py
git commit -m "feat(backend): add Cypress ARQ worker task"
```

---

### Task 4: Tests screen in frontend

**Files:**
- Create: `apps/desktop/src/renderer/hooks/use-tests.ts`
- Modify: `apps/desktop/src/renderer/screens/tests.tsx`

**UI imports from `@agent-coding/ui`:** `SegmentedControl`, `DataTable`, `StatusBadge`, `SplitPane`, `SplitPanePanel`, `SplitPaneHandle`, `Panel`, `Button`, `KVRow`, `EmptyState`, `Spinner`, `Progress`, `Badge`, `Card`, `CardContent`, `CardHeader`, `CardTitle`, `ScrollArea`, `Separator`, `Alert`, `AlertDescription`, `Tooltip`, `TooltipTrigger`, `TooltipContent`, `TooltipProvider`, `type Column`

**Step 1: Create useTests hook**

Manages test runs list, individual run results, run trigger, and fix trigger.

**Step 2: Build tests screen**

Per `docs/design/pages/cypress-testing.md`:

```tsx
import { useState } from 'react'
import { Play, TestTube2, Wrench } from 'lucide-react'
import {
  SegmentedControl,
  DataTable,
  StatusBadge,
  SplitPane,
  SplitPanePanel,
  SplitPaneHandle,
  Panel,
  Button,
  KVRow,
  EmptyState,
  Spinner,
  Progress,
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ScrollArea,
  Separator,
  type Column,
} from '@agent-coding/ui'

import { useTests } from '../hooks/use-tests'

type ViewTab = 'runs' | 'specs' | 'videos'

interface TestRun {
  id: string
  status: string
  total_tests: number | null
  passed: number | null
  failed: number | null
  duration_ms: number | null
}

interface TestResult {
  id: string
  test_name: string
  status: string
  duration_ms: number | null
  error_message: string | null
}

export function TestsScreen() {
  const { runs, results, loading, selectedRunId, selectRun, triggerRun, triggerFix } = useTests()
  const [view, setView] = useState<ViewTab>('runs')

  const selectedRun = runs.find((r) => r.id === selectedRunId)

  const runColumns: Column<TestRun>[] = [
    {
      key: 'status',
      header: 'Status',
      width: '100px',
      render: (r) => (
        <StatusBadge status={r.status as any} showDot>
          {r.status}
        </StatusBadge>
      ),
    },
    { key: 'total_tests', header: 'Tests', width: '60px', render: (r) => String(r.total_tests ?? 0) },
    {
      key: 'passed',
      header: 'Passed',
      width: '60px',
      render: (r) => <Badge variant="secondary" className="text-[var(--success)]">{r.passed ?? 0}</Badge>,
    },
    {
      key: 'failed',
      header: 'Failed',
      width: '60px',
      render: (r) => r.failed ? <Badge variant="destructive">{r.failed}</Badge> : <span className="text-muted-foreground">0</span>,
    },
    {
      key: 'duration_ms',
      header: 'Duration',
      width: '80px',
      render: (r) => r.duration_ms ? `${(r.duration_ms / 1000).toFixed(1)}s` : '-',
    },
  ]

  const resultColumns: Column<TestResult>[] = [
    { key: 'test_name', header: 'Test', render: (r) => <span className="font-mono text-[12px]">{r.test_name}</span> },
    {
      key: 'status',
      header: 'Status',
      width: '80px',
      render: (r) => <StatusBadge status={r.status as any}>{r.status}</StatusBadge>,
    },
    {
      key: 'duration_ms',
      header: 'Duration',
      width: '80px',
      render: (r) => r.duration_ms ? `${r.duration_ms}ms` : '-',
    },
    {
      key: 'actions',
      header: '',
      width: '80px',
      render: (r) => r.status === 'failed' ? (
        <Button variant="outline" size="xs" onClick={() => triggerFix(r.test_name, r.error_message ?? '')}>
          <Wrench size={12} /> Fix
        </Button>
      ) : null,
    },
  ]

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner label="Loading tests..." />
      </div>
    )
  }

  return (
    <SplitPane direction="horizontal">
      {/* Runs list */}
      <SplitPanePanel defaultSize={40} minSize={25}>
        <Panel>
          <Panel.Header>
            <Panel.Title>Test Runs</Panel.Title>
            <Panel.Actions>
              <Button size="xs" onClick={triggerRun}>
                <Play size={14} /> Run Tests
              </Button>
            </Panel.Actions>
          </Panel.Header>
          <div className="border-b border-border px-3 py-2">
            <SegmentedControl
              value={view}
              onValueChange={(v) => setView(v as ViewTab)}
              items={[
                { value: 'runs', label: 'All Runs' },
                { value: 'specs', label: 'Specs' },
                { value: 'videos', label: 'Videos' },
              ]}
              size="sm"
            />
          </div>
          <Panel.Content>
            <DataTable
              columns={runColumns}
              data={runs}
              rowKey={(r) => r.id}
              selectedKey={selectedRunId ?? undefined}
              onRowClick={(r) => selectRun(r.id)}
              emptyState={
                <EmptyState
                  icon={TestTube2}
                  title="No test runs"
                  description="Run your Cypress test suite to see results"
                  action={<Button size="sm" onClick={triggerRun}><Play size={14} /> Run Tests</Button>}
                />
              }
            />
          </Panel.Content>
        </Panel>
      </SplitPanePanel>

      <SplitPaneHandle />

      {/* Run detail */}
      <SplitPanePanel defaultSize={60}>
        <Panel>
          {selectedRun ? (
            <>
              <Panel.Header>
                <Panel.Title>
                  <StatusBadge status={selectedRun.status as any}>{selectedRun.status}</StatusBadge>
                </Panel.Title>
              </Panel.Header>
              <Panel.Content>
                <ScrollArea className="h-full">
                  <div className="space-y-4 p-4">
                    {/* Summary */}
                    <Card>
                      <CardContent className="pt-4">
                        <div className="space-y-1">
                          <KVRow label="Total Tests" value={String(selectedRun.total_tests ?? 0)} />
                          <Separator />
                          <KVRow label="Passed" value={<Badge variant="secondary" className="text-[var(--success)]">{selectedRun.passed ?? 0}</Badge>} />
                          <Separator />
                          <KVRow label="Failed" value={selectedRun.failed ? <Badge variant="destructive">{selectedRun.failed}</Badge> : '0'} />
                          <Separator />
                          <KVRow label="Duration" value={selectedRun.duration_ms ? `${(selectedRun.duration_ms / 1000).toFixed(1)}s` : '-'} />
                        </div>
                      </CardContent>
                    </Card>

                    {/* Results table */}
                    <h3 className="text-[13px] font-semibold text-foreground">Test Results</h3>
                    <DataTable
                      columns={resultColumns}
                      data={results}
                      rowKey={(r) => r.id}
                      emptyState={
                        <EmptyState title="No results" description="Test results will appear here when the run completes" />
                      }
                    />

                    {/* Video player (if available) */}
                    {view === 'videos' && (
                      <Card>
                        <CardHeader>
                          <CardTitle>Test Video</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <video
                            controls
                            className="w-full rounded-md border border-border"
                            src={`/api/test-videos/${selectedRun.id}`}
                          />
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </ScrollArea>
              </Panel.Content>
            </>
          ) : (
            <Panel.Content>
              <EmptyState
                icon={TestTube2}
                title="No run selected"
                description="Select a test run from the list to view details"
              />
            </Panel.Content>
          )}
        </Panel>
      </SplitPanePanel>
    </SplitPane>
  )
}
```

**Step 3: Commit**

```bash
git add apps/desktop/src/renderer/hooks/use-tests.ts apps/desktop/src/renderer/screens/tests.tsx
git commit -m "feat(desktop): build Cypress testing screen with @agent-coding/ui"
```
