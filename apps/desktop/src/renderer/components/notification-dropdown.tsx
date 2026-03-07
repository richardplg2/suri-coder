import { useState } from 'react'
import { Bell, Check, AlertCircle, CheckCircle2, XCircle, Info } from 'lucide-react'
import {
  Button,
  Popover,
  PopoverTrigger,
  PopoverContent,
  ScrollArea,
  Badge,
} from '@agent-coding/ui'

import {
  useNotifications,
  useUnreadCount,
  useMarkRead,
  useMarkAllRead,
} from 'renderer/hooks/queries/use-notifications'
import type { Notification } from 'renderer/types/api'

function notificationIcon(type: string) {
  switch (type) {
    case 'step_completed':
    case 'workflow_completed':
      return <CheckCircle2 className="size-4 text-green-500 shrink-0" />
    case 'step_failed':
    case 'workflow_failed':
      return <XCircle className="size-4 text-destructive shrink-0" />
    case 'step_awaiting_approval':
    case 'review_requested':
      return <AlertCircle className="size-4 text-yellow-500 shrink-0" />
    default:
      return <Info className="size-4 text-muted-foreground shrink-0" />
  }
}

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const seconds = Math.floor((now - then) / 1000)

  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function NotificationItem({
  notification,
  onMarkRead,
}: {
  notification: Notification
  onMarkRead: (id: string) => void
}) {
  return (
    <button
      type="button"
      className={`flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/50 ${
        !notification.read ? 'bg-muted/30' : ''
      }`}
      onClick={() => {
        if (!notification.read) onMarkRead(notification.id)
      }}
    >
      {notificationIcon(notification.type)}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-tight truncate">{notification.title}</p>
        {notification.body && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notification.body}</p>
        )}
        <p className="text-xs text-muted-foreground mt-1">{timeAgo(notification.created_at)}</p>
      </div>
      {!notification.read && (
        <div className="size-2 rounded-full bg-primary shrink-0 mt-1.5" />
      )}
    </button>
  )
}

export function NotificationDropdown() {
  const [open, setOpen] = useState(false)
  const { data: notifications = [] } = useNotifications()
  const { data: unreadData } = useUnreadCount()
  const markRead = useMarkRead()
  const markAllRead = useMarkAllRead()

  const unreadCount = unreadData?.count ?? 0

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
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
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0" sideOffset={8}>
        <div className="flex items-center justify-between border-b px-3 py-2">
          <h4 className="text-sm font-semibold">Notifications</h4>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto px-2 py-1 text-xs"
              onClick={() => markAllRead.mutate()}
            >
              <Check className="size-3 mr-1" />
              Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-96">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Bell className="size-8 mb-2 opacity-50" />
              <p className="text-sm">No notifications</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notif) => (
                <NotificationItem
                  key={notif.id}
                  notification={notif}
                  onMarkRead={(id) => markRead.mutate(id)}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
