# Figma Design Annotator

Extract UI requirements from Figma designs as structured Markdown for AI agents.

## Problem

AI agents need to understand UI designs to implement features, but Figma designs are visual and lack structured descriptions. Manually writing specs from designs is tedious and error-prone. Base64 image data bloats AI context windows.

## Solution

A standalone HTML tool that connects to Figma via WebSocket (cursor-talk-to-figma-mcp), lets users visually select nodes and write descriptions, then exports a clean Markdown document suitable for AI agent consumption.

## Architecture

```
Figma Plugin ←→ WebSocket Server (port 3055) ←→ figma-viewer.html (browser)
                     channel-based routing
```

All client-side. No backend required. Single HTML file.

## User Flow

1. Open `figma-viewer.html` in browser
2. Enter channel ID, click Connect (joins Figma WebSocket channel)
3. Select a frame in Figma, click Load Design
4. View exported image with interactive node overlays
5. Click any node (on image or in tree sidebar) to select it
6. Write description/annotation in the right panel
7. Repeat for all relevant nodes
8. Click Export Markdown to download `.md` file

## Data Flow

### Input (from Figma via WebSocket)

- `get_selection` → currently selected node
- `get_node_info` → full node tree with `absoluteBoundingBox`, `fills`, `style`, `characters`
- `export_node_as_image` → PNG for visual display

### Processing

- Flatten node tree, compute relative positions from root `absoluteBoundingBox`
- Render image with overlay rectangles mapped to each child node
- Store annotations in memory: `{ [nodeId]: { text, nodeName, nodeType } }`
- Selection syncs back to Figma via `set_selections`

### Output (Markdown)

```markdown
# Screen: [Frame Name]
> Exported from Figma | Page: [Page Name] | Size: [W]×[H]

## Structure

### [Section Name] (FRAME)
> User's annotation for this section

- **[Element Name]** (TEXT): "actual text content"
  > User's annotation

- **[Element Name]** (FRAME, 500×277)
  [Image: image 391, 500×277]
  > User's annotation
```

### Output Rules

- TEXT nodes: include `characters` content inline
- IMAGE fills: replace with `[Image: name, WxH]` placeholder (no base64)
- Unannotated nodes: listed in tree but without description block
- Hierarchy: heading levels map to node depth (h2 → h3 → bullet)
- Style info: opt-in toggle (font, color, spacing) — off by default

## UI Components

| Component | Location | Purpose |
|-----------|----------|---------|
| Connection bar | Left sidebar top | Channel ID input, Connect/Load buttons, status |
| Node tree | Left sidebar | Indented, color-coded by type (FRAME, TEXT, GROUP, etc.) |
| Design canvas | Center | Exported image with clickable overlay rectangles |
| Annotation panel | Right sidebar | Node details + textarea + Save Note |
| Export Markdown | Toolbar | Generate and download `.md` file |
| Include styles toggle | Toolbar | Optional: add font/color/size to output |
| Annotation counter | Toolbar | Show X/Y nodes annotated |

## Interaction Details

- **Hover sync**: hovering node in tree highlights overlay on image, and vice versa
- **Click select**: clicking node in tree or overlay selects it, opens annotation panel, syncs to Figma
- **Annotation badge**: nodes with annotations show yellow badge in both tree and overlay
- **Resize handling**: overlay positions recalculate on window resize

## Technical Details

- WebSocket message format: `{ id, type: "message", channel, message: { id, command, params } }`
- Response routing via `pendingRequests` Map with UUID matching
- Image scale factor: `imageScale = img.clientWidth / rootBBox.width`
- Overlay positioning: `(node.bbox.x - root.bbox.x) * imageScale`

## AI Agent Strategy: Image + Annotation

The Figma MCP plugin returns partial CSS data — enough for colors, typography, sizes, and border-radius, but **missing** auto-layout props (flex direction, gap, padding, alignment), shadows, strokes, opacity, and image assets.

Instead of forking the plugin, we use a **hybrid approach**:

1. **Export design as PNG** per frame/node via `export_node_as_image` — AI agent "sees" the visual layout
2. **Structured Markdown** with node hierarchy, text content, available style data, and user annotations describing behavior/interactions
3. **User annotations fill the gaps** — describe layout intent ("horizontal flex, gap 16px"), responsive behavior, states, interactions

This achieves ~80-90% CSS accuracy without modifying the Figma plugin. The AI agent combines:
- **Image** → visual understanding of spacing, alignment, proportions
- **Node tree** → component hierarchy, naming conventions
- **Style data** → exact colors, fonts, sizes, border-radius
- **Annotations** → behavior, states, interactions, layout intent

### Available Data from Figma MCP

| Data | Properties | CSS Coverage |
|------|-----------|-------------|
| Bounding box | x, y, width, height | position, width, height |
| Fills (solid) | color hex, opacity | background-color, color |
| Fills (gradient) | stops, transform | linear-gradient() |
| Corner radius | radius value | border-radius |
| Typography | fontFamily, fontSize, fontWeight, fontStyle, letterSpacing, lineHeightPx, textAlign | font-*, letter-spacing, line-height, text-align |
| Text content | characters | inner text |
| Image fills | type: IMAGE (no URL/base64) | [Image placeholder] |
| Hierarchy | parent/children tree | DOM structure |

### Missing (user describes in annotations)

| Missing | CSS Impact | Annotation Hint |
|---------|-----------|----------------|
| Auto-layout | flex-direction, display | "horizontal flex" / "vertical stack" |
| Padding | padding | "padding: 16px 24px" |
| Gap/spacing | gap | "gap: 12px between items" |
| Alignment | align-items, justify-content | "centered vertically" |
| Sizing mode | width: auto/100% | "fills container width" |
| Stroke | border | "1px solid #e0e0e0" |
| Shadow | box-shadow | "subtle shadow below" |
| Opacity | opacity | "50% opacity overlay" |
| Overflow | overflow | "scrollable content" |

## Non-Goals

- No backend/database — annotations are session-only
- No Figma write-back (annotations stay in the tool, not pushed to Figma)
- No multi-page support in v1 (load one frame at a time)
- No collaborative editing

## Existing Prototype

`figma-viewer.html` — working prototype with connect, load, node tree, overlay, annotation panel. Needs: Markdown export, style toggle, annotation counter, UX polish.
