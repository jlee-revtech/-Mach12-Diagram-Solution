---
stream: design-to-release
---

# Design-to-Release in a US Government Contractor: The Eight-Dimension Operating Profile

Design-to-Release is the value stream that turns a contractual requirement into a released, configuration-controlled technical baseline: requirements to design to drawings and models to engineering BOM to released manufacturing-ready data. In a GovCon aerospace and defense company on SAP S/4HANA, this stream lives half in the PLM system (Teamcenter, Windchill) and half in SAP (material master, BOM, engineering change management, document management, QM first article). Its single most fragile seam is the eBOM-to-mBOM release handoff into Plan-to-Produce. Its governing discipline is configuration management per EIA-649, and its government-facing outputs are CDRLs, technical data packages, and Class I engineering change proposals that require customer approval.

## People

| Role | Owns | Signs off | Day-to-day pains |
| --- | --- | --- | --- |
| Chief Engineer (program) | Technical baseline integrity for the program; design authority | Class I change recommendations before ECP submittal; design review exit (PDR/CDR); waivers and deviations | Pulled between program schedule pressure and baseline discipline; CCB packages arrive incomplete; effectivity decisions made without cost data |
| Configuration Management (CM) analyst | Change masters, CCB agenda and minutes, status accounting records, FCA/PCA evidence | ECN release after CCB disposition; effectivity assignment; status accounting reports | Chasing engineers for impact assessments; reconciling PLM change objects against SAP change masters; audit prep fire drills |
| CM Manager / CCB Chair | The change control process itself; CCB charter and delegation rules | Class I vs Class II classification; CCB dispositions; CM plan | Board overload (everything routed as Class I "to be safe"); disagreements with contracts on what needs customer approval |
| Design engineer | Drawings, models, specs; ECR origination; impact analysis on assigned changes | Engineer-of-record signature on drawings and change packages | Rework from late requirements changes; slow release cycle; duplicate data entry between CAD/PLM and SAP requests |
| PLM administrator | PLM system configuration, workflows, ITAR/access classifications in PLM, the PLM-to-SAP interface | PLM workflow and schema changes; interface mapping changes | Blamed for every failed BOM transfer; schema drift between PLM item types and SAP material types; upgrade freezes |
| Drawing release desk | The release gate: verifies drawing completeness, signatures, distribution statement and export markings, then releases in DMS and triggers material master creation | Document release status; part number issuance (no part number without a released drawing) | Volume spikes before design reviews; engineers escalating around the gate; incomplete title blocks |
| Data management specialist (CDRL owner) | The CDRL log from the contract's DD Form 1423 exhibits; DID compliance of each deliverable; TDP assembly and delivery | Deliverable format and marking compliance before submittal to the customer | DIDs interpreted differently by every customer data manager; late engineering inputs against fixed CDRL due dates |
| Manufacturing engineering liaison | The mBOM derivation from the released eBOM; producibility feedback into ECRs | mBOM release acceptance; make/buy structure of the mBOM | eBOM changes landing after mBOM work started; phantom and reference designator mismatches |
| Quality engineer (FAI owner) | AS9102 first article planning and execution; inspection plan characteristics | AS9102 Forms 1, 2, 3; FAI closure | FAI triggers discovered late (a Class II change nobody flagged); ballooning drawings by hand; supplier FAIs stuck in review |
| Export compliance officer / empowered official | Jurisdiction and classification of technical data (USML category or ECCN); technology control plan | Export classification of drawings/specs; foreign person access decisions; license determinations | Engineers emailing technical data outside controlled repositories; DMS access requests with no need-to-know rationale |

Typical reporting lines: the Chief Engineer reports to the program manager with a dotted line to the VP of Engineering (or the reverse in strong-functional shops). CM sits under engineering operations or mission assurance, never under the program manager alone (auditors look for CM independence from schedule pressure). The drawing release desk and PLM administration are usually shared services under CM or engineering operations. Data management/CDRL owners often report to the program office or contracts, which is why the consultant must bridge them to engineering deliberately.

