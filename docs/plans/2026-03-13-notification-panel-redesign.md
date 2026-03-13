# Notification Panel Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the notification popover dropdown with a slide-over panel from the right, with time-grouped notifications, filter tabs, contextual action buttons, and mock data.

**Architecture:** Replace `NotificationDropdown` (Popover-based) with `NotificationPanel` (Sheet-based). The bell icon in the toolbar triggers a right-side Sheet. Notifications are grouped by time (Today/Yesterday/Earlier) and filterable by All/Unread tabs. Each notification card has type-specific action buttons (Approve, View Logs, Review). Uses mock data instead of API calls for now.

**Tech Stack:** React, Radix Sheet (via `@agent-coding/ui`), Tailwind CSS, Lucide icons

---

### Task 1: Create mock notification data

**Files:**
- Create: `apps/desktop/src/renderer/mocks/notifications.ts`

**Step 1: Create mock data file**

```typescript
import type { Notification } from 'renderer/types/api'

const now = new Date()
const hoursAgo = (h: number) => new Date(now.getTime() - h * 60 * 60 * 1000).toISOString()
const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000).toISOString()

export const mockNotifications: Notification[] = [
  {
    id: 'n1',
    user_id: 'u1',
    type: 'step_completed',
    title: 'Build step completed',
    body: "Project 'Workflow Manager' — build passed all checks",
    resource_type: 'step',
    resource_id: 's1',
    read: false,
    created_at: hoursAgo(0.03), // ~2 minutes ago
  },
  {
    id: 'n2',
    user_id: 'u1',
    type: 'step_awaiting_approval',
    title: 'Approval required',
    body: 'Deploy to production needs your review',
    resource_type: 'step',
    resource_id: 's2',
    read: false,
    created_at: hoursAgo(1),
  },
  {
    id: 'n3',
    user_id: 'u1',
    type: 'step_failed',
    title: 'Test step failed',
    body: 'Integration tests failed with 3 errors',
    resource_type: 'step',
    resource_id: 's3',
    read: false,
    created_at: hoursAgo(3),
  },
  {
    id: 'n4',
    user_id: 'u1',
    type: 'workflow_completed',
    title: 'Workflow completed',
    body: 'Login Flow workflow finished successfully',
    resource_type: 'workflow',
    resource_id: 'w1',
    read: true,
    created_at: daysAgo(1), // yesterday
  },
  {
    id: 'n5',
    user_id: 'u1',
    type: 'review_requested',
    title: 'Code review requested',
    body: 'PR #42 needs your review — auth middleware changes',
    resource_type: 'workflow',
    resource_id: 'w2',
    read: true,
    created_at: daysAgo(1),
  },
  {
    id: 'n6',
    user_id: 'u1',
    type: 'workflow_completed',
    title: 'Workflow completed',
    body: 'Dashboard redesign passed all steps',
    resource_type: 'workflow',
    resource_id: 'w3',
    read: true,
    created_at: daysAgo(3),
  },
]
```

**Step 2: Verify file compiles**

Run: `cd apps/desktop && npx tsc --noEmit src/renderer/mocks/notifications.ts 2>&1 | head -20`

**Step 3: Commit**

```bash
git add apps/desktop/src/renderer/mocks/notifications.ts
git commit -m "feat(notifications): add mock notification data for panel redesign"
```

---

### Task 2: Create the NotificationPanel component

**Files:**
- Create: `apps/desktop/src/renderer/components/notification-panel.tsx`

**Reference design:** `.stitch/designs/notification-panel.html`

**Step 1: Build the component**

The component should:
1. Accept `open` and `onOpenChange` props
2. Use `Sheet` + `SheetContent` from `@agent-coding/ui` with `side="right"`
3. Have a header with title "Notifications", close handled by Sheet
4. Filter tabs: "All" / "Unread" using simple state (not the Tabs component — just two buttons styled as pills)
5. Group notifications by time: Today, Yesterday, Earlier
6. Render each notification as a card matching the Stitch design
7. Show contextual action buttons per type
8. Show blue unread dot for unread notifications
9. "Mark all read" button in header
10. Empty state when no notifications

