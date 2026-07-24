// Workshop domain types (mirror the workshop_* tables in migration 040).

export type WorkshopStatus = 'draft' | 'scheduled' | 'live' | 'completed' | 'archived'
// 056: the workshop's shape. 'decision' = Key Design Decision (analysis +
// recommendation); 'assessment' = Assessment / Discovery (conversational,
// questions -> opportunities -> AI-sequenced roadmap). 057: 'training' =
// Enablement / Training (topic -> per-role build-out -> Learning Path + Knowledge
// Check).
export type WorkshopArchetype = 'decision' | 'assessment' | 'training'
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

// Enumerated workshop archetypes. Selectable (never free text), per Josh's rule.
export const ARCHETYPE_OPTIONS: { key: WorkshopArchetype; label: string; blurb: string }[] = [
  {
    key: 'decision',
    label: 'Key Design Decision',
    blurb: 'Decision analysis and recommendation per workstream, reconciled by a Solution Architecture Evaluation.',
  },
  {
    key: 'assessment',
    label: 'Assessment / Discovery',
    blurb: 'Conversational current-state assessment: assessment questions, discovery questions, process / data / technology opportunities, and an AI-sequenced Opportunity Roadmap.',
  },
  {
    key: 'training',
    label: 'Training / Enablement',
    blurb: 'Set a training topic, align agents to it, and the agents build the training per role: role context, business process, data integrations, and hands-on tool training, then a Learning Path and a Knowledge Check.',
  },
]
export const DEFAULT_ARCHETYPE: WorkshopArchetype = 'decision'

// Enumerated tools / technology in scope for a workshop (training especially).
// Selectable (never free text), per Josh's rule; the "Other" free-add lets a
// facilitator name a system not on the canonical list.
export const SYSTEMS_IN_SCOPE_OPTIONS: { key: string; label: string }[] = [
  { key: 'S/4HANA', label: 'SAP S/4HANA' },
  { key: 'Dassian', label: 'Dassian A&D' },
  { key: 'Twenty5 IPE', label: 'Twenty5 IPE' },
  { key: 'Ariba', label: 'SAP Ariba' },
  { key: 'Fieldglass', label: 'SAP Fieldglass' },
  { key: 'SAP Analytics Cloud', label: 'SAP Analytics Cloud (SAC)' },
  { key: 'SAP BTP', label: 'SAP BTP' },
  { key: 'SuccessFactors', label: 'SAP SuccessFactors' },
  { key: 'Concur', label: 'SAP Concur' },
  { key: 'Tesseract PPM', label: 'Tesseract PPM' },
  { key: 'Contract Studio', label: 'Mach12 Contract Studio' },
  { key: 'Solution Studio', label: 'Mach12 Solution Studio' },
]

// Enumerated workshop lengths. Selectable (never free text), per Josh's rule.
export const DURATION_OPTIONS: { minutes: number; label: string }[] = [
  { minutes: 60, label: '1 hour' },
  { minutes: 90, label: '1.5 hours' },
  { minutes: 120, label: '2 hours' },
  { minutes: 180, label: '3 hours' },
  { minutes: 240, label: 'Half day (4h)' },
  { minutes: 480, label: 'Full day (8h)' },
]
export const DEFAULT_DURATION_MINUTES = 120

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
  // 056: decision (default) or assessment.
  archetype?: WorkshopArchetype | null
  focus_areas: WorkshopFocus[]
  workstream_codes: string[]
  // 055: the workstream(s) this workshop is anchored on. Non-primary
  // ("integrated") workstreams frame their prep input through this lens.
  primary_workstream_codes?: string[] | null
  // 057: the tools / technology in scope for the session (training especially).
  systems_in_scope?: string[] | null
  duration_minutes: number | null
  scheduled_at: string | null
  started_at: string | null
  ended_at: string | null
  brief: WorkshopBriefData | null
  recap: unknown | null
  // 047: persisted workshop-level guidance prompt, threaded as `guidance` into
  // every content generation (brief + every section).
  facilitation_prompt?: string | null
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

// Facilitation-content classification (migration 046; 056 adds the
// assessment-archetype kinds; 057 adds the training-archetype kinds).
export type SectionKind =
  | 'overview' | 'workstream' | 'evaluation' | 'assessment' | 'roadmap'
  | 'training' | 'curriculum' | 'certification'

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

// 055: facilitator-uploaded reference documents; text extracted server-side and
// threaded as context into the brief and every section generate.
export interface WorkshopAttachment {
  id: string
  workshop_id: string
  file_name: string
  format: string | null
  pages: number | null
  size_bytes: number | null
  extracted_text: string | null
  chars: number
  status: 'extracted' | 'no_text' | 'failed'
  note: string | null
  created_by: string | null
  created_at: string
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
