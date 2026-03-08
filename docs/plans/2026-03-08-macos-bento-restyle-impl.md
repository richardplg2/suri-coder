# macOS Bento Grid Restyle — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restyle every screen in the desktop app with Apple-style bento grid layouts, frosted glass chrome, and proper visual hierarchy.

**Architecture:** Three layers: (1) CSS tokens + utility classes in globals, (2) glass chrome on app shell (toolbar/sidebar/statusbar), (3) bento grid layouts on every screen. All changes are visual — no business logic, no API changes, no new dependencies.

**Tech Stack:** React 19, Tailwind CSS v4, CSS custom properties, `backdrop-filter` for vibrancy.

**Reference:** `docs/design/design-system.md` for all tokens and anti-patterns.

---

## Task 1: Add Bento Grid & Glass CSS Tokens

**Files:**
- Modify: `packages/ui/src/globals.css`
- Modify: `apps/desktop/src/renderer/globals.css`

**Step 1: Add new CSS variables to `packages/ui/src/globals.css`**

After `--warning: #FFCC00;` (line 31) in `:root`, add:

```css
  /* Glass / Vibrancy */
  --glass-bg: rgba(255, 255, 255, 0.72);
  --glass-border: rgba(255, 255, 255, 0.2);
  --glass-blur: 20px;

  /* Elevated surface */
  --surface-elevated: #FFFFFF;
  --surface-elevated-hover: #FAFAFA;

  /* Bento grid */
  --bento-gap: 12px;
  --bento-radius: 12px;
  --bento-radius-lg: 16px;
```

After `--warning: #FFD60A;` (line 101) in `.dark`, add:

```css
  /* Glass / Vibrancy — dark */
  --glass-bg: rgba(30, 30, 30, 0.72);
  --glass-border: rgba(255, 255, 255, 0.08);
  --glass-blur: 20px;

  /* Elevated surface — dark */
  --surface-elevated: #2A2A2C;
  --surface-elevated-hover: #323234;

  /* Bento grid (same values) */
  --bento-gap: 12px;
  --bento-radius: 12px;
  --bento-radius-lg: 16px;
```

**Step 2: Add Tailwind theme extensions to `apps/desktop/src/renderer/globals.css`**

Inside `@theme inline` block, after the `--color-sidebar-ring` line, add:

```css
  --color-surface-elevated: var(--surface-elevated);
  --color-surface-elevated-hover: var(--surface-elevated-hover);
  --color-glass-bg: var(--glass-bg);
  --color-glass-border: var(--glass-border);
```

**Step 3: Add utility classes to `apps/desktop/src/renderer/globals.css`**

Inside `@layer utilities`, after the `.text-caption` block, add:

```css
  /* Bento grid layouts */
  .bento-grid {
    display: grid;
    gap: var(--bento-gap);
  }

  .bento-grid-2 {
    display: grid;
    gap: var(--bento-gap);
    grid-template-columns: repeat(2, 1fr);
  }

  .bento-grid-3 {
    display: grid;
    gap: var(--bento-gap);
    grid-template-columns: repeat(3, 1fr);
  }

  .bento-grid-4 {
    display: grid;
    gap: var(--bento-gap);
    grid-template-columns: repeat(4, 1fr);
  }

  .bento-span-2 {
    grid-column: span 2;
  }

  .bento-span-row-2 {
    grid-row: span 2;
  }

  /* Bento cell base */
  .bento-cell {
    border-radius: var(--bento-radius);
    background: var(--surface-elevated);
    border: 1px solid var(--border);
    padding: var(--space-4);
    transition: box-shadow 150ms ease;
  }

  .bento-cell:hover {
    box-shadow: var(--shadow-md);
  }

  .bento-cell-lg {
    border-radius: var(--bento-radius-lg);
    background: var(--surface-elevated);
    border: 1px solid var(--border);
    padding: var(--space-6);
    transition: box-shadow 150ms ease;
  }

  .bento-cell-lg:hover {
    box-shadow: var(--shadow-md);
  }

  /* Glass panel for chrome elements */
  .glass-panel {
    background: var(--glass-bg);
    backdrop-filter: blur(var(--glass-blur));
    -webkit-backdrop-filter: blur(var(--glass-blur));
    border-color: var(--glass-border);
  }
```

**Step 4: Verify build**

Run: `pnpm --filter my-electron-app build`
Expected: Build succeeds.

