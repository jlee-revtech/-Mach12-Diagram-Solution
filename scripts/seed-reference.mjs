// ─────────────────────────────────────────────────────────────
// Mach12 A&D Process Reference — catalog source of truth + generator.
//
// This curated catalog is modeled on SAP value-chain structure
// (Scenario → Process Group → Process) but tailored to Aerospace &
// Defense / Government Contracting. It is the authoritative source for
// the shared reference library. Running this script regenerates
// supabase/027_process_reference_seed.sql with DETERMINISTIC UUIDs
// (uuidv5 over the node path), so re-running is idempotent.
//
//   node scripts/seed-reference.mjs
//
// Then apply 027 like any other migration.
// ─────────────────────────────────────────────────────────────
import { v5 as uuidv5 } from 'uuid'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const NS = '6f5a1c00-1b2c-4d3e-9f80-mach12reflib'.replace(/[^0-9a-f-]/g, '0') // stable namespace
const LIB = { code: 'mach12-ad-core', title: 'Mach12 A&D Core Process Reference', version: '1.0.0', source: 'curated' }
const libId = uuidv5(LIB.code, NS)
const id = (path) => uuidv5(path, NS)

// overlay helper
const ctrl = (framework, code, title, notes) => ({ kind: 'compliance', payload: { framework, code, title, notes } })
const kpi = (title, target) => ({ kind: 'kpi', payload: { title, kpiTarget: target } })
const acc = (title, ref) => ({ kind: 'accelerator', payload: { title, acceleratorRef: ref } })

