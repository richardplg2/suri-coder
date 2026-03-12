# Kanban Board Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the kanban board cards and layout to match the Stitch mockup — priority dots, enhanced card states (done/in-progress/critical), mono ticket keys, and refined spacing.

**Architecture:** Pure UI changes to `tickets-board.tsx`. No new components or API changes needed. Update card styling, column spacing, and add visual status indicators using Lucide icons and design system CSS variables.

**Tech Stack:** React, Tailwind CSS, Lucide React icons, existing `@agent-coding/ui` components (Badge, ScrollArea, SegmentedControl)

---

## Design Analysis

### Token Mapping

| Stitch | Project CSS Variable / Class |
|--------|------------------------------|
| `bg-card-dark` (#1a252f) | `bento-cell` (uses `--surface-elevated`) |
| `border-border-dark` (#2f4d6a) | `border-border` |
| `text-primary` (#1085f9) | `text-[var(--accent)]` |
| `bg-primary/20` count badge | `bg-[var(--accent)]/20 text-[var(--accent)]` |
| `rounded-xl` cards | `bento-cell` class (12px radius) |
| Priority dot colors | Red=#FF453A, Orange=#FF9F0A, Yellow=#FFD60A, Green=#32D74B, Gray=muted |
| Done card opacity | `opacity-60` |
| Active card left border | `border-l-4 border-l-[var(--accent)]` |
| Critical bug border | `border-[var(--destructive)]/30` |

### Component Mapping

| UI Element | Implementation |
|-----------|----------------|
| Column header count badge | Inline `<span>` with rounded bg |
| Column "..." menu | `MoreHorizontal` from lucide-react (visual only, no dropdown yet) |
| Priority dot | 8px colored `<div>` circle |
| Done check icon | `CheckCircle2` from lucide-react |
| Type badge | Existing `<span>` with TYPE_COLORS map (pill style) |
| Card container | `bento-cell` with conditional border/opacity |

---

### Task 1: Update column layout and headers

**Files:**
- Modify: `apps/desktop/src/renderer/screens/project/tickets-board.tsx:108-148`

**Step 1: Update imports**

Add `MoreHorizontal` and `CheckCircle2` to the lucide-react import:

```tsx
import { Plus, Frame, MoreHorizontal, CheckCircle2 } from 'lucide-react'
```

**Step 2: Update KanbanView layout classes**

Change the outer flex container:
- `gap-4` → `gap-6` (24px between columns, matching Stitch)
- Column width `w-64` → `w-72` (288px, matching Stitch)
- Card spacing `space-y-2` → `space-y-3` (12px, matching Stitch)

**Step 3: Update column header**

Replace the column header section with:
- Section header label (existing `section-header` class)
- Count badge: for `in_progress` column use accent-colored badge (`bg-[var(--accent)]/20 text-[var(--accent)]`), others use `bg-muted text-muted-foreground`
- Add `MoreHorizontal` icon button (16px, muted color, visual placeholder)

```tsx
<div className="mb-3 flex items-center justify-between px-1">
  <div className="flex items-center gap-2">
    <span className="section-header">{col.label}</span>
    <span className={cn(
      "flex size-5 items-center justify-center rounded text-[10px] font-bold",
      col.status === 'in_progress'
        ? "bg-[var(--accent)]/20 text-[var(--accent)]"
        : "bg-muted text-muted-foreground"
    )}>
      {colTickets.length}
    </span>
  </div>
  <MoreHorizontal className="size-4 text-muted-foreground" />
</div>
```

**Step 4: Verify visually**

Run: `pnpm --filter my-electron-app dev`
Expected: Wider columns, more spacing, "..." icon in headers, accent-colored count for In Progress column.

**Step 5: Commit**

```bash
git add apps/desktop/src/renderer/screens/project/tickets-board.tsx
git commit -m "feat(kanban): update column layout and headers to match design"
```

---

### Task 2: Redesign ticket card with priority dots and mono keys

**Files:**
- Modify: `apps/desktop/src/renderer/screens/project/tickets-board.tsx:31-37` (PRIORITY_COLORS) and `:153-174` (TicketCard)

**Step 1: Add priority dot color map**

Add a new map for the 8px priority dot colors (using design system macOS colors):

```tsx
const PRIORITY_DOT_COLORS: Record<TicketPriority, string> = {
  urgent: 'bg-[var(--destructive)]',
  high: 'bg-orange-400',
  medium: 'bg-[var(--warning)]',
  low: 'bg-muted-foreground',
  none: 'bg-muted-foreground',
}
```

**Step 2: Rewrite TicketCard**

Replace the TicketCard component. Key changes:
- Ticket key: `font-mono text-[10px] font-bold text-[var(--accent)]`
- Priority dot: `size-2 rounded-full` with color from PRIORITY_DOT_COLORS, top-right
- Title: `text-sm font-medium mb-3 leading-snug line-clamp-2`
- Type badge: Use TYPE_COLORS map for custom pill styling (not Badge component variant)
- Priority text label: small, muted, right-aligned in footer
- Done state: `opacity-60`, strikethrough title, muted key color, CheckCircle2 icon instead of dot
- In-progress state: `border-l-4 border-l-[var(--accent)] shadow-md`
- Urgent/critical bugs: `border-[var(--destructive)]/30` + pulsing red dot

```tsx
function TicketCard({ ticket, onClick }: { ticket: TicketListItem; onClick: () => void }) {
  const isDone = ticket.status === 'done'
  const isActive = ticket.status === 'in_progress'
  const isCriticalBug = ticket.type === 'bug' && ticket.priority === 'urgent'

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "bento-cell w-full cursor-pointer p-4 text-left",
        isDone && "opacity-60",
        isActive && "border-l-4 border-l-[var(--accent)] shadow-md",
        isCriticalBug && "border-[var(--destructive)]/30",
      )}
    >
      {/* Header: key + priority indicator */}
      <div className="mb-2 flex items-center justify-between">
        <span className={cn(
          "font-mono text-[10px] font-bold",
          isDone ? "text-muted-foreground" : isCriticalBug ? "text-[var(--destructive)]" : "text-[var(--accent)]"
        )}>
          {ticket.key}
        </span>
        {isDone ? (
          <CheckCircle2 className="size-4 text-[var(--success)]" />
        ) : (
          <div className={cn(
            "size-2 rounded-full",
            PRIORITY_DOT_COLORS[ticket.priority],
            isCriticalBug && "animate-pulse"
          )} />
        )}
      </div>

      {/* Title */}
      <p className={cn(
        "text-sm font-medium mb-3 leading-snug line-clamp-2",
        isDone && "line-through text-muted-foreground"
      )}>
        {ticket.title}
      </p>

      {/* Footer: type badge + priority label */}
      <div className="flex items-center gap-2">
        <span className={cn(
          "rounded px-2 py-0.5 text-[10px] font-bold uppercase",
          isDone ? "bg-muted text-muted-foreground" : TYPE_COLORS[ticket.type]
        )}>
          {ticket.type}
        </span>
        {!isDone && ticket.priority !== 'none' && (
          <span className={cn(
            "ml-auto text-[10px]",
            PRIORITY_COLORS[ticket.priority],
            ticket.priority === 'urgent' && "font-black italic"
          )}>
            {ticket.priority === 'urgent' ? 'CRITICAL' : ticket.priority}
          </span>
        )}
      </div>
    </button>
  )
}
```

**Step 3: Add `cn` import**

Ensure `cn` is imported from `@agent-coding/ui`:

```tsx
import { Button, SegmentedControl, EmptyState, Spinner, DataTable, Badge, ScrollArea, cn } from '@agent-coding/ui'
```

**Step 4: Verify visually**

Run: `pnpm --filter my-electron-app dev`
Expected: Cards show mono ticket keys (blue), priority dots (colored circles top-right), type badges with colored pills. Done cards are faded with strikethrough and check icons. In-progress cards have blue left border. Critical bugs have red border and pulsing dot.

**Step 5: Commit**

```bash
git add apps/desktop/src/renderer/screens/project/tickets-board.tsx
git commit -m "feat(kanban): redesign ticket cards with priority dots, status states, and mono keys"
```

---

### Task 3: Clean up unused code

**Files:**
- Modify: `apps/desktop/src/renderer/screens/project/tickets-board.tsx`

**Step 1: Remove TYPE_VARIANT map**

The `TYPE_VARIANT` record (lines 15-21) mapped ticket types to Badge component variants. Since cards now use `TYPE_COLORS` for custom pill styling, `TYPE_VARIANT` is only used in the ListView. Check ListView usage — it still uses `TYPE_VARIANT` for the Badge component in the list view, so keep it.

Actually — keep `TYPE_VARIANT`. It's still used by ListView's DataTable column renderer.

**Step 2: Remove unused Badge import if not used in KanbanView**

Check: `Badge` is still used in ListView, so keep the import.

**Step 3: Verify typecheck**

Run: `pnpm --filter my-electron-app typecheck`
Expected: No type errors in tickets-board.tsx (ignore pre-existing StatusBadge errors in home.tsx per MEMORY.md).

**Step 4: Verify lint**

Run: `pnpm --filter my-electron-app lint`
Expected: Clean (or only pre-existing warnings).

**Step 5: Commit (if any changes)**

```bash
git add apps/desktop/src/renderer/screens/project/tickets-board.tsx
git commit -m "refactor(kanban): clean up unused code after card redesign"
```

---

## Summary of Changes

| What | Before | After |
|------|--------|-------|
| Column width | 256px | 288px |
| Column gap | 16px | 24px |
| Card gap | 8px | 12px |
| Priority display | Text label, bottom | 8px colored dot, top-right |
| Ticket key | Caption, muted | Mono, bold, accent-colored |
| Type badge | Badge component variants | Custom colored pill spans |
| Done cards | Same as others | 60% opacity, strikethrough, check icon |
| In-progress | Same as others | Left accent border, elevated shadow |
| Critical bugs | Same as others | Red border, pulsing dot, "CRITICAL" label |
| Column header | Label + count | Label + count + "..." menu icon |

## Not Implemented (future)

- **Active step progress bar** — Stitch shows "Active: Design 65%" with progress bar on in-progress cards. `TicketListItem` doesn't have step/progress data. Requires API changes.
- **Column "..." dropdown menu** — Icon is rendered but no dropdown behavior yet.
- **Drag-and-drop** — Stitch shows `cursor-grab` on cards but no DnD implementation.
