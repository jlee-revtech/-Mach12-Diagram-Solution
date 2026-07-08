---
stream: plan-to-produce
---

# Plan-to-Produce in a US Government Contractor: The Eight-Dimension Operating Profile

## People

Plan-to-Produce (Program Execution) at a GovCon aerospace and defense company is run by a small set of roles whose decisions a consultant must be able to name, cast, and sequence. The stream lives or dies on the daily discipline of production control and MRP controllers, not on the VP.

| Role | What they own | What they sign off | Day-to-day pains |
| --- | --- | --- | --- |
| VP Operations | Plant P&L for execution, delivery to contract dates, headcount, make/buy execution | Capacity investment, MES boundary, overtime, plant-level process changes | Past-due backlog, EAC surprises traced to shop variances, MMAS findings landing on their desk |
| Director of Production Control | The master schedule, order release policy, shop priorities | MPS changes, release horizon rules, expedite decisions | Constant re-planning when engineering releases late or customer mods shift delivery dates |
| Master Scheduler | MPS by program: translating contract CLIN delivery dates and the IMS into buildable, time-phased demand | MPS accuracy metric (an MMAS metric), demand loading rules | Program managers demand dates the shop cannot hit; schedule churn destroys MPS accuracy |
| MRP Controller / Material Planner | Their MRP controller key's parts: planned orders, exception messages, coverage | Planned order to production order conversion, reschedule actions | MD07 exception queues in the thousands after a bad master data load; hoarding in spreadsheets when they stop trusting the system |
| Manufacturing Engineer | Routings, work centers, standard times, mBOM maintainability, control keys | Routing accuracy metric, operation standards, subcontract operation setup | Engineering BOM changes arriving without effectivity; standards challenged every EAC cycle |
| Quality Engineer / Quality Manager | AS9100 QMS, inspection plans, nonconformance and MRB, FOD program | Usage decisions, MRB dispositions, corrective actions to DCMA CARs | Inspection bottlenecks blamed for OTD misses; notification data too dirty to trend |
| Shop Floor Supervisor | Cell execution, dispatch list adherence, confirmation timeliness | Daily confirmations, scrap declarations | Operators charging the wrong order or wrong WBS; MES vs SAP screen confusion |
| Plant Controller (interface role) | WIP, variances, order settlement to WBS; the finance face of this stream | Month-end confirmation cutoff, WIP aging explanations | Late confirmations moving cost across periods; unsettled orders at close |
| MMAS / Business Systems Compliance Lead | MMAS system description, internal reviews (Standard 10), audit liaison | Borrow/payback policy, manual override reporting, metric evidence packages | Proving 98/95/95 accuracy with system evidence, not spreadsheets |

Typical reporting lines: Production Control, planning, and supervisors roll to the VP Operations (who reports to a COO or site GM). Quality reports independently to a VP Quality / Mission Assurance to preserve AS9100 independence; never let a design put usage decisions under Operations. Manufacturing Engineering sits under Operations or under Engineering depending on the company; know which before workshops. The MMAS compliance lead usually sits in Finance/Compliance, not Operations.

Casting rule for consultants: MRP design decisions need the Director of Production Control plus working MRP controllers (the people who will live in MD07), never just the director. MMAS-relevant decisions (special stock policy, borrow/payback, backflush) need the compliance lead and plant controller in the room or the decision will be reversed later. MES boundary decisions need VP Operations, Quality, and IT together, once, with a written outcome.

## Process

End-to-end flow, numbered so a new hire can trace it:

1. Contract award establishes CLIN delivery dates and a WBS structure (from the Project System / contract setup seam).
2. The master scheduler loads an MPS per program, reconciling contract dates against the IMS and rate capacity.
3. MRP explodes requirements through the mBOM (received from Design-to-Release with change-number effectivity), creating planned orders for make items and purchase requisitions for buy items.
4. MRP controllers work exceptions daily, then convert planned orders to production orders. Orders are account-assigned to WBS elements and consume/produce project stock (special stock Q).
5. Production control releases orders against a material availability check and a capacity sanity check; released orders print/dispatch to the floor or download to MES.
6. The shop executes: components issued from Q stock (discrete issue or backflush), operations confirmed with labor hours and quantities, in-process inspection lots dispositioned, nonconformances routed to MRB.
7. Goods receipt posts the finished item into project stock; GR hands off to Inventory-to-Deliver for DD250/source acceptance and shipment.
8. Subcontract operations on the routing (externally processed operations) generate purchase requisitions and hand off to Source-to-Pay; parts leave and return with operation-level tracking.
9. Month-end: confirmation cutoff, order settlement to WBS, WIP calculation, variance review, MMAS metric snapshot.

