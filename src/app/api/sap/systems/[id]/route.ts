import { NextRequest, NextResponse } from 'next/server'

import { sealWith } from '@/lib/sap/credentialCookie'
import { deleteSystem, orgClient, updateSystem } from '@/lib/sap/db'
import type { SapSystemInput } from '@/lib/sap/types'
import { validate } from '../route'

// PATCH / DELETE one registry entry. Deleting also drops any logon this browser
// still holds for it, so a removed system cannot leave a live session behind.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  try {
    const body = (await req.json()) as { orgId?: string } & Partial<SapSystemInput>
    if (!body.orgId) return NextResponse.json({ error: 'orgId is required' }, { status: 400 })

    const invalid = validate(body)
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })

    const system = await updateSystem(orgClient(req), body.orgId, id, {
      name: body.name!,
      mode: body.mode!,
      host: body.host,
      port: body.port,
      useSsl: body.useSsl,
      client: body.client,
      language: body.language,
      username: body.username,
      destinationName: body.destinationName,
      defaultControllingArea: body.defaultControllingArea,
      description: body.description,
    })
    return NextResponse.json({ system })
  } catch (err) {
    return NextResponse.json({ error: message(err) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const orgId = req.nextUrl.searchParams.get('orgId')
  if (!orgId) return NextResponse.json({ error: 'orgId is required' }, { status: 400 })

  try {
    await deleteSystem(orgClient(req), orgId, id)
    const res = NextResponse.json({ ok: true })
    const cookie = sealWith(req, id, null)
    if (cookie) res.headers.set('Set-Cookie', cookie)
    return res
  } catch (err) {
    return NextResponse.json({ error: message(err) }, { status: 500 })
  }
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : 'Request failed.'
}
