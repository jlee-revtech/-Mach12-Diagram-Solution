// ─── Standard capability map (per value stream) ────────
// A deterministic, best-practice A&D capability set for each canonical workstream
// (workstream/catalog.ts). Powers the Capability Map "Seed standard" action: one
// curated capability map per stream, keyed by the workstream `code`. No AI —
// stable and reproducible. Keys are the canonical Solution Studio codes.
//
// Two-tier model (mirrors an L1 -> L2 -> L3 A&D capability taxonomy):
//   • workstream code         = L1 value stream
//   • CapabilityGroup.name    = L2 capability group  (action-verb led: "Manage…", "Operate…")
//   • SubCapability.name      = L3 granular capability (action-verb led: "Post…", "Calculate…")
// When seeded, each L3 sub-capability becomes one capability row whose `domain`
// carries its L2 group, so the board renders the group as a sub-header.

export interface SubCapability {
  name: string
  description?: string
}

export interface CapabilityGroup {
  name: string            // L2 — action-verb-led capability group
  description?: string    // group intent (reference only; not seeded as a row)
  children: SubCapability[]
}

export const STANDARD_CAPABILITIES: Record<string, CapabilityGroup[]> = {
  'record-to-report': [
    {
      name: 'Manage General Ledger & Financial Close',
      description: 'GL accounting, period close, and consolidations.',
      children: [
        { name: 'Post and Park Journal Entries', description: 'Manual, recurring, and accrual journal postings.' },
        { name: 'Run Period-End and Year-End Close', description: 'Open/close periods and execute close steps.' },
        { name: 'Reconcile Sub-Ledgers and Clearing Accounts', description: 'GL-to-sub-ledger and open-item reconciliation.' },
        { name: 'Perform Intercompany Eliminations and Consolidations', description: 'IC matching and group consolidation.' },
      ],
    },
    {
      name: 'Operate Cost Center & Overhead Accounting',
      description: 'Cost center planning, allocations, and overhead.',
      children: [
        { name: 'Plan Cost Center Budgets and Rates', description: 'Plan primary costs and activity rates.' },
        { name: 'Allocate Overhead via Assessments and Distributions', description: 'Periodic cost allocation cycles.' },
        { name: 'Apply Activity Types and Internal Allocations', description: 'Internal activity allocation and charging.' },
        { name: 'Analyze Cost Center Variances', description: 'Plan/actual variance and absorption analysis.' },
      ],
    },
    {
      name: 'Maintain Indirect Rates & Costing Sheets',
      description: 'Forward pricing rates, costing sheets, and pools.',
      children: [
        { name: 'Build Forward Pricing Rate Proposals', description: 'FPRP/FPRA indirect rate development.' },
        { name: 'Configure Costing Sheets and Overhead Pools', description: 'Pool/base structures and overhead keys.' },
        { name: 'Calculate Provisional and Final Billing Rates', description: 'Provisional and actual rate calculation.' },
        { name: 'Reconcile Actual to Provisional Rates', description: 'Year-end rate true-up and adjustments.' },
      ],
    },
    {
      name: 'Settle Project & Contract Costs',
      description: 'WBS/project actuals collection and settlement.',
      children: [
        { name: 'Collect WBS and Project Actuals', description: 'Gather actual costs on project objects.' },
        { name: 'Run Periodic Settlement to Receivers', description: 'Settle costs to defined receivers.' },
        { name: 'Settle to AuC and Final Cost Objects', description: 'Capitalize and finalize cost settlement.' },
      ],
    },
    {
      name: 'Recognize Revenue (ASC 606 / RA)',
      description: 'POC/POB revenue recognition and results analysis.',
      children: [
        { name: 'Calculate POC and POB Recognition', description: 'Percent-complete and obligation-based recognition.' },
        { name: 'Post and Adjust Results Analysis', description: 'RA postings, reserves, and adjustments.' },
        { name: 'Manage Deferred Revenue and Unbilled Positions', description: 'Track unbilled receivables and deferrals.' },
      ],
    },
    {
      name: 'Manage Incurred Cost & DCAA Compliance',
      description: 'Incurred cost submissions and DCAA audit readiness.',
      children: [
        { name: 'Prepare Incurred Cost Submissions (ICE)', description: 'Annual incurred cost electronic submission.' },
        { name: 'Maintain DCAA Audit Trails and Support', description: 'Audit-ready documentation and traceability.' },
        { name: 'Reconcile Final Indirect Cost Pools', description: 'Close out and reconcile indirect pools.' },
      ],
    },
    {
      name: 'Produce Financial & Group Reporting',
      description: 'Statutory, management, and group reporting.',
      children: [
        { name: 'Generate Statutory and Management Reports', description: 'Legal and internal financial statements.' },
        { name: 'Consolidate Group Financial Statements', description: 'Group close and consolidated reporting.' },
        { name: 'Publish Close Dashboards and KPIs', description: 'Close status and financial KPI dashboards.' },
      ],
    },
  ],
  'plan-to-perform': [
    {
      name: 'Manage Integrated Master Schedule (IMS)',
      description: 'Network schedule, critical path, and schedule health.',
      children: [
        { name: 'Build Network Schedule and Logic', description: 'Activities, dependencies, and constraints.' },
        { name: 'Calculate Critical Path and Float', description: 'Critical path, total float, and free float.' },
        { name: 'Assess Schedule Health (DCMA 14-Point)', description: 'Schedule quality and health metrics.' },
        { name: 'Maintain Schedule Baselines', description: 'Baseline, snapshot, and re-baseline the IMS.' },
      ],
    },
    {
      name: 'Establish Performance Measurement Baseline (PMB)',
      description: 'Time-phased budget baseline and control accounts.',
      children: [
        { name: 'Time-Phase the Budget Baseline', description: 'Spread budget across the period of performance.' },
        { name: 'Define Control Accounts and Work Packages', description: 'CA/WP decomposition and budgets.' },
        { name: 'Manage Baseline Changes and Replanning', description: 'BCR processing and authorized replanning.' },
      ],
    },
    {
      name: 'Authorize Work & Control Accounts',
      description: 'Work authorization documents and CAM assignment.',
      children: [
        { name: 'Issue Work Authorization Documents', description: 'Authorize scope, budget, and schedule.' },
        { name: 'Assign Control Account Managers (CAMs)', description: 'Map CAMs to control accounts.' },
        { name: 'Maintain the Responsibility Assignment Matrix', description: 'OBS/WBS RAM intersections.' },
      ],
    },
    {
      name: 'Measure Earned Value & Variances',
      description: 'BCWS/BCWP/ACWP, CPI/SPI, and variance reporting.',
      children: [
        { name: 'Capture BCWS, BCWP, and ACWP', description: 'Planned, earned, and actual value.' },
        { name: 'Calculate CPI, SPI, and Variances', description: 'Cost/schedule indices and variances.' },
        { name: 'Document Variance Analysis Narratives', description: 'Root cause, impact, and corrective action.' },
      ],
    },
    {
      name: 'Forecast Estimate at Completion (EAC/ETC)',
      description: 'Forecasting, EAC scenarios, and to-complete analysis.',
      children: [
        { name: 'Model EAC Scenarios and Methods', description: 'Statistical and bottoms-up EAC methods.' },
        { name: 'Develop To-Complete (ETC) Estimates', description: 'Estimate remaining cost and effort.' },
        { name: 'Calculate TCPI and Reconcile Forecasts', description: 'To-complete performance index analysis.' },
      ],
    },
    {
      name: 'Manage Risk & Opportunity',
      description: 'Risk register, handling plans, and burn-down.',
      children: [
        { name: 'Maintain the Risk and Opportunity Register', description: 'Identify, score, and rank risks.' },
        { name: 'Develop Handling and Mitigation Plans', description: 'Avoid, transfer, mitigate, or accept.' },
        { name: 'Track Risk Burn-Down and Exposure', description: 'Monitor exposure and mitigation progress.' },
      ],
    },
    {
      name: 'Report Program Performance (IPMR / 533)',
      description: 'CPR/IPMR/533 contract performance reporting.',
      children: [
        { name: 'Generate IPMR Formats 1 to 7', description: 'Contract performance report formats.' },
        { name: 'Produce NASA 533 Reporting', description: '533M/533Q financial management reports.' },
        { name: 'Publish Program Performance Dashboards', description: 'EVM dashboards and trend analysis.' },
      ],
    },
  ],
  'design-to-release': [
    {
      name: 'Manage Requirements',
      description: 'Requirements capture, allocation, and traceability.',
      children: [
        { name: 'Capture and Decompose Requirements', description: 'Elicit and break down requirements.' },
        { name: 'Allocate Requirements to Design', description: 'Map requirements to design elements.' },
        { name: 'Trace Requirements Verification', description: 'Verification and validation traceability.' },
      ],
    },
    {
      name: 'Manage Design & Models',
      description: 'CAD/MBSE design data and document management.',
      children: [
        { name: 'Control CAD and MBSE Design Data', description: 'Manage design models and structures.' },
        { name: 'Manage Engineering Documents and Revisions', description: 'Document vault and revision control.' },
        { name: 'Release Design Artifacts', description: 'Promote and release design deliverables.' },
      ],
    },
    {
      name: 'Control Configuration',
      description: 'Baselines, effectivity, and configuration control.',
      children: [
        { name: 'Establish Configuration Baselines', description: 'Functional, allocated, and product baselines.' },
        { name: 'Manage Effectivity and Serialization', description: 'Date/serial effectivity control.' },
        { name: 'Conduct Configuration Audits (FCA/PCA)', description: 'Functional and physical configuration audits.' },
      ],
    },
    {
      name: 'Process Engineering Changes',
      description: 'ECR/ECO/ECN change request and disposition.',
      children: [
        { name: 'Raise Change Requests (ECR)', description: 'Initiate and justify engineering changes.' },
        { name: 'Disposition Change Orders (ECO/ECN)', description: 'Review, approve, and release changes.' },
        { name: 'Implement and Verify Change Incorporation', description: 'Apply and confirm change effectivity.' },
      ],
    },
    {
      name: 'Manage & Release BOMs',
      description: 'Engineering and manufacturing BOM release.',
      children: [
        { name: 'Maintain Engineering BOM (eBOM)', description: 'Author and revise the engineering BOM.' },
        { name: 'Transform to Manufacturing BOM (mBOM)', description: 'eBOM-to-mBOM restructure.' },
        { name: 'Release BOM Revisions to Production', description: 'Release controlled BOM versions.' },
      ],
    },
    {
      name: 'Perform First Article Inspection (FAI)',
      description: 'AS9102 first article inspection and approval.',
      children: [
        { name: 'Plan AS9102 First Article Inspections', description: 'Define FAI scope and characteristics.' },
        { name: 'Record Inspection Results and Balloon Drawings', description: 'Capture FAI measurements and ballooning.' },
        { name: 'Approve First Article Dispositions', description: 'Accept or reject the first article.' },
      ],
    },
  ],
  'plan-to-produce': [
    {
      name: 'Plan & Schedule Production',
      description: 'Master production scheduling and capacity planning.',
      children: [
        { name: 'Build the Master Production Schedule', description: 'MPS demand and supply planning.' },
        { name: 'Plan Capacity and Level Loads', description: 'Capacity evaluation and leveling.' },
        { name: 'Sequence and Dispatch Production', description: 'Order sequencing and dispatch lists.' },
      ],
    },
    {
      name: 'Run Material Requirements Planning (MRP)',
      description: 'Demand-driven material and component planning.',
      children: [
        { name: 'Execute MRP and Net Requirements', description: 'Run MRP and net demand against supply.' },
        { name: 'Convert Planned to Production Orders', description: 'Firm and convert planned orders.' },
        { name: 'Manage Exception Messages and Reschedule', description: 'Action MRP exceptions and reschedules.' },
      ],
    },
    {
      name: 'Execute Shop Floor Operations',
      description: 'Production order release, confirmation, and dispatch.',
      children: [
        { name: 'Release and Print Production Orders', description: 'Release orders and shop papers.' },
        { name: 'Confirm Operations and Labor', description: 'Confirm time and operation completion.' },
        { name: 'Backflush and Report Component Usage', description: 'Auto goods issue of components.' },
      ],
    },
    {
      name: 'Manage Quality & Inspection',
      description: 'In-process inspection, non-conformance, and quality records.',
      children: [
        { name: 'Plan In-Process and Final Inspections', description: 'Inspection plans and characteristics.' },
        { name: 'Record Inspection Results and Usage Decisions', description: 'Results recording and UD.' },
        { name: 'Process Nonconformances and Corrective Actions', description: 'NCR and CAPA handling.' },
      ],
    },
    {
      name: 'Move Inventory & Goods',
      description: 'Goods receipt/issue, stock management, and traceability.',
      children: [
        { name: 'Post Goods Receipts and Issues', description: 'GR/GI against orders and reservations.' },
        { name: 'Manage Stock Transfers and Reservations', description: 'Transfer postings and reservations.' },
        { name: 'Maintain Batch and Serial Traceability', description: 'Batch/serial assignment and genealogy.' },
      ],
    },
    {
      name: 'Settle Production Orders',
      description: 'Order cost collection and settlement to WBS/project.',
      children: [
        { name: 'Collect Order Costs and WIP', description: 'Accumulate actuals and work in process.' },
        { name: 'Calculate Production Variances', description: 'Price, quantity, and scrap variances.' },
        { name: 'Settle Orders to Receivers', description: 'Settle to WBS, asset, or stock.' },
      ],
    },
  ],
  'inventory-to-deliver': [
    {
      name: 'Receive Inbound Goods',
      description: 'Receiving, inspection, and goods receipt.',
      children: [
        { name: 'Process Inbound Deliveries and ASNs', description: 'Inbound delivery and advance ship notices.' },
        { name: 'Inspect and Post Goods Receipts', description: 'Receiving inspection and GR posting.' },
        { name: 'Put Away Stock to Storage Bins', description: 'Putaway strategies and bin placement.' },
      ],
    },
    {
      name: 'Manage Warehouse & Inventory',
      description: 'Stock management, bin/warehouse (EWM), and traceability.',
      children: [
        { name: 'Maintain Stock by Bin and Storage Type (EWM)', description: 'Bin-level warehouse stock management.' },
        { name: 'Execute Stock Transfers and Replenishment', description: 'Internal moves and replenishment.' },
        { name: 'Monitor Inventory Accuracy and Aging', description: 'Stock accuracy and aging analysis.' },
      ],
    },
    {
      name: 'Ship Outbound & Process DD250',
      description: 'Picking, packing, delivery, and DD250 acceptance.',
      children: [
        { name: 'Pick, Pack, and Stage Deliveries', description: 'Outbound picking and packing.' },
        { name: 'Post Goods Issue and Create Shipments', description: 'GI posting and shipment creation.' },
        { name: 'Generate DD250 / WAWF Acceptance', description: 'Material acceptance and WAWF submission.' },
      ],
    },
    {
      name: 'Perform Physical Inventory',
      description: 'Physical inventory, cycle counts, and reconciliation.',
      children: [
        { name: 'Plan Cycle Counts and Physical Inventory', description: 'Count scheduling and documents.' },
        { name: 'Record Counts and Recounts', description: 'Enter and recount inventory.' },
        { name: 'Reconcile and Post Inventory Differences', description: 'Approve and post adjustments.' },
      ],
    },
    {
      name: 'Manage Handling Units & Packaging',
      description: 'Handling unit management and packaging specifications.',
      children: [
        { name: 'Create and Assign Handling Units', description: 'Pack into nested handling units.' },
        { name: 'Apply Packaging Specifications and Instructions', description: 'Packaging rules and instructions.' },
        { name: 'Print Packaging and Shipping Labels', description: 'HU and shipping label output.' },
      ],
    },
    {
      name: 'Maintain Batch & Serial Traceability',
      description: 'Batch and serial number genealogy and traceability.',
      children: [
        { name: 'Assign Batches and Serial Numbers', description: 'Batch/serial creation and assignment.' },
        { name: 'Record As-Built and Genealogy Records', description: 'As-built configuration capture.' },
        { name: 'Trace Forward and Backward Genealogy', description: 'Where-used and where-from tracing.' },
      ],
    },
  ],
  'acquire-to-retire': [
    {
      name: 'Manage Government & Contractor Property',
      description: 'Property accountability, custody, and reporting.',
      children: [
        { name: 'Receive and Account for GFP/CAP', description: 'Government and contractor-acquired property.' },
        { name: 'Maintain Custody and Accountability Records', description: 'Custodial records and stewardship.' },
        { name: 'Report Property per FAR 52.245-1', description: 'Property management system reporting.' },
      ],
    },
    {
      name: 'Acquire & Capitalize Assets',
      description: 'Capital asset acquisition and capitalization.',
      children: [
        { name: 'Create Asset Under Construction (AuC)', description: 'Set up AuC for capital projects.' },
        { name: 'Settle Costs and Capitalize Assets', description: 'Settle AuC to final assets.' },
        { name: 'Assign Asset Classes and Useful Lives', description: 'Classify assets and depreciation terms.' },
      ],
    },
    {
      name: 'Track Asset Custody',
      description: 'Physical asset tracking, transfers, and audits.',
      children: [
        { name: 'Tag and Locate Physical Assets', description: 'Asset tagging and location tracking.' },
        { name: 'Process Asset Transfers and Moves', description: 'Inter/intra-company asset transfers.' },
        { name: 'Conduct Periodic Asset Audits', description: 'Physical asset verification.' },
      ],
    },
    {
      name: 'Manage Depreciation & Asset Accounting',
      description: 'Depreciation, revaluation, and asset accounting.',
      children: [
        { name: 'Run Depreciation and Revaluation', description: 'Periodic depreciation posting runs.' },
        { name: 'Post Asset Acquisitions and Adjustments', description: 'Acquisition, retirement, and adjustments.' },
        { name: 'Reconcile Asset Sub-Ledger to GL', description: 'Asset-to-GL reconciliation.' },
      ],
    },
    {
      name: 'Dispose & Retire Property',
      description: 'Disposal, retirement, and end-of-life accountability.',
      children: [
        { name: 'Initiate Disposition and Retirement', description: 'Request and approve disposal.' },
        { name: 'Process Scrap, Sale, and Transfer', description: 'Execute retirement transactions.' },
        { name: 'Update Accountability and Close Records', description: 'Final accountability updates.' },
      ],
    },
  ],
  'sustainment-mro': [
    {
      name: 'Plan & Schedule Maintenance',
      description: 'Preventive and corrective maintenance planning.',
      children: [
        { name: 'Build Preventive Maintenance Plans', description: 'Time/usage-based maintenance plans.' },
        { name: 'Generate Maintenance Call Objects', description: 'Schedule and trigger maintenance.' },
        { name: 'Schedule and Assign Maintenance Work', description: 'Work scheduling and assignment.' },
      ],
    },
    {
      name: 'Execute Work Orders (Depot/Field)',
      description: 'Work order dispatch, execution, and confirmation.',
      children: [
        { name: 'Create and Release Maintenance Orders', description: 'Order creation and release.' },
        { name: 'Dispatch and Confirm Work', description: 'Assign and confirm labor/operations.' },
        { name: 'Record Findings and Completions', description: 'Capture findings and technical completion.' },
      ],
    },
    {
      name: 'Repair & Overhaul Components',
      description: 'Teardown, repair, and refurbishment production.',
      children: [
        { name: 'Induct and Tear Down Units', description: 'Receive and disassemble for repair.' },
        { name: 'Plan Repair Routings and Disposition', description: 'Repair scope and disposition.' },
        { name: 'Refurbish and Return to Stock', description: 'Overhaul and return serviceable.' },
      ],
    },
    {
      name: 'Manage Installed Base & Equipment',
      description: 'Equipment, serial, and installed-base records.',
      children: [
        { name: 'Maintain Equipment and Functional Locations', description: 'Technical object master data.' },
        { name: 'Track Serialized Installed Base', description: 'Serialized fleet/installed base.' },
        { name: 'Record As-Maintained Configuration', description: 'Configuration and status capture.' },
      ],
    },
    {
      name: 'Manage Spares & Service Parts',
      description: 'Spares provisioning and service parts inventory.',
      children: [
        { name: 'Provision Spares and Stocking Levels', description: 'Spares provisioning and stocking.' },
        { name: 'Plan Service Parts Demand', description: 'Service parts demand planning.' },
        { name: 'Manage Rotable and Repairable Pools', description: 'Rotable pool and exchange management.' },
      ],
    },
    {
      name: 'Administer Warranty & Service Contracts',
      description: 'Warranty claims and service agreement management.',
      children: [
        { name: 'Manage Warranty Terms and Entitlements', description: 'Warranty master and entitlements.' },
        { name: 'Process Warranty Claims', description: 'Submit and settle warranty claims.' },
        { name: 'Administer Service and PBL Agreements', description: 'Service and performance-based logistics.' },
      ],
    },
  ],
  'source-to-pay': [
    {
      name: 'Qualify & Manage Suppliers',
      description: 'Supplier onboarding, qualification, and performance.',
      children: [
        { name: 'Onboard and Qualify Suppliers', description: 'Supplier registration and qualification.' },
        { name: 'Maintain Supplier Master and Approvals', description: 'Vendor master and approval status.' },
        { name: 'Evaluate Supplier Performance', description: 'Scorecards and performance ratings.' },
      ],
    },
    {
      name: 'Source & Solicit (RFx)',
      description: 'RFQ/RFP sourcing events and award decisions.',
      children: [
        { name: 'Create RFQ/RFP Sourcing Events', description: 'Build and issue solicitations.' },
        { name: 'Evaluate Bids and Quotations', description: 'Compare and score supplier responses.' },
        { name: 'Award and Document Source Selection', description: 'Award decision and rationale.' },
      ],
    },
    {
      name: 'Manage Subcontracts & Flowdowns',
      description: 'Subcontract administration with clause flowdowns.',
      children: [
        { name: 'Administer Subcontract Agreements', description: 'Subcontract setup and administration.' },
        { name: 'Apply Clause Flowdowns (FAR/DFARS)', description: 'Flow prime clauses to subcontracts.' },
        { name: 'Track Subcontractor Performance and Deliverables', description: 'Monitor sub deliverables and status.' },
      ],
    },
    {
      name: 'Requisition & Order',
      description: 'Requisition-to-PO processing and approvals.',
      children: [
        { name: 'Create Purchase Requisitions', description: 'Catalog and free-text requisitions.' },
        { name: 'Approve and Convert to Purchase Orders', description: 'Release and convert requisitions.' },
        { name: 'Manage Order Changes and Confirmations', description: 'PO changes and order confirmations.' },
      ],
    },
    {
      name: 'Receive Goods & Services',
      description: 'Receiving, inspection, and service entry.',
      children: [
        { name: 'Post Goods Receipts', description: 'GR against purchase orders.' },
        { name: 'Enter Service Entry Sheets', description: 'Service confirmation and acceptance.' },
        { name: 'Inspect and Accept Receipts', description: 'Receiving inspection and acceptance.' },
      ],
    },
    {
      name: 'Process Accounts Payable',
      description: 'Invoice verification, matching, and payment.',
      children: [
        { name: 'Verify Invoices and 3-Way Match', description: 'Match PO, receipt, and invoice.' },
        { name: 'Resolve Invoice Discrepancies', description: 'Block, dispute, and resolve variances.' },
        { name: 'Run Payment Proposals and Runs', description: 'Schedule and execute payments.' },
      ],
    },
  ],
  // offer-to-cash also covers the former bid-to-win (capture) and
  // contract-to-closeout (acquisition / billing) streams.
  'offer-to-cash': [
    {
      name: 'Identify & Qualify Opportunities',
      description: 'Pipeline intake, gate reviews, and qualification of pursuits.',
      children: [
        { name: 'Intake and Screen Pipeline Opportunities', description: 'Capture and screen new pursuits.' },
        { name: 'Conduct Gate and Bid/No-Bid Reviews', description: 'Stage-gate and bid decisions.' },
        { name: 'Qualify Pursuits and Assess pWin', description: 'Qualification and probability of win.' },
      ],
    },
    {
      name: 'Manage Capture & Win Strategy',
      description: 'Customer engagement, competitive analysis, and win themes.',
      children: [
        { name: 'Develop Customer and Competitor Intelligence', description: 'Customer and competitive insight.' },
        { name: 'Shape Win Themes and Discriminators', description: 'Differentiators and win themes.' },
        { name: 'Plan Capture and Call Plans', description: 'Capture plan and customer call plan.' },
      ],
    },
    {
      name: 'Manage Proposals',
      description: 'Volume planning, compliance matrix, color teams, and submission.',
      children: [
        { name: 'Plan Volumes and Compliance Matrix', description: 'Outline, compliance, and assignments.' },
        { name: 'Run Color Team Reviews', description: 'Pink, red, and gold team reviews.' },
        { name: 'Assemble and Submit Proposals', description: 'Production and submission.' },
      ],
    },
    {
      name: 'Develop Basis of Estimate & Price-to-Win',
      description: 'BOE, certified cost/pricing data, and should-cost modeling.',
      children: [
        { name: 'Build Bases of Estimate (BOE)', description: 'Cost and labor estimating basis.' },
        { name: 'Model Should-Cost and Price-to-Win', description: 'Competitive pricing models.' },
        { name: 'Prepare Certified Cost or Pricing Data', description: 'TINA-compliant cost/pricing data.' },
      ],
    },
    {
      name: 'Set Up Awards & Contract Structure',
      description: 'Contract loading with CLIN/SLIN/ELIN and ACRN structure.',
      children: [
        { name: 'Load CLIN/SLIN/ELIN and ACRN Structure', description: 'Build the contract line structure.' },
        { name: 'Establish Billing and Delivery Terms', description: 'Billing plans and delivery terms.' },
        { name: 'Baseline the Contract Data', description: 'Lock the award baseline.' },
      ],
    },
    {
      name: 'Manage Funding & ACRN',
      description: 'Obligation tracking and limitation-of-funds management.',
      children: [
        { name: 'Record Obligations and Funding', description: 'Funding documents and obligations.' },
        { name: 'Track Limitation of Funds and Cost', description: 'LOF/LOC notice monitoring.' },
        { name: 'Allocate Costs to ACRNs', description: 'ACRN cost allocation and reporting.' },
      ],
    },
    {
      name: 'Process Contract Modifications',
      description: 'SF-30 modifications, definitization, and option exercise.',
      children: [
        { name: 'Issue SF-30 Modifications', description: 'Bilateral and unilateral modifications.' },
        { name: 'Definitize and Exercise Options', description: 'UCA definitization and option exercise.' },
        { name: 'Re-Baseline Scope and Value', description: 'Update scope, value, and schedule.' },
      ],
    },
    {
      name: 'Manage CDRL & Deliverables',
      description: 'CDRL/SDRL scheduling, DD250 acceptance, and submittals.',
      children: [
        { name: 'Schedule CDRL/SDRL Submittals', description: 'Deliverable schedules and recurrence.' },
        { name: 'Track Deliverable Status and Approvals', description: 'Submittal status and reviews.' },
        { name: 'Record DD250 Acceptance', description: 'Material/inspection acceptance.' },
      ],
    },
    {
      name: 'Bill & Invoice (PBP / WAWF)',
      description: 'Progress, milestone, and PBP billing with WAWF submission.',
      children: [
        { name: 'Generate Progress and Milestone Billing', description: 'Progress and milestone invoices.' },
        { name: 'Calculate Performance-Based Payments (PBP)', description: 'PBP event-based billing.' },
        { name: 'Submit Invoices via WAWF', description: 'Electronic invoice submission.' },
      ],
    },
    {
      name: 'Recognize Revenue (ASC 606 / RA)',
      description: 'Sell-side POC/POB revenue recognition and results analysis.',
      children: [
        { name: 'Calculate Sell-Side POC/POB Recognition', description: 'Contract revenue recognition.' },
        { name: 'Post and Adjust Sell-Side Results Analysis', description: 'RA postings and adjustments.' },
        { name: 'Manage Unbilled and Deferred Positions', description: 'Unbilled receivables and deferrals.' },
      ],
    },
    {
      name: 'Close Out Contracts',
      description: 'Final invoice, release of claims, and DCAA closeout.',
      children: [
        { name: 'Reconcile Final Costs and Rates', description: 'Final cost and rate true-up.' },
        { name: 'Process Release of Claims', description: 'Release of claims and final invoice.' },
        { name: 'Complete DCAA and Contract Closeout', description: 'Audit closeout and contract close.' },
      ],
    },
  ],
  'hire-to-retire': [
    {
      name: 'Acquire & Onboard Talent',
      description: 'Recruiting, hiring, and new-hire onboarding.',
      children: [
        { name: 'Manage Requisitions and Recruiting', description: 'Open reqs and source candidates.' },
        { name: 'Process Offers and Hires', description: 'Offer, accept, and hire actions.' },
        { name: 'Onboard New Employees', description: 'Onboarding tasks and provisioning.' },
      ],
    },
    {
      name: 'Manage Security Clearances',
      description: 'Clearance eligibility, tracking, and access control.',
      children: [
        { name: 'Track Clearance Eligibility and Status', description: 'Clearance levels and status.' },
        { name: 'Process Investigations and Adjudications', description: 'Investigation and adjudication.' },
        { name: 'Control Access by Clearance Level', description: 'Access gating by clearance.' },
      ],
    },
    {
      name: 'Record Time & Attendance',
      description: 'DCAA-compliant labor recording and approval.',
      children: [
        { name: 'Capture Compliant Timekeeping', description: 'Daily, total-time labor recording.' },
        { name: 'Route and Approve Timesheets', description: 'Timesheet approval workflow.' },
        { name: 'Manage Absences and Leave', description: 'Leave requests and balances.' },
      ],
    },
    {
      name: 'Process Payroll',
      description: 'Gross-to-net payroll and statutory filings.',
      children: [
        { name: 'Run Gross-to-Net Payroll', description: 'Calculate and run payroll.' },
        { name: 'Process Deductions and Benefits', description: 'Benefits and deduction processing.' },
        { name: 'File Statutory Payroll Reports', description: 'Tax and statutory filings.' },
      ],
    },
    {
      name: 'Distribute Labor & CATS',
      description: 'Labor charging, distribution, and timesheet transfer.',
      children: [
        { name: 'Charge Labor to Projects and WBS', description: 'Charge time to cost objects.' },
        { name: 'Transfer CATS to Controlling and Payroll', description: 'CATS transfer to CO/PY.' },
        { name: 'Reconcile Labor Distribution', description: 'Labor distribution reconciliation.' },
      ],
    },
    {
      name: 'Offboard & Retain Records',
      description: 'Separation processing and personnel records retention.',
      children: [
        { name: 'Process Separations and Exits', description: 'Termination and exit processing.' },
        { name: 'Revoke Access and Assets', description: 'De-provision access and recover assets.' },
        { name: 'Retain Personnel Records', description: 'Records retention and archival.' },
      ],
    },
  ],
  // ─── Cross-cutting platform agents ─────────────────────
  'security-authorization': [
    {
      name: 'Design Roles & Authorizations',
      description: 'Single/composite role design and PFCG maintenance.',
      children: [
        { name: 'Build Single and Composite Roles (PFCG)', description: 'Role design and maintenance.' },
        { name: 'Maintain Authorization Objects and SU24 Defaults', description: 'Auth objects and SU24.' },
        { name: 'Test and Trace Authorization Checks', description: 'Trace and validate authorizations.' },
      ],
    },
    {
      name: 'Manage Segregation of Duties (SoD)',
      description: 'SoD ruleset, conflict analysis, and mitigation.',
      children: [
        { name: 'Maintain the SoD Ruleset', description: 'Define and maintain SoD rules.' },
        { name: 'Analyze Access Conflicts', description: 'Detect and report conflicts.' },
        { name: 'Mitigate and Document Risks', description: 'Apply and document mitigations.' },
      ],
    },
    {
      name: 'Provision Users & Access',
      description: 'Access request, approval, and provisioning workflow.',
      children: [
        { name: 'Process Access Requests and Approvals', description: 'Request and approval workflow.' },
        { name: 'Provision and De-Provision Users', description: 'User lifecycle management.' },
        { name: 'Manage Emergency/Firefighter Access', description: 'Privileged access management.' },
      ],
    },
    {
      name: 'Certify & Audit Access',
      description: 'Periodic access review, certification, and audit support.',
      children: [
        { name: 'Run Periodic Access Reviews', description: 'Scheduled access reviews.' },
        { name: 'Certify Role and User Assignments', description: 'Attest assignments.' },
        { name: 'Support Audits and Remediation', description: 'Audit evidence and remediation.' },
      ],
    },
  ],
  'analytics-reporting': [
    {
      name: 'Build Embedded Analytics',
      description: 'Analytical CDS views and embedded query browser.',
      children: [
        { name: 'Model Analytical CDS Views', description: 'Cube and query CDS modeling.' },
        { name: 'Expose Queries to the Query Browser', description: 'Publish analytical queries.' },
        { name: 'Manage Analytical Authorizations', description: 'Analytics access control.' },
      ],
    },
    {
      name: 'Deliver Operational & Management Reporting',
      description: 'Operational reports and management dashboards.',
      children: [
        { name: 'Build Operational Reports', description: 'Day-to-day operational reports.' },
        { name: 'Publish Management Dashboards', description: 'Management dashboards.' },
        { name: 'Schedule and Distribute Reports', description: 'Report scheduling and bursting.' },
      ],
    },
    {
      name: 'Define Analytical Models & KPIs',
      description: 'KPI definition, analytical models, and data marts.',
      children: [
        { name: 'Define KPIs and Measures', description: 'KPI and measure definitions.' },
        { name: 'Build Analytical Models and Data Marts', description: 'Models and marts.' },
        { name: 'Govern Metric Definitions', description: 'Metric governance and lineage.' },
      ],
    },
    {
      name: 'Visualize Dashboards & Data',
      description: 'SAC stories, dashboards, and visualizations.',
      children: [
        { name: 'Author SAC Stories and Dashboards', description: 'Build SAC stories.' },
        { name: 'Design Visualizations and Drilldowns', description: 'Charts and drill paths.' },
        { name: 'Share and Embed Analytics', description: 'Distribute and embed.' },
      ],
    },
    {
      name: 'Run Planning & Group Reporting',
      description: 'Planning models and consolidated group reporting.',
      children: [
        { name: 'Build Planning Models and Forecasts', description: 'Planning and forecasting.' },
        { name: 'Run Consolidations and Eliminations', description: 'Group consolidation.' },
        { name: 'Produce Group Reporting Outputs', description: 'Group reporting deliverables.' },
      ],
    },
  ],
  'development-technology': [
    {
      name: 'Manage RICEFW Backlog & Build',
      description: 'Reports, interfaces, conversions, enhancements, forms, workflow.',
      children: [
        { name: 'Capture and Prioritize RICEFW Backlog', description: 'Backlog intake and prioritization.' },
        { name: 'Build Reports, Interfaces, and Forms', description: 'Develop RICEFW objects.' },
        { name: 'Test and Transport Developments', description: 'Unit test and transport.' },
      ],
    },
    {
      name: 'Build RAP & Clean-Core Extensions',
      description: 'RAP business objects and clean-core key-user/developer extensions.',
      children: [
        { name: 'Develop RAP Business Objects', description: 'Managed/unmanaged RAP BOs.' },
        { name: 'Build Key-User and Developer Extensions', description: 'In-app and on-stack extensions.' },
        { name: 'Govern Clean-Core Compliance', description: 'Clean-core and upgrade safety.' },
      ],
    },
    {
      name: 'Model CDS & Data',
      description: 'CDS views, data models, and analytical/consumption layers.',
      children: [
        { name: 'Design CDS Views and Data Models', description: 'Interface and basic CDS views.' },
        { name: 'Build Analytical and Consumption Layers', description: 'Consumption-ready CDS.' },
        { name: 'Manage Releases and Dependencies', description: 'Released APIs and dependencies.' },
      ],
    },
    {
      name: 'Expose OData & Gateway Services',
      description: 'OData V2/V4 service definitions and bindings.',
      children: [
        { name: 'Define OData V2/V4 Services', description: 'Service definitions.' },
        { name: 'Publish Service Bindings', description: 'Activate and publish bindings.' },
        { name: 'Manage Service Versions and Access', description: 'Versioning and access control.' },
      ],
    },
    {
      name: 'Integrate Systems & Middleware',
      description: 'APIs, events, IDocs, and middleware connectivity.',
      children: [
        { name: 'Build APIs, Events, and IDocs', description: 'Integration interfaces.' },
        { name: 'Configure Middleware Connectivity', description: 'Integration suite and CPI.' },
        { name: 'Monitor Interfaces and Errors', description: 'Interface monitoring and alerting.' },
      ],
    },
    {
      name: 'Extend on BTP (Side-by-Side)',
      description: 'BTP services and side-by-side extension applications.',
      children: [
        { name: 'Provision BTP Services', description: 'BTP service provisioning.' },
        { name: 'Build Side-by-Side Extension Apps', description: 'Extension applications.' },
        { name: 'Manage Destinations and Connectivity', description: 'Destinations and connectivity.' },
      ],
    },
  ],
}

// Flatten the two-tier standard set for a value stream into seedable rows.
// Each L3 sub-capability becomes one capability whose `domain` carries its L2 group.
export interface FlatStandardCapability {
  name: string          // L3 sub-capability
  group: string         // L2 capability group (-> capability.domain)
  description?: string
}

export function flattenStandardCapabilities(code: string): FlatStandardCapability[] {
  const groups = STANDARD_CAPABILITIES[code] ?? []
  const out: FlatStandardCapability[] = []
  for (const g of groups) {
    for (const child of g.children) {
      out.push({ name: child.name, group: g.name, description: child.description })
    }
  }
  return out
}
