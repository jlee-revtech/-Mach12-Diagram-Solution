// ─────────────────────────────────────────────────────────────
// Mach12 A&D Process Reference — catalog source of truth + generator.
//
// Curated, A&D/GovCon-tailored best-practice catalog modeled on SAP
// value-chain structure (Scenario → Process Group → Process → Sub-process).
// The deep Hire-to-Retire, Plan-to-Perform (PPM), and Record-to-Report
// streams are GENERALIZED from real SAP S/4HANA process documentation with
// ALL client-specific identifiers removed (no org names, people, tool
// brands, custom object names, RICEFW numbering, or document links).
//
// Run to regenerate supabase/027_process_reference_seed.sql with
// DETERMINISTIC UUIDs (uuidv5 over the node path) — idempotent re-seed.
//   node scripts/seed-reference.mjs
// ─────────────────────────────────────────────────────────────
import { v5 as uuidv5 } from 'uuid'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const NS = '6f5a1c00-1b2c-4d3e-9f80-mach12reflib'.replace(/[^0-9a-f-]/g, '0')
const LIB = { code: 'mach12-ad-core', title: 'Mach12 A&D Core Process Reference', version: '1.1.0', source: 'curated' }
const libId = uuidv5(LIB.code, NS)
const id = (path) => uuidv5(path, NS)

// overlay helpers
const ctrl = (framework, code, title, notes) => ({ kind: 'compliance', payload: { framework, code, title, notes } })
const kpi = (title, target) => ({ kind: 'kpi', payload: { title, kpiTarget: target } })
const acc = (title, ref) => ({ kind: 'accelerator', payload: { title, acceleratorRef: ref } })

// BPMN graph helper: auto-position steps left-to-right within stacked lanes,
// and auto-chain them with sequence flows (unless explicit edges given).
function flow(laneDefs, steps, explicitEdges) {
  const lanes = laneDefs.map((l, i) => ({ id: l.id, label: l.label, order: i, systemId: null }))
  const laneOrder = Object.fromEntries(lanes.map(l => [l.id, l.order]))
  const nodes = steps.map((s, i) => ({
    id: s.id,
    type: 'processElement',
    position: { x: 90 + i * 185, y: (laneOrder[s.lane] ?? 0) * 150 + 50 },
    data: {
      label: s.label,
      elementType: s.type || 'task',
      laneId: s.lane,
      ...(s.role ? { responsibleRole: s.role } : {}),
      ...(s.tcode ? { tcode: s.tcode } : {}),
      ...(s.fiori ? { fioriApp: s.fiori } : {}),
      ...(s.ricefw ? { ricefwCodes: s.ricefw } : {}),
    },
  }))
  const edges = explicitEdges
    ? explicitEdges.map((e, i) => ({ id: `e${i}`, source: e[0], target: e[1], type: 'sequenceFlow', data: { kind: e[2] || 'sequence', ...(e[3] ? { label: e[3] } : {}) } }))
    : steps.slice(1).map((s, i) => ({ id: `e${i}`, source: steps[i].id, target: s.id, type: 'sequenceFlow', data: { kind: 'sequence' } }))
  return { lanes, nodes, edges }
}

// ─── Flagship leaf graphs (generic roles/T-codes, no client data) ──
const GRAPH_JOURNAL = flow(
  [{ id: 'l1', label: 'Requestor' }, { id: 'l2', label: 'GL Accountant' }, { id: 'l3', label: 'Controller' }],
  [
    { id: 's', type: 'startEvent', label: 'JE needed', lane: 'l1' },
    { id: 'a1', type: 'userTask', label: 'Create JE Request', lane: 'l1', role: 'Requestor' },
    { id: 'a2', type: 'serviceTask', label: 'Park Journal Entry', lane: 'l2', role: 'GL Accountant', tcode: 'FV50' },
    { id: 'g', type: 'exclusiveGateway', label: 'Approved?', lane: 'l3', role: 'Controller' },
    { id: 'a3', type: 'serviceTask', label: 'Post Journal Entry', lane: 'l2', role: 'GL Accountant', tcode: 'FB50', ricefw: ['WF-JE-APPROVAL'] },
    { id: 'e', type: 'endEvent', label: 'Posted', lane: 'l2' },
  ],
  [['s', 'a1'], ['a1', 'a2'], ['a2', 'g'], ['g', 'a3', 'conditional', 'Approved'], ['a3', 'e'], ['g', 'a1', 'conditional', 'Rejected']],
)