**Step 5: Commit**

```bash
git add packages/ui/src/globals.css apps/desktop/src/renderer/globals.css
git commit -m "feat(ui): add bento grid and glass vibrancy design tokens"
```

---

## Task 2: Glass Chrome — Toolbar, Sidebar, Status Bar

**Files:**
- Modify: `apps/desktop/src/renderer/components/app-layout.tsx:42`
- Modify: `apps/desktop/src/renderer/components/app-sidebar.tsx:13-24`
- Modify: `apps/desktop/src/renderer/components/status-bar.tsx:29`

**Step 1: Restyle toolbar in `app-layout.tsx`**

Line 42, change:
```tsx
<div className="flex h-9 shrink-0 items-center border-b border-border bg-card/80 backdrop-blur-xl app-drag">
```
To:
```tsx
<div className="flex h-9 shrink-0 items-center border-b border-border/50 glass-panel app-drag">
```

**Step 2: Restyle sidebar in `app-sidebar.tsx`**

Replace lines 13-24 (the entire `<aside>` opening):
```tsx
    <aside
      className={cn(
        'shrink-0 border-r border-border transition-[width] duration-200 ease-out',
        isOpen ? 'w-60' : 'w-0 overflow-hidden'
      )}
      style={{
        background: 'var(--sidebar-bg)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
```
With:
```tsx
    <aside
      className={cn(
        'shrink-0 border-r border-border/50 glass-panel transition-[width] duration-200 ease-out',
        isOpen ? 'w-60' : 'w-0 overflow-hidden'
      )}
    >
```

**Step 3: Restyle status bar in `status-bar.tsx`**

Line 29, change:
```tsx
<div className="flex h-7 shrink-0 items-center justify-between border-t border-border bg-card/50 px-3 text-caption text-muted-foreground">
```
To:
```tsx
<div className="flex h-7 shrink-0 items-center justify-between border-t border-border/50 glass-panel px-3 text-caption text-muted-foreground">
```

**Step 4: Verify dev mode**

Run: `pnpm --filter my-electron-app dev`
Expected: All three chrome elements show frosted glass.

**Step 5: Commit**

```bash
git add apps/desktop/src/renderer/components/app-layout.tsx apps/desktop/src/renderer/components/app-sidebar.tsx apps/desktop/src/renderer/components/status-bar.tsx
git commit -m "feat(desktop): apply glass vibrancy to app shell chrome"
```

---

## Task 3: Home Screen — Bento Grid Projects

**Files:**
- Modify: `apps/desktop/src/renderer/screens/home.tsx`
- Modify: `apps/desktop/src/renderer/components/project-card.tsx`

**Step 1: Restyle home screen layout in `home.tsx`**

Replace lines 26-28 (header):
```tsx
        <div className="mb-6 flex items-center justify-between">
          <h1 className="window-title">Projects</h1>
```
With:
```tsx
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-lg font-semibold tracking-tight">Projects</h1>
```

Replace line 49 (grid):
```tsx
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
```
With:
```tsx
          <div className="bento-grid-3">
```

**Step 2: Restyle `ProjectCard` in `project-card.tsx`**

Replace lines 22-25 (Card opening):
```tsx
    <Card
      className="cursor-pointer rounded-[var(--radius-card)] transition-all duration-150 hover:bg-secondary/50 hover:shadow-[var(--shadow-sm)]"
      onClick={onClick}
    >
```
With:
```tsx
    <Card
      className="bento-cell cursor-pointer transition-all duration-150"
      onClick={onClick}
    >
```

Replace line 29 (title):
```tsx
          <CardTitle className="text-[13px] font-medium">{project.name}</CardTitle>
```
With:
```tsx
          <CardTitle className="text-sm font-semibold tracking-tight">{project.name}</CardTitle>
```

**Step 3: Commit**

```bash
git add apps/desktop/src/renderer/screens/home.tsx apps/desktop/src/renderer/components/project-card.tsx
git commit -m "feat(desktop): restyle home screen with bento grid project cards"
```

---

## Task 4: Tickets Board — Bento Kanban Cards

**Files:**
- Modify: `apps/desktop/src/renderer/screens/project/tickets-board.tsx`

**Step 1: Restyle toolbar**

Line 59, change:
```tsx
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border px-4">
        <div className="window-title">Tickets</div>
```
To:
```tsx
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border/50 px-4">
        <div className="text-sm font-semibold tracking-tight">Tickets</div>
```

