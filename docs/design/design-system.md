# Design System Master File

> **LOGIC:** When building a specific page, first check `docs/design/pages/[page-name].md`.
> If that file exists, its rules **override** this file.
> If not, strictly follow the rules below.

---

**Project:** Claude Code Workflow Manager
**Updated:** 2026-03-08
**Category:** Developer Tool / Desktop App
**Style:** macOS Native (Xcode/Tower/TablePlus) + Bento Grid

---

## Global Rules

### Color Palette — Dark Mode (Primary)

| Role | Value | CSS Variable |
|------|-------|--------------|
| Background | `#1E1E1E` | `--bg` |
| Surface | `#252526` | `--surface` |
| Surface Hover | `#2D2D2D` | `--surface-hover` |
| Sidebar | `rgba(27,27,31,0.85)` | `--sidebar` |
| Border | `#3C3C3C` | `--border` |
| Text | `#E5E5E5` | `--text` |
| Text Secondary | `#999999` | `--text-secondary` |
| Accent | `#0A84FF` | `--accent` (macOS system blue) |
| Accent Hover | `#409CFF` | `--accent-hover` |
| Success | `#32D74B` | `--success` (macOS green) |
| Warning | `#FFD60A` | `--warning` (macOS yellow) |
| Destructive | `#FF453A` | `--destructive` (macOS red) |
| Selection | `rgba(10,132,255,0.15)` | `--selection` |
| Glass BG | `rgba(30,30,30,0.72)` | `--glass-bg` |
| Glass Border | `rgba(255,255,255,0.08)` | `--glass-border` |
| Elevated Surface | `#2A2A2C` | `--surface-elevated` |
| Elevated Hover | `#323234` | `--surface-elevated-hover` |

### Color Palette — Light Mode

| Role | Value | CSS Variable |
|------|-------|--------------|
| Background | `#F5F5F7` | `--bg` |
| Surface | `#FFFFFF` | `--surface` |
| Surface Hover | `#FAFAFA` | `--surface-hover` |
| Sidebar | `rgba(240,240,240,0.85)` | `--sidebar` |
| Border | `#D1D1D6` | `--border` |
| Text | `#1D1D1F` | `--text` |
| Text Secondary | `#6E6E73` | `--text-secondary` |
| Accent | `#007AFF` | `--accent` |
| Success | `#28CD41` | `--success` |
| Warning | `#FFCC00` | `--warning` |
| Destructive | `#FF3B30` | `--destructive` |
| Selection | `rgba(0,122,255,0.12)` | `--selection` |
| Glass BG | `rgba(255,255,255,0.72)` | `--glass-bg` |
| Glass Border | `rgba(255,255,255,0.2)` | `--glass-border` |
| Elevated Surface | `#FFFFFF` | `--surface-elevated` |
| Elevated Hover | `#FAFAFA` | `--surface-elevated-hover` |

### Typography

- **Primary Font:** Inter (SF Pro equivalent)
- **Monospace Font:** JetBrains Mono (code, terminal)
- **Google Fonts:** [Inter + JetBrains Mono](https://fonts.google.com/share?selection.family=Inter:wght@300;400;500;600;700|JetBrains+Mono:wght@400;500;600;700)

| Element | Size | Weight | Line Height | Letter Spacing |
|---------|------|--------|-------------|----------------|
| Window Title | 13px | 600 | 1.2 | -0.01em |
| Section Header | 11px | 600 | 1.3 | 0.06em (uppercase) |
| Body | 13px | 400 | 1.5 | -0.008em |
| Label | 12px | 500 | 1.3 | 0 |
| Caption | 11px | 400 | 1.3 | 0 |
| Code | 12px | 400 | 1.5 | 0 (JetBrains Mono) |

### Spacing (4px base)

| Token | Value |
|-------|-------|
| `--space-1` | 4px |
| `--space-2` | 8px |
| `--space-3` | 12px |
| `--space-4` | 16px |
| `--space-5` | 20px |
| `--space-6` | 24px |
| `--space-8` | 32px |
| `--space-10` | 40px |
| `--space-12` | 48px |

### Border Radius

| Element | Value |
|---------|-------|
| Buttons | 6px |
| Cards / Panels | 8px |
| Bento Cells | 12px (`--bento-radius`) |
| Bento Cells (large) | 16px (`--bento-radius-lg`) |
| Modals / Sheets | 10px |
| Input fields | 6px |
| Tags / Badges | 9999px |

### Shadows

| Level | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.15)` | Subtle lift |
| `--shadow-md` | `0 4px 12px rgba(0,0,0,0.2)` | Cards, popovers |
| `--shadow-lg` | `0 10px 30px rgba(0,0,0,0.25)` | Modals, sheets |

### Transitions

- Micro-interactions: `150ms ease`
- Panel slide: `200ms ease`
- Page transitions: `250ms ease`
- Always respect `prefers-reduced-motion`

### Bento Grid

Apple-style modular grid layout for dashboards, project views, and feature showcases.

| Token | Value | Usage |
|-------|-------|-------|
| `--bento-gap` | 12px | Gap between bento cells |
| `--bento-radius` | 12px | Border radius for bento cells |
| `--bento-radius-lg` | 16px | Border radius for hero/large cells |

#### Layout Classes

| Class | Columns | Usage |
|-------|---------|-------|
| `bento-grid-2` | 2 columns | Settings groups, side-by-side panels |
| `bento-grid-3` | 3 columns | Project cards, feature grids |
| `bento-grid-4` | 4 columns | Dashboard metrics, small stats |
| `bento-span-2` | Span 2 cols | Hero/feature highlight cards |
| `bento-span-row-2` | Span 2 rows | Tall content cards |

#### Cell Styles

| Class | Radius | Padding | Hover | Usage |
|-------|--------|---------|-------|-------|
| `bento-cell` | 12px | 16px | `shadow-md` | Standard card (project, ticket, setting) |
| `bento-cell-lg` | 16px | 24px | `shadow-md` | Hero/featured cards, summaries |

Bento cells use `--surface-elevated` background, `1px solid var(--border)` border, and `150ms ease` transition on shadow/transform.

### Vibrancy / Glass Effects

Frosted glass panels for chrome elements (toolbar, sidebar, status bar, input bars).

```css
.glass-panel {
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
}
```

| Mode | Background | Border |
|------|-----------|--------|
| Light | `rgba(255,255,255,0.72)` | `rgba(255,255,255,0.2)` |
| Dark | `rgba(30,30,30,0.72)` | `rgba(255,255,255,0.08)` |

**Applied to:** Toolbar, sidebar, status bar, brainstorm input bar, review action bar.

**Borders:** Chrome elements use `border-border/50` (50% opacity) for subtlety.

---

## Component Specs

### Buttons (macOS-native feel)

```css
.btn-primary {
  background: var(--accent);
  color: white;
  padding: 6px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  transition: background 150ms ease;
  cursor: pointer;
}
.btn-primary:hover {
  background: var(--accent-hover);
}