const GRAPH_WORKAUTH = flow(
  [{ id: 'l1', label: 'Program Manager' }, { id: 'l2', label: 'Control Account Manager' }, { id: 'l3', label: 'Project Controls' }],
  [
    { id: 's', type: 'startEvent', label: 'Scope ready', lane: 'l1' },
    { id: 'a1', type: 'userTask', label: 'Define Work Scope', lane: 'l1', role: 'Program Manager' },
    { id: 'a2', type: 'userTask', label: 'Issue Work Authorization Document', lane: 'l2', role: 'Control Account Manager' },
    { id: 'a3', type: 'serviceTask', label: 'Confirm Budget & Schedule', lane: 'l3', role: 'Project Controls', tcode: 'CJ30' },
    { id: 'g', type: 'exclusiveGateway', label: 'Authorized?', lane: 'l1', role: 'Program Manager' },
    { id: 'a4', type: 'serviceTask', label: 'Release Work Package', lane: 'l2', role: 'Control Account Manager', tcode: 'CJ20N' },
    { id: 'e', type: 'endEvent', label: 'Work authorized', lane: 'l2' },
  ],
  [['s', 'a1'], ['a1', 'a2'], ['a2', 'a3'], ['a3', 'g'], ['g', 'a4', 'conditional', 'Yes'], ['a4', 'e'], ['g', 'a1', 'conditional', 'No']],
)

const GRAPH_NETPAYROLL = flow(
  [{ id: 'l1', label: 'Payroll Analyst' }, { id: 'l2', label: 'Senior Payroll Analyst' }, { id: 'l3', label: 'Payroll System' }],
  [
    { id: 's', type: 'startEvent', label: 'Pay period close', lane: 'l3' },
    { id: 'a1', type: 'serviceTask', label: 'Load Time & Earnings', lane: 'l3', role: 'Payroll System', ricefw: ['INT-TIME-INBOUND'] },
    { id: 'a2', type: 'serviceTask', label: 'Run Payroll Simulation', lane: 'l1', role: 'Payroll Analyst', tcode: 'PC00_M99' },
    { id: 'g', type: 'exclusiveGateway', label: 'Results approved?', lane: 'l2', role: 'Senior Payroll Analyst' },
    { id: 'a3', type: 'serviceTask', label: 'Run Live Payroll', lane: 'l1', role: 'Payroll Analyst' },
    { id: 'a4', type: 'serviceTask', label: 'Post Payroll Results', lane: 'l3', role: 'Payroll System', ricefw: ['INT-PAYROLL-POST'] },
    { id: 'e', type: 'endEvent', label: 'Payroll posted', lane: 'l3' },
  ],
  [['s', 'a1'], ['a1', 'a2'], ['a2', 'g'], ['g', 'a3', 'conditional', 'Approved'], ['a3', 'a4'], ['a4', 'e'], ['g', 'a2', 'conditional', 'Rework']],
)

