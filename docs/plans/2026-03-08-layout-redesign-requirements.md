# Requirements — Layout Redesign

**Date:** 2026-03-08

---

## REQ-SHELL: App Shell

### REQ-SHELL-01: Rail Navigation
- Rail cố định 48px bên trái, `glass-panel`, `border-border/50` right border
- Luôn visible, không collapsible
- Home button (`LayoutDashboard` icon) luôn ở vị trí đầu tiên
- Danh sách project icons: avatar 32×32, `rounded-lg`, hiển thị 2 ký tự đầu tên project
- Project đang active có accent bar 3px (`var(--accent)`) bên trái
- Nút `+` tạo project mới luôn ở cuối danh sách
- Hover project icon hiện tooltip full tên project
- Danh sách project scrollable khi nhiều project
- Click Home → `setActiveProject(null)` → hiện Home Dashboard
- Click project icon → `setActiveProject(id)` → hiện kanban hoặc last active tab

### REQ-SHELL-02: Rail Context Menu
- Right-click project icon mở context menu: Rename, Settings, Delete
- Rename → inline edit hoặc modal
- Settings → `openSettingsTab(projectId)`
- Delete → confirmation modal (`DeleteProjectModal`)

### REQ-SHELL-03: Rail Reorder *(nice-to-have)*
- Drag-to-reorder project icons trên rail
- Lưu thứ tự vào `projectOrder[]` trong store, persist qua sessions

### REQ-SHELL-04: Toolbar
- Cao 36px, `glass-panel`, `border-border/50` bottom border
- Drag region (`-webkit-app-region: drag`) để kéo cửa sổ
- Traffic lights macOS tích hợp (`titleBarStyle: hiddenInset`)
- Tab bar ở giữa, scoped theo `activeProjectId`
  - Chỉ hiện tabs của project đang active (`tabsByProject[activeProjectId]`)
  - Home không có tabs → ẩn tab bar
- Right actions (no-drag): search trigger (Cmd+K), notifications bell, theme toggle

### REQ-SHELL-05: Sidebar
- Rộng 240px, collapsible via Cmd+B
- `glass-panel`, `border-border/50` right border
- Auto show/hide theo context:
  - **Hidden**: Home, Project kanban, Settings
  - **Visible**: Ticket detail (hiện workflow steps)
- Khi visible, hiện `TicketSidebar` component

### REQ-SHELL-06: Inspector
- Rộng 320px, collapsible via Cmd+I
- Slide in/out animation 200ms ease
- Nội dung context-dependent:
  - **MessageDetailPanel**: hiện full detail khi click collapsed message trong session
  - **FigmaViewerPanel**: hiện Figma viewer ad-hoc qua Cmd+K
  - **DiffViewer**: hiện code diff khi cần
- Hidden by default, chỉ mở khi có content cần hiện

### REQ-SHELL-07: Status Bar
- Cao 28px, `glass-panel`, `border-border/50` top border
- Left: connection status dot (green/red) + backend version
- Right: active session status, duration, token count, estimated cost

### REQ-SHELL-08: Sidebar Visibility Logic
- `AppLayout` tự xác định context từ `activeProjectId` + active tab type
- Không project → Home → sidebar hidden
- Có project, không tab → Kanban → sidebar hidden
- Có project, `SettingsTab` active → sidebar hidden
- Có project, `TicketTab` active → sidebar visible

---

## REQ-HOME: Home Dashboard

### REQ-HOME-01: Needs Attention Section
- Bento grid 3 cột (`bento-grid-3`)
- Mỗi card (`bento-cell`) hiện: ticket key, status badge, project name
- Lọc tickets có status: review pending, agent failed, agent needs input
- Click card → `setActiveProject(projectId)` + `openTicketTab(ticketId)`

### REQ-HOME-02: Running Now Section
- Bento grid 3 cột
- Mỗi card hiện: ticket key, current step name, progress indicator (spinner/percentage)
- Lọc tickets có active agent session đang chạy
- Click card → navigate đến ticket Sessions tab

