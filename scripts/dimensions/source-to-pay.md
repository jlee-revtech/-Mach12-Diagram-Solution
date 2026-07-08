---
stream: source-to-pay
---

# Source-to-Pay in a US Government Contractor: The Eight-Dimension Operating Profile

## People

Source-to-Pay at a GovCon aerospace and defense company is two professions sharing one org chart: buyers who execute purchase orders, and subcontract administrators who manage flowed-down contracts. Treating them as interchangeable is the single most common staffing and system-design mistake.

| Role | What they own | What they sign off | Day-to-day pains |
|---|---|---|---|
| VP / Director, Supply Chain (Procurement Director) | The purchasing system itself: policy manual, delegation of authority matrix, CPSR readiness, headcount | Procurement policy, buys above buyer delegation, CPSR corrective action plans | Cycle-time complaints from programs vs. compliance file discipline; keeping the approved purchasing system approved |
| Buyer (tactical / commodity) | PR-to-PO conversion, competition, price analysis, expediting, supplier OTD for their commodity | The PO file: price reasonableness determination, competition or sole-source memo, debarment check | PR backlog, single-source parts with 60-week lead times, incomplete requisitions from engineering |
| Subcontract Administrator (SCA) | Cost-type and T&M subcontracts end to end: RFP, negotiation, flowdowns, funding, mods, closeout | Subcontract award packages, mod packages, consent requests, voucher release recommendations | Sub's cost overruns discovered late, limitation-of-funds letters, closeouts stuck on final indirect rates |
| Subcontracts Manager | The SCA team, subK negotiation strategy, make/buy participation, consent package quality | Subcontract awards above SCA delegation, TINA sweep decisions | Program managers negotiating scope directly with subs and bypassing the subK |
| Small Business Liaison Officer (SBLO) | The FAR 52.219-9 subcontracting plan, eSRS ISR/SSR submissions, SB outreach and goal attainment | ISR and SSR submissions in eSRS, SB participation sections of proposals | Buyers not capturing socioeconomic status at award; goal shortfalls surfacing only at reporting deadlines |
| CPSR / Procurement Compliance Lead | File audit program, self-assessment metrics, CPSR prep, policy-to-FAR traceability | Internal file audit results, CPSR self-assessment, procurement training records | Buyers who treat the file as paperwork; findings recurring after training |
| Supplier Quality Engineer (SQE) | Approved supplier list, AS9100 flow-through, receiving inspection plans, FAI review, counterfeit dispositions | Supplier approvals/disapprovals, nonconforming material dispositions, source inspection waivers | Receiving inspection backlog gating production; suppliers shipping without certs of conformance |
| Accounts Payable Manager | Invoice verification, three-way match exceptions, payment runs, GR/IR hygiene | Payment proposal release, blocked-invoice release (jointly), Prompt Payment compliance | Aged GR/IR, invoices blocked on quantity variance nobody owns, cost-voucher holds with no review owner |
| Material Program Manager (MPM) | Program-level material and subK cost/schedule status, subK ETC inputs to EAC | Program material forecasts, subK performance inputs to EAC | Reconciling commitments in SAP to what the program thinks it bought |
| Trade Compliance Officer / Empowered Official | Export screening of suppliers, technical data release authorizations, ITAR/EAR flowdowns | License determinations, foreign supplier technical data releases, TAA scope | Engineering attaching export-controlled drawings to POs without markings |

Typical reporting lines: buyers and SCAs report through Supply Chain to the COO; at some primes, Subcontracts reports through the Contracts (sell-side) VP instead, which changes who owns the clause library. The SBLO usually sits in Supply Chain but signs government reports personally. AP reports through the Controller, not Supply Chain, so three-way match design is always a cross-organizational decision. SQEs report through Quality with dotted lines to Supply Chain.

Who a consultant must have in the room: release strategy and delegation design needs the Procurement Director and CPSR Lead (not just buyers). Any subcontract data model decision needs the Subcontracts Manager and an MPM. Supplier master governance needs AP, Trade Compliance, the SBLO, and SQE together, because supplier onboarding is where debarment checks, socioeconomic capture, export screening, and quality approval all converge. Invoice tolerances and payment holds need AP plus the Subcontracts Manager.

## Process

