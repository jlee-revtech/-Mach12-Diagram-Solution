// ─── Canonical workstream catalog ──────────────────────
// The canonical taxonomy is the SAP Solution Studio config roster: 10 A&D value
// streams + 3 cross-cutting "platform" agents (security, analytics, dev). This
// is the shared spine between Solution Architecture Studio (this app) and SAP
// Solution Studio (cds-lineage), so the codes here MUST match Solution Studio's
// agentConfigurator registry codes.
//
// This catalog is the seed source for each org's `workstreams` rows AND the
// bridge to the shared knowledge repository: `knowledgeSourceCodes` maps a
// workstream to the vibe-skill bundles that power its consultant agent (mirrors
// Solution Studio's AGENT_SKILLS), and sap/dassianModules describe expertise.
//
// Codes here are stable slugs — do not rename without a data migration. The only
// folded legacy codes are bid-to-win + contract-to-closeout, which roll up into
// offer-to-cash; see LEGACY_TO_CANONICAL.

export interface StandardWorkstreamDef {
  code: string
  name: string
  description: string
  color: string
  icon: WorkstreamIconKey
  sortOrder: number
  sapModules: string[]
  dassianModules: string[]
  knowledgeSourceCodes: string[]
  agentTagline: string
  // Cross-cutting platform agent (security / analytics / dev) rather than an
  // end-to-end business value stream.
  isPlatform?: boolean
  // Legacy SAS workstream codes that fold into this canonical stream.
  legacyCodes?: string[]
}

export type WorkstreamIconKey =
  | 'target'
  | 'contract'
  | 'factory'
  | 'cart'
  | 'drafting'
  | 'asset'
  | 'wrench'
  | 'portfolio'
  | 'ledger'
  | 'people'
  | 'truck'
  | 'shield'
  | 'chart'
  | 'code'

