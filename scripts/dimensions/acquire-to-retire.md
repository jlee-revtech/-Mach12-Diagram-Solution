---
stream: acquire-to-retire
---

# Acquire-to-Retire in a US Government Contractor: The Eight-Dimension Operating Profile

Acquire-to-Retire (A2R) at a GovCon aerospace and defense company is really two intertwined asset worlds. The first is the contractor-owned fixed-asset world: normal FI-AA accounting, capitalization policy, depreciation feeding indirect rates, governed by CAS 404 and CAS 409. The second is the government property world: assets the contractor possesses but the government owns (GFP furnished by the government, CAP acquired by the contractor with title vesting in the government), governed by FAR 52.245-1 and administered as a DFARS business system that DCMA can disapprove. The single most important mental model: government property is NOT on the contractor's fixed-asset books. It is tracked in accountability records at the government's unit acquisition cost, never capitalized, never depreciated into rates. Most implementation failures in this stream come from blurring that line.

## People

The property function is small relative to the value it protects. A disapproved property system triggers payment withholds under the DFARS business systems rule, so these roles carry disproportionate compliance weight.

| Role (client title) | What they own | What they sign off | Day-to-day pains |
| --- | --- | --- | --- |
| Government Property Manager (often titled GPA internally) | The property management system: procedures, self-assessments, DCMA PMSA readiness, the 52.245-1 lifecycle end to end | GFP physical inventory certifications per approved procedures and contract terms, relief of stewardship requests, LTDD reports before submission, property procedures | Records scattered across SAP, spreadsheets, and a legacy property tool; custodians who do not report moves; PMSA findings from stale records |
| Site Property Administrator | Property records and custody at one plant or program site; receipt tagging; physical inventory execution | Count sheets, receipt documentation, custody transfers | Untagged items found on the floor; GFP arriving at the dock with no GFP attachment match; chasing custodians for confirmations |
| Property Custodian (engineers, lab leads, shop supervisors, collateral duty) | Physical care and location accuracy of items assigned to them | Periodic custody confirmations, loss statements when items go missing | It is a side job; they move test equipment between labs and forget to record it |
| Asset Accountant (FI-AA) | Contractor-owned asset masters, capitalization decisions, AuC settlement, depreciation runs, retirements | Capitalization vs expense calls at threshold, asset retirements and write-offs, monthly depreciation posting | AuC (CIP) aging because project managers will not confirm in-service dates; fixed-asset physical inventory nobody wants to do |
| IUID Coordinator | MIL-STD-130 marking execution, UII construction and validation, IUID Registry submissions | Registry submission accuracy, marking waivers or engineering coordination for hard-to-mark items | Marking legacy items after the fact; registry rejects; drawings that leave no room for a 2D data matrix |
| Contracts Administrator (property clauses) | Reading property clauses into each award, maintaining the contract-to-property linkage, GFP attachment intake, closeout property certification with the ACO | Acceptance of GFP attachments, property closeout statements, flow-down of 52.245-1 to subcontractors | GFP attachments that do not match what physically arrived; mods that add GFP nobody told the property office about |
| Facilities Manager | Real property and installed plant equipment, maintenance programs that satisfy the clause's maintenance outcome | Facility project capitalization packages, real property records | Distinguishing government-funded facility improvements from contractor capital |
| Plant Clearance / Disposition Specialist | Excess identification, inventory disposal schedules (electronic SF 1428 equivalents) built in the plant clearance capability of the PIEE GFP Module, scrap procedures | Disposal schedules before submission, scrap certifications | Plant clearance cases that sit unscreened; programs hoarding excess to avoid the paperwork |
| Controller (stakeholder, not daily) | Fixed-asset policy, CAS 404/409 consistency, depreciation in forward pricing and incurred cost rates | Capitalization policy changes, impairments, asset class design | Auditor questions about consistency between disclosure statement and practice |

Typical reporting lines:

- Government Property Manager: usually reports into Supply Chain or Contracts, occasionally into Finance. Site property administrators report to the Property Manager with dotted lines to site operations leadership.
- Asset Accountants: always report to the Controller, never to the property office.
- IUID Coordinator: sits inside the property office or in quality engineering, depending on whether the client's IUID pain is records (property) or marking (manufacturing/quality).
- Property Custodians: line employees in engineering, labs, and operations; property is a collateral duty for them.

