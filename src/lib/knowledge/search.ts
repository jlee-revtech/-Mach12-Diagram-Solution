import { knowledgeAdmin } from './sharedClient'
import { embeddingsEnabled, embedQuery, toVectorLiteral } from './embed'
import type { KnowledgeHit, KnowledgeSearchResult } from './types'

interface SearchOpts {
  query: string
  workstreams?: string[] | null  // restrict to chunks tagged with any of these
  tenantKey?: string | null      // include this tenant's rows + all global rows
  limit?: number
}

// RAG retrieval over the shared knowledge repository. Uses semantic (pgvector)
// search when an embedding provider is configured, otherwise full-text. Returns
// chunks hydrated with their source code/title for citation.
export async function searchKnowledge(opts: SearchOpts): Promise<KnowledgeSearchResult> {
  const db = knowledgeAdmin()
  const limit = opts.limit ?? 8
  const filterWs = opts.workstreams && opts.workstreams.length ? opts.workstreams : null
  const filterTenant = opts.tenantKey ?? null

  let rows: Array<{ id: string; source_id: string; content: string; workstream_codes: string[]; score: number }> = []
  let mode: 'semantic' | 'lexical' = 'lexical'

  if (embeddingsEnabled()) {
    const vec = await embedQuery(opts.query)
    if (vec) {
      mode = 'semantic'
      const { data, error } = await db.rpc('kb_match_chunks', {
        query_embedding: toVectorLiteral(vec),
        match_count: limit,
        filter_tenant: filterTenant,
        filter_workstreams: filterWs,
      })
      if (error) throw new Error(`kb_match_chunks failed: ${error.message}`)
      rows = (data || []).map((d: { id: string; source_id: string; content: string; workstream_codes: string[]; similarity: number }) => ({
        id: d.id, source_id: d.source_id, content: d.content, workstream_codes: d.workstream_codes, score: d.similarity,
      }))
    }
  }

  if (mode === 'lexical') {
    const { data, error } = await db.rpc('kb_search_chunks_text', {
      query_text: opts.query,
      match_count: limit,
      filter_tenant: filterTenant,
      filter_workstreams: filterWs,
    })
    if (error) throw new Error(`kb_search_chunks_text failed: ${error.message}`)
    rows = (data || []).map((d: { id: string; source_id: string; content: string; workstream_codes: string[]; rank: number }) => ({
      id: d.id, source_id: d.source_id, content: d.content, workstream_codes: d.workstream_codes, score: d.rank,
    }))
  }

  // Hydrate source code/title for citations.
  const sourceIds = [...new Set(rows.map((r) => r.source_id))]
  const titles: Record<string, { code: string; title: string }> = {}
  if (sourceIds.length) {
    const { data: srcs } = await db.from('kb_sources').select('id, code, title').in('id', sourceIds)
    for (const s of srcs || []) titles[s.id] = { code: s.code, title: s.title }
  }

  const hits: KnowledgeHit[] = rows.map((r) => ({
    chunkId: r.id,
    sourceId: r.source_id,
    sourceCode: titles[r.source_id]?.code,
    sourceTitle: titles[r.source_id]?.title,
    content: r.content,
    workstreamCodes: r.workstream_codes || [],
    score: r.score,
  }))

  return { mode, hits }
}
