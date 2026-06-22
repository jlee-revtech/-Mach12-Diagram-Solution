// ─── Workstream agent runtime types ────────────────────

export interface AgentDef {
  code: string                  // workstream code or 'enterprise'
  display_name: string
  tagline?: string | null
  system_persona?: string | null
  sap_modules?: string[]
  dassian_modules?: string[]
  knowledge_source_codes?: string[]
  model?: string | null
  temperature?: number | null
  is_orchestrator?: boolean
  sort_order?: number
}

export type Pillar = 'People' | 'Process' | 'Data' | 'Technology'

export interface Recommendation {
  pillar: Pillar
  title: string
  detail: string
  rationale?: string
}

export interface Citation {
  sourceCode?: string
  sourceTitle?: string
}

// What the chat route streams back, and what we persist per assistant turn.
export interface AssistantTurn {
  text: string
  citations: Citation[]
  recommendations: Recommendation[]
  toolTrace: { name: string; summary: string }[]
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}
