---
stream: sustainment-mro
---

# Sustainment and MRO in a US Government Contractor: The Eight-Dimension Operating Profile

## People

Sustainment/MRO is the aftermarket half of a defense OEM prime or Tier-2 supplier: it repairs, overhauls, and supports fielded platforms for decades after production ends. The people running it think in tail numbers, condition codes, and turnaround clocks, not in production lots.

| Role | Owns | Signs off | Day-to-day pains |
| --- | --- | --- | --- |
| VP / Director of Sustainment (Aftermarket) | P&L for repair, spares, and support contracts; depot partnering relationships | Business model decisions (CLS vs PBL vs transactional repair), capital for test equipment | Margin squeezed by aged fleets; workforce attrition of touch labor; 50/50 partnering politics |
| Depot Operations Manager | Shop floor: induction, teardown, repair, test cells; throughput and labor efficiency | Daily workload release, over-and-above (O&A) work packages before submission | Awaiting-parts (AWP) units clogging the floor; RTAT misses; evaluation bay backlog |
| Service Program Manager (SPM), one per platform or contract | The customer relationship on a CLS or PBL contract; readiness commitments; EAC | Contract deliverables (CDRLs), PBL metric submissions, O&A proposals to the PCO/ACO | Metric disputes with the government PSM; scope creep on "while you have it open" work |
| Production Control / Induction Supervisor | Receiving, evaluate-and-estimate (E&E), routing units through the shop | Induction acceptance, condition code assignment at receipt | Units arriving without paperwork (missing DD 1348-1A), config surprises at teardown |
| Rotable Pool Manager | Exchange pool sizing, serviceable/unserviceable balance, pool asset custody | Pool level changes, condemnation recommendations, exchange releases | Pool starvation from RTAT slips; carcass attrition; funding fights over pool replenishment buys |
| Reliability / Maintainability (R&M) Engineer | MTBF/MTBUR analysis, failure trending, FRACAS, repair-vs-replace economics | Engineering disposition on repeat failures; reliability inputs to PBL pricing | Dirty failure data (bad malfunction codes on notifications); no time-on-wing data from the field |
| Field Service Engineering Manager | FSEs at customer sites and deployed locations; on-site troubleshooting and mod installs | Field service reports, warranty determinations made in the field | FSEs working outside the system; travel-heavy staffing; connectivity at austere sites |
| Warranty Administrator | Warranty master records, claim intake, recovery from suppliers, claims to/from the government | Warranty adjudication (in vs out of warranty), claim packages | Proving in-warranty status without serialized usage data; suppliers slow-rolling recovery |
| Government Property Administrator (contractor side) | Property records for customer-owned units in repair; physical inventories; loss/theft/damage/destruction (LTDD) reporting | Property record accuracy, inventory reconciliation, DCMA PMSA responses | Every repair unit is government property; SAP records vs accountable property ledger drift |
| Quality Manager (AS9110 scope) | Inspection, test acceptance, certifications of conformance, counterfeit parts program | DD Form 250 / WAWF acceptance submissions, serviceable tags (DD 1574) | QAR availability delaying acceptance; counterfeit screening on aged-part buys |

Typical reporting lines: Depot Operations, Production Control, Rotable Pool, and Quality report up through the sustainment business unit; SPMs sit in program management with a dotted line to the depot; the Government Property Administrator usually reports to supply chain or compliance, deliberately outside depot operations; R&M engineering reports to engineering with a service assignment.

Who must be in the room: business model and pricing decisions need the VP Sustainment, SPM, and contracts/finance. Serialization and configuration decisions need Depot Ops, Quality, R&M, and the Property Administrator. Anything touching valuation of pool stock needs the controller plus the Property Administrator. O&A process design needs the SPM, Depot Ops, and someone who knows what the ACO will accept. Never design induction without Production Control; they know what actually shows up on the dock.

## Process

The end-to-end stream is: capture sustainment work, induct unserviceable units, repair and test them, return serviceable assets, and get paid, all while maintaining custody records on property the contractor does not own.

**Business models, from least to most risk transfer:**