End-to-end flows in this stream:

1. **Requisition to PO (simple buys)**: PR (ME51N / EBAN) with account assignment (program WBS or production order), buyer sourcing, competition or documented sole source, price analysis, PO (ME21N / EKKO, EKPO), release strategy approval, acknowledgment, expedite, receipt.
2. **Sourcing to subcontract (complex buys)**: make/buy decision, RFP with flowdown matrix, proposal evaluation, cost analysis (with fact-finding and possibly a DCAA assist audit of the sub's proposal), negotiation, TINA certification if over the truthful cost or pricing data threshold ($2.5M effective October 1, 2025; older awards carry the threshold in their prime contract's clause version: $2M for July 2018 through September 2025, $750K before that), consent or advance notification if required, award, then a life of mods, funding actions, and closeout.
3. **Build-to-print subcontracting (SAP Subcontracting)**: PO item category L, components issued to the supplier as special stock O (movement type 541), consumption on receipt (543), monitored via ME2O.
4. **Receive and inspect**: goods receipt (MIGO), QM inspection lot at receipt, cert of conformance and FAI verification, usage decision, stock posting.
5. **Invoice to pay**: logistics invoice verification (MIRO), three-way match, tolerance checks, payment blocks, payment run (F110).
6. **Subcontract administration**: funding management against limitation of funds, voucher review, performance monitoring, mod execution, closeout after final indirect rates settle.

**The purchasing business system and CPSR.** The purchasing system is one of the six DFARS business systems (accounting, estimating, purchasing, EVMS, MMAS, property). DFARS 252.244-7001 (Contractor Purchasing System Administration) lists the 24 adequacy criteria; DFARS 252.242-7005 authorizes payment withholds (five percent per deficient system, capped at ten percent across systems) when significant deficiencies are disapproved. DCMA's CPSR Group reviews contractors above the DFARS 244.302 threshold ($50M of qualifying DoD sales; the FAR 44.302(a) threshold for non-DoD contracts remains $25M), typically on a three-year cycle. What the CPSR actually examines is file discipline, per file: price or cost analysis appropriate to dollar value, evidence of competition or a signed sole-source justification, a documented flowdown determination (not just a boilerplate attachment), a SAM.gov exclusion (debarment) check dated before award, required certifications (annual reps and certs, TINA certificate where applicable, lobbying certification where applicable), negotiation memorandum, and correct clause set for the subcontract type and value. The consultant's rule: if the system cannot produce the file, the system fails the review no matter how good the pricing was.

**Subcontracts are not purchase orders.** A PO buys parts against a spec; a cost-type or T&M subcontract transfers a slice of the prime contract, with its own SOW, CDRLs, key personnel, funding profile, limitation-of-funds clause, provisional billing rates, mods, and closeout. SCAs run mini contract shops: they issue mod packages with their own conformed documents, manage sub EACs, and cannot close out until the sub's final indirect rates are audited, which can trail period of performance by years. In SAP this means subKs need their own document types, longer document lifecycles, funding visibility (this is what Dassian SCFM provides), and must never be forced through a buyer's touchless-PO pipeline.

**Flowdown determination and the clause library.** Flowdowns are determined per subcontract from three inputs: the prime contract's clause set, the subcontract dollar value, and the subcontract type. Anchor examples a practitioner carries in their head: FAR 52.222-50 (Combating Trafficking in Persons) flows to all subcontracts; FAR 52.209-6 (debarment protection) flows above $45,000, except COTS items (effective October 1, 2025; awards under earlier clause versions carry $35,000); FAR 52.219-8 (Utilization of Small Business Concerns) flows per 52.219-9(d)(9) to all subcontracts that offer further subcontracting opportunities (the simplified acquisition threshold, $350K effective October 1, 2025, is only the prescription trigger for the prime contract), and a full 52.219-9 subcontracting plan is required from other-than-small subs above $900K, or $2M for construction (effective October 1, 2025; pre-October-2025 awards retain the $750K/$1.5M thresholds in their clause version); FAR 52.203-13 (Contractor Code of Business Ethics) flows above its stated threshold; DFARS 252.204-7012 (Safeguarding Covered Defense Information) flows wherever CUI touches the sub; DFARS 252.225-7009 (specialty metals) and 252.225-7048 (export-controlled items) flow with the commodity; DFARS 252.246-7007 (counterfeit electronic part detection) flows into the electronics supply chain. A clause library (the Dassian Contracts flowdown/clause library capability) stores clauses as data with applicability rules (threshold, contract type, commodity, CAS coverage) so the determination is generated and documented, not copied from the last file.

