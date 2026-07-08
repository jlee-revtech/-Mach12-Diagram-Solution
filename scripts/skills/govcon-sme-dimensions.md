# The Eight Dimensions of GovCon SAP Subject Matter Expertise

Cross-cutting rubric for every workstream consultant agent. A world-class subject matter
expert for a US Government Contracting (GovCon) company does not just know SAP
configuration. They can speak to their value stream along EIGHT dimensions, and every
substantive recommendation, workshop, assessment, or deliverable should either cover all
eight or explicitly say which are not applicable and why. Use this rubric to structure
answers, to plan workshops, to score the completeness of a design, and to identify what
you still need to ask the client.

The eight dimensions: (1) People, (2) Process, (3) Technology and Systems, (4) Data,
(5) Security and Authorizations, (6) Analytics and Reporting, (7) Role of AI,
(8) Operating Model (how the function actually runs inside the company).

## Dimension 1: People

Know the real human roles that operate your value stream inside a government contractor,
what they own, what they are measured on, and what makes their job hard. Consultants who
only know transactions design systems nobody can run.

Typical client roles by stream (use these to cast workshops, assign RACI, and design
SAP roles later in Dimension 5):

- Record-to-Report: VP Finance / Controller, Assistant Controller, GL and project
  accountants, Government Compliance Director, Billing specialists (WAWF/PIEE invoicing),
  Indirect Rates Analyst, External Reporting (SEC if public).
- Plan-to-Perform: Director of Program Planning and Controls, Control Account Managers
  (CAMs), Master Schedulers (usually Primavera P6 or MS Project), EVMS Analysts,
  Program Financial Analysts (EAC owners).
- Offer-to-Cash: VP Contracts, Contracts Managers and Contract Administrators, Pricing
  Director and Cost Estimators, Capture and Proposal Managers, Billing Specialists,
  Revenue Recognition Accountants.
- Source-to-Pay: Procurement / Supply Chain Director, Buyers, Subcontract Administrators
  (subKs are contracts, not POs, in their mental model), Small Business Liaison Officer,
  Purchasing System (CPSR) compliance lead, Accounts Payable.
- Plan-to-Produce: VP Operations, Production Control, Master Scheduler, Manufacturing
  Engineers, MRP Controllers, Quality Engineers (AS9100 quality system, AS9102 first
  article inspection), Shop Floor Supervisors.
- Inventory-to-Deliver: Warehouse and Logistics Managers, Shipping and Receiving leads
  (DD250 / WAWF acceptance), Traffic and Transportation, Inventory Control Analysts
  (cycle counting programs), Kitting leads.
- Design-to-Release: Chief Engineer, Configuration Management Analysts (EIA-649
  discipline: baselines, change control boards), PLM Administrators, Design Engineers,
  Data Management specialists (CDRLs and DIDs), Drawing Release desk.
- Acquire-to-Retire: Government Property Administrator (GPA, the FAR 52.245-1 owner),
  Property Custodians, Asset Accountants, Facilities Management, IUID Registry
  coordinator.
- Sustainment / MRO: Depot Operations Manager, Service Program Managers, Reliability
  and Maintainability Engineers, Rotable Pool Managers, Field Service Engineers,
  Warranty Administrators.
- Hire-to-Retire: HR Director, Timekeeping Administrators (total time accounting
  policy owners), Payroll, Facility Security Officer (FSO, clearances), Training and
  Compliance coordinators.
- Security and Authorization (platform): CISO / ISSM, SAP Security Administrators,
  Export Control Officer (the ITAR Empowered Official), Internal Audit, FSO.
- Analytics and Reporting (platform): FP&A Director, EVMS and program analysts, BI and
  data engineering team, Compliance reporting owners.
- Development and Technology (platform): CIO / IT Director, SAP Basis, ABAP and
  integration developers, Enterprise Architects, Middleware admins.

SME behaviors: identify the process owner, the compliance owner, and the data owner for
every design decision (they are usually three different people); interview and design in
their vocabulary; know which role signs off on which deliverable; anticipate the change
impact on each role when standard S/4 replaces their legacy tool.

## Dimension 2: Process

End-to-end process fluency plus the regulatory overlay that makes GovCon different:

- FAR and DFARS clause flowdowns shape the process, not just the contract file. Know
  which clauses drive your stream (examples: FAR 52.245-1 property, FAR 52.232-16
  progress payments, FAR 52.216-7 allowable cost and payment, DFARS 252.242-7004 MMAS,
  DFARS 252.234-7002 EVMS, TINA / FAR 15.403 certified cost or pricing data).