1. **Transactional repair** (repair-and-return or exchange): government sends a unit, contractor repairs it under a T&M or FFP-per-unit line, sends it back. Billing is per event.
2. **Contractor Logistics Support (CLS)**: contractor runs sustainment for a fleet (scheduled maintenance, repair, supply support, field service) under a long-term contract, usually cost-plus or FFP with T&M elements. The contractor manages the workload; the government still owns the outcomes.
3. **Performance-Based Logistics (PBL)**: the contractor is paid for outcomes (operational availability, mission capable rate, fill rate, RTAT ceilings) instead of transactions. A fixed price per operating hour or per period buys readiness. This inverts the incentive: under transactional repair, more failures mean more revenue; under PBL, reliability improvements go straight to contractor margin. PBL contracts need a metric engine and a data pedigree the government will trust.
4. **Organic depot partnering**: work-share arrangements with government depots under public-private partnership authority (10 U.S.C. 2474, Centers of Industrial and Technical Excellence), constrained by core depot requirements (10 U.S.C. 2464) and the statutory 50/50 split of depot maintenance funding between organic and contractor sources (10 U.S.C. 2466). The contractor may provide parts, engineering, and workload management while government artisans perform touch labor, or vice versa. Consultants must know which side of the partnership holds the property records and who inducts.

**Rotable and exchange pool economics:** a rotable is a serialized repairable asset that cycles between serviceable and unserviceable condition instead of being consumed. Two contract shapes govern how it cycles:

- **Repair-and-return**: the government sends serial number 123, and gets serial number 123 back after repair. Custody is simple (the unit never leaves government ownership), RTAT is the whole game, and the contractor holds no pool risk. Billing is per repair event.
- **Exchange**: the government sends an unserviceable carcass and immediately receives a serviceable unit from the contractor's pool; the carcass is repaired into the pool later. The customer buys availability; the contractor buys pool risk. Pool sizing is a queueing problem driven by demand rate, RTAT, and condemnation rate: every RTAT slip and every condemnation shrinks the serviceable balance, and replenishment buys on out-of-production parts collide head-on with DMSMS. The commercial terms must define who funds attrition replacement and who owns beyond-economical-repair decisions, because those two clauses decide whether the pool is a profit engine or a slow bleed.

Condition is tracked with supply condition codes on the government side (A serviceable, F unserviceable-reparable, H condemned) and with condition-based split valuation on the SAP side; the two must map cleanly or every shipment becomes a reconciliation.

**Warranty administration and claims recovery:** warranty runs in both directions. Outbound, the contractor warrants its repairs and new spares to the government, so every inbound failure is first screened against warranty status (which requires serialized usage data to prove or deny). Inbound, the contractor recovers from its own suppliers when a failed component is inside the supplier's warranty; on a fleet program the recovery stream is real money and usually undermanaged. The Warranty Administrator owns the adjudication ladder: identify the failed serialized item, check warranty master terms against usage and dates, decide in/out, file or defend the claim, and track credits through to the ledger. Weak notification coding and missing time-on-wing data are what kill recovery rates.

