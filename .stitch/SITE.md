# Suri Coder — Workflow Manager

## 1. Vision

A macOS-native desktop application for managing Claude Code workflow sessions. Features a rail navigation, tab-based workspace, kanban board, ticket detail views, brainstorm chat, and project settings.

## 2. Stitch Project

- **Project ID:** 12778645771598198040
- **Device:** DESKTOP (1440x900 viewport, 2x retina)

## 3. Target Screens

### Phase 1: Core Layout & Components
1. `app-shell` — Full app shell with rail, toolbar, sidebar, status bar, inspector
2. `home-dashboard` — Home view with Needs Attention, Running Now, Recent Activity
3. `project-kanban` — Kanban board with 4 columns + ticket cards
4. `ticket-overview` — Ticket detail overview tab with specs, tasks, activity
5. `ticket-sessions` — Ticket detail sessions tab with message transcript + inspector
6. `brainstorm` — Brainstorm chat interface with quiz components
7. `settings` — Project settings page with anchor nav sections
8. `modals` — Modal collection (Create Project, Create Ticket, Delete Confirm)

### Phase 2: Ticket Lifecycle Screens (Content-Only)
1. `ticket-create-dialog` — Modal with 3 source options (AI, Figma, Manual) + manual form
2. `brainstorm-quiz` — AI brainstorm chat with quiz cards and option selection
3. `brainstorm-review` — Two-column spec review with inline comments
4. `figma-annotator` — 3-panel Figma viewer (layers, canvas, annotations)
5. `ticket-detail-overview` — Two-column overview with description, progress, cost, settings
6. `ticket-detail-specs` — Expandable spec cards with revision history and references
7. `ticket-detail-tasks` — DAG flow visualization + step list with status badges
8. `ticket-session-transcript` — Session transcript viewer with tool call cards + inspector
9. `code-review-panel` — Diff view with file tree, inline comments, approve/request changes
10. `ticket-detail-activity` — Real-time activity timeline with colored event dots

## 4. Sitemap

- [x] app-shell
- [x] home-dashboard
- [x] project-kanban
- [x] ticket-overview
- [x] ticket-sessions
- [x] brainstorm
- [x] settings
- [x] modals
- [x] ticket-create-dialog
- [x] brainstorm-quiz
- [x] brainstorm-review
- [x] figma-annotator
- [x] ticket-detail-overview
- [x] ticket-detail-specs
- [x] ticket-detail-tasks
- [x] ticket-session-transcript
- [x] code-review-panel
- [x] ticket-detail-activity
- [x] brainstorm-quiz-v2 — Agent config wizard (Stitch-generated)
- [x] agent-session-live — Full live session transcript (Stitch-generated)
- [x] agent-session-compact — Compact 2-panel session with detail drawer + brainstorm quiz (hand-crafted)
- [x] notification-panel — Slide-over notification panel with grouped notifications, filters, and contextual actions (Stitch-generated)

## 5. Roadmap

All Phase 1, Phase 2, and Phase 3 (Agent Session) screens completed.

## 6. Design Notes

See DESIGN.md Section 6 for the Stitch generation block.