**Step 2: Restyle kanban column header**

Lines 124-129, change:
```tsx
            <div className="mb-2 flex items-center gap-2">
              <span className="section-header">
                {col.label}
              </span>
              <span className="text-caption text-muted-foreground">{colTickets.length}</span>
            </div>
```
To:
```tsx
            <div className="mb-3 flex items-center gap-2 px-1">
              <span className="section-header">
                {col.label}
              </span>
              <span className="flex size-5 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground">
                {colTickets.length}
              </span>
            </div>
```

**Step 3: Restyle ticket card**

Line 151, change:
```tsx
      className="w-full cursor-pointer rounded-[var(--radius-card)] border border-border bg-card p-3 text-left transition-all duration-150 hover:bg-secondary/50 hover:shadow-[var(--shadow-sm)]"
```
To:
```tsx
      className="bento-cell w-full cursor-pointer p-3 text-left"
```

**Step 4: Commit**

```bash
git add apps/desktop/src/renderer/screens/project/tickets-board.tsx
git commit -m "feat(desktop): restyle tickets board with bento kanban cards"
```

---

## Task 5: Ticket Detail — Header & Tabs

**Files:**
- Modify: `apps/desktop/src/renderer/screens/ticket.tsx`

**Step 1: Restyle header and tab borders**

Line 50, change:
```tsx
      <div className="border-b border-border p-4">
```
To:
```tsx
      <div className="border-b border-border/50 p-4 pb-3">
```

Line 60, change:
```tsx
        <h2 className="text-base font-semibold">{ticket.title}</h2>
```
To:
```tsx
        <h2 className="text-base font-semibold tracking-tight">{ticket.title}</h2>
```

Line 64, change:
```tsx
      <div className="border-b border-border px-4 py-2">
```
To:
```tsx
      <div className="border-b border-border/50 px-4 py-2">
```

**Step 2: Commit**

```bash
git add apps/desktop/src/renderer/screens/ticket.tsx
git commit -m "feat(desktop): restyle ticket detail header with subtle borders"
```

---

## Task 6: Ticket Overview Tab — Bento Grid Layout

**Files:**
- Modify: `apps/desktop/src/renderer/components/ticket-detail/overview-tab.tsx`

**Step 1: Restructure to bento grid**

Replace the entire return statement (lines 26-99):
```tsx
  return (
    <ScrollArea className="h-full">
      <div className="max-w-2xl space-y-6 p-4">
        {/* Description */}
        <div>
          <label className="section-header mb-2 block">Description</label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="Describe the ticket..."
          />
        </div>

        <Separator />

        {/* Settings */}
        <div>
          <h3 className="section-header mb-3">Settings</h3>
          <div className="space-y-3">
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={autoExecute}
                onChange={(e) => setAutoExecute(e.target.checked)}
                className="accent-primary"
              />
              <Zap className="size-4 text-yellow-400" />
              <div>
                <div className="text-[13px] font-medium">Auto Execute</div>
                <div className="text-caption text-muted-foreground">Automatically run steps when ready</div>
              </div>
            </label>
          </div>
        </div>

        <Separator />

        {/* Budget */}
        <div>
          <h3 className="section-header mb-3">Budget</h3>
          <div className="flex items-center gap-2">
            <DollarSign className="size-4 text-muted-foreground" />
            <Input
              type="number"
              value={budgetUsd}
              onChange={(e) => setBudgetUsd(e.target.value)}
              placeholder="0.00"
              className="w-32"
            />
            <span className="text-caption text-muted-foreground">USD</span>
          </div>
        </div>

        <Separator />

        {/* Metadata */}
        <div>
          <h3 className="section-header mb-3">Details</h3>
          <div className="space-y-1">
            <KVRow label="Type" value={ticket.type} />
            <KVRow label="Priority" value={ticket.priority} />
            <KVRow label="Status" value={ticket.status.replace('_', ' ')} />
            <KVRow label="Created" value={new Date(ticket.created_at).toLocaleDateString()} />
          </div>
        </div>

        <Button onClick={handleSave} disabled={updateTicket.isPending}>
          <Save className="mr-1.5 size-3.5" />
          Save Changes
        </Button>
      </div>
    </ScrollArea>
  )
```