**The induction cycle (the heartbeat of the depot):** receive (match unit to shipping document, typically a DD 1348-1A; open a property record; assign condition code, e.g., F for unserviceable-reparable), evaluate (teardown and E&E: determine actual scope against the negotiated work specification), scope (anything beyond the basic work spec becomes over-and-above work, identified, estimated, and authorized under DFARS 252.217-7028 before proceeding, with pricing definitized per the contract's agreed-to O&A procedures: pre-priced rates, NTE amounts, or a post-authorization negotiated settlement), repair, test (acceptance test procedure, QAR involvement as required), return (serviceable tag DD 1574, condition code A, DD Form 250 acceptance via WAWF/PIEE, ship). RTAT is measured across this whole clock and disputes center on who owns which segment (AWP time, government approval time for O&A, carrier time).

**GovCon overlay this stream owns or feeds:**

- **Government property**: FAR 52.245-1 applies to every customer-owned unit in the shop and every GFP tool or test set. DFARS 252.245-7003 makes the property management system one of the six DFARS business systems; DCMA's property administrator evaluates it via Property Management System Analysis (PMSA) across the process outcomes in FAR 52.245-1(f): acquisition, receipt, records, physical inventory, subcontractor control, reports, relief of stewardship, utilization, maintenance, and property closeout (disposition of contractor inventory is handled separately under 52.245-1(j)). GFP receipt and transfer reporting flows through the PIEE GFP Module (DFARS 252.211-7007), and serially managed items carry IUID marking per DFARS 252.211-7003 and MIL-STD-130.
- **MMAS**: DFARS 252.242-7004 (Material Management and Accounting System) covers how material costs charge to repair orders, transfer between contracts, and reconcile. Rotable pools and exchange transactions are MMAS hot spots because assets move between contract and pool custody.
- **Purchasing**: repair parts buys feed the Contractor Purchasing System Review (CPSR) under DFARS 252.244-7001; counterfeit prevention on aged electronic parts is governed by DFARS 252.246-7007 (counterfeit electronic part detection and avoidance, aligned to SAE AS5553) and DFARS 252.246-7008 (sources of electronic parts), with GIDEP reporting obligations.
- **Billing**: T&M repair bills under FAR 52.232-7 (labor qualifications matter; DCAA checks that billed labor categories match the contract). FFP repair invoices on acceptance. Cost-type CLS follows FAR 52.216-7 including the annual incurred cost submission.
- **CAS**: CAS 402 (consistency: the same E&E labor cannot be direct on one contract and indirect on another), CAS 411 (material cost accounting, which governs how pool and repair material is costed), and CAS 418 (allocation of indirect pools such as material handling over repair work) are the standards this stream most often trips.

**What DCAA/DCMA walk through:** DCAA runs floor checks (is the mechanic charging the repair order they are actually working?), T&M voucher audits, and MMAS testing on material transfers in and out of pools. DCMA walks the property system (pick ten serial numbers, trace from receipt through records to physical location and back), witnesses physical inventories, reviews LTDD cases, and its QAR witnesses acceptance testing and signs DD 250s. The most common finding pattern: SAP shows the unit in one storage location, the accountable property record shows another, and the unit is physically on a test stand belonging to neither.

**Seams with adjacent streams:** rotable and spare parts stocking policy and warehouse execution belong to Inventory-to-Deliver; repair parts procurement (including counterfeit-risk buys from brokers) belongs to Source-to-Pay; the repair sales order, resource-related billing, and invoice belong to Offer-to-Cash. Sustainment owns the demand signal, condition decisions, and the repair execution in between.

## Technology and Systems

SAP footprint for this stream: **PM/EAM** (functional locations, equipment, maintenance notifications and orders, refurbishment orders), **CS** (service notifications and orders, repair sales orders, resource-related billing, warranty), **PP** in a supporting role (refurbishment execution, capacity evaluation on work centers), and **MM** (movements, split valuation, customer special stock). No Dassian modules apply to this stream; the contract and billing side integrates with whatever the Offer-to-Cash stream runs. A deep companion bundle (sap-ad-depot-mro) covers module configuration; this section stays at landscape level.

**Landscape decisions that matter:**

- The serialized installed base and repair execution should live in S/4 (PM/CS), not in a bolt-on, because condition-coded valuation, property custody, and billing all hang off the same order and movement documents.
- **Keep and integrate**: PLM configuration management (Siemens Teamcenter or PTC Windchill) as the engineering authority for as-designed/as-built configuration; S/4 holds as-maintained. Service parts planning tools (PTC Servigistics, Syncron) where PBL fill-rate optimization exceeds what S/4 planning offers; integrate forecasts back to MRP.
- **Evaluate for retirement**: legacy EAM instances (IBM Maximo is the common incumbent) running depot maintenance in parallel with SAP; homegrown induction trackers and Access/Excel O&A logs, which are audit liabilities.
- **Usually keep**: a shop-floor MES where deep work instructions and buyoffs are required (iBase-t Solumina is common in A&D MRO); interface order status and confirmations to S/4 rather than duplicating the maintenance order.
- **Government portals at the boundary**: PIEE/WAWF (receiving reports, DD 250, GFP Module), the IUID Registry, service asset visibility reporting (Navy CAV and its service equivalents, which expect transaction-level repair status feeds from the contractor system), GIDEP (DMSMS and counterfeit alerts), PDREP and supply discrepancy reporting, and SAM.gov on the contracts side. Plan interfaces or disciplined manual swivel-chair procedures with reconciliation controls; auditors treat portal-vs-SAP mismatches as system deficiencies.

## Data

| Data object | Main SAP tables | Owner (role) | Notes |
| --- | --- | --- | --- |
| Functional locations (platform / tail number structure) | IFLOT, IFLOTX | R&M Engineer with Depot Ops | Tail numbers as functional locations; hierarchy mirrors the platform zonal or system breakdown |
| Equipment / serialized components | EQUI, EQKT | Production Control; Property Administrator for customer-owned | Serialized components as equipment records, installed at functional locations; this is the as-maintained configuration |
| Material master incl. valuation | MARA, MARC, MBEW | Rotable Pool Manager (pool items); supply chain for consumables | Split valuation for repairables: commonly valuation category C with types such as C1 new, C2 refurbished, C3 defective, each with its own MBEW value |
| BOMs and task lists | MAST, STKO, STPO; PLKO, PLPO | R&M Engineer / manufacturing engineering | Repair task lists drive E&E and standard work scope |
| Maintenance plans | MPLA | Depot Ops / SPM | Scheduled maintenance under CLS contracts |
| Master warranties | Warranty master data (transaction BGM1) | Warranty Administrator | Assigned to equipment; drives warranty check on notifications and orders |
| Notifications | QMEL | Production Control (creation), R&M (codes) | Malfunction and cause codes are the raw material of reliability analysis; garbage here starves PBL analytics |
| Maintenance / refurbishment orders | AUFK, AFIH; confirmations AFRU | Depot Operations Manager | Refurbishment orders (transaction IW81, standard order type PM04) move stock from unserviceable to serviceable valuation type |
| Repair sales orders and billing | VBAK, VBAP; VBRK | SPM with Offer-to-Cash | Customer unit typically received to non-valuated sales order stock (special stock E, standard core) or customer stock (special stock B, which comes from the SAP A&D/DIMP industry solution and requires its business function to be activated in S/4HANA); either pattern keeps government property out of contractor inventory valuation |
| Goods movements | MATDOC (S/4) | Warehouse with Property Administrator oversight | Movements between valuation types and special stock are the custody audit trail |
| Purchase orders (repair parts) | EKKO, EKPO | Source-to-Pay; Rotable Pool Manager as requester | Broker buys flagged for counterfeit screening |
| Inspection lots / test results | QALS | Quality Manager | Acceptance test evidence supporting DD 250 |

**Migration sequencing** (the order matters): 1) enterprise structure and split-valuation config; 2) material masters with valuation types before any stock; 3) functional location hierarchy top-down; 4) equipment records, then install them at functional locations (installation history is usually cut over as current-state only; full historical genealogy stays in an archive or the legacy system, retrievable but not migrated); 5) BOMs and task lists; 6) maintenance plans with cycle start dates set so nothing comes due on day one; 7) warranty masters; 8) stock loads with condition (valuation type), special stock indicator, and serial numbers reconciled three ways: SAP, the accountable property ledger, and physical wall-to-wall count; 9) open repair orders are usually re-created, not migrated. The property reconciliation (step 8) is the long pole; start it months early.

