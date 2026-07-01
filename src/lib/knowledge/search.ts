import type { KnowledgeSearchResult } from './types'
import { createKnowledgeClient, type KnowledgeClient } from '@jlee-revtech/agent-core'

// RAG retrieval over the shared knowledge repository. Delegates to the shared
// @jlee-revtech/agent-core knowledge client (semantic via Voyage + lexical
// fallback, source hydration for citations) so the retrieval logic is not
// duplicated between this app and SAP Solution Studio. Public signature is
// unchanged, so every caller (agent tools, /api/knowledge/search, the UI) keeps
// working. Embedding of ingested documents still uses ./embed + ./sharedClient.

interface SearchOpts {
  query: string
  workstreams?: string[] | null  // restrict to chunks tagged with any of these
  tenantKey?: string | null      // include this tenant's rows + all global rows
  limit?: number
}

let client: KnowledgeClient | null = null
function kb(): KnowledgeClient {
  if (!client) {
    client = createKnowledgeClient({
      url: process.env.KNOWLEDGE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
      serviceKey: process.env.KNOWLEDGE_SUPABASE_SERVICE_KEY,
      voyageKey: process.env.VOYAGE_API_KEY,
      voyageModel: process.env.VOYAGE_MODEL,
    })
  }
  return client
}

export async function searchKnowledge(opts: SearchOpts): Promise<KnowledgeSearchResult> {
  return kb().search(opts)
}