**Consent and advance notification.** Under FAR 52.244-2(d), a contractor without an approved purchasing system needs contracting officer consent for cost-reimbursement, T&M, and labor-hour subcontracts, and for fixed-price subcontracts above the greater of the SAT in the prime contract's clause ($350K effective October 1, 2025; $250K under earlier versions) or five percent of the prime's total estimated cost; paragraph (b) separately limits consent under fixed-price primes to unpriced contract actions, which is the basis on which DCMA CPSR practice treats letter subcontracts and other unpriced actions as consent items. With an approved purchasing system, consent narrows to subcontracts the CO specifically identifies in the clause, but under cost-reimbursement primes the advance notification duty (FAR 44.201-2, 52.244-2 Alternate I) remains for any cost-plus-fixed-fee subcontract regardless of value and for fixed-price subcontracts above the greater of the SAT or five percent of total estimated contract cost. Consent packages are SCA work products: proposed sub, type, price analysis, and rationale.

**CAS touchpoints.** CAS 411 governs accounting for material acquisition costs (costing method consistency). CAS 402 forces consistency in treating purchasing and material-handling effort as direct vs indirect. CAS 410 matters strategically: subcontract-heavy programs distort a total-cost-input G&A base, which is why primes with large pass-through content often run a value-added G&A base that excludes materials and subcontracts. Procurement does not own CAS, but its direct/indirect coding decisions feed the disclosure statement.

**Counterfeit prevention and supply-chain exclusions.** DFARS 252.246-7007 requires a counterfeit electronic part detection and avoidance system; 252.246-7008 restricts electronic part sources to the original manufacturer, its authorized distributors, or suppliers who obtain parts traceably from them, with elevated test/inspection for anything else. SAE AS5553 is the implementing industry standard; GIDEP alerts must be monitored and dispositioned. Counterfeit-system deficiencies can drive purchasing system disapproval. Separately, Section 889 (implemented in FAR 52.204-24/25) prohibits covered telecommunications equipment and services (Huawei, ZTE, Hytera, Hikvision, Dahua) anywhere in the supply chain, so supplier onboarding must capture 889 representations and the ASL must be able to block excluded sources.

**What DCAA/DCMA walk through.** DCMA CPSR: a sampled file review against the 24 criteria plus policy/procedure review and buyer interviews. DCMA also administers consent, runs industrial specialists who track major subK health, and stations QARs at suppliers for government source inspection. DCAA touches this stream via MAAR 13 (purchases existence and consumption), voucher reviews on cost-type subKs, incurred cost audits that test subcontract costs claimed, and assist audits of subcontractor proposals and rates. Control points a consultant should verify exist in the system: release strategy aligned to the delegation matrix, mandatory debarment-check evidence before PO release, flowdown determination stored per document, and a payment hold pathway for cost-type subK vouchers pending SCA review.

## Technology and Systems

**SAP core for this stream:**

| Component | Role in the stream | GovCon notes |
|---|---|---|
| MM / MM-PUR | PRs, POs, contracts/scheduling agreements, release strategies, source lists, info records | Document types separate POs from subKs; release strategy mirrors the delegation of authority matrix |
| MDG-S | Governed supplier master (Business Partner) with workflow | Onboarding workflow is where debarment, 889 reps, socioeconomic data, and export screening attach |
| Subcontracting (MM) | Item category L, special stock O, component provision (541/543), ME2O monitoring | Also the vehicle for customer/government material furnished onward to suppliers; see Data |
| MM-IV (LIV) | MIRO invoice verification, three-way match, tolerance keys (OMR6), MRBR blocked-invoice release | Payment blocks are the enforcement point for cost-voucher review holds |
| FI-AP | Open items, payment runs (F110), Prompt Payment compliance | Accelerated payment to small business subcontractors (FAR 52.232-40) needs payment-term design |
| Ariba | Sourcing events, supplier lifecycle (SLP), catalogs, commerce | CUI and ITAR data generally cannot transit commercial Ariba; scope Ariba to unrestricted commodities or use a government-authorized hosting variant; complex subKs stay in core SAP |