**CUI and export control:** maintenance and overhaul tech data on military platforms is almost always export controlled (ITAR, 22 CFR parts 120 through 130, or EAR 600-series) and carries distribution statements per DoDI 5230.24. Fleet configuration status, readiness rates, and failure trends are at least CUI; aggregated readiness for some platforms is classified and must never enter the ERP. Serial-number-level repair history tied to tail numbers is CUI. Treat attachments (manuals, test reports) as the highest-risk repository and control them in DMS or the PLM vault with export markings, not as loose network files.

## Security and Authorizations

**PFCG role shapes** (business-role model, one shape per job, plant-scoped):

- **Display Sustainment** (base): display-only across PM/CS/MM objects, restricted by maintenance plant (I_SWERK) and authorization group (I_BEGRP); everyone gets this, including auditors, before anything else.
- **Induction / Production Control**: create notifications (I_QMEL), receive goods, assign condition codes; no order settlement, no billing.
- **Maintenance Execution**: order processing and confirmations by order type (I_AUART limited to repair/refurbishment types), goods issues to orders (M_MSEG_BWA by movement type); cannot change master data.
- **Planner**: task lists, maintenance plans, work scheduling (I_IWERK planning plant, I_INGRP planner group); no goods movements.
- **Rotable Pool Manager**: stock transfers between valuation types, pool reporting; no PO creation, no receipt.
- **O&A Approver**: releases O&A work packages (workflow role, not broad PM authority).
- **Billing Specialist**: resource-related billing (DP90) and debit memo processing (V_VBAK_AAT by sales doc type); no order confirmations.
- **Property Administrator**: display everything plus physical inventory transactions; deliberately cannot post regular goods movements.

