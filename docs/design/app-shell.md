# App Shell & Layout

macOS-native desktop app feel, combining System Preferences structure with Xcode/Tower app patterns. Dark mode primary. Developer power-user tool density.

References: Xcode, Tower (Git), TablePlus, macOS Finder.

## 3-Panel Layout

```
┌─────────────────────────────────────────────────────────┐
│ ● ● ●  [Traffic Lights]     Toolbar (translucent)       │
├────────┬──────────────────────┬──────────────────────────┤
│        │                      │                          │
│  Side  │    Main Content      │   Detail / Inspector     │
│  bar   │    Area              │   Panel (collapsible)    │
│  240px │                      │   320px                  │
│        │  (varies by feature) │  (context-dependent)     │
│  Nav   │                      │                          │
│  items │                      │                          │
│        ├──────────────────────┴──────────────────────────┤
│        │  Bottom Bar (status, session info, cost)        │
└────────┴────────────────────────────────────────────────┘
```

## Sidebar (240px, collapsible to 48px icon-only)

- **Project Selector** at top — dropdown with project avatar + name + path
- **Navigation Groups** with uppercase 11px section headers:
  - Sessions (message-square icon)
  - Skills (sparkles icon)
  - Worktrees (git-branch icon)
  - Figma Pipeline (figma icon)
  - Tests (test-tube-2 icon)
  - Reviews (file-diff icon)
- **Bottom**: settings gear, connection status dot (green/red)
- Vibrancy blur effect on background (`backdrop-filter: blur(20px)`)

## Toolbar (36px height, translucent)

- `titleBarStyle: 'hiddenInset'` for native traffic light integration
- Draggable region (`-webkit-app-region: drag`)
- Right side: search trigger (Cmd+K), notifications bell, theme toggle
- Buttons use `no-drag` to remain clickable

## Detail/Inspector Panel (320px, collapsible)

- Context-dependent content per feature
- Slide in/out with 200ms ease transition
- Toggle via toolbar button or keyboard shortcut

## Bottom Status Bar (28px)

- Left: connection status, backend version
- Right: active session status dot, duration, token count, cost

## Electron Window Configuration

```typescript
const mainWindow = new BrowserWindow({
  width: 1440,
  height: 900,
  minWidth: 1024,
  minHeight: 600,
  titleBarStyle: 'hiddenInset',
  trafficLightPosition: { x: 16, y: 12 },
  vibrancy: 'sidebar',                    // macOS only
  backgroundColor: '#1E1E1E',
  webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
  },
})
```

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Command Palette | `Cmd+K` |
| New Session | `Cmd+N` |
| Close Tab | `Cmd+W` |
| Toggle Sidebar | `Cmd+B` |
| Toggle Inspector | `Cmd+I` |
| Settings | `Cmd+,` |
| Send Message | `Enter` |
| Newline in Input | `Shift+Enter` |
| Navigate Tabs | `Cmd+1-9` |
| Search in Session | `Cmd+F` |

## Implementation Notes

### Tech Stack (existing)

- Electron + electron-vite
- React 19 + React Router
- Tailwind CSS v4
- Radix UI + CVA (via `@agent-coding/ui` package)
- Lucide React icons

### CSS Custom Properties Mapping

Map design tokens to shadcn/ui CSS variable convention in `globals.css`. Override the existing oklch values with the macOS palette from `design-system.md`.

### Component Build Order

1. Layout primitives: `Sidebar`, `SplitPane`, `Panel`, `Toolbar`
2. Navigation: `SidebarItem`, `ProjectSwitcher`, `TabBar`, `Breadcrumb`
3. Data display: `DataTable`, `SourceList`, `StatusBadge`, `EmptyState`
4. Input: `SearchField`, `CommandPalette`, `TextArea`, `Toggle`
5. Feedback: `Toast`, `Sheet`, `Popover`, `Spinner`
6. Feature-specific: `ChatBubble`, `StreamingText`, `ToolCallCard`, `DiffViewer`, `CodeBlock`
