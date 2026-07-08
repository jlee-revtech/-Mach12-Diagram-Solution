---
stream: inventory-to-deliver
---

# Inventory-to-Deliver in a US Government Contractor: The Eight-Dimension Operating Profile

## People

Inventory-to-Deliver (I2D) at a GovCon aerospace and defense company is the warehouse, stockroom, shipping dock, and transportation function. It is where physical material custody meets contract accountability: every bin location is also a cost objective, and every shipment is a contractual event. The roles below exist at essentially every defense OEM prime and Tier-2 supplier running SAP S/4HANA.

| Role | What they own | What they sign off | Day-to-day pains |
| --- | --- | --- | --- |
| Warehouse / Logistics Manager | All stockrooms, dock operations, storage layout, headcount, cycle count program execution | Physical inventory results, count adjustments above tolerance, storage location design, warehouse SOPs | Blamed for inventory record accuracy misses caused by shop-floor unreported consumption; space pressure from aging program stock nobody will disposition |
| Receiving Lead | Dock-to-stock: unload, ID, count, route to inspection, put-away; GFP receipt processing | Goods receipt postings, discrepancy reports (overage/shortage/damage), GFP receipt acknowledgment in PIEE | Material arriving without PO reference or with wrong markings; supplier packing slips that do not match PO units of measure; inspection queue backlogs blocking put-away |
| Shipping Lead | Pick, pack, ship execution; DD250 packet assembly; carrier handoff | Post goods issue, packing lists, DD250 data before WAWF submission, MIL-STD-129 label content | End-of-quarter shipment surges; contracts data (CLIN, ACRN, ship-to DoDAAC) wrong on the delivery and discovered at the dock; QAR unavailable for source acceptance |
| Inventory Control Analyst | Book-to-floor record integrity, cycle count scheduling, adjustment research, special stock reconciliation | Count document differences before posting, stock transfer requests between contracts, root cause writeups on record errors | Chasing 411/415 transfer approvals across contracts and finance; negative-stock symptoms from backflush timing; MMAS evidence requests during audits |
| Traffic / Transportation Manager | Carrier selection, routing, freight terms, export shipment booking, hazmat compliance | Bills of lading, commercial invoices, EEI filing data, carrier claims | Premium freight caused by upstream schedule slips landing in the traffic budget; AES filing rejections at cutoff; FMS routing instructions that contradict the contract |
| Packaging Lead (MIL-STD-2073) | Military preservation and packaging design and execution, packaging specs per contract | Packaging conformance to MIL-STD-2073-1 requirements, special packaging instructions | Contracts flowing packaging requirements late; long-lead custom containers; unit pack quantity conflicts with delivery lot sizes |
| Government Property Manager | Government property records, GFP custody, loss/damage/destruction reporting, property audits | GFP receipt records, annual GFP inventory certification, LDD reports, plant clearance cases | GFP arriving with no contract attachment authorizing it; reconciling SAP stock to the PIEE GFP module; DCMA Property Management System Analysis findings |
| Export Compliance Officer (dotted line into I2D) | License determination, denied party screening disposition, ITAR/EAR classification decisions at the shipment boundary | Release of export shipments, screening hit resolutions, AES filing accuracy | Dock pressure to ship versus unresolved screening hits; engineers hand-carrying items without export review |

Typical reporting lines: Warehouse Manager, Receiving, Shipping, Inventory Control, Traffic, and Packaging report up through a Director of Materials or Logistics to a VP of Operations or Global Supply Chain. The Government Property Manager frequently reports through Contracts or Compliance rather than Operations, deliberately, to keep custody and recordkeeping independent. Export Compliance reports to Legal or a Chief Compliance Officer, never to the shipping function it polices.

Who must be in the room: special stock and inter-contract transfer design requires Inventory Control, the Government Property Manager, program finance, and Contracts. Acceptance and DD250 flow design requires Shipping, Quality (the QAR interface owner), Contracts, and Billing. Warehouse technology decisions (IM vs Stock Room Management vs EWM) require the Warehouse Manager and IT, with Receiving and Shipping leads as reality checks. Export-at-dock design cannot be signed off by anyone except the Export Compliance Officer or the company's empowered official.

