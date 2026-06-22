import { NextRequest, NextResponse } from 'next/server'
import { ingestSource } from '@/lib/knowledge/ingest'

// Re-chunk + re-embed an existing source (e.g. after editing, or once an
// embedding key is added). Body: { sourceId }.
export async function POST(req: NextRequest) {
  try {
    const { sourceId } = await req.json()
    if (!sourceId) return NextResponse.json({ error: 'sourceId is required' }, { status: 400 })
    const result = await ingestSource(sourceId)
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'ingest failed' }, { status: 500 })
  }
}