// ─── The catalog ───────────────────────────────────────
const SCENARIOS = [
  {
    name: 'Bid-to-Win (Capture & Proposal)',
    description: 'Pursuit lifecycle from opportunity qualification through proposal submission and award.',
    groups: [
      { name: 'Opportunity Qualification', processes: [
        { name: 'Qualify Opportunity', description: 'Gate review of fit, PWin, and bid/no-bid.' },
        { name: 'Capture Planning', description: 'Develop capture strategy, teaming, and call plans.' },
        { name: 'Competitive Assessment', description: 'Black-hat and price-to-win analysis.' },
      ]},
      { name: 'Solutioning', processes: [
        { name: 'Develop Technical Solution', description: 'Architect the technical approach and WBS.' },
        { name: 'Generate Basis of Estimate', description: 'Build BOEs traceable to the SOW/WBS.', overlays: [ctrl('DCAA', 'BOE', 'Adequate BOE support', 'BOEs must be traceable and estimating-system compliant.')] },
        { name: 'Make-or-Buy Analysis', description: 'Determine in-house vs subcontract scope.' },
      ]},
      { name: 'Pricing & Rates', processes: [
        { name: 'Develop Forward Pricing Rates', description: 'Build forward pricing rate proposal (FPRP).', scope: 'FPRP', overlays: [ctrl('CAS', '401/402', 'Consistency in estimating & accumulating', 'Rates estimated consistently with how costs are accumulated.'), acc('RevTech Rate Engine', 'revtech-rates')] },
        { name: 'Price the Proposal', description: 'Roll up cost volume with fee and escalation.' },
        { name: 'Price Risk & Management Reserve', description: 'Quantify risk dollars and MR.' },
      ]},
      { name: 'Proposal Management', processes: [
        { name: 'Manage Color Team Reviews', description: 'Pink/Red/Gold team review cycle.' },
        { name: 'Assemble & Submit Proposal', description: 'Compliance matrix, volumes, and submission.' },
        { name: 'Conduct Fact-Finding / Negotiation', description: 'Support DCAA/DCMA fact-finding and negotiate.' },
      ]},
    ],
  },
  {
    name: 'Contract-to-Closeout (Acquisition Mgmt)',
    description: 'Award setup through funding, mods, CDRLs, and closeout.',
    groups: [
      { name: 'Award Setup', processes: [
        { name: 'Set Up Contract Master', description: 'Create contract, CLIN/SLIN structure, and billing terms.' },
        { name: 'Establish Project & WBS', description: 'Stand up the project, WBS, and control accounts.' },
        { name: 'Baseline the Contract', description: 'Integrated baseline review (IBR) and PMB lock.', overlays: [ctrl('EVMS', 'IBR', 'Integrated Baseline Review', 'Establish a realistic, resource-loaded PMB.')] },
      ]},
      { name: 'Funding & Mods', processes: [
        { name: 'Manage Funding (ACRN)', description: 'Allocate and track funding by ACRN/LOA.', overlays: [ctrl('FAR', '52.232-22', 'Limitation of Funds', 'Track funding vs cost; notify at thresholds.')] },
        { name: 'Process Contract Modification', description: 'Incorporate mods and re-baseline scope/funding.' },
        { name: 'Manage Undefinitized Actions (UCA)', description: 'Track UCAs to definitization.' },
      ]},
      { name: 'Deliverables (CDRL)', processes: [
        { name: 'Manage CDRL Schedule', description: 'Track CDRL/DID due dates and submissions.' },
        { name: 'Submit & Track DD250', description: 'Material inspection & acceptance via DD250/WAWF.', scope: 'DD250' },
      ]},
      { name: 'Closeout', processes: [
        { name: 'Reconcile & De-obligate', description: 'Final reconciliation and excess funds de-obligation.' },
        { name: 'Execute Contract Closeout', description: 'Final invoice, releases, and records retention.' },
      ]},
    ],
  },
  {
    name: 'Plan-to-Produce (Program Execution)',
    description: 'Production planning through shop-floor execution and delivery.',
    groups: [
      { name: 'Schedule (IMS/IMP)', processes: [
        { name: 'Develop Integrated Master Schedule', description: 'Build and resource-load the IMS.', overlays: [ctrl('EVMS', 'GASP', 'Schedule integrity', 'IMS vertically/horizontally traceable to the IMP.')] },
        { name: 'Perform Schedule Risk Analysis', description: 'Monte Carlo SRA on the critical path.' },
      ]},
      { name: 'Production Planning', processes: [
        { name: 'Release Production Order', description: 'Convert planned orders and release to the floor.' },
        { name: 'Plan Material Requirements', description: 'MRP run and long-lead procurement triggers.' },
      ]},
      { name: 'Shop Floor', processes: [
        { name: 'Confirm Operation', description: 'Record labor and operation confirmations.' },
        { name: 'Perform In-Process Inspection', description: 'Quality inspection and nonconformance handling.' },
        { name: 'Complete & Stock Order', description: 'Goods receipt finished goods to inventory.' },
      ]},
      { name: 'Earned Value', processes: [
        { name: 'Take Earned Value', description: 'Claim BCWP via the earned-value technique.', overlays: [ctrl('EVMS', 'EIA-748', 'Earned value management', 'Objective EV methods; no front-loading.'), kpi('CPI', '>= 0.95')] },
      ]},
    ],
  },
  {
    name: 'Source-to-Pay (Procurement & Subcontracts)',
    description: 'Supplier management, subcontracting with flowdowns, and P2P.',
    groups: [
      { name: 'Supplier Management', processes: [
        { name: 'Qualify Supplier', description: 'Supplier vetting, SAM.gov, and approvals.' },
        { name: 'Assess Supplier Risk', description: 'Counterfeit, cyber (CMMC), and financial risk.', overlays: [ctrl('CMMC', 'L2', 'Supplier cyber maturity', 'Flow CMMC requirements to applicable suppliers.')] },
      ]},
      { name: 'Subcontracts', processes: [
        { name: 'Issue Subcontract w/ Flowdowns', description: 'Award subcontract with mandatory FAR/DFARS flowdowns.', overlays: [ctrl('FAR', '52.244-2', 'Subcontracts / consent', 'Obtain consent and flow down required clauses.'), ctrl('DFARS', '252.244-7001', 'CPSR-compliant purchasing', 'Purchasing system adequacy for CPSR.')] },
        { name: 'Administer Subcontract', description: 'Manage mods, performance, and subcontractor EVM.' },
      ]},
      { name: 'Procure-to-Pay', processes: [
        { name: 'Create Purchase Requisition', description: 'Requisition with WBS/cost-object assignment.' },
        { name: 'Issue Purchase Order', description: 'Convert PR to PO with terms and clauses.' },
        { name: 'Perform 3-Way Match', description: 'Match PO, goods receipt, and invoice.' },
        { name: 'Process Supplier Payment', description: 'Approve and pay supplier invoices.' },
      ]},
    ],
  },
  {
    name: 'Design-to-Release (Engineering / PLM)',
    description: 'Requirements through design, configuration management, and BOM release.',
    groups: [
      { name: 'Requirements', processes: [
        { name: 'Manage Requirements', description: 'Decompose and trace requirements to verification.' },
        { name: 'Conduct Design Reviews', description: 'SRR/PDR/CDR gate reviews.' },
      ]},
      { name: 'Design & Config', processes: [
        { name: 'Develop Design / Model', description: 'CAD/model-based design in PLM.' },
        { name: 'Manage Configuration Items', description: 'CM baselines and configuration control.' },
        { name: 'Process Engineering Change', description: 'ECR/ECN through the change board.', scope: 'ECN' },
      ]},
      { name: 'Release', processes: [
        { name: 'Release BOM to ERP', description: 'Transfer engineering BOM to manufacturing BOM.' },
        { name: 'Manage First Article Inspection', description: 'FAI per AS9102 before production release.', overlays: [ctrl('Other', 'AS9102', 'First Article Inspection', 'Complete FAI for new/changed parts.')] },
      ]},
    ],
  },
  {
    name: 'Acquire-to-Retire (Asset / Property / GFP)',
    description: 'Government and contractor property accountability through disposition.',
    groups: [
      { name: 'Property Management', processes: [
        { name: 'Account for Government Furnished Property', description: 'Receive, record, and report GFP/GFE.', overlays: [ctrl('FAR', '52.245-1', 'Government property', 'Maintain a compliant property management system.')] },
        { name: 'Manage Contractor-Acquired Property', description: 'CAP records and accountability.' },
      ]},
      { name: 'Asset Accounting', processes: [
        { name: 'Capitalize Asset', description: 'Acquire and capitalize fixed assets.' },
        { name: 'Run Depreciation', description: 'Periodic depreciation posting.' },
      ]},
      { name: 'Disposition', processes: [
        { name: 'Perform Physical Inventory', description: 'Property inventory and reconciliation.' },
        { name: 'Dispose / Return Property', description: 'Plant clearance and disposition (SF1428).' },
      ]},
    ],
  },
  {
    name: 'Sustainment / MRO',
    description: 'Depot and field maintenance, repair, and overhaul.',
    groups: [
      { name: 'Induction', processes: [
        { name: 'Induct Asset for Repair', description: 'Receive and induct asset; create MRO order.' },
        { name: 'Assess & Disposition', description: 'Inspect, scope work, and disposition.' },
      ]},
      { name: 'Repair Execution', processes: [
        { name: 'Execute Repair Work', description: 'Perform repair operations and parts replacement.' },
        { name: 'Perform Functional Test', description: 'Test and certify airworthiness/serviceability.' },
      ]},
      { name: 'Return', processes: [
        { name: 'Close MRO Work Order', description: 'Settle costs and close the work order.' },
        { name: 'Return Asset to Service', description: 'Ship and update the installed base.' },
      ]},
    ],
  },
  {
    name: 'Record-to-Report (Finance / EVMS / DCAA)',
    description: 'Project accounting, EVMS reporting, billing, and DCAA submissions.',
    groups: [
      { name: 'GL & Close', processes: [
        { name: 'Run Period-End Close', description: 'Accruals, allocations, and ledger close.' },
        { name: 'Apply Indirect Rates', description: 'Apply provisional billing/forward rates to projects.', overlays: [ctrl('CAS', '418', 'Allocation of indirect costs', 'Allocate indirects on a causal/beneficial basis.')] },
      ]},
      { name: 'Project Accounting & EVMS', processes: [
        { name: 'Generate EVMS Report (CPR/IPMR)', description: 'Produce the IPMR/CPR formats 1-5.', scope: 'IPMR', overlays: [ctrl('EVMS', 'EIA-748', 'EVMS reporting', 'Variance analysis with corrective actions.'), kpi('SPI', '>= 0.95')] },
        { name: 'Develop Estimate at Completion', description: 'Bottoms-up and statistical EAC.' },
      ]},
      { name: 'Billing & Compliance', processes: [
        { name: 'Generate Project Billing', description: 'Cost-plus / progress / milestone billing.' },
        { name: 'Run Incurred Cost Submission', description: 'Annual ICS (ICE model) to DCAA.', overlays: [ctrl('FAR', '52.216-7', 'Allowable cost & payment', 'Submit adequate incurred cost proposal within 6 months of FY end.'), acc('RevTech ICS Accelerator', 'revtech-ics')] },
      ]},
    ],
  },
  {
    name: 'Hire-to-Retire (Workforce / Clearances)',
    description: 'Talent acquisition, clearances, compliant timekeeping, and offboarding.',
    groups: [
      { name: 'Talent & Clearances', processes: [
        { name: 'Recruit & Onboard', description: 'Requisition through onboarding.' },
        { name: 'Manage Security Clearance', description: 'Initiate and track clearances (e-QIP/DISS).', overlays: [ctrl('ITAR', '120-130', 'Export-controlled access', 'Restrict access by clearance and citizenship.')] },
      ]},
      { name: 'Time & Labor', processes: [
        { name: 'Record Compliant Timekeeping', description: 'Daily, total-time-accounting timekeeping.', overlays: [ctrl('DCAA', 'TTA', 'Timekeeping integrity', 'Daily, contemporaneous, total-time accounting with supervisor approval.')] },
        { name: 'Process Labor Distribution', description: 'Distribute labor to projects and indirects.' },
      ]},
      { name: 'Offboarding', processes: [
        { name: 'Manage Separation', description: 'Offboarding and access revocation.' },
        { name: 'Debrief Clearance', description: 'Clearance debrief and property return.' },
      ]},
    ],
  },
]

