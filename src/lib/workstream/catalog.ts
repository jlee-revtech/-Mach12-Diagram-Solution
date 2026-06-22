// ─── Canonical workstream catalog ──────────────────────
// The 10 standard A&D value streams that ship in Process Studio's reference
// library (scripts/seed-reference.mjs L1 scenarios). This is the seed source
// for each org's `workstreams` rows AND the bridge to the shared knowledge
// repository: `knowledgeSourceCodes` maps a workstream to the vibe-skill
// bundles that power its consultant agent (mirrors Solution Studio's
// AGENT_SKILLS), and sap/dassianModules describe the agent's expertise.
//
// Codes here are stable slugs — do not rename without a data migration.

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

export const STANDARD_WORKSTREAMS: StandardWorkstreamDef[] = [
  {
    code: 'bid-to-win',
    name: 'Bid-to-Win (Capture & Proposal)',
    description: 'Pursuit lifecycle from opportunity qualification through proposal submission and award.',
    color: '#2563EB',
    icon: 'target',
    sortOrder: 1,
    sapModules: ['SD', 'PS', 'CO-PC (estimating)', 'BTP'],
    dassianModules: ['Contracts (bid/proposal)', 'Cost Management (forward rates)'],
    knowledgeSourceCodes: ['dassian-contracts', 'vibe-sap-recipes'],
    agentTagline: 'Capture, BOE, and price-to-win consultant',
  },
  {
    code: 'contract-to-closeout',
    name: 'Contract-to-Closeout (Acquisition Mgmt)',
    description: 'Award setup through funding, mods, CDRLs, and closeout.',
    color: '#0EA5E9',
    icon: 'contract',
    sortOrder: 2,
    sapModules: ['SD', 'PS', 'FI-CA / billing'],
    dassianModules: ['Contracts (CLIN/SLIN/ACRN, mods, DD250)', 'Billing (BIL)'],
    knowledgeSourceCodes: ['dassian-contracts', 'vibe-sap-recipes'],
    agentTagline: 'Contract structure, funding, and CDRL consultant',
  },
  {
    code: 'plan-to-produce',
    name: 'Plan-to-Produce (Program Execution)',
    description: 'Production planning through shop-floor execution and delivery.',
    color: '#10B981',
    icon: 'factory',
    sortOrder: 3,
    sapModules: ['PP', 'PP-MRP', 'QM', 'PS', 'MM-IM'],
    dassianModules: ['Project Mgmt (EVM / earned value)'],
    knowledgeSourceCodes: ['sap-data-load-so-to-ps', 'vibe-sap-recipes'],
    agentTagline: 'IMS, MRP, shop-floor, and earned-value consultant',
  },
  {
    code: 'source-to-pay',
    name: 'Source-to-Pay (Procurement & Subcontracts)',
    description: 'Supplier management, subcontracting with flowdowns, and P2P.',
    color: '#F59E0B',
    icon: 'cart',
    sortOrder: 4,
    sapModules: ['MM', 'MM-PUR', 'SLP / Ariba', 'FI-AP'],
    dassianModules: ['Contracts (flowdowns, clause library)'],
    knowledgeSourceCodes: ['dassian-contracts', 'vibe-sap-recipes'],
    agentTagline: 'Subcontracts, flowdowns, and P2P consultant',
  },
  {
    code: 'design-to-release',
    name: 'Design-to-Release (Engineering / PLM)',
    description: 'Requirements through design, configuration management, and BOM release.',
    color: '#8B5CF6',
    icon: 'drafting',
    sortOrder: 5,
    sapModules: ['PLM', 'PP-BOM', 'ECM (engineering change)', 'QM (FAI)'],
    dassianModules: [],
    knowledgeSourceCodes: ['vibe-sap-recipes'],
    agentTagline: 'Requirements, CM, and BOM-release consultant',
  },
  {
    code: 'acquire-to-retire',
    name: 'Acquire-to-Retire (Asset / Property / GFP)',
    description: 'Government and contractor property accountability through disposition.',
    color: '#EC4899',
    icon: 'asset',
    sortOrder: 6,
    sapModules: ['FI-AA', 'MM-IM', 'PS'],
    dassianModules: ['GFP / property accountability'],
    knowledgeSourceCodes: ['vibe-sap-recipes'],
    agentTagline: 'GFP/CAP property and fixed-asset consultant',
  },
  {
    code: 'sustainment-mro',
    name: 'Sustainment / MRO',
    description: 'Depot and field maintenance, repair, and overhaul.',
    color: '#14B8A6',
    icon: 'wrench',
    sortOrder: 7,
    sapModules: ['PM / EAM', 'CS', 'PP (refurb)', 'MM'],
    dassianModules: [],
    knowledgeSourceCodes: ['vibe-sap-recipes'],
    agentTagline: 'Depot/field MRO and installed-base consultant',
  },
  {
    code: 'plan-to-perform',
    name: 'Plan-to-Perform (Program & Portfolio Management)',
    description: 'EVMS-grade program and portfolio management: baseline, control accounts, work authorization, EAC/ETC, and variance reporting.',
    color: '#6366F1',
    icon: 'portfolio',
    sortOrder: 8,
    sapModules: ['PS', 'PPM', 'CO', 'BPC / Group Reporting'],
    dassianModules: ['Project Mgmt (PPC, EVM, CAM, EAC/ETC, IPMR/533)'],
    knowledgeSourceCodes: ['dassian-project-management', 'vibe-sap-recipes'],
    agentTagline: 'EVMS, PMB, and EAC/ETC program-control consultant',
  },
  {
    code: 'record-to-report',
    name: 'Record-to-Report (Finance / EVMS / DCAA)',
    description: 'End-to-end financial accounting and reporting: GL, assets, cost, tax, bank, travel, close, and reporting.',
    color: '#EAB308',
    icon: 'ledger',
    sortOrder: 9,
    sapModules: ['FI-GL', 'FI-AA', 'CO-CCA', 'CO-PA', 'CO-PC', 'PS settlement', 'Group Reporting'],
    dassianModules: ['Cost Management (OH, costing sheets, FR)', 'Results Analysis (RAENH rev-rec)'],
    knowledgeSourceCodes: ['dassian-results-analysis', 'dassian-cost-management', 'vibe-sap-recipes'],
    agentTagline: 'GL, costing, rates, and rev-rec consultant',
  },
  {
    code: 'hire-to-retire',
    name: 'Hire-to-Retire (Workforce / Clearances)',
    description: 'Workforce lifecycle: talent and clearances, records, compliant timekeeping, payroll, and offboarding.',
    color: '#F97316',
    icon: 'people',
    sortOrder: 10,
    sapModules: ['HCM / SF', 'PT (time)', 'PY (payroll)', 'CATS'],
    dassianModules: [],
    knowledgeSourceCodes: ['vibe-sap-recipes'],
    agentTagline: 'Clearances, compliant timekeeping, and payroll consultant',
  },
]

export const WORKSTREAM_BY_CODE: Record<string, StandardWorkstreamDef> = Object.fromEntries(
  STANDARD_WORKSTREAMS.map((w) => [w.code, w])
)

// The orchestrator agent that routes across and synthesizes the per-workstream
// agents. Lives alongside the workstreams but is not itself a workstream.
export const ENTERPRISE_AGENT_CODE = 'enterprise'