Who must be in the room: eBOM/mBOM ownership decisions require the Chief Engineer and the manufacturing engineering liaison together (plus a Plan-to-Produce counterpart). Change process design requires the CM Manager and a CCB-experienced CM analyst. Part numbering and the material-creation gate require the drawing release desk and the master data owner. Any DMS or document repository design requires the export compliance officer from day one, not at go-live. FAI process design requires the quality engineer and CM together, because FAI triggers hang off change classification.

## Process

The end-to-end flow: requirement allocation (from the contract SOW and specs, managed in a requirements tool) to design and analysis to drawing/model creation in CAD/PLM to release through the drawing release desk to eBOM structure in PLM to the release handoff creating/updating SAP material masters, document info records, and the mBOM to change management over the life of the baseline to CDRL and TDP delivery to the government.

Configuration management per EIA-649 gives the stream its five functions, and a consultant should map every design decision to one of them:

1. **CM planning and management**: the CM plan (often itself a CDRL) defines board structure, classification rules, and tool responsibilities. If the SAP design contradicts the CM plan, the CM plan wins or must be formally revised.
2. **Configuration identification**: part numbering rules, baseline definitions (functional baseline at SFR, with SRR preceding it before requirements are baselined; allocated baseline around PDR, product baseline around CDR), revision and version rules, nomenclature. In SAP this lands in material master numbering, revision levels tied to change numbers, and DMS document numbering.
3. **Configuration change management**: the change pipeline. ECR (engineering change request) is originated with a problem statement and preliminary impact; it goes to the change board (CCB) with impact assessments from engineering, manufacturing, supply chain, and contracts; on approval it becomes an ECN (engineering change notice) implemented via an SAP change master (transaction CC01/CC02, table AENR) that carries effectivity (date or, with reference points, serial/unit effectivity) and revises the affected objects (BOM via CS02 under the change number, documents, materials). The released BOM at the new revision is the output. **Class I vs Class II is the load-bearing distinction**: a Class I change affects form, fit, function, cost, schedule, or contractually baselined performance/interfaces and requires customer approval via an ECP (engineering change proposal) before implementation; Class II is editorial or internal (does not affect the approved baseline as seen by the customer) and is typically dispositioned by the contractor with government concurrence rights, often delegated to the local DCMA office to review classification. Misclassifying Class I as Class II is a finding that costs real money and trust. MIL-HDBK-61 is the standard government reference for this vocabulary.
4. **Configuration status accounting (CSA)**: at any moment, be able to answer "what is the approved configuration, what changes are pending, what is incorporated in which unit." In SAP terms: change master status, BOM validity by change number, object management records, and (for as-built) the seam into serialized production data. CSA reports are what DCMA asks for first.
5. **Verification and audit**: FCA (functional configuration audit) verifies the item performs per its requirements; PCA (physical configuration audit) verifies the as-built matches the drawings and TDP. Both are milestone events (usually before full-rate production or delivery of the first article) where CM produces the evidence trail: every drawing at its released revision, every change incorporated or formally deferred.

GovCon overlay this stream owns or feeds:

