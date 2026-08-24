import { NextRequest, NextResponse } from 'next/server'

import { deleteSnapshot, getSnapshot, listSnapshots, orgClient } from '@/lib/sap/db'

// Stored org-model pulls.
//   GET ?orgId              -> the org's snapshots, newest first (summaries only)
//   GET ?orgId&id=<uuid>    -> one snapshot with its full model + diagnostics
//   DELETE ?orgId&id=<uuid> -> drop one

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get('orgId')
  const id = req.nextUrl.searchParams.get('id')
  if (!orgId) return NextResponse.json({ error: 'orgId is required' }, { status: 400 })

  try {
    const db = orgClient(req)
    if (id) {
      const found = await getSnapshot(db, orgId, id)
      if (!found) return NextResponse.json({ error: 'Snapshot not found.' }, { status: 404 })
      return NextResponse.json(found)
    }
    return NextResponse.json({ snapshots: await listSnapshots(db, orgId) })
  } catch (err) {
    return NextResponse.json({ error: message(err) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get('orgId')
  const id = req.nextUrl.searchParams.get('id')
  if (!orgId || !id) return NextResponse.json({ error: 'orgId and id are required' }, { status: 400 })

  try {
    await deleteSnapshot(orgClient(req), orgId, id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: message(err) }, { status: 500 })
  }
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : 'Request failed.'
}
