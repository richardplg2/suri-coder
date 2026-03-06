import { useEffect, useRef } from 'react'
import type { WsChannel, WsEvent } from '@agent-coding/shared'
import { useWsStore } from '../stores/use-ws-store'

type EventHandler = (event: WsEvent, data: unknown) => void

function makeRef(channel: WsChannel, params: Record<string, string>): string {
  const val = Object.values(params)[0] ?? ''
  return `${channel}:${val}`
}

/**
 * Subscribe to a WebSocket channel for the lifetime of the component.
 * Pass `null` as channel to skip subscription.
 */
export function useWsChannel(
  channel: WsChannel | null,
  params: Record<string, string>,
  onEvent: EventHandler,
): void {
  const subscribe = useWsStore((s) => s.subscribe)
  const unsubscribe = useWsStore((s) => s.unsubscribe)
  const addListener = useWsStore((s) => s.addListener)
  const removeListener = useWsStore((s) => s.removeListener)

  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent

  const paramsKey = JSON.stringify(params)

  useEffect(() => {
    if (!channel) return

    const parsedParams: Record<string, string> = JSON.parse(paramsKey)
    const ref = makeRef(channel, parsedParams)
    const handler: EventHandler = (event, data) => onEventRef.current(event, data)

    subscribe(channel, parsedParams)
    addListener(ref, handler)

    return () => {
      removeListener(ref, handler)
      unsubscribe(channel, parsedParams)
    }
  }, [channel, paramsKey, subscribe, unsubscribe, addListener, removeListener])
}
