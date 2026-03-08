# macOS Bento Grid Restyle — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restyle the entire desktop app to have a polished macOS-native look with bento grid layouts, frosted glass effects, and Apple-style visual hierarchy.

**Architecture:** Three layers of changes: (1) Design tokens & global CSS enhancements, (2) Shared UI component refinements, (3) Screen-level bento grid layouts. Each task is independent per component/screen. Changes are purely visual — no business logic or API changes.

**Tech Stack:** React 19, Tailwind CSS v4, Radix UI/shadcn, CSS custom properties, `backdrop-filter` for vibrancy.

---

## Design Vision

**Reference:** macOS Sequoia system apps (Xcode, Finder, System Settings) + Apple.com bento grid showcase.

### Key Visual Principles

| Principle | Current State | Target |
|-----------|--------------|--------|
| **Vibrancy/Glass** | Basic `bg-card/80` toolbar only | Frosted glass sidebar, toolbar, popovers with `backdrop-blur` |
| **Bento Grid** | Uniform card grid `grid-cols-[repeat(auto-fill,minmax(280px,1fr))]` | Mixed-size bento cells (1×1, 2×1, 1×2) with Apple-style gaps |
| **Surface Hierarchy** | Flat cards on flat background | Layered: bg → surface → elevated surface with subtle shadows |
| **Rounded Corners** | `8px` cards | `12px` cards, `16px` hero cells, `10px` modals — more Apple-like |
| **Spacing** | `gap-4` (16px) everywhere | `gap-3` (12px) bento grid, `gap-6` (24px) section spacing |
| **Hover States** | `hover:bg-secondary/50` | `hover:shadow-md` + subtle `scale(1.005)` (no layout shift) |
| **Section Headers** | Uppercase 11px | Keep uppercase but add subtle bottom border or separator |
| **Empty States** | Centered text | Apple-style illustration placeholder + gradient text |

---

## Task 1: Enhanced Design Tokens & Global CSS

**Files:**
- Modify: `packages/ui/src/globals.css`
- Modify: `apps/desktop/src/renderer/globals.css`

**Step 1: Add new CSS variables for bento grid and glass effects**

Add these variables to `packages/ui/src/globals.css` inside `:root`:

```css
  /* Bento grid */
  --bento-gap: 12px;
  --bento-radius: 12px;
  --bento-radius-lg: 16px;

  /* Glass / Vibrancy */
  --glass-bg: rgba(255, 255, 255, 0.72);
  --glass-border: rgba(255, 255, 255, 0.2);
  --glass-blur: 20px;

  /* Elevated surface (cards that float above) */
  --surface-elevated: #FFFFFF;
  --surface-elevated-hover: #FAFAFA;
```

Add to `.dark`:

```css
  /* Bento grid (same values, inherited) */
  --bento-gap: 12px;
  --bento-radius: 12px;
  --bento-radius-lg: 16px;

  /* Glass / Vibrancy — dark */
  --glass-bg: rgba(30, 30, 30, 0.72);
  --glass-border: rgba(255, 255, 255, 0.08);
  --glass-blur: 20px;

  /* Elevated surface — dark */
  --surface-elevated: #2A2A2C;
  --surface-elevated-hover: #323234;
```

**Step 2: Add bento utility classes to `apps/desktop/src/renderer/globals.css`**

Add inside `@layer utilities`:

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

  /* Span helpers */
  .bento-span-2 {
    grid-column: span 2;
  }

  .bento-span-row-2 {
    grid-row: span 2;
  }

  /* Bento cell base style */
  .bento-cell {
    border-radius: var(--bento-radius);
    background: var(--surface-elevated);
    border: 1px solid var(--border);
    padding: var(--space-4);
    transition: box-shadow 150ms ease, transform 150ms ease;
  }

  .bento-cell:hover {
    box-shadow: var(--shadow-md);
  }

  .bento-cell-lg {
    border-radius: var(--bento-radius-lg);
    background: var(--surface-elevated);
    border: 1px solid var(--border);
    padding: var(--space-6);
    transition: box-shadow 150ms ease, transform 150ms ease;
  }

  .bento-cell-lg:hover {
    box-shadow: var(--shadow-md);
  }

  /* Glass panel */
  .glass-panel {
    background: var(--glass-bg);
    backdrop-filter: blur(var(--glass-blur));
    -webkit-backdrop-filter: blur(var(--glass-blur));
    border: 1px solid var(--glass-border);
  }