With:
```tsx
  return (
    <ScrollArea className="h-full">
      <div className="p-4">
        <div className="bento-grid-3">
          {/* Description — spans 2 columns */}
          <div className="bento-cell-lg bento-span-2">
            <label className="section-header mb-2 block">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Describe the ticket..."
            />
          </div>

          {/* Details — right column, spans 2 rows */}
          <div className="bento-cell bento-span-row-2">
            <h3 className="section-header mb-3">Details</h3>
            <div className="space-y-1">
              <KVRow label="Type" value={ticket.type} />
              <KVRow label="Priority" value={ticket.priority} />
              <KVRow label="Status" value={ticket.status.replace('_', ' ')} />
              <KVRow label="Created" value={new Date(ticket.created_at).toLocaleDateString()} />
            </div>
          </div>

          {/* Settings */}
          <div className="bento-cell">
            <h3 className="section-header mb-3">Settings</h3>
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={autoExecute}
                onChange={(e) => setAutoExecute(e.target.checked)}
                className="accent-primary"
              />
              <Zap className="size-4 text-yellow-400" />
              <div>
                <div className="text-[13px] font-medium">Auto Execute</div>
                <div className="text-caption text-muted-foreground">Run steps automatically</div>
              </div>
            </label>
          </div>

          {/* Budget */}
          <div className="bento-cell">
            <h3 className="section-header mb-3">Budget</h3>
            <div className="flex items-center gap-2">
              <DollarSign className="size-4 text-muted-foreground" />
              <Input
                type="number"
                value={budgetUsd}
                onChange={(e) => setBudgetUsd(e.target.value)}
                placeholder="0.00"
                className="w-32"
              />
              <span className="text-caption text-muted-foreground">USD</span>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <Button onClick={handleSave} disabled={updateTicket.isPending}>
            <Save className="mr-1.5 size-3.5" />
            Save Changes
          </Button>
        </div>
      </div>
    </ScrollArea>
  )
```

Also remove the `Separator` import since it's no longer used. Line 2, change:
```tsx
import { ScrollArea, Button, Input, Textarea, Separator, KVRow } from '@agent-coding/ui'
```
To:
```tsx
import { ScrollArea, Button, Input, Textarea, KVRow } from '@agent-coding/ui'
```

**Step 2: Commit**

```bash
git add apps/desktop/src/renderer/components/ticket-detail/overview-tab.tsx
git commit -m "feat(desktop): restyle ticket overview tab with bento grid layout"
```

---

## Task 7: Ticket Tasks Tab — Bento DAG & Step List

**Files:**
- Modify: `apps/desktop/src/renderer/components/ticket-detail/tasks-tab.tsx`

**Step 1: Restyle DAG container and step list**

Line 68, change:
```tsx
          <div className="section-header mb-2">Workflow</div>
```
To:
```tsx
          <div className="section-header mb-3">Workflow</div>
```

Lines 67-69 (the DAG wrapper div), change:
```tsx
        <div className="mb-4">
          <div className="section-header mb-3">Workflow</div>
          <WorkflowDAG steps={ticket.steps} selectedStepId={selectedStepId ?? undefined} onSelectStep={setSelectedStepId} />
        </div>
```
To:
```tsx
        <div className="bento-cell-lg mb-4">
          <div className="section-header mb-3">Workflow</div>
          <WorkflowDAG steps={ticket.steps} selectedStepId={selectedStepId ?? undefined} onSelectStep={setSelectedStepId} />
        </div>
```

Line 87, change the step button:
```tsx
                className={`flex w-full cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-left ${
                  selectedStepId === step.id ? 'border-primary bg-[var(--selection)]' : 'border-border bg-card'
                }`}
```
To:
```tsx
                className={`bento-cell flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left ${
                  selectedStepId === step.id ? 'border-primary bg-[var(--selection)]' : ''
                }`}
```

Line 115, change the live output container:
```tsx
                <div className="mt-2 max-h-48 overflow-y-auto rounded border border-border bg-background p-2 font-mono text-[11px]">
```
To:
```tsx
                <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-border/50 bg-background p-2 font-mono text-[11px]">
```

Lines 127-128, change the review panel header:
```tsx
          <div className="flex items-center justify-between border-b border-border bg-card px-4 py-1.5">
```
To:
```tsx
          <div className="flex items-center justify-between border-b border-border/50 glass-panel px-4 py-1.5">
```

**Step 2: Commit**