**Segregation-of-duties toxic pairs:**

| Toxic pair | Risk | Mitigation |
| --- | --- | --- |
| E&E scoping (estimate O&A) + O&A approval | Self-approved scope growth billed to the government | Workflow approval by SPM or contracts; ACO visibility per DFARS 252.217-7028 |
| Condition code / valuation type change + inventory adjustment posting | Manufacture serviceable assets on paper; hide losses of government property | Split roles; dual control on condemnations; LTDD workflow |
| Purchase repair parts + goods receipt | Fictitious or counterfeit-risk buys received unchecked | Standard P2P split; quality hold for broker-sourced parts |
| Labor confirmation + billing generation (DP90) | Bill unworked hours on T&M | Separate execution and billing roles; DCAA floor-check readiness |
| Warranty claim creation + claim approval/credit | Fraudulent recovery or waived recoveries | Warranty Administrator creates, finance approves credits |
| Equipment/property master maintenance + physical inventory counting | Records adjusted to match a bad count | Property Administrator counts; master data team corrects via documented change |
| Serial number master change + goods movement posting | Break the custody chain on customer property | Serial profile changes locked to master data governance |

**Auditor access:** give DCMA property administrators and DCAA a standing display-only role (the Display Sustainment shape) plus curated extracts (equipment list with location and condition, movement history by serial). Never grant dialog access to posting transactions; never build extracts ad hoc during an audit, because inconsistency across audits is itself a finding.

**Export control specifics:** controlled tech data must be segregated (DMS authorization via document type and status objects such as C_DRAW_TCD/C_DRAW_STA, or kept in the PLM vault entirely). Foreign-person users, including offshore AMS support, must be provably excluded from controlled maintenance documents, serialized military configuration data, and attachment repositories; this is an ITAR requirement, not a preference, and it drives hosting decisions (many programs require US-person-only support and US data residency). Flag controlled materials and equipment with authorization groups so I_BEGRP enforcement backs up the paper policy.

## Analytics and Reporting

| Report | To whom | Cadence | SAP source |
| --- | --- | --- | --- |
| RTAT (repair turnaround time, by segment: receipt-to-induction, E&E, AWP, repair, test, ship) | SPM, depot ops, government PSM/PCO | Weekly internal, monthly contractual | QMEL/AUFK/AFIH dates, movement timestamps in MATDOC |
| Availability / readiness metrics (PBL: Ao, mission capable, fill rate) | Government PSM and PCO per contract CDRL | Monthly, with period lock | Warehouse/snapshot layer fed by orders, stock, and field data; never live-computed |
| Over-and-above status and approvals | ACO, SPM | Weekly during active inductions | Order operations and workflow status |
| Warranty recovery (claims filed, recovered dollars, cycle time) | Finance, VP Sustainment | Quarterly | Warranty masters, notifications, credit memos |
| Depot workload and capacity | Depot Ops Manager, partnering board | Monthly | Order backlog (IW38/IW39), work center capacity evaluation |
| Rotable pool health (serviceable balance, pool availability, condemnation rate) | Rotable Pool Manager, SPM | Weekly | MBEW by valuation type, stock by special stock indicator |
| Government property inventory and reconciliation | DCMA property administrator | Annual physical inventory plus cyclic counts | Equipment records, physical inventory documents |
| Reliability trends (MTBF/MTBUR, top degraders) | R&M engineering, program office | Monthly | Notifications and codes (QMEL), measurement documents (IMRG); classic MCI7-style analysis |
| Asset visibility feed (CAV or service equivalent) | Government item manager systems | Daily / transactional | Repair order status and movements, interfaced |

**Embedded vs warehouse:** run operational analytics (order backlog, WIP aging, AWP list, RTAT work-in-progress) embedded in S/4 via CDS views and Fiori, where planners act on them. Push anything contractual or incentive-bearing (PBL availability, monthly RTAT actuals, warranty recovery) into a warehouse layer with immutable month-end snapshots, because PBL incentives and disputes are argued from period-locked numbers and you cannot re-derive last March from a live system after reversals. The snapshot discipline is the same habit the EVM world uses; borrow it.