export const STANDARD_WORKSTREAMS: StandardWorkstreamDef[] = [
  {
    code: 'record-to-report',
    name: 'Record-to-Report (Finance / DCAA)',
    description: 'End-to-end financial accounting and reporting: GL, assets, cost, indirect rates, settlement, revenue recognition, and close.',
    color: '#EAB308',
    icon: 'ledger',
    sortOrder: 1,
    sapModules: ['FI-GL', 'FI-AA', 'CO-CCA', 'CO-PA', 'CO-PC', 'PS settlement', 'Group Reporting'],
    dassianModules: ['Cost Management (OH, costing sheets, FR)', 'Results Analysis (RAENH rev-rec)'],
    knowledgeSourceCodes: ['sap-ad-commercial-defense-structure', 'dassian-results-analysis', 'dassian-cost-management', 'sap-cats-time-recording', 'vibe-sap-recipes', 'sap-rap-development', 'govcon-cas-in-sap', 'govcon-dcaa-audit-readiness', 'govcon-dfars-business-systems'],
    agentTagline: 'GL, costing, rates, and rev-rec consultant',
  },
  {
    code: 'plan-to-perform',
    name: 'Plan-to-Perform (Program & Portfolio Management)',
    description: 'EVMS-grade program and portfolio management: baseline, control accounts, work authorization, EAC/ETC, risk, and variance reporting.',
    color: '#6366F1',
    icon: 'portfolio',
    sortOrder: 2,
    sapModules: ['PS', 'PPM', 'CO', 'Group Reporting'],
    dassianModules: ['Project Mgmt (PPC, EVM, CAM, EAC/ETC, IPMR/533)'],
    knowledgeSourceCodes: ['dassian-project-management', 'sap-ad-commercial-defense-structure', 'vibe-sap-recipes', 'sap-rap-development', 'govcon-dfars-business-systems', 'govcon-pricing-tina'],
    agentTagline: 'EVMS, PMB, and EAC/ETC program-control consultant',
  },
  {
    code: 'design-to-release',
    name: 'Design-to-Release (Engineering / PLM)',
    description: 'Requirements through design, configuration management, engineering change, and BOM release with first article inspection.',
    color: '#8B5CF6',
    icon: 'drafting',
    sortOrder: 3,
    sapModules: ['PLM', 'PP-BOM', 'ECM (engineering change)', 'QM (FAI)'],
    dassianModules: [],
    knowledgeSourceCodes: ['sap-plm-design-to-release-ad', 'vibe-sap-recipes', 'sap-rap-development'],
    agentTagline: 'Requirements, CM, and BOM-release consultant',
  },
  {
    code: 'plan-to-produce',
    name: 'Plan-to-Produce (Program Execution)',
    description: 'Production planning, MRP, shop-floor execution, quality inspection, and production-order settlement.',
    color: '#10B981',
    icon: 'factory',
    sortOrder: 4,
    sapModules: ['PP', 'PP-MRP', 'PP-CRP (capacity)', 'PP/DS', 'QM', 'LO-VC', 'PS', 'MM-IM'],
    dassianModules: ['Project Mgmt (EVM)', 'MPIA / BOM cost'],
    knowledgeSourceCodes: ['sap-pp-capacity-planning', 'sap-ad-commercial-defense-structure', 'sap-data-load-so-to-ps', 'vibe-sap-recipes', 'sap-rap-development', 'govcon-mmas', 'govcon-dfars-business-systems'],
    agentTagline: 'MRP, shop-floor, quality, and production consultant',
  },
  {
    code: 'inventory-to-deliver',
    name: 'Inventory-to-Deliver (Logistics & Delivery)',
    description: 'Materials management, warehousing/EWM, inventory, and outbound delivery with DD250 acceptance.',
    color: '#14B8A6',
    icon: 'truck',
    sortOrder: 5,
    sapModules: ['MM-IM', 'WM / EWM', 'LE (deliveries)', 'Handling Units', 'Batch / Serial', 'Physical Inventory'],
    dassianModules: ['DD250 / ABS'],
    knowledgeSourceCodes: ['sap-ad-commercial-defense-structure', 'sap-data-load-so-to-ps', 'vibe-sap-recipes', 'sap-rap-development', 'govcon-mmas', 'govcon-dfars-business-systems'],
    agentTagline: 'Logistics, warehousing, and delivery consultant',
  },
  {
    code: 'acquire-to-retire',
    name: 'Acquire-to-Retire (Asset / Property / GFP)',
    description: 'Government and contractor property accountability and fixed-asset lifecycle from acquisition through disposition.',
    color: '#EC4899',
    icon: 'asset',
    sortOrder: 6,
    sapModules: ['FI-AA', 'MM-IM', 'PS'],
    dassianModules: ['GFP / property accountability'],
    knowledgeSourceCodes: ['sap-government-property-a2r', 'vibe-sap-recipes', 'sap-rap-development', 'govcon-dfars-business-systems'],
    agentTagline: 'GFP/CAP property and fixed-asset consultant',
  },
  {
    code: 'sustainment-mro',
    name: 'Sustainment / MRO',
    description: 'Depot and field maintenance, repair, and overhaul with installed-base and warranty management.',
    color: '#F43F5E',
    icon: 'wrench',
    sortOrder: 7,
    sapModules: ['PM / EAM', 'CS', 'PP (refurb)', 'MM'],
    dassianModules: [],
    knowledgeSourceCodes: ['sap-ad-depot-mro', 'vibe-sap-recipes', 'sap-rap-development'],
    agentTagline: 'Depot/field MRO and installed-base consultant',
  },
  {
    code: 'source-to-pay',
    name: 'Source-to-Pay (Procurement & Subcontracts)',
    description: 'Supplier management, sourcing, subcontracting with FAR/DFARS flowdowns, and procure-to-pay.',
    color: '#F59E0B',
    icon: 'cart',
    sortOrder: 8,
    sapModules: ['MM', 'MM-PUR', 'MDG-S', 'Subcontracting', 'MM-IV', 'Ariba', 'FI-AP'],
    dassianModules: ['SCFM', 'Contracts (flowdowns, clause library)', 'PBP'],
    knowledgeSourceCodes: ['dassian-contracts', 'sap-ad-commercial-defense-structure', 'vibe-sap-recipes', 'sap-rap-development', 'govcon-dfars-business-systems', 'govcon-pricing-tina'],
    agentTagline: 'Subcontracts, flowdowns, and P2P consultant',
  },
  {
    code: 'offer-to-cash',
    name: 'Offer-to-Cash (Capture, Contracts, Billing & Rev-Rec)',
    description: 'Sell-side lifecycle from capture and proposal through contract setup, CLIN/SLIN billing, deliveries acceptance, and revenue recognition.',
    color: '#2563EB',
    icon: 'contract',
    sortOrder: 9,
    sapModules: ['SD', 'SD-BIL', 'RAR', 'DP90', 'PS'],
    dassianModules: ['Contracts (CLIN/SLIN/ACRN, mods, DD250)', 'PBP', 'Billing (BIL / DRB)', 'ABS', 'Results Analysis (RAENH)'],
    knowledgeSourceCodes: ['dassian-contracts', 'dassian-cost-management', 'sap-ad-commercial-defense-structure', 'vibe-sap-recipes', 'sap-rap-development', 'govcon-pricing-tina', 'govcon-cas-in-sap', 'govcon-dfars-business-systems'],
    agentTagline: 'Capture, contracts, billing, and rev-rec consultant',
    legacyCodes: ['bid-to-win', 'contract-to-closeout'],
  },
  {
    code: 'hire-to-retire',
    name: 'Hire-to-Retire (Workforce / Clearances)',
    description: 'Workforce lifecycle: talent and clearances, records, compliant timekeeping, payroll, labor distribution, and offboarding.',
    color: '#F97316',
    icon: 'people',
    sortOrder: 10,
    sapModules: ['HCM / SF', 'PT (time)', 'PY (payroll)', 'CATS'],
    dassianModules: ['Labor / role-based costing', 'CATS approval'],
    knowledgeSourceCodes: ['govcon-timekeeping-compliance', 'sap-cats-time-recording', 'vibe-sap-recipes', 'sap-rap-development', 'govcon-dcaa-audit-readiness'],
    agentTagline: 'Clearances, compliant timekeeping, and payroll consultant',
  },
  // ─── Cross-cutting platform agents (serve every value stream) ─
  {
    code: 'security-authorization',
    name: 'Security & Authorization',
    description: 'Cross-stream role design, authorizations, segregation-of-duties, and access governance.',
    color: '#64748B',
    icon: 'shield',
    sortOrder: 11,
    sapModules: ['GRC', 'PFCG', 'SU24', 'IAG / IAM'],
    dassianModules: [],
    knowledgeSourceCodes: ['sap-ad-security-itar', 'sap-ad-commercial-defense-structure', 'vibe-sap-recipes', 'sap-rap-development', 'govcon-dfars-business-systems'],
    agentTagline: 'Roles, authorizations, and SoD consultant',
    isPlatform: true,
  },
  {
    code: 'analytics-reporting',
    name: 'Analytics & Reporting',
    description: 'Cross-stream embedded analytics, operational and management reporting, and planning.',
    color: '#06B6D4',
    icon: 'chart',
    sortOrder: 12,
    sapModules: ['Embedded Analytics', 'CDS analytical', 'SAC', 'Datasphere'],
    dassianModules: ['GPD / PACE reporting'],
    knowledgeSourceCodes: ['sap-ad-program-analytics', 'vibe-sap-recipes', 'sap-rap-development', 'govcon-dcaa-audit-readiness', 'govcon-dfars-business-systems'],
    agentTagline: 'Embedded analytics and reporting consultant',
    isPlatform: true,
  },
  {
    code: 'development-technology',
    name: 'Development & Technology',
    description: 'Cross-stream RICEFW, RAP extensions, CDS modeling, integration, and clean-core engineering.',
    color: '#0EA5E9',
    icon: 'code',
    sortOrder: 13,
    sapModules: ['ABAP / RAP', 'BTP', 'CDS', 'Gateway / OData'],
    dassianModules: [],
    knowledgeSourceCodes: ['sap-rap-development', 'vibe-sap-recipes', 'vibe-update-class-include'],
    agentTagline: 'RICEFW, extensions, and clean-core consultant',
    isPlatform: true,
  },
]

export const WORKSTREAM_BY_CODE: Record<string, StandardWorkstreamDef> = Object.fromEntries(
  STANDARD_WORKSTREAMS.map((w) => [w.code, w])
)

// Crosswalk from legacy SAS workstream codes to their canonical home. Used by the
// data migration and by any runtime that still encounters an old code. Only
// bid-to-win + contract-to-closeout remain folded (into offer-to-cash);
// design-to-release, acquire-to-retire, and sustainment-mro are first-class again.
export const LEGACY_TO_CANONICAL: Record<string, string> = Object.fromEntries(
  STANDARD_WORKSTREAMS.flatMap((w) => (w.legacyCodes ?? []).map((legacy) => [legacy, w.code]))
)

// Resolve any code (legacy or canonical) to its canonical form.
export function canonicalWorkstreamCode(code: string): string {
  return LEGACY_TO_CANONICAL[code] ?? code
}

// The orchestrator agent that routes across and synthesizes the per-workstream
// agents. Lives alongside the workstreams but is not itself a workstream.
export const ENTERPRISE_AGENT_CODE = 'enterprise'
