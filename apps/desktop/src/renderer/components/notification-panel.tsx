import { useState } from 'react'
import {
  Bell,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Info,
  Check,
} from 'lucide-react'
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetTitle,
  Button,
  Badge,
  ScrollArea,
} from '@agent-coding/ui'
import { mockNotifications } from 'renderer/mocks/notifications'
import type { Notification } from 'renderer/types/api'

type Filter = 'all' | 'unread'

function notificationIcon(type: string) {
  switch (type) {
    case 'step_completed':
    case 'workflow_completed':
      return <CheckCircle2 className="size-5 text-green-500 shrink-0" />
    case 'step_failed':
    case 'workflow_failed':
      return <XCircle className="size-5 text-destructive shrink-0" />
    case 'step_awaiting_approval':
    case 'review_requested':
      return <AlertCircle className="size-5 text-yellow-500 shrink-0" />
    default:
      return <Info className="size-5 text-muted-foreground shrink-0" />
  }
}

function formatTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const seconds = Math.floor((now - then) / 1000)

  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  return new Date(dateStr).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })
}

interface TimeGroup {
  label: string
  notifications: Notification[]
}

function groupByTime(notifications: Notification[]): TimeGroup[] {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000

  const today: Notification[] = []
  const yesterday: Notification[] = []
  const earlier: Notification[] = []

  for (const n of notifications) {
    const t = new Date(n.created_at).getTime()
    if (t >= startOfToday) today.push(n)
    else if (t >= startOfYesterday) yesterday.push(n)
    else earlier.push(n)
  }

  const groups: TimeGroup[] = []
  if (today.length > 0) groups.push({ label: 'TODAY', notifications: today })
  if (yesterday.length > 0) groups.push({ label: 'YESTERDAY', notifications: yesterday })
  if (earlier.length > 0) groups.push({ label: 'EARLIER', notifications: earlier })
  return groups
}

function actionButton(type: string) {
  switch (type) {
    case 'step_awaiting_approval':
      return (
        <Button size="sm" className="h-7 px-3 text-xs">
          Approve
        </Button>
      )
    case 'step_failed':
    case 'workflow_failed':
      return (
        <Button variant="secondary" size="sm" className="h-7 px-3 text-xs">
          View Logs
        </Button>
      )
    case 'review_requested':
      return (
        <Button size="sm" className="h-7 px-3 text-xs">
          Review
        </Button>
      )
    default:
      return null
  }
}

function NotificationCard({
  notification,
  onMarkRead,
}: {
  notification: Notification
  onMarkRead: (id: string) => void
}) {
  const action = actionButton(notification.type)

  return (
    <div
      className={`relative bg-card border border-border/50 rounded-lg p-3 hover:bg-muted/50 transition-colors cursor-pointer group ${
        notification.read ? 'opacity-80' : ''
      }`}
      onClick={() => {
        if (!notification.read) onMarkRead(notification.id)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !notification.read) onMarkRead(notification.id)
      }}
      role="button"
      tabIndex={0}
    >
      {!notification.read && (
        <div className="absolute left-2 top-4 w-2 h-2 rounded-full bg-primary" />
      )}
      <div className="pl-4 flex items-start justify-between gap-3">
        <div className="flex gap-3 min-w-0 flex-1">
          <div className="mt-0.5 shrink-0">{notificationIcon(notification.type)}</div>
          <div className="min-w-0 flex-1">
            <div className="flex justify-between items-start gap-2">
              <h4 className="text-sm font-semibold truncate">{notification.title}</h4>
              <span className="text-[11px] text-muted-foreground whitespace-nowrap mt-0.5 group-hover:text-muted-foreground/80">
                {formatTime(notification.created_at)}
              </span>
            </div>
            {notification.body && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                {notification.body}
              </p>
            )}
            {action && <div className="mt-2">{action}</div>}
          </div>
        </div>
      </div>
    </div>
  )
}

export function NotificationPanel() {
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications)
  const [filter, setFilter] = useState<Filter>('all')

  const unreadCount = notifications.filter((n) => !n.read).length

  const filtered = filter === 'unread' ? notifications.filter((n) => !n.read) : notifications
  const groups = groupByTime(filtered)

  function markRead(id: string) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
  }

  function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="size-7 relative">
          <Bell className="size-3.5 text-muted-foreground" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -right-1 -top-1 size-4 rounded-full p-0 text-[10px] flex items-center justify-center"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-[380px] sm:max-w-[380px] p-0 flex flex-col gap-0"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center justify-between mb-4">
            <SheetTitle className="text-xl">Notifications</SheetTitle>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={`px-3 py-1 rounded-full text-sm font-medium border transition-all ${
                  filter === 'all'
                    ? 'bg-muted border-border'
                    : 'text-muted-foreground border-transparent hover:bg-muted hover:border-border'
                }`}
                onClick={() => setFilter('all')}
              >
                All
              </button>
              <button
                type="button"
                className={`px-3 py-1 rounded-full text-sm font-medium border transition-all ${
                  filter === 'unread'
                    ? 'bg-muted border-border'
                    : 'text-muted-foreground border-transparent hover:bg-muted hover:border-border'
                }`}
                onClick={() => setFilter('unread')}
              >
                Unread
              </button>
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                className="text-primary text-sm font-medium hover:text-primary/80 transition-colors flex items-center gap-1"
                onClick={markAllRead}
              >
                <Check className="size-3" />
                Mark all read
              </button>
            )}
          </div>
        </div>

        {/* Notification list */}
        <ScrollArea className="flex-1">
          {groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Bell className="size-8 mb-2 opacity-50" />
              <p className="text-sm">No notifications</p>
            </div>
          ) : (
            <div className="px-4 py-4 space-y-6">
              {groups.map((group) => (
                <div key={group.label} className="space-y-3">
                  <h3 className="text-xs font-semibold text-muted-foreground px-1 tracking-wider">
                    {group.label}
                  </h3>
                  {group.notifications.map((n) => (
                    <NotificationCard key={n.id} notification={n} onMarkRead={markRead} />
                  ))}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
