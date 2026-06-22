import { NextRequest, NextResponse } from 'next/server'
import { searchKnowledge } from '@/lib/knowledge/search'

// RAG retrieval endpoint. Used by the agent's search_knowledge tool and the
// Knowledge admin UI. Server-only (service role) so it can read tenant rows.
export async function POST(req: NextRequest) {
  try {
    const { query, workstreams, tenantKey, limit } = await req.json()
    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'query is required' }, { status: 400 })
    }
    const result = await searchKnowledge({ query, workstreams: workstreams ?? null, tenantKey: tenantKey ?? null, limit })
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'search failed' }, { status: 500 })
  }
}
