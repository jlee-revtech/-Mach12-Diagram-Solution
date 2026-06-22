import { knowledgeAdmin } from './sharedClient'
import { chunkText } from './chunk'
import { embedTexts } from './embed'

// Re-chunk and (re-)embed a knowledge source. Idempotent: clears the source's
// existing chunks first. Embeddings are written only when a provider is
// configured; otherwise chunks are stored embedding-less and served via the
// lexical fallback.
export async function ingestSource(sourceId: string): Promise<{ chunks: number; embedded: boolean }> {
  const db = knowledgeAdmin()
  const { data: source, error } = await db
    .from('kb_sources')
    .select('id, body, tenant_key, workstream_codes')
    .eq('id', sourceId)
    .single()
  if (error || !source) throw new Error(`Source not found: ${sourceId}`)

  const chunks = chunkText(source.body || '')
  await db.from('kb_chunks').delete().eq('source_id', sourceId)
  if (chunks.length === 0) return { chunks: 0, embedded: false }

  let vectors: number[][] | null = null
  try {
    vectors = await embedTexts(chunks.map((c) => c.content))
  } catch (e) {
    console.error('Embedding failed; storing chunks for lexical fallback.', e)
    vectors = null
  }

  const rows = chunks.map((c, i) => ({
    source_id: sourceId,
    tenant_key: source.tenant_key ?? null,
    workstream_codes: source.workstream_codes ?? [],
    chunk_index: c.index,
    content: c.content,
    token_count: c.tokenCount,
    embedding: vectors ? `[${vectors[i].join(',')}]` : null,
  }))

  const { error: insErr } = await db.from('kb_chunks').insert(rows)
  if (insErr) throw new Error(`Failed to insert chunks: ${insErr.message}`)
  return { chunks: rows.length, embedded: !!vectors }
}
