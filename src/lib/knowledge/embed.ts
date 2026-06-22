// Embedding provider abstraction. Defaults to Voyage AI (voyage-3, 1024 dims —
// Anthropic's recommended embeddings partner). OpenAI text-embedding-3-small is
// supported with the `dimensions` param pinned to 1024 to match the pgvector
// column. When no key is configured, embeddings are disabled and callers fall
// back to lexical (full-text) retrieval.

export const EMBEDDING_DIM = 1024

const PROVIDER = (process.env.EMBEDDING_PROVIDER || 'voyage').toLowerCase()

export function embeddingsEnabled(): boolean {
  if (PROVIDER === 'voyage') return !!process.env.VOYAGE_API_KEY
  if (PROVIDER === 'openai') return !!process.env.OPENAI_API_KEY
  return false
}

// Embed a batch of texts. Returns null when embeddings are disabled.
export async function embedTexts(texts: string[]): Promise<number[][] | null> {
  if (!embeddingsEnabled() || texts.length === 0) return null
  if (PROVIDER === 'openai') return embedOpenAI(texts)
  return embedVoyage(texts)
}

export async function embedQuery(text: string): Promise<number[] | null> {
  const out = await embedTexts([text])
  return out ? out[0] : null
}

async function embedVoyage(texts: string[]): Promise<number[][]> {
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({ input: texts, model: process.env.VOYAGE_MODEL || 'voyage-3', input_type: 'document' }),
  })
  if (!res.ok) throw new Error(`Voyage embeddings failed: ${res.status} ${await res.text()}`)
  const json = await res.json()
  return json.data.map((d: { embedding: number[] }) => d.embedding)
}

async function embedOpenAI(texts: string[]): Promise<number[][]> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ input: texts, model: 'text-embedding-3-small', dimensions: EMBEDDING_DIM }),
  })
  if (!res.ok) throw new Error(`OpenAI embeddings failed: ${res.status} ${await res.text()}`)
  const json = await res.json()
  return json.data.map((d: { embedding: number[] }) => d.embedding)
}

// pgvector accepts a bracketed string literal; stringify so PostgREST casts
// text -> vector cleanly when calling the match RPC.
export function toVectorLiteral(vec: number[]): string {
  return `[${vec.join(',')}]`
}
