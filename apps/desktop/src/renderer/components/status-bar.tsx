import { useEffect, useState } from 'react'
import { StatusBadge } from '@agent-coding/ui'
import { apiClient } from 'renderer/lib/api-client'

export function StatusBar() {
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    let mounted = true

    async function check() {
      try {
        await apiClient('/health')
        if (mounted) setConnected(true)
      } catch {
        if (mounted) setConnected(false)
      }
    }

    check()
    const interval = setInterval(check, 30_000)
    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [])

  return (
    <div className="flex h-7 shrink-0 items-center justify-between border-t border-border bg-card/50 px-3 text-caption text-muted-foreground">
      <div className="flex items-center gap-1.5">
        <StatusBadge
          status={connected ? 'connected' : 'disconnected'}
          showDot
          className="text-[11px] px-1.5 py-0"
        >
          {connected ? 'Connected' : 'Disconnected'}
        </StatusBadge>
      </div>
      <div className="flex items-center gap-3">
        <span>No active session</span>
      </div>
    </div>
  )
}
