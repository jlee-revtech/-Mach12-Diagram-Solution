// ─── Workstream domain types ───────────────────────────
// A workstream is an org-scoped value stream. Every pillar entity (process,
// persona, role, data element, information product, logical system, capability,
// diagram) aligns to a "home" workstream, and may additionally align to others
// via workstream_alignments.

export interface Workstream {
  id: string
  organization_id: string
  code: string
  name: string
  description?: string | null
  color?: string | null
  icon?: string | null
  sort_order?: number
  source_reference_scenario_id?: string | null
  is_standard?: boolean
  archived_at?: string | null
  created_by?: string | null
  created_at?: string
  updated_at?: string
}

// One row of the workstream_rollup view (per-workstream KPI counts).
export interface WorkstreamRollup {
  workstream_id: string
  organization_id: string
  code: string
  process_models: number
  process_nodes: number
  capabilities: number
  capability_maps: number
  personas: number
  roles: number
  information_products: number
  data_elements: number
  systems: number
  diagrams: number
  integrations: number
}

// Entity types alignable through the polymorphic workstream_alignments join.
export type WorkstreamEntityType =
  | 'persona'
  | 'role'
  | 'data_element'
  | 'information_product'
  | 'logical_system'
  | 'process_model'
  | 'capability'
  | 'diagram'

export interface WorkstreamAlignment {
  id: string
  organization_id: string
  workstream_id: string
  entity_type: WorkstreamEntityType
  entity_id: string
  created_by?: string | null
  created_at?: string
}
