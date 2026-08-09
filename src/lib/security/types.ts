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