**KPIs by role:** Depot Ops Manager: RTAT, throughput, labor efficiency, AWP rate. Rotable Pool Manager: pool availability, fill rate, condemnation rate, pool turn. SPM: contractual metrics (Ao, RTAT compliance), EAC accuracy, award fee scores. Warranty Administrator: recovery dollars, claim cycle time, denial rate. FSE Manager: response time, first-time-fix rate. Property Administrator: inventory accuracy, open LTDD cases, PMSA rating.

## Role of AI

Concrete use cases, ordered by value and feasibility:

1. **Induction scoping assistant**: given a serial number, surface prior repair history, common teardown findings for the part number, and predicted O&A likelihood and scope, so E&E starts from evidence instead of memory. Grounded in QMEL/AUFK history.
2. **AWP and RTAT risk prediction**: flag inducted units likely to stall awaiting parts, based on open POs, supplier lead-time history, and pool balances, early enough to expedite or swap.
3. **DMSMS watch**: parse GIDEP alerts and supplier end-of-life notices, map affected part numbers against BOMs and the installed base, and rank platforms by exposure, feeding the obsolescence board (per the DoD SD-22 playbook).
4. **Warranty claim triage**: match a failure notification against warranty master terms and usage data and draft the claim package or the denial rationale for the Warranty Administrator.
5. **Tech data retrieval for FSEs and artisans**: RAG over maintenance manuals and service bulletins, with the export-control boundary enforced at the corpus level (controlled documents only retrievable by authorized US persons; the model never trained on them).
6. **Rotable pool level recommendation**: simulate pool sizing against RTAT distributions and failure rates and recommend buys or repairs, as decision support to the Rotable Pool Manager.
7. **O&A justification drafting**: assemble findings, photos, task list deltas, and pricing into the approval package format the ACO expects; a human prices and signs.
8. **Custody anomaly detection**: continuously compare SAP location/condition against the accountable property ledger and portal feeds, surfacing drift before DCMA does.

**Compliance boundary:** a human must certify anything that goes to the government or carries legal weight: O&A pricing and any certified cost or pricing data (Truthful Cost or Pricing Data statute), DD 250 acceptance, warranty claims, property records and LTDD reports, PBL metric submissions, and condemnation decisions on government assets. AI drafts, predicts, and reconciles; it does not accept, certify, or condemn. The reason is structural: certifications create False Claims Act exposure, and "the model said so" is not a defense.

**Grounding and auditability rules for AI output feeding government deliverables:** every generated statement must trace to identifiable source records (order numbers, serial numbers, movement documents); retrieval sources are logged immutably with the output; export-controlled corpora are isolated with access enforcement at retrieval time, not prompt time; no free generation of quantities, dates, or prices (numbers are copied from records or computed by deterministic code the AI merely invokes); and any AI-assisted deliverable is marked as such in the internal record so the certifying human knows what to check.

## Operating Model

**Organization variants:** The dominant pattern is a **program-aligned matrix**: SPMs own contracts and customer outcomes; a shared depot (operations, production control, test, quality) executes for all programs; rotable pools are managed per program when contracts require segregation of government assets, centrally when commercial terms allow pooling. A pure **shared-services depot** (one shop, internal work orders from programs) is more efficient but strains CAS consistency and property segregation, so it needs disciplined order-level costing. A pure **program-owned depot** (each program its own shop) appears on very large CLS contracts and wastes capacity everywhere else. Field service is almost always a shared organization deployed against program funding. In partnering arrangements, part of "the depot" is a government facility, and the operating model must define induction authority, property custody, and data exchange across that boundary explicitly.

**Where it sits:** under a Sustainment/Aftermarket business unit peer to production programs at primes; under operations at Tier-2s. The property function deliberately sits outside depot operations. R&M engineering stays in engineering to keep design-loop credibility.

**Calendar:**

- **Weekly**: workload release, AWP scrub, RTAT review, O&A status to the ACO.
- **Monthly**: financial close (WIP on repair orders, resource-related billing runs, revenue on percentage-of-completion CLS lines), PBL metric snapshot and submission, reliability trend review, pool health review.
- **Quarterly**: EAC updates on CLS/PBL contracts (feeding the same EAC governance as production programs), DMSMS/obsolescence board, warranty recovery review, award fee self-assessment where applicable.
- **Annually**: incurred cost submission (FAR 52.216-7, due six months after fiscal year end) including depot indirect pools; wall-to-wall or statistically sampled physical inventory of government property; forward pricing rate updates that set repair labor rates; CPSR and PMSA support on DCMA's cycle; 50/50 partnering workload reporting inputs.

