import { useEffect, useRef, useState, useCallback } from 'react'

interface WebSocketMessage {
  type: string
  [key: string]: unknown
}

export const useWebSocket = (url: string) => {
  const ws = useRef<WebSocket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null)
  const messageHandlers = useRef<Map<string, (data: unknown) => void>>(new Map())

  useEffect(() => {
    ws.current = new WebSocket(url)

    ws.current.onopen = () => {
      setIsConnected(true)
    }

    ws.current.onclose = () => {
      setIsConnected(false)
    }

    ws.current.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as WebSocketMessage
        setLastMessage(message)

        const handler = messageHandlers.current.get(message.type)
        if (handler) {
          handler(message)
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error)
      }
    }

    ws.current.onerror = (error) => {
      console.error('WebSocket error:', error)
    }

    return () => {
      if (ws.current) {
        ws.current.close()
      }
    }
  }, [url])

  const send = useCallback((message: WebSocketMessage) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message))
    } else {
      console.warn('WebSocket is not connected')
    }
  }, [])

  const onMessage = useCallback((type: string, handler: (data: unknown) => void) => {
    messageHandlers.current.set(type, handler)
    return () => {
      messageHandlers.current.delete(type)
    }
  }, [])

  return { isConnected, lastMessage, send, onMessage }
}