```

**Step 3: Add Tailwind theme extensions**

Add to `@theme inline` in `apps/desktop/src/renderer/globals.css`:

```css
  --color-surface-elevated: var(--surface-elevated);
  --color-surface-elevated-hover: var(--surface-elevated-hover);
  --color-glass-bg: var(--glass-bg);
  --color-glass-border: var(--glass-border);
```

**Step 4: Verify build**

Run: `pnpm --filter my-electron-app build`
Expected: Build succeeds with no errors.

**Step 5: Commit**

```bash
git add packages/ui/src/globals.css apps/desktop/src/renderer/globals.css
git commit -m "feat(ui): add bento grid and glass effect design tokens"
```

---

## Task 2: Restyle App Layout — Glass Toolbar & Vibrancy Sidebar

**Files:**
- Modify: `apps/desktop/src/renderer/components/app-layout.tsx`
- Modify: `apps/desktop/src/renderer/components/app-sidebar.tsx`
- Modify: `apps/desktop/src/renderer/components/status-bar.tsx`

**Step 1: Restyle the toolbar in `app-layout.tsx`**

Change the toolbar div (line 42) from:
```tsx
<div className="flex h-9 shrink-0 items-center border-b border-border bg-card/80 backdrop-blur-xl app-drag">
```
To:
```tsx
<div className="flex h-9 shrink-0 items-center border-b border-border/50 glass-panel app-drag">
```

**Step 2: Restyle the sidebar in `app-sidebar.tsx`**

Replace the inline `style` prop (lines 19-23) with the glass-panel class. Change:
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
To:
```tsx
<aside
  className={cn(
    'shrink-0 border-r border-border/50 glass-panel transition-[width] duration-200 ease-out',
    isOpen ? 'w-60' : 'w-0 overflow-hidden'
  )}
>
```

**Step 3: Restyle status bar in `status-bar.tsx`**

Change the outer div (line 29) from:
```tsx
<div className="flex h-7 shrink-0 items-center justify-between border-t border-border bg-card/50 px-3 text-caption text-muted-foreground">
```
To:
```tsx
<div className="flex h-7 shrink-0 items-center justify-between border-t border-border/50 glass-panel px-3 text-caption text-muted-foreground">
```

**Step 4: Verify dev mode**

Run: `pnpm --filter my-electron-app dev`
Expected: Toolbar, sidebar, and status bar all show frosted glass effect.

**Step 5: Commit**

```bash
git add apps/desktop/src/renderer/components/app-layout.tsx apps/desktop/src/renderer/components/app-sidebar.tsx apps/desktop/src/renderer/components/status-bar.tsx
git commit -m "feat(desktop): apply glass vibrancy to toolbar, sidebar, and status bar"
```

---

## Task 3: Restyle Home Screen — Bento Grid Project Dashboard

**Files:**
- Modify: `apps/desktop/src/renderer/screens/home.tsx`
- Modify: `apps/desktop/src/renderer/components/project-card.tsx`

**Step 1: Convert the project grid to bento layout in `home.tsx`**

Replace the grid div (line 49):
```tsx
<div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
```
With:
```tsx
<div className="bento-grid-3">
```

Also increase the outer padding from `p-6` to `p-6` (keep same) and add `space-y-6` for better section spacing. Replace lines 25-27:
```tsx
<div className="mb-6 flex items-center justify-between">
  <h1 className="window-title">Projects</h1>
```
With:
```tsx
<div className="mb-8 flex items-center justify-between">
  <h1 className="text-lg font-semibold tracking-tight">Projects</h1>
```

**Step 2: Restyle `ProjectCard` to be a bento cell**

In `project-card.tsx`, replace the Card className (line 23):
```tsx
<Card
  className="cursor-pointer rounded-[var(--radius-card)] transition-all duration-150 hover:bg-secondary/50 hover:shadow-[var(--shadow-sm)]"
  onClick={onClick}
>
```
With:
```tsx
<Card
  className="bento-cell cursor-pointer border-border/60 transition-all duration-150 hover:shadow-[var(--shadow-md)]"
  onClick={onClick}
