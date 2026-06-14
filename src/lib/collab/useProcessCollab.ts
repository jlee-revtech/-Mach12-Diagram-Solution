'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'

// Presence-only collaboration for Process Studio (mirrors useCapabilityMapCollab).
// Yjs awareness only — persistence is via PostgREST, last-write-wins on save.
export interface ProcessCollabUser {
  clientId: number
  userId: string
  name: string
  color: string
  editingNodeId: string | null
}

const COLORS = ['#0EA5E9', '#06B6D4', '#10B981', '#F97316', '#EC4899', '#8B5CF6', '#EF4444', '#EAB308']

function pickColor(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0
  return COLORS[Math.abs(h) % COLORS.length]
}

export function useProcessCollab(modelId: string | undefined, userId: string | undefined, userName: string) {
  const [connected, setConnected] = useState(false)
  const [users, setUsers] = useState<ProcessCollabUser[]>([])
  const providerRef = useRef<WebsocketProvider | null>(null)
  const myClientIdRef = useRef<number | null>(null)

  const wsUrl = process.env.NEXT_PUBLIC_WS_URL

  useEffect(() => {
    if (!modelId || !userId || !wsUrl) return

    const doc = new Y.Doc()
    const room = `process-model:${modelId}`
    const provider = new WebsocketProvider(wsUrl, room, doc, { connect: true, maxBackoffTime: 5000 })
    providerRef.current = provider
    myClientIdRef.current = provider.awareness.clientID

    provider.awareness.setLocalStateField('user', {
      userId, name: userName, color: pickColor(userId), editingNodeId: null,
    })

    const onStatus = ({ status }: { status: string }) => setConnected(status === 'connected')
    provider.on('status', onStatus)

    const readUsers = () => {
      const list: ProcessCollabUser[] = []
      provider.awareness.getStates().forEach((state, clientId) => {
        const u = (state as { user?: Partial<ProcessCollabUser> }).user
        if (!u || !u.userId || !u.name || !u.color) return
        list.push({ clientId, userId: u.userId, name: u.name, color: u.color, editingNodeId: u.editingNodeId ?? null })
      })
      setUsers(list)
    }
    provider.awareness.on('change', readUsers)
    readUsers()

    return () => {
      provider.awareness.off('change', readUsers)
      provider.destroy()
      doc.destroy()
      providerRef.current = null
    }
  }, [modelId, userId, userName, wsUrl])

  const setEditingNode = useCallback((nodeId: string | null) => {
    const provider = providerRef.current
    if (!provider) return
    const current = provider.awareness.getLocalState() as { user?: ProcessCollabUser } | null
    if (!current?.user) return
    provider.awareness.setLocalStateField('user', { ...current.user, editingNodeId: nodeId })
  }, [])

  return { connected, users, myClientId: myClientIdRef.current, setEditingNode }
}