This split matters: property (accountability) and asset accounting (value) are different departments at almost every prime, and your design workshops must include both or the off-book/on-book boundary will be drawn wrong.

Who must be in the room, by decision:

| Decision | Required in the room |
| --- | --- |
| Asset classes, depreciation areas, capitalization thresholds | Controller, Asset Accountant, tax (for tax depreciation areas) |
| Government property record structure and data elements | Government Property Manager, a working Site Property Administrator, Contracts |
| Receiving and tagging flow (incl. GFP no-PO receipt) | Warehouse/receiving lead, Site Property Administrator |
| IUID scope, marking approach, registry process | IUID Coordinator, quality or engineering representative |
| Disposition, scrap, and plant clearance flow | Plant Clearance Specialist, Contracts |
| Retire vs integrate the incumbent property tool | Property Manager, IT, with a pre-brief to the DCMA property administrator |

Never let IT decide any of these alone.

## Process

The end-to-end stream, contractor-owned side:

1. Capital request and approval against the capital budget, with a capitalize-vs-expense call at the threshold.
2. Procurement or internal build, usually a PS capital project carrying an AuC (asset under construction) via an investment profile.
3. Receipt or completion, with the in-service date confirmed by the responsible program or facilities owner.
4. Capitalization: settle the AuC to the final asset; depreciation starts.
5. Depreciation into cost pools monthly, flowing into forward pricing and incurred cost rates.
6. Transfers between plants and cost centers, impairment review, and eventually retirement and disposal with gain/loss recognition.

The CAS overlay on that side: CAS 404 requires a written capitalization policy applied consistently; its ceilings are a minimum service life of 2 years and an acquisition cost threshold that may not exceed $5,000, and DCAA tests actual practice against the disclosed policy (the CAS disclosure statement). CAS 409 governs depreciation methods and lives and the treatment of gains and losses on disposition. Both flow into indirect rates that price every contract, which is why a capitalization threshold change is a Controller decision with disclosure statement consequences, not an IT config tweak.

The government property side follows the FAR 52.245-1 property management lifecycle. The clause's system criteria enumerate the processes a contractor system must perform: acquisition, receipt, records, physical inventory, subcontractor control, reports, relief of stewardship responsibility, utilization, maintenance, and property closeout. In practice:

1. Acquisition and receipt. GFP arrives against the contract's GFP attachment (the standardized list of scheduled and requisitioned GFP managed through the government's PIEE environment); CAP is bought by the contractor on a government contract where title vests in the government, typically on cost-type contracts when the cost is charged direct. Receipt must reconcile what arrived against shipping documents and the GFP attachment, tag the item, and open the record. A GFP receipt has no purchase order and no invoice, which breaks naive three-way-match receiving designs.
2. Records. The clause requires specific data elements on each record: name, part number, and description (national stock number where applicable); quantity received or fabricated, issued, and balance on hand; unit acquisition cost; unique item identifier where applicable; unit of measure; accountable contract number or equivalent code; location; disposition; posting reference and date of transaction; and date placed in service where required. Add custodian and use status as a recommended extension beyond the clause minimum; PMSA reviewers expect custody assignment even though the clause does not enumerate it. Records completeness against this element list is a standing PMSA test.
3. Physical inventory. Cadence is set by the contractor's approved procedures and varies by property type: equipment, special tooling, and special test equipment are commonly on annual to triennial cycles by risk; material is typically counted annually or under a statistical cycle-count program; real property gets a periodic existence check; and a completion inventory is performed at contract end. Results are certified, discrepancies investigated, and adjustments documented.
4. Reports. Physical inventory results reported and certified per the contractor's approved procedures and contract terms (annually at many contractors, plus a completion inventory at contract end; there is no government-wide annual certification mandate), LTDD reports as events occur, IUID Registry updates for UII-bearing GFP, and property records produced on demand.
5. Loss, theft, damage, destruction (LTDD). DFARS 252.245-7005 (Management and Reporting of Government Property, the consolidated clause on contracts awarded on or after 22 January 2024; its predecessor 252.245-7002 still governs older awards) requires reporting loss of government property; contractors file through the GFP Module's property loss process in the government's PIEE environment, DCMA investigates or accepts, and the outcome is either relief of stewardship responsibility (the contractor is relieved of accountability and liability) or a demand for compensation. Chronic LTDD is the fastest route to a system deficiency.
6. Utilization and maintenance. Property used only as authorized on the accountable contract; documented maintenance for equipment and STE.
7. Disposition and closeout. Excess is reported on inventory disposal schedules generated as electronic SF 1428 equivalents in the plant clearance capability of the GFP Module in PIEE (the retired standalone PCARSS system, which stopped accepting new schedules in 2022, survives only as a name consultants still hear on site); the DCMA plant clearance officer screens for reutilization, then issues disposal instructions (return, transfer, sale, scrap, abandonment). Scrap moves under approved scrap procedures. Contract closeout requires a property certification that all government property is dispositioned, which gates final invoice and closeout with the ACO.