.btn-secondary {
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--border);
  padding: 6px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  transition: background 150ms ease;
  cursor: pointer;
}
.btn-secondary:hover {
  background: var(--surface-hover);
}
```

### Sidebar Item

```css
.sidebar-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 150ms ease;
}
.sidebar-item:hover {
  background: var(--surface-hover);
  color: var(--text);
}
.sidebar-item.active {
  background: var(--selection);
  color: var(--accent);
}
```

### Data Table Row

```css
.table-row {
  height: 32px;
  padding: 0 12px;
  font-size: 13px;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  transition: background 150ms ease;
}
.table-row:hover {
  background: var(--surface-hover);
}
.table-row:nth-child(even) {
  background: rgba(255,255,255,0.02);
}
```

### Input

```css
.input {
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 13px;
  background: var(--surface);
  color: var(--text);
  transition: border-color 150ms ease;
}
.input:focus {
  border-color: var(--accent);
  outline: none;
  box-shadow: 0 0 0 3px rgba(10,132,255,0.2);
}
```

---

## Layout Structure

Three-panel layout: Sidebar (240px) + Main Content + Inspector (320px, collapsible).

- Toolbar: 36px, translucent, `titleBarStyle: 'hiddenInset'`
- Status bar: 28px, bottom
- Sidebar: vibrancy blur (`backdrop-filter: blur(20px)`)
- All panels resizable via `SplitPane` component

---

## Anti-Patterns (Do NOT Use)

- Emojis as icons — use Lucide React SVG icons
- Missing `cursor-pointer` on interactive elements
- Layout-shifting hover effects (no scale transforms)
- Low contrast text (maintain 4.5:1 minimum)
- Instant state changes (always use 150ms+ transitions)
- Invisible focus states
- Modal dialogs for non-blocking actions (use Sheets or Popovers)
- Overly colorful UI — keep neutral grays, single accent color
- Flat uniform card grids — use bento grid with mixed cell sizes for visual hierarchy
- Hard opaque borders on chrome — use `border-border/50` for glass panels
- Inline `style` for backdrop-filter — use `glass-panel` utility class
- Inconsistent card radii — use `bento-cell` (12px) or `bento-cell-lg` (16px), not ad-hoc values

---

## Pre-Delivery Checklist

- [ ] All icons from Lucide React, consistent 16px/20px sizing
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover states with smooth transitions (150ms)
- [ ] Dark/light mode both functional
- [ ] Text contrast 4.5:1 minimum in both modes
- [ ] Focus states visible for keyboard navigation
- [ ] `prefers-reduced-motion` respected
- [ ] Vibrancy/blur effects degrade gracefully on non-macOS
- [ ] Compact density (32px row heights, 13px body text)
- [ ] Bento grid used for card layouts (not flat uniform grids)
- [ ] Glass panels on all chrome elements (toolbar, sidebar, status bar)
- [ ] Chrome borders use `border-border/50` (subtle, not full opacity)
- [ ] Cards use `bento-cell` or `bento-cell-lg` styling
- [ ] Section titles use `text-sm font-semibold tracking-tight`