**Dassian add-ons:**

| Module | What it does here |
|---|---|
| SCFM (Supplier Contract Financial Management) | Buy-side mirror of the contract: subK structure, funding lines, incurred cost vs funding, limitation-of-funds visibility for cost-type subKs |
| Contracts (flowdowns, clause library) | Clause library as data; generates and records the flowdown determination per PO/subK from prime contract attributes, thresholds, and type |
| PBP | Sell-side performance-based payments (FAR 52.232-32) on the prime's own contract: event schedules, event completion, and liquidation tracking; visibility into financing extended to suppliers belongs to SCFM, not PBP |

**Typical non-SAP landscape at a GovCon prime, with keep/retire/integrate guidance:**

| System (real examples) | Function | Guidance |
|---|---|---|
| Exostar | A&D supplier identity, portal, secure exchange | Keep; integrate for supplier onboarding and document exchange; it is the de facto A&D network |
| Jaggaer / Coupa / Ivalua | Sourcing and P2P suites (Ariba alternatives) | Consolidate to one; retire overlapping sourcing tools when Ariba or core MM-PUR covers the flow |
| Visual Compliance (Descartes) or similar denied-party screening | Restricted/denied party and sanctions screening | Keep; integrate into BP onboarding and periodic rescreening; SAP GTS can also cover this |
| SAP GTS or E2open GTM | Export license determination, embargo checks | Keep or implement where foreign suppliers or repair/return exports exist |
| Net-Inspect | Supplier FAI (AS9102) and quality data | Keep; integrate results to QM usage decisions where volume justifies |
| ERAI | Counterfeit part risk database for electronics | Keep as SQE screening source alongside GIDEP |
| Interos / Exiger / Craft | Supply chain illumination and risk monitoring | Keep standalone; feed alerts to supplier risk workflow, do not force into SAP |
| Icertis / Agiloft (CLM) | Contract document lifecycle, e-signature | Integrate or retire in favor of the clause-library-driven subK document set; avoid two clause sources of truth |
| Deltek Costpoint | Common ERP at mid-tier subs | Not yours to change; matters for what data your subs can actually give you |

**Government portals at the boundary:** SAM.gov (exclusions, entity registration, reps and certs), eSRS (ISR/SSR small business reporting), PIEE (the DoD procurement environment: WAWF receiving and acceptance on the sell side, the GFP module for government furnished property accountability, SPRS for NIST SP 800-171 supplier scores), FPDS-NG (award data used in market research), and GIDEP (alert exchange). None of these have productive standard SAP integrations; plan lightweight extract/upload processes and store evidence (for example the dated SAM exclusion check) against the purchasing document.

## Data

| Data object | Main SAP tables | Owner (from People) | Notes |
|---|---|---|---|
| Supplier master (Business Partner, vendor roles) | LFA1, LFB1, LFM1 (BP/CVI persistence) | MDG-S steward under Procurement Director; AP owns company-code views; Trade Compliance owns screening status | Socioeconomic classifications, 889 rep status, ASL status, debarment check date all live or link here |
| Purchasing info records / source list | EINA, EINE, EORD | Buyer (commodity) | Source list plus quality info record enforce the approved supplier list |
| Quality info record / inspection setup | QINF, QALS (lots), QMEL (notifications) | SQE | QM procurement key in material master gates receiving inspection |
| Purchase requisitions | EBAN | Requisitioner; buyer converts | Account assignment to WBS or order is the cost-flow decision |
| Purchase orders | EKKO, EKPO, EKET, EKKN, EKBE | Buyer | EKBE is the PO history spine for OTD and match analysis |
| Subcontracts (as purchasing docs plus SCFM) | EKKO/EKPO with subK document types; Dassian SCFM tables for funding/incurred | Subcontract Administrator | Flowdown determination record and consent evidence attach here |
| Subcontracting component stock | Special stock O; material documents in MATDOC | Buyer/MPM for balances; SQE for quality status | Physical inventory at suppliers is a recurring audit item |
| Invoices | RBKP, RSEG; accounting in BSEG/ACDOCA | AP Manager | Payment blocks and tolerance results live here |
| Open AP items / payments | BSIK (compatibility) / ACDOCA, payment run data | AP Manager | Prompt Payment interest exposure reporting |

