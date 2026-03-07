import { useEffect, useState } from 'react'
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
    <div className="flex h-7 shrink-0 items-center justify-between border-t border-border bg-card/50 px-3 text-[11px] text-muted-foreground">
      <div className="flex items-center gap-1.5">
        <span
          className={`inline-block size-2 rounded-full ${connected ? 'bg-[var(--success)]' : 'bg-[var(--destructive)]'}`}
        />
        <span>{connected ? 'Connected' : 'Disconnected'}</span>
      </div>
      <div className="flex items-center gap-3">
        <span>No active session</span>
      </div>
    </div>
  )
}