### REQ-HOME-03: Recent Activity Section
- Compact list view (không phải bento grid)
- Mỗi row: ticket key + event description + relative time (e.g., "2m ago")
- Dữ liệu từ notification/activity events across all projects
- Sắp xếp mới nhất trước

### REQ-HOME-04: Empty State
- Khi không có ticket nào active: hiện message "No active tickets. Select a project to get started."
- Centered, muted text

### REQ-HOME-05: Auto-refresh
- Subscribe WebSocket notification events để real-time update
- Fallback: polling interval nếu WS disconnect
- *(Phase 1: mock data, phase 2: real API)*

### REQ-HOME-06: Layout Rules
- Không sidebar, không inspector
- Full-width main content
- Không có tabs trên toolbar

---

## REQ-KANBAN: Project View (Kanban)

### REQ-KANBAN-01: Kanban Board
- Full-width, không sidebar, không inspector
- 4 columns theo ticket status: **Backlog** → **In Progress** → **Review** → **Done**
- Column header hiện tên status + count tickets
- Mỗi column scrollable độc lập

### REQ-KANBAN-02: Ticket Cards
- Mỗi card hiện: ticket key (e.g., `T-14`), title, type badge (feat/bug/refactor/chore/spike), priority indicator
- Active step indicator: nhỏ, hiện tên step đang chạy hoặc icon status
- Click card → `openTicketTab(projectId, ticketId, title)` → thêm tab trên toolbar

### REQ-KANBAN-03: Drag & Drop
- Kéo ticket card giữa columns → update ticket status
- Visual feedback khi đang drag (ghost card, drop zone highlight)
- Optimistic update + API call

### REQ-KANBAN-04: List View
- Toggle view mode qua button (Board / List)
- DataTable columns: Key, Title, Type (badge), Status (badge), Priority
- Click row → mở ticket tab (same behavior)
- Sortable columns

### REQ-KANBAN-05: New Ticket
- Nút "+ New Ticket" ở header
- Click → `CreateTicketModal` → sau khi tạo:
  1. `openTicketTab(projectId, ticketId, title)`
  2. Auto-navigate đến Sessions tab
  3. Auto-start brainstorm workflow step

### REQ-KANBAN-06: Toolbar Context
- Toolbar hiện tabs của project hiện tại
- Nếu chưa có tab nào → kanban là default view (không cần tab)
- Khi mở ticket/settings → tab xuất hiện trên toolbar

---

## REQ-TICKET: Ticket Detail

### REQ-TICKET-01: Header
- Ticket key (e.g., `T-14`) + type badge + status badge
- Title editable inline (click to edit, blur/Enter to save)
- Header sticky khi scroll

### REQ-TICKET-02: Segmented Control
- 2 segments: **Overview** | **Sessions**
- Default: Overview (nếu không có active session), Sessions (nếu có active session)
- Persist lựa chọn per-ticket trong tab state

### REQ-TICKET-03: Overview Tab
- **Ticket info**: description, created date, assigned agent
- **Specs bento grid**: 4 cards (feature spec, design spec, plan spec, test spec)
  - Mỗi card: title, version number, last updated, edit button
  - Click → mở editor (Tiptap) cho spec đó
- **Figma references**: thumbnail links đến Figma designs nếu có
- **Tasks checklist**: workflow tasks với checkbox, status badge, assignee
- **Activity log**: timeline events (status changes, comments, agent actions)

### REQ-TICKET-04: Sessions Tab
- Hiện transcript của agent sessions cho ticket này
- Sessions grouped theo workflow step
- Session header: step name, session number, status badge, duration, token/cost
- Active session auto-scroll xuống message mới nhất
- Completed sessions scroll tự do

### REQ-TICKET-05: Workflow Steps Sidebar
- Hiện tất cả steps của ticket workflow theo thứ tự dọc
- Status icons per step:
  - `✓` (checkmark, green) — completed
  - `●` (filled dot, accent) — active
  - `◌` (spinner, animated) — running
  - `✗` (x, red) — failed
  - `○` (empty dot, muted) — pending
