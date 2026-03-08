---
page: workflow-template-editor
---
Design a Workflow Template Editor screen for the workflow manager app. This is where users create and edit reusable DAG-based workflow templates that define how tickets are processed.

**CONTENT ONLY — no app shell, header, sidebar, or status bar. Just the main content area.**

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

**Page Structure:**

Two-panel layout (40/60 split):

**Left Panel — Template Config:**
- Template name (editable text input)
- Description (textarea, 2 rows)
- Category dropdown (Full Feature, Bug Fix, Refactor, Custom)
- Steps list: each step shows icon, name, agent assignment, and drag handle for reordering
- "Add Step" button at bottom
- Each step expandable to show: agent dropdown, description, condition field, expandable toggle, requires_approval toggle

**Right Panel — DAG Visualization:**
- Visual node graph showing workflow steps as connected nodes
- Nodes: rounded rectangles with agent icon, step name, and status color
- Edges: curved arrows showing dependencies between steps
- Parallel branches shown side by side
- Interactive: click node to select and edit in left panel
- Toolbar above graph: Zoom in/out, Fit to screen, Auto-layout
- Shows a sample "Full Feature" template: Plan → Design (conditional) → Implement (expandable) → Test (expandable)

**Bottom bar:**
- "Cancel" secondary button left
- "Validate DAG" outline button center (checks for cycles)
- "Save Template" primary accent button right