```bash
git add apps/desktop/src/renderer/components/ticket-detail/tasks-tab.tsx
git commit -m "feat(desktop): restyle tasks tab with bento DAG and step cards"
```

---

## Task 8: Ticket Specs Tab — Bento Spec Cards

**Files:**
- Modify: `apps/desktop/src/renderer/components/ticket-detail/specs-tab.tsx`

**Step 1: Restyle spec rows**

Line 117, change:
```tsx
    <div className="rounded-lg border border-border bg-card">
```
To:
```tsx
    <div className="bento-cell p-0">
```

Line 136, change the expanded content border:
```tsx
        <div className="border-t border-border px-4 py-3">
```
To:
```tsx
        <div className="border-t border-border/50 px-4 py-3">
```

Line 35, change the history revision card:
```tsx
            <div key={rev.id} className="rounded border border-border p-3">
```
To:
```tsx
            <div key={rev.id} className="bento-cell p-3">
```

**Step 2: Commit**

```bash
git add apps/desktop/src/renderer/components/ticket-detail/specs-tab.tsx
git commit -m "feat(desktop): restyle specs tab with bento spec cards"
```

---

## Task 9: Ticket Activity Tab — Bento Event Cards

**Files:**
- Modify: `apps/desktop/src/renderer/components/ticket-detail/activity-tab.tsx`

**Step 1: Wrap each event in bento styling**

Lines 70-79, change:
```tsx
            <div key={evt.id} className="flex items-start gap-3">
              <Icon className="mt-0.5 size-4 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-[13px]">{evt.description}</p>
                <span className="text-caption text-muted-foreground">
                  {new Date(evt.timestamp).toLocaleString()}
                </span>
              </div>
            </div>
```
To:
```tsx
            <div key={evt.id} className="bento-cell flex items-start gap-3 p-3">
              <Icon className="mt-0.5 size-4 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-[13px]">{evt.description}</p>
                <span className="text-caption text-muted-foreground">
                  {new Date(evt.timestamp).toLocaleString()}
                </span>
              </div>
            </div>
```

**Step 2: Commit**

```bash
git add apps/desktop/src/renderer/components/ticket-detail/activity-tab.tsx
git commit -m "feat(desktop): restyle activity tab with bento event cards"
```

---

## Task 10: Brainstorm Screen — Glass Input & Bento Summary

**Files:**
- Modify: `apps/desktop/src/renderer/screens/brainstorm.tsx`

**Step 1: Restyle input bar**

Line 185, change:
```tsx
      <div className="border-t border-border p-4">
```
To:
```tsx
      <div className="border-t border-border/50 glass-panel p-4">
```

**Step 2: Restyle summary card**

Line 151, change:
```tsx
                <div key={msg.id} className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4">
```
To:
```tsx
                <div key={msg.id} className="bento-cell-lg border-primary/20 bg-primary/5">
```

**Step 3: Restyle error state**

Lines 122-128, change:
```tsx
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <p className="text-[13px] text-destructive">{error}</p>
        <Button size="sm" variant="outline" onClick={() => { setError(null); window.location.reload() }}>
          Retry
        </Button>
      </div>
```
To:
```tsx
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <div className="bento-cell max-w-sm text-center">
          <p className="text-[13px] text-destructive mb-3">{error}</p>
          <Button size="sm" variant="outline" onClick={() => { setError(null); window.location.reload() }}>
            Retry
          </Button>
        </div>
      </div>
```

**Step 4: Commit**

```bash
git add apps/desktop/src/renderer/screens/brainstorm.tsx
git commit -m "feat(desktop): restyle brainstorm with glass input bar and bento cards"
```

---

## Task 11: Brainstorm Review — Glass Panels & Bento Comments

**Files:**
- Modify: `apps/desktop/src/renderer/components/brainstorm/brainstorm-review.tsx`

**Step 1: Restyle header**

Line 92, change:
```tsx
      <div className="border-b border-border p-4">
```
To:
```tsx
      <div className="border-b border-border/50 p-4">
```

Line 93, change:
```tsx
        <h2 className="text-base font-semibold">Review Brainstorm Output</h2>
```
To:
```tsx
        <h2 className="text-base font-semibold tracking-tight">Review Brainstorm Output</h2>
```

**Step 2: Restyle inline comment input**