Key implementation details:
- Use `useState` for mock data (start with `mockNotifications`, allow local mark-read/mark-all-read)
- Use `useState<'all' | 'unread'>` for filter
- Group function: compare notification `created_at` against `startOfToday()` and `startOfYesterday()`
- Time formatting: reuse/adapt the `timeAgo` function from old component, but for yesterday+ show "4:32 PM" style
- Card layout matches Stitch HTML: relative positioned card with `bg-card` variant styling, `border border-border/50 rounded-lg p-3`
- Unread dot: `absolute left-2 top-4 w-2 h-2 rounded-full bg-primary`
- Type icons: use existing `notificationIcon` pattern but with 20px size
- Action buttons:
  - `step_awaiting_approval` → "Approve" (primary button)
  - `step_failed` / `workflow_failed` → "View Logs" (secondary/ghost button)
  - `review_requested` → "Review" (primary button)
- Read cards get `opacity-80`
- SheetContent width: `w-[380px] sm:max-w-[380px]`

**Step 2: Verify it compiles**

Run: `cd apps/desktop && npx tsc --noEmit 2>&1 | head -20`

**Step 3: Commit**

```bash
git add apps/desktop/src/renderer/components/notification-panel.tsx
git commit -m "feat(notifications): create slide-over notification panel component"
```

---

### Task 3: Replace NotificationDropdown with NotificationPanel in AppLayout

**Files:**
- Modify: `apps/desktop/src/renderer/components/app-layout.tsx`
- Modify: `apps/desktop/src/renderer/components/notification-dropdown.tsx` (keep bell button only)

**Step 1: Update app-layout.tsx**

Changes:
1. Import `NotificationPanel` instead of `NotificationDropdown`
2. Add `useState` for panel open state
3. Replace the `<NotificationDropdown />` in the toolbar with a simple Bell button that sets open state
4. Render `<NotificationPanel open={open} onOpenChange={setOpen} />` as a sibling (Sheet is a portal, position doesn't matter much)
5. Keep the unread badge on the bell icon — use a hardcoded count from mock data or a simple calculation

The bell button in toolbar:
```tsx
<Button variant="ghost" size="icon-sm" className="size-7 relative" onClick={() => setNotifOpen(true)}>
  <Bell className="size-3.5 text-muted-foreground" />
  {unreadCount > 0 && (
    <Badge variant="destructive" className="absolute -right-1 -top-1 size-4 rounded-full p-0 text-[10px] flex items-center justify-center">
      {unreadCount > 99 ? '99+' : unreadCount}
    </Badge>
  )}
</Button>
```

For mock mode: compute `unreadCount` from `mockNotifications.filter(n => !n.read).length` — or better, lift the notification state to a shared location. Simplest: just hardcode or use a separate small hook.

Actually simplest approach: make NotificationPanel manage its own trigger. Use Sheet with SheetTrigger wrapping the Bell button. This keeps it self-contained. The panel component renders both the trigger and the sheet content.

**Step 2: Verify it compiles and the app renders**

Run: `pnpm --filter my-electron-app dev` and check the notification bell opens the panel.

**Step 3: Commit**

```bash
git add apps/desktop/src/renderer/components/app-layout.tsx apps/desktop/src/renderer/components/notification-panel.tsx
git commit -m "feat(notifications): integrate slide-over panel into app layout"
```

---

### Task 4: Polish and verify

**Step 1: Visual verification**

Open the app, click the bell icon, verify:
- [ ] Panel slides in from right with animation
- [ ] Backdrop overlay dims the content
- [ ] Click outside closes the panel
- [ ] Escape key closes the panel
- [ ] "All" / "Unread" filter tabs work
- [ ] Notifications grouped by Today / Yesterday / Earlier
- [ ] Unread notifications have blue dot and elevated background
- [ ] Read notifications have reduced opacity
- [ ] Action buttons visible: Approve, View Logs, Review
- [ ] "Mark all read" clears all unread dots
- [ ] Empty state shows when filtering unread after marking all read

**Step 2: Clean up old notification-dropdown.tsx if fully replaced**

If NotificationDropdown is no longer used anywhere, delete it. Update any imports.

**Step 3: Final commit**

```bash
git add -u
git commit -m "feat(notifications): polish panel and remove old dropdown"
```