## Process

End-to-end, I2D in a GovCon S/4HANA company runs: receive (dock, identify, GR against PO, route to incoming inspection, put-away), store and custody (by special stock category and by program segregation rules), issue and kit to the shop floor, transfer between contracts (a controlled, approved event, never a casual bin move), pick/pack/ship with handling units, government acceptance via DD250, returns and repairs, physical inventory and cycle counting, and excess/scrap/disposition (plant clearance when government property is involved).

The GovCon overlay this stream owns or feeds:

| Requirement | Source | What I2D owns |
| --- | --- | --- |
| Material Management and Accounting System (MMAS) | DFARS 252.242-7004 | The inventory-record-accuracy evidence (the clause names a 95 percent record accuracy expectation with periodic book-to-floor reconciliation), the audit trail from requirement to receipt to issue, controls over commingled inventory, and consistent costing of transfers between contracts including loan/pay-back |
| Government Property | FAR 52.245-1; DFARS 252.245-7003 (property system administration); DFARS 252.211-7007 (GFP reporting) | Receipt, records, custody, segregation, physical inventories, and reporting of government furnished and contractor acquired property |
| Material Inspection and Receiving Report (DD250) | DFARS Appendix F; DFARS 252.246-7000 | Preparing the MIRR, obtaining source or destination acceptance, distributing it, and feeding acceptance to billing |
| Electronic receiving reports and invoices | DFARS 252.232-7003 and 252.232-7006 (WAWF) | Submitting receiving reports through WAWF in PIEE |
| Item Unique Identification | DFARS 252.211-7003; MIL-STD-130 marking | IUID marking verification at pack/ship, serial capture, IUID Registry submission |
| Military marking and packaging | MIL-STD-129 (shipment marking); MIL-STD-2073-1 (preservation/packaging) | Label content, container marking, preservation method execution |
| Export controls at the dock | ITAR (22 CFR parts 120-130), EAR (15 CFR), EEI filing per the Foreign Trade Regulations (15 CFR part 30) via AES | License determination before ship, denied party screening, EEI/ITN on export shipments |
| Title and progress payments | FAR 52.232-16 | Under FAR 52.232-16(d), title to all materials allocable or properly chargeable to the contract vests in the government upon allocation, immediately once the clause applies, not incrementally as payments are made; inventory records must be able to show what the government holds title to |
| Cost accounting consistency | CAS 411 (acquisition cost of material), CAS 407 (standard costs), CAS 402 (direct vs indirect consistency) | Inventory costing method consistency (moving average vs standard), consistent treatment of material handling as indirect |

