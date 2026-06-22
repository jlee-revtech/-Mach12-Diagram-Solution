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
import { writeFileSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const NS = '6f5a1c00-1b2c-4d3e-9f80-mach12reflib'.replace(/[^0-9a-f-]/g, '0')
const LIB = { code: 'mach12-ad-core', title: 'Mach12 A&D Core Process Reference', version: '1.2.0', source: 'curated' }
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
      ...(s.desc ? { description: s.desc } : {}),
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

// ─── Direct-procurement stream graphs (S/4HANA + Ariba) ──
// Generalized from real A&D direct-procurement functional specs. Per-node
// `desc` is tagged with the owning system to preserve the source legend:
//   "S/4HANA ·"  "Ariba ·"  "Customization ·"  "Outside S/4 / Ariba ·"
// All client identifiers (org names, people, custom tool/system names) removed.

const GRAPH_SOURCING_REQUEST = flow(
  [
    { id: 'l1', label: 'Requestor' },
    { id: 'l2', label: 'Sourcing Web App' },
    { id: 'l3', label: 'Procurement System (SAP S/4HANA)' },
    { id: 'l4', label: 'Manager / Buyer' },
    { id: 'l5', label: 'SAP Ariba (Guided Buying)' },
  ],
  [
    { id: 's', type: 'startEvent', label: 'Sourcing need identified', lane: 'l1' },
    { id: 'a1', type: 'userTask', label: 'Enter WBS Element', lane: 'l2', role: 'Requestor', desc: 'Customization · Sourcing web app, refreshed daily with the WBS extract from S/4.' },
    { id: 'a2', type: 'userTask', label: 'Submit Request (Next)', lane: 'l2', role: 'Requestor', desc: 'Customization · Web app posts the request to S/4.' },
    { id: 'g1', type: 'exclusiveGateway', label: 'Direct or Indirect WBS?', lane: 'l3', desc: 'S/4HANA · System derives Direct vs Indirect from the WBS.' },
    { id: 'a3', type: 'userTask', label: 'Open Guided Buying', lane: 'l5', role: 'Requestor', desc: 'Ariba · Indirect spend routed to Guided Buying via SSO.' },
    { id: 'e1', type: 'endEvent', label: 'Indirect handled in Guided Buying', lane: 'l5' },
    { id: 'g2', type: 'exclusiveGateway', label: 'PR or Sourcing Request?', lane: 'l3', desc: 'S/4HANA · For Direct spend the requestor chooses a PR or an SR.' },
    { id: 'a4', type: 'userTask', label: 'Create Direct PR', lane: 'l3', role: 'Requestor', desc: 'Customization · SSO to the S/4 Create PR app with the Direct PR document type and the WBS in account assignment.' },
    { id: 'e2', type: 'endEvent', label: 'Hand off to Direct Procurement', lane: 'l3' },
    { id: 'a5', type: 'userTask', label: 'Create Sourcing Request', lane: 'l1', role: 'Requestor', desc: 'Customization · SSO to the S/4 Create PR app with the Sourcing Request document type.' },
    { id: 'a6', type: 'userTask', label: 'Enter SR Detail & Attachments', lane: 'l1', role: 'Requestor', desc: 'S/4HANA · Add the data needed to create the SR, including attachments.' },
    { id: 'a7', type: 'serviceTask', label: 'Save Sourcing Request', lane: 'l3', desc: 'S/4HANA · SR saved against the WBS.' },
    { id: 'g3', type: 'exclusiveGateway', label: 'Supplier exists?', lane: 'l4', role: 'Buyer' },
    { id: 'a8', type: 'userTask', label: 'Onboard Supplier', lane: 'l4', role: 'Buyer', desc: 'Outside S/4 / Ariba · Supplier onboarding for a new source.' },
    { id: 'a9', type: 'userTask', label: 'Update Contract', lane: 'l4', role: 'Buyer', desc: 'Ariba · Edit the supplier contract for an existing source.' },
    { id: 'a10', type: 'userTask', label: 'Run Sourcing Event / RFQ (optional)', lane: 'l4', role: 'Buyer', desc: 'Ariba · Optional sourcing event when an RFQ is required.' },
    { id: 'g4', type: 'exclusiveGateway', label: 'SR approved?', lane: 'l4', role: 'Buyer', desc: 'S/4HANA · Manager verifies the buyer code, then buyer and requestor iterate until both agree and the buyer gives final approval.' },
    { id: 'a11', type: 'manualTask', label: 'Mark SR Closed', lane: 'l1', role: 'Requestor', desc: 'S/4HANA · If the SR will not produce a Direct PR, close it so the auto-convert job skips it.' },
    { id: 'e3', type: 'endEvent', label: 'SR closed', lane: 'l1' },
    { id: 'a12', type: 'serviceTask', label: 'Auto-Convert SR to Direct PR', lane: 'l3', desc: 'Customization · Scheduled job converts an approved SR into a Direct PR.' },
    { id: 'e4', type: 'endEvent', label: 'Direct PR created', lane: 'l3' },
  ],
  [
    ['s', 'a1'], ['a1', 'a2'], ['a2', 'g1'],
    ['g1', 'a3', 'conditional', 'Indirect'], ['a3', 'e1'],
    ['g1', 'g2', 'conditional', 'Direct'],
    ['g2', 'a4', 'conditional', 'PR'], ['a4', 'e2'],
    ['g2', 'a5', 'conditional', 'Sourcing Request'],
    ['a5', 'a6'], ['a6', 'a7'], ['a7', 'g3'],
    ['g3', 'a8', 'conditional', 'No - new supplier'], ['g3', 'a9', 'conditional', 'Yes - existing'],
    ['a8', 'a10'], ['a9', 'a10'], ['a10', 'g4'],
    ['g4', 'a12', 'conditional', 'Approved'], ['a12', 'e4'],
    ['g4', 'a11', 'conditional', 'Rejected'], ['a11', 'e3'],
  ],
)

const GRAPH_PR_RELEASE = flow(
  [
    { id: 'l1', label: 'Requestor' },
    { id: 'l2', label: 'PR Release Workflow' },
    { id: 'l3', label: 'Conditional Approvers' },
    { id: 'l4', label: 'Supply Chain' },
    { id: 'l5', label: 'Procurement System (SAP S/4HANA)' },
  ],
  [
    { id: 's', type: 'startEvent', label: 'PR released into workflow', lane: 'l1' },
    { id: 'a1', type: 'userTask', label: 'Add Watcher (optional)', lane: 'l1', role: 'Requestor', desc: 'Customization · The Watcher is notified after each node is approved or rejected.' },
    { id: 'a2', type: 'serviceTask', label: 'Assemble Approval Workflow', lane: 'l2', desc: 'Customization · Each approver node is added only if its predefined conditions are met; nodes are independent. A split account assignment adds the WBS owner for each WBS.' },
    { id: 'a3', type: 'userTask', label: 'Approver Business Review', lane: 'l3', role: 'Conditional Approver (WBS Owner, Finance, Program Finance, PM, Business Development, CFO, Contracts, Quality)', desc: 'S/4HANA · Each conditionally-added approver reviews. The Contract Administrator adds a Contract Review and the Quality Manager adds a Quality Review.' },
    { id: 'g1', type: 'exclusiveGateway', label: 'Approved within DOA?', lane: 'l3', desc: 'S/4HANA · Delegation of Authority is checked; if the approver cannot approve the full amount, the next DOA level is added to the workflow.' },
    { id: 'a4', type: 'userTask', label: 'Provide Comments', lane: 'l3', role: 'Conditional Approver', desc: 'S/4HANA · Rejection returns the PR for rework.' },
    { id: 'a5', type: 'serviceTask', label: 'S/4 PR Creation / Edit', lane: 'l5', desc: 'S/4HANA · PR updated per feedback, then re-enters the workflow.' },
    { id: 'g2', type: 'exclusiveGateway', label: 'More approver nodes?', lane: 'l2', desc: 'Customization · Loop until every conditionally-added node has approved.' },
    { id: 'a6', type: 'userTask', label: 'Review Purchase Request', lane: 'l4', role: 'Supply Chain Strategic Buyer', desc: 'S/4HANA · Strategic buyer reviews the released PR.' },
    { id: 'g3', type: 'exclusiveGateway', label: 'Sourcing event needed?', lane: 'l4', desc: 'S/4HANA · Decide whether a sourcing event is required.' },
    { id: 'e2', type: 'endEvent', label: 'Sourcing event / project planning', lane: 'l4', desc: 'Ariba · Hand off to a sourcing event.' },
    { id: 'a7', type: 'userTask', label: 'Assign Buyer & Verify Supplier', lane: 'l4', role: 'Supply Chain Manager', desc: 'S/4HANA · Supply Chain Manager assigns the buyer and verifies the supplier.' },
    { id: 'a8', type: 'serviceTask', label: 'Auto-Convert PR to PO', lane: 'l5', desc: 'Customization · Nightly job: if the PR is released, a contract exists, the total is under the auto-convert threshold, and master data is present, it converts to a PO; otherwise it is converted manually.' },
    { id: 'e1', type: 'endEvent', label: 'PR released for PO conversion', lane: 'l5' },
  ],
  [
    ['s', 'a1'], ['a1', 'a2'], ['a2', 'a3'], ['a3', 'g1'],
    ['g1', 'a4', 'conditional', 'Rejected'], ['a4', 'a5'], ['a5', 'a3', 'sequence', 'Resubmit'],
    ['g1', 'g2', 'conditional', 'Approved'],
    ['g2', 'a3', 'conditional', 'Yes - next node'],
    ['g2', 'a6', 'conditional', 'No - all approved'],
    ['a6', 'g3'],
    ['g3', 'e2', 'conditional', 'Yes'],
    ['g3', 'a7', 'conditional', 'No'],
    ['a7', 'a8'], ['a8', 'e1'],
  ],
)

const GRAPH_DIRECT_PROCUREMENT = flow(
  [
    { id: 'l1', label: 'Requestor' },
    { id: 'l2', label: 'Supply Chain Buyer' },
    { id: 'l3', label: 'Procurement System (SAP S/4HANA)' },
    { id: 'l4', label: 'SAP Ariba' },
    { id: 'l5', label: 'Suppliers' },
    { id: 'l6', label: 'Intake & Integration' },
  ],
  [
    { id: 's', type: 'startEvent', label: 'PR request (ITSM intake)', lane: 'l6', desc: 'Outside S/4 / Ariba · Service-management tool raises the request via API.' },
    { id: 'a1', type: 'userTask', label: 'Create PR', lane: 'l1', role: 'Requestor', desc: 'S/4HANA · Assign desired vendor (optional), buyer code, WBS element, and the correct price.' },
    { id: 'a2', type: 'userTask', label: 'Validate Contract Flowdowns', lane: 'l1', role: 'Requestor', desc: 'Customization · Clause rules auto-populate onto the PR from the clause catalogue (Dassian Clause Library).' },
    { id: 'a3', type: 'userTask', label: 'Add / Edit Attachments', lane: 'l1', role: 'Requestor', desc: 'S/4HANA · Attach supporting documents.' },
    { id: 'a4', type: 'serviceTask', label: 'Save PR', lane: 'l3', desc: 'S/4HANA.' },
    { id: 'a5', type: 'userTask', label: 'Release PR', lane: 'l3', role: 'PR Release Workflow', desc: 'Customization · Handled by the PR Release Procedure flow.' },
    { id: 'a6', type: 'serviceTask', label: 'Sync to eBinder', lane: 'l6', desc: 'Outside S/4 / Ariba · Integration calls S/4 and updates the external eBinder (system of record); a scheduled job keeps it in sync.' },
    { id: 'g1', type: 'exclusiveGateway', label: 'RFQ needed?', lane: 'l2', desc: 'S/4HANA · Buyer decides whether to run an RFQ or convert directly.' },
    { id: 'a7', type: 'userTask', label: 'Create RFQs', lane: 'l2', role: 'Supply Chain Buyer', desc: 'S/4HANA · RFQ output can be emailed or saved as PDF to send to suppliers.' },
    { id: 'a8', type: 'userTask', label: 'Send RFQ to Suppliers', lane: 'l2', role: 'Supply Chain Buyer', desc: 'S/4HANA.' },
    { id: 'a9', type: 'userTask', label: 'Receive RFQ & Respond', lane: 'l5', role: 'Supplier', desc: 'Outside S/4 / Ariba · Supplier collaboration is manual (calls, email).' },
    { id: 'a10', type: 'userTask', label: 'Enter & Analyze Responses', lane: 'l2', role: 'Supply Chain Buyer', desc: 'S/4HANA · Responses entered into S/4 and analyzed against business must-haves.' },
    { id: 'a11', type: 'userTask', label: 'Select Winning RFQ', lane: 'l2', role: 'Supply Chain Buyer', desc: 'S/4HANA.' },
    { id: 'a12', type: 'userTask', label: 'Convert PR to PO', lane: 'l2', role: 'Supply Chain Buyer', desc: 'S/4HANA · Convert from the released Direct PR (or from the winning RFQ / SR).' },
    { id: 'g2', type: 'exclusiveGateway', label: 'Price change vs PR?', lane: 'l2', desc: 'S/4HANA · Compare the total PO price to the PR (total, not line item).' },
    { id: 'g3', type: 'exclusiveGateway', label: 'Difference over threshold?', lane: 'l2', desc: 'S/4HANA · Threshold check (for example, $5K).' },
    { id: 'a13', type: 'manualTask', label: 'Delete PO / Do Not Save PR', lane: 'l2', role: 'Supply Chain Buyer', desc: 'S/4HANA · Over threshold: cancel and correct the PR before reconverting.' },
    { id: 'a14', type: 'userTask', label: 'Update PR', lane: 'l1', role: 'Requestor', desc: 'S/4HANA · Correct the PR, then reconvert.' },
    { id: 'a15', type: 'userTask', label: 'Modify PO / Finish Conversion', lane: 'l2', role: 'Supply Chain Buyer', desc: 'S/4HANA.' },
    { id: 'a16', type: 'userTask', label: 'Add Clauses & Attachments', lane: 'l2', role: 'Supply Chain Buyer', desc: 'Customization · Clauses stored in the clause library (Dassian).' },
    { id: 'a17', type: 'serviceTask', label: 'Save PO', lane: 'l3', desc: 'S/4HANA.' },
    { id: 'a18', type: 'serviceTask', label: 'Release PO & Output', lane: 'l3', desc: 'S/4HANA · PO output issued.' },
    { id: 'a19', type: 'serviceTask', label: 'Copy PO to Ariba', lane: 'l4', desc: 'Ariba · PO copied to Ariba and made available to suppliers via the Supplier Network (reference and invoicing only).' },
    { id: 'a20', type: 'serviceTask', label: 'PO Status Update', lane: 'l6', desc: 'Outside S/4 / Ariba · PO status returned to the service-management tool / eBinder.' },
    { id: 'e1', type: 'endEvent', label: 'PO issued', lane: 'l4', desc: 'Ariba · Supplier invoices against the PO.' },
  ],
  [
    ['s', 'a1'], ['a1', 'a2'], ['a2', 'a3'], ['a3', 'a4'], ['a4', 'a5'], ['a5', 'a6'], ['a6', 'g1'],
    ['g1', 'a7', 'conditional', 'RFQ'], ['a7', 'a8'], ['a8', 'a9'], ['a9', 'a10'], ['a10', 'a11'], ['a11', 'a12'],
    ['g1', 'a12', 'conditional', 'Direct convert'],
    ['a12', 'g2'],
    ['g2', 'a15', 'conditional', 'No change'],
    ['g2', 'g3', 'conditional', 'Price changed'],
    ['g3', 'a15', 'conditional', 'Under threshold'],
    ['g3', 'a13', 'conditional', 'Over threshold'],
    ['a13', 'a14'], ['a14', 'a1', 'sequence', 'Reconvert after correction'],
    ['a15', 'a16'], ['a16', 'a17'], ['a17', 'a18'], ['a18', 'a19'], ['a19', 'a20'], ['a20', 'e1'],
  ],
)

const GRAPH_SUPPLIER_CONTRACT = flow(
  [
    { id: 'l1', label: 'Buyer / Manager' },
    { id: 'l2', label: 'Supplier' },
    { id: 'l3', label: 'Contract System (SAP S/4HANA / Dassian)' },
  ],
  [
    { id: 's', type: 'startEvent', label: 'Contract need', lane: 'l1', desc: 'S/4HANA · Triggered by a sourcing request or a direct PR.' },
    { id: 'g1', type: 'exclusiveGateway', label: 'Amend existing contract?', lane: 'l1', role: 'Buyer / Manager' },
    { id: 'a1', type: 'userTask', label: 'Amend Supplier Contract', lane: 'l1', role: 'Buyer / Manager', desc: 'S/4HANA · Driven by an SR or Direct PR. If the contract was updated due to a Direct PR, close that Direct PR.' },
    { id: 'a2', type: 'userTask', label: 'Create Contract Draft', lane: 'l1', role: 'Buyer / Manager', desc: 'S/4HANA · Driven by an SR or Direct PR. If the contract was created due to a Direct PR, close that Direct PR.' },
    { id: 'a3', type: 'userTask', label: 'Negotiate & Approve Contract', lane: 'l1', role: 'Buyer / Manager', desc: 'Outside S/4 / Ariba · Negotiation happens outside the system (calls, email).' },
    { id: 'a4', type: 'userTask', label: 'Execute Supplier Contract', lane: 'l1', role: 'Buyer / Manager', desc: 'S/4HANA.' },
    { id: 'a5', type: 'userTask', label: 'Digital Signoff', lane: 'l2', role: 'Supplier', desc: 'Outside S/4 / Ariba · Supplier signs; e-signature is a nice-to-have, not required.' },
    { id: 'a6', type: 'userTask', label: 'Finalize & Publish Contract', lane: 'l1', role: 'Buyer / Manager', desc: 'S/4HANA.' },
    { id: 'a7', type: 'serviceTask', label: 'Release Contract', lane: 'l3', desc: 'S/4HANA · Simple one-step release on contracts.' },
    { id: 'e2', type: 'endEvent', label: 'Perform Direct Procurement', lane: 'l1', desc: 'S/4HANA · Released contract enables direct procurement against it.' },
    { id: 'a8', type: 'userTask', label: 'Closeout Supplier Contract', lane: 'l1', role: 'Buyer / Manager', desc: 'S/4HANA.' },
    { id: 'e1', type: 'endEvent', label: 'Contract closed', lane: 'l3' },
  ],
  [
    ['s', 'g1'],
    ['g1', 'a1', 'conditional', 'Yes - amend'], ['a1', 'a3'],
    ['g1', 'a2', 'conditional', 'No - new'], ['a2', 'a3'],
    ['a3', 'a4'], ['a4', 'a5'], ['a5', 'a6'], ['a6', 'a7'],
    ['a7', 'e2', 'sequence', 'Enables'],
    ['a7', 'a8'], ['a8', 'e1'],
  ],
)

const GRAPH_INVOICE_PROCESSING = flow(
  [
    { id: 'l1', label: 'AP Function' },
    { id: 'l2', label: 'Buyer' },
    { id: 'l3', label: 'SAP Ariba' },
    { id: 'l4', label: 'Procurement System (SAP S/4HANA)' },
  ],
  [
    { id: 's', type: 'startEvent', label: 'Supplier invoice received', lane: 'l3', desc: 'Ariba · Invoice arrives against the PO on the Supplier Network.' },
    { id: 'a1', type: 'serviceTask', label: 'Invoice Match & Evaluation', lane: 'l3', desc: 'Ariba · Automated match against the PO and goods receipt.' },
    { id: 'g1', type: 'exclusiveGateway', label: 'Match result?', lane: 'l1', role: 'AP Function' },
    { id: 'a2', type: 'manualTask', label: 'Manual Reconciliation', lane: 'l1', role: 'AP Function', desc: 'Ariba · Needs review; any PO change must be made in S/4.' },
    { id: 'a3', type: 'userTask', label: 'Edit PO in S/4', lane: 'l2', role: 'Buyer', desc: 'S/4HANA · Exception processing: buyer edits the PO.' },
    { id: 'a4', type: 'serviceTask', label: 'Wait for Changes to Sync to Ariba', lane: 'l2', role: 'Buyer', desc: 'Ariba · Updated PO flows back to Ariba; reconciliation resumes.' },
    { id: 'g2', type: 'exclusiveGateway', label: 'Reconciliation outcome?', lane: 'l1', role: 'AP Function' },
    { id: 'a5', type: 'serviceTask', label: 'Send Invoice for Payment', lane: 'l1', role: 'AP Function', desc: 'S/4HANA · Accepted invoice released to payment.' },
    { id: 'a6', type: 'manualTask', label: 'Reject Invoice', lane: 'l1', role: 'AP Function', desc: 'Ariba · Invoice rejected back to the supplier.' },
    { id: 'e1', type: 'endEvent', label: 'Invoice paid', lane: 'l4', desc: 'S/4HANA.' },
    { id: 'e2', type: 'endEvent', label: 'Invoice rejected', lane: 'l3' },
  ],
  [
    ['s', 'a1'], ['a1', 'g1'],
    ['g1', 'a5', 'conditional', 'Matched'],
    ['g1', 'a2', 'conditional', 'Needs review'],
    ['g1', 'a6', 'conditional', 'Invalid'],
    ['a2', 'a3', 'conditional', 'PO correction needed'],
    ['a3', 'a4'], ['a4', 'a2', 'sequence', 'Resume reconciliation'],
    ['a2', 'g2', 'conditional', 'Reconciled'],
    ['g2', 'a5', 'conditional', 'Accepted'],
    ['g2', 'a6', 'conditional', 'Rejected'],
    ['a5', 'e1'], ['a6', 'e2'],
  ],
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
      { name: 'Direct Procurement & Sourcing', processes: [
        { name: 'Sourcing Request & Early Engagement', description: 'WBS-driven intake that routes indirect spend to Guided Buying and direct spend to a PR or a Sourcing Request, then auto-converts an approved SR into a Direct PR.', graph: GRAPH_SOURCING_REQUEST, overlays: [acc('Guided Buying SSO Intake', 'guided-buying-intake')] },
        { name: 'PR Release Procedure', description: 'Conditional, DOA-driven PR release workflow with independent approver nodes, comment/edit loop, supply-chain buyer assignment, and nightly PR-to-PO auto-conversion.', graph: GRAPH_PR_RELEASE, overlays: [ctrl('DCAA', 'DOA', 'Delegation of authority', 'Approvals enforced against the DOA matrix; escalate to the next level until the full amount is covered.'), ctrl('FAR', '52.244-2', 'Consent / purchasing controls', 'Purchase approvals support a CPSR-adequate purchasing system.')] },
        { name: 'Direct Procurement Execution', description: 'End-to-end direct buy: PR with clause flowdowns, optional RFQ and supplier collaboration, PR-to-PO conversion with a price-change threshold gate, clause/attachment handling, and PO copy to Ariba.', graph: GRAPH_DIRECT_PROCUREMENT, overlays: [ctrl('DFARS', '252.244-7001', 'CPSR-adequate purchasing', 'Direct-procurement controls support purchasing-system adequacy for CPSR.'), ctrl('FAR', '52.244-2', 'Contract flowdowns', 'Mandatory FAR/DFARS clauses flow down to the PR/PO via the clause library.'), acc('Ariba Supplier Network', 'ariba-supplier-network')] },
        { name: 'Supplier Contract Management', description: 'Supplier contract lifecycle: draft or amend, negotiate, execute with digital signoff, finalize and publish, one-step release that enables direct procurement, and closeout.', graph: GRAPH_SUPPLIER_CONTRACT, overlays: [ctrl('FAR', '52.244-2', 'Clause flowdowns', 'Required FAR/DFARS clauses flow down via the contract clause library.'), acc('Dassian Clause Library', 'dassian-clauses')] },
        { name: 'Invoice Processing & Exception Handling', description: 'Automated PO/GR/invoice match with manual reconciliation, S/4 PO-edit exception loop that syncs back to Ariba, and accept/reject to payment.', graph: GRAPH_INVOICE_PROCESSING, overlays: [ctrl('FAR', '52.232-25', 'Prompt payment', 'Valid invoices paid within prompt-payment terms.'), kpi('Touchless match rate', '>= 80%')] },
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

// ─── Catalog helpers (exported for the graph generator) ──
export { SCENARIOS, LIB, libId, id }
export const childrenOf = (n) => n.children || n.groups || n.processes || []
const kindFor = (level) => (level === 1 ? 'scenario' : level === 2 ? 'process_group' : 'process')
export const nodePathOf = (parentPath, node) => `${parentPath}/${node.name}${node.variant ? `#${node.variant}` : ''}`

// Enumerate every leaf (no children) with its deterministic path/id + context.
export function enumerateLeaves() {
  const out = []
  const rec = (node, path, trail) => {
    const np = nodePathOf(path, node)
    const kids = childrenOf(node)
    if (kids.length === 0) {
      out.push({ id: id(np), path: np, name: node.name, description: node.description || '', hasGraph: !!node.graph, trail })
    } else {
      kids.forEach(c => rec(c, np, [...trail, node.name]))
    }
  }
  SCENARIOS.forEach(s => rec(s, LIB.code, []))
  return out
}

// ─── Emit SQL ──────────────────────────────────────────
const q = (s) => (s == null ? 'null' : `'${String(s).replace(/'/g, "''")}'`)
const jsonb = (obj) => `'${JSON.stringify(obj).replace(/'/g, "''")}'::jsonb`

export function buildSql(graphsByPath = {}) {
  const scenarioRows = []
  const overlayRows = []
  const walk = (node, parentId, level, path) => {
    const kids = childrenOf(node)
    const nodePath = nodePathOf(path, node)
    const nid = id(nodePath)
    scenarioRows.push({
      id: nid, parent: parentId, level, kind: kindFor(level),
      name: node.name, desc: node.description, scope: node.scope,
      lifecycle: node.lifecycle, variant: node.variant,
      // leaves carry a BPMN graph: hand-authored if present, else the AI cache
      graph: kids.length === 0 ? (node.graph || graphsByPath[nodePath] || null) : null,
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
  return { sql: lines.join('\n') + '\n', scenarioRows, overlayRows }
}

// ─── Run when invoked directly ─────────────────────────
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const dir = dirname(fileURLToPath(import.meta.url))
  let graphs = {}
  const cachePath = join(dir, 'reference-graphs.json')
  try { graphs = JSON.parse(readFileSync(cachePath, 'utf8')) } catch { /* no cache yet */ }
  const { sql, scenarioRows, overlayRows } = buildSql(graphs)
  const out = join(dir, '..', 'supabase', '027_process_reference_seed.sql')
  writeFileSync(out, sql, 'utf8')
  const byLevel = scenarioRows.reduce((m, r) => ((m[r.level] = (m[r.level] || 0) + 1), m), {})
  const withGraph = scenarioRows.filter(r => r.graph).length
  console.log(`Wrote ${out}`)
  console.log(`Library ${LIB.code} v${LIB.version}: ${scenarioRows.length} rows (by level ${JSON.stringify(byLevel)}), ${overlayRows.length} overlays, ${withGraph} leaves with a BPMN graph`)
}