- Mỗi step expandable → hiện sessions bên trong:
  - Session #1 (completed), Session #2 (running), ...
- Click step → Sessions tab filter/scroll đến sessions của step đó
- Click session → scroll đến session cụ thể

---

## REQ-SESSION: Session Message Rendering

### REQ-SESSION-01: Text Message (Assistant)
- Hiện full content inline, markdown rendered
- Font: body 13px, code blocks 12px JetBrains Mono
- No collapse, no inspector interaction

### REQ-SESSION-02: Tool Call — Read/Edit/Write
- **Collapsed**: icon (File) + filename + operation label (Read/Edit/Write)
- **Click** → Inspector hiện: file path, full file content với line numbers, syntax highlighting
- Edit operations: hiện diff (old → new)

### REQ-SESSION-03: Tool Call — Bash
- **Collapsed**: icon (Terminal) + command summary (truncate dài)
- **Click** → Inspector hiện: full command, exit code, complete stdout/stderr output
- Error output highlighted red

### REQ-SESSION-04: Subagent Message
- **Collapsed**: icon (Bot) + "Subagent: [description]"
- **Click** → Inspector hiện: full subagent transcript (nested messages)
- Có thể recursive nếu subagent gọi subagent

### REQ-SESSION-05: Todo List
- **Collapsed**: icon (CheckSquare) + "Todo: N/M done" (e.g., "Todo: 3/5 done")
- **Click** → Inspector hiện: full checklist, mỗi item có status (done/pending/in-progress)
- Progress bar visual

### REQ-SESSION-06: Skill Invocation
- **Collapsed**: icon (Sparkles) + "Skill: [name]"
- **Click** → Inspector hiện: skill name, content/output

### REQ-SESSION-07: Error Message
- **Collapsed**: icon (AlertCircle, red) + error summary (first line)
- Background tint đỏ nhẹ cho collapsed row
- **Click** → Inspector hiện: full error message, stack trace, context

### REQ-SESSION-08: Session Auto-scroll
- Active session (running): auto-scroll xuống message mới nhất
- User scroll lên → pause auto-scroll
- Nút "Jump to bottom" khi user đang ở trên
- Completed session: scroll tự do, không auto-scroll