**Migration objects and load sequence** (S/4HANA Migration Cockpit objects exist for most of these): 1) suppliers as Business Partners with vendor roles, after company code and purchasing org config, including bank data and socioeconomic attributes; 2) purchasing info records and source lists; 3) quality info records and inspection settings (before open POs, or receipts will skip inspection); 4) open POs and subKs (open quantities only; history stays in the legacy archive, which matters because CPSR files must remain retrievable); 5) special stock O balances at suppliers (reconciled and confirmed by suppliers before cutover); 6) open AP items and GR/IR balances with Finance. Do not migrate closed POs, and do not migrate open PRs unless the backlog is genuinely active.

**Government/customer furnished material to suppliers.** When government furnished property is further provided to a subcontractor, the prime remains accountable under FAR 52.245-1. In SAP the outbound provision rides the subcontracting mechanism (special stock O at the supplier), while GFP identity is preserved via the property record and, for DoD, the PIEE GFP module. The gotcha: special stock O tells you what is at the supplier but not that it is government property; the property master and stewardship reporting must be layered on, and physical inventories at suppliers must cover it.

**CUI and export-controlled data.** The purchasing documents themselves are usually not CUI, but their attachments frequently are: SOWs derived from the prime contract, drawings and technical data packages (often ITAR or EAR controlled), and subcontractor cost proposals (contractor proprietary, and certified cost or pricing data). Store technical data in DMS or a controlled repository with authorization groups, not as free attachments; mark CUI; restrict foreign-person access; and remember DFARS 252.204-7012 obligations follow the data to any cloud (including Ariba) it touches. Supplier bank data is not CUI but is fraud-sensitive and belongs under change logging and dual control.

## Security and Authorizations

**PFCG role shapes** (build as business roles composed from single roles):

- **Buyer**: ME51N/ME21N/ME22N create-change on PO document types only, restricted by purchasing group (M_BEST_EKG), purchasing org, plant (M_BEST_WRK), and document type (M_BEST_BSA). No supplier master maintenance, no goods movements, no invoice entry.
- **Subcontract Administrator**: same shape but scoped to subK document types via M_BEST_BSA; plus display of SCFM funding objects; plus attachment/DMS authorization for controlled documents.
- **PO Approver**: release codes via M_EINK_FRG mapped 1:1 to the delegation of authority matrix; approvers hold no create/change on the documents they release.
- **Receiving / Stores**: MIGO movement types for receipt and transfer; no PO change; subcontracting issue (541) separately assignable.
- **Quality (SQE)**: QM usage decisions, quality info records, ASL maintenance; no PO authority.
- **AP Clerk**: MIRO/FB60 entry; no payment run.
- **AP Payment**: F110 and payment media (F_REGU_BUK); no invoice entry, no supplier bank maintenance.
- **Supplier Master Steward (MDG-S)**: BP maintenance through governance workflow only; direct LFA1/BP change locked for everyone else.
- **Auditor (DCAA/DCMA or internal)**: display-only composite (ME23N, MIR4, BP display, report access), no export of bank data, time-boxed.

**Segregation-of-duties toxic pairs:**

| Toxic pair | Risk | Mitigation |
|---|---|---|
| Create/change supplier master + create PO | Fictitious supplier fraud | MDG-S workflow with separate steward; SoD rule in GRC Access Control |
| Create PO + approve/release same PO | Self-approval above delegation | M_EINK_FRG held only by approver roles; release strategy cannot be released by creator (workflow check) |
| Create PO + post goods receipt | Phantom receipts complete a match | Separate receiving role; where unavoidable at small sites, monitored as mitigated risk with monthly EKBE review |
| Post goods receipt + enter invoice | Two legs of three-way match in one hand | Organizational split (stores vs AP); alert on same-user GR+IV per document |
| Enter invoice + release blocked invoice (MRBR) | Bypass of tolerance controls | MRBR restricted to AP supervisor plus, for subK vouchers, SCA concurrence |
| Enter invoice + run payment (F110) | Pay-yourself fraud | Separate AP payment role; payment proposal review by second person |
| Maintain supplier bank data + run payment | Redirected payments | Bank changes via MDG-S workflow with callback verification; change log review |
| Maintain ASL/quality info record + make usage decisions on own supplier | Quality gate self-override | SQE peer review on ASL changes; usage decision by inspection, not by ASL owner, for critical parts |