Property categories drive different treatments: material (consumed into end items, quantity-tracked, usually the pegging/valuation domain of MM), equipment, special tooling and special test equipment (item-tracked, tagged, often IUID-marked, inventoried on cycles), and real property (facilities, government-funded improvements). Special tooling and STE on legacy programs are the classic record-quality graveyard.

Control points a consultant should design into the flow, in order of audit weight:

- GFP receipt reconciliation against the contract's GFP attachment before the record opens (no orphan receipts).
- Record creation completeness check against the clause data elements at the moment of receipt or fabrication, not at certification time.
- Segregated count / recount / difference-approval steps in physical inventory, with value thresholds for second-person recounts.
- LTDD trigger discipline: any unresolved inventory discrepancy above tolerance converts to an LTDD case, never a silent adjustment.
- Disposition gate: no scrap movement or retirement posting without a completed disposition case (a plant clearance disposal instruction or approved scrap procedure) behind it.
- Closeout gate: final property certification produced from the records, reconciled to the accountable contract, before Contracts releases the closeout package.

The property management system is one of the six DFARS business systems. DFARS 252.245-7003 (Contractor Property Management System Administration) makes 52.245-1's criteria the adequacy standard; DCMA's property administrator runs the Property Management System Analysis (PMSA), typically on a multi-year cycle or triggered by LTDD trends. Significant deficiencies lead to disapproval and payment withholds under the contractor business systems clause (DFARS 252.242-7005).

What DCMA walks through in a PMSA:

- Written procedures vs observed practice, criterion by criterion against 52.245-1(f).
- A records-to-floor sample (does the item exist where the record says) and a floor-to-records sample (is the item on the floor in the records at all), testing existence and completeness in both directions.
- Receipt documentation for GFP and CAP, including the no-PO paper trail and tagging evidence.
- Physical inventory results, reconciliations, and whether discrepancies became LTDD cases or quiet adjustments.
- LTDD history, investigation quality, and root-cause closure.
- Subcontractor control: flow-down of 52.245-1 and evidence the prime surveils subcontractor property systems holding its accountable property.
- Disposition files (inventory disposal schedules, plant clearance case history in the GFP Module, scrap records) and closeout timeliness.

What DCAA (as opposed to DCMA) touches in this stream: depreciation and gains/losses in the incurred cost submission, CAS 404/409 consistency between disclosed practice and postings, and whether government-titled property crept onto the books and into rates, which is a CAS noncompliance and a rate overstatement at once.

Other clauses a consultant should recognize on sight:

| Clause | What it does in this stream |
| --- | --- |
| FAR 52.245-1 | The Government Property clause: lifecycle, system criteria, records elements, LTDD, relief of stewardship |
| FAR 52.245-9 | Use and charges: rental-equivalent charges when government property supports non-government work |
| DFARS 252.245-7005 | Management and Reporting of Government Property: the consolidated clause on awards from 22 January 2024 onward. Carries marking of serially managed GFP, loss reporting through the PIEE GFP Module, IUID Registry reporting of GFP, and the reporting/reutilization/disposal obligations, including mandatory use of the GFP Module's plant clearance capability to generate the electronic SF 1428 equivalent |
| DFARS 252.245-7001 / -7002 / -7004; 252.211-7007 | The legacy GFP tagging/marking, loss-reporting, reutilization/disposal, and GFP IUID-reporting clauses. Removed and reserved effective January 2024 (consolidated into 252.245-7005), but the rule is not retroactive, so they remain operative on pre-2024 awards and consultants will still see them on long-running programs |
| DFARS 252.245-7003 | Property management system administration: the business-system adequacy clause behind the PMSA |
| DFARS 252.211-7003 | Item unique identification and valuation: IUID marking on deliverables and qualifying items (MIL-STD-130) |
| DFARS 252.242-7005 | Contractor business systems: the withhold mechanism when the property system is disapproved |

