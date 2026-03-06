import { create } from 'zustand'
import type { WsChannel, WsClientMessage, WsEvent, WsServerMessage } from '@agent-coding/shared'
import { SYSTEM_CHANNEL, WsAction } from '@agent-coding/shared'

type EventCallback = (event: WsEvent, data: unknown) => void

interface WsState {
  ws: WebSocket | null
  status: 'connecting' | 'connected' | 'disconnected'
  shouldReconnect: boolean
  listeners: Map<string, Set<EventCallback>>
  activeChannels: Map<string, { channel: WsChannel; params: Record<string, string> }>
}

interface WsActions {
  connect: (url: string) => void
  disconnect: () => void
  subscribe: (channel: WsChannel, params: Record<string, string>) => void
  unsubscribe: (channel: WsChannel, params: Record<string, string>) => void
  addListener: (ref: string, cb: EventCallback) => void
  removeListener: (ref: string, cb: EventCallback) => void
}

function makeRef(channel: WsChannel, params: Record<string, string>): string {
  const val = Object.values(params)[0] ?? ''
  return `${channel}:${val}`
}

export const useWsStore = create<WsState & WsActions>((set, get) => ({
  ws: null,
  status: 'disconnected',
  shouldReconnect: true,
  listeners: new Map(),
  activeChannels: new Map(),

  connect: (url: string) => {
    const ws = new WebSocket(url)
    set({ ws, status: 'connecting', shouldReconnect: true })

    ws.onopen = () => {
      set({ status: 'connected' })
      // Re-subscribe all active channels on reconnect
      const { activeChannels } = get()
      for (const [, { channel, params }] of activeChannels) {
        const msg: WsClientMessage = { action: WsAction.Subscribe, channel, params }
        ws.send(JSON.stringify(msg))
      }
    }

    ws.onmessage = (e) => {
      const msg: WsServerMessage = JSON.parse(e.data)
      if (msg.channel === SYSTEM_CHANNEL) return
      const { listeners } = get()
      const cbs = listeners.get(msg.ref ?? '')
      if (cbs) {
        for (const cb of cbs) cb(msg.event, msg.data)
      }
    }

    ws.onclose = () => {
      set({ status: 'disconnected', ws: null })
      if (get().shouldReconnect) {
        setTimeout(() => get().connect(url), 1000)
      }
    }
  },

  disconnect: () => {
    set({ shouldReconnect: false })
    get().ws?.close()
    set({ ws: null, status: 'disconnected', activeChannels: new Map() })
  },

  subscribe: (channel, params) => {
    const ref = makeRef(channel, params)
    const { ws, activeChannels } = get()
    activeChannels.set(ref, { channel, params })
    set({ activeChannels: new Map(activeChannels) })

    if (ws?.readyState === WebSocket.OPEN) {
      const msg: WsClientMessage = { action: WsAction.Subscribe, channel, params }
      ws.send(JSON.stringify(msg))
    }
  },

  unsubscribe: (channel, params) => {
    const ref = makeRef(channel, params)
    const { ws, activeChannels, listeners } = get()
    activeChannels.delete(ref)
    listeners.delete(ref)
    set({ activeChannels: new Map(activeChannels), listeners: new Map(listeners) })

    if (ws?.readyState === WebSocket.OPEN) {
      const msg: WsClientMessage = { action: WsAction.Unsubscribe, channel, params }
      ws.send(JSON.stringify(msg))
    }
  },

  addListener: (ref, cb) => {
    const { listeners } = get()
    const cbs = listeners.get(ref) ?? new Set()
    cbs.add(cb)
    listeners.set(ref, cbs)
    set({ listeners: new Map(listeners) })
  },

  removeListener: (ref, cb) => {
    const { listeners } = get()
    const cbs = listeners.get(ref)
    if (cbs) {
      cbs.delete(cb)
      if (cbs.size === 0) listeners.delete(ref)
      set({ listeners: new Map(listeners) })
    }
  },
}))