**Auditor access design.** DCAA and DCMA rarely get transactional SAP access; the sustainable pattern is a display-only role granted for the engagement window, plus a standing extract capability (PO file index, EKBE history, voucher registers) so auditors work from data rather than shoulder-surfing. Every CPSR artifact (price analysis, debarment evidence, flowdown record) should be retrievable by PO number without a buyer present.

**Export-control specifics.** Screen suppliers at onboarding and on a rescreening cadence against denied/restricted party lists (Visual Compliance or SAP GTS); block PO output to failed suppliers. Technical data attached to purchasing documents needs DMS authorization groups so foreign-person users (including offshore support teams and system integrator staff) cannot open ITAR content; this is routinely missed when AMS/support is offshored. Foreign suppliers receiving technical data need a license or exemption determination by the Empowered Official before RFP release, not after award.

## Analytics and Reporting

| Report | To whom | Cadence | SAP source |
|---|---|---|---|
| eSRS ISR (Individual Subcontract Report) | Government via eSRS, per contract with an individual plan | Semiannual (periods ending Mar 31 / Sep 30, due Apr 30 / Oct 30) plus final | PO/subK commitments (EKKO/EKPO) joined to supplier socioeconomic attributes; SBLO certifies |
| eSRS SSR (Summary Subcontract Report) | Government via eSRS | Annual for DoD | Same base, rolled to company level |
| CPSR self-assessment metrics | Procurement Director, then DCMA at review | Quarterly internal; triennial CPSR | File audit sampling against PO index (EKKO by document type/value band) |
| PO and subK cycle time (PR approval to PO, RFP to award) | Supply Chain leadership, programs | Monthly | EBAN/EKKO timestamps, release strategy logs |
| Supplier OTD | Commodity teams, SQE, supplier scorecards | Monthly | EKET (promised) vs EKBE (receipt) |
| Supplier quality (receiving escapes, PPM, corrective actions) | SQE, Quality leadership | Monthly | QALS usage decisions, QMEL notifications |
| Open commitments by program/WBS | MPMs, program finance (feeds EAC) | Monthly close | Commitment line items from account-assigned POs |
| GR/IR aging and blocked invoices | Controller, AP Manager | Monthly close | GR/IR account, RBKP/RSEG payment blocks |
| SubK funding vs incurred (limitation of funds watch) | SCAs, Subcontracts Manager, program finance | Monthly | Dassian SCFM |
| Counterfeit/GIDEP disposition log | SQE, compliance | Ongoing, reviewed quarterly | QM notifications with GIDEP reference |

**Embedded analytics vs warehouse.** Operational lists (cycle times, OTD, blocked invoices, ME2O subcontracting stock) belong in embedded S/4 analytics on live CDS views; they are transactional users' working lists. Cross-year trend reporting, eSRS reconciliation across award years, supplier scorecards blending QM + logistics + risk-feed data, and anything joined to non-SAP sources (SPRS scores, Interos alerts) belong in the warehouse/lakehouse layer. eSRS numbers specifically need a locked, reproducible dataset per submission period because the SBLO signs them and they get questioned years later.

**KPIs by role:** Procurement Director: CPSR file audit pass rate, cycle time, savings, business system status. Buyers: PR aging, competition rate, OTD of their commodity. SCAs: consent/notification timeliness, subK cost/schedule variance, closeout backlog. SBLO: SB goal attainment vs plan by category (SB, SDB, WOSB, HUBZone, SDVOSB), on-time eSRS submission. SQE: receiving escape rate, FAI on-time, ASL currency. AP: percent touchless match, blocked invoice aging, Prompt Payment interest paid (should be near zero).

## Role of AI

Concrete use cases with real payoff in this stream:

