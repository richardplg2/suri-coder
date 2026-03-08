# Design System — Suri Coder (Workflow Manager)

## 1. Overview

macOS-native desktop application for managing Claude Code workflow sessions. Dark-first design with glass/vibrancy effects, inspired by Xcode, Tower, and TablePlus. Uses a bento grid layout system for card-based UIs.

## 2. Color Palette

### Dark Mode (Primary)
| Role | Value | Usage |
|------|-------|-------|
| Background | `#1E1E1E` | App background |
| Surface | `#252526` | Panels, default cards |
| Surface Hover | `#2D2D2D` | Hovered items |
| Surface Elevated | `#2A2A2C` | Bento cells, elevated cards |
| Surface Elevated Hover | `#323234` | Hovered bento cells |
| Sidebar/Rail | `rgba(27,27,31,0.85)` | Glass sidebar, rail |
| Border | `#3C3C3C` | Default borders |
| Glass Border | `rgba(255,255,255,0.08)` | Subtle chrome borders |
| Glass BG | `rgba(30,30,30,0.72)` | Frosted glass panels |
| Text Primary | `#E5E5E5` | Main text |
| Text Secondary | `#999999` | Muted labels, captions |
| Accent | `#0A84FF` | macOS system blue — buttons, links, active indicators |
| Accent Hover | `#409CFF` | Blue hover state |
| Selection | `rgba(10,132,255,0.15)` | Selected rows, active items |
| Success | `#32D74B` | macOS green — completed, online, pass |
| Warning | `#FFD60A` | macOS yellow — caution, pending |
| Destructive | `#FF453A` | macOS red — errors, delete, fail |

## 3. Typography

- **Primary Font:** Inter — all UI text
- **Monospace Font:** JetBrains Mono — code blocks, terminal output
- Window Title: 13px / 600 weight
- Section Header: 11px / 600 weight / uppercase / 0.06em tracking
- Body: 13px / 400 weight
- Label: 12px / 500 weight
- Caption: 11px / 400 weight
- Code: 12px / 400 weight / JetBrains Mono

## 4. Spacing & Layout

- **Base unit:** 4px grid
- **Bento gap:** 12px between cells
- **Bento cell radius:** 12px (standard), 16px (large/hero)
- **Button radius:** 6px
- **Input radius:** 6px
- **Modal radius:** 10px
- **Shadows:** sm (1px 2px), md (4px 12px), lg (10px 30px) — all rgba(0,0,0,0.15-0.25)
- **Transitions:** 150ms hover, 200ms panels, 250ms pages

## 5. Component Patterns

- **Glass panels:** `backdrop-filter: blur(20px)` + glass-bg + glass-border → rail, toolbar, sidebar, status bar
- **Bento cells:** Surface-elevated bg, 1px border, 12px radius, shadow-md on hover
- **Buttons:** Primary (accent bg, white text), Secondary (surface bg, border, text color)
- **Sidebar items:** 6px radius, 6px 12px padding, selection bg when active
- **Table rows:** 32px height, border-bottom, hover surface-hover
- **Inputs:** 6px 10px padding, border, focus ring (accent 3px spread)
- **Icons:** Lucide React only, 16px (inline) or 20px (standalone)

## 6. Design System Notes for Stitch Generation

**DESIGN SYSTEM (REQUIRED):**
- Platform: Desktop (Electron), macOS-native feel
- Theme: Dark mode primary, glass/vibrancy effects
- Background: Deep Dark (#1E1E1E)
- Surface: Dark Gray (#252526) for panels
- Surface Elevated: Slightly Lighter (#2A2A2C) for bento cells and cards
- Primary Accent: macOS Blue (#0A84FF) for interactive elements, active states
- Text Primary: Light Gray (#E5E5E5)
- Text Secondary: Muted Gray (#999999)
- Success: macOS Green (#32D74B) for completed/online states
- Warning: macOS Yellow (#FFD60A) for pending/caution states
- Destructive: macOS Red (#FF453A) for errors/delete actions
- Glass Panels: rgba(30,30,30,0.72) with backdrop-filter blur(20px) and rgba(255,255,255,0.08) borders
- Font: Inter for UI, JetBrains Mono for code
- Body text: 13px, Labels: 12px, Captions: 11px
- Spacing: 4px base grid, 12px bento gap
- Border radius: 6px buttons/inputs, 12px cards/bento, 10px modals
- Icons: Lucide React style (simple, 2px stroke)
- Shadows: subtle with rgba(0,0,0,0.15-0.25)
- Transitions: 150ms hover, 200ms panels
- Compact density: 32px row heights, 36px toolbar, 28px status bar
- NO emojis for icons — use clean SVG icons only