// ─── The catalog ───────────────────────────────────────
// Node shape: { name, description?, scope?, lifecycle?, variant?, graph?, overlays?, children?|groups?|processes? }
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

  // ─── Deep stream: Plan-to-Perform (Program & Portfolio Mgmt / EVMS) ──
  {
    name: 'Plan-to-Perform (Program & Portfolio Management)',
    description: 'EVMS-grade program and portfolio management: baseline, control accounts, work authorization, EAC/ETC, and variance reporting.',
    children: [
      { name: 'Perform Program Startup and Baseline', lifecycle: 'interim', children: [
        { name: 'Create / Update Baseline Project, WBS & Budget', description: 'Stand up or revise the project, WBS, and distribute undistributed budget.', lifecycle: 'interim', overlays: [ctrl('EVMS', 'EIA-748', 'Performance measurement baseline', 'Maintain a controlled, traceable PMB.')], children: [
          { name: 'Baseline Update (Off-Ceiling)', description: 'Budget changes that exceed the contract ceiling.', lifecycle: 'interim', variant: 'Off-Ceiling' },
          { name: 'Baseline Update (On-Ceiling)', description: 'Budget changes within the contract ceiling.', lifecycle: 'interim', variant: 'On-Ceiling' },
          { name: 'Baseline Update (Facilities)', description: 'Facilities project budget baseline.', lifecycle: 'interim', variant: 'Facilities' },
          { name: 'Baseline Update (Tech Investment)', description: 'Technology investment budget baseline.', lifecycle: 'interim', variant: 'Tech Investment' },
          { name: 'Baseline Update (Capital)', description: 'Capital project budget baseline.', lifecycle: 'interim', variant: 'Capital' },
          { name: 'Baseline Update (Other Indirect)', description: 'Other indirect budget baseline.', lifecycle: 'interim', variant: 'Other Indirect' },
        ]},
        { name: 'Create / Update Control Account', description: 'Establish or revise control accounts (CAM-owned).', lifecycle: 'interim' },
        { name: 'Create / Update Work Package', description: 'Establish or revise work packages and planning packages.', lifecycle: 'interim' },
        { name: 'Update Project, Control Account & Work Package Status', description: 'Status transitions across the WBS.', lifecycle: 'interim' },
        { name: 'Manage Special Purpose Plant Equipment', description: 'Track special tooling and special test equipment.' },
      ]},
      { name: 'Manage / Update Organizational Breakdown Structure', children: [
        { name: 'Maintain OBS and CAM Assignments', description: 'Map the OBS to the WBS via responsibility assignment (RAM).' },
      ]},
      { name: 'Perform Program Management and Scheduling', children: [
        { name: 'Manage Schedule and Baselines', description: 'Maintain the IMS and schedule baselines.', lifecycle: 'interim', overlays: [ctrl('EVMS', 'GASP', 'Schedule integrity', 'Schedule traceable and statused on a regular cadence.')] },
        { name: 'Define Program Scope and Issue Work Directive', description: 'Communicate scope and issue work directives.', lifecycle: 'interim' },
        { name: 'Develop Program Estimates at Complete (EAC/ETC)', description: 'Bottoms-up and statistical EAC/ETC.', lifecycle: 'interim', overlays: [ctrl('EVMS', 'EAC', 'Estimate at completion', 'EAC reconciled to performance and risk.'), kpi('TCPI', '<= 1.0')] },
        { name: 'Issue Work Authorization', description: 'Authorize control account / work package work to begin.', lifecycle: 'interim', graph: GRAPH_WORKAUTH, overlays: [ctrl('EVMS', 'WAD', 'Work authorization', 'Work authorized before charging begins.')] },
      ]},
      { name: 'Perform Strategic Portfolio Management', children: [
        { name: 'Manage Portfolio Demand and Prioritization', description: 'Intake, score, and prioritize the portfolio.' },
        { name: 'Manage Portfolio Capacity and Funding', description: 'Balance demand against capacity and funding.' },
      ]},
      { name: 'Perform Security, Data Analytics, and Reporting', children: [
        { name: 'Manage Financial Hierarchies and Portfolios', description: 'Maintain reporting hierarchies and portfolios.', lifecycle: 'interim' },
        { name: 'Perform Variance Analysis and Reporting', description: 'Analyze cost/schedule variances and corrective actions.', overlays: [ctrl('EVMS', 'EIA-748', 'Variance analysis', 'Document variance drivers and corrective actions.')], children: [
          { name: 'Perform Corporate Reporting', description: 'Corporate financial and performance reporting.' },
          { name: 'Perform Customer (Non-Contractual) Reporting', description: 'Customer-facing program reporting.' },
          { name: 'Perform Internal Project Reporting', description: 'Internal project performance reporting.' },
        ]},
      ]},
    ],
  },

  // ─── Deep stream: Record-to-Report ──
  {
    name: 'Record-to-Report (Finance / EVMS / DCAA)',
    description: 'End-to-end financial accounting and reporting: GL, assets, cost, tax, bank, travel, close, and reporting.',
    children: [
      { name: 'Perform General Ledger Accounting', children: [
        { name: 'Manage General Ledger Master Data', description: 'Maintain GL accounts and hierarchies.' },
        { name: 'Perform Journal Entries', description: 'Create, park, approve, and post journal entries.', graph: GRAPH_JOURNAL, overlays: [ctrl('DCAA', 'JE', 'Journal entry controls', 'Segregation of duties and approval before posting.')] },
        { name: 'Perform Intercompany Transactions', description: 'Intercompany postings and reconciliation.' },
        { name: 'Process and Analyze Accounts Payable', description: 'Vendor invoice processing and analysis.' },
        { name: 'Process and Analyze Accounts Receivable', description: 'Customer billing receivables and analysis.' },
        { name: 'Manage Reorganizations', description: 'Org and master-data reorganizations.' },
      ]},
      { name: 'Perform Asset Accounting', children: [
        { name: 'Manage Asset Master Data', description: 'Asset master creation and maintenance.' },
        { name: 'Perform Capital Project Settlement', description: 'Settle capital projects (AuC) to assets.' },
        { name: 'Manage Asset Depreciation and Transfers', description: 'Depreciation runs and intra/intercompany transfers.' },
        { name: 'Perform Disposal of Assets', description: 'Retire and dispose of assets.' },
      ]},
      { name: 'Perform Cost Accounting', children: [
        { name: 'Manage Cost Accounting Master Data', description: 'Controlling master data.', children: [
          { name: 'Manage Profit Center Master Data', description: 'Profit center master.' },
          { name: 'Manage Cost Center Master Data', description: 'Cost center master.' },
          { name: 'Manage Cost Element Groups', description: 'Cost element / GL account groups.' },
          { name: 'Manage Activity Type Master Data', description: 'Activity types and rates.' },
          { name: 'Manage Statistical Key Figure Master Data', description: 'SKF master for allocations.' },
          { name: 'Manage Universal Allocation Cycle Master Data', description: 'Allocation cycle definitions.' },
        ]},
        { name: 'Record Purchase Costs to Receiving Objects', description: 'Post purchased cost to WBS/cost objects.' },
        { name: 'Record Time and Labor to Receiving Objects', description: 'Post labor cost to WBS/cost objects.', overlays: [ctrl('DCAA', 'Labor', 'Labor distribution integrity', 'Labor charged to the correct cost objective.')] },
        { name: 'Perform Cost Transfer', description: 'Move costs between objects.', children: [
          { name: 'Labor Cost Transfer', description: 'Transfer labor cost between objects.', variant: 'Labor' },
          { name: 'Other Direct Cost (ODC) Transfer (Non-Travel)', description: 'Transfer non-travel ODC.', variant: 'ODC' },
          { name: 'Travel Cost Transfer', description: 'Transfer travel cost.', variant: 'Travel' },
        ]},
        { name: 'Perform Project Settlement', description: 'Settle project costs per settlement rules.', children: [
          { name: 'Direct, Billable Project Settlement', description: 'Settle direct billable projects.', variant: 'Direct' },
          { name: 'FWO / DWO Project Settlement', description: 'Settle funded/definite work orders.', variant: 'FWO/DWO' },
          { name: 'Indirect Project Settlement to Cost Centers', description: 'Settle indirect projects to cost centers.', variant: 'Indirect' },
          { name: 'Settlement Rule Error Resolution', description: 'Resolve settlement rule errors.' },
        ]},
        { name: 'Perform Profitability Analysis', description: 'CO-PA / margin analysis.' },
      ]},
      { name: 'Perform Tax Accounting', children: [
        { name: 'Manage Tax Master Data', description: 'Tax codes and jurisdictions.' },
        { name: 'Manage Tax', description: 'Tax determination and filing.', children: [
          { name: 'Manage 1099 Taxes', description: '1099 reporting.', variant: '1099' },
          { name: 'Manage Sales and Use Tax', description: 'Sales & use tax.', variant: 'Sales & Use' },
          { name: 'Manage Property Taxes', description: 'Property tax.', variant: 'Property' },
          { name: 'Manage Informational Tax Return', description: 'Informational return (e.g. Form 990).', variant: 'Informational' },
        ]},
      ]},
      { name: 'Perform Bank Accounting', children: [
        { name: 'Manage Bank Accounting Master Data', description: 'House banks and accounts.' },
        { name: 'Manage New Banking Relationship', description: 'Onboard a new bank.' },
        { name: 'Manage New Routing Number', description: 'Maintain routing/account details.' },
        { name: 'Perform Bank Transactions and Payments', description: 'Payment runs and bank statement processing.' },
        { name: 'Perform Escheatment', description: 'Unclaimed property / escheatment.' },
      ]},
      { name: 'Perform Travel Accounting', children: [
        { name: 'Maintain Travel Master Data', description: 'Travel and expense master data.' },
        { name: 'Record Travel, P-Card, and Employee Expenses', description: 'Capture expenses to receiving objects.' },
        { name: 'Travel Cost Transfer', description: 'Reassign travel cost between objects.', variant: 'Travel' },
      ]},
      { name: 'Perform Financial Close', children: [
        { name: 'Ingest FX Rates', description: 'Load period FX rates.' },
        { name: 'Perform Period End Close', description: 'Accruals, allocations, and ledger close.' },
        { name: 'Perform Operational Close', description: 'Cost allocations and rate processing.', children: [
          { name: 'Perform Allocables Processing', description: 'Process allocable pools.' },
          { name: 'Perform Provisional Allocations', description: 'Provisional indirect allocations.', overlays: [ctrl('CAS', '418', 'Allocation of indirect costs', 'Causal/beneficial allocation basis.')] },
          { name: 'Perform Rate Processing', description: 'Apply provisional / actual indirect rates.', overlays: [ctrl('CAS', '406', 'Cost accounting period', 'Consistent rate periods.')] },
        ]},
        { name: 'Perform Year End Close', description: 'Year-end close and carryforward.' },
      ]},
      { name: 'Perform Financial Reporting', children: [
        { name: 'Perform Overhead Claim Reporting', description: 'Annual incurred-cost / overhead claim reporting.', overlays: [ctrl('FAR', '52.216-7', 'Allowable cost & payment', 'Adequate incurred cost submission.'), acc('RevTech ICS Accelerator', 'revtech-ics')] },
        { name: 'Perform Financial Monthly Reporting', description: 'Monthly internal reporting.' },
        { name: 'Perform Financial Quarterly Reporting', description: 'Quarterly reporting.' },
        { name: 'Perform Financial Annual Reporting', description: 'Annual reporting.' },
      ]},
    ],
  },

  // ─── Deep stream: Hire-to-Retire ──
  {
    name: 'Hire-to-Retire (Workforce / Clearances)',
    description: 'Workforce lifecycle: talent and clearances, records, compliant timekeeping, payroll, and offboarding.',
    children: [
      { name: 'Talent & Clearances', children: [
        { name: 'Recruit & Onboard', description: 'Requisition through onboarding.' },
        { name: 'Manage Security Clearance', description: 'Initiate and track clearances.', overlays: [ctrl('ITAR', '120-130', 'Export-controlled access', 'Restrict access by clearance and citizenship.')] },
      ]},
      { name: 'Manage Employee Records, Time, and Pay', lifecycle: 'interim', children: [
        { name: 'Manage Employee Records and Data', description: 'Maintain employee master, org assignment, and interfaces.', lifecycle: 'interim' },
        { name: 'Manage Time and Attendance', description: 'Capture and approve time and attendance.', lifecycle: 'interim', overlays: [ctrl('DCAA', 'TTA', 'Timekeeping integrity', 'Daily, contemporaneous, total-time accounting with supervisor approval.')] },
        { name: 'Manage Leave', description: 'Leave requests, balances, and accruals.', lifecycle: 'interim' },
        { name: 'Perform Time Evaluation and Gross Payroll', description: 'Evaluate time and calculate gross pay.', lifecycle: 'interim' },
        { name: 'Generate Payroll Interface Files', description: 'Produce outbound payroll/benefit interface files.', lifecycle: 'interim' },
        { name: 'Run Net Payroll', description: 'Simulate, approve, and run net payroll.', lifecycle: 'interim', graph: GRAPH_NETPAYROLL },
        { name: 'Post Payroll Processing', description: 'Post payroll results and reconcile.', lifecycle: 'interim' },
      ]},
      { name: 'Offboarding', children: [
        { name: 'Manage Separation', description: 'Offboarding and access revocation.' },
        { name: 'Debrief Clearance', description: 'Clearance debrief and property return.' },
      ]},
    ],
  },
]