- **Data rights and deliverables**: DFARS 252.227-7013 (rights in technical data, other than commercial products and commercial services) and 252.227-7014 (noncommercial computer software) drive how drawings and data are marked (unlimited, government purpose, limited rights legends). CDRLs are contract exhibits on DD Form 1423, each invoking a DID (Data Item Description) that dictates format and content. The TDP is typically structured per MIL-STD-31000, and every document in it carries a distribution statement per DoD policy (DoDI 5230.24) plus export-control warnings where applicable.
- **Safeguarding**: DFARS 252.204-7012 requires protecting covered defense information per NIST SP 800-171; engineering repositories (PLM, DMS, content servers, file shares) are squarely in scope, and CMMC assessments walk through them.
- **Business system feeds**: engineering is not one of the six DFARS business systems, but it feeds three. MMAS (DFARS 252.242-7004(d)(2)(i)) states 98 percent bill of material accuracy and 95 percent master production schedule accuracy as the desirable goals, with 95 percent inventory record accuracy desirable for physical-to-record reconciliation; these are stated as "desirable" goals with a no-material-harm/excessive-cost fallback rather than absolute pass/fail limits, but the BOM accuracy number is earned or lost in this stream's release discipline. The estimating system (DFARS 252.215-7002) consumes engineering BOMs for bottoms-up estimates. EVMS (DFARS 252.234-7002) depends on engineering work definition and change traffic feeding baseline change control.
- **Cost accounting**: engineering labor charging discipline feeds CAS compliance; CAS 420 governs IR&D and B&P cost accounting, and the direct-vs-IR&D boundary of design work is a recurring DCAA interest.

Control points a consultant should verify exist: ECR intake screening (kills duplicates early), CCB with quorum and classification authority, the drawing release gate (completeness, signatures, markings), the material-master-creation gate (no part number without a released drawing), effectivity assignment control (CM assigns, not the requester), mBOM release acceptance by manufacturing engineering, FAI trigger review on every change disposition, and CDRL marking review before submittal.

What DCMA/DCAA walk through: DCMA engineering and CM specialists sample changes end to end (pick an ECP, trace ECR to CCB minutes to ECN to change master to revised BOM to effectivity in production orders to as-built), review Class II classifications for hidden Class I content, attend or delegate FCA/PCA, and their QARs witness or review FAIs. DCAA does not audit CM; it audits engineering labor (floor checks, timekeeping, IR&D/B&P segregation) and will trace charged hours to change and design activity.

Per-topic gotchas a practitioner watches for:

- **Deviations and waivers are not changes.** A request for deviation (planned departure before manufacture) or waiver (acceptance of nonconforming product after the fact) leaves the baseline intact; do not process them through the ECN pipeline or the status accounting record becomes unreadable (current MIL-HDBK-61B and EIA-649C consolidate both under a single Request for Variance, or RFV, though many contracts still use the legacy deviation/waiver split). Track them as their own object with their own customer approval path, cross-referenced to the affected drawing revision.
- **The interchangeability rule governs part number rolls.** If the changed part is no longer interchangeable with the old one (form, fit, function, or interface), the part number rolls; if interchangeable, the revision rolls. Programs that revision-roll non-interchangeable changes poison spares provisioning and as-built records for years, and it surfaces in the PCA.
- **Effectivity type is a contract question before it is a config question.** Date effectivity is easy in SAP; serial/unit effectivity requires reference points and discipline in production order handling. If the contract and CM plan speak in unit effectivity (cut-in at unit N), design for it from the start rather than approximating with dates.
- **Class II is not "no approval."** On most DoD contracts the government retains review rights over Class II classification, frequently delegated to the local DCMA office. Build the concurrence step into the workflow instead of discovering it during surveillance.
- **The CCB is not the only board.** Programs commonly run a software CCB, an interface control working group, and a material review board (MRB) for nonconformances. Map which board owns which object type before configuring workflow, or changes will forum-shop.

## Technology and Systems

The deep module configuration lives in the companion bundle (sap-plm-design-to-release-ad); this is the landscape view.

**SAP footprint**: PLM capabilities in S/4HANA core (document management/DMS with document info records, classification, product structure), material BOMs (LO-MD-BOM; CS01/CS02: MAST/STKO/STPO), ECM engineering change management (change masters AENR, object management records, effectivity, revision levels), and QM for first article inspection (inspection plans, inspection lots, usage decisions). Dassian has no module in this stream; Dassian value starts downstream where contract structures and cost objects consume the released baseline.

**Non-SAP systems typically found and the keep/retire/integrate call**:

| System | Typical products | Guidance |
| --- | --- | --- |
| PLM/PDM | Siemens Teamcenter, PTC Windchill, Dassault 3DEXPERIENCE/ENOVIA | Keep. This is the engineering system of record for CAD, eBOM, and workflow. Do not attempt to move design authoring into SAP. Integrate one-way for release. |
| CAD | Siemens NX, PTC Creo, Dassault CATIA, SolidWorks | Keep; SAP never touches CAD files directly. Neutral formats (PDF, STEP) flow to SAP DMS or stay in PLM with pointers. |
| Requirements | IBM DOORS / DOORS Next, Jama Connect | Keep; integrate to PLM (not SAP) for requirement-to-design traceability. SAP sees requirements only via WBS/work definition. |
| PLM-ERP middleware | Teamcenter Gateway for SAP (T4S), PTC Windchill ERP Connector, PROSTEP OpenPDM | Integrate: this is the release handoff carrier. One direction (PLM to SAP) for engineering objects; status feedback only coming back. |
| Legacy drawing vaults, shared drives | Homegrown vaults, network shares | Retire into PLM or SAP DMS with export-control triage first. These are the CMMC findings waiting to happen. |
| FAI/ballooning tools | Net-Inspect, InspectionXpert/Ideagen Q-Pulse ecosystem, DISCUS | Keep where supplier FAI collaboration is established; integrate results status to SAP QM lots rather than replacing. |

