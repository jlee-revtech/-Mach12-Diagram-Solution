// ─── Capability Map domain types ───────────────────────
// A business/application capability realized by one or more bedrock systems
// (Logical Bedrock Systems and/or specific Physical Systems).

export interface Capability {
  id: string
  organization_id: string
  name: string
  description: string | null
  domain: string | null
  workstream_id: string | null   // value stream (workstream) alignment
  color: string | null
  sort_order: number
  source: string            // 'manual' | 'ai'
  archived_at: string | null
  created_at: string
  updated_at: string
}

export interface CapabilitySystemLink {
  id: string
  organization_id: string
  capability_id: string
  bedrock_system_id: string | null    // Logical Bedrock System
  physical_system_id: string | null   // Physical System
  created_at: string
}

export interface CapabilityWithSystems extends Capability {
  logicalSystemIds: string[]   // bedrock_systems.id[]
  physicalSystemIds: string[]  // bedrock_physical_systems.id[]
}