**Government counterparts:** the **PCO** (procuring contracting officer) owns the contract and PBL incentive decisions; the **ACO** (administrative contracting officer, usually DCMA) approves O&A, administers property, and adjudicates business system status; **DCMA specialists** include the property administrator (PMSA), the industrial specialist (production surveillance, delivery schedule risk), and the QAR (in-plant quality, DD 250 witness); **DCAA** audits incurred cost, T&M vouchers, floor checks, and MMAS; the program office **PSM** (product support manager) owns the sustainment strategy and argues the metrics; **DLA item managers** control consumable supply for organic support and show up in partnering. A consultant who confuses the PCO's authorities with the ACO's loses the room immediately.

## How a Consultant Engages This Function

**Workshop casting:** For process design, cast Production Control, Depot Ops, the Rotable Pool Manager, and Quality; SPMs attend the sessions on billing, metrics, and O&A. For data design (serialization, functional location structure, valuation), cast R&M engineering, the Property Administrator, and the controller, and do not proceed without the Property Administrator, because every design decision touches custody. For compliance walkthroughs, bring contracts and the business system owners. Field service design fails without actual FSEs in the room; their managers do not know the workarounds.

**Decision ladder and sign-offs:**

| Decision | Sign-off required |
| --- | --- |
| Business model treatment per contract (transactional vs CLS vs PBL) in system design | VP Sustainment + contracts + finance |
| Functional location / equipment structure (tail numbers, serialization depth, serial profiles) | Depot Ops + R&M + Quality + Property Administrator |
| Split valuation design for repairables (valuation types, pool costing) | Controller + compliance (CAS 411 exposure) + Rotable Pool Manager |
| Customer property stock treatment (special stock, non-valuated) | Property Administrator + controller; validate against FAR 52.245-1 records requirements |
| O&A workflow and approval routing | SPM + contracts, with ACO expectations confirmed |
| RTAT clock definition and segment ownership | SPM + Depot Ops + the customer (contractually, not in a workshop) |
| Billing method mapping (T&M DIP profiles vs FFP) | Finance + contracts + Offer-to-Cash stream lead |
| Portal interfaces (WAWF, CAV, GFP Module) vs manual | Compliance + IT + Property Administrator |

**Common failure modes:**

1. **Treating MRO as manufacturing**: forcing repair through production orders and standard costing. Repair scope is unknown at order creation; the design must absorb E&E-driven scope change, or the shop abandons the system by week three.
2. **Valuated customer property**: receiving government units into valued contractor stock. This inflates inventory, breaks property records, and surfaces in the next PMSA. Non-valuated special stock from day one.
3. **Serialization too shallow or too late**: if serialized components are not equipment records with install/dismantle history, there is no as-maintained configuration, no warranty defense, and no PBL data pedigree. Retrofitting serialization after go-live is brutal.
4. **Split valuation retrofit**: adding condition-based valuation to a live material is one of the most painful conversions in SAP; get valuation categories right before stock loads.
5. **RTAT unmeasurable by design**: nobody captured the timestamps (induction, E&E complete, AWP start/stop) as system events, so the flagship metric lives in a spreadsheet and every number is disputed.
6. **O&A offline**: scope growth managed in email and Excel, invisible to the ACO until the bill arrives; a dispute generator and a system finding.
7. **Pool economics invisible**: exchanges and condemnations posted as plain movements, so nobody can say what the pool is worth or whether it is starving until a PBL fill-rate breach.
8. **Ignoring the partnering boundary**: designing as if the contractor depot were the whole world, then discovering government artisans, government property records, and government IT on half the workload.

**What world class looks like:** a single serialized thread from dock receipt to DD 250, where scanning a serial number shows configuration, condition, custody, warranty status, and open work in one view; condition-coded valuation that makes pool health a query, not a project; an O&A workflow the ACO can see; RTAT with segmented clocks captured as system events and one agreed source of truth; PBL metrics computed from period-locked snapshots that survive audit without heroics; property records that reconcile to SAP continuously so the annual inventory is a confirmation, not an archaeology dig; and reliability data clean enough that R&M engineering feeds design improvements back into the fleet, which under PBL is where the margin actually comes from.