This stream is make-to-order / engineer-to-order. Production orders carry account assignment to the WBS, components are issued from Q stock segregated by WBS, and cost flows to the contract's control accounts. Contract-specific cost segregation is not an accounting nicety; it is the legal basis for billing the government, so the process design must make wrong-contract charging structurally hard, not just discouraged. The design decision with the longest tail is Q-stock-everywhere versus common stock with pegging (next subsection); make it explicitly and early.

### Grouping, pegging, and distribution (GPD / PMMO)

Common parts (fasteners, connectors, castings shared across programs) are the classic A&D dilemma: buy them per contract and you carry duplicate inventory and expedite constantly; pool them without controls and you have co-mingled inventory with no defensible cost assignment, which is a direct MMAS finding (Standards 6, 7, and 9 all bite). GPD (the classic A&D industry solution) and PMMO (its S/4HANA successor) resolve this:

- Grouping: WBS elements whose demand may share supply are grouped (a grouping WBS fronts procurement), so one purchase order can serve many contracts.
- Pegging: the system assigns each supply element (stock, open PO, production order) to the contract demand it will satisfy, maintaining a defensible demand-to-supply audit trail.
- Distribution: costs initially collected on the grouping object are distributed to the pegged WBS elements, so each contract bears the cost of what it actually consumed, in the right period.

Borrow/payback discipline: when Contract A takes a part pegged to Contract B, that is a loan, and MMAS Standard 7 requires a written policy, documented part cost and loan/payback dates, and actual payback with like parts. World-class shops generate payback proposals from pegging data and approve them through workflow; weak shops discover borrows at audit time. A consultant's test question: "show me last month's cross-contract transfers and their documentation." Silence means a finding is latent.

### MRP design as practiced

- MRP areas: use them to separate planning domains inside a plant (e.g., a repair cell, a program-dedicated line, subcontract stock) so one plant does not force one planning policy. Do not create MRP areas to simulate contract segregation that project stock already provides.
- MRP Live (MD01N) nightly is the baseline on S/4; planning file entries keep it incremental. Intraday single-item runs (MD02-style) remain the controller's scalpel.
- Planned order to production order conversion is a deliberate production control act (individual or collective conversion), not an automated bulk job, on ETO hardware: conversion is where release-horizon policy, material availability, and capacity judgment get applied.
- Exception monitoring is a daily production-control job, full stop. MD07 (or the Monitor Material Coverage app) queues, grouped by controller key, worked same-day: reschedule-in/reschedule-out proposals answered, opening dates in the past cleared, excess flagged. Exception aging is a hiring-manager-grade KPI for MRP controllers. When controllers stop working exceptions, MRP output stops being trusted, planners go to spreadsheets, and the MMAS "valid time-phased requirements" premise of Standard 2 quietly dies.
- Lot sizes on contract hardware default to lot-for-lot (exact); every min/max or fixed lot size is a deliberate, documented exception because Standard 2 explicitly treats minimum/economic order quantities as something the system must handle with valid rationale.

### Timely and accurate charging

Labor and material must hit the right contract in the right period. The mechanics:

- Confirmations (CO11N or MES-fed equivalents) post labor to the order, which settles to the WBS: late confirmations shift cost across periods and distort both WIP and the EVM ACWP feed. The standard is confirmation within the shift.
- Backflush discipline: backflushing issues components automatically at confirmation based on the BOM. It is efficient and dangerous in equal measure: with an inaccurate BOM it silently charges the wrong material to the contract and corrupts inventory records. Earn backflush with demonstrated BOM accuracy (98% bar) and restrict it to stable, high-volume assemblies; keep discrete issue on low-volume ETO work.
- Wrong-WBS postings found after the period closes require correcting entries that auditors will read; catch them pre-close with exception reporting on confirmations and goods movements.
- Scrap must be declared at confirmation (not buried in quantity variances) so scrap cost lands visibly on the causing contract and feeds the trend reporting.

### Work center and capacity planning

- Work center master data (CRHD) carries the capacity header (KAKO). Available capacity = operating time (shift start to end minus breaks) x capacity utilization % x number of individual capacities. If utilization is a guess and individual capacities do not match the machines on the floor, every downstream capacity report is fiction; fix this data first.
- Basic scheduling computes order dates from float and lead times without work center times; lead time scheduling computes operation-level dates from routing standard values and generates capacity requirements. Bottleneck value streams need lead time scheduling; commodity fab can live on basic dates longer than purists admit.
- Capacity maturity ladder, in order and skipping none: (1) honest work center and capacity master data; (2) capacity evaluation (CM01) reviewed in the weekly production meeting; (3) manual finite leveling at named bottleneck work centers (CM21/CM25 planning tables); (4) embedded PP/DS with a constraint model at those bottlenecks only. Attempting rung 4 from rung 0 is a signature implementation failure.

