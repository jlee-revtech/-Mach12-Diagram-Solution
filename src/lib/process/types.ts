import type { Node, Edge } from '@xyflow/react'
import type { LogicalSystem, Persona, HydratedCapability } from '@/lib/sipoc/types'

// ─── Hierarchy ─────────────────────────────────────────
// L1 Scenario → L2 Process Group → L3 Process (leaf, owns a BPMN graph)
export type ProcessLevel = 1 | 2 | 3
export type ProcessNodeKind = 'scenario' | 'process_group' | 'process'

export const PROCESS_NODE_KIND_BY_LEVEL: Record<ProcessLevel, ProcessNodeKind> = {
  1: 'scenario',
  2: 'process_group',
  3: 'process',
}

export const PROCESS_LEVEL_LABEL: Record<ProcessLevel, string> = {
  1: 'Scenario',
  2: 'Process Group',
  3: 'Process',
}

// ─── Process Model (top-level container) ───────────────
export interface ProcessModelRow {
  id: string
  organization_id: string
  title: string
  description: string | null
  source_reference_id: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
  archived_at: string | null
}

// ─── Process Node (hierarchy element) ──────────────────
export interface ProcessNode {
  id: string
  process_model_id: string
  parent_id: string | null
  level: number               // 1 = Scenario, 2 = Process Group, 3 = Process (leaf)
  node_kind: ProcessNodeKind
  name: string
  description?: string
  color?: string | null
  sort_order: number
  is_leaf: boolean
  graph_data?: ProcessGraph | null
  sipoc_capability_id?: string | null
  scope_item_ref?: string | null
  created_at: string
  updated_at: string
}

export interface ProcessNodeTreeNode extends ProcessNode {
  children: ProcessNodeTreeNode[]
}

// ─── BPMN-on-xyflow leaf graph ─────────────────────────
export type BpmnElementType =
  | 'task'
  | 'userTask'
  | 'serviceTask'
  | 'manualTask'
  | 'subProcess'
  | 'startEvent'
  | 'endEvent'
  | 'intermediateEvent'
  | 'boundaryEvent'
  | 'exclusiveGateway'
  | 'parallelGateway'
  | 'inclusiveGateway'
  | 'eventBasedGateway'

export interface RaciAssignment {
  r?: string[]   // responsible (persona names/ids)
  a?: string[]   // accountable
  c?: string[]   // consulted
  i?: string[]   // informed
}

export interface ProcessElementData extends Record<string, unknown> {
  label: string
  elementType: BpmnElementType
  laneId?: string
  description?: string
  raci?: RaciAssignment
  systemId?: string
  overlayCodes?: string[]
}

export type ProcessElementNode = Node<ProcessElementData, 'processElement'>

export type SequenceFlowKind = 'sequence' | 'conditional' | 'default' | 'message'

export interface SequenceFlowData extends Record<string, unknown> {
  label?: string
  kind: SequenceFlowKind
  condition?: string
  labelPosition?: number
}

export type SequenceFlowEdge = Edge<SequenceFlowData, 'sequenceFlow'>

export interface ProcessLane {
  id: string
  label: string
  systemId?: string | null
  personaId?: string | null
  order: number
  color?: string
}

export interface ProcessGraph {
  lanes: ProcessLane[]
  nodes: ProcessElementNode[]
  edges: SequenceFlowEdge[]
  viewport?: { x: number; y: number; zoom: number }
}

// ─── Normalized lane row (lane → org system / persona) ─
export interface ProcessNodeLane {
  id: string
  process_node_id: string
  lane_key: string
  logical_system_id: string | null
  persona_id: string | null
  label: string | null
  sort_order: number
  created_at: string
}

// ─── A&D Overlay (RevTech/Mach12 know-how) ─────────────
export type OverlayKind = 'control' | 'variant' | 'accelerator' | 'kpi' | 'scope_item' | 'compliance'
export type ComplianceFramework = 'CAS' | 'DCAA' | 'EVMS' | 'FAR' | 'DFARS' | 'CMMC' | 'ITAR' | 'Other'

