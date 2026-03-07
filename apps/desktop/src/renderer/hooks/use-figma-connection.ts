import { useState, useRef, useCallback } from 'react'

const FIGMA_WS_URL = 'ws://localhost:3055'
const COMMAND_TIMEOUT_MS = 15000

export interface FigmaConnectionState {
  status: 'disconnected' | 'connecting' | 'connected'
  error: string | null
}

export interface FigmaNode {
  id: string
  name: string
  type: string
  absoluteBoundingBox: { x: number; y: number; width: number; height: number } | null
  fills?: Array<{ type: string; color?: string }>
  style?: {
    fontFamily?: string
    fontSize?: number
    fontWeight?: number
    fontStyle?: string
    letterSpacing?: number
    lineHeightPx?: number
    textAlignHorizontal?: string
  }
  characters?: string
  cornerRadius?: number
  children?: FigmaNode[]
}

interface UseFigmaConnectionReturn {
  state: FigmaConnectionState
  connect: (channelId: string) => void
  disconnect: () => void
  sendCommand: <T = unknown>(command: string, params?: Record<string, unknown>) => Promise<T>
}

export function useFigmaConnection(): UseFigmaConnectionReturn {
  const [state, setState] = useState<FigmaConnectionState>({ status: 'disconnected', error: null })
  const wsRef = useRef<WebSocket | null>(null)
  const channelRef = useRef<string>('')
  const pendingRequests = useRef<
    Map<
      string,
      {
        resolve: (value: unknown) => void
        reject: (reason: Error) => void
        timeout: ReturnType<typeof setTimeout>
      }
    >
  >(new Map())

  const connect = useCallback((channelId: string) => {
    if (wsRef.current) wsRef.current.close()

    setState({ status: 'connecting', error: null })
    channelRef.current = channelId

    const ws = new WebSocket(FIGMA_WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'join', channel: channelId }))
      setState({ status: 'connected', error: null })
    }

    ws.onmessage = (event) => {
      let msg: { message?: { id?: string; result?: unknown } }
      try {
        msg = JSON.parse(event.data)
      } catch {
        return
      }
      if (msg.message?.id && pendingRequests.current.has(msg.message.id)) {
        const req = pendingRequests.current.get(msg.message.id)!
        pendingRequests.current.delete(msg.message.id)
        clearTimeout(req.timeout)
        req.resolve(msg.message.result)
      }
    }

    ws.onerror = () => {
      setState({
        status: 'disconnected',
        error: 'Connection failed. Is the Figma plugin server running on port 3055?',
      })
    }

    ws.onclose = () => {
      setState((prev) => ({ ...prev, status: 'disconnected' }))
      wsRef.current = null
    }
  }, [])

  const disconnect = useCallback(() => {
    wsRef.current?.close()
    wsRef.current = null
    for (const [_, req] of pendingRequests.current) {
      clearTimeout(req.timeout)
      req.reject(new Error('Disconnected'))
    }
    pendingRequests.current.clear()
    setState({ status: 'disconnected', error: null })
  }, [])

  const sendCommand = useCallback(
    <T = unknown,>(command: string, params: Record<string, unknown> = {}): Promise<T> => {
      return new Promise((resolve, reject) => {
        const ws = wsRef.current
        if (!ws || ws.readyState !== WebSocket.OPEN) {
          reject(new Error('Not connected'))
          return
        }

        const id = crypto.randomUUID()
        const timeout = setTimeout(() => {
          pendingRequests.current.delete(id)
          reject(new Error(`Timeout: ${command}`))
        }, COMMAND_TIMEOUT_MS)

        pendingRequests.current.set(id, {
          resolve: resolve as (value: unknown) => void,
          reject,
          timeout,
        })

        ws.send(
          JSON.stringify({
            id,
            type: 'message',
            channel: channelRef.current,
            message: { id, command, params: { ...params, commandId: id } },
          }),
        )
      })
    },
    [],
  )

  return { state, connect, disconnect, sendCommand }
}
