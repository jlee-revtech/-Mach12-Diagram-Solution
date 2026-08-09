// ─── SAP security-role design (Z*/Y* PFCG roles on process_roles) ─
// Shared shapes for the security data layer, the agent tools, and the UI.

export type SecurityRoleType = 'single' | 'derived' | 'composite'

export type RoleAccessType = 'fiori_tile' | 'transaction' | 'program' | 'table' | 'auth_object'

export interface RoleAccessItem {
  id: string
  organization_id: string
  role_id: string
  access_type: RoleAccessType
  value: string
  title?: string | null
  fiori_app_id?: string | null
  source: 'manual' | 'ai'
  note?: string | null
  created_at: string
}

export interface RoleMemberLink {
  id: string
  composite_role_id: string
  member_role_id: string
  created_at: string
}

// Footprint + proposal shapes for auto-determination:
export interface PersonaFootprintItem {
  tcode?: string
  fioriTileId?: string
  fioriAppId?: string
  fioriTitle?: string
  module?: string
  stepLabel: string
  processTitle: string
}

export interface PersonaRoleProposal {
  personaId: string
  personaName: string
  roleId: string
  roleName: string
  sapRoleName?: string | null
  coverage: number
  matched: PersonaFootprintItem[]
  rationale: string
  alreadyLinked: boolean
}

export interface AccessGap {
  personaId: string
  personaName: string
  item: PersonaFootprintItem
}

export interface RoleAccessSuggestion {
  roleId: string
  roleName: string
  item: PersonaFootprintItem
}

export interface AutoDetermineResult {
  proposals: PersonaRoleProposal[]
  gaps: AccessGap[]
  roleAccessSuggestions: RoleAccessSuggestion[]
  personasScanned: number
  processesScanned: number
}

// ─── Security Design Studio + Explore & Govern (060) ───
// Shapes for the design-advisory sessions, the read-only exploration engine,
// the governance plan, and the harmonization of external roles against the SAP
// roles/personas already governed here.

export type DesignApproach = 'standard' | 'configuration' | 'enhancement' | 'third_party' | 'process_control'
export type OptionDecision = 'open' | 'selected' | 'rejected'
export type GovernedKind = 'cots' | 'custom'
export type GovernedStatus = 'registered' | 'explored' | 'planned' | 'approved' | 'governed'
export type PlanStatus = 'draft' | 'review' | 'approved' | 'built' | 'rejected'
export type MapDisposition = 'map' | 'create' | 'retire' | 'review'
export type RiskSeverity = 'low' | 'medium' | 'high' | 'critical'

export interface DesignSession { id: string; organization_id: string; title: string; scope?: string | null; workstream_id?: string | null; status: 'active'|'decided'|'archived'; created_at: string; updated_at: string }
export interface DesignGuidance { id: string; session_id: string; topic: string; body: string; citations: { sourceCode?: string; sourceTitle?: string }[]; sort_order: number; created_at: string }
export interface DesignOption { id: string; session_id: string; name: string; summary?: string | null; approach: DesignApproach; pros: string[]; cons: string[]; effort?: string | null; risk?: string | null; recommended: boolean; decision: OptionDecision; decision_rationale?: string | null; sort_order: number }

export interface DiscoveredRole { name: string; description?: string; permissions?: string[]; source: 'url' | 'source' | 'declared' }
export interface ExploreRisk { id: string; severity: RiskSeverity; title: string; detail: string; evidence?: string }
export interface ExplorationFindings {
  authModel: { mechanism?: string; idp?: string; mfa?: boolean | null; notes: string[] }
  discoveredRoles: DiscoveredRole[]
  permissions: string[]
  surfaces: { label: string; url?: string; kind?: 'admin' | 'app' | 'api' | 'login'; notes?: string }[]
  posture: { securityHeaders: Record<string, string | null>; cookieFlags: string[]; framework?: string; authLibraries: string[] }
  risks: ExploreRisk[]
  evidence: { kind: 'url' | 'file'; ref: string; note?: string }[]
  unreachable: string[]
  scanned: { urls: number; files: number }
}
export interface GovernancePlanDoc {
  objective: string
  identity: { target: string; steps: string[] }
  roleModel: { name: string; purpose: string; permissions: string[]; mapsToSapRole?: string }[]
  controls: { id: string; title: string; detail: string; standard?: string }[]
  sod: { pair: string; detail: string; mitigation: string }[]
  remediation: { id: string; title: string; detail: string; severity: RiskSeverity; effort?: string }[]
  buildPlan: { artifact: string; kind: 'policy'|'config'|'code'|'mapping'|'runbook'|'doc'; targetPath?: string; purpose: string }[]
  openQuestions: string[]
}
export interface RoleHarmonization { externalRole: string; roleId?: string | null; roleName?: string | null; personaId?: string | null; personaName?: string | null; disposition: MapDisposition; confidence: number; rationale: string }

// ─── Row shapes for the 060 tables (browser CRUD) ──────

export interface GovernedSystem {
  id: string
  organization_id: string
  name: string
  kind: GovernedKind
  vendor?: string | null
  base_url?: string | null
  source_path?: string | null
  description?: string | null
  criticality?: 'low' | 'medium' | 'high' | null
  status: GovernedStatus
  created_at: string
  updated_at: string
}

export interface GovernanceExploration {
  id: string
  organization_id: string
  system_id: string
  status: 'running' | 'complete' | 'failed'
  findings: ExplorationFindings | Record<string, never>
  summary?: string | null
  created_at: string
}

export interface GovernancePlan {
  id: string
  organization_id: string
  system_id: string
  exploration_id?: string | null
  status: PlanStatus
  plan: GovernancePlanDoc | Record<string, never>
  approved_at?: string | null
  built_at?: string | null
  created_at: string
  updated_at: string
}

export interface GovernanceRoleMapEntry {
  id: string
  organization_id: string
  plan_id: string
  external_role: string
  role_id?: string | null
  persona_id?: string | null
  disposition: MapDisposition
  confidence?: number | null
  rationale?: string | null
  created_at: string
}

export interface GovernanceArtifact {
  id: string
  organization_id: string
  plan_id: string
  name: string
  kind: 'policy' | 'config' | 'code' | 'mapping' | 'runbook' | 'doc'
  target_path?: string | null
  language?: string | null
  content: string
  created_at: string
}
