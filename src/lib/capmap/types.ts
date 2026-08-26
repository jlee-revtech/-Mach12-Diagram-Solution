// ─── Capability Map domain types ───────────────────────
// A business/application capability realized by one or more bedrock systems
// (Logical Bedrock Systems and/or specific Physical Systems).

import type { CapabilityScope, CapabilityScopePriority, CapabilityFit } from '@/lib/capmap/scope'

export interface Capability {
  id: string
  organization_id: string
  name: string
  description: string | null
  domain: string | null
  workstream_id: string | null   // value stream (workstream) alignment
  color: string | null
  sort_order: number
  source: string            // 'manual' | 'ai' | 'standard' | 'copied'
  archived_at: string | null
  created_at: string
  updated_at: string

  // ─── Scoping (per-org assessment; see lib/capmap/scope.ts) ───
  scope: CapabilityScope | null                  // null = not assessed
  scope_priority: CapabilityScopePriority | null // only when scope = 'in'
  future_phase: boolean                          // only when scope = 'out'
  fit: CapabilityFit | null                      // only when scope = 'in'
  scope_note: string | null
  scope_decided_at: string | null
  scope_decided_by: string | null

  // ─── Provenance (set when copied from a base library org) ───
  source_capability_id: string | null
  source_organization_id: string | null
  copied_at: string | null
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
