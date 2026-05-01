'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'

export interface CollabUser {
  clientId: number
  userId: string
  name: string
  color: string
  editingCapabilityId: string | null
}

const COLORS = ['#2563EB', '#06B6D4', '#10B981', '#F97316', '#EC4899', '#8B5CF6', '#EF4444', '#EAB308']

function pickColor(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0
  return COLORS[Math.abs(h) % COLORS.length]
}

export function useCapabilityMapCollab(mapId: string | undefined, userId: string | undefined, userName: string) {
  const [connected, setConnected] = useState(false)
  const [users, setUsers] = useState<CollabUser[]>([])
  const docRef = useRef<Y.Doc | null>(null)
  const providerRef = useRef<WebsocketProvider | null>(null)
  const myClientIdRef = useRef<number | null>(null)

  const wsUrl = process.env.NEXT_PUBLIC_WS_URL

  useEffect(() => {
    if (!mapId || !userId || !wsUrl) return

    const doc = new Y.Doc()
    docRef.current = doc
    const room = `capability-map:${mapId}`

    const provider = new WebsocketProvider(wsUrl, room, doc, { connect: true, maxBackoffTime: 5000 })
    providerRef.current = provider
    myClientIdRef.current = provider.awareness.clientID

    provider.awareness.setLocalStateField('user', {
      userId,
      name: userName,
      color: pickColor(userId),
      editingCapabilityId: null,
    })

    const onStatus = ({ status }: { status: string }) => setConnected(status === 'connected')
    provider.on('status', onStatus)

    const readUsers = () => {
      const states = provider.awareness.getStates()
      const list: CollabUser[] = []
      states.forEach((state, clientId) => {
        const u = (state as { user?: CollabUser['user' & object] }).user as Partial<CollabUser> | undefined
        if (!u || !u.userId || !u.name || !u.color) return
        list.push({
          clientId,
          userId: u.userId,
          name: u.name,
          color: u.color,
          editingCapabilityId: u.editingCapabilityId ?? null,
        })
      })
      setUsers(list)
    }
    provider.awareness.on('change', readUsers)
    readUsers()

    return () => {
      provider.awareness.off('change', readUsers)
      provider.destroy()
      doc.destroy()
      docRef.current = null
      providerRef.current = null
    }
  }, [mapId, userId, userName, wsUrl])

  const setEditingCapability = useCallback((capabilityId: string | null) => {
    const provider = providerRef.current
    if (!provider) return
    const current = provider.awareness.getLocalState() as { user?: CollabUser } | null
    if (!current?.user) return
    provider.awareness.setLocalStateField('user', {
      ...current.user,
      editingCapabilityId: capabilityId,
    })
  }, [])

  return {
    connected,
    users,
    myClientId: myClientIdRef.current,
    setEditingCapability,
  }
}
