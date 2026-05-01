#!/usr/bin/env node

const http = require('http')
const WebSocket = require('ws')
const Y = require('yjs')
const syncProtocol = require('y-protocols/sync')
const awarenessProtocol = require('y-protocols/awareness')
const encoding = require('lib0/encoding')
const decoding = require('lib0/decoding')

const PORT = process.env.PORT || process.env.WS_PORT || 1234

// Store docs in memory
const docs = new Map()

function getDoc(name) {
  if (docs.has(name)) return docs.get(name)
  const doc = new Y.Doc()
  doc.name = name
  doc.conns = new Map()
  doc.awareness = new awarenessProtocol.Awareness(doc)
  docs.set(name, doc)
  return doc
}

const MSG_SYNC = 0
const MSG_AWARENESS = 1

function send(conn, message) {
  if (conn.readyState === WebSocket.OPEN) {
    conn.send(message, (err) => { if (err) console.error('[ws] send error:', err) })
  }
}

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200)
    res.end('ok')
    return
  }
  res.writeHead(200)
  res.end('Mach12.ai Collaboration Server')
})

const wss = new WebSocket.Server({ server })

wss.on('connection', (conn, req) => {
  const room = (req.url || '/').slice(1) || 'default'
  const doc = getDoc(room)
  const awarenessStates = new Set()

  doc.conns.set(conn, awarenessStates)
  console.log(`[ws] Client joined "${room}" (${doc.conns.size} clients)`)

  // Track awareness client ids registered through this connection so close
  // cleanup can release them immediately (otherwise locks linger until the
  // 30s outdated timeout fires on every peer).
  const awarenessChangeHandler = ({ added, updated, removed }, origin) => {
    if (origin !== conn) return
    added.forEach((id) => awarenessStates.add(id))
    updated.forEach((id) => awarenessStates.add(id))
    removed.forEach((id) => awarenessStates.delete(id))
  }
  doc.awareness.on('change', awarenessChangeHandler)

  // Send initial sync step 1
  const encoder = encoding.createEncoder()
  encoding.writeVarUint(encoder, MSG_SYNC)
  syncProtocol.writeSyncStep1(encoder, doc)
  send(conn, encoding.toUint8Array(encoder))

  // Send current awareness states
  const awarenessEncoder = encoding.createEncoder()
  encoding.writeVarUint(awarenessEncoder, MSG_AWARENESS)
  encoding.writeVarUint8Array(
    awarenessEncoder,
    awarenessProtocol.encodeAwarenessUpdate(
      doc.awareness,
      Array.from(doc.awareness.getStates().keys())
    )
  )
  send(conn, encoding.toUint8Array(awarenessEncoder))

  conn.on('message', (message) => {
    try {
      const buf = new Uint8Array(message)
      const decoder = decoding.createDecoder(buf)
      const messageType = decoding.readVarUint(decoder)

      if (messageType === MSG_SYNC) {
        const encoder = encoding.createEncoder()
        encoding.writeVarUint(encoder, MSG_SYNC)
        syncProtocol.readSyncMessage(decoder, encoder, doc, conn)
        const reply = encoding.toUint8Array(encoder)
        if (encoding.length(encoder) > 1) {
          send(conn, reply)
        }

        // Broadcast to other clients
        if (messageType === MSG_SYNC) {
          doc.conns.forEach((_, otherConn) => {
            if (otherConn !== conn) {
              send(otherConn, buf)
            }
          })
        }
      } else if (messageType === MSG_AWARENESS) {
        const update = decoding.readVarUint8Array(decoder)
        awarenessProtocol.applyAwarenessUpdate(doc.awareness, update, conn)

        // Broadcast awareness to all other clients
        const awarenessEncoder = encoding.createEncoder()
        encoding.writeVarUint(awarenessEncoder, MSG_AWARENESS)
        encoding.writeVarUint8Array(awarenessEncoder, update)
        const awarenessMsg = encoding.toUint8Array(awarenessEncoder)

        doc.conns.forEach((_, otherConn) => {
          if (otherConn !== conn) {
            send(otherConn, awarenessMsg)
          }
        })
      }
    } catch (err) {
      console.error('[ws] message error:', err)
    }
  })

  // Listen for doc updates and broadcast
  const updateHandler = (update, origin) => {
    if (origin === conn) return
    const encoder = encoding.createEncoder()
    encoding.writeVarUint(encoder, MSG_SYNC)
    syncProtocol.writeUpdate(encoder, update)
    doc.conns.forEach((_, otherConn) => {
      send(otherConn, encoding.toUint8Array(encoder))
    })
  }
  doc.on('update', updateHandler)

  conn.on('close', () => {
    doc.conns.delete(conn)
    doc.off('update', updateHandler)
    doc.awareness.off('change', awarenessChangeHandler)
    awarenessProtocol.removeAwarenessStates(doc.awareness, Array.from(awarenessStates), null)
    console.log(`[ws] Client left "${room}" (${doc.conns.size} clients)`)

    // Clean up empty rooms after a delay
    if (doc.conns.size === 0) {
      setTimeout(() => {
        if (doc.conns.size === 0) {
          doc.destroy()
          docs.delete(room)
          console.log(`[ws] Room "${room}" destroyed`)
        }
      }, 30000)
    }
  })
})

server.listen(PORT, () => {
  console.log(`[ws] Mach12.ai collaboration server running on ws://localhost:${PORT}`)
})
