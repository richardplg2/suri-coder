# Figma Design Annotator Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade `figma-viewer.html` prototype to export annotated Figma designs as structured Markdown for AI agent consumption.

**Architecture:** Single HTML file, all client-side. Connects to Figma via WebSocket (cursor-talk-to-figma-mcp). Adds Markdown export engine, style toggle, annotation counter, and UX improvements to existing prototype.

**Tech Stack:** Vanilla HTML/CSS/JS (no build tools), WebSocket API, Figma MCP protocol.

---

### Task 1: Add Markdown export engine (`generateMarkdown` function)

**Files:**
- Modify: `figma-viewer.html:216-596` (script section)

**Step 1: Add `generateMarkdown` function after the `exportAnnotations` function (line ~579)**

This is the core logic. It walks the original `nodeTree` recursively and outputs Markdown.

```javascript
// ---- Export as Markdown ----
function generateMarkdown() {
  if (!nodeTree) return '';

  const includeStyles = document.getElementById('includeStylesToggle')?.checked || false;
  const lines = [];
  const rootBBox = nodeTree.absoluteBoundingBox;

  // Header
  lines.push(`# Screen: ${nodeTree.name}`);
  lines.push(`> Exported from Figma | Type: ${nodeTree.type} | Size: ${Math.round(rootBBox.width)}×${Math.round(rootBBox.height)}`);
  lines.push('');
  lines.push('## Structure');
  lines.push('');

  function hasImageFill(node) {
    return node.fills?.some(f => f.type === 'IMAGE');
  }

  function formatStyle(node) {
    if (!includeStyles || !node.style) return '';
    const s = node.style;
    const parts = [];
    if (s.fontFamily) parts.push(`font: ${s.fontFamily} ${s.fontStyle || ''} ${s.fontSize ? Math.round(s.fontSize) + 'px' : ''}`);
    if (node.fills?.length) {
      const solidFill = node.fills.find(f => f.type === 'SOLID' && f.color);
      if (solidFill) parts.push(`color: ${solidFill.color}`);
    }
    return parts.length ? ` — _${parts.join(', ')}_` : '';
  }

  function walkNode(node, depth) {
    const bbox = node.absoluteBoundingBox;
    const size = bbox ? `${Math.round(bbox.width)}×${Math.round(bbox.height)}` : '';
    const anno = annotations[node.id];
    const styleStr = formatStyle(node);

    if (depth === 1) {
      // Direct children of root → h3
      lines.push(`### ${node.name} (${node.type}${size ? ', ' + size : ''})${styleStr}`);
      if (node.characters) lines.push(`Text: "${node.characters}"`);
      if (hasImageFill(node)) lines.push(`[Image: ${node.name}, ${size}]`);
      if (anno) { lines.push(''); lines.push(`> ${anno.text}`); }
      lines.push('');
    } else if (depth >= 2) {
      // Deeper nodes → bullets with indent
      const indent = '  '.repeat(depth - 2);
      let line = `${indent}- **${node.name}** (${node.type})`;
      if (node.characters) line += `: "${node.characters}"`;
      if (size && !node.characters) line += ` [${size}]`;
      line += styleStr;
      lines.push(line);
      if (hasImageFill(node)) lines.push(`${indent}  [Image: ${node.name}, ${size}]`);
      if (anno) lines.push(`${indent}  > ${anno.text}`);
    }

    if (node.children) {
      for (const child of node.children) {
        walkNode(child, depth + 1);
      }
    }
  }

  walkNode(nodeTree, 0);
  return lines.join('\n');
}
```

**Step 2: Add `exportMarkdown` function right after `generateMarkdown`**

```javascript
function exportMarkdown() {
  const md = generateMarkdown();
  if (!md) { log('No design loaded', 'error'); return; }

  const blob = new Blob([md], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const filename = nodeTree ? `${nodeTree.name.replace(/[^a-zA-Z0-9-_ ]/g, '')}-design.md` : 'design.md';
  a.href = url; a.download = filename;
  a.click(); URL.revokeObjectURL(url);
  log(`Exported: ${filename}`, 'success');
}
```

**Step 3: Verify by opening in browser, loading a design, checking `generateMarkdown()` in console**

Open browser console, run: `generateMarkdown()`
Expected: Returns markdown string with node hierarchy.

**Step 4: Commit**

```bash
git add figma-viewer.html
git commit -m "feat: add Markdown export engine for Figma design annotator"
```

---

### Task 2: Add toolbar UI — Export button, Include Styles toggle, Annotation counter

**Files:**
- Modify: `figma-viewer.html:174-178` (toolbar HTML)
- Modify: `figma-viewer.html` (CSS for toggle)

**Step 1: Replace the toolbar HTML (lines 174-178)**

Replace the existing toolbar div:

```html
  <div class="toolbar">
    <span class="info" id="docInfo">No document loaded</span>
    <span class="anno-counter" id="annoCounter"></span>
    <span style="flex:1"></span>
    <label class="toggle-label">
      <input type="checkbox" id="includeStylesToggle"> Include styles
    </label>
    <button class="btn btn-secondary" onclick="toggleAnnotationPanel()" style="font-size: 11px;">Annotations (<span id="annoCount">0</span>)</button>
    <button class="btn btn-primary" onclick="exportMarkdown()" style="font-size: 11px;" id="exportBtn">Export Markdown</button>
  </div>
```

**Step 2: Add CSS for the toggle and counter**

Add after the `.log .success` rule (around line 146):

```css
  .toggle-label { font-size: 11px; color: #8892b0; display: flex; align-items: center; gap: 4px; cursor: pointer; }
  .toggle-label input { accent-color: #64ffda; }
  .anno-counter { font-size: 11px; color: #f59e0b; margin-left: 8px; }
```

**Step 3: Update annotation counter in `renderAnnotationsList`**

In the existing `renderAnnotationsList` function, after `document.getElementById('annoCount').textContent = entries.length;`, add:

```javascript
  const total = flatNodes.length;
  document.getElementById('annoCounter').textContent = entries.length > 0 ? `${entries.length}/${total} nodes annotated` : '';
```

**Step 4: Test in browser**

- Toolbar should show: doc info | counter | flex space | toggle | Annotations btn | Export Markdown btn
- Counter updates when annotations are added/removed

**Step 5: Commit**

```bash
git add figma-viewer.html
git commit -m "feat: add toolbar with export button, styles toggle, annotation counter"
```

---

### Task 3: Add Markdown preview panel

**Files:**
- Modify: `figma-viewer.html` (HTML + CSS + JS)

**Step 1: Add CSS for preview modal**

Add after toggle-label CSS:

```css
  .preview-overlay {
    position: fixed; inset: 0; background: #000000cc; z-index: 100;
    display: flex; align-items: center; justify-content: center;
  }
  .preview-overlay.hidden { display: none; }
  .preview-modal {
    background: #16213e; border-radius: 8px; width: 70vw; max-height: 85vh;
    display: flex; flex-direction: column; border: 1px solid #2a2a4a;
  }
  .preview-header {
    padding: 12px 16px; border-bottom: 1px solid #2a2a4a;
    display: flex; justify-content: space-between; align-items: center;
  }
  .preview-header h3 { font-size: 14px; }
  .preview-body { flex: 1; overflow-y: auto; padding: 16px; }
  .preview-body pre {
    background: #0f1a30; padding: 16px; border-radius: 6px; font-size: 12px;
    color: #c0d0e0; white-space: pre-wrap; word-wrap: break-word; line-height: 1.6;
    font-family: 'SF Mono', 'Fira Code', monospace;
  }
  .preview-footer { padding: 12px 16px; border-top: 1px solid #2a2a4a; display: flex; gap: 8px; justify-content: flex-end; }
```

**Step 2: Add preview modal HTML before closing `</body>`**

```html
<div class="preview-overlay hidden" id="previewOverlay" onclick="closePreview(event)">
  <div class="preview-modal" onclick="event.stopPropagation()">
    <div class="preview-header">
      <h3>Markdown Preview</h3>
      <span class="close-btn" onclick="closePreview()" style="cursor:pointer; color: #8892b0; font-size: 18px;">&times;</span>
    </div>
    <div class="preview-body"><pre id="previewContent"></pre></div>
    <div class="preview-footer">
      <button class="btn btn-secondary" onclick="copyMarkdown()">Copy to Clipboard</button>
      <button class="btn btn-primary" onclick="exportMarkdown()">Download .md</button>
    </div>
  </div>
</div>
```

**Step 3: Add preview JS functions**

```javascript
function showPreview() {
  const md = generateMarkdown();
  if (!md) { log('No design loaded', 'error'); return; }
  document.getElementById('previewContent').textContent = md;
  document.getElementById('previewOverlay').classList.remove('hidden');
}

function closePreview(event) {
  if (!event || event.target === document.getElementById('previewOverlay')) {
    document.getElementById('previewOverlay').classList.add('hidden');
  }
}

function copyMarkdown() {
  const md = generateMarkdown();
  navigator.clipboard.writeText(md).then(() => log('Copied to clipboard', 'success'));
}
```

**Step 4: Change the Export Markdown button to show preview first**

Change `onclick="exportMarkdown()"` to `onclick="showPreview()"` on the Export Markdown button.

**Step 5: Test in browser**

- Click Export Markdown → modal opens with Markdown preview
- Can copy to clipboard or download from modal
- Click outside or × to close

**Step 6: Commit**

```bash
git add figma-viewer.html
git commit -m "feat: add Markdown preview modal with copy and download"
```

---

### Task 4: Store nodeTree with original children for Markdown walk

**Files:**
- Modify: `figma-viewer.html` (script section)

**Step 1: Fix `flattenNodes` to not lose children reference**

Currently `flattenNodes` spreads the node and sets `children: undefined`. This breaks `generateMarkdown` which needs to walk the original tree. The fix: `nodeTree` is already preserved as-is. `flatNodes` is only used for rendering overlays/tree — it doesn't need children. Verify that `generateMarkdown` uses `nodeTree` (the original tree), not `flatNodes`.

Check: `generateMarkdown` calls `walkNode(nodeTree, 0)` — correct, it walks the original tree with children intact.

No code change needed. Mark as verified.

**Step 2: Commit (skip — no changes)**

---

### Task 5: End-to-end test with Playwright

**Files:**
- No new files (manual test using playwright-cli)

**Step 1: Start HTTP server and open page**

```bash
python3 -m http.server 8899 &
playwright-cli open http://localhost:8899/figma-viewer.html
```

**Step 2: Connect and load design**

```bash
playwright-cli click e10   # Connect
# wait 1s
playwright-cli click e11   # Load Design
# wait 5s
playwright-cli snapshot    # Verify node tree loaded
```

**Step 3: Select a node and add annotation**

```bash
# Click a TEXT node in tree (ref from snapshot)
playwright-cli click <text-node-ref>
# Fill annotation
playwright-cli fill <textarea-ref> "This is the card title. Displays note name."
# Click Save Note
playwright-cli click <save-btn-ref>
```

**Step 4: Click Export Markdown and verify preview**

```bash
playwright-cli click <export-btn-ref>
playwright-cli snapshot  # Should show preview modal with Markdown content
playwright-cli screenshot --filename=figma-annotator-export.png
```

**Step 5: Verify Markdown output**

```bash
playwright-cli eval "generateMarkdown()"
```

Expected: Markdown string containing:
- `# Screen: Frame 1597880922`
- Node hierarchy with correct indentation
- Annotation text where added
- `[Image: ...]` placeholders for image fills
- No base64 data

**Step 6: Commit all changes**

```bash
git add figma-viewer.html docs/plans/
git commit -m "feat: Figma Design Annotator with Markdown export for AI agents"
```
