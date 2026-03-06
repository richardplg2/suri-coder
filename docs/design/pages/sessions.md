# Sessions — Screen Design

> Overrides: This file extends `docs/design/design-system.md`.

## Overview

Main screen of the app. Multi-tab chat interface for Claude Code sessions with real-time streaming, tool call visualization, and session cost tracking.

## Wireframe

```
┌────────┬──────────────────────────────┬─────────────────┐
│Sidebar │  TabBar: [Session 1] [+New]  │   Inspector     │
│        ├──────────────────────────────┤                  │
│ ● Sess │                              │ Session Info     │
│   Skills│  ChatBubble (assistant)     │ - Status: ● run │
│   Trees │  ToolCallCard (collapsed)   │ - Duration: 3m  │
│   Figma │  ChatBubble (user)          │ - Tokens: 12k   │
│   Tests │  StreamingText...           │ - Cost: $0.08   │
│   Review│                              │                  │
│        │                              │ Active Tools     │
│        │                              │ - Read file.ts   │
│        │  ┌──────────────────────┐    │ - Edit main.tsx  │
│        │  │ TextArea + Send btn  │    │                  │
│        ├──┴──────────────────────┴────┤                  │
│ ⚙ Set  │ SessionStatusBar             │                  │
└────────┴──────────────────────────────┴─────────────────┘
```

## Component Mapping

| Area | Component | Props/Config | Notes |
|------|-----------|-------------|-------|
| Header | `TabBar` | closable, +New button | Multiple concurrent sessions |
| Content | `ChatBubble` | role: user/assistant, content | Auto-scroll to bottom |
| Content | `ToolCallCard` | toolName, params, result, expandable | Collapsed by default |
| Content | `StreamingText` | streaming text with cursor | Active during generation |
| Input | `TextArea` | auto-resize, placeholder | Shift+Enter = newline, Enter = send |
| Bottom | `SessionStatusBar` | status, duration, tokens, cost | Always visible |
| Inspector | `KVRow` | label-value pairs | Session metadata |
| Inspector | List | active tool calls | Live updates via WebSocket |

## States

- **Empty**: `EmptyState` — "Start a new session" with Cmd+N hint
- **Loading**: `Spinner` inline while waiting for first response
- **Streaming**: `StreamingText` with typing cursor, ToolCallCards appear as tools are invoked
- **Completed**: Full chat history, session status changes to "completed"
- **Error**: `Toast` notification + error message in chat as system ChatBubble

## Interactions

| Action | Trigger | Behavior |
|--------|---------|----------|
| Send message | Enter | Enqueue prompt, show user ChatBubble |
| New line | Shift+Enter | Insert newline in TextArea |
| New session | Cmd+N | Open new tab, focus TextArea |
| Close tab | Cmd+W | Close current session tab |
| Switch tab | Cmd+1-9 | Navigate to tab by index |
| Expand tool call | Click ToolCallCard | Toggle params/result visibility |
| Copy code | Click copy in CodeBlock | Copy to clipboard, show Toast |