// ─── Emit SQL ──────────────────────────────────────────
const q = (s) => (s == null ? 'null' : `'${String(s).replace(/'/g, "''")}'`)
const jsonb = (obj) => `'${JSON.stringify(obj).replace(/'/g, "''")}'::jsonb`

const lines = []
lines.push('-- AUTO-GENERATED by scripts/seed-reference.mjs — do not edit by hand.')
lines.push('-- Re-run the generator to regenerate. Idempotent (deterministic UUIDs).')
lines.push('begin;')
lines.push(`delete from process_reference_libraries where code = ${q(LIB.code)};`)
lines.push(`insert into process_reference_libraries (id, code, title, version, source, is_active) values (${q(libId)}, ${q(LIB.code)}, ${q(LIB.title)}, ${q(LIB.version)}, ${q(LIB.source)}, true);`)

const scenarioRows = []
const overlayRows = []

SCENARIOS.forEach((s1, i1) => {
  const p1 = `${LIB.code}/${s1.name}`
  const id1 = id(p1)
  scenarioRows.push({ id: id1, parent: null, level: 1, kind: 'scenario', name: s1.name, desc: s1.description, scope: s1.scope, sort: i1 })
  ;(s1.groups || []).forEach((s2, i2) => {
    const p2 = `${p1}/${s2.name}`
    const id2 = id(p2)
    scenarioRows.push({ id: id2, parent: id1, level: 2, kind: 'process_group', name: s2.name, desc: s2.description, scope: s2.scope, sort: i2 })
    ;(s2.processes || []).forEach((s3, i3) => {
      const p3 = `${p2}/${s3.name}`
      const id3 = id(p3)
      scenarioRows.push({ id: id3, parent: id2, level: 3, kind: 'process', name: s3.name, desc: s3.description, scope: s3.scope, sort: i3 })
      ;(s3.overlays || []).forEach((o, io) => {
        overlayRows.push({ id: id(`${p3}/overlay/${io}`), scenario: id3, kind: o.kind, payload: o.payload, sort: io })
      })
    })
  })
})

for (const r of scenarioRows) {
  lines.push(
    `insert into process_reference_scenarios (id, library_id, parent_id, level, node_kind, name, description, scope_item_ref, sort_order) values (` +
    `${q(r.id)}, ${q(libId)}, ${r.parent ? q(r.parent) : 'null'}, ${r.level}, ${q(r.kind)}, ${q(r.name)}, ${q(r.desc)}, ${q(r.scope)}, ${r.sort});`
  )
}
for (const o of overlayRows) {
  lines.push(
    `insert into process_reference_overlays (id, reference_scenario_id, overlay_kind, payload, sort_order) values (` +
    `${q(o.id)}, ${q(o.scenario)}, ${q(o.kind)}, ${jsonb(o.payload)}, ${o.sort});`
  )
}
lines.push('commit;')

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'supabase', '027_process_reference_seed.sql')
writeFileSync(out, lines.join('\n') + '\n', 'utf8')
console.log(`Wrote ${out}`)
console.log(`Library ${LIB.code} v${LIB.version}: ${scenarioRows.length} scenario rows, ${overlayRows.length} overlays`)