Line 109, change:
```tsx
            <div className="mx-4 mb-4 flex items-center gap-2 rounded-lg border border-border bg-card p-3">
```
To:
```tsx
            <div className="mx-4 mb-4 flex items-center gap-2 bento-cell p-3">
```

**Step 3: Restyle comment sidebar**

Line 130, change:
```tsx
        <div className="w-72 border-l border-border">
```
To:
```tsx
        <div className="w-72 border-l border-border/50 glass-panel">
```

Line 135, change each comment card:
```tsx
                <div key={comment.id} className="rounded-lg border border-border bg-card p-3">
```
To:
```tsx
                <div key={comment.id} className="bento-cell p-3">
```

**Step 4: Restyle action bar**

Line 156, change:
```tsx
      <div className="border-t border-border p-4">
```
To:
```tsx
      <div className="border-t border-border/50 glass-panel p-4">
```

**Step 5: Commit**

```bash
git add apps/desktop/src/renderer/components/brainstorm/brainstorm-review.tsx
git commit -m "feat(desktop): restyle brainstorm review with glass panels and bento comments"
```

---

## Task 12: Figma Integration — Glass Chrome & Bento Annotations

**Files:**
- Modify: `apps/desktop/src/renderer/screens/figma-import.tsx`
- Modify: `apps/desktop/src/renderer/components/figma/figma-viewer.tsx`

**Step 1: Restyle figma-import bottom bar**

Line 66, change:
```tsx
      <div className="border-t border-border p-4">
```
To:
```tsx
      <div className="border-t border-border/50 glass-panel p-4">
```

**Step 2: Restyle figma-viewer connection bar**

Line 134, change:
```tsx
      <div className="flex items-center gap-3 border-b border-border px-4 py-2">
```
To:
```tsx
      <div className="flex items-center gap-3 border-b border-border/50 glass-panel px-4 py-2">
```

**Step 3: Restyle empty state**

Lines 228-239, change:
```tsx
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
          {isLoading ? (
            <Spinner label="Loading design..." />
          ) : (
            <>
              <div className="text-[14px]">Connect to Figma and load a design</div>
              <p className="text-caption max-w-sm text-center">
                Enter the channel ID from the Figma plugin, click Connect, select a frame in Figma, then click Load
                Design.
              </p>
            </>
          )}
        </div>
```
To:
```tsx
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-muted-foreground">
          {isLoading ? (
            <Spinner label="Loading design..." />
          ) : (
            <div className="bento-cell-lg max-w-md text-center">
              <div className="text-sm font-semibold tracking-tight mb-2">Connect to Figma and load a design</div>
              <p className="text-caption">
                Enter the channel ID from the Figma plugin, click Connect, select a frame in Figma, then click Load
                Design.
              </p>
            </div>
          )}
        </div>
```

**Step 4: Commit**

```bash
git add apps/desktop/src/renderer/screens/figma-import.tsx apps/desktop/src/renderer/components/figma/figma-viewer.tsx
git commit -m "feat(desktop): restyle figma integration with glass chrome"
```

---

## Task 13: Project Settings — Bento Grid Form

**Files:**
- Modify: `apps/desktop/src/renderer/screens/project/project-settings.tsx`

**Step 1: Restructure to bento grid**

Replace lines 51-103 (the entire return):
```tsx
  return (
    <ScrollArea className="h-full">
      <div className="mx-auto max-w-lg p-6 space-y-6">
        <h2 className="text-base font-semibold">Project Settings</h2>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-label">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-label">Slug</Label>
            <Input value={project.slug} disabled className="opacity-60" />
            <p className="text-caption text-muted-foreground">Slug cannot be changed after creation.</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-label">Path</Label>
            <Input value={path} onChange={(e) => setPath(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-label">Repo URL</Label>
            <Input value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-label">Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>

          {error && <p className="text-[13px] text-destructive">{error}</p>}
          {saved && <p className="text-[13px] text-[var(--success)]">Changes saved.</p>}
          <Button onClick={handleSave} disabled={!isDirty || updateProject.isPending}>
            Save Changes
          </Button>
        </div>

        <Separator />

        <div className="space-y-3">
          <h3 className="text-[13px] font-semibold text-destructive">Danger Zone</h3>
          <p className="text-caption text-muted-foreground">
            Deleting this project will remove all tickets, workflows, and sessions.
          </p>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => open('delete-project', { projectId: project.id, projectName: project.name })}
          >
            Delete Project
          </Button>
        </div>
      </div>
    </ScrollArea>
  )
```

