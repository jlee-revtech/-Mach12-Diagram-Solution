'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { useDiagramStore } from '@/lib/diagram/store'
import type { SystemNode, DataFlowEdge } from '@/lib/diagram/types'

interface CollabUser {
  id: string
  name: string
  color: string
  cursor?: { x: number; y: number }
}

const COLORS = ['#2563EB', '#06B6D4', '#10B981', '#F97316', '#EC4899', '#8B5CF6', '#EF4444', '#EAB308']

export function useCollaboration(diagramId: string | undefined, userName: string) {
  const [connected, setConnected] = useState(false)
  const [users, setUsers] = useState<CollabUser[]>([])
  const docRef = useRef<Y.Doc | null>(null)
  const providerRef = useRef<WebsocketProvider | null>(null)
  const suppressSync = useRef(false)

  const wsUrl = process.env.NEXT_PUBLIC_WS_URL

  // Initialize Yjs connection
  useEffect(() => {
    if (!diagramId || !wsUrl) return

    const doc = new Y.Doc()
    docRef.current = doc

    const provider = new WebsocketProvider(wsUrl, diagramId, doc, {
      connect: true,
      maxBackoffTime: 5000,
    })
    providerRef.current = provider

    // Set awareness (presence)
    const colorIdx = Math.floor(Math.random() * COLORS.length)
    provider.awareness.setLocalStateField('user', {
      name: userName,
      color: COLORS[colorIdx],
    })

    provider.on('status', ({ status }: { status: string }) => {
      setConnected(status === 'connected')
    })

    // Track awareness (other users)
    const awarenessHandler = () => {
      const states = provider.awareness.getStates()
      const collabUsers: CollabUser[] = []
      states.forEach((state, clientId) => {
        if (clientId === provider.awareness.clientID) return
        if (state.user) {
          collabUsers.push({
            id: String(clientId),
            name: state.user.name,
            color: state.user.color,
            cursor: state.cursor,
          })
        }
      })
      setUsers(collabUsers)
    }
    provider.awareness.on('change', awarenessHandler)

    // Listen for remote changes to shared nodes/edges
    const yNodes = doc.getArray<Y.Map<unknown>>('nodes')
    const yEdges = doc.getArray<Y.Map<unknown>>('edges')

    const syncFromYjs = () => {
      if (suppressSync.current) return
      suppressSync.current = true

      const nodes = yNodes.toArray().map((yNode) => yNode.toJSON()) as unknown as SystemNode[]
      const edges = yEdges.toArray().map((yEdge) => yEdge.toJSON()) as unknown as DataFlowEdge[]

      useDiagramStore.setState({ nodes, edges })

      // Keep suppressed briefly to prevent echo loop
      setTimeout(() => { suppressSync.current = false }, 100)
    }

    yNodes.observe(syncFromYjs)
    yEdges.observe(syncFromYjs)

    return () => {
      yNodes.unobserve(syncFromYjs)
      yEdges.unobserve(syncFromYjs)
      provider.awareness.off('change', awarenessHandler)
      provider.destroy()
      doc.destroy()
      docRef.current = null
      providerRef.current = null
    }
  }, [diagramId, wsUrl, userName])

  // Push local changes to Yjs
  const syncToYjs = useCallback(() => {
    const doc = docRef.current
    if (!doc || suppressSync.current) return

    suppressSync.current = true
    const { nodes, edges } = useDiagramStore.getState()

    const yNodes = doc.getArray<Y.Map<unknown>>('nodes')
    const yEdges = doc.getArray<Y.Map<unknown>>('edges')

    doc.transact(() => {
      // Replace all nodes
      yNodes.delete(0, yNodes.length)
      nodes.forEach((node) => {
        const yNode = new Y.Map()
        flattenToYMap(yNode, node)
        yNodes.push([yNode])
      })

      // Replace all edges
      yEdges.delete(0, yEdges.length)
      edges.forEach((edge) => {
        const yEdge = new Y.Map()
        flattenToYMap(yEdge, edge)
        yEdges.push([yEdge])
      })
    })

    suppressSync.current = false
  }, [])

  // Update cursor position in awareness
  const updateCursor = useCallback((x: number, y: number) => {
    providerRef.current?.awareness.setLocalStateField('cursor', { x, y })
  }, [])

  // Seed Yjs doc from loaded diagram (first load)
  const seedFromStore = useCallback(() => {
    const doc = docRef.current
    if (!doc) return

    const yNodes = doc.getArray<Y.Map<unknown>>('nodes')
    if (yNodes.length > 0) return // Already has data from another client

    syncToYjs()
  }, [syncToYjs])

  return { connected, users, syncToYjs, updateCursor, seedFromStore }
}

// Helper to convert a plain object into a Y.Map
function flattenToYMap(yMap: Y.Map<unknown>, obj: Record<string, unknown>) {
  for (const [key, val] of Object.entries(obj)) {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      const nested = new Y.Map()
      flattenToYMap(nested, val as Record<string, unknown>)
      yMap.set(key, nested)
    } else if (Array.isArray(val)) {
      const yArr = new Y.Array()
      val.forEach((item) => {
        if (item && typeof item === 'object') {
          const nested = new Y.Map()
          flattenToYMap(nested, item as Record<string, unknown>)
          yArr.push([nested])
        } else {
          yArr.push([item])
        }
      })
      yMap.set(key, yArr)
    } else {
      yMap.set(key, val)
    }
  }
}
