// Workshop domain types (mirror the workshop_* tables in migration 040).

export type WorkshopStatus = 'draft' | 'scheduled' | 'live' | 'completed' | 'archived'
export type WorkshopFocus = 'process' | 'data' | 'integration' | 'capability' | 'poc' | 'discussion'
export type CaptureType =
  | 'decision' | 'action' | 'deliverable' | 'risk' | 'question' | 'architecture_change' | 'parking_lot'
export type CaptureStatus = 'proposed' | 'confirmed' | 'applied' | 'dismissed'
export type ParticipantKind = 'person' | 'agent'
export type SpeakerKind = 'person' | 'agent' | 'system'
export type AgendaStatus = 'pending' | 'active' | 'done' | 'skipped'

export const FOCUS_AREAS: { key: WorkshopFocus; label: string; blurb: string }[] = [
  { key: 'process', label: 'Process', blurb: 'End-to-end process flows and controls' },
  { key: 'data', label: 'Data Definitions', blurb: 'Data objects, fields, and definitions' },
  { key: 'integration', label: 'Data Integrations', blurb: 'Interfaces and integration seams' },
  { key: 'capability', label: 'Capabilities', blurb: 'Capability fit and assignment' },
  { key: 'poc', label: 'PoC / Demo', blurb: 'Walk a proof of concept, get feedback' },
]

export const CAPTURE_META: Record<CaptureType, { label: string; color: string; icon: string }> = {
  decision: { label: 'Decision', color: '#2563EB', icon: '✓' },
  action: { label: 'Action', color: '#7C3AED', icon: '→' },
  deliverable: { label: 'Deliverable', color: '#0891B2', icon: '▤' },
  risk: { label: 'Risk', color: '#DC2626', icon: '⚠' },
  question: { label: 'Open Question', color: '#D97706', icon: '?' },
  architecture_change: { label: 'Architecture Change', color: '#059669', icon: '↻' },
  parking_lot: { label: 'Parking Lot', color: '#6B7280', icon: '○' },
}

export interface WorkshopBriefData {
  summary: string
  objectives: string[]
  agenda: { title: string; objective?: string; focusType?: WorkshopFocus; timeboxMinutes?: number }[]
  preRead: string
  gaps: string[]
  keyQuestions: string[]
  risks: string[]
}

export interface Workshop {
  id: string
  organization_id: string
  title: string
  topic: string | null
  objective: string | null
  customer_name: string | null
  status: WorkshopStatus
  focus_areas: WorkshopFocus[]
  workstream_codes: string[]
  scheduled_at: string | null
  started_at: string | null
  ended_at: string | null
  brief: WorkshopBriefData | null
  recap: unknown | null
  settings: Record<string, unknown>
  created_by: string | null
  created_at: string
  updated_at: string
  archived_at: string | null
}

export interface WorkshopParticipant {
  id: string
  workshop_id: string
  kind: ParticipantKind
  display_name: string
  email: string | null
  org_role: string | null
  workstream_code: string | null
  is_facilitator: boolean
  persona_id: string | null
  created_at: string
}

// Facilitation-content classification (migration 046)
export type SectionKind = 'overview' | 'workstream' | 'evaluation'

export interface WorkshopAgendaItem {
  id: string
  workshop_id: string
  sort_order: number
  title: string
  objective: string | null
  focus_type: WorkshopFocus | null
  timebox_minutes: number | null
  status: AgendaStatus
  linked_artifact_type: string | null
  linked_artifact_id: string | null
  notes: string | null
  // 046: classify the agenda item for the facilitation-content layer.
  section_kind?: SectionKind | null
  workstream_code?: string | null
  created_at: string
  updated_at: string
}

export interface WorkshopScenario {
  id: string
  workshop_id: string
  agenda_item_id: string | null
  sort_order: number
  title: string
  description: string | null
  focus_type: WorkshopFocus | null
  linked_artifact_type: string | null
  linked_artifact_id: string | null
  created_at: string
}

export interface WorkshopMessage {
  id: string
  workshop_id: string
  agenda_item_id: string | null
  seq: number | null
  speaker_kind: SpeakerKind
  speaker_name: string | null
  speaker_role: string | null
  workstream_code: string | null
  source: string
  content: string
  meta: Record<string, unknown> | null
  created_at: string
}

export interface WorkshopCapture {
  id: string
  workshop_id: string
  agenda_item_id: string | null
  capture_type: CaptureType
  title: string
  detail: string | null
  owner: string | null
  due_date: string | null
  status: CaptureStatus
  workstream_code: string | null
  source_message_id: string | null
  payload: Record<string, unknown> | null
  created_by_kind: string
  applied_at: string | null
  created_at: string
  updated_at: string
}