With:
```tsx
  return (
    <ScrollArea className="h-full">
      <div className="p-6">
        <h2 className="text-lg font-semibold tracking-tight mb-6">Project Settings</h2>

        <div className="bento-grid-2">
          {/* General Info */}
          <div className="bento-cell-lg space-y-4">
            <h3 className="section-header">General</h3>
            <div className="space-y-1.5">
              <Label className="text-label">Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-label">Slug</Label>
              <Input value={project.slug} disabled className="opacity-60" />
              <p className="text-caption text-muted-foreground">Cannot be changed after creation.</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-label">Path</Label>
              <Input value={path} onChange={(e) => setPath(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-label">Repo URL</Label>
              <Input value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-label">Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
            </div>

            {error && <p className="text-[13px] text-destructive">{error}</p>}
            {saved && <p className="text-[13px] text-[var(--success)]">Changes saved.</p>}
            <Button onClick={handleSave} disabled={!isDirty || updateProject.isPending}>
              Save Changes
            </Button>
          </div>

          {/* Danger Zone */}
          <div className="bento-cell border-destructive/30">
            <h3 className="section-header text-destructive mb-3">Danger Zone</h3>
            <p className="text-caption text-muted-foreground mb-3">
              Deleting this project will remove all tickets, workflows, and sessions.
            </p>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => open('delete-project', { projectId: project.id, projectName: project.name })}
            >
              Delete Project
            </Button>
          </div>
        </div>
      </div>
    </ScrollArea>
  )
```

Also remove `Separator` from imports. Line 2, change:
```tsx
import { Button, Input, Label, Textarea, Separator, ScrollArea } from '@agent-coding/ui'
```
To:
```tsx
import { Button, Input, Label, Textarea, ScrollArea } from '@agent-coding/ui'
```

**Step 2: Commit**

```bash
git add apps/desktop/src/renderer/screens/project/project-settings.tsx
git commit -m "feat(desktop): restyle project settings with bento grid layout"
```

---

## Task 14: Project Repositories — Bento Grid

**Files:**
- Modify: `apps/desktop/src/renderer/screens/project/project-repositories.tsx`

**Step 1: Restyle header and grid**

Line 27, change:
```tsx
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Repositories</h2>
```
To:
```tsx
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Repositories</h2>
```

Line 26, change:
```tsx
      <div className="mx-auto max-w-lg p-6 space-y-6">
```
To:
```tsx
      <div className="p-6 space-y-6">
```

Lines 53-54, change repo list container:
```tsx
          <div className="space-y-2">
            {repos.map((repo) => (
              <div
                key={repo.id}
                className="flex items-center justify-between rounded-lg border px-4 py-3"
              >
```
To:
```tsx
          <div className="bento-grid-2">
            {repos.map((repo) => (
              <div
                key={repo.id}
                className="bento-cell flex items-center justify-between"
              >
```

**Step 2: Commit**

```bash
git add apps/desktop/src/renderer/screens/project/project-repositories.tsx
git commit -m "feat(desktop): restyle repositories with bento grid"
```

---

## Task 15: Project Agents — Bento Grid

**Files:**
- Modify: `apps/desktop/src/renderer/screens/project/project-agents.tsx`

**Step 1: Restyle header**

Line 44, change:
```tsx
            <h2 className="text-base font-semibold">Agent Configurations</h2>
```
To:
```tsx
            <h2 className="text-lg font-semibold tracking-tight">Agent Configurations</h2>
```

**Step 2: Restyle grid and cards**

Line 59, change:
```tsx
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="rounded-lg border bg-card p-4 space-y-3"
            >
```
To:
```tsx
        <div className="bento-grid-3">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="bento-cell space-y-3"
            >
```

**Step 3: Commit**

```bash
git add apps/desktop/src/renderer/screens/project/project-agents.tsx
git commit -m "feat(desktop): restyle agents with bento grid cards"
```

---

## Task 16: GitHub Accounts — Bento Grid

**Files:**
- Modify: `apps/desktop/src/renderer/screens/settings/github-accounts.tsx`

**Step 1: Restyle layout**

Line 34, change:
```tsx
      <div className="mx-auto max-w-lg p-6 space-y-6">
```
To:
```tsx
      <div className="p-6 space-y-6">
```