**The seam that matters**: eBOM lives in PLM; mBOM lives in SAP. The release handoff (released eBOM plus documents plus change context flowing to SAP material masters, DIRs, change master, and BOM) is the single most fragile integration in the company and the top source of Plan-to-Produce escapes. Design it as a controlled, monitored, restartable pipeline with a human release gate, not a fire-and-forget sync. Decide explicitly where the mBOM is authored (recommended: derived in SAP or in PLM's manufacturing structure then transferred, but never dual-maintained without an automated reconciliation report).

**Interface pattern that works**: PLM release workflow completes, middleware stages the payload (material attributes, DIR metadata plus neutral-format rendition, BOM structure, change context), SAP-side validation rejects incomplete payloads back to a monitored queue rather than posting partial data, and a release-desk or CM confirmation step makes the change effective. Every failed transfer must be visible to a named human the same day; silent retry queues are where baseline divergence is born.

**Government portals at the boundary**: PIEE (Procurement Integrated Enterprise Environment, including WAWF for acceptance documents that CDRL deliveries may ride on), EDA for contract documents feeding the CDRL log, ASSIST for military specifications and DIDs, GIDEP for parts obsolescence and alert data that engineering must screen BOMs against, and customer or DLA collaboration environments for TDP delivery on some programs. None of these integrate directly to SAP in this stream; they bound the data management specialists' workflow.

## Data

| Data object | Main SAP tables | Owner (from People) | Notes |
| --- | --- | --- | --- |
| Material master (engineering views) | MARA, MARC, MAKT | Drawing release desk issues; master data team maintains | Creation gated on released drawing; revision level tied to change number |
| Document info record (DIR) + originals | DRAW, DRAD (object links), content server | Data management specialists / PLM administrator | Carries distribution statement and export marking in characteristics or status |
| Engineering change master (ECN carrier) | AENR, AEOI (object management records) | CM analysts | Effectivity (date or unit via reference points), release key, status |
| BOM (mBOM in SAP) | MAST, STKO, STPO, STAS | Manufacturing engineering liaison accepts; CM controls revisions | Changed only under a change number once released; eBOM stays in PLM |
| Classification | KLAH, KSSK, AUSP | PLM administrator | Used for part attributes, export flags, TDP grouping |
| Inspection plan / FAI characteristics | PLKO, PLPO, PLMK, MAPL (characteristics in PLMK, typically referencing QPMK master inspection characteristics) | Quality engineer (FAI owner) | FAI characteristics per AS9102 Form 3 |
| Inspection lot / usage decision (FAI execution) | QALS, QAVE | Quality engineer | FAI lot triggered by inspection type on first receipt/production after trigger event |
| CDRL log | Usually non-SAP (contracts tool or program tracker) | Data management specialist | If in SAP, custom object; due dates come from DD Form 1423 |

Migration objects and load sequencing for this stream (S/4 migration cockpit plus PLM loaders):

1. **Change masters first** if you intend to load BOMs with effectivity; most programs instead create a small set of migration change numbers ("as-migrated baseline") rather than replaying history.
2. **Material masters** (basic, engineering-relevant views) for every released part. Do not load parts that never had a released drawing; make legacy cleanup do its job here.
3. **DIRs and originals** (or DIR stubs pointing at PLM), then material-to-document links (DRAD).
4. **Classification** on materials and documents, including export-control and distribution-statement characteristics.
5. **BOMs** at current released revision only, under the migration change number. Revision history stays in PLM; SAP starts clean. Loading BOM history into SAP is a classic failed ambition: expensive, error-prone, and DCMA accepts PLM as the historical record if the CM plan says so.
6. Routings and work centers belong to Plan-to-Produce, but sequence them immediately after BOMs so the seam is testable.
7. **Inspection plans** with FAI-relevant characteristics last, after materials and BOMs stabilize.

Reconciliation is a deliverable, not an afterthought: eBOM-to-mBOM count and structure compare, drawing-revision-to-material-revision compare, and a signed baseline verification (mini PCA) before cutover.

**CUI and export control**: engineering technical data is where ITAR lives. Drawings, models, specs, and TDPs for USML articles are ITAR technical data (22 CFR 120-130); dual-use data falls under the EAR (15 CFR 730-774) with an ECCN. Nearly all of it is at least CUI (marked per DoD CUI policy, DoDI 5200.48) and protected under DFARS 252.204-7012 / NIST SP 800-171. The operating rule: access control follows the data into every repository. If a drawing is ITAR in PLM, its rendition in SAP DMS and its attachment on a production order carry the same restriction, enforced with DMS authorization groups, document statuses, and content-server segregation, not with training slides. Foreign person access (including offshore AMS/BASIS support) must be engineered out of the ITAR document path or covered by licenses; this decision belongs to the export compliance officer, and the consultant's job is to surface it in the first design workshop.

## Security and Authorizations

PFCG role shapes for the stream (names illustrative; build composite roles per position, single roles per capability):

- **Design engineer**: create/change DIRs in draft statuses (C_DRAW_TCD, C_DRAW_STA limited to pre-release statuses), display BOMs and materials, create ECRs. No release statuses, no change master release, no material creation.
- **CM analyst**: create/change change masters (C_AENR_BGR by authorization group), maintain object management records, run status accounting reports. Change master release only if the design separates creator from releaser (see toxic pairs).
- **CCB Chair / CM Manager**: approve/release change masters (release key), classification decisions. Display everywhere else.
- **Drawing release desk**: set DIR release statuses, create material masters (M_MATE_STA limited to engineering-relevant maintenance statuses), issue numbers. No BOM change.
- **Manufacturing engineering (mBOM)**: BOM create/change (C_STUE_BER, C_STUE_WRK by plant) under change number only; display DIRs.
- **Quality engineer (FAI)**: inspection plans, results recording, usage decision, with recorder/decider split for FAI lots.
- **PLM administrator**: interface monitoring, DMS customizing in non-production; in production, technical monitoring only. No standing business-release authority.

| Toxic pair | Risk | Mitigation |
| --- | --- | --- |
| Create change master + release the same change | Self-approved baseline changes; DCMA CM finding | Release key restricted to CCB Chair role; workflow-enforced dual control; digital signature on release |
| Author/change a drawing + set its DIR to released | Bypasses the release desk gate | Release statuses only in the release desk role; status profile enforces sequence |
| Create material master + release drawings | One person can invent parts end to end | Keep both in release desk only if drawing authorship is elsewhere; otherwise split numbering from release |
| Change BOM + release change master | Uncontrolled BOM edits laundered through self-released ECNs | BOM change only under change number; change release in a different role |
| Record FAI results + make usage decision on the same lot | Self-certified first articles; AS9102 credibility loss | QM recorder/decider role split; QAR witness where delegated |
| Maintain DMS authorization groups + grant user access | One person can open export-controlled data to anyone | Auth group customizing owned by security team with export compliance approval; access grants via identity workflow with need-to-know justification |

**Auditor access design**: give DCMA/DCAA display-only composite roles (DIR display without originals by default, change master display, BOM display, QM display, CSA queries) scoped by authorization group so export-controlled originals require a per-request grant confirmed as US-person access with need-to-know. Time-box the accounts to the audit window and log to the audit trail the auditors themselves can be shown.

**Export-control specifics**: model export jurisdiction as data (DMS authorization groups and classification characteristics per program/jurisdiction), mirror the PLM system's ITAR classification scheme one-to-one so a document cannot gain accessibility by crossing the interface, exclude ITAR document paths from any non-US support scope, and route every foreign-person access exception through the empowered official. GRC access control (or equivalent SoD tooling) should carry the toxic-pair ruleset above as detective controls with quarterly review.

## Analytics and Reporting

| Report | To whom | Cadence | SAP source |
| --- | --- | --- | --- |
| Configuration status accounting (approved config, pending changes, incorporation status) | Program CM, Chief Engineer, DCMA on request | Monthly, plus event-driven for audits | AENR, AEOI, MAST/STPO validity by change number; CDS views over change and BOM data |
| Open ECR/ECN aging and CCB throughput | CCB, CM Manager | Weekly (board pack) | Change master status data plus PLM workflow extract |
| eBOM-to-mBOM reconciliation exceptions | Manufacturing engineering, PLM admin, CM | Weekly | Interface staging tables vs MAST/STPO; PLM extract compare |
| BOM accuracy (MMAS feed) | Supply chain, MMAS owner, internal audit | Monthly | STPO vs physical/audit sample results; supports the 98 percent MMAS BOM-accuracy goal |
| Drawing release cycle time and backlog | VP Engineering, release desk lead | Weekly | DRAW status history |
| FAI status and first-pass yield | Quality manager, program, customer/QAR before rate decisions | Per FAI campaign, summarized monthly | QALS, QAVE, inspection plan characteristics |
| CDRL delivery status vs DD Form 1423 due dates | Program manager, contracts, customer data manager | Monthly (or per contract IMS) | CDRL tracker (non-SAP) joined to DIR release status |
| Effectivity exceptions (changes released, not reflected in open orders) | CM, production control | Weekly | Change master effectivity vs production order BOM explosions (seam report with Plan-to-Produce) |

**Embedded vs warehouse guidance**: operational reports that live inside one system (change aging, release backlog, FAI lots) belong in S/4 embedded analytics as CDS queries; anything that joins PLM and SAP (eBOM/mBOM reconciliation, requirement-to-release traceability, CSA that spans both) belongs in a warehouse layer (BW/4HANA, SAP Datasphere, or the company's lake) because cross-system joins in real time are brittle and auditors want point-in-time snapshots anyway. Snapshot CSA monthly; DCMA questions are usually about a past date, not today.

**KPIs the client roles are measured on**: Chief Engineer: baseline stability (Class I change count post-CDR), design review exit criteria met. CM: change cycle time ECR-to-released (typical target measured in weeks, not months), status accounting query turnaround, zero classification findings. Release desk: release cycle time, first-pass completeness rate. Quality/FAI: FAI first-pass yield, FAIs completed before rate gate. Data management: CDRL on-time delivery percentage, zero marking rejections. Manufacturing liaison: eBOM/mBOM exception count, escapes to the floor caused by stale BOMs.

## Role of AI

Concrete use cases in this stream:

1. **Change impact drafting**: given an ECR, assemble the where-used explosion (BOMs, open orders, inventory, open POs, affected documents) and draft the impact assessment for the engineer to correct and own. Cuts CCB package prep from days to hours.
2. **Class I/II classification screening**: score incoming ECRs against the contract's configuration control criteria and the CM plan, flagging probable Class I content (interface, qualified performance, cost/schedule impact) with cited rationale. Recommendation only; classification is a human CCB decision.
3. **CDRL/DID conformance checking**: compare a draft deliverable against its DID's format and content requirements and the CDRL's tailoring, producing a discrepancy list before the data manager's review.
4. **TDP completeness and marking audit**: sweep an assembled technical data package for missing sheets, revision mismatches against the released baseline, absent distribution statements, and missing export warnings.
5. **FAI ballooning assist**: extract characteristics from drawing renditions to pre-populate AS9102 Form 3 rows for the quality engineer to verify against the drawing.
6. **Obsolescence and GIDEP screening**: match alert data against BOM content and draft the engineering disposition queue.
7. **CCB minutes and status accounting narration**: draft board minutes from the disposition record and generate plain-language CSA summaries with links to the underlying change masters.

**Compliance boundary (what a human must certify and why)**: the engineer of record signs drawings and impact assessments (design authority is personal and legal); the CCB Chair decides classification and disposition (Class I misclassification is a contractual breach vector); the quality engineer signs AS9102 Forms 1, 2, and 3 (AS9102 requires accountable signatures); the empowered official determines export jurisdiction and classification (ITAR liability is criminal, and this determination is never delegated to software); the data manager certifies CDRL submittals (the deliverable is a contract act). AI drafts, humans certify, and the record must show the human review happened.

**Grounding and auditability rules for AI output feeding government deliverables**: every AI-generated statement must trace to a versioned source (drawing number and revision, change master, contract exhibit) captured in the output; the model must operate on the released baseline, never on working copies, with the retrieval set pinned and logged; AI must not invent characteristic values, dimensions, or requirement text (extraction only, generation forbidden for measured/specified data); AI processing of ITAR technical data must run inside the controlled boundary (no external services outside the covered environment per DFARS 252.204-7012 obligations); and prompts plus outputs for anything that reached a deliverable are retained with the deliverable's record copy so an auditor can reconstruct what the human reviewed.

## Operating Model

**Organization**: two workable shapes. (a) Program-aligned matrix: CM analysts and data managers assigned to programs, reporting functionally to a central CM/engineering-operations organization that owns the process, tools, and CM plan templates; this is the norm at primes because DCMA surveils per program but adequacy is enterprise. (b) Shared services: a central change-administration and release-desk pool serving all programs, common at mid-tier suppliers where no single program can fund dedicated CM. In both, the drawing release desk and PLM administration are shared services; design engineering is functional (by discipline) matrixed into programs. The function typically sits under the VP of Engineering; CM occasionally sits under mission assurance/quality instead, which strengthens independence but weakens engineering intimacy. A consultant should locate the CCB charter and the CM plan before assuming either shape.

**Calendar**:

- **Weekly**: CCB (the metronome of this stream; a healthy board runs a triaged agenda with pre-circulated impact packages and delegates routine Class II to a subordinate board or the CM Manager), eBOM/mBOM exception review, release desk backlog review.
- **Monthly**: status accounting snapshot and metrics pack, CDRL delivery cycle against DD Form 1423 due dates, BOM accuracy sampling feeding MMAS metrics, change-driven EAC inputs to program control (approved Class I changes move budgets; CM feeds the baseline change log that EVMS consumes).
- **Quarterly**: DCMA surveillance touchpoints (CM and engineering process reviews per the surveillance plan), internal SoD/access review of the toxic pairs, PLM-SAP interface health review.
- **Per program milestone**: design reviews gate data maturity: SFR anchors the functional baseline (SRR precedes it), PDR the allocated baseline, CDR the product baseline; each review has a data-readiness checklist the release desk and CM prepare. FAI campaigns run before LRIP/rate production and after any trigger event (new part, Class-affecting design change, process or source change, or a production lapse of roughly two years per AS9102 practice). FCA/PCA execute before full-rate or first delivery per the contract.
- **Annually**: AS9100 external audit (CM and FAI are perennial audit trails), CMMC/NIST 800-171 assessment activity over engineering repositories, IR&D project setup and closeout affecting engineering charging, and support to the incurred cost submission only indirectly (engineering labor and IR&D/B&P segregation evidence).

**Government counterparts**: the PCO owns the contract and approves Class I ECPs (with the program office's engineering staff evaluating); the ACO administers and may hold delegated change authority; DCMA provides the on-site cast: engineering and CM specialists (process surveillance, classification review), QARs (FAI witness, product acceptance), and software/data specialists on some programs. DCAA touches this stream only through labor and IR&D/B&P audits. Build the counterpart map per contract, because delegation letters differ program to program.

## How a Consultant Engages This Function

**Workshop casting**: never run a Design-to-Release workshop with IT and the PLM admin alone; that produces an interface design with no process authority behind it. Minimum cast per topic: change process design needs the CM Manager, a working CM analyst, and a design engineer who has lived a bad ECN; the eBOM/mBOM seam needs the Chief Engineer (or deputy), the manufacturing engineering liaison, the PLM admin, and the Plan-to-Produce lead in the same room; part numbering and the material gate need the release desk lead and the enterprise master data owner; anything touching DMS or document flow needs the export compliance officer; FAI design needs the quality engineer and CM together.

**Decision-to-signoff ladder**:

| Decision | Sign-off required |
| --- | --- |
| Where mBOM is authored and how the release handoff works | Chief Engineer + VP Manufacturing (or Plan-to-Produce owner), jointly, in writing |
| Change master design (types, effectivity model, release keys) | CM Manager, consistent with the CM plan; CM plan revision if not |
| Part numbering and material-creation gate | Release desk lead + master data owner + CM Manager |
| Class I/II routing and CCB delegation in workflow | CCB Chair, with contracts concurrence on customer-approval paths |
| DMS structure, auth groups, export segregation | Export compliance officer + security lead |
| FAI trigger rules wired to change types | Quality manager + CM Manager |
| Migration baseline approach (as-migrated change number, history stays in PLM) | CM Manager + Chief Engineer; note it in the CM plan for DCMA |

**Common failure modes**: (1) Treating ECM as optional scope ("we will add change numbers in phase 2"): retrofitting change control onto live BOMs is an order of magnitude harder than starting with it. (2) Dual-maintained eBOM and mBOM with no reconciliation report: divergence is discovered by the shop floor. (3) Attempting to migrate full revision history into SAP instead of an as-migrated baseline. (4) Designing DMS without export compliance, then re-permissioning tens of thousands of documents post go-live. (5) Bi-directional PLM-SAP sync ambitions that turn every hiccup into a data-ownership dispute; keep release flow one-way. (6) FAI triggers not connected to change classification, so first articles are discovered missing at customer source inspection. (7) CCB modeled as an email approval chain with no status accounting behind it, which passes UAT and fails the first DCMA surveillance. (8) Letting the program with the loudest schedule bypass the release desk "temporarily."

**What world class looks like**: one release pipeline from PLM to SAP with a human gate and automated everything else (material stub creation, DIR rendition transfer, mBOM staging), measured in hours from CCB disposition to effective mBOM; status accounting answerable in minutes from live data with monthly immutable snapshots; Class II changes dispositioned inside a week by a delegated board while Class I packages reach the customer with complete, AI-drafted, human-certified impact analysis; zero part numbers without released drawings, enforced by the system rather than by policy; FAI triggers fired automatically from change type and classification; export controls modeled as data so no document changes jurisdiction by crossing an interface; and a DCMA surveillance visit that ends early because every sampled change traced clean on the first pull.