### Quality management under AS9100

- Inspection types drive where QM intercepts material: goods-receipt inspection on purchased material (inspection type 01), in-process inspection during production (type 03), inspection at GR from production (type 04). Inspection lots (QALS) collect results; a usage decision (QA11) releases, rejects, or routes stock, and for Q stock the posting keeps the WBS assignment.
- Quality notifications (QMEL) carry nonconformances with coded defects (QMFE). Notification catalogs (defect codes, causes, tasks) must be designed with the quality engineers who will trend them; free-text-only notifications are unanalyzable and DCMA notices.
- MRB flow: nonconforming material is segregated (blocked/quality stock, physically tagged and caged), a notification documents the defect, the Material Review Board (quality engineering, manufacturing engineering, and where required customer/DCMA representation) dispositions it: use-as-is, repair, rework, scrap, or return-to-vendor. Use-as-is and repair on government hardware frequently require government concurrence per the contract's quality clauses. Disposition authority is a named, delegated authorization, never a broad role.
- FOD prevention is a culture with system hooks: tool accountability, clean-as-you-go, FOD walks, and routing operations that include FOD-critical checkpoints. AS9100 requires a FOD program appropriate to the product; auditors and DCMA QARs look for evidence on the floor, not in the binder.
- First article inspection per AS9102 sits at the seam with Design-to-Release and suppliers; FAI data often lives in a point tool (Net-Inspect) and must be traceable from the SAP inspection lot.

### The GovCon compliance overlay

GovCon overlay this stream owns or feeds:

- DFARS 252.242-7004 Material Management and Accounting System (MMAS): this stream OWNS this business system. The clause defines 10 standards, in summary: (1) documented system description; (2) costs charged or allocated based on valid time-phased requirements (the clause itself cites 98% bill of material accuracy and 95% master production schedule accuracy as desirable goals; ~95% routing accuracy is a commonly applied companion threshold, not clause text); (3) identify, report, and resolve system control weaknesses and manual overrides; (4) audit trails from records to source documents; (5) inventory record accuracy with periodic reconciliation to physical counts (~95% is the commonly applied level, cited in the clause as desirable); (6) documented circumstances for transfers of parts between contracts; (7) consistent, unbiased costing of material transactions, including the loan/payback (borrow/payback) technique with documented policies; (8) common inventory allocations reprocessed at least each billing cycle; (9) controls over physically commingled inventory across fixed-price, cost-reimbursement, and commercial work; (10) periodic internal reviews. A significant deficiency lets the ACO withhold payments under DFARS business system rules.
- DFARS 252.234-7002 Earned Value Management System: this stream FEEDS it. Confirmations and material issues are the ACWP feed; the master schedule aligns to the IMS; the Dassian EVM layer consumes both.
- FAR 52.245-1 Government Property: GFP/GFM in the plant must be identified, segregated, and tracked; property management system adequacy (DFARS 252.245-7003) touches stores and shop handling.
- FAR 52.246-2 Inspection of Supplies and higher-level quality requirements (FAR 52.246-11) invoking AS9100: the QM design is a contract requirement, not a preference.
- DFARS 252.246-7000 Material Inspection and Receiving Report: the DD Form 250 at the GR/acceptance boundary.
- DFARS 252.211-7003 Item Unique Identification (IUID) and MIL-STD-130 part marking: serialization decisions land in production order and QM design.
- Counterfeit electronic part controls (DFARS 252.246-7007 detection/avoidance system, 252.246-7008 sources of electronic parts) constrain the subcontract and receiving seams; broader counterfeit and nonconforming-item controls flow from AS9100/AS5553 and the contract's quality clauses.
- CAS overlay: CAS 411 (accounting for acquisition costs of material) governs the inventory costing method (moving average vs standard) and must match the disclosure statement; CAS 407 governs use of standard costs for direct material and labor including variance disposition; CAS 401/402 require the shop's charging practices to be consistent with how the company estimates and proposes.

Control points a consultant should design deliberately: order release (availability check plus capacity review), confirmation cutoff at period end (timely and accurate charging: labor and material must hit the right contract in the right period, or the incurred cost and progress billing base is wrong), MRB gate on nonconforming material, borrow/payback approval, manual override logging, and the month-end WIP/settlement run.

What DCAA/DCMA walk through: DCAA performs the MMAS audit (the ACO at DCMA makes the determination). Expect them to trace a part from contract requirement through MPS, MRP, planned order, production order, issue, and charge; observe cycle counts; test borrow/payback transactions for documented cost and dates; pull the manual override and exception reports (Standard 3); and reconcile a sample of inventory records to the floor. DCMA's on-site QAR performs product acceptance and issues Corrective Action Requests (Level I to IV); DCMA industrial specialists review delivery schedules and surge capacity. If the client cannot regenerate an as-of-date pegging picture, the audit gets long.

