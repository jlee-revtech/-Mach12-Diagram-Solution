// ─── Knowledge Repository domain types ─────────────────

export type KnowledgeKind = 'skill' | 'baseline' | 'customer-doc' | 'reference'
export type KnowledgeOrigin = 'solution-studio' | 'diagram-app' | 'upload'

export interface KnowledgeSource {
  id: string
  code: string
  title: string
  description?: string | null
  kind: KnowledgeKind
  origin: KnowledgeOrigin
  tenant_key?: string | null
  workstream_codes?: string[]
  version?: string | null
  frontmatter?: Record<string, unknown> | null
  body?: string | null
  source_app?: string | null
  created_at?: string
  updated_at?: string
}

export interface KnowledgeHit {
  chunkId: string
  sourceId: string
  sourceCode?: string
  sourceTitle?: string
  content: string
  workstreamCodes: string[]
  score: number
}

export type RetrievalMode = 'semantic' | 'lexical'

export interface KnowledgeSearchResult {
  mode: RetrievalMode
  hits: KnowledgeHit[]
}