1. **Flowdown determination assistant**: given the prime contract clause set, subK value, type, and commodity, propose the flowdown matrix from the clause library with rule citations. The SCA reviews and certifies; the AI output becomes the documented determination draft.
2. **Price analysis drafting**: assemble purchase history (EINA/EKBE), quote comparisons, and index data into a draft price reasonableness memo in the CPSR-expected format. The buyer edits and signs.
3. **Sole-source justification drafting**: turn engineering's technical rationale into a structured justification, flagging weak spots a CPSR reviewer would hit.
4. **CPSR file completeness pre-audit**: scan the electronic PO file against the checklist (analysis present, debarment check dated pre-award, certs on file, flowdown record present) and produce exception lists by buyer, continuously rather than in the panic quarter before the review.
5. **SubK voucher triage**: compare cost-type subK vouchers against provisional billing rates, funding remaining, period of performance, and prior voucher patterns; flag anomalies for SCA review before the payment block is lifted.
6. **Supplier risk synthesis**: summarize SAM exclusions, SPRS score changes, GIDEP/ERAI alerts, financial stress signals, and 889 exposure into a per-supplier brief for SQE and commodity managers.
7. **eSRS reconciliation**: reconcile ISR/SSR draft numbers to the PO commitment ledger and prior submissions, explaining movements before the SBLO certifies.

**Compliance boundary.** A human must sign, and be personally accountable for: the price/cost analysis and negotiation memorandum (CPSR evaluates buyer judgment, and DCMA will interview the buyer, not the model), consent packages sent to the government, TINA certificates, eSRS submissions (the SBLO certifies), counterfeit part dispositions (SQE), export license determinations (Empowered Official), and payment release on held vouchers. AI drafts; named humans determine and certify. Policy should say this explicitly so a CPSR reviewer sees a controlled process, not an abdication.

**Grounding and auditability rules.** Any AI output feeding a government deliverable must: (a) cite the source records it used (PO numbers, clause identifiers with the FAC/DFARS change level of the clause version, supplier IDs, voucher numbers); (b) take clause text only from the version-pinned clause library of record, never from model memory; (c) be stored with its prompt/context and reviewer identity so the file shows what the human saw before certifying; (d) run only in an environment authorized for the data class involved (no CUI or ITAR technical data into services outside the accredited boundary); and (e) be labeled as a draft until certified. Wrong clause citations in a flowdown are worse than missing ones, so the assistant must fail closed: no rule match, no clause.

## Operating Model

**Organization.** Two dominant variants. (1) Program-aligned matrix: SCAs and MPMs are dedicated to programs and sit in program war rooms, with a functional home in Supply Chain that owns standards, training, and the CPSR file; buyers stay commodity-aligned in a shared pool. This is typical at primes with large cost-type subK content. (2) Shared services: all buying and subK admin in a central factory with intake queues, typical where the mix is production POs and catalog buys. Hybrid is the norm: complex subKs program-aligned, tactical buying centralized, AP always in Finance shared services, receiving at the sites. Subcontracts occasionally reports to the sell-side Contracts VP rather than Supply Chain; when it does, clarify early who owns the clause library and the CPSR response, because it splits.

**Calendar:**

| Cadence | Activities |
|---|---|
| Monthly (close) | Commitment reconciliation to program ledgers, GR/IR review, accruals for received-not-invoiced, blocked invoice aging review, supplier OTD/quality scorecards, subK funding-vs-incurred review (limitation of funds watch) |
| Quarterly | SubK ETC letters and inputs to program EACs, small business goal attainment review vs plan, CPSR self-audit sample and metrics, supplier risk review board |
| Semiannual | eSRS ISR preparation, reconciliation, SBLO certification and submission (Apr 30 / Oct 30) |
| Annual | eSRS SSR, incurred cost submission support (schedules covering subcontract awards and costs claimed feed the ICS), annual reps and certs refresh across the supplier base, procurement policy manual update, delegation matrix refresh, supplier requalification/ASL scrub |
| Triennial / event-driven | CPSR (and corrective action plans after), business system status changes, GIDEP dispositions as alerts arrive, consent packages as awards require |