>
```

Also update the title styling (line 29) — increase font size for bento feel:
```tsx
<CardTitle className="text-[13px] font-medium">{project.name}</CardTitle>
```
To:
```tsx
<CardTitle className="text-sm font-semibold">{project.name}</CardTitle>
```

**Step 3: Verify**

Run: `pnpm --filter my-electron-app dev`
Expected: Home screen shows 3-column bento grid with elevated cards.

**Step 4: Commit**

```bash
git add apps/desktop/src/renderer/screens/home.tsx apps/desktop/src/renderer/components/project-card.tsx
git commit -m "feat(desktop): restyle home screen with bento grid layout"
```

---

## Task 4: Restyle Tickets Board — Bento Kanban & List Views

**Files:**
- Modify: `apps/desktop/src/renderer/screens/project/tickets-board.tsx`

**Step 1: Restyle the toolbar**

Change the toolbar div (line 59):
```tsx
<div className="flex h-10 shrink-0 items-center justify-between border-b border-border px-4">
  <div className="window-title">Tickets</div>
```
To:
```tsx
<div className="flex h-10 shrink-0 items-center justify-between border-b border-border/50 px-4">
  <div className="text-sm font-semibold tracking-tight">Tickets</div>
```

**Step 2: Restyle the kanban column headers**

In `KanbanView`, change the column header wrapper (lines 124-129):
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

**Step 3: Restyle ticket cards in kanban view**

Change the `TicketCard` button className (line 151):
```tsx
className="w-full cursor-pointer rounded-[var(--radius-card)] border border-border bg-card p-3 text-left transition-all duration-150 hover:bg-secondary/50 hover:shadow-[var(--shadow-sm)]"
```
To:
```tsx
className="bento-cell w-full cursor-pointer p-3 text-left"
```

**Step 4: Verify**

Run: `pnpm --filter my-electron-app dev`
Expected: Kanban cards use bento cell styling with rounded corners and shadow hover.

**Step 5: Commit**

```bash
git add apps/desktop/src/renderer/screens/project/tickets-board.tsx
git commit -m "feat(desktop): restyle tickets board with bento-style kanban cards"
```

---

## Task 5: Restyle Ticket Detail Screen

**Files:**
- Modify: `apps/desktop/src/renderer/screens/ticket.tsx`

**Step 1: Restyle the ticket header**

Change the header border (line 50):
```tsx
<div className="border-b border-border p-4">
```
To:
```tsx
<div className="border-b border-border/50 p-4 pb-3">
```

Update the title (line 60):
```tsx
<h2 className="text-base font-semibold">{ticket.title}</h2>
```
To:
```tsx
<h2 className="text-base font-semibold tracking-tight">{ticket.title}</h2>
```

**Step 2: Restyle the tab bar**

Change the tab bar container (line 64):
```tsx
<div className="border-b border-border px-4 py-2">
```
To:
```tsx
<div className="border-b border-border/50 px-4 py-2">
```

**Step 3: Commit**

```bash
git add apps/desktop/src/renderer/screens/ticket.tsx
git commit -m "feat(desktop): restyle ticket detail with macOS-style header"
```

---

## Task 6: Restyle Brainstorm Screen — Chat Vibrancy

**Files:**
- Modify: `apps/desktop/src/renderer/screens/brainstorm.tsx`

**Step 1: Restyle the input bar**

Change the input bar container (line 185):
```tsx
<div className="border-t border-border p-4">
```
To:
```tsx
<div className="border-t border-border/50 glass-panel p-4">
```

**Step 2: Restyle the summary card**

Change the summary card (line 151):
```tsx
<div key={msg.id} className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4">
```
To:
```tsx
<div key={msg.id} className="bento-cell-lg border-primary/20 bg-primary/5">
```

**Step 3: Restyle the error state**

Change the error container (lines 122-128):
```tsx
<div className="flex h-full flex-col items-center justify-center gap-3">
  <p className="text-[13px] text-destructive">{error}</p>
```
To:
```tsx
<div className="flex h-full flex-col items-center justify-center gap-4">
  <div className="bento-cell max-w-sm text-center">
    <p className="text-[13px] text-destructive">{error}</p>
