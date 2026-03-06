# Figma Pipeline — Screen Design

> Overrides: This file extends `docs/design/design-system.md`.

## Overview

Multi-step pipeline to convert Figma designs into React components. Four steps: Setup (connect Figma), Map (define node-to-component mappings), Generate (AI creates code), Review (preview and iterate).

## Wireframe

```
┌────────┬──────────────────────────────┬─────────────────┐
│Sidebar │  Steps: [1.Setup] [2.Map]    │  Preview Panel  │
│        │         [3.Generate] [4.Rev] │                  │
│        ├──────────────────────────────┤  ┌───────────┐  │
│        │                              │  │ Figma     │  │
│        │  Figma URL: [____________]   │  │ Node      │  │
│        │  Status: ● Connected         │  │ Preview   │  │
│        │                              │  │ (image)   │  │
│        │  Node Mappings:              │  └───────────┘  │
│        │  ┌────────────────────────┐  │                  │
│        │  │ Node: header-nav       │  │  Generated Code  │
│        │  │ Component: Navbar      │  │  ┌───────────┐  │
│        │  │ Props: {links, logo}   │  │  │ CodeBlock │  │
│        │  │ [Edit] [Generate]      │  │  │           │  │
│        │  └────────────────────────┘  │  └───────────┘  │
│        │  [+ Add Node]               │                  │
└────────┴──────────────────────────────┴─────────────────┘
```

## Component Mapping

| Area | Component | Props/Config | Notes |
|------|-----------|-------------|-------|
| Header | `SegmentedControl` | items: ["1.Setup", "2.Map", "3.Generate", "4.Review"] | Step indicator, clickable |
| Content (Setup) | Input field | Figma URL | With `StatusBadge` for connection |
| Content (Map) | Card list | Node mapping cards | Form-based, one per node |
| Content (Generate) | `ProgressBar` | Per-node generation progress | With streaming status |
| Content (Review) | `DiffViewer` | Generated code diffs | Side-by-side |
| Inspector | Image preview | Figma node screenshot | Loaded from Figma API |
| Inspector | `CodeBlock` | Generated component code | Syntax highlighted |
| Footer | `Button` | "+ Add Node" | Add new mapping |

## States per Step

### 1. Setup
- **Empty**: Input field with placeholder "Paste Figma file URL..."
- **Connecting**: `Spinner` + "Connecting to Figma..."
- **Connected**: `StatusBadge` green + file name displayed
- **Error**: `StatusBadge` red + error message

### 2. Map
- **Empty**: `EmptyState` — "Add your first node mapping"
- **Editing**: Card expanded with form fields (node ID, component name, props)
- **Populated**: List of mapping cards, each showing summary

### 3. Generate
- **Idle**: "Ready to generate" with Generate All button
- **Running**: `ProgressBar` per node + `StreamingText` in inspector
- **Complete**: All nodes show `StatusBadge` green

### 4. Review
- **Default**: `DiffViewer` showing generated files
- **With feedback**: Inline comments on generated code

## Interactions

| Action | Trigger | Behavior |
|--------|---------|----------|
| Navigate steps | Click SegmentedControl | Switch to step view |
| Connect Figma | Paste URL + Enter | Validate and connect |
| Add node | Click "+ Add Node" | New empty mapping card |
| Edit mapping | Click Edit on card | Expand card with form |
| Generate single | Click Generate on card | Generate that node's component |
| Generate all | Click "Generate All" | Sequential generation with progress |
| Preview node | Click mapping card | Show Figma preview in inspector |
