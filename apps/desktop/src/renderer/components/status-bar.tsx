import { useEffect, useMemo, useState } from 'react'
import { Zap } from 'lucide-react'
import { apiClient } from 'renderer/lib/api-client'
import { useStatusBarStore } from 'renderer/stores/use-status-bar-store'

export function StatusBar() {
  const [connected, setConnected] = useState(false)
  const items = useStatusBarStore((s) => s.items)

  const sortedItems = useMemo(
    () => [...items.values()].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [items],
  )

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
    <footer className="h-[28px] border-t border-border glass-effect flex items-center justify-between px-3 text-[10px] text-muted-foreground shrink-0 z-10">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-mac-green' : 'bg-mac-red'}`} />
          <span>{connected ? 'Connected' : 'Disconnected'}</span>
        </div>
        <span className="text-muted-foreground/60">v1.2.0</span>
        {sortedItems.length > 0 && <div className="h-3 w-px bg-border" />}
        {sortedItems.map((item) => (
          <div key={item.id} className="flex items-center gap-1.5">
            {item.content}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-1.5">
          <Zap className="size-3" />
          <span>No active session</span>
        </div>
        <div className="flex items-center gap-4 border-l border-border pl-4">
          <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          <span className="text-primary">0 tokens</span>
          <span className="font-medium text-foreground">$0.00 est.</span>
        </div>
      </div>
    </footer>
  )
}
