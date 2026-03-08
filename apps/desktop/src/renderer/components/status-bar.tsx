import { useEffect, useState } from 'react'
import { Zap } from 'lucide-react'
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
    <footer className="h-[28px] border-t border-border bg-sidebar flex items-center justify-between px-3 text-[10px] text-muted-foreground shrink-0 z-10">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-mac-green' : 'bg-mac-red'}`}></div>
          <span>{connected ? 'Connected' : 'Disconnected'}</span>
        </div>
        <span className="text-muted-foreground/60">v1.2.0</span>
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