// ─── Emit SQL ──────────────────────────────────────────
const q = (s) => (s == null ? 'null' : `'${String(s).replace(/'/g, "''")}'`)
const jsonb = (obj) => `'${JSON.stringify(obj).replace(/'/g, "''")}'::jsonb`
const childrenOf = (n) => n.children || n.groups || n.processes || []
const kindFor = (level) => (level === 1 ? 'scenario' : level === 2 ? 'process_group' : 'process')

const scenarioRows = []
const overlayRows = []

function walk(node, parentId, level, path) {
  const kids = childrenOf(node)
  const nodePath = `${path}/${node.name}${node.variant ? `#${node.variant}` : ''}`
  const nid = id(nodePath)
  scenarioRows.push({
    id: nid, parent: parentId, level, kind: kindFor(level),
    name: node.name, desc: node.description, scope: node.scope,
    lifecycle: node.lifecycle, variant: node.variant,
    graph: kids.length === 0 ? node.graph : null,  // only leaves carry a BPMN graph
    sort: node._sort ?? 0,
  })
  ;(node.overlays || []).forEach((o, io) => {
    overlayRows.push({ id: id(`${nodePath}/overlay/${io}`), scenario: nid, kind: o.kind, payload: o.payload, sort: io })
  })
  kids.forEach((c, i) => { c._sort = i; walk(c, nid, level + 1, nodePath) })
}