```

(Close the div accordingly.)

**Step 4: Commit**

```bash
git add apps/desktop/src/renderer/screens/brainstorm.tsx
git commit -m "feat(desktop): restyle brainstorm with glass input bar and bento summary cards"
```

---

## Task 7: Restyle Modals — macOS Sheet Style

**Files:**
- Modify: `packages/ui/src/components/dialog.tsx`
- Modify: `apps/desktop/src/renderer/components/modals/create-project-modal.tsx`
- Modify: `apps/desktop/src/renderer/components/modals/create-ticket-modal.tsx`
- Modify: `apps/desktop/src/renderer/components/modals/delete-project-modal.tsx`

**Step 1: Update Dialog overlay and content in `dialog.tsx`**

Read the file first, then find the `DialogOverlay` className and update the blur:
- Change overlay background to `bg-black/40 backdrop-blur-sm`
- Update `DialogContent` to use `rounded-[var(--bento-radius)] border-border/50 shadow-lg`

**Step 2: Review each modal for consistent padding and typography**

In each modal file, ensure:
- Titles use `text-sm font-semibold tracking-tight` (not `window-title`)
- Descriptions use `text-[13px] text-muted-foreground`
- Input fields have consistent `rounded-[6px]` radius
- Action buttons use standard `Button` with no custom overrides

**Step 3: Commit**

```bash
git add packages/ui/src/components/dialog.tsx apps/desktop/src/renderer/components/modals/
git commit -m "feat(ui): restyle modals with macOS sheet styling and glass overlay"
```

---

## Task 8: Restyle Sidebar Components — Source List Polish

**Files:**
- Modify: `apps/desktop/src/renderer/components/sidebar/home-sidebar.tsx`
- Modify: `apps/desktop/src/renderer/components/sidebar/project-sidebar.tsx`
- Modify: `apps/desktop/src/renderer/components/sidebar/ticket-sidebar.tsx`

**Step 1: Read all three sidebar files**

**Step 2: Ensure consistent macOS source-list styling**

For each sidebar file, verify/update:
- Section headers use `section-header` utility class
- Nav items have `rounded-md` (6px), `px-2 py-1.5`, `text-[13px]`
- Active items use `bg-accent text-accent-foreground` (the selection highlight)
- Hover items use `hover:bg-muted` (not `hover:bg-secondary/50`)
- Icons are `size-4 text-muted-foreground` (active: `text-accent-foreground`)
- Bottom padding or spacing to avoid sidebar content colliding with edges
- Borders between sections should use `border-border/50` (subtle)

**Step 3: Commit**

```bash
git add apps/desktop/src/renderer/components/sidebar/
git commit -m "feat(desktop): polish sidebar nav with macOS source-list styling"
```

---

## Task 9: Restyle Ticket Detail Sub-Tabs — Overview, Tasks, Specs, Activity

**Files:**
- Modify: `apps/desktop/src/renderer/components/ticket-detail/overview-tab.tsx`
- Modify: `apps/desktop/src/renderer/components/ticket-detail/tasks-tab.tsx`
- Modify: `apps/desktop/src/renderer/components/ticket-detail/specs-tab.tsx`
- Modify: `apps/desktop/src/renderer/components/ticket-detail/activity-tab.tsx`

**Step 1: Read all four files**

**Step 2: Apply consistent bento-cell styling**

For each tab content that uses cards or panels:
- Use `bento-cell` class for content sections
- Use `border-border/50` for subtle borders
- Section headers: `section-header` utility
- Consistent `p-4` padding inside scrollable areas
- Any key-value rows (`KvRow`) should have `border-border/50` separators

**Step 3: Apply consistent text hierarchy**

- Primary headings: `text-sm font-semibold tracking-tight`
- Body text: `text-[13px]` (already standard)
- Captions: `text-caption text-muted-foreground`
- Use `space-y-3` for section content spacing

**Step 4: Commit**

```bash
git add apps/desktop/src/renderer/components/ticket-detail/
git commit -m "feat(desktop): restyle ticket detail tabs with bento cells and consistent hierarchy"
```

---

## Task 10: Restyle Review Panel & Diff View

**Files:**
- Modify: `apps/desktop/src/renderer/components/review/review-panel.tsx`
- Modify: `apps/desktop/src/renderer/components/review/review-diff-view.tsx`
- Modify: `apps/desktop/src/renderer/components/review/review-file-tree.tsx`
- Modify: `apps/desktop/src/renderer/components/review/review-action-bar.tsx`
- Modify: `apps/desktop/src/renderer/components/review/review-comment-list.tsx`
- Modify: `apps/desktop/src/renderer/components/review/test-results-panel.tsx`

**Step 1: Read all review component files**

**Step 2: Apply glass/bento styling**

- Review panel toolbar: `glass-panel border-border/50`
- File tree: macOS source-list style (same as sidebar — `rounded-md` items, subtle selection)
- Diff view: Keep code styling neutral, but wrap in `bento-cell` if it's a standalone panel
- Action bar: `glass-panel` at the bottom
- Comment list: Each comment as a subtle `bento-cell` with `border-border/40`
- Test results: Status indicators use existing `StatusBadge`, wrap groups in `bento-cell`

**Step 3: Commit**

```bash
git add apps/desktop/src/renderer/components/review/
git commit -m "feat(desktop): restyle review panel with glass toolbar and bento cells"
```

---

## Task 11: Restyle Figma Integration Components

**Files:**
- Modify: `apps/desktop/src/renderer/screens/figma-import.tsx`
- Modify: `apps/desktop/src/renderer/components/figma/figma-viewer.tsx`
- Modify: `apps/desktop/src/renderer/components/figma/figma-canvas.tsx`
- Modify: `apps/desktop/src/renderer/components/figma/figma-node-tree.tsx`
- Modify: `apps/desktop/src/renderer/components/figma/figma-annotation-panel.tsx`

**Step 1: Read all figma component files**

**Step 2: Apply consistent macOS styling**

- Figma viewer toolbar: `glass-panel`
- Node tree: Source-list style (consistent with sidebars)
- Annotation panel: Each annotation as `bento-cell` with subtle borders
- Canvas area: Keep neutral, add subtle `border-border/30` frame
- Import screen: Use `bento-grid-2` for layout if applicable

**Step 3: Commit**

```bash
git add apps/desktop/src/renderer/screens/figma-import.tsx apps/desktop/src/renderer/components/figma/
git commit -m "feat(desktop): restyle figma components with macOS-native styling"
```

---

## Task 12: Restyle Project Sub-Screens

**Files:**
- Modify: `apps/desktop/src/renderer/screens/project/project-settings.tsx`
- Modify: `apps/desktop/src/renderer/screens/project/project-repositories.tsx`
- Modify: `apps/desktop/src/renderer/screens/project/project-agents.tsx`
- Modify: `apps/desktop/src/renderer/screens/settings/github-accounts.tsx`

**Step 1: Read all project sub-screen files**

**Step 2: Apply bento grid where appropriate**

- Settings screen: Use `bento-grid-2` for settings groups
- Repositories: Each repo as a `bento-cell`
- Agents: Agent cards as `bento-cell` in a `bento-grid-3`
- GitHub accounts: Account cards as `bento-cell`
- All toolbars: `border-border/50` subtle borders
- Section titles: `text-sm font-semibold tracking-tight`

**Step 3: Commit**

```bash
git add apps/desktop/src/renderer/screens/project/ apps/desktop/src/renderer/screens/settings/
git commit -m "feat(desktop): restyle project sub-screens with bento grid layout"
```

---

## Task 13: Restyle Shared UI Components — Subtle Polish

**Files:**
- Modify: `packages/ui/src/components/card.tsx` — increase default radius to `rounded-[12px]`
- Modify: `packages/ui/src/components/badge.tsx` — ensure pill shape `rounded-full`
- Modify: `packages/ui/src/components/segmented-control.tsx` — macOS pill look with `rounded-lg` container
- Modify: `packages/ui/src/components/empty-state.tsx` — use gradient text for title, bento-cell wrapper
- Modify: `packages/ui/src/components/panel.tsx` — glass-panel option for header
- Modify: `packages/ui/src/components/tab-bar.tsx` — subtle glass background
- Modify: `packages/ui/src/components/data-table.tsx` — `border-border/50` row separators

**Step 1: Read each component file above**

**Step 2: Apply minimal styling updates**

For each component, make the smallest change that aligns with the macOS bento design:
- `card.tsx`: Change default `rounded-xl` or `rounded-lg` to `rounded-[var(--bento-radius)]`
- `badge.tsx`: Ensure it uses `rounded-full` (pill) — likely already correct
- `segmented-control.tsx`: Background `bg-muted rounded-lg`, active segment `bg-card shadow-sm rounded-md`
- `empty-state.tsx`: Wrap in `bento-cell` styling, title `text-sm font-semibold`
- `panel.tsx`: Add optional `glass` prop that applies `glass-panel` to header
- `tab-bar.tsx`: Subtle `glass-panel` background
- `data-table.tsx`: Row borders use `border-border/50`

**Step 3: Commit**

```bash
git add packages/ui/src/components/
git commit -m "feat(ui): polish shared components with macOS bento design refinements"
```

---

## Task 14: Update Design System Documentation

**Files:**
- Modify: `docs/design/design-system.md`

**Step 1: Add Bento Grid section to design-system.md**

After the "Shadows" section, add:

```markdown
### Bento Grid