## Technology and Systems

Keep this at landscape level (the deep companion bundle sap-government-property-a2r covers property configuration).

SAP core for the stream:

- FI-AA: new Asset Accounting in S/4HANA, ledger-aligned depreciation areas, asset masters, AuC classes, depreciation run (AFAB), values in ACDOCA. This is the contractor-owned book of value only.
- MM-IM: goods receipt via MIGO including no-PO and free-of-charge receipt patterns for GFP, physical inventory documents, non-valuated material types (UNBW pattern) for government-titled stock so quantity is visible without value on the books.
- PS: capital projects with WBS and investment profiles, AuC settlement via CJ88, and program WBS linkage for accountable-contract traceability on both sides of the stream.
- PM equipment masters (EQUI) with serial numbers: the common SAP anchor for item-tracked property (equipment, special tooling, STE).
- Dassian GFP / property accountability module: supplies what core SAP lacks, namely government property records carrying the 52.245-1 data elements, accountable contract association, custodian assignment, GFP vs CAP designation, and property-book reporting a PMSA can be walked through.

Non-SAP systems typically found at a GovCon client:

- A dedicated property accountability tool: Sunflower Assets, AssetSmart, or eQuip; frequently the incumbent system of record for the property book.
- Maintenance: IBM Maximo, or SAP PM if the client kept it in the ERP.
- IUID marking and registry submission: A2B Tracking or ID Integration.
- Barcode/RFID scanning hardware (commonly Zebra) with a mobile inventory or asset-tracking app.
- Program-side spreadsheets acting as shadow property books; these must be identified in discovery and retired deliberately.

