// ─── Standard capability map (per value stream) ────────
// A deterministic, best-practice A&D capability set for each of the 10 Process
// Studio value streams (workstream/catalog.ts). Powers the Capability Map
// "Seed standard" action: one curated capability map per value stream, keyed by
// the workstream `code`. No AI — stable and reproducible.

export interface StandardCapabilityDef {
  name: string
  domain?: string
  description?: string
}

export const STANDARD_CAPABILITIES: Record<string, StandardCapabilityDef[]> = {
  'bid-to-win': [
    { name: 'Opportunity Identification & Qualification', domain: 'Capture', description: 'Pipeline intake, gate reviews, and qualification of pursuits.' },
    { name: 'Capture Management & Win Strategy', domain: 'Capture', description: 'Customer engagement, competitive analysis, and win themes.' },
    { name: 'Proposal Management', domain: 'Proposal', description: 'Volume planning, compliance matrix, color teams, and submission.' },
    { name: 'Basis of Estimate & Cost Volume', domain: 'Estimating', description: 'BOE development and certified cost/pricing data.' },
    { name: 'Price-to-Win Analysis', domain: 'Pricing', description: 'Competitive price positioning and should-cost modeling.' },
    { name: 'Teaming & Subcontract Planning', domain: 'Teaming', description: 'Teaming agreements and subcontractor selection for the bid.' },
    { name: 'Bid / No-Bid Governance', domain: 'Capture', description: 'Pursuit decision gates and pursuit investment control.' },
  ],
  'contract-to-closeout': [
    { name: 'Award Setup & CLIN/SLIN Structure', domain: 'Contracts', description: 'Contract loading with CLIN/SLIN/ELIN and ACRN structure.' },
    { name: 'Funding & ACRN Management', domain: 'Contracts', description: 'Obligation tracking and limitation-of-funds management.' },
    { name: 'Contract Modifications', domain: 'Contracts', description: 'SF-30 modifications, definitization, and option exercise.' },
    { name: 'CDRL & Deliverables Management', domain: 'Deliverables', description: 'CDRL/SDRL scheduling, DD250 acceptance, and submittals.' },
    { name: 'Billing & Invoicing', domain: 'Billing', description: 'Progress, milestone, and PBP billing with WAWF submission.' },
    { name: 'Flowdown & Compliance Tracking', domain: 'Compliance', description: 'FAR/DFARS clause flowdowns and compliance obligations.' },
    { name: 'Contract Closeout', domain: 'Closeout', description: 'Final invoice, release of claims, and DCAA closeout.' },
  ],
  'plan-to-produce': [
    { name: 'Production Planning & Scheduling', domain: 'Manufacturing', description: 'Master production scheduling and capacity planning.' },
    { name: 'Material Requirements Planning (MRP)', domain: 'Manufacturing', description: 'Demand-driven material and component planning.' },
    { name: 'Shop Floor Execution', domain: 'Manufacturing', description: 'Production order release, confirmation, and dispatch.' },
    { name: 'Quality Management & Inspection', domain: 'Quality', description: 'In-process inspection, non-conformance, and quality records.' },
    { name: 'Inventory & Goods Movement', domain: 'Supply Chain', description: 'Goods receipt/issue, stock management, and traceability.' },
    { name: 'Production Order Settlement', domain: 'Finance', description: 'Order cost collection and settlement to WBS/project.' },
  ],
  'source-to-pay': [
    { name: 'Supplier Qualification & Management', domain: 'Procurement', description: 'Supplier onboarding, qualification, and performance.' },
    { name: 'Sourcing & Solicitation (RFx)', domain: 'Sourcing', description: 'RFQ/RFP sourcing events and award decisions.' },
    { name: 'Subcontract Management & Flowdowns', domain: 'Subcontracts', description: 'Subcontract administration with clause flowdowns.' },
    { name: 'Purchase Requisition & Ordering', domain: 'Procurement', description: 'Requisition-to-PO processing and approvals.' },
    { name: 'Goods & Service Receipt', domain: 'Supply Chain', description: 'Receiving, inspection, and service entry.' },
    { name: 'Accounts Payable & 3-Way Match', domain: 'Finance', description: 'Invoice verification, matching, and payment.' },
  ],
  'design-to-release': [
    { name: 'Requirements Management', domain: 'Engineering', description: 'Requirements capture, allocation, and traceability.' },
    { name: 'Design & Model Management', domain: 'PLM', description: 'CAD/MBSE design data and document management.' },
    { name: 'Configuration Management', domain: 'PLM', description: 'Baselines, effectivity, and configuration control.' },
    { name: 'Engineering Change Management', domain: 'PLM', description: 'ECR/ECO/ECN change request and disposition.' },
    { name: 'BOM Management & Release', domain: 'Engineering', description: 'Engineering and manufacturing BOM release.' },
    { name: 'First Article Inspection (FAI)', domain: 'Quality', description: 'AS9102 first article inspection and approval.' },
  ],
  'acquire-to-retire': [
    { name: 'Government & Contractor Property (GFP/CAP)', domain: 'Property', description: 'Property accountability, custody, and reporting.' },
    { name: 'Asset Acquisition & Capitalization', domain: 'Finance', description: 'Capital asset acquisition and capitalization.' },
    { name: 'Asset Tracking & Custody', domain: 'Property', description: 'Physical asset tracking, transfers, and audits.' },
    { name: 'Depreciation & Asset Accounting', domain: 'Finance', description: 'Depreciation, revaluation, and asset accounting.' },
    { name: 'Property Disposition & Retirement', domain: 'Property', description: 'Disposal, retirement, and end-of-life accountability.' },
  ],
  'sustainment-mro': [
    { name: 'Maintenance Planning & Scheduling', domain: 'Sustainment', description: 'Preventive and corrective maintenance planning.' },
    { name: 'Work Order Execution (Depot/Field)', domain: 'Sustainment', description: 'Work order dispatch, execution, and confirmation.' },
    { name: 'Repair & Overhaul (Refurbishment)', domain: 'Sustainment', description: 'Teardown, repair, and refurbishment production.' },
    { name: 'Installed Base & Equipment Management', domain: 'Service', description: 'Equipment, serial, and installed-base records.' },
    { name: 'Spares & Service Parts Management', domain: 'Supply Chain', description: 'Spares provisioning and service parts inventory.' },
    { name: 'Warranty & Service Contracts', domain: 'Service', description: 'Warranty claims and service agreement management.' },
  ],
  'plan-to-perform': [
    { name: 'Integrated Master Schedule (IMS)', domain: 'Program Control', description: 'Network schedule, critical path, and schedule health.' },
    { name: 'Performance Measurement Baseline (PMB)', domain: 'EVM', description: 'Time-phased budget baseline and control accounts.' },
    { name: 'Work Authorization & Control Accounts', domain: 'EVM', description: 'Work authorization documents and CAM assignment.' },
    { name: 'Earned Value & Variance Analysis', domain: 'EVM', description: 'BCWS/BCWP/ACWP, CPI/SPI, and variance reporting.' },
    { name: 'Estimate at Completion (EAC/ETC)', domain: 'EVM', description: 'Forecasting, EAC scenarios, and to-complete analysis.' },
    { name: 'Risk & Opportunity Management', domain: 'Risk', description: 'Risk register, handling plans, and burn-down.' },
    { name: 'Program Reporting (IPMR / NASA 533)', domain: 'Reporting', description: 'CPR/IPMR/533 contract performance reporting.' },
  ],
  'record-to-report': [
    { name: 'General Ledger & Financial Close', domain: 'Finance', description: 'GL accounting, period close, and consolidations.' },
    { name: 'Cost Center & Overhead Accounting', domain: 'Finance', description: 'Cost center planning, allocations, and overhead.' },
    { name: 'Indirect Rates & Costing Sheets', domain: 'Finance', description: 'Forward pricing rates, costing sheets, and pools.' },
    { name: 'Project Cost Settlement', domain: 'Finance', description: 'WBS/project actuals collection and settlement.' },
    { name: 'Revenue Recognition (ASC 606 / RA)', domain: 'Finance', description: 'POC/POB revenue recognition and results analysis.' },
    { name: 'Incurred Cost & DCAA Compliance', domain: 'Compliance', description: 'Incurred cost submissions and DCAA audit readiness.' },
    { name: 'Financial & Group Reporting', domain: 'Reporting', description: 'Statutory, management, and group reporting.' },
  ],
  'hire-to-retire': [
    { name: 'Talent Acquisition & Onboarding', domain: 'Workforce', description: 'Recruiting, hiring, and new-hire onboarding.' },
    { name: 'Security Clearance Management', domain: 'Clearances', description: 'Clearance eligibility, tracking, and access control.' },
    { name: 'Time & Attendance (Compliant Timekeeping)', domain: 'Workforce', description: 'DCAA-compliant labor recording and approval.' },
    { name: 'Payroll Processing', domain: 'Workforce', description: 'Gross-to-net payroll and statutory filings.' },
    { name: 'Labor Distribution & CATS', domain: 'Workforce', description: 'Labor charging, distribution, and timesheet transfer.' },
    { name: 'Offboarding & Records Retention', domain: 'Workforce', description: 'Separation processing and personnel records retention.' },
  ],
}
