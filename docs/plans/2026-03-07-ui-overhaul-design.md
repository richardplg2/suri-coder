# UI Overhaul — Match macOS Design Spec

**Date:** 2026-03-07
**Goal:** Fix all visual/structural gaps between current UI and the macOS-style design system.

## Context

The app currently deviates from `docs/design/design-system.md` and `docs/design/app-shell.md` in several critical ways: window is too small (700x473 vs 1440x900), fonts aren't loaded, sidebar lacks vibrancy, toolbar is incomplete, status bar is missing, and dark mode isn't wired up.

## Approach

Incremental layer-by-layer. Each layer builds on the previous and can be verified independently.

## Layer 1: Window Configuration

**File:** `apps/desktop/src/main/windows/main.ts`

| Setting | Current | Target |
|---------|---------|--------|
| width | 700 | 1440 |
| height | 473 | 900 |
| minWidth | — | 1024 |
| minHeight | — | 600 |
| resizable | false | true |
| alwaysOnTop | true | remove |
| titleBarStyle | — | `'hiddenInset'` (macOS only) |
| trafficLightPosition | — | `{ x: 16, y: 12 }` (macOS only) |
| vibrancy | — | `'sidebar'` (macOS only) |
| backgroundColor | — | `'#1E1E1E'` |

Platform-conditional: detect `process.platform === 'darwin'` for macOS-only settings.

## Layer 2: Fonts

**File:** `apps/desktop/src/renderer/index.html` + `globals.css`

- Add Google Fonts `<link>` for Inter (300–700) + JetBrains Mono (400–700).
- Set `body { font-family: var(--font-sans); }` in globals.css (var already defined in ui package).

## Layer 3: Toolbar Enhancement

**File:** `apps/desktop/src/renderer/components/app-layout.tsx`

Current toolbar: traffic light spacer + TabBar only.

Updated structure:
```
[traffic-light-spacer (macOS only)] [TabBar] [spacer] [Search icon] [Bell icon] [Theme toggle]
```

- Traffic light spacer: conditional on platform (expose via preload API or CSS class on body).
- Search icon: placeholder button with `Cmd+K` tooltip.
- Bell icon: placeholder button.
- Theme toggle: functional, wired to existing `useThemeStore`.
- All right-side buttons: `app-no-drag`, ghost variant, icon size 16px.

## Layer 4: Status Bar

**File:** new component in `apps/desktop/src/renderer/components/status-bar.tsx`

28px bar at bottom of AppLayout:
- Left: colored dot (green/red) + "Connected" / "Disconnected" text. Can ping `/health` endpoint.
- Right: placeholder for session info (duration, tokens, cost) — static text for now.
- Font: 11px, muted-foreground color.
- Border-top: 1px solid var(--border).

## Layer 5: Sidebar Polish

**File:** `apps/desktop/src/renderer/components/app-sidebar.tsx`

Changes:
- Background: `bg-[var(--sidebar-bg)]` instead of `bg-card/50`.
- Add `backdrop-filter: blur(20px)` via inline style or utility class.
- Section headers: verify 11px, uppercase, 0.06em letter-spacing (already correct in sidebar files).

## Layer 6: Login Screen

**File:** `apps/desktop/src/renderer/screens/login.tsx`

No structural changes needed. At 1440px width, the `lg:flex` branding panel will display. Verify:
- Drag region covers full top bar.
- Form inputs match design system (6px border-radius, 13px font).

## Layer 7: Screen Polish

All screens — verify compliance with design system typography and spacing:

- **Body text:** 13px, weight 400
- **Section headers:** 11px, weight 600, uppercase, 0.06em tracking
- **Labels:** 12px, weight 500
- **Card border-radius:** 8px
- **Button border-radius:** 6px
- **Row heights:** 32px for data tables
- **Spacing:** use 4px-base tokens

Files to check:
- `screens/home.tsx` — project cards, page header
- `screens/project/tickets-board.tsx` — kanban cards, toolbar
- `screens/ticket.tsx` — header, DAG area
- `screens/project/project-settings.tsx` — form layout
- `components/project-card.tsx` — card styling

## Layer 8: Dark Mode

- Ensure `useThemeStore` applies `.dark` class to `<html>` element.
- Theme toggle in toolbar switches between light/dark/system.
- Verify all screens render correctly in both modes.

## Out of Scope

- Command palette (Cmd+K) functionality — placeholder icon only.
- Notifications system — placeholder icon only.
- Bottom status bar session data — placeholder text only.
- New components not yet built (DiffViewer, CodeBlock, ChatBubble, etc.).