### REQ-SESSION-09: Session Header
- Hiện ở đầu mỗi session block
- Nội dung: step name, session number (#1, #2...), status badge, duration, token count, cost
- Collapsible: click header → collapse/expand toàn bộ session

---

## REQ-BRAIN: Brainstorm (Workflow Step)

### REQ-BRAIN-01: Embedded in Sessions Tab
- Khi brainstorm step active, Sessions tab render brainstorm UI thay vì transcript
- Không còn screen/tab riêng

### REQ-BRAIN-02: Chat Interface
- Conversation format: user messages + AI responses
- Input bar ở bottom, Enter gửi, Shift+Enter newline
- AI responses streaming (typing indicator)

### REQ-BRAIN-03: Quiz Components
- AI có thể gửi quiz questions (single-select, multi-select)
- Options hiện dạng cards/buttons
- Recommended option có badge highlight
- User chọn → gửi answer → AI tiếp tục conversation

### REQ-BRAIN-04: Summary & Review
- Khi brainstorm kết thúc, AI generate summary
- Hiện trong Tiptap rich editor để user review/edit
- Nút "Confirm" → specs được tạo/update, workflow chuyển sang step tiếp

### REQ-BRAIN-05: Transition
- Sau confirm, brainstorm step status → completed
- Auto-transition sang Specs step (hoặc step tiếp theo trong workflow)
- Sidebar update step status

---

## REQ-FIGMA: Figma Integration

### REQ-FIGMA-01: Workflow Step Mode
- Khi Figma step active trong workflow, main content hiện Figma viewer
- 3 panels: Node tree (left), Canvas (center), Annotation panel (right)
- Node tree: cây hierarchy các Figma nodes, click để select
- Canvas: render preview design, zoom/pan
- Annotation panel: thêm notes, đánh dấu elements

### REQ-FIGMA-02: Ad-hoc Mode (Cmd+K)
- User gõ Cmd+K → search "Figma" → chọn Figma file/frame
- Inspector panel mở và hiện Figma viewer
- Main content không thay đổi (vẫn ở session/overview)
- Cho phép reference design trong khi đang làm việc khác

### REQ-FIGMA-03: Output Export
- Nút "Export to Specs" trong Figma viewer
- Generate structured markdown từ annotations + selected nodes
- Append vào ticket's design spec
- Lưu reference link (Figma URL + node IDs) vào ticket

---

## REQ-REVIEW: Code Review (Workflow Step)

### REQ-REVIEW-01: Diff Viewer
- Hiện code changes với syntax highlighting
- Side-by-side hoặc unified diff view (toggle)
- Line numbers, additions (green), deletions (red)

### REQ-REVIEW-02: File Tree
- Sidebar hoặc panel hiện danh sách files thay đổi
- Icon per file type, badge cho added/modified/deleted
- Click file → scroll đến diff section tương ứng

### REQ-REVIEW-03: Inline Comments
- Click vào dòng code → thêm comment
- Comment thread per line (reply support)
- Resolved/unresolved status

### REQ-REVIEW-04: Actions
- Action bar: **Approve**, **Request Changes**, **Reject**
- Approve → workflow step completed, chuyển sang step tiếp
- Request Changes → agent nhận feedback, tạo session mới để fix
- Reject → workflow step failed

### REQ-REVIEW-05: Test Results
- Panel hiện kết quả test liên quan
- Pass/fail per test case, expandable cho output detail
- Link đến test file

---

## REQ-SETTINGS: Project Settings

### REQ-SETTINGS-01: Tab & Layout
- Mở dạng `SettingsTab` trên toolbar (id: `settings-{projectId}`)
- Full-width scrollable page
- Không sidebar, không inspector
- Access: rail right-click → Settings, hoặc Cmd+K → "Settings"

### REQ-SETTINGS-02: Sticky Anchor Menu
- Menu ngang sticky ở top: [General] [Repos] [Agents] [Templates] [GitHub]
- Click anchor → smooth scroll đến section tương ứng
- Intersection observer highlight anchor section đang trong viewport

### REQ-SETTINGS-03: General Section
- Fields: Project name, slug (auto-generate từ name), path, repo URL, description
- Auto-approval toggle (ON/OFF) — cho phép agent tự approve steps
- Save on blur hoặc nút Save

### REQ-SETTINGS-04: Repositories Section
- Bento grid cards hiện connected repos
- Mỗi card: repo name, URL, connection status
- Nút "Add" → `ConnectReposModal`
- Remove repo: icon button trên card → confirmation

### REQ-SETTINGS-05: Agents Section
- Bento grid cards hiện agent configurations
- 5 default agents: Planner, Coder, Tester, Designer, Reviewer
- Mỗi card: agent name, role, model, status
- Actions per card: Edit, Duplicate, Reset to default
- Nút "Add" → tạo custom agent

### REQ-SETTINGS-06: Templates Section
- Bento grid cards hiện workflow templates
- Default templates: Full Feature, Bug Fix, Refactor
- Mỗi card: template name, step count, description
- Nút "Add" → tạo custom template
- Click card → view/edit template steps

### REQ-SETTINGS-07: GitHub Section
- Cards hiện connected GitHub accounts
- Mỗi card: username, avatar, connected date, status
- Nút "Add" → OAuth flow connect GitHub account
- Remove account: icon button → confirmation

---

## REQ-MODAL: Modals

### REQ-MODAL-01: Create Project
- Fields: name (required), path (directory picker), description (optional)
- Validate: name unique, path exists
- On submit: API create → `setActiveProject(newId)` → navigate đến project

### REQ-MODAL-02: Create Ticket
- Fields: title (required), type (select: feature/bug/improvement/chore/spike), priority (select: low/medium/high/critical)
- Project auto-selected từ active project
- On submit: API create → open ticket tab → start brainstorm

### REQ-MODAL-03: Delete Project
- Confirmation dialog: "Delete [project name]? This cannot be undone."
- Input confirm: type project name để xác nhận
- On confirm: API delete → remove from rail → navigate Home

### REQ-MODAL-04: Connect Repos
- Step 1: chọn GitHub account (từ connected accounts)
- Step 2: search/select repository
- Step 3: confirm connection
- On complete: repo card xuất hiện trong Settings > Repos

---

## REQ-STATE: State Management

### REQ-STATE-01: Project Nav Store
- `activeProjectId: string | null` — project đang chọn trên rail
- `projectOrder: string[]` — thứ tự project trên rail
- `setActiveProject(id)` — đổi project active
- `reorderProjects(ids)` — cập nhật thứ tự (drag-to-reorder)
- Persist: localStorage

### REQ-STATE-02: Tab Store
- `tabsByProject: Record<string, AppTab[]>` — tabs scoped per project
- `activeTabByProject: Record<string, string>` — active tab per project
- `openTicketTab(projectId, ticketId, label)` — mở/focus ticket tab
- `openSettingsTab(projectId)` — mở/focus settings tab
- `closeTab(projectId, tabId)` — đóng tab, chuyển sang tab kế
- `setActiveTab(projectId, tabId)` — switch active tab
- `updateTabLabel(projectId, tabId, label)` — cập nhật label tab
- Persist: localStorage
- Dedup: nếu tab đã tồn tại → focus thay vì tạo mới

### REQ-STATE-03: Sidebar Store
- `isOpen: boolean` — sidebar đang mở/đóng
- `toggle()` — toggle via Cmd+B
- Auto-override: sidebar forced hidden ở Home/Kanban/Settings context

### REQ-STATE-04: Inspector Store
- `isOpen: boolean` — inspector đang mở/đóng
- `content: InspectorContent | null` — nội dung đang hiện
- `open(content)` — mở inspector với content cụ thể
- `close()` — đóng inspector
- Content types: `MessageDetail`, `FigmaViewer`, `DiffViewer`

---

## REQ-KB: Keyboard Shortcuts

### REQ-KB-01: Global Shortcuts
| Shortcut | Action | Context |
|----------|--------|---------|
| `Cmd+K` | Mở command palette | Global |
| `Cmd+B` | Toggle sidebar | Global |
| `Cmd+I` | Toggle inspector | Global |
| `Cmd+N` | New session / new ticket | Project context |
| `Cmd+W` | Close active tab | Có tab active |
| `Cmd+,` | Open settings | Project context |
| `Cmd+1-9` | Switch tab theo index | Có tabs |
| `Cmd+F` | Search trong session | Session view |

### REQ-KB-02: Behavior
- Shortcuts hoạt động global, không bị block bởi input focus (trừ Cmd+F)
- Cmd+W khi tab cuối → quay về kanban view
- Cmd+, khi không có project → no-op

---

## REQ-DESIGN: Design Constraints

### REQ-DESIGN-01: Design System Compliance
- Tất cả UI tuân theo `docs/design/design-system.md`
- Bento grid cho card layouts (`bento-grid-2/3/4`, `bento-cell`, `bento-cell-lg`)
- Glass panel cho chrome elements (rail, toolbar, sidebar, status bar)
- Color tokens từ design system — không dùng ad-hoc colors
- Typography: Inter (body) + JetBrains Mono (code), sizes theo spec
- Spacing: 4px base grid
- Border radius: 6px buttons, 12px bento cells
- Shadows: `--shadow-sm/md/lg` theo elevation
- Transitions: 150ms+ hover, 200ms panels
- Icons: Lucide React only