| Token | Value | Usage |
|-------|-------|-------|
| `--bento-gap` | 12px | Gap between bento cells |
| `--bento-radius` | 12px | Border radius for bento cells |
| `--bento-radius-lg` | 16px | Border radius for hero/large cells |

#### Layout Classes

| Class | Columns | Usage |
|-------|---------|-------|
| `bento-grid-2` | 2 columns | Settings, side-by-side |
| `bento-grid-3` | 3 columns | Project cards, features |
| `bento-grid-4` | 4 columns | Dashboard metrics |
| `bento-span-2` | Span 2 cols | Hero/feature cards |
| `bento-span-row-2` | Span 2 rows | Tall cards |

#### Cell Styles

| Class | Radius | Padding | Usage |
|-------|--------|---------|-------|
| `bento-cell` | 12px | 16px | Standard bento card |
| `bento-cell-lg` | 16px | 24px | Hero/featured cards |
| `glass-panel` | — | — | Toolbar, sidebar, status bar |

### Vibrancy / Glass Effects

```css
.glass-panel {
  background: var(--glass-bg);       /* Light: rgba(255,255,255,0.72), Dark: rgba(30,30,30,0.72) */
  backdrop-filter: blur(20px);
  border: 1px solid var(--glass-border);
}
```

Applied to: toolbar, sidebar, status bar, input bars, popovers.
```

**Step 2: Commit**

```bash
git add docs/design/design-system.md
git commit -m "docs: add bento grid and glass effect specs to design system"
```

---

## Task 15: Final Visual QA Pass

**Step 1: Run the app in dev mode**

Run: `pnpm --filter my-electron-app dev`

**Step 2: Visual checklist (manual)**

- [ ] Home screen: 3-column bento grid with elevated project cards
- [ ] Toolbar: Frosted glass with blur effect
- [ ] Sidebar: Frosted glass, source-list style navigation
- [ ] Status bar: Glass effect, subtle border
- [ ] Project → Tickets Board: Bento-style kanban cards
- [ ] Ticket Detail: Consistent header, tabs, sub-tab content
- [ ] Brainstorm: Glass input bar, bento summary cards
- [ ] Modals: Sheet-style with blur overlay
- [ ] Settings pages: Bento grid sections
- [ ] Dark mode: All glass/bento effects work correctly
- [ ] Light mode: Sufficient contrast, glass visible

**Step 3: Fix any issues found**

**Step 4: Final commit**

```bash
git commit -m "feat(desktop): complete macOS bento grid restyle — visual QA pass"
```

---

## Summary

| Task | Scope | Files |
|------|-------|-------|
| 1 | Design tokens & CSS | 2 |
| 2 | App shell (toolbar/sidebar/statusbar) | 3 |
| 3 | Home screen bento grid | 2 |
| 4 | Tickets board | 1 |
| 5 | Ticket detail | 1 |
| 6 | Brainstorm screen | 1 |
| 7 | Modals | 4 |
| 8 | Sidebars | 3 |
| 9 | Ticket detail tabs | 4 |
| 10 | Review panel | 6 |
| 11 | Figma components | 5 |
| 12 | Project sub-screens | 4 |
| 13 | Shared UI components | 7 |
| 14 | Documentation | 1 |
| 15 | Visual QA | 0 |

**Total: 15 tasks, ~44 files**
