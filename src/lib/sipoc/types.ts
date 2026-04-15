import type { SystemType } from '@/lib/diagram/types'

// ─── Personas ──────────────────────────────────────────
export interface Persona {
  id: string
  organization_id: string
  name: string
  role?: string
  description?: string
  color: string
  created_at: string
  updated_at: string
}

// ─── Information Products ──────────────────────────────
export interface InformationProduct {
  id: string
  organization_id: string
  name: string
  description?: string
  category?: string
  created_at: string
  updated_at: string
}

// ─── Logical Systems ───────────────────────────────────
export interface LogicalSystem {
  id: string
  organization_id: string
  name: string
  system_type?: SystemType
  description?: string
  color?: string
  created_at: string
  updated_at: string
}

// ─── Capability Maps ───────────────────────────────────
export interface CapabilityMapRow {
  id: string
  organization_id: string
  title: string
  description: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
  archived_at: string | null
}

// ─── Capabilities (the "P" in SIPOC) ───────────────────
export interface Capability {
  id: string
  capability_map_id: string
  parent_id: string | null    // null = root/L1
  level: number               // 1 = Core Area, 2 = Capability, 3 = Functionality (SIPOC)
  name: string
  description?: string
  features?: string[]
  color?: string | null        // accent color for L1/L2 groupings
  system_id?: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

// ─── Capability tree node (with children resolved) ─────
export interface CapabilityTreeNode extends Capability {
  children: CapabilityTreeNode[]
}

// ─── Reusable Capability Templates ─────────────────────
export interface CapabilityTemplateRow {
  id: string
  organization_id: string
  name: string
  description: string | null
  created_by: string | null
  template_data: {
    capability: { name: string; description?: string; features?: string[]; level: number; color?: string }
    system?: string  // system name
    inputs: {
      informationProduct: { name: string; category?: string }
      supplierPersonas: { name: string; role?: string; color: string }[]
      sourceSystems: { name: string; color?: string }[]
      feedingSystem?: { name: string; color?: string }
      dimensions: { name: string; description?: string }[]
    }[]
    outputs: {
      informationProduct: { name: string; category?: string }
      consumerPersonas: { name: string; role?: string; color: string }[]
      destinationSystems: { name: string; color?: string }[]
      dimensions: { name: string; description?: string }[]
    }[]
    // Keep hierarchy for children if this is an L1/L2 being saved
    children?: {
      name: string; description?: string; level: number
      children?: { name: string; description?: string; level: number }[]
    }[]
  }
  created_at: string
  updated_at: string
}

// ─── Tags (org-scoped, reusable) ───────────────────────
export interface Tag {
  id: string
  organization_id: string
  name: string
  color: string
  description?: string
  created_at: string
  updated_at: string
}

// ─── Dimensions (detail attributes on inputs/outputs) ──
export interface Dimension {
  id: string
  name: string
  description?: string
  tag_ids?: string[]
}

// ─── Capability Inputs (with supplier & system tags) ───
export interface CapabilityInput {
  id: string
  capability_id: string
  information_product_id: string
  supplier_persona_ids: string[]
  source_system_ids: string[]       // upstream system flow (ordered)
  feeding_system_id: string | null   // single system that feeds the process
  dimensions: Dimension[]
  tag_ids?: string[]
  sort_order: number
  created_at: string
}

// ─── Capability Outputs (with consumer tags) ───────────
export interface CapabilityOutput {
  id: string
  capability_id: string
  information_product_id: string
  consumer_persona_ids: string[]
  destination_system_ids: string[]   // downstream system flow (ordered)
  dimensions: Dimension[]
  sort_order: number
  created_at: string
}

// ─── Hydrated capability (all data resolved) ───────────
export interface HydratedCapability extends Capability {
  system: LogicalSystem | null
  inputs: (Omit<CapabilityInput, 'dimensions'> & {
    informationProduct: InformationProduct
    supplierPersonas: Persona[]
    sourceSystems: LogicalSystem[]
    feedingSystem: LogicalSystem | null
    tags: Tag[]
    dimensions: (Dimension & { tags: Tag[] })[]
  })[]
  outputs: (CapabilityOutput & {
    informationProduct: InformationProduct
    consumerPersonas: Persona[]
    destinationSystems: LogicalSystem[]
  })[]
}

// ─── Persona color presets ─────────────────────────────
export const PERSONA_COLORS = [
  '#6366F1', // indigo
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#EF4444', // red
  '#F97316', // orange
  '#EAB308', // yellow
  '#10B981', // emerald
  '#06B6D4', // cyan
  '#2563EB', // blue
  '#64748B', // slate
] as const

// ─── Information Product categories ────────────────────
export const IP_CATEGORIES = [
  'Financial',
  'Operational',
  'Engineering',
  'Supply Chain',
  'Human Resources',
  'Compliance',
  'Customer',
  'Program Management',
  'Quality',
  'Other',
] as const