### Seams with neighboring streams

- mBOM from Design-to-Release: the EBOM lives in PLM; the mBOM arrives in SAP (MAST/STKO/STPO) with change numbers (AENR) and effectivity. The contract here must specify who converts EBOM to mBOM, how phantom assemblies and reference designators are handled, and the SLA from engineering release to plannable mBOM. Every day of lag becomes shop floor markup and BOM-accuracy erosion.
- GR to Inventory-to-Deliver: goods receipt from the final production order into project stock is where this stream's ownership ends; acceptance (DD250/WAWF), serialized stock handling, packing, and shipment belong to Inventory-to-Deliver. The handoff artifact is a completed, inspected, correctly valuated Q-stock quantity on the right WBS.
- Subcontract operations to Source-to-Pay: externally processed routing operations (outside processing such as plating, heat treat, NDT) generate purchase requisitions carrying the operation reference; S2P sources and pays, but production control owns the dates and the shortage risk. Parts sent to subcontractors on ITAR programs also cross an export-control boundary that procurement documents must reflect.
- Confirmations to Record-to-Report / EVM: settlement of order cost to WBS feeds both the financial close and the Dassian EVM ACWP; the calendars must be synchronized or programs report EVM on stale actuals.

## Technology and Systems

SAP core for this stream: PP (production orders, SFC), PP-MRP (MRP Live on S/4HANA, MD01N/MD04/MD07), PP-CRP capacity planning (CM01 evaluation, CM21/CM25 leveling), PP/DS (embedded advanced scheduling, used selectively at bottlenecks), QM (inspection lots, notifications, usage decisions), LO-VC variant configuration (configure-to-order lines, characteristic-driven BOMs/routings), PS (WBS, the account assignment backbone), and MM-IM (goods movements, project stock). Grouping/Pegging/Distribution comes either as classic GPD (A&D industry solution) or PMMO (Project Manufacturing Management and Optimization) on S/4HANA; PMMO is the strategic choice on new implementations.

Dassian add-ons: Dassian Project Management supplies the EVM layer (time-phased plans, IPMDAR reporting plus legacy CPR/IPMR formats still carried on older contracts, CAM workflows) consuming this stream's ACWP; Dassian MPIA / BOM cost supplies master production scheduling integration and indented BOM cost rollups used for EACs and proposal-to-execution cost continuity.

Non-SAP systems typically found on site, with keep/retire/integrate guidance:

| System | Typical products | Guidance |
| --- | --- | --- |
| MES | Solumina (iBASEt), DELMIA Apriso (Dassault) | Keep and integrate when work instructions, as-built/serial genealogy, operator certifications, and electronic buyoffs are required (they usually are on DoD hardware). MES executes the operation; SAP PP-SFC owns the order, cost, and inventory. Orders and operations download to MES; confirmations, scrap, and completions upload to SAP (CO11N-equivalent postings via BAPI/IDoc). Run SAP-only SFC execution just on simple fab/machine shops. Never let MES hold the cost truth. |
| PLM / PDM | Teamcenter, Windchill | Keep. EBOM masters live there; the mBOM handoff into SAP (with change/effectivity) is the most failure-prone seam in the stream. |
| Scheduling | Primavera P6, MS Project (IMS) | Keep for the program IMS; integrate milestones to PS dates. Do not attempt to make P6 drive shop dispatch. |
| Finite scheduling / APS | Legacy Preactor-type tools | Usually retire into embedded PP/DS at bottleneck work centers; keep only if the constraint model is genuinely exotic. |
| Quality point tools | Net-Inspect, discrete CMM/data-collection tools | Integrate results into QM inspection lots where customers require flow-down (FAI/AS9102 data often lives here). |
| Shop data collection / time | Kronos/UKG or MES-native labor | Labor must reconcile to SAP confirmations; two labor truths is an audit finding waiting to happen. |

Government portals at the boundary: PIEE/WAWF for receiving reports and DD250 source acceptance (fed by the GR/delivery seam), the PIEE GFP module for government furnished property, and SPRS where delivery and quality scores surface. This stream does not own the portals but its data quality shows up in them.

## Data

Master data with SAP tables and owners (role names from People):