export interface OverlayPayload {
  code?: string
  title: string
  framework?: ComplianceFramework
  clause?: string
  raci?: RaciAssignment
  kpiTarget?: string
  acceleratorRef?: string
  notes?: string
}

export interface ProcessOverlay {
  id: string
  process_node_id: string
  overlay_kind: OverlayKind
  payload: OverlayPayload
  sort_order: number
  created_at: string
  updated_at: string
}

// ─── Reference Library (shared seed, global) ───────────
export interface ReferenceLibraryRow {
  id: string
  code: string
  title: string
  version: string
  source: string            // 'curated' | 'signavio-import' | 'ai-bootstrapped'
  published_at: string | null
  is_active: boolean
}

export interface ReferenceScenario {
  id: string
  library_id: string
  parent_id: string | null
  level: number
  node_kind: ProcessNodeKind
  name: string
  description?: string
  scope_item_ref?: string
  sort_order: number
  graph_data?: ProcessGraph | null
}

export interface ReferenceScenarioTreeNode extends ReferenceScenario {
  children: ReferenceScenarioTreeNode[]
  overlays: ProcessOverlay[]
}

// ─── Hydrated leaf (lanes resolved + overlays + SIPOC) ─
export interface HydratedProcessLeaf extends ProcessNode {
  lanes: (ProcessLane & { system: LogicalSystem | null; persona: Persona | null })[]
  overlays: ProcessOverlay[]
  sipoc: HydratedCapability | null
}

// ─── Presets ───────────────────────────────────────────
// Representative A&D / GovCon end-to-end L1 scenarios, modeled on SAP
// value-chain naming but tailored to Aerospace & Defense.
export const PROCESS_REFERENCE_SCENARIOS = [
  'Bid-to-Win (Capture & Proposal)',
  'Contract-to-Closeout (Acquisition Mgmt)',
  'Plan-to-Produce (Program Execution)',
  'Source-to-Pay (Procurement & Subcontracts)',
  'Design-to-Release (Engineering / PLM)',
  'Acquire-to-Retire (Asset / Property / GFP)',
  'Sustainment / MRO',
  'Record-to-Report (Finance / EVMS / DCAA)',
  'Hire-to-Retire (Workforce / Clearances)',
] as const

export const BPMN_PALETTE: { type: BpmnElementType; label: string; group: string; color: string }[] = [
  { type: 'startEvent', label: 'Start', group: 'Events', color: '#10B981' },
  { type: 'endEvent', label: 'End', group: 'Events', color: '#EF4444' },
  { type: 'intermediateEvent', label: 'Intermediate', group: 'Events', color: '#F59E0B' },
  { type: 'task', label: 'Task', group: 'Activities', color: '#2563EB' },
  { type: 'userTask', label: 'User Task', group: 'Activities', color: '#2563EB' },
  { type: 'serviceTask', label: 'Service Task', group: 'Activities', color: '#0EA5E9' },
  { type: 'manualTask', label: 'Manual Task', group: 'Activities', color: '#6366F1' },
  { type: 'subProcess', label: 'Sub-Process', group: 'Activities', color: '#8B5CF6' },
  { type: 'exclusiveGateway', label: 'Exclusive (XOR)', group: 'Gateways', color: '#EAB308' },
  { type: 'parallelGateway', label: 'Parallel (AND)', group: 'Gateways', color: '#EAB308' },
  { type: 'inclusiveGateway', label: 'Inclusive (OR)', group: 'Gateways', color: '#EAB308' },
  { type: 'eventBasedGateway', label: 'Event-Based', group: 'Gateways', color: '#EAB308' },
]

export const COMPLIANCE_FRAMEWORKS: ComplianceFramework[] = [
  'CAS', 'DCAA', 'EVMS', 'FAR', 'DFARS', 'CMMC', 'ITAR', 'Other',
]

// ─── Node accent colors per level (matches capabilities palette) ─
export const PROCESS_LEVEL_COLORS = ['#0EA5E9', '#8B5CF6', '#10B981'] as const
