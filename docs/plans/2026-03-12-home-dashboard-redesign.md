# Home Dashboard Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild the Home Dashboard screen to match the Stitch design in `.stitch/designs/home-dashboard.png` — new section headers with divider lines, redesigned attention/running cards, and a proper activity table.

**Architecture:** Pure presentational refactor of `apps/desktop/src/renderer/screens/home.tsx`. Extract three section components (NeedsAttentionSection, RunningNowSection, RecentActivitySection) plus a shared SectionDivider. All use existing `bento-cell`/`bento-grid-3` CSS classes and `StatusBadge` from `@agent-coding/ui`. Mock data stays in-place.

**Tech Stack:** React, TypeScript, Tailwind CSS v4, Lucide React icons, `@agent-coding/ui` (StatusBadge, ScrollArea, Table primitives)

**Design References:**
- Screenshot: `.stitch/designs/home-dashboard.png`
- HTML mockup: `.stitch/designs/home-dashboard.html`
- Design system: `docs/design/design-system.md`
- Components catalog: `docs/design/components.md`

---

## Token Mapping

| Stitch HTML | Project Equivalent |
|---|---|
| `bg-mac-bg` (#1e1e1e) | `bg-background` |
| `bg-mac-card` (#2a2a2c) | `bento-cell` class (uses `--surface-elevated`) |
| `border-mac-border` (#3a3a3c) | `border-border` |
| `text-primary` (#1085f9) | `text-primary` (maps to `--accent`) |
| `text-slate-100/200` | `text-foreground` |
| `text-slate-400/500` | `text-muted-foreground` |
| `bg-yellow-500/10 text-yellow-500` | `StatusBadge status="warning"` |
| `bg-red-500/10 text-red-500` | `StatusBadge status="failed"` |
| `bg-primary/10 text-primary` | `StatusBadge status="running"` |
| Material Symbols `sync` | Lucide `Loader2` (with `animate-spin`) |
| Material Symbols `add_circle` | Lucide `PlusCircle` |
| `font-mono text-[11px]` | `font-mono text-[11px]` (JetBrains Mono via `--font-mono`) |
| `rounded-xl` (CDN = 12px) | `bento-cell` class (uses `--bento-radius: 12px`) |
| `hover:bg-white/5` | `hover:bg-[var(--surface-hover)]` |

## Component Tree

```
HomeScreen
├── ScrollArea
│   ├── SectionDivider (title="Needs Attention")
│   ├── NeedsAttentionSection
│   │   └── bento-grid-3 → AttentionCard[] (bento-cell)
│   ├── SectionDivider (title="Running Now")
│   ├── RunningNowSection
│   │   ├── bento-grid-3 → RunningSessionCard[] (bento-cell, left accent bar)
│   │   └── NewSessionCard (dashed border placeholder)
│   ├── SectionDivider (title="Recent Activity")
│   └── RecentActivitySection
│       └── bento-cell (table wrapper) → Table rows
```

## Files

- **Modify:** `apps/desktop/src/renderer/screens/home.tsx` (complete rewrite of component internals)

No new files needed — all components stay in the screen file since they're screen-specific.

---

### Task 1: Replace SectionHeader with SectionDivider

Replace the current `SectionHeader` (icon + title + count) with the design's pattern: uppercase title + horizontal divider line.

**Files:**
- Modify: `apps/desktop/src/renderer/screens/home.tsx:28-42`

**Step 1: Replace the SectionHeader component**

Remove the old `SectionHeader` and replace with:

```tsx
function SectionDivider({ title }: Readonly<{ title: string }>) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <h2 className="section-header shrink-0">{title}</h2>
      <div className="h-px flex-1 bg-border/50" />
    </div>
  )
}
```

This uses the existing `.section-header` CSS class from `globals.css` (11px, 600 weight, uppercase, 0.06em tracking, muted-foreground).

**Step 2: Update all SectionHeader usages to SectionDivider**

Replace the three `<SectionHeader ... />` calls:
- `<SectionDivider title="Needs Attention" />`
- `<SectionDivider title="Running Now" />`
- `<SectionDivider title="Recent Activity" />`

Remove the `AlertCircle`, `Play`, `Clock` icon imports (no longer needed for headers).

**Step 3: Verify the app renders**

Run: `pnpm --filter my-electron-app dev`
Expected: Three sections visible with uppercase titles and horizontal lines.

**Step 4: Commit**

```bash
git add apps/desktop/src/renderer/screens/home.tsx
git commit -m "refactor(home): replace section headers with divider-line style"
```

---

### Task 2: Redesign Needs Attention Cards

Redesign the attention cards to match the Stitch mockup: mono ticket key badge (top-left), colored status pill (top-right), title, and project name.

**Files:**
- Modify: `apps/desktop/src/renderer/screens/home.tsx`

**Step 1: Update the mock data**

Keep existing `MOCK_NEEDS_ATTENTION` but ensure `status` values map to StatusBadge variants. Update:

```tsx
const MOCK_NEEDS_ATTENTION = [
  { id: 't-8', key: 'T-08', title: 'Login refactor needs review', status: 'warning' as const, statusLabel: 'Review Pending', project: 'WebManager', projectId: 'p1' },
  { id: 't-15', key: 'T-15', title: 'API endpoint tests failing', status: 'failed' as const, statusLabel: 'Agent Failed', project: 'ApiTool', projectId: 'p2' },
  { id: 't-21', key: 'T-21', title: 'Clarify auth flow requirements', status: 'running' as const, statusLabel: 'Needs Input', project: 'SuriCoder', projectId: 'p1' },
]
```

**Step 2: Rewrite the Needs Attention card markup**

```tsx
{/* Needs Attention */}
<section className="mb-10">
  <SectionDivider title="Needs Attention" />
  <div className="bento-grid-3">
    {MOCK_NEEDS_ATTENTION.map((item) => (
      <button
        key={item.id}
        type="button"
        onClick={() => navigateToTicket(item.projectId, item.id, item.key)}
        className="bento-cell cursor-pointer text-left flex flex-col gap-3"
      >
        <div className="flex items-start justify-between">
          <span className="font-mono text-[11px] text-muted-foreground bg-background px-2 py-0.5 rounded border border-border">
            {item.key}
          </span>
          <StatusBadge status={item.status} showDot={false}>
            {item.statusLabel}
          </StatusBadge>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground leading-snug">{item.title}</h3>
          <p className="text-xs text-muted-foreground mt-1">Project: {item.project}</p>
        </div>
      </button>
    ))}
  </div>
</section>
```

Key changes vs current:
- `flex-col gap-3` layout instead of tight spacing
- Mono ticket key as a bordered badge (bg-background, rounded, border)
- StatusBadge uses `children` (not the non-existent `label` prop), `showDot={false}`
- Title uses `text-foreground` and `leading-snug`
- "Project:" prefix on project name

**Step 3: Verify render**

Run: `pnpm --filter my-electron-app dev`
Expected: Three cards with ticket badge top-left, colored status pill top-right, title + project below.

**Step 4: Commit**

```bash
git add apps/desktop/src/renderer/screens/home.tsx
git commit -m "feat(home): redesign needs-attention cards to match Stitch mockup"
```

---

### Task 3: Redesign Running Now Section

This is the biggest visual change. Running cards get a left accent bar, spinner icon, session info, and action buttons. Plus a dashed "New Session" placeholder card.

**Files:**
- Modify: `apps/desktop/src/renderer/screens/home.tsx`

**Step 1: Update Running mock data**

```tsx
const MOCK_RUNNING = [
  { id: 't-14', key: 'T-14', title: 'Login Flow Implementation', step: 'Design', session: 2, duration: '12m', project: 'my-app', projectId: 'p1' },
  { id: 't-19', key: 'T-19', title: 'Dashboard Widgets', step: 'Implementation', session: 1, duration: '3m', project: 'api-srv', projectId: 'p2' },
]
```

**Step 2: Add Lucide imports**

Add to the import line:

```tsx
import { Loader2, PlusCircle, Square } from 'lucide-react'
```

- `Loader2` — spinning sync indicator
- `PlusCircle` — "New Session" card icon
- `Square` — STOP button icon (optional, or just use text)

**Step 3: Write the Running Now section**

```tsx
{/* Running Now */}
<section className="mb-10">
  <SectionDivider title="Running Now" />
  <div className="bento-grid-3">
    {MOCK_RUNNING.map((item) => (
      <div
        key={item.id}
        className="bento-cell relative overflow-hidden p-5"
      >
        {/* Left accent bar */}
        <div className="absolute top-0 left-0 w-1 h-full bg-primary" />

        <div className="flex items-center justify-between mb-4">
          <span className="font-mono text-[11px] text-muted-foreground">{item.key}</span>
          <div className="flex items-center gap-2">
            <Loader2 className="size-[18px] text-primary animate-spin" style={{ animationDuration: '3s' }} />
            <span className="text-[10px] font-bold text-muted-foreground uppercase">{item.step}</span>
          </div>
        </div>

        <h3 className="text-base font-semibold text-foreground mb-1">{item.title}</h3>
        <p className="text-xs text-muted-foreground">
          Session #{item.session} running for <span className="text-primary">{item.duration}</span>
        </p>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            className="bg-primary/10 hover:bg-primary/20 text-primary text-[11px] font-bold py-1 px-3 rounded-[6px] border border-primary/20 transition-colors duration-150 cursor-pointer"
          >
            STOP
          </button>
          <button
            type="button"
            onClick={() => navigateToTicket(item.projectId, item.id, item.key)}
            className="bg-muted/50 hover:bg-muted text-muted-foreground text-[11px] font-bold py-1 px-3 rounded-[6px] border border-border transition-colors duration-150 cursor-pointer"
          >
            DETAILS
          </button>
        </div>
      </div>
    ))}

    {/* New Session placeholder */}
    <button
      type="button"
      className="border border-dashed border-border rounded-[var(--bento-radius)] p-5 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground hover:border-muted-foreground cursor-pointer transition-colors duration-150"
    >
      <PlusCircle className="size-8" />
      <span className="text-xs font-medium">New Session</span>
    </button>
  </div>
</section>
```

Key design decisions:
- Left accent bar: `absolute w-1 h-full bg-primary` (matches design)
- Spinner: `Loader2` with `animate-spin` at 3s duration (slow, subtle)
- Action buttons: accent-tinted STOP, muted DETAILS, both 6px radius per design system
- New Session card: dashed border, centered icon + text, no background

**Step 4: Verify render**

Run: `pnpm --filter my-electron-app dev`
Expected: Two running cards with blue left bar + spinner + buttons, plus a dashed "New Session" card.

**Step 5: Commit**

```bash
git add apps/desktop/src/renderer/screens/home.tsx
git commit -m "feat(home): redesign running-now section with accent bars, spinners, and action buttons"
```

---

### Task 4: Redesign Recent Activity as Table

Replace the current button-list with a proper table using the `Table` primitives from `@agent-coding/ui`.

**Files:**
- Modify: `apps/desktop/src/renderer/screens/home.tsx`

**Step 1: Update imports**

Add Table imports:

```tsx
import { ScrollArea, StatusBadge, Table, TableBody, TableRow, TableCell } from '@agent-coding/ui'
```

**Step 2: Update mock data**

```tsx
const MOCK_ACTIVITY = [
  { id: '1', ticketKey: 'T-14', event: 'Design session #2 started', time: '2m ago', projectId: 'p1' },
  { id: '2', ticketKey: 'T-08', event: 'Review requested for auth-refactor-v2', time: '14m ago', projectId: 'p1', highlight: 'auth-refactor-v2' },
  { id: '3', ticketKey: 'T-15', event: 'Automated test agent failed on CI/CD Pipeline', time: '45m ago', projectId: 'p2', highlight: 'CI/CD Pipeline', highlightColor: 'destructive' as const },
  { id: '4', ticketKey: 'T-19', event: 'Task moved from Backlog to In Progress', time: '1h ago', projectId: 'p1' },
  { id: '5', ticketKey: 'T-05', event: 'Deployment successful to production-web-01', time: '3h ago', projectId: 'p1', highlight: 'production-web-01', highlightColor: 'success' as const },
  { id: '6', ticketKey: 'T-21', event: 'New comment from @alex_dev on requirements', time: '5h ago', projectId: 'p1' },
]
```

**Step 3: Write the Recent Activity section**

```tsx
{/* Recent Activity */}
<section>
  <SectionDivider title="Recent Activity" />
  <div className="bento-cell p-0 overflow-hidden">
    <Table>
      <TableBody>
        {MOCK_ACTIVITY.map((item) => (
          <TableRow
            key={item.id}
            className="cursor-pointer hover:bg-[var(--surface-hover)] transition-colors duration-150 border-border/50"
            onClick={() => navigateToTicket(item.projectId, item.id, item.ticketKey)}
          >
            <TableCell className="w-20 font-mono text-xs text-muted-foreground py-4 px-4">
              {item.ticketKey}
            </TableCell>
            <TableCell className="text-xs text-foreground py-4 px-4">
              {item.event}
            </TableCell>
            <TableCell className="text-right text-[11px] text-muted-foreground py-4 px-4">
              {item.time}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
</section>
```

Key: The table is wrapped in a `bento-cell p-0` to get the elevated surface + border + radius, but no padding (table handles its own).

**Step 4: Verify render**

Run: `pnpm --filter my-electron-app dev`
Expected: Activity section shows a clean table with mono ticket keys, descriptions, and right-aligned timestamps.

**Step 5: Commit**

```bash
git add apps/desktop/src/renderer/screens/home.tsx
git commit -m "feat(home): replace activity list with proper table layout"
```

---

### Task 5: Clean Up and Final Polish

Remove unused imports, fix spacing, verify the whole page.

**Files:**
- Modify: `apps/desktop/src/renderer/screens/home.tsx`

**Step 1: Clean up imports**

Final import block should be:

```tsx
import { Loader2, PlusCircle } from 'lucide-react'
import { ScrollArea, StatusBadge, Table, TableBody, TableRow, TableCell } from '@agent-coding/ui'
import { useProjectNavStore } from 'renderer/stores/use-project-nav-store'
import { useTabStore } from 'renderer/stores/use-tab-store'
```

Remove: `AlertCircle`, `Play`, `Clock` (no longer used).

**Step 2: Verify section spacing**

Both Needs Attention and Running Now sections use `mb-10` (matches design's generous spacing). Recent Activity has no bottom margin (last section).

**Step 3: Run typecheck**

Run: `pnpm --filter my-electron-app typecheck`
Expected: No new errors in `home.tsx`. (Pre-existing StatusBadge errors should be gone since we now use `children` correctly.)

**Step 4: Run lint**

Run: `pnpm --filter my-electron-app lint`
Expected: Clean or only pre-existing warnings.

**Step 5: Final commit**

```bash
git add apps/desktop/src/renderer/screens/home.tsx
git commit -m "chore(home): clean up imports and finalize dashboard redesign"
```

---

## Summary of Changes

| Before | After |
|--------|-------|
| Icon + title + count headers | Uppercase title + divider line |
| Compact attention cards | Mono key badge + status pill + title + project |
| Attention-style running cards | Accent bar + spinner + session info + STOP/DETAILS |
| No "new session" affordance | Dashed placeholder card with PlusCircle |
| Button-based activity list | Proper Table with 3 columns |
| `StatusBadge label=` (wrong prop) | `StatusBadge children=` (correct API) |