SCENARIOS.forEach((s, i) => { s._sort = i; walk(s, null, 1, LIB.code) })

const lines = []
lines.push('-- AUTO-GENERATED by scripts/seed-reference.mjs — do not edit by hand.')
lines.push('-- Generalized from real SAP process docs; all client identifiers removed.')
lines.push('begin;')
lines.push(`delete from process_reference_libraries where code = ${q(LIB.code)};`)
lines.push(`insert into process_reference_libraries (id, code, title, version, source, is_active) values (${q(libId)}, ${q(LIB.code)}, ${q(LIB.title)}, ${q(LIB.version)}, ${q(LIB.source)}, true);`)

for (const r of scenarioRows) {
  lines.push(
    `insert into process_reference_scenarios (id, library_id, parent_id, level, node_kind, name, description, scope_item_ref, sort_order, lifecycle, variant_label, graph_data) values (` +
    `${q(r.id)}, ${q(libId)}, ${r.parent ? q(r.parent) : 'null'}, ${r.level}, ${q(r.kind)}, ${q(r.name)}, ${q(r.desc)}, ${q(r.scope)}, ${r.sort}, ${q(r.lifecycle)}, ${q(r.variant)}, ${r.graph ? jsonb(r.graph) : 'null'});`
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
const byLevel = scenarioRows.reduce((m, r) => ((m[r.level] = (m[r.level] || 0) + 1), m), {})
console.log(`Wrote ${out}`)
console.log(`Library ${LIB.code} v${LIB.version}: ${scenarioRows.length} rows (by level ${JSON.stringify(byLevel)}), ${overlayRows.length} overlays`)