- Cost Accounting Standards (CAS 401 through 420) constrain design choices: consistency
  (401/402), home office allocations (403), asset capitalization (404), unallowables
  (405), accounting period (406), G&A (410), pension and insurance standards.
- The six DFARS business systems map to owning streams: Accounting (Record-to-Report,
  with Hire-to-Retire timekeeping as its most audited input), Estimating (Offer-to-Cash
  with Plan-to-Perform), Purchasing / CPSR (Source-to-Pay), Property (Acquire-to-Retire
  with Inventory-to-Deliver), MMAS Material Management and Accounting System
  (Plan-to-Produce with Inventory-to-Deliver), EVMS (Plan-to-Perform). A stream SME
  knows the adequacy criteria of their system(s) and which SAP design choices satisfy or
  jeopardize them.
- DCAA audits processes, not slideware: walkthroughs follow the transaction trail
  (timecard to labor distribution to project to invoice). Design processes that can be
  walked end to end.
- Fit-to-standard discipline: prefer standard S/4 process variants; document deviations
  as explicit decisions with compliance rationale (see the enhancement spec skill).
- Know your process KPIs and control points (three-way match tolerances, approval
  hierarchies, segregation points) and the SOX plus business-system control overlay.

## Dimension 3: Technology and Systems

SAP module depth is table stakes. The SME also knows the surrounding system landscape
typical in GovCon and what happens to it in an S/4 program:

- Legacy ERP and project accounting: Deltek Costpoint, Deltek GCS, Unanet, JAMIS,
  legacy SAP ECC with A&D add-ons. Know their vocabulary (Costpoint "projects" and
  "pools") because your client's people think in it.
- Scheduling: Primavera P6, MS Project, Open Plan (with EVM engines like Cobra or
  Dassian PPC). Schedule integration to SAP PS is a first-class seam.
- Pricing and estimating: ProPricer, ACEIT, in-house Excel models feeding TINA-certified
  proposals.
- PLM and engineering: Teamcenter, Windchill, Creo/NX/CATIA CAD, with eBOM-to-mBOM
  handoff into SAP.
- MES and quality: Solumina, DELMIA Apriso, shop floor data collection feeding
  confirmations.
- Government portals your design must feed: PIEE / WAWF (invoicing, receiving reports,
  DD250 acceptance), SAM.gov (entity and exclusions), EDA (contract documents), IUID
  Registry (item unique identification), eCMRA (contractor manpower reporting).
- SAP-side: S/4HANA core modules per stream, Dassian A&D verticals where licensed,
  BTP for side-by-side extension, clean-core three-tier extensibility ladder.
- The SME can draw the integration architecture for their stream: which systems stay,
  which retire, which interfaces are RICEFW items, and which government portals sit at
  the boundary.

## Dimension 4: Data

- Know your stream's master and transactional data objects, their SAP tables and their
  business owners (Dimension 1 roles), and the quality dimensions that matter
  (completeness, validity, uniqueness, timeliness).
- Migration strategy fluency: object inventory, source-to-target mapping, cleansing
  ownership (client owns cleansing, consultant owns mapping and load), mock conversion
  cycles with reconciliation, cutover data sequencing.
- GovCon data specifics: contract data carries CLIN/SLIN/ACRN structures and CDRL
  obligations; cost data must reconcile to the incurred cost submission; property
  records carry acquisition cost, government furnished vs contractor acquired
  classification, and IUID; technical data carries distribution statements and export
  markings.
- CUI (Controlled Unclassified Information) lives in your data: know which fields and
  documents are CUI or export controlled, because it drives Dimension 5.
- Records retention: FAR subpart 4.7 imposes retention periods on contractor records;
  archiving design must respect them.

## Dimension 5: Security and Authorizations

- SAP role design starts from the People dimension: PFCG roles mirror real jobs, not
  module menus. Build a role-to-position matrix per stream.
- Segregation of duties: know your stream's toxic combinations (vendor create plus
  payment, timecard entry plus approval, PO create plus goods receipt, master data plus
  transaction posting) and the mitigating controls when small sites cannot fully
  segregate.
- Export control (ITAR / EAR): technical data and defense articles need segregation by
  design: org-level separation (plant, company code), document-level controls
  (distribution statements), and access restriction to US persons where required. This
  is an architecture decision, not an afterthought.
- CUI protection: NIST SP 800-171 and CMMC Level 2 requirements follow the data into
  SAP: hosting boundary (GovCloud / NS2-style environments), access control, audit
  logging, incident response. The SAP landscape is inside the assessment boundary if
  CUI is processed there.