**Government counterparts.** The PCO (procuring contracting officer) owns the prime clause set the flowdowns derive from; consent to subcontract is granted by the cognizant contracting officer responsible for administration, typically the DCMA ACO where administration is delegated, the PCO where retained (FAR 44.201-1). The ACO (administrative contracting officer, usually DCMA; CACO/DACO at the corporate level) determines purchasing system status and receives notifications. DCMA specialists this team meets by name: the CPSR team lead, industrial specialists tracking major subcontractor health, QARs performing government source inspection at suppliers, and property administrators for GFP (including GFP furnished onward to subs). DCAA appears for incurred cost audits touching subK costs, voucher reviews, MAAR 13 purchases existence testing, and assist audits of subcontractor proposals that your SCAs request through the government.

**Where it sits.** Supply Chain typically reports to the COO or company president; AP to the Controller; SQE to Quality. The function's health is externally scored: an approved purchasing system is a competitive asset (it removes consent friction and signals maturity), and losing it triggers withholds and PCO-level consent on everything, which programs feel immediately.

## How a Consultant Engages This Function

**Workshop casting.** Cast workshops by decision, not by module:

| Workshop | Must be in the room |
|---|---|
| Document types, release strategy, delegation matrix | Procurement Director, CPSR Lead, Subcontracts Manager, one working buyer |
| Supplier master governance (MDG-S) | Supplier master steward, AP Manager, Trade Compliance, SBLO, SQE |
| SubK data model (SCFM, funding, mods, closeout) | Subcontracts Manager, senior SCA, program finance/MPM, Dassian architect |
| Flowdown/clause library | Subcontracts Manager, sell-side Contracts counsel, CPSR Lead |
| Subcontracting/special stock O and GFP-to-supplier | Buyer, stores lead, property administrator, SQE |
| LIV tolerances, payment blocks, voucher holds | AP Manager, Controller delegate, Subcontracts Manager, CPSR Lead |
| Receiving inspection and ASL | SQE, receiving lead, commodity buyer |

**Sign-offs.** Release strategy and delegation design: Procurement Director signs, CPSR Lead concurs (it must trace to the policy manual DCMA reads). Supplier onboarding workflow: AP and Trade Compliance both sign (bank fraud and export screening live there). SubK document/funding model: Subcontracts Manager and program finance. Tolerance keys and voucher hold design: Controller and Subcontracts Manager jointly. Anything touching eSRS source data: SBLO. Ariba or any cloud scope decision: CISO/Trade Compliance for the CUI boundary before any commercial team commits.

**Common failure modes of S2P implementations at GovCon companies:**

- Forcing subcontracts through the PO pipeline: SCAs get buyer roles and a touchless workflow, and the mod/funding/closeout lifecycle ends up in spreadsheets next to SAP. Model subKs distinctly from day one.
- Flowdowns as a PDF attachment named "Terms": no determination record, instant CPSR finding. Implement the clause library as data with per-document determinations.
- Release strategy sprawl: dozens of characteristics nobody can maintain; it must be the delegation matrix in system form, nothing more.
- Migrating open POs without their compliance evidence, then failing a file request two years later because the legacy archive was decommissioned.
- Ignoring special stock O at cutover: supplier-held balances unreconciled, physical inventory findings and MMAS-adjacent questions follow.
- LIV tolerances copied from a commercial template: either everything blocks (AP drowns, Prompt Payment interest accrues) or nothing blocks (cost-voucher review evaporates). Tolerances and the subK voucher hold are a designed control, set with AP, Subcontracts, and the CPSR Lead together.
- ASL enforced only on paper: source list and quality info records not maintained, so SAP happily orders from unapproved sources while the quality manual claims otherwise.
- Scoping CUI-bearing buys into commercial cloud sourcing without a data-class review.

**What world class looks like.** Catalog and low-risk buys are touchless (requisition to paid with no human touch, tolerances doing the work) so buyers spend their time on sourcing and files. Every PO/subK has a machine-generated, human-certified flowdown determination and a complete electronic file retrievable in seconds; CPSR prep is an extract, not a project. Subcontract funding, incurred cost, and ETC live in SCFM and reconcile to program EACs without rework. The ASL, quality info records, and source lists are the same truth the quality manual claims. eSRS numbers reproduce from a locked dataset. Supplier risk (exclusions, SPRS, GIDEP, 889, financial) flows to the people who can act within days, not at annual review. And the purchasing system stays approved through every review, because the system produces the evidence as a byproduct of doing the work, not as a separate compliance exercise.