The DD250 deserves its own paragraph because it is the single most consequential document this stream produces. Acceptance is either at source (the DCMA QAR inspects and signs at the contractor's plant before shipment, Block 21a) or at destination (the government consignee signs after receipt, Block 21b); the contract states which, CLIN by CLIN, and the delivery design must carry that attribute. The MIRR is routed electronically as a WAWF receiving report inside PIEE. Acceptance is the trigger event: it releases billing (on most supply CLINs the accepted receiving report is what lets the invoice pay), it transfers title to the government where title has not already vested under progress payments (under FAR 52.232-16(d), title to materials allocable or properly chargeable to the contract vests in the government upon allocation, regardless of the timing or amount of individual progress payments), and it starts the warranty clock on warranted items. A shipment that has left the dock but not been accepted is revenue-less, title-ambiguous, and warranty-dormant, which is why acceptance aging is a standing program-office report.

MMAS is one of the six DFARS business systems; this stream is its primary owner, and it also feeds the Property Management System (DCMA administered) and supplies the receiving leg of the Purchasing and Accounting systems.

Control points a practitioner designs deliberately: no GR without a PO or contract reference; inspection routing before unrestricted stock; special stock assignment at the moment of receipt, not later; inter-contract transfer requires a documented approval with cost transfer treatment agreed by finance before the SAP posting; pre-ship export check as a hard stop (delivery blocked until screening and license determination clear); DD250/WAWF submission only from delivery data, never re-keyed; count adjustments above a dollar or quantity tolerance require second-person approval.

What DCAA/DCMA walk through when they audit: for MMAS, DCAA traces a sample from time-phased requirement (MRP element) to purchase order to goods receipt to stock record to issue to cost objective, and asks you to demonstrate record accuracy statistics and reconciliation procedures; they probe inter-contract transfers hard, looking for cost shifting from fixed-price to cost-type work. DCMA's Property Management System Analysis walks GFP from contract attachment to PIEE receipt to SAP record to physical location to consumption or return, and observes a physical inventory. The DCMA QAR separately inspects packaging, marking, and executes source acceptance at your dock. Expect them to ask for movement history on specific part numbers (MB51-style extracts) and to watch a live cycle count.

## Technology and Systems

SAP footprint for this stream on S/4HANA:

| SAP component | Role in I2D |
| --- | --- |
| MM-IM (Inventory Management) | Goods movements, special stock ledgers, stock transfers, physical inventory documents; in S/4 the single material document table is MATDOC |
| Stock Room Management or embedded EWM | Bin-level warehouse execution: put-away, picking, staging. Stock Room Management is the supported successor to classic LE-WM (which is compatibility-pack scope on S/4HANA); embedded Basic EWM is the default modern choice for bin-managed sites and adds wave management, labor management, RF framework, and slotting |
| LE Deliveries (LE-SHP) | Outbound/inbound deliveries, shipping points, routes, PGI; the delivery is the backbone of the DD250 |
| Handling Unit Management | Nested pack hierarchy (carton, pallet, container), HU numbers on labels and the packing list |
| Batch / Serial | Batch management for lot-controlled material; serial number profiles for serialized end items and spares; serial capture at delivery |
| Physical Inventory | PI documents, cycle counting via ABC indicators, difference posting with tolerance groups |
| QM (adjacent) | Incoming inspection lots gating stock status; certificate handling |

Dassian add-ons: Dassian DD250 / ABS (Acceptance Billing Summary) generates the DD250/MIRR from the SAP delivery, manages source vs destination acceptance status, and hands accepted quantities to billing. This is the piece that closes the seam between shipping and Offer-to-Cash: acceptance recorded once, billing released from it, no swivel chair.

Typical non-SAP systems around this stream at a defense OEM prime or Tier-2 supplier: label and marking software (Loftware or BarTender for MIL-STD-129/130 labels; MIL-Comply is common specifically for military labeling and WAWF prep), parcel/carrier systems (FedEx Ship Manager, UPS WorldShip) or a TMS, export screening and trade content (SAP GTS, Descartes Visual Compliance, e2open, or OCR EASE), government property ledgers (Sunflower Systems, AssetSmart), RF hardware (Zebra scanners and printers), and sometimes a legacy WMS (Manhattan, Blue Yonder) from a pre-SAP era.

Keep/retire/integrate guidance: retire standalone WMS if the site fits embedded EWM or even plain IM; a defense stockroom with 20 pickers rarely justifies decentralized EWM. Keep specialized military labeling software but drive it from SAP delivery/HU data, never hand-typed. Keep a dedicated screening engine (GTS or third party) and integrate it as a delivery block; do not rely on manual list checks. Government property: the strategic answer is property records in SAP (special stock plus equipment/property attributes) reconciled to PIEE, retiring the standalone property database over time; many sites are not ready, so integrate first, retire later.

Government portals at the boundary: PIEE hosting WAWF (receiving reports, invoices), the GFP module (GFP shipment/receipt transactions), and the IUID Registry; ACE/AESDirect for EEI filing. Design the SAP-to-portal handoff explicitly: which fields flow from the delivery to the WAWF receiving report, who submits, who certifies.

## Data

Master and transactional data for this stream, with SAP tables and owners (role names from People):

| Data object | Main SAP tables | Owner |
| --- | --- | --- |
| Material master (warehouse/plant views) | MARA, MARC, MARD | Planning owns MRP views; Warehouse Manager owns storage views; Inventory Control owns ABC/cycle count indicator (MARC-ABCIN) |
| Batches | MCH1, MCHA, MCHB | Receiving Lead (creation at GR), Quality (status) |
| Serial numbers / equipment | EQUI, SER01/SER03, OBJK | Shipping Lead (capture at delivery); Government Property Manager when the serialized item is government property |
| Special stock ledgers | MSKA (sales order stock E), MSPR (project stock Q), MKOL (vendor consignment K), MSLB (stock with subcontractor O) | Inventory Control Analyst |
| Special stock valuation | EBEW (E), QBEW (Q) | Program finance, with Inventory Control as data steward |
| Material documents | MATDOC (S/4 single table; MKPF/MSEG as compatibility views) | Inventory Control Analyst |
| Deliveries | LIKP, LIPS | Shipping Lead |
| Handling units | VEKP, VEPO | Shipping Lead / Packaging Lead |
| Physical inventory documents | IKPF, ISEG | Inventory Control Analyst |
| WM transfer orders (if Stock Room Management / WM) | LTAK, LTAP | Warehouse Manager |
| GFP records | Special stock entries flagged as government property plus property attributes; PIEE GFP module is the government's mirror | Government Property Manager |

Special stock is the heart of this data model. Q (project stock, tied to a WBS element) and E (sales order stock) carry contract accountability inside the stock record itself; K (vendor consignment) and O (material provided to subcontractor) carry ownership and custody splits. Get the special stock strategy wrong at design time and every downstream ledger (MMAS audit trail, property records, billing basis) is wrong.

Migration objects and load sequencing for cutover:

1. Config prerequisites: plants, storage locations, movement type variants, serial profiles, batch settings, cycle count ABC parameters.
2. Material masters, then batches and serial/equipment records.
3. Cost objects that special stock hangs on: WBS elements and sales orders must exist before any Q or E stock loads.
4. Open purchase orders (Source-to-Pay stream) so in-transit receipts land correctly after go-live.
5. Stock loads via initial-entry movements (561 family): plain 561 for own unrestricted stock, 561 E against sales orders, 561 Q against WBS elements; consignment (K) and subcontractor (O) stock loaded with their special stock indicators; GFP loaded as non-valuated stock with property attributes so it never hits the balance sheet.
6. Handling unit and bin (WM/EWM) reconstruction if bins are managed.
7. Open deliveries: standard practice is to ship them before cutover rather than migrate them; migrate only what genuinely straddles.

Take a wall-to-wall physical inventory (or a certified full count cycle) immediately before the stock load; the load file becomes the opening MMAS evidence, so its accuracy is auditable forever.

CUI and export-controlled data in this stream: GFP lists and property records, DD250 content, ship-to DoDAAC data, IUID Registry data, and delivery documents on FMS or direct international sales are CUI or export controlled. Part identification alone can be ITAR significant on USML programs. Stock level data for special access or classified programs may not belong in the enterprise SAP client at all; that decision goes to security, not IT.

## Security and Authorizations

PFCG role shapes for this stream, in a GovCon S/4HANA build:

- Warehouse clerk (receiving): MIGO goods receipt restricted by plant and storage location (M_MSEG_WMB, M_MSEG_LGO) and by movement type (M_MSEG_BWA) to the receipt family; no PI difference posting, no 5xx adjustment movements.
- Warehouse clerk (issues/kitting): goods issue and transfer posting movements only; explicitly excludes 411/415 special stock transfer movements, which sit in a separate approver-gated role.
- Inventory control analyst: PI document creation and count entry (MI01/MI04 pattern), MB51/MB52 analysis; difference posting (MI07) in a separate role held by a supervisor.
- Shipping: delivery processing and PGI restricted by shipping point (V_LIKP_VST), HU packing, serial assignment; no ability to release export-blocked deliveries.
- Traffic: shipment and freight documents; no stock movements.
- Government property custodian: display-heavy role plus GFP receipt postings; property record maintenance separated from consumption postings.
- Export compliance: the only role that releases screening/license blocks; no shipping execution.

Segregation-of-duties toxic pairs:

| Toxic pair | Risk | Mitigation |
| --- | --- | --- |
| Goods receipt + invoice entry | Fictitious receipts self-approved into payment (defeats three-way match) | Split roles across I2D and AP; GR/IR aging review |
| PI count entry + PI difference posting | One person can invent or hide inventory | MI04 and MI07 in different roles; supervisor posts differences; tolerance-based dual control |
| Inventory adjustment movements (5xx) + cycle count analyst | Analyst adjusts away their own count misses | Adjustments gated to supervisor role; monthly MB51 review of 5xx movements by finance |
| Inter-contract transfer posting + program finance approval | Cost shifting between fixed-price and cost-type contracts (a direct MMAS/False Claims exposure) | Transfer movements in an approver role; documented pre-approval; quarterly transfer audit |
| Material master maintenance + stock postings | Reclassify then move to conceal | Master data in a central data role, not warehouse roles |
| Delivery creation/PGI + export block release | Shipper overrides compliance | Block release only in export compliance role; GTS hard block |
| GFP custody + GFP record maintenance | Custodian can erase accountability for lost property | Property records maintained outside Operations reporting line |

Run these pairs through SAP GRC Access Control (or equivalent) as ruleset entries, with mitigating controls documented, because DCAA asks for the SoD analysis during MMAS and accounting system reviews.

Auditor access design: default answer is extracts, not logons. When DCMA/DCAA insist on system access, provide a display-only PFCG role (MB52, MB51, MMBE, MI document display, delivery display), time-boxed, logged, restricted to the plants under review, and reviewed by export compliance if any foreign-person auditor scenario exists.

Export-control specifics: authorization design must support ITAR data segregation; foreign person users (including offshore AMS/support teams) must not hold roles exposing controlled technical data or, on some programs, even part-level identification. Screen support staff, restrict by plant/company code, and document the analysis; this is routinely examined during export compliance audits and is a common finding against offshore support models.

## Analytics and Reporting

Reports this stream owes, who consumes them, and where they come from:

| Report | To whom | Cadence | SAP source |
| --- | --- | --- | --- |
| Inventory record accuracy (by ABC class, by site) | Site leadership, compliance, DCMA/DCAA on request | Monthly, with rolling 12-month trend | IKPF/ISEG count results vs MATDOC book records |
| Cycle count schedule adherence | Warehouse Manager, compliance | Weekly | PI document backlog (IKPF) vs MIBC/ABC plan |
| Shipment and acceptance status (shipped, awaiting acceptance, accepted, rejected) | Program managers, Billing, Contracts | Daily or weekly | LIKP/LIPS plus Dassian ABS acceptance status |
| DD250 rejection/correction rate | Shipping Lead, Quality, Contracts | Monthly | Dassian ABS / WAWF submission history |
| Aging and excess stock (by contract, by special stock) | Program managers, program finance | Monthly | MSPR/MSKA with last-movement dates from MATDOC |
| GFP inventory report and reconciliation to PIEE | Government Property Manager, DCMA Property Administrator | Annual certification plus contract closeout | GFP-flagged stock records vs PIEE GFP module |
| Inter-contract transfer log | Program finance, compliance | Monthly | MATDOC filtered to transfer movements with special stock changes |
| Open receiving discrepancies (OS&D) | Receiving Lead, buyers (Source-to-Pay) | Weekly | GR/IR and inspection lot status |

Embedded analytics vs warehouse guidance: operational lists (open deliveries, count backlog, dock queue) belong in embedded S/4 analytics and Fiori apps over live CDS views; trended compliance metrics (IRA trend, transfer history, acceptance cycle time) belong in the BW/Datasphere or lakehouse layer because auditors want point-in-time snapshots that survive reorgs and repostings. Never compute the official IRA number in a spreadsheet; make it a governed query with a documented method (count-based accuracy by line, tolerance rules stated), because the method itself gets audited.

KPIs the client roles are measured on: Warehouse Manager: IRA (95 percent desirable accuracy level per DFARS 252.242-7004; running below 95 requires demonstrating no material harm to the government and that the cost to improve would be excessive; world class runs 98-99+ on A items), cycle count adherence, dock-to-stock hours. Shipping Lead: on-time delivery, DD250 rejection rate, acceptance cycle time (PGI to acceptance). Receiving Lead: dock-to-stock time, discrepancy closure days. Inventory Control: adjustment dollars as percent of throughput, root-cause closure rate. Traffic: freight cost per shipment, premium freight percent, AES rejection rate. Government Property Manager: LDD incidents, property audit findings, PIEE reconciliation gaps.

## Role of AI

Concrete AI use cases in I2D at a GovCon S/4HANA company:

1. DD250 pre-submission validation: an agent checks the assembled MIRR against the contract (CLIN/ELIN structure, ACRN, ship-to DoDAAC, inspection/acceptance points, marking requirements) and flags mismatches before WAWF submission, cutting rejection cycles.
2. GFP attachment extraction: parse GFP attachments and contract mods into structured expected-receipt lists, so Receiving knows what government property is inbound and under which contract, and PIEE receipts reconcile automatically.
3. Inventory record risk scoring: predict which part/location combinations are likely to have record errors (from movement patterns, backflush usage, adjustment history) and steer cycle count selection beyond plain ABC frequency.
4. Aging stock disposition support: recommend disposition paths for aged project stock (use on program, transfer with approval, return, plant clearance) with the contract terms and title status summarized for the human decision maker.
5. Export classification assist: suggest candidate ECCN/USML categories with reasoning and precedent parts, for a licensed classifier to decide; and summarize denied party screening hits with source-list context for the compliance officer.
6. Pack/ship anomaly detection: HU weight and dimension variances against catalog data, wrong-label detection from label print streams or photos against MIL-STD-129 content rules.
7. Audit response drafting: assemble movement-history narratives (requirement to PO to receipt to issue) from MATDOC data for MMAS walkthrough requests, with every statement linked to document numbers.

Compliance boundary, non-negotiable: a human authorized contractor representative certifies the DD250/WAWF receiving report (the acceptance signature is a legal certification to the government); a licensed empowered official makes export license determinations and releases screening hits; a supervisor approves physical inventory adjustments; the Government Property Manager certifies GFP inventories. AI may prepare, check, and recommend; it may not certify, release, or adjust. The reason is that these acts carry personal and corporate liability under the False Claims Act, ITAR penalties, and FAR 52.245-1 accountability, and the government holds the human signer responsible regardless of tooling.

Grounding and auditability rules for AI output feeding government deliverables: every AI-generated statement destined for a DD250, property record, or audit response must be traceable to system-of-record data (material document numbers, delivery numbers, contract line references), with the retrieval sources logged; prompts and outputs retained for the record retention period of the deliverable they fed; model and prompt versions pinned per release; no free-generation of quantities, dates, or part numbers (those fields are copied from SAP, never predicted); and any AI touching export-controlled or CUI data must run in an environment cleared for that data (no public endpoints, US-person access controls where ITAR applies).

## Operating Model

Organization variants: the shared-services model runs one warehouse organization serving all programs from common (but segregated) stockrooms, with special stock providing the contract accountability inside shared physical space; the program-aligned model gives large programs dedicated stockrooms and even dedicated logistics staff, usually driven by security requirements, customer direction, or GFP volume. Most defense primes run a hybrid: shared receiving/shipping dock and traffic, program-dedicated stock custody for the biggest programs. The MMAS commingled-inventory criteria are what make the shared model legal: physical commingling is acceptable when the records keep contract identity intact, which in SAP means Q/E special stock discipline.

Calendar, tied to close, EAC, ICS, and audit cycles:

| Cadence | What I2D does |
| --- | --- |
| Monthly (close) | Goods movement cutoff and PGI cutoff discipline; GR/IR open item review with AP; inventory adjustment review with finance; IRA reporting; inter-contract transfer log to program finance |
| Quarterly | Aging/excess stock review feeding program EAC updates (material burn vs plan); cycle count program coverage check; SoD/mitigation review |
| Annually | GFP physical inventory and certification to DCMA; cycle count program certification (the wall-to-wall PI alternative evidence); MMAS internal audit and self-assessment; support to the incurred cost submission where inventory transfers and material costing questions arise; export compliance audit support |
| Event-driven | MMAS demonstration when DCAA schedules a review; DCMA Property Management System Analysis; contract closeout property inventories and plant clearance; program cutovers and stock moves |

Government counterparts: the PCO (procuring contracting officer) sets the contract terms this stream executes (acceptance point, GFP attachments, packaging requirements); the ACO (administrative contracting officer, usually DCMA) makes business system determinations including MMAS and property; the DCMA QAR performs source inspection and acceptance at the plant and signs the DD250 origin acceptance; the DCMA Property Administrator runs property system analysis and receives GFP reporting; the DCMA Plant Clearance Officer dispositions excess government property; DCAA auditors execute the MMAS review and observe physical inventories.

Where it sits in the org: under Operations or Global Supply Chain, peer to procurement and production; property management deliberately outside the Operations line (Contracts or Compliance); export compliance in Legal/Compliance with operational hooks into the shipping process.

## How a Consultant Engages This Function

Workshop casting: for special stock and inventory design, cast the Inventory Control Analyst, Warehouse Manager, program finance, Contracts, and the Government Property Manager; production control should attend the kitting sessions. For the acceptance/DD250 track, cast Shipping Lead, Quality (QAR interface owner), Contracts, Billing (Offer-to-Cash seam), and the Dassian ABS configurator. For warehouse execution, cast the Warehouse Manager plus working leads who actually scan and pick; a design reviewed only by managers will fail on the floor. For export-at-dock, the Export Compliance Officer is mandatory and has veto power. Never run an I2D design workshop without someone who can speak for MMAS evidence, because every design choice (movement types, tolerances, transfer approvals) is future audit material.

Which decisions need which sign-offs: special stock strategy and inter-contract transfer control: program finance + Contracts + compliance. Warehouse tech ladder (IM-only vs Stock Room Management vs embedded EWM vs decentralized EWM): Operations + IT, sized honestly; decide by volume, bin count, labor management need, and RF complexity, not by ambition. Acceptance point and DD250 flow per contract type: Contracts + Quality + Billing. Cycle counting design (ABC classes, frequencies, tolerances) as the wall-to-wall PI replacement: finance + compliance, and socialize with DCMA before relying on it. GFP process: Government Property Manager signs, DCMA-facing. Export dock controls: empowered official only.

Common failure modes of implementations in this stream:

- Special stock treated as an afterthought: designed as plain unrestricted stock "for simplicity," then retrofitted to Q/E after the first MMAS question; retrofit means restating stock, revaluing, and explaining the gap to auditors.
- WAWF as swivel chair: delivery data re-keyed into PIEE by hand; rejection loops, acceptance delays, late billing; the fix (Dassian DD250/ABS or equivalent, generating from the delivery) was available at design time.
- GFP ignored until go-live: no receipt process, no property attributes, no PIEE reconciliation; the first DCMA property audit after cutover fails and the property system determination is at risk.
- Serialization/IUID bolted on late: serial profiles added after materials are loaded, IUID capture manual at pack; registry submissions backlog.
- EWM over-buy: decentralized EWM for a two-aisle stockroom; the team drowns in integration while basic IRA suffers. The ladder is IM-only, then Stock Room Management or embedded Basic EWM when bins/RF/labor management earn it (classic LE-WM is compatibility scope on S/4HANA, not a new-build option; Basic EWM is included in the S/4 license), then decentralized EWM only for high-volume multi-system sites.
- Cutover without an inventory story: no pre-load wall-to-wall count, in-transit and inspection stock unplanned, opening balances unauditable forever after.
- Movement type sprawl: dozens of custom movements with no mapping to MMAS audit trail; every one becomes an audit explanation.

What world class looks like: dock-to-stock under 24 hours with GR, inspection routing, and put-away all scanned; IRA above 98 percent on A items with cycle counting fully replacing annual wall-to-wall PI, accepted by DCMA; DD250 generated entirely from the SAP delivery via Dassian ABS with acceptance flowing to billing the same day; GFP visible in SAP in real time and reconciled to the PIEE GFP module continuously, not annually; 100 percent of shipments screened and license-checked systemically before the dock, with zero manual overrides outside the compliance role; inter-contract transfers rare, approved, logged, and boring to auditors; and a warehouse team that can demonstrate any part's requirement-to-issue history in minutes because the audit trail was designed in, not reconstructed.