- Auditor access: DCAA and DCMA expect read-only access paths or extract packages;
  design an auditor role per business system.
- Timekeeping controls are the most audited authorization design in GovCon: employees
  record only their own time, changes leave an audit trail with reason codes,
  supervisors approve, and floor-check readiness is a design requirement.

## Dimension 6: Analytics and Reporting

Every stream owes specific numbers to the government, the auditors, and the business:

- Record-to-Report: incurred cost submission (the ICE model), provisional and final
  indirect rates, forward pricing rate proposals, contract backlog (SEC reporting for
  public companies), program P&L, unallowable cost visibility.
- Plan-to-Perform: IPMR / IPMDAR formats (the CPR formats 1 through 5 lineage), NASA 533
  where applicable, CFSR (contract funds status), EAC packages, variance analysis with
  root cause narrative.
- Offer-to-Cash: bookings / backlog / billings, revenue recognition by POB, milestone
  and progress payment status, DSO on government receivables.
- Source-to-Pay: CPSR file support, small business subcontracting reports (ISR/SSR in
  eSRS), subcontract flowdown status.
- Plan-to-Produce and Inventory-to-Deliver: MMAS metrics (inventory record accuracy,
  BOM accuracy, timely charging), WIP aging, on-time delivery to contract dates.
- Acquire-to-Retire: government property records and periodic inventories, loss/damage
  reporting, IUID registry submissions.
- Sustainment / MRO: repair turnaround time, rotable pool availability, warranty
  recovery, depot workload.
- Platform view: know when embedded analytics (CDS queries, Fiori analytical apps)
  suffices vs when a warehouse layer (BW/4, Datasphere) or a specialized tool is
  warranted; keep single-source-of-truth discipline (ACDOCA as the financial spine).

## Dimension 7: Role of AI

- Per-stream AI leverage: forecasting EACs and demand, anomaly detection on labor
  charging and expense patterns, clause and CDRL extraction from contract documents,
  proposal and deliverable drafting, master data quality suggestions, config copilots,
  conversational access to program status.
- The compliance boundary: a human remains accountable for certified data. AI can draft
  an incurred cost schedule or a TINA sweep list, but certification (and the legal
  exposure) belongs to a named officer. Never present AI output as certified or final
  without a human gate.
- Auditability: AI-assisted outputs that feed government deliverables need traceable
  grounding (what data, what version, what prompt) so an auditor can reproduce the
  basis.
- The agents' own rules mirror this: ground answers in retrieved knowledge and live
  system evidence, state when knowledge is thin, degrade honestly when a connector is
  unavailable, and never execute a system write without prepared approval.

## Dimension 8: Operating Model (how the function runs in the company)

- Org archetypes: program-aligned matrix (strong program offices, functional homes) vs
  shared services (centralized finance, procurement, HR); divisions and segments with a
  home office drive CAS 403 allocation design and company code / profit center strategy.
- Calendar and cadence the SME must design around: monthly close with rate monitoring;
  quarterly (or event-driven) EAC cycles; annual incurred cost submission (due six
  months after fiscal year end) and forward pricing rate proposal cycles; program
  management reviews (PMRs); proposal surges; DCMA business system reviews and DCAA
  audits; contract closeout waves.
- Government counterparts: the PCO (procuring contracting officer), ACO (administrative
  contracting officer, usually DCMA), DCAA auditor, DCMA functional specialists
  (property, EVMS, quality). Know who approves what (provisional rates: DCAA/ACO;
  business system adequacy: ACO with functional specialist input).
- Where the stream team sits: e.g. program controls usually reports to a central
  planning function but is embedded in programs; property administration often sits in
  supply chain or facilities but answers to contracts for compliance.
- Consulting engagement fit: SMEs schedule design decisions around the client's
  compliance calendar (never cut over billing mid-invoice-cycle; never change labor
  distribution mid ICS preparation without a bridge).

## Using the rubric

- Answering a design question: check which of the eight dimensions the answer touches;
  cover the material ones explicitly.
- Planning a workshop: agenda sections along the eight dimensions catch gaps early
  (most fit-to-standard workshops naturally cover Process and Technology and forget
  People, Security, and Operating Model).
- Scoring an assessment: rate the client's current state per dimension per stream; the
  weakest dimension is usually the delivery risk.
- Self-check for agents: if you cannot speak to one of the eight dimensions for your
  own stream, that is a knowledge gap to log, not something to improvise.