Line 36, change:
```tsx
          <h2 className="text-base font-semibold">GitHub Accounts</h2>
```
To:
```tsx
          <h2 className="text-lg font-semibold tracking-tight">GitHub Accounts</h2>
```

**Step 2: Restyle account cards**

Lines 55-59, change:
```tsx
          <div className="space-y-2">
            {accounts.map((account) => (
              <div
                key={account.id}
                className="flex items-center justify-between rounded-lg border px-4 py-3"
              >
```
To:
```tsx
          <div className="bento-grid-2">
            {accounts.map((account) => (
              <div
                key={account.id}
                className="bento-cell flex items-center justify-between"
              >
```

**Step 3: Commit**

```bash
git add apps/desktop/src/renderer/screens/settings/github-accounts.tsx
git commit -m "feat(desktop): restyle GitHub accounts with bento grid"
```

---

## Task 17: Review Panel — Glass Action Bar

**Files:**
- Modify: `apps/desktop/src/renderer/components/review/review-panel.tsx`

**Step 1: No structural changes needed** — the review panel uses `SplitPane` which is already correct for its Xcode-style layout. Just verify that the `ReviewActionBar` gets glass treatment.

Read `apps/desktop/src/renderer/components/review/review-action-bar.tsx` and update its container border:

Change any `border-t border-border` to `border-t border-border/50 glass-panel`.

**Step 2: Commit**

```bash
git add apps/desktop/src/renderer/components/review/review-action-bar.tsx
git commit -m "feat(desktop): restyle review action bar with glass panel"
```

---

## Task 18: Final Build Verification

**Step 1: Run lint**

Run: `pnpm lint`
Expected: No new errors (warnings about unused imports are fine to fix).

**Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: No errors.

**Step 3: Run build**

Run: `pnpm build`
Expected: Build succeeds.

**Step 4: Visual QA in dev mode**

Run: `pnpm --filter my-electron-app dev`

Checklist:
- [ ] Toolbar: glass effect visible
- [ ] Sidebar: glass effect visible
- [ ] Status bar: glass effect visible
- [ ] Home: 3-col bento grid with elevated cards
- [ ] Tickets board: bento kanban cards, pill counters
- [ ] Ticket overview: 3-col bento grid (description span-2, details span-row-2)
- [ ] Ticket tasks: bento DAG container, bento step cards
- [ ] Ticket specs: bento spec cards
- [ ] Ticket activity: bento event cards
- [ ] Brainstorm chat: glass input bar
- [ ] Brainstorm review: glass sidebar, bento comments
- [ ] Figma: glass connection bar, bento empty state
- [ ] Settings: bento-grid-2 form
- [ ] Repos: bento-grid-2 cards
- [ ] Agents: bento-grid-3 cards
- [ ] GitHub: bento-grid-2 cards
- [ ] Dark mode: all effects work
- [ ] Light mode: sufficient contrast

**Step 5: Final commit (if any fixes needed)**

```bash
git commit -m "feat(desktop): complete macOS bento grid restyle"
```

---

## Summary

| Task | Screen/Component | Key Changes |
|------|-----------------|-------------|
| 1 | CSS tokens | `glass-*`, `surface-elevated`, `bento-*` variables + utility classes |
| 2 | App shell | Glass toolbar, sidebar, status bar |
| 3 | Home | `bento-grid-3`, `bento-cell` project cards |
| 4 | Tickets board | Bento kanban cards, pill counters |
| 5 | Ticket header | Subtle borders, tracking-tight |
| 6 | Overview tab | `bento-grid-3` with span-2 description, span-row-2 details |
| 7 | Tasks tab | Bento DAG container, bento step cards |
| 8 | Specs tab | Bento spec cards |
| 9 | Activity tab | Bento event cards |
| 10 | Brainstorm | Glass input bar, bento summary |
| 11 | Brainstorm review | Glass sidebar/action bar, bento comments |
| 12 | Figma | Glass connection/description bars, bento empty state |
| 13 | Project settings | `bento-grid-2` form + danger zone |
| 14 | Repositories | `bento-grid-2` repo cards |
| 15 | Agents | `bento-grid-3` agent cards |
| 16 | GitHub accounts | `bento-grid-2` account cards |
| 17 | Review panel | Glass action bar |
| 18 | Final QA | Lint, typecheck, build, visual |

**Total: 18 tasks, ~20 files**
