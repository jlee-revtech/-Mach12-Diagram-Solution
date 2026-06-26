// Types for the SAP Enterprise Data Model snapshot (controlling area A000).
// Mirrors the shape produced by ZCL_M12_ORG_MODEL_DUMP via the SAP-Vibe MCP.

export interface ControllingArea {
  kokrs: string
  name: string
  currency: string
  chart: string
  fiscalVar: string
}

export interface CompanyCode {
  bukrs: string
  name: string
  country: string
  currency: string
  chart: string
  plantCount: number
  profitCenterCount: number
  costCenterCount: number
  wbsRaCount: number
  salesOrgs: string[]
  purchasingOrgs: string[]
}

export interface Plant {
  werks: string
  name: string
  bukrs: string
  storageLocations: string[]
}

export interface SalesOrg {
  vkorg: string
  name: string
  bukrs: string
}

export interface PurchasingOrg {
  ekorg: string
  name: string
  bukrs: string
  plants: string[]
}

export interface BusinessArea {
  gsber: string
  name: string
  used: boolean
}

export interface ProfitCenterSummary {
  byCompanyCode: Record<string, number>
  total: number
  sample: { prctr: string; name: string }[]
}

export interface CostCenterSummary {
  byCompanyCode: Record<string, number>
  total: number
  sample: { kostl: string; name: string; bukrs: string; prctr: string }[]
}

export interface RaKey {
  key: string
  label: string
  count: number
  levels: Record<string, number>
}

export interface RaByCompanyCode {
  bukrs: string
  count: number
  keys: Record<string, number>
  levels: Record<string, number>
}

export interface RaProject {
  project: string
  name: string
  bukrs: string
  wbsCount: number
  keys: string[]
}

export interface AssignmentRow {
  relationship: string
  via: string
  count: number
  note?: string
}

export interface SapEnterpriseModel {
  source: {
    system: string
    client: string
    controllingArea: string
    pulledOn: string
    via: string
  }
  controllingArea: ControllingArea
  companyCodes: CompanyCode[]
  plants: Plant[]
  salesOrgs: SalesOrg[]
  purchasingOrgs: PurchasingOrg[]
  businessAreas: BusinessArea[]
  profitCenters: ProfitCenterSummary
  costCenters: CostCenterSummary
  raKeys: RaKey[]
  raByCompanyCode: RaByCompanyCode[]
  raProjects: RaProject[]
  assignments: AssignmentRow[]
  // Drill-down detail: the actual values behind each aggregate count.
  profitCentersByCompanyCode: Record<string, { prctr: string; name: string }[]>
  costCentersByCompanyCode: Record<string, { kostl: string; name: string; prctr: string }[]>
  wbsRa: { posid: string; name: string; bukrs: string; level: string; raKey: string; project: string }[]
  // Profit center standard hierarchy (set class 0106) rooted at "All profit centers".
  profitCenterHierarchy: DrillTreeNode
}

// ── Diagram model (org-structure entity graph) ──────────────────────────────

export type OrgEntityKind =
  | 'controlling_area'
  | 'company_code'
  | 'plant'
  | 'storage_location'
  | 'sales_org'
  | 'purchasing_org'
  | 'profit_center'
  | 'cost_center'
  | 'business_area'
  | 'wbs_ra'

// Drill-down payload attached to aggregate ("number") nodes.
export interface DrillItem {
  code: string
  label?: string
  meta?: string
}
export interface DrillGroup {
  name: string
  caption?: string
  items: DrillItem[]
}
// A node in a drill-down hierarchy (e.g. the profit center standard hierarchy).
export interface DrillTreeNode {
  code: string
  label?: string
  kind: 'group' | 'leaf'
  meta?: string
  children?: DrillTreeNode[]
}
export interface DrillData {
  kind: OrgEntityKind
  title: string
  subtitle?: string
  count: number
  columns?: string[]
  groups?: DrillGroup[]
  items?: DrillItem[]
  // Hierarchical drill output (takes precedence over groups/items when present).
  tree?: DrillTreeNode[]
}

export interface OrgNodeData {
  kind: OrgEntityKind
  code: string
  title: string
  subtitle?: string
  meta?: string[]
  badge?: string
  drill?: DrillData
  [key: string]: unknown
}
