// ─── Standard capability map (per value stream) ────────
// A deterministic, best-practice A&D capability set for each canonical workstream
// (workstream/catalog.ts). Powers the Capability Map "Seed standard" action: one
// curated capability map per stream, keyed by the workstream `code`. No AI —
// stable and reproducible. Keys are the canonical Solution Studio codes.

export interface StandardCapabilityDef {
  name: string
  domain?: string
  description?: string
}

export const STANDARD_CAPABILITIES: Record<string, StandardCapabilityDef[]> = {
  'record-to-report': [
    { name: 'General Ledger & Financial Close', domain: 'Finance', description: 'GL accounting, period close, and consolidations.' },
    { name: 'Cost Center & Overhead Accounting', domain: 'Finance', description: 'Cost center planning, allocations, and overhead.' },
    { name: 'Indirect Rates & Costing Sheets', domain: 'Finance', description: 'Forward pricing rates, costing sheets, and pools.' },
    { name: 'Project Cost Settlement', domain: 'Finance', description: 'WBS/project actuals collection and settlement.' },
    { name: 'Revenue Recognition (ASC 606 / RA)', domain: 'Finance', description: 'POC/POB revenue recognition and results analysis.' },
    { name: 'Incurred Cost & DCAA Compliance', domain: 'Compliance', description: 'Incurred cost submissions and DCAA audit readiness.' },
    { name: 'Financial & Group Reporting', domain: 'Reporting', description: 'Statutory, management, and group reporting.' },
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
  // plan-to-produce now also covers the former design-to-release (Engineering / PLM).
  'plan-to-produce': [
    { name: 'Requirements Management', domain: 'Engineering', description: 'Requirements capture, allocation, and traceability.' },
    { name: 'Design & Model Management', domain: 'PLM', description: 'CAD/MBSE design data and document management.' },
    { name: 'Configuration Management', domain: 'PLM', description: 'Baselines, effectivity, and configuration control.' },
    { name: 'Engineering Change Management', domain: 'PLM', description: 'ECR/ECO/ECN change request and disposition.' },
    { name: 'BOM Management & Release', domain: 'Engineering', description: 'Engineering and manufacturing BOM release.' },
    { name: 'Production Planning & Scheduling', domain: 'Manufacturing', description: 'Master production scheduling and capacity planning.' },
    { name: 'Material Requirements Planning (MRP)', domain: 'Manufacturing', description: 'Demand-driven material and component planning.' },
    { name: 'Shop Floor Execution', domain: 'Manufacturing', description: 'Production order release, confirmation, and dispatch.' },
    { name: 'Quality Management & Inspection (incl. FAI)', domain: 'Quality', description: 'In-process and AS9102 first article inspection, NCM.' },
    { name: 'Production Order Settlement', domain: 'Finance', description: 'Order cost collection and settlement to WBS/project.' },
  ],
  // inventory-to-deliver now also covers the former acquire-to-retire (property)
  // and sustainment-mro (depot/field MRO).
  'inventory-to-deliver': [
    { name: 'Inbound Logistics & Goods Receipt', domain: 'Logistics', description: 'Receiving, inspection, and goods receipt.' },
    { name: 'Warehouse & Inventory Management', domain: 'Logistics', description: 'Stock management, traceability, and physical inventory.' },
    { name: 'Outbound Delivery & DD250 Shipping', domain: 'Logistics', description: 'Picking, packing, delivery, and DD250 acceptance.' },
    { name: 'Government & Contractor Property (GFP/CAP)', domain: 'Property', description: 'Property accountability, custody, and reporting.' },
    { name: 'Asset Acquisition & Capitalization', domain: 'Finance', description: 'Capital asset acquisition and capitalization.' },
    { name: 'Property Disposition & Retirement', domain: 'Property', description: 'Disposal, retirement, and end-of-life accountability.' },
    { name: 'Maintenance Planning & Scheduling', domain: 'Sustainment', description: 'Preventive and corrective maintenance planning.' },
    { name: 'Work Order Execution (Depot/Field)', domain: 'Sustainment', description: 'Work order dispatch, execution, and confirmation.' },
    { name: 'Repair & Overhaul (Refurbishment)', domain: 'Sustainment', description: 'Teardown, repair, and refurbishment production.' },
    { name: 'Spares & Service Parts Management', domain: 'Supply Chain', description: 'Spares provisioning and service parts inventory.' },
    { name: 'Warranty & Service Contracts', domain: 'Service', description: 'Warranty claims and service agreement management.' },
  ],
  'source-to-pay': [
    { name: 'Supplier Qualification & Management', domain: 'Procurement', description: 'Supplier onboarding, qualification, and performance.' },
    { name: 'Sourcing & Solicitation (RFx)', domain: 'Sourcing', description: 'RFQ/RFP sourcing events and award decisions.' },
    { name: 'Subcontract Management & Flowdowns', domain: 'Subcontracts', description: 'Subcontract administration with clause flowdowns.' },
    { name: 'Purchase Requisition & Ordering', domain: 'Procurement', description: 'Requisition-to-PO processing and approvals.' },
    { name: 'Goods & Service Receipt', domain: 'Supply Chain', description: 'Receiving, inspection, and service entry.' },
    { name: 'Accounts Payable & 3-Way Match', domain: 'Finance', description: 'Invoice verification, matching, and payment.' },
  ],
  // offer-to-cash now covers the former bid-to-win (capture) and
  // contract-to-closeout (acquisition / billing) streams.
  'offer-to-cash': [
    { name: 'Opportunity Identification & Qualification', domain: 'Capture', description: 'Pipeline intake, gate reviews, and qualification of pursuits.' },
    { name: 'Capture Management & Win Strategy', domain: 'Capture', description: 'Customer engagement, competitive analysis, and win themes.' },
    { name: 'Proposal Management', domain: 'Proposal', description: 'Volume planning, compliance matrix, color teams, and submission.' },
    { name: 'Basis of Estimate & Price-to-Win', domain: 'Estimating', description: 'BOE, certified cost/pricing data, and should-cost modeling.' },
    { name: 'Award Setup & CLIN/SLIN Structure', domain: 'Contracts', description: 'Contract loading with CLIN/SLIN/ELIN and ACRN structure.' },
    { name: 'Funding & ACRN Management', domain: 'Contracts', description: 'Obligation tracking and limitation-of-funds management.' },
    { name: 'Contract Modifications', domain: 'Contracts', description: 'SF-30 modifications, definitization, and option exercise.' },
    { name: 'CDRL & Deliverables Management', domain: 'Deliverables', description: 'CDRL/SDRL scheduling, DD250 acceptance, and submittals.' },
    { name: 'Billing & Invoicing (PBP / WAWF)', domain: 'Billing', description: 'Progress, milestone, and PBP billing with WAWF submission.' },
    { name: 'Revenue Recognition (ASC 606 / RA)', domain: 'Finance', description: 'Sell-side POC/POB revenue recognition and results analysis.' },
    { name: 'Contract Closeout', domain: 'Closeout', description: 'Final invoice, release of claims, and DCAA closeout.' },
  ],
  'hire-to-retire': [
    { name: 'Talent Acquisition & Onboarding', domain: 'Workforce', description: 'Recruiting, hiring, and new-hire onboarding.' },
    { name: 'Security Clearance Management', domain: 'Clearances', description: 'Clearance eligibility, tracking, and access control.' },
    { name: 'Time & Attendance (Compliant Timekeeping)', domain: 'Workforce', description: 'DCAA-compliant labor recording and approval.' },
    { name: 'Payroll Processing', domain: 'Workforce', description: 'Gross-to-net payroll and statutory filings.' },
    { name: 'Labor Distribution & CATS', domain: 'Workforce', description: 'Labor charging, distribution, and timesheet transfer.' },
    { name: 'Offboarding & Records Retention', domain: 'Workforce', description: 'Separation processing and personnel records retention.' },
  ],
  // ─── Cross-cutting platform agents ─────────────────────
  'security-authorization': [
    { name: 'Role Design & PFCG Administration', domain: 'Security', description: 'Single/composite role design and PFCG maintenance.' },
    { name: 'Authorization Objects & SU24', domain: 'Security', description: 'Authorization object and SU24 default management.' },
    { name: 'Segregation of Duties (SoD) Controls', domain: 'GRC', description: 'SoD ruleset, conflict analysis, and mitigation.' },
    { name: 'User Provisioning & Access Requests', domain: 'Security', description: 'Access request, approval, and provisioning workflow.' },
    { name: 'Access Certification & Audit', domain: 'GRC', description: 'Periodic access review, certification, and audit support.' },
  ],
  'analytics-reporting': [
    { name: 'Embedded Analytics & CDS Queries', domain: 'Analytics', description: 'Analytical CDS views and embedded query browser.' },
    { name: 'Operational & Management Reporting', domain: 'Reporting', description: 'Operational reports and management dashboards.' },
    { name: 'Analytical Models & KPIs', domain: 'Analytics', description: 'KPI definition, analytical models, and data marts.' },
    { name: 'Dashboards & Data Visualization', domain: 'Analytics', description: 'SAC stories, dashboards, and visualizations.' },
    { name: 'Planning & Group Reporting', domain: 'Reporting', description: 'Planning models and consolidated group reporting.' },
  ],
  'development-technology': [
    { name: 'RICEFW Backlog & Build', domain: 'Development', description: 'Reports, interfaces, conversions, enhancements, forms, workflow.' },
    { name: 'RAP & Clean-Core Extensions', domain: 'Development', description: 'RAP business objects and clean-core key-user/developer extensions.' },
    { name: 'CDS & Data Modeling', domain: 'Development', description: 'CDS views, data models, and analytical/consumption layers.' },
    { name: 'OData / Gateway Services', domain: 'Integration', description: 'OData V2/V4 service definitions and bindings.' },
    { name: 'Integration & Middleware', domain: 'Integration', description: 'APIs, events, IDocs, and middleware connectivity.' },
    { name: 'BTP & Side-by-Side Extensions', domain: 'Platform', description: 'BTP services and side-by-side extension applications.' },
  ],
}