| Object | Main tables | Owner |
| --- | --- | --- |
| Material master (plant/MRP views) | MARA, MARC, MBEW, MARD | MRP Controller (MRP views), Plant Controller (costing views) |
| Manufacturing BOM | MAST, STKO, STPO | Manufacturing Engineer (from Design-to-Release EBOM; note STPO component quantity is relative to STKO base quantity) |
| Routing / task list | PLKO, PLPO, MAPL | Manufacturing Engineer |
| Work center and capacity | CRHD, CRCA, KAKO | Manufacturing Engineer (definition), Director of Production Control (capacity data) |
| Production version | MKAL | Manufacturing Engineer |
| Inspection plan, QM material settings | PLKO/PLPO (usage 5 for goods-receipt inspection plans; in-process type 03 normally uses the production routing with inspection characteristics, usage 1; usage 3 universal is a common option), QMAT | Quality Engineer |
| WBS / project structure | PROJ, PRPS | Program (PS stream); consumed here as the account assignment |

Transactional data: planned orders (PLAF), production orders (AFKO, AFPO, operations AFVC/AFVV), reservations (RESB), confirmations (AFRU), goods movements (MATDOC in S/4; MSEG as compatibility), project stock quantities (MSPR compatibility view) and valuated project stock (QBEW), inspection lots (QALS), usage decisions (QAVE), quality notifications (QMEL, defects QMFE), change masters from engineering (AENR). Pegging/distribution assignments live in the GPD or PMMO tables specific to the release; treat them as system-of-record for borrow/payback evidence.

Migration load sequencing for this stream (Migration Cockpit objects where available): 1) work centers, 2) material masters with MRP/work scheduling/QM/costing views, 3) BOMs, 4) routings, 5) production versions, 6) inspection plans, 7) WBS structures (must exist before any Q stock), 8) inventory balances including special stock Q by WBS with correct valuation, 9) open purchase orders (S2P seam), 10) open production orders, which are usually NOT migrated: close them in legacy or recreate at a cutover operation with a WIP value transfer agreed with the plant controller and compliance lead. Loading Q stock without its valuation history reconciled to legacy is a self-inflicted MMAS Standard 5 problem.

CUI and export control: routings, operation long texts, work instructions, inspection plans/characteristics, and the mBOM structure itself constitute technical data. On ITAR programs (22 CFR 120-130) or EAR-controlled items (15 CFR 730-774), this data is export controlled; all of it plus program-identifiable schedules is typically CUI: DFARS 252.204-7012 drags NIST SP 800-171 compliance and cyber incident reporting onto the SAP landscape and every integrated system (MES included), and CMMC arrives on the same system boundary via DFARS 252.204-7021 (with assessment requirements under 252.204-7019/-7020). Drawings attached via DMS and any AI tooling touching this data inherit the same boundary.

Data gotchas a practitioner checks early:

- STPO component quantities are relative to the STKO base quantity; any extract or accuracy audit that forgets the divide reports false errors.
- Material master MRP fields (MARC: MRP type, lot size, MRP controller, scheduling margin key, in-house production time) are the single highest-leverage data set in the stream; a bad mass load here floods every controller's exception queue at once.
- Special stock Q means quantities and values are keyed by WBS: reports built on plant/storage-location stock alone (MARD) silently miss project stock; use the project stock views and QBEW for value.
- Work-in-process is a calculated value from results analysis at period end, not a stored stock quantity; do not promise a real-time WIP-by-order report without explaining that.
- Change documents (CDHDR/CDPOS) on BOMs and routings are the raw material for the MMAS accuracy and override evidence; confirm they are switched on and retained before promising the metrics package.
- Serial number and equipment records must survive the MES/SAP boundary intact on serialized DoD hardware; decide the system of record for as-built genealogy explicitly.

## Security and Authorizations

PFCG role shapes that work in this stream (build task roles, then derive by plant/org):

- Master Scheduler: MPS/demand management maintenance, MRP display, no order execution, no goods movements.
- MRP Controller: MRP run/evaluation (MD04, MD07), planned order maintenance and conversion, purchase requisition create; restricted by plant and MRP controller key where feasible; no confirmations, no inventory adjustments.
- Production Supervisor / Shop: order release (plant/order-type restricted via C_AFKO_AWK), confirmations (CO11N), goods issue/receipt for production movement types (M_MSEG_BWA restricted by movement type); no BOM/routing maintenance.
- Manufacturing Engineer: BOM (C_STUE_BER) and routing maintenance, work center maintenance; no order release, no goods movements, no confirmations.
- Quality: inspection lot processing and usage decision; results recording separated from UD authority for high-criticality parts; MRB disposition restricted to MRB-authorized users only.
- Compliance/Auditor: display-only bundle (MD04, CO03, QA33, MB52, order and material document display) with no create/change anywhere; give DCAA/DCMA support staff this named read-only role rather than screenshots, and log its use.

Segregation-of-duties toxic pairs:

| Toxic pair | Risk | Mitigation |
| --- | --- | --- |
| Maintain BOM/routing + release production orders | Engineer a cost path then execute it; corrupts BOM/routing accuracy metrics | Split ME from Production Control; monitor change documents (CDHDR/CDPOS) on STPO/PLPO |
| Post confirmations + approve/adjust own labor or scrap | Self-approval of charging; timely/accurate charging violation | Supervisor review of confirmation exceptions; MES buyoff identity separate from SAP poster |
| Post goods movements + approve physical inventory differences (MI07) | Conceal shrinkage; defeats Standard 5 cycle count integrity | Separate count/post/approve; difference approval thresholds to Plant Controller |
| Execute contract-to-contract transfers (borrow/payback postings) + maintain the transfer policy or pegging assignments | Unbilled cross-charging between contracts; MMAS Standards 6/7 finding | Transfer posting restricted to Production Control with compliance-lead approval workflow; pegging changes logged |
| Results recording + usage decision on the same lot | Inspector accepts own work | Split roles or restrict UD (QA11) to leads on FAI/critical characteristics |
| Maintain material costing views + post inventory revaluations | Manipulate contract cost base | Costing views to Plant Controller org only; revaluation dual control |

Export control specifics: derive roles by plant and, where programs share a plant, by additional org discriminators; ITAR program data access requires US-person status checked outside SAP (HR/empowered official process) and enforced through role assignment governance, not just auth objects. Long texts and DMS attachments are the common leak paths; if foreign-person users exist anywhere on the client, treat display authorizations for routings and documents as export decisions. WBS-level access control (PS authorization on PRPS) is the cleanest contract fence for project stock and orders.

## Analytics and Reporting

Reports this stream owes:

| Report | To whom | Cadence | SAP source |
| --- | --- | --- | --- |
| MMAS metrics package (BOM accuracy, MPS accuracy, routing accuracy, inventory record accuracy, manual overrides, exception aging) | MMAS compliance lead, ACO/DCAA on request | Monthly, with annual internal review (Standard 10) | Cycle count results (physical inventory docs), change documents on STPO/PLPO, MD07 snapshots, custom accuracy sampling |
| WIP aging by contract/WBS | Plant Controller, program finance, VP Operations | Monthly close | AFKO/AUFK order dates, WIP from results analysis, QBEW |
| On-time delivery to contract dates | VP Operations, program managers, DCMA industrial specialist | Weekly and monthly | Production order finish vs planned, deliveries vs CLIN schedule lines |
| Scrap and rework trends | Quality Manager, VP Operations, customer where flowed down | Monthly | AFRU scrap quantities, rework orders, QMEL notifications by code group |
| Past-due and exception aging | Director of Production Control | Daily | MD07/MD04, order due lists |
| Capacity utilization and load | Director of Production Control, VP Operations | Weekly | CM01 (KAKO available vs KBED capacity requirements, generated from AFVV operation data) |
| ACWP/actuals feed to EVM | Program CAMs via Dassian PM | Weekly/monthly per program rhythm | Confirmations and goods movements settled to WBS |
| Cycle count performance | Plant Controller, compliance | Monthly | Physical inventory documents (MIBC-driven ABC program) |

How the MMAS accuracy metrics are actually computed, since clients always ask:

- BOM accuracy: sample assemblies (risk-weighted toward recent change activity), compare STPO structure and quantities to the released engineering configuration and to what the floor actually consumed; a BOM line is right or wrong as a whole (part, quantity, unit).
- Routing/MPS accuracy: sampled routings compared to the process actually run (operations, sequence, work centers); MPS accuracy compares scheduled versus actually supportable/executed build dates within tolerance.
- Inventory record accuracy: cycle count hit rate by part number within counting tolerance, from the physical inventory documents; the ABC program (MIBC classification) sets frequencies.

Embedded analytics vs warehouse: run the operational day on embedded S/4 analytics (CDS-based Fiori apps such as Monitor Material Coverage and the production order management apps); MD07-style exception work must happen on live data. Push MMAS trend evidence, multi-year scrap history, OTD history, and anything DCAA may sample years later into the warehouse/lakehouse layer with immutable snapshots; auditors ask "show me the metric as reported in March," and embedded views cannot reconstruct that. Snapshot the MMAS metrics at each close.

KPIs by role: VP Operations (OTD to contract, WIP turns, past-due backlog, MMAS status), Director of Production Control (schedule adherence, exception aging, release-to-plan), Master Scheduler (MPS accuracy 95%+), MRP Controller (exception queue age, coverage without excess), Manufacturing Engineer (BOM 98%/routing 95% accuracy, standards variance), Quality (escape rate, notification cycle time, CAR closure), Supervisors (confirmation timeliness, scrap rate, dispatch adherence).

## Role of AI

Concrete use cases in this stream:

1. MRP exception triage: cluster and rank MD07 exception messages by contract impact and due date so controllers work the vital few first; draft reschedule proposals with the pegged contract shown. Human executes every reschedule.
2. Confirmation anomaly detection for timely/accurate charging: flag late confirmations, hour patterns inconsistent with routing standards, and postings landing on unexpected WBS elements before the period closes, when correction is still clean.
3. Borrow/payback candidate identification: detect cross-contract shortage/surplus pairs in pegging data and draft the loan documentation (part, cost, dates) required by MMAS Standard 7. The transfer itself is posted and approved by humans under the written policy.
4. MRB disposition drafting: retrieve prior nonconformances on the same part/defect code and draft a disposition rationale with citations to those records. The MRB board disposition itself must be made and signed by the authorized MRB members; on many contracts certain dispositions (use-as-is, repair) require government concurrence, so AI output is decision support only.
5. Routing and BOM accuracy audit sampling: propose risk-weighted samples (recent change documents, high-value parts, new production versions) for the monthly accuracy checks instead of flat random sampling.
6. Capacity scenario narration: turn CM01/PP-DS what-if runs into readable trade-off summaries (overtime vs offload vs slip) for the weekly production meeting.
7. Scrap/rework causal clustering across QMEL text fields, driving corrective actions and feeding EAC realism.
8. Shop-floor question answering over work instructions and specs, restricted to the authorized document set for that user's programs.

Compliance boundary: a human with delegated authority must certify anything that becomes a representation to the government: MMAS metric submissions, usage decisions, MRB dispositions, DD250/acceptance data, EVM data feeding IPMDAR deliverables (or legacy CPR/IPMR on older contracts), and progress payment/incurred cost bases. The reason is structural: certifications carry False Claims Act and business system consequences that attach to a responsible person, and DCAA/DCMA test the control, meaning they must see a named human review step, not an AI log.

Grounding and auditability rules for AI feeding government deliverables: every AI statement must cite retrievable system records (order, lot, notification, material document numbers); no generation of part attributes, quantities, or dates not present in source data; retain the prompt, model/version, retrieved context, and output alongside the deliverable for the records-retention period; run models handling this data inside the CUI boundary (FedRAMP-authorized or on-prem inference; never a consumer endpoint), and apply ITAR/US-person restrictions to model access exactly as to the underlying data.

## Operating Model

Organization: the dominant pattern is a plant-based shared-services core (one production control organization, one quality organization, shared work centers) with a program-aligned matrix on top: master schedulers and often MRP controllers dedicated to programs, supervisors and cells shared. Pure program-aligned factories (a line per program) appear on large primes' flagship programs; they simplify contract segregation but waste capacity, and GPD/PMMO exists precisely so shared factories can stay compliant. A useful diagnostic: if planners are program-aligned but the metrics are only plant-level, priorities will be fought out in expedite meetings.

Calendar:

- Daily: MRP exception review by controller (MD07 queues worked same-day), dispatch/priority meeting, confirmation completeness check from the prior shift, past-due review.
- Weekly: MPS review by program, capacity/load review at bottleneck work centers, OTD and shortage meeting with S2P.
- Monthly (tied to financial close): confirmation cutoff, order settlement and WIP run with the Plant Controller, WIP aging review, MMAS metric snapshot, scrap/rework review, EAC inputs to program CAMs (ETC hours and material commitments), cycle counts per the ABC program.
- Quarterly: EAC deep-dives with programs, MMAS metric trend review with compliance, capacity plan refresh against new business forecast.
- Annually: MMAS internal review (Standard 10) and system description refresh, physical inventory where cycle counting does not achieve full coverage, support to the incurred cost submission (ICS) with material transaction samples, standards revaluation with CAS 407 consistency check, AS9100 surveillance audit support, DCMA/DCAA audit windows as scheduled.

Government counterparts: the PCO (procuring contracting officer) owns the contract and mods; the ACO at DCMA administers it and makes MMAS adequacy determinations; the on-site DCMA QAR performs surveillance and product acceptance and issues CARs; DCMA industrial specialists track delivery and production readiness; DCMA EVMS specialists review the EVM system this stream feeds; DCAA auditors execute the MMAS audit and material cost testing in incurred cost audits. Ops leaders should know their QAR by name; consultants should ask about open CARs in week one.

Where it sits: under a COO/site GM, peer to Supply Chain and Engineering, with Quality independent. The stream's finance twin is the Plant Controller; its compliance twin is the business systems lead. Both twins attend design workshops or the design is provisional.

## How a Consultant Engages This Function