Keep/retire/integrate ladder: (1) If Dassian GFP is in scope, retire the standalone property tool and make SAP-plus-Dassian the property book; the win is one record set spanning value, quantity, and accountability. (2) If the client keeps Sunflower/AssetSmart/eQuip (common when the property office resists an ERP program's timeline), integrate: SAP remains the book of value (FI-AA) and quantity (MM-IM), the property tool remains the book of accountability, and you must define the reconciliation interface and ownership of each data element explicitly, or the PMSA sample will find mismatches. (3) Never run two accountability books in parallel "temporarily"; that state becomes permanent and both go stale.

Government portal at the boundary: PIEE, the DoD procurement environment that hosts the relevant applications under one sign-on: WAWF (acceptance), the GFP Module (GFP attachments, shipment/receipt/transfer transactions, property loss reporting, and the plant clearance capability that generates electronic SF 1428 disposal schedules; the retired standalone PCARSS survives only as a name consultants still hear), and the IUID Registry (UII registration and GFP reporting). These are submission boundaries: data leaves the contractor landscape into government systems, so output quality and human certification controls live here.

## Data

| Object | Main SAP tables | Owner (from People) | Notes |
| --- | --- | --- | --- |
| Fixed asset master (contractor-owned) | ANLA, ANLZ, ANLB (values in ACDOCA in S/4) | Asset Accountant | Asset class drives capitalization behavior; never create asset masters for government-titled property with value |
| Asset under construction / capital project | ANLA (AuC class), PRPS, PROJ | Asset Accountant with PS project manager | Settlement chain WBS to AuC to final asset (CJ88, AIAB/AIBU) |
| Government property record (GFP/CAP) | Dassian GFP tables; commonly anchored to EQUI equipment masters with serial numbers | Government Property Manager / Site Property Administrator | Carries the 52.245-1 data elements incl. government unit acquisition cost and accountable contract number; zero GL value |
| Material master (government-titled material) | MARA, MARC | Site Property Administrator with materials management | Non-valuated handling; quantity on hand must tie to property records |
| Goods movements and receipts | MATDOC (MSEG compatibility) | Warehouse lead / Site Property Administrator | GFP receipts have no PO; document the GFP attachment reference |
| Physical inventory documents | IKPF, ISEG | Site Property Administrator | Count, recount, difference posting are separate duties (see Security) |
| Equipment / serial numbers | EQUI, EQKT, OBJK | Site Property Administrator; Facilities for installed plant | Serial + UII fields are the IUID hooks |
| Depreciation and asset postings | ACDOCA, ANEK-era docs via posting transactions | Asset Accountant | Feeds indirect pools; DCAA territory |
| Contract-to-property linkage | Contract number on Dassian property record; WBS/PRPS for program association | Contracts Administrator | Accountable contract is a required record element; also drives closeout lists |

Migration objects and load sequencing for this stream:

1. Configuration first: asset classes, depreciation areas and keys, capitalization thresholds aligned to the CAS 404 written policy and disclosure statement.
2. Contractor-owned assets via FI-AA legacy transfer (AS91/ABLDT or the migration cockpit fixed-asset object) with values reconciled to the trial balance and to the prior depreciation schedules DCAA has already seen. A migration that changes accumulated depreciation is a rate event; reconcile to the penny.
3. Open AuC balances with their WBS assignments, so in-flight capital projects settle correctly after cutover.
4. Equipment masters and serial numbers (the item-tracked anchor records).
5. Government property records loaded valueless into Dassian/equipment with every 52.245-1 data element populated, reconciled item-by-item to the outgoing property book and to contract GFP attachments.
6. Open physical inventory campaigns and open LTDD cases last, once the records they reference exist.

Two sequencing gotchas: do not load government property before its accountable contracts exist in the system (the contract number is a required record element and the linkage drives closeout), and never let a load program default a missing unit acquisition cost to zero silently; missing elements are a records-completeness finding, so flag and remediate before or at load, not after.

CUI and export control on this stream's data:

- Property records for defense articles, GFP attachments, and IUID data tied to weapon-system part numbers are typically CUI and must live inside the CUI boundary. This constrains where reporting extracts, integration middleware, and AI tools may run.
- Special tooling and STE records often embed ITAR-controlled technical data (drawings, part geometry references, program identifiers). Treat those records and their attachments as export controlled, restrict them to authorized persons under the client's technology control plan, and keep them out of any commercial-cloud analytics path that has not been cleared.
- Migration staging areas and extract files inherit these classifications; a load file on an uncontrolled file share is a spill.

## Security and Authorizations

PFCG role shapes for this stream (single-function roles composed per user, never one "property super user"):

- Asset Accountant: asset master maintain (AS01/AS02), acquisitions/retirements posting, AuC settlement execution, depreciation run execute; display on PS and MM.
- Asset Accounting Supervisor: approve retirements and write-offs, period close for FI-AA; no master-data create.
- Site Property Administrator: property record maintain (Dassian/EQUI), physical inventory create and count entry, custody transfer; display-only on FI-AA values.
- Property Manager: property record display all sites, inventory difference approval, LTDD case management, report generation; deliberately little transactional create.
- Warehouse/Receiving: goods receipt including no-PO GFP receipt; no inventory difference posting.
- IUID Coordinator: UII field maintenance on equipment/property records, registry extract generation; no financial postings.
- Plant Clearance: disposition status maintenance, disposal schedule extract; cannot post scrap movements themselves.

| Toxic pair (SoD) | Risk | Mitigation |
| --- | --- | --- |
| Create asset master + post asset acquisition | Fictitious assets into the books and rates | Split master data from posting; monitored exception role for small sites with quarterly review |
| Goods receipt + physical inventory difference posting (MI07) | Receive short, hide it in count adjustments | Difference posting restricted to Property Manager or supervisor role |
| Physical inventory count entry + difference approval | Self-approving inventory write-offs | Counter and approver roles separated; recounts by a second person above a value threshold |
| Property record maintenance + LTDD case closure | Deleting records to bury losses instead of reporting | LTDD closure only in Property Manager role; record deletions logged and reviewed |
| Asset retirement posting + disposal/scrap execution | Assets retired on paper and diverted physically | Retirement posts only against a completed disposition case reference |
| Depreciation key/useful life maintenance + depreciation run | Manipulating rates charged to the government | Config changes via transport with Controller approval; run role has no config access |

Auditor access design: build a display-only "government reviewer support" role (property records, inventory documents, movement history, asset values) that internal staff use when hosting DCMA/DCAA; government auditors normally do not get system logons, they get records produced on demand, so the real requirement is fast, complete, reproducible extracts with posting references. Log and retain what was produced for which audit request.

Export-control specifics: gate ITAR-flagged property records and attached technical data to authorized-person roles (structural authorizations by plant/program plus an export-control attribute); non-US-person users, including offshore AMS support, must be excluded from those objects and their attachments; and any replication of property data to BI or AI platforms inherits the same restriction.

## Analytics and Reporting

| Report | To whom | Cadence | SAP source |
| --- | --- | --- | --- |
| GFP physical inventory results and certification | DCMA property administrator / per contract terms | Per approved procedures and contract terms (annual at many contractors, plus completion inventory at contract end) | Dassian property records + IKPF/ISEG results, certified by Property Manager |
| LTDD report | DCMA via the PIEE property loss process | Per event | Dassian LTDD case + movement/record history |
| IUID Registry updates for GFP | IUID Registry (in PIEE) | Per receipt/change per DFARS 252.245-7005 (252.211-7007 on pre-2024 awards) | Equipment/property UII fields, extract via IUID coordinator |
| Inventory disposal schedules (electronic SF 1428 equivalents) | DCMA plant clearance officer via the PIEE GFP Module plant clearance capability | Per excess event | Dassian disposition cases + record extracts |
| Contract closeout property list and certification | ACO / Contracts | Per contract closeout | Property records filtered by accountable contract |
| Property records on demand | DCMA PMSA / DCAA requests | Ad hoc, fast turnaround | Dassian/EQUI + MATDOC + ACDOCA posting references |
| Fixed-asset roll-forward and depreciation schedule | Controller, external audit, DCAA (incurred cost submission schedules) | Monthly close / annual ICS | FI-AA reporting on ACDOCA (asset history sheet) |
| AuC/CIP aging | Controller, program managers | Monthly | AuC balances by WBS |
| Depreciation forecast for forward pricing rates | FP&A / rates group | Annual FPRP cycle, updated quarterly | FI-AA depreciation simulation |

Embedded vs warehouse guidance:

- Embedded in S/4 (CDS views, Fiori apps): operational property reporting, records on demand, count status, LTDD queues, closeout lists. The reason is audit traceability: numbers carry live posting references an auditor can follow into documents.
- Warehouse layer (SAC or the client's BI stack): trend analytics such as LTDD rates over time, inventory accuracy by site, disposition cycle time, depreciation waterfall scenarios.
- Never let a warehouse copy become the audit answer of record; the property book answer must come from the system of record, and anything leaving for BI respects the CUI/ITAR boundary from the Data section.

KPIs the client roles are measured on:

| KPI | Measured on | Notes |
| --- | --- | --- |
| Physical inventory accuracy (record-to-floor and floor-to-record) | Property Manager, Site Property Administrators | Typically targeted north of 98 percent for item-tracked property |
| Records completeness vs clause data elements | Property Manager | Standing PMSA sample; measure it before DCMA does |
| LTDD count and dollar value; root-cause closure time | Property Manager, custodian organizations | Trend triggers PMSA attention |
| PMSA result | Property Manager (career-defining) | Approved system, zero significant deficiencies |
| Disposition cycle time (excess declared to plant clearance case closed) | Plant Clearance Specialist | Hoarded excess is carrying cost plus audit risk |
| Closeout property certification timeliness | Contracts, Property Manager | Gates final payment and closeout metrics |
| AuC aging | Asset Accountant | Late capitalization understates current rates |
| Depreciation forecast vs actual | Controller / rates group | Forward pricing credibility |
| IUID registry rejection rate | IUID Coordinator | Data quality proxy for the whole marking process |

## Role of AI

Concrete use cases with real payoff in this stream:

1. GFP attachment reconciliation: extract line items from contract GFP attachments and mods, match against property records and receipts, and surface unmatched or duplicate items for the Site Property Administrator. This is tedious, high-volume matching where AI-assisted entity resolution beats humans.
2. Records-completeness auditing: continuously score every property record against the 52.245-1 required data elements, rank gaps by PMSA exposure, and draft remediation worklists.
3. LTDD narrative drafting and root-cause clustering: draft the loss report narrative from movement history and custodian statements, and cluster historical LTDD cases to find systemic causes (a lab, a process, a part family) before DCMA does.
4. Physical inventory anomaly detection: flag counts that statistically deviate (same counter always matches, adjustments clustering under approval thresholds, serial numbers reappearing after write-off).
5. Capitalization classification assistant: read purchase and project descriptions and recommend capitalize-vs-expense and asset class per the client's CAS 404 policy, with the policy text cited.
6. IUID data validation: check UII construction, marking data, and registry payloads against MIL-STD-130 rules before submission to cut registry rejects.
7. Disposition recommendation: given item condition, demand history, and program status, recommend reutilization vs transfer vs scrap and pre-fill the electronic SF 1428 data for the GFP Module plant clearance case.

Compliance boundary: a human with delegated authority must certify anything that goes to the government, because certifications carry personal and corporate liability (and knowingly false submissions invite False Claims Act exposure). Concretely: the Property Manager certifies physical inventory results and signs LTDD submissions and relief-of-stewardship requests; Contracts signs closeout property certifications; the Asset Accountant owns every capitalization posting. AI drafts, ranks, and reconciles; it never submits to PIEE applications (WAWF, the GFP Module including its plant clearance capability, or the IUID Registry), and it never posts to FI-AA or closes an LTDD case.

Grounding and auditability rules for AI output feeding government deliverables: every AI-produced figure or line item must carry a traceable reference to system-of-record data (document numbers, record IDs, posting dates), never to a model's summary of them; retrieval must run against the live property book, not a stale extract; prompts and outputs for deliverable-feeding runs are retained as workpapers; models processing property records for defense articles run inside the client's CUI/ITAR boundary; and any AI-drafted government submission shows a visible reviewed-by and certified-by trail before release.

## Operating Model

Organization variants seen in the field:

- Shared-services property office: one corporate Property Manager, site property administrators aligned to plants, custodians embedded in programs. Most common at primes, best for PMSA consistency because procedures and tooling are uniform.
- Program-aligned property: property administrators inside major program organizations with a thin corporate policy layer. Responsive to programs but drifts into inconsistent practice, and DCMA samples across programs, so one weak program taints the system rating.
- Hybrid matrix (the usual end-state recommendation): corporate property standards and tooling, site administrators solid-line to a central property director and dotted-line to site general managers.

Asset accounting is always a Controller function regardless of variant. The property office most commonly sits under Supply Chain or Contracts; arguing about which matters less than giving it a direct escalation path to whoever owns business-system health, because a disapproved property system withholds payments company-wide, not just on the offending program.

Calendar of the function:

| Cadence | Activities |
| --- | --- |
| Monthly | FI-AA close: depreciation run, AuC settlements, additions/retirements review, roll-forward to the Controller; property office: receipts reconciliation, custody transfer cleanup, LTDD case progress, cycle counts per plan |
| Quarterly | Inventory accuracy reporting; self-assessment sample against 52.245-1 criteria; AuC aging review with program managers; depreciation forecast refresh for rates |
| Annually | Physical inventory campaigns and GFP inventory certifications where the contractor's approved procedures and contract terms set an annual cadence (common in practice, though the clause requires periodic inventory per procedures, not a government-wide annual certification); fixed-asset existence verification; depreciation and gain/loss schedules into the incurred cost submission (due roughly six months after fiscal year end); forward pricing rate proposal support; procedures review and training refresh; completion inventories as contracts end |
| Event-driven | PMSA hosting (multi-year DCMA cycle or triggered by LTDD trends); LTDD reporting; plant clearance cases in the GFP Module; contract closeout property certifications; CAS disclosure statement updates when capitalization practice changes |

Government counterparts and what each one wants:

- PCO (procuring contracting officer): puts GFP on contract and owns the GFP attachment; mods that add or delete GFP originate here.
- ACO (administrative contracting officer, usually DCMA): administers property matters day to day and owns contract closeout, where the property certification lands.
- DCMA Government Property Administrator (the government-side GPA): runs PMSAs, adjudicates LTDD cases, grants relief of stewardship, and rates the property system. The single most important external relationship this function has.
- DCMA Plant Clearance Officer: screens disposal schedules in the GFP Module plant clearance capability and issues disposal instructions.
- DCMA Industrial Specialists: appear around special tooling, STE, and production capacity questions.
- DCAA: touches the stream through the incurred cost audit (depreciation, gains/losses) and CAS 404/409 compliance testing.

A well-run property office knows its DCMA GPA by name and pre-briefs them on system changes, including an SAP go-live: an ERP cutover that changes property records is exactly the kind of event that invites a system review, so bring DCMA along early rather than surprising them with a new records format at the next PMSA.

## How a Consultant Engages This Function

Workshop casting: run the on-book (FI-AA) and off-book (government property) tracks as separate workshop series with a joint session on the boundary.

- FI-AA track: Controller, Asset Accountant, tax, FP&A/rates, and a PS representative for capital projects.
- Property track: Government Property Manager, one working Site Property Administrator (not just the corporate manager; you need someone who actually tags items), Contracts, warehouse/receiving lead, IUID Coordinator, Plant Clearance Specialist.
- Joint boundary session: CAP receipt (contractor buys, government title vests), fabrication of special tooling that becomes government-titled, and closeout title transfers. These are the flows that cross the on-book/off-book line and they are where designs contradict each other if the tracks never meet.
- Do not cast a property design workshop without receiving; the dock is where the process breaks.

Decision-to-signoff map:

| Decision | Who signs | Why them |
| --- | --- | --- |
| Capitalization thresholds, asset classes, depreciation areas and keys | Controller (with tax) | Binds the CAS disclosure statement and every indirect rate |
| Property record structure, data elements, category treatment | Government Property Manager | They certify to it at the next PMSA |
| GFP receiving flow (no-PO receipt, tagging point, attachment reconciliation) | Property Manager and warehouse lead jointly | One owns compliance, the other owns the dock |
| IUID scope and marking approach | IUID Coordinator with quality/engineering | Marking touches drawings and manufacturing process |
| Disposition and scrap flow | Plant Clearance Specialist with Contracts | GFP Module plant clearance process plus contractual closeout duties |
| Retire vs integrate the incumbent property tool | Property Manager plus IT | A system-of-record change gets briefed to the DCMA GPA before cutover, not after |

Common failure modes of implementations in this stream:

- Government property capitalized into FI-AA with value "so we can see it in the asset register." It then depreciates into indirect rates: a CAS noncompliance and defective pricing exposure in one move. Government property gets records, not book value.
- GFP receiving designed around purchase orders. GFP has no PO; if MIGO paths require one, sites invent dummy POs and the audit trail rots. Design the no-PO/free-of-charge receipt path explicitly with the GFP attachment as the reference document.
- Migrating the legacy property book as-is, gaps included. Migration is the once-a-decade chance to remediate records completeness; loading known-bad records into a new system re-certifies the problem.
- No accountable-contract linkage on property records, making closeout lists and the annual certification hand-built spreadsheets again.
- Physical inventory designed only for valuated MM stock, leaving item-tracked equipment and STE (the PMSA's favorite sample) without count documents or difference workflow.
- IUID treated as a data field instead of a process: UII fields exist but nothing governs marking, validation, or registry submission, so the field is empty or wrong.
- Two property books running in parallel after go-live because the interface reconciliation was never assigned an owner.
- AuC settlement discipline ignored, so CIP ages, in-service dates slip, and depreciation starts late (understating current rates and storing up a true-up fight).

What world class looks like: one integrated record per item spanning accountability, quantity, and value with the on-book/off-book line drawn cleanly; records that pass a cold records-to-floor sample any day of the year; GFP attachment-to-receipt-to-record reconciliation running continuously instead of at certification time; LTDD as a managed metric with root-cause closure, not an annual embarrassment; plant clearance cases opened in the GFP Module within days of excess declaration; closeout property certifications produced from the system in hours; a DCMA GPA who treats the contractor's self-assessment as reliable; and an asset accounting function whose depreciation forecast lands within a point of actuals in the forward pricing rate cycle. That is the standard to aim the client at, and every design decision in this stream should be tested against the question: can the Property Manager certify this, and can DCMA sample it, without a spreadsheet in between?
