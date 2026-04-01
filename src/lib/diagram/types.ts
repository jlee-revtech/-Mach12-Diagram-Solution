import type { Node, Edge } from '@xyflow/react'

// ─── System Types ───────────────────────────────────────
export type SystemType =
  | 'erp'
  | 'crm'
  | 'plm'
  | 'scm'
  | 'middleware'
  | 'database'
  | 'data_warehouse'
  | 'analytics'
  | 'mes'
  | 'clm'
  | 'cloud'
  | 'legacy'
  | 'ppm'
  | 'ims'
  | 'siop'
  | 'mps'
  | 'hcm'
  | 'custom'

// ─── Modules (sub-components within a system) ──────────
export interface SystemModule {
  id: string
  name: string
  description?: string
}

export interface SystemData extends Record<string, unknown> {
  label: string
  systemType: SystemType
  physicalSystem?: string
  description?: string
  icon?: string
  modules?: SystemModule[]
}

export type SystemNode = Node<SystemData, 'system'>

// ─── System Groups (umbrella around multiple systems) ───
export interface SystemGroupData extends Record<string, unknown> {
  label: string
  color?: string
}

export type SystemGroupNode = Node<SystemGroupData, 'systemGroup'>

// ─── Data Element Types ─────────────────────────────────
export type DataElementType = 'transaction' | 'master_data' | 'document' | 'event' | 'data_object' | 'custom'

export interface DataObjectAttribute {
  id: string
  name: string
  description?: string
}

export interface TechnicalProperty {
  id: string
  key: string
  value: string
}

export interface DataElement {
  id: string
  name: string
  elementType: DataElementType
  description?: string
  sapObject?: string
  processContext?: string
  attributes?: DataObjectAttribute[]
  technicalProperties?: TechnicalProperty[]
  outputArtifactIds?: string[]
}

// ─── Output Artifacts ──────────────────────────────────
export interface OutputArtifact {
  id: string
  name: string
  description?: string
}

export const OUTPUT_ARTIFACT_PRESETS = [
  'Approved Budget',
  'Organizational Forecast',
  'Cost and Schedule Estimate',
  'Bill of Materials',
  'Purchase Order',
  'Work Breakdown Structure',
  'Material Requirements Plan',
  'Production Schedule',
  'Quality Report',
  'Shipment Notice',
  'Invoice',
  'Financial Statement',
  'Compliance Report',
  'Change Order',
  'Engineering Drawing',
  'Test Results',
] as const

// ─── Data Flow Edge Types ───────────────────────────────
export type FlowDirection = 'forward' | 'bidirectional'

export interface DataFlowData extends Record<string, unknown> {
  label?: string
  dataElements: DataElement[]
  direction: FlowDirection
  processContext?: string
  outputArtifacts?: OutputArtifact[] // legacy per-edge artifacts
  outputArtifactIds?: string[] // references to diagram-level artifacts
  labelPosition?: number // 0–1 position along the edge path (default 0.5 = midpoint)
  sequence?: number // step order (1, 2, 3...) for sequencing data flows
}

export type DataFlowEdge = Edge<DataFlowData, 'dataFlow'>

// ─── Diagram Types ──────────────────────────────────────
export interface DiagramMeta {
  id: string
  title: string
  description?: string
  processContext?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

// ─── System Palette ─────────────────────────────────────
export interface SystemTemplate {
  type: SystemType
  label: string
  description: string
  color: string
}

export const SYSTEM_TEMPLATES: SystemTemplate[] = [
  { type: 'erp', label: 'ERP', description: 'Enterprise Resource Planning', color: '#2563EB' },
  { type: 'crm', label: 'CRM', description: 'Customer Relationship Mgmt', color: '#06B6D4' },
  { type: 'plm', label: 'PLM', description: 'Product Lifecycle Mgmt', color: '#8B5CF6' },
  { type: 'scm', label: 'SCM', description: 'Supply Chain Management', color: '#10B981' },
  { type: 'middleware', label: 'Middleware', description: 'Integration Layer', color: '#F97316' },
  { type: 'database', label: 'Database', description: 'Data Store', color: '#EF4444' },
  { type: 'data_warehouse', label: 'Data Warehouse', description: 'DW / Lakehouse', color: '#EAB308' },
  { type: 'analytics', label: 'Analytics', description: 'BI / Reporting', color: '#EC4899' },
  { type: 'mes', label: 'MES', description: 'Manufacturing Execution System', color: '#D946EF' },
  { type: 'clm', label: 'CLM', description: 'Contract Lifecycle Mgmt', color: '#F43F5E' },
  { type: 'cloud', label: 'Cloud', description: 'Cloud Platform', color: '#14B8A6' },
  { type: 'legacy', label: 'Legacy', description: 'Legacy System', color: '#64748B' },
  { type: 'ppm', label: 'PPM', description: 'Portfolio & Project Mgmt', color: '#0EA5E9' },
  { type: 'ims', label: 'IMS', description: 'Integrated Master Schedule', color: '#6366F1' },
  { type: 'siop', label: 'SIOP', description: 'Sales, Inventory, Ops Planning', color: '#84CC16' },
  { type: 'mps', label: 'MPS', description: 'Master Production Schedule', color: '#22D3EE' },
  { type: 'hcm', label: 'HCM', description: 'Human Capital Management', color: '#F472B6' },
  { type: 'custom', label: 'Custom', description: 'Custom System', color: '#A855F7' },
]

// ─── Process Context Options ────────────────────────────
export const PROCESS_CONTEXTS = [
  'Procure to Pay',
  'Order to Cash',
  'Plan to Produce',
  'Plan to Perform',
  'Record to Report',
  'Hire to Retire',
  'Design to Operate',
  'Source to Settle',
  'Acquire to Dispose',
  'Custom',
] as const