Workshop casting: MRP and planning design (MRP areas, lot sizes, horizons) needs the Director of Production Control, working MRP controllers, and the master scheduler; MMAS-touching decisions add the compliance lead and plant controller. BOM/routing/work center design needs manufacturing engineers plus a Design-to-Release representative for the mBOM handoff. QM design needs quality engineers and the quality manager, with a DCMA-facing perspective on source inspection. MES boundary needs VP Operations, Quality, IT, and the MES vendor once, decisively. Never run a project-stock or GPD/PMMO workshop without finance and compliance present.

Decision ladder and sign-offs:

| Decision | Sign-off required |
| --- | --- |
| Special stock strategy: Q per WBS everywhere vs common stock with GPD/PMMO pegging | VP Operations + Plant Controller + MMAS compliance lead (this IS the MMAS architecture) |
| Borrow/payback policy and automation level | Compliance lead + Plant Controller; documented policy is a Standard 7 requirement |
| Backflush vs discrete issue, milestone vs operation confirmations | Plant Controller + Quality + Production Control (charging accuracy and traceability trade) |
| MRP areas and planning segmentation | Director of Production Control + MRP controllers |
| MES vs SAP PP-SFC execution boundary | VP Operations + Quality + IT |
| Capacity model depth (evaluation only vs leveling vs PP/DS) | Director of Production Control + VP Operations |
| Inspection types and MRB workflow | Quality Manager, with compliance for government-disposition rules |

First-two-weeks discovery checklist (what a 20-year practitioner actually asks for):

- The current MMAS system description and the date of the last internal review (Standard 10); any open DCAA MMAS findings or DCMA CARs and their corrective action status.
- Last three months of BOM, routing, MPS, and inventory record accuracy metrics with the sampling method behind them; if the client cannot produce them, that is the finding.
- An MD07 screenshot per MRP controller (or the legacy equivalent): exception counts and oldest message age tell you whether MRP is alive or theater.
- A walked example: one part, one contract, traced from contract demand through MPS, planned order, production order, issue, confirmation, GR. Time how long the trace takes; that is the audit-readiness measure.
- The borrow/payback policy document and last month's cross-contract transfers with their documentation.
- The mBOM handoff mechanics: who converts EBOM to mBOM, mean lag from engineering release to plannable BOM, and how effectivity is carried.
- The MES landscape and the current confirmation path (who posts, when, from which system), plus the labor reconciliation between time collection and confirmations.
- WIP aging by contract and the count of unsettled or long-open production orders.
- The cycle count program (ABC frequencies, difference approval thresholds) and last physical inventory results.
- Which programs are ITAR, where foreign-person users exist in the landscape, and how routings/documents are fenced today.

Common failure modes of implementations in this stream:

- Recreating legacy part-number-per-contract habits in S/4 instead of designing common parts with GPD/PMMO pegging: the client buys the same bracket under twelve numbers and the MMAS benefit of the new system evaporates.
- Turning on backflush without earning it: backflush with a 90% accurate BOM produces phantom inventory and wrong-contract charges at scale; sequence BOM accuracy work before backflush.
- Treating MD07 exception monitoring as optional training content: if controllers do not work exceptions daily from day one of hypercare, they return to spreadsheets within a month and MRP becomes a batch job nobody trusts.
- Ignoring the capacity maturity ladder: clients try to jump from infinite planning to automated finite scheduling; the workable ladder is (1) honest work center data and available capacity formulas (operating time x utilization x number of individual capacities in KAKO), (2) capacity evaluation in the weekly meeting, (3) manual leveling at named bottlenecks (CM21/CM25), (4) PP/DS at those bottlenecks only. Also switch bottleneck orders from basic-date scheduling to lead time scheduling early, or capacity data is fiction.
- Migrating open production orders wholesale: WIP values never reconcile; close and recreate with a controlled WIP transfer instead.
- Designing MMAS evidence after go-live: accuracy sampling, override logging, and metric snapshots must be built as system artifacts during the project, or the first post-go-live MMAS review runs on screenshots.
- Letting the mBOM seam stay informal: no agreed effectivity/change-number discipline from PLM means the shop builds to stale structures and BOM accuracy dies.
- Quality bolted on late: inspection types and notification catalogs configured in the last sprint produce dirty nonconformance data forever after.

What world class looks like: MRP Live runs nightly with exception queues worked to near-zero aging by named controllers; common parts are pegged, and borrow/payback proposals are system-generated, approved through workflow, and fully documented; confirmations post within the shift from MES with labor reconciling to payroll; BOM/routing/inventory accuracy run green against the 98/95/95 bars with system-generated evidence and immutable monthly snapshots; capacity is leveled at known bottlenecks and the master scheduler's MPS survives program reviews without churn; MRB cycle time is days, not weeks, with FOD and nonconformance culture visible on the floor; DCAA can trace any part from contract demand to charge in one sitting; and the ops calendar, the close, and the EVM rhythm are one calendar, not three.
