import { NextRequest, NextResponse } from 'next/server'

import { credentialStoreAvailable, readVault, sealWith } from '@/lib/sap/credentialCookie'
import { getSystem, orgClient } from '@/lib/sap/db'
import { DirectSapReader } from '@/lib/sap/directReader'
import { resolveReader } from '@/lib/sap/resolveReader'

// Log on to one registered system.
//
//   POST   { orgId, systemId, username, password }  -> test, then remember
//   GET    ?orgId                                   -> which systems this browser
//                                                      currently holds a logon for
//   DELETE ?systemId                                -> forget one (or all)
//
// The password is verified against SAP before anything is stored, and is only
// ever written into the encrypted httpOnly cookie - never the database, never
// the response.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      orgId?: string
      systemId?: string
      username?: string
      password?: string
    }
    if (!body.orgId || !body.systemId) {
      return NextResponse.json({ error: 'orgId and systemId are required' }, { status: 400 })
    }

    const system = await getSystem(orgClient(req), body.orgId, body.systemId)
    if (!system) return NextResponse.json({ error: 'System not found.' }, { status: 404 })

    // Bridge systems carry no credentials - Solution Studio owns the logon. Just
    // confirm the route is alive.
    if (system.mode === 'bridge') {
      const resolved = resolveReader(req, system)
      if (!resolved.ok) return NextResponse.json({ error: resolved.reason }, { status: 400 })
      const status = await resolved.reader.testConnection()
      return NextResponse.json({ status }, { status: status.connected ? 200 : 502 })
    }

    if (!credentialStoreAvailable()) {
      return NextResponse.json(
        {
          error:
            'Direct SAP logon is disabled: no SAP_SESSION_SECRET is configured on this deployment.',
        },
        { status: 503 }
      )
    }
    if (!body.username || !body.password) {
      return NextResponse.json({ error: 'A user and password are required.' }, { status: 400 })
    }
    if (!system.host || !system.port || !system.client) {
      return NextResponse.json(
        { error: `System "${system.name}" is missing its host, port, or client.` },
        { status: 400 }
      )
    }

    const reader = new DirectSapReader({
      systemId: system.id,
      label: system.name,
      host: system.host,
      port: system.port,
      useSsl: system.useSsl,
      client: system.client,
      language: system.language ?? 'EN',
      username: body.username,
      password: body.password,
    })
    const status = await reader.testConnection()
    if (!status.connected) return NextResponse.json({ status }, { status: 502 })

    const res = NextResponse.json({ status })
    const cookie = sealWith(req, system.id, {
      username: body.username,
      password: body.password,
    })
    if (cookie) res.headers.set('Set-Cookie', cookie)
    return res
  } catch (err) {
    return NextResponse.json({ error: message(err) }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  // Which systems this browser is signed in to. Ids only - no credential material.
  return NextResponse.json({
    signedInSystemIds: Object.keys(readVault(req)),
    directAvailable: credentialStoreAvailable(),
  })
}

export async function DELETE(req: NextRequest) {
  const systemId = req.nextUrl.searchParams.get('systemId')
  const res = NextResponse.json({ ok: true })
  if (systemId) {
    const cookie = sealWith(req, systemId, null)
    if (cookie) res.headers.set('Set-Cookie', cookie)
  } else {
    const { clearedCookie } = await import('@/lib/sap/credentialCookie')
    res.headers.set('Set-Cookie', clearedCookie())
  }
  return res
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : 'Request failed.'
}
