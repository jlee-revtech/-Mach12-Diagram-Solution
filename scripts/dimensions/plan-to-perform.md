---
stream: plan-to-perform
---

# Plan-to-Perform in a US Government Contractor: The Eight-Dimension Operating Profile

Plan-to-Perform is the program planning and controls (PP&C) value stream of a US GovCon aerospace and defense company. It owns the Earned Value Management System (EVMS) under the EIA-748 guidelines (Revision D's 32-guideline structure still underpins the DoD EVMSIG and most in-force System Descriptions; Revision E, published February 2026, consolidates to 27 guidelines): the performance measurement baseline (PMB), control accounts, work packages, planning packages, work authorization, baseline change control, EAC/ETC cycles, and the government-facing performance deliverables (IPMR/IPMDAR, CFSR, NASA 533). On SAP S/4HANA the stream runs on PS, PPM, CO, and Group Reporting, extended by Dassian Project Management (PPC time-phased planning, EVM engine, CAM workbench, EAC/ETC, IPMR/533 reporting). It consumes ACWP and rates from Record-to-Report, the winning basis of estimate from the proposal function, and material earned value signals from production/MMAS. It is the stream DCMA's EVMS Center walks through when it surveils the business system.

## People

| Title | What they own | What they sign off | Day-to-day pains |
|---|---|---|---|
| Director of Program Planning & Controls | The EVMS System Description, PP&C staffing, tools (SAP PS/CO, Dassian PPC, Primavera P6), DCMA relationship | EVMS System Description changes, OTB/OTS requests, comprehensive EAC results, corrective action responses to DCMA CARs | Config drift between the System Description and how SAP/Dassian actually behave; CAM turnover; surveillance findings landing during proposal crunch |
| Program Controls Manager (per program) | The program's PMB, control account structure, MR and UB logs, the monthly EV close calendar | Baseline change requests (BCRs), work authorization documents (WADs), the monthly IPMDAR package before PM certification | Reconciling Dassian BCWS to what CAMs think they were given; freeze period violation requests; late ACWP from finance |
| Control Account Manager (CAM) | One or more control accounts: scope, schedule, budget; work package status; EV claims; VAR narratives; ETCs | Monthly earned value claims, variance analysis reports for their accounts, bottoms-up ETC each EAC cycle | Doing CAM work on top of a day job (CAMs are matrixed engineers/ops leads); DCMA CAM interviews; charging discipline of their teams |
| Master Scheduler | The integrated master schedule (IMS) in Primavera P6 or MS Project as schedule of record; schedule health; critical path | Schedule status each period, schedule risk assessment inputs, the cost-schedule integration mapping (P6 activity to SAP/Dassian work package) | Keeping P6 and the SAP WBS in sync after BCRs; DCMA 14-point metric breaches; logic ties broken by rolling wave detail planning |
| EVMS Analyst / Compliance Lead | EIA-748 guideline compliance, data traces, DECM metric hygiene, internal surveillance and self-assessment | Monthly data integrity checks (BCWS/BCWP/ACWP tie-outs), mock CAM interview readiness | Explaining every retroactive change; chasing CAMs for late claims; keeping evidence packages audit-ready |
| Program Financial Analyst | Program cost ledger views (CJI3/ACDOCA), funds status, CFSR preparation, billing interface facts | Funds expenditure forecasts in the CFSR, EAC cost inputs reconciled to the books | Commitments (COOI) not matching subcontract reality; rate changes from finance landing mid-cycle |
| Program Manager | Program execution; owns the EAC number that goes to the customer and to Group Reporting | IPMDAR/IPMR certification, quarterly EAC, OTB/OTS request to the customer | Being accountable for an EAC built from CAM inputs they can only sample-check |
| Baseline / Change Manager | The BCR log, freeze period enforcement, MR/UB transaction log, budget traceability from contract budget base down | BCR completeness before Program Controls Manager approval; budget log reconciliation | Retroactive change pressure at close; keeping the CBB = NCC + AUW arithmetic clean across mods |

Typical reporting lines: the Director of PP&C reports to the VP of Programs (or COO) at operations-led primes, or to the CFO at finance-led companies; either way there is a dotted line to the other. CAMs live in functional home organizations (engineering, manufacturing, supply chain) and are matrixed to programs; the OBS and the responsibility assignment matrix (RAM) make that formal. Schedulers and program financial analysts report into PP&C, deployed to programs.

Who a consultant must have in the room: WBS and coding mask design needs the Director of PP&C, the finance controller (Record-to-Report owner), and a Dassian/SAP architect together, because the WBS is simultaneously the EVMS structure and the cost collection structure. Control account sizing needs CAM representatives plus the EVMS compliance lead. The cost-schedule integration seam needs the master scheduler and IT. Anything touching the EVMS System Description needs the Director of PP&C, full stop, because DCMA holds them accountable for it.

## Process

End-to-end flow: (1) proposal hands off the winning basis of estimate; (2) budgets are distributed from the contract budget base (CBB = negotiated contract cost + authorized unpriced work) into control accounts, undistributed budget (UB), and management reserve (MR), with PMB = CBB minus MR (discipline check a practitioner applies constantly: MR is contractor-controlled budget inside the CBB but outside the PMB, for realized in-scope risk, never for overruns; UB is budget inside the PMB awaiting distribution to control accounts, usually from a fresh mod; proposal contingency lives in price and profit assumptions and never enters the EVMS budget structure at all); (3) work authorization documents open control accounts and work packages for charging; (4) rolling wave planning converts planning packages into detail-planned work packages inside the planning horizon; (5) monthly EV close measures BCWP against BCWS and ACWP; (6) variance analysis with root-cause narratives and corrective actions where thresholds trip; (7) baseline change control governs every budget move; (8) quarterly EAC/ETC updates plus an annual comprehensive EAC; (9) government deliverables (IPMDAR/IPMR, CFSR, NASA 533); (10) DCMA surveillance and periodic compliance review.

GovCon overlay this stream owns or feeds:

- **EVMS clauses.** FAR 52.234-2 and 52.234-3 (notice of EVMS, pre-award and post-award IBR) and FAR 52.234-4 (EVMS) on civilian work; DFARS 252.234-7001 (notice) and 252.234-7002 (EVMS) on DoD work, with deviation provision/clause 252.234-7998/-7999 prescribed in lieu of them for new DoD solicitations under Class Deviation 2026-O0011 (existing contracts retain the clauses they were awarded with). The DFARS 234.201 text still reads $20M (comply with EIA-748) and $50M (formally determined compliant), but operative DoD policy set by class deviation is different, and agents must state the operative tiers: below $50M = EVM optional, applied on a risk-based program decision; $50M to $100M (cost or incentive contracts and subcontracts) = EVMS compliant with the EIA-748 guidelines, with no formal validation and no routine DCMA compliance review; $100M and above = EVMS formally determined compliant ("validated") by the cognizant federal agency, in practice DCMA. Two class deviations drive this: Class Deviation 2015-O0017 raised the validation threshold from $50M to $100M in September 2015, and Class Deviation 2026-O0011 (implementing FY2025 NDAA Section 823, effective February 2026) raised the application threshold from $20M to $50M. On guideline counts: EIA-748-D contains 32 guidelines in five categories (organization; planning, scheduling and budgeting; accounting considerations; analysis and management reports; revisions and data maintenance) and remains the basis of the DoD EVMSIG and most in-force System Descriptions; EIA-748-E (February 2026) consolidates the set to 27 guidelines, so check which revision the contract, the EVMSIG in effect, and the System Description cite before quoting a count. Some civilian agencies scale or tailor how the guidelines are applied on smaller or lower-risk efforts (per the NDIA IPMD scalability guidance); in DoD practice the full guideline set applies once EVMS applies, and the real difference between the tiers is formal validation and surveillance intensity.
- **Business system criteria.** EVMS is one of the six DFARS contractor business systems under DFARS 252.242-7005; a disapproval can trigger payment withholds of up to five percent per disapproved system (the clause caps total withholds). This stream owns the EVMS criteria (embedded in 252.234-7002), feeds MMAS (DFARS 252.242-7004) through material earned value and pegging data, and depends on the accounting system (DFARS 252.242-7006) for ACWP integrity.
- **CAS.** CAS 401 (consistency between estimating, accumulating, and reporting costs) is the reason the proposal BOE structure must map cleanly onto the control account structure. CAS 402 (consistency in allocating costs for the same purpose) constrains how direct versus indirect treatment can differ between plan and actuals. CAS 405 (accounting for unallowable costs) and CAS 406 (cost accounting period) constrain the cost accounting practices and periods the EVMS actuals ride on; the PMB's composition itself (budget for authorized work, MR outside it, UB inside it) is defined by the EIA-748 budget-structure rules, not by CAS. The Disclosure Statement is the reference document; the EVMS System Description must not contradict it.
- **WBS.** DoD programs structure the WBS per MIL-STD-881 (current revision) product-oriented templates; the contract CDRL usually mandates the reporting level.
- **Control points.** Work authorization before charging (no WAD, no open charge codes); freeze period rules that prohibit changes to open-period or historical BCWS/BCWP except for documented error correction; MR moves only by logged transaction, never into overrun; EV claims entered only by the accountable CAM; retroactive changes require Program Controls Manager approval with an audit trail; OTB/OTS (over target baseline / over target schedule) only with customer notification and formal reprogramming.

What DCMA and DCAA walk through: DCMA's EVMS Center runs data-driven surveillance using its automated EVMS compliance metrics (DECM) against monthly submissions, plus CAM interviews, budget traces (CBB to control account to work package), EV method spot checks, schedule health via the DCMA 14-point assessment, and MR/UB log reviews. Findings arrive as Corrective Action Requests (CARs) graded by severity; systemic Level III/IV CARs threaten business system disapproval and withholds. DCAA touches this stream indirectly: it tests CAS 401 consistency between proposals and cost accumulation, uses EAC support during forward pricing and incurred cost audit work, and relies on the accounting system for ACWP, so a bad reconciliation between Dassian EV data and ACDOCA becomes a finding even though DCAA never opens the PPC workbench. The IBR (integrated baseline review), led by the government program office typically within 180 days of award, is where the PMB itself is examined: CAM by CAM, budget by budget.

The reconciliation contract with Record-to-Report is a formal seam: finance fulfills ACWP (actual cost of work performed) and rates (forward pricing and provisional billing rates applied consistently per CAS 401/402); program controls owns BCWS, BCWP, EV methodology, and everything above the actuals line. Monthly, EVMS analysts tie Dassian ACWP to ACDOCA to the penny at control account level before anything goes to the government.

## Technology and Systems

SAP core for this stream:

| Component | Role in Plan-to-Perform |
|---|---|
| SAP PS (Project System) | System of record for project definition, WBS hierarchy, networks/activities and milestones where used, budgets (CJ30), status management, settlement. Key transactions: CJ20N (Project Builder), CJ40/CJR2 (cost planning), CJ30/CJ32 (budget/release), CJI3 (actual line items), CN41N (structure overview), CJ88 (settlement) |
| SAP PPM (Portfolio and Project Management) | Portfolio layer: pipeline, IRAD and capital portfolios, portfolio buckets/items linked to PS projects; resource and demand views. Not the EVMS engine |
| SAP CO | Cost centers (CSKS), activity types and plan rates (KP26), cost elements as GL accounts in ACDOCA, commitments (COOI), allocations, results analysis feeding revenue recognition |
| SAP Group Reporting | Consolidated program rollups where a program spans company codes; interdivisional work authorization elimination; the EAC-driven margin picture the CFO reports externally |

Dassian Project Management (the A&D overlay in the /DSN/ namespace) supplies what standard PS lacks for EVMS: PPC time-phased plan versions (baseline BCWS, EAC/ETC versions), the EVM calculation engine (BCWS/BCWP/ACWP, CPI/SPI, variances by control account), CAM assignments and the CAM workbench, EAC/ETC processing, period snapshots for reproducible reporting, IPMR/NASA 533 report generation, and P6 schedule integration. Design rule: the WBS lives once in PS; Dassian time-phases against it; never maintain a parallel structure.

Non-SAP systems typically found at a GovCon prime or Tier-2 supplier, with keep/retire/integrate guidance:

| System | Typical role | Guidance |
|---|---|---|
| Oracle Primavera P6 (or MS Project at smaller shops) | Schedule of record (IMS) | Keep. Never rebuild the IMS in SAP. Integrate: P6 activity to Dassian work package mapping is the cost-schedule integration seam |
| Deltek Cobra / legacy Deltek MPM | Incumbent EV cost engine | Retire into Dassian PPC on S/4; migrate baseline history carefully or freeze legacy for closed periods |
| Deltek Acumen Fuse / Steelray | Schedule health analytics (14-point style checks) | Keep as scheduler tooling; feed from P6, not SAP |
| Encore Analytics Empower / Deltek wInsight Analytics | EV analysis and government-format review | Keep during transition; retire once Dassian/BI parity is proven to the PP&C director's satisfaction |
| ProjStream BOEMax (or estimating tools) | Basis of estimate library | Integrate at the proposal-to-baseline handoff: winning BOE becomes the budget log seed |
| Risk tools (Active Risk Manager, Safran Risk, Primavera Risk Analysis) | Risk register, schedule risk analysis | Keep; integrate risk register IDs to control accounts for risk-adjusted EAC |
| Power BI / Tableau | Program review dashboards | Keep; point at governed extracts or CDS views, never at screen-scraped spreadsheets |

Government portals at the boundary: EVM-CR (the DoD Earned Value Management Central Repository) receives IPMDAR electronic submissions; CADE (Cost Assessment Data Enterprise) receives cost and (increasingly) EVM data for OSD cost analysis; classified programs deliver through program-specific channels instead. The stream also feeds CDRL delivery processes managed by contracts, and its EAC output feeds the billing stream (progress payments, revenue recognition) rather than any portal directly.

## Data

| Data object | Main SAP tables | Owner (from People) |
|---|---|---|
| Project definition | PROJ | Program Controls Manager (created per PP&C standards) |
| WBS elements and hierarchy | PRPS, PRHI | Program Controls Manager; structure standards owned by Director of PP&C |
| Networks, activities, milestones (where used) | AUFK/AFKO, AFVC, MLST | Master Scheduler (via P6 integration) |
| Budgets (original, releases, returns) | BPGE, BPJA | Baseline / Change Manager, approved by Program Controls Manager |
| Time-phased plan (BCWS), EAC/ETC versions | Dassian PPC plan tables (/DSN/ namespace) | CAMs enter; Program Controls Manager approves |
| CAM assignments / RAM | Dassian CAM assignment objects against PRPS | Director of PP&C (RAM is the OBS-to-WBS intersection) |
| Actual costs and commitments | ACDOCA (line items), COOI (commitments) | Finance (Record-to-Report); read-only to this stream |
| Cost centers, activity types, plan rates | CSKS, CSLA, COST (activity prices maintained via KP26) | Finance owns rates; PP&C consumes per the reconciliation contract |
| Statuses (system/user) | JEST, TJ30 | Program Controls Manager (status profile design by PP&C + architect) |
| Settlement rules | COBRB | Finance designs; PP&C validates against WBS design |
| MR / UB / BCR logs | Dassian change objects or governed custom Z tables | Baseline / Change Manager |

Migration objects and load sequencing for a brownfield or Deltek-to-Dassian move:

1. Controlling area, cost centers, activity types, plan rates (KP26) so costing works.
2. Project profiles, coding masks, status profiles, Dassian PPC configuration (plan versions, EV methods, thresholds) matching the EVMS System Description.
3. Project definitions, then WBS hierarchies (S/4 migration cockpit provides PS objects; mass loads use the standard PS BAPI sequence).
4. Networks/activities and milestones, or the P6 mapping table if schedule stays external.
5. Budgets and the budget log (CBB trace must survive migration; load MR and UB as logged transactions, not plugs).
6. Dassian time-phased baseline (BCWS) by control account/work package, then current-period EAC/ETC versions.
7. CAM assignments and work authorization status.
8. Open commitments; historical actuals as period balances (line-item history usually stays in the legacy archive with a documented retrieval path, because DCMA will ask to trace history).

Sequencing rule of thumb: never load BCWS before the WBS is frozen and the coding mask validated, and never open charging (status release) before WADs exist. Migrating an in-flight program mid-period of performance requires a documented baseline preservation approach that DCMA has seen before cutover.

CUI and export control: contract-specific cost and schedule performance data (IPMDAR datasets, time-phased baselines, VARs, EACs) is routinely Controlled Unclassified Information and must be marked and handled per contract terms; WBS element descriptions and milestone texts can embed ITAR/EAR technical data (performance parameters, design references) and then inherit export control; classified program cost data does not enter the corporate S/4 tenant at all and runs in a separate accredited enclave with sanitized rollups coming back for consolidation. Treat the Dassian snapshot tables and any BI extract as carrying the same markings as the source.

## Security and Authorizations

PFCG role shapes for this stream (composite by role, single roles by capability):

- **PP&C display**: read-only across CJ20N (display), CJI3, CN41N, standard PS reports, Dassian PPC display. The base role for auditors, PMs, and finance.
- **CAM**: Dassian plan entry and EV claim entry restricted to assigned control accounts, ETC update, display of actuals; no budget (CJ30), no WBS master data change, no status management.
- **Master Scheduler**: network/activity and milestone maintenance (or interface monitoring rights if P6 is the source), display of everything else.
- **Program Controls Manager**: WAD/status release, BCR approval in the change workflow, Dassian version management; no budget entry and no plan entry (approves, does not enter).
- **Baseline / Change Manager**: CJ30/CJ32 budget maintenance, budget log and MR/UB log maintenance; cannot approve their own BCRs.
- **PP&C admin/architect**: project profiles, coding masks, status profiles, Dassian config; transportable config only, no production data-entry rights.
- Finance settlement, results analysis, and rate maintenance roles belong to Record-to-Report and must not be merged into PP&C composites.

Fine-grained per-project security in PS is coarse out of the box (profile, project type, controlling area); companies needing per-program ACLs typically implement the standard PS authorization customer exit (CNEX0002) or an equivalent access-control table checked in CDS DCLs for the Fiori/analytics layer.

Segregation-of-duties toxic pairs:

| Toxic pair | Why it is toxic | Mitigation |
|---|---|---|
| Budget maintenance (CJ30) + BCR approval | One person could move budget without independent review; destroys budget trace credibility with DCMA | Split Baseline/Change Manager (enters) from Program Controls Manager (approves); workflow-enforced |
| EV claim entry + EVMS surveillance/compliance role | Self-review of the claims being surveilled | EVMS Analyst holds no entry rights on live programs they surveil |
| WBS create/change + status release (open for charging) | Enables unauthorized scope to start charging (work authorization bypass) | Master data admin cannot release; release tied to WAD workflow |
| Plan rate maintenance (KP26) + EAC approval | Rate manipulation to steer the EAC | Rates owned by finance; EAC approval in PP&C/PM chain |
| Dassian baseline version maintenance + period snapshot control | Could rewrite history after reporting | Snapshot execution restricted to a batch user; version changes logged and freeze-period checked |
| Retroactive actuals adjustment (CO repostings) + IPMDAR preparation | Could groom ACWP to fit the story | Repostings stay in finance; PP&C sees them via the monthly tie-out, with error-correction documentation |

Auditor access design: give DCMA/DCAA and internal audit the PP&C display composite, time-boxed, tied to a named review, with logging enabled; never screen-share a power user's session as the standing answer. Provide governed extracts (the same snapshot the IPMDAR came from) rather than ad hoc queries so the data they analyze matches what was delivered.

Export control specifics: restrict ITAR-tainted projects by ACL so only appropriately authorized persons (US persons, or persons covered by an applicable license/exemption) can display them; provisioning workflow must capture the person-status attestation; BI and AI layers must inherit the same restriction (a CDS DCL or row-level security predicate on project), because the most common leak path is an analytics extract, not the ERP screen.

## Analytics and Reporting

| Report | To whom | Cadence | SAP source |
|---|---|---|---|
| IPMDAR (contract performance dataset, schedule performance dataset, performance narrative); legacy IPMR Formats 1-7 (DID DI-MGMT-81861 family) | PCO/program office, DCMA, via EVM-CR | Monthly per CDRL | Dassian EVM engine over PS/ACDOCA period snapshot; IMS export from P6 |
| Contract Funds Status Report (CFSR, DI-MGMT-81468) | PCO / program office | Quarterly (per CDRL) | ACDOCA actuals + COOI commitments + Dassian ETC time-phasing |
| NASA 533M / 533Q (where NASA is the customer) | NASA center financial office | Monthly / quarterly | Dassian 533 reporting over the same cost spine |
| Variance analysis reports (VARs) with root cause and corrective action | Program Controls Manager, PM; summarized to the customer in the IPMDAR narrative | Monthly, threshold-triggered per System Description | Dassian control-account variances; CJI3 drill support |
| MR / UB log and budget trace | PM, Director of PP&C; DCMA on request | Monthly | Dassian/Z change log tied to BPGE/BPJA |
| Quarterly EAC package and annual comprehensive EAC bridge | PM, Director of PP&C, CFO organization, Group Reporting | Quarterly + annual | Dassian EAC versions; bridges to ACDOCA and to revenue recognition |
| Program review deck (cost, schedule, risk, staffing) | VP Programs / executive program reviews | Monthly | BI (Power BI/Tableau or embedded analytics) over governed CDS views/snapshots |
| Portfolio and IRAD status | CFO / CTO portfolio boards | Quarterly | SAP PPM portfolio items + PS rollups |

Embedded analytics versus warehouse guidance: use S/4 embedded analytics (CDS-based queries, Fiori overview pages) for operational, current-period questions (open commitments, actuals this month, status lists). Use snapshot-based reporting (Dassian period snapshots, or a warehouse/lakehouse layer fed by governed extracts) for anything government-facing or trend-based, because the IPMDAR you delivered must be reproducible months later during surveillance; live views drift as repostings land. Never let a program review deck be built from a live query that cannot be reproduced.

KPIs the client roles are measured on: CAMs on CPI and SPI (cumulative and current period) for their accounts, VAR quality and cycle time, ETC realism (bottoms-up ETC versus statistical IEAC comparisons); master schedulers on DCMA 14-point metric health, baseline execution index (BEI), and critical path stability; Program Controls Managers on on-time certified deliverables, zero unexplained retroactive changes, MR burn versus percent complete; the Director of PP&C on DECM metric status, CAR count and closure aging, and EAC accuracy (comprehensive EAC versus final cost on completed programs).

## Role of AI

Concrete use cases in this stream, all on S/4 + Dassian data:

1. **VAR narrative drafting.** Generate first-draft root-cause narratives from control-account variance data (Dassian EV results, CJI3 line items, P6 slip data), pre-classified by variance driver (rate, usage, schedule, scope). The CAM edits and certifies; the draft cites the exact records used.
2. **EAC realism screening.** Compare each CAM's bottoms-up ETC to statistical IEACs (CPI-based, CPI×SPI-based) and flag accounts where the gap exceeds threshold, with a written rationale request routed to the CAM. Humans decide; AI ranks.
3. **Schedule health assistant.** Pre-check P6 exports against DCMA 14-point style metrics and summarize which breaches matter for this program's critical path before the scheduler's formal run.
4. **IPMDAR pre-submission QA.** Machine-check tie-points (BCWS/BCWP/ACWP consistency across dataset sections, budget log to control account sums, ACWP to ACDOCA) and produce an exception list before certification.
5. **Rolling wave conversion support.** Draft work package detail (activities, resource spread, EV method suggestion) from the BOE library when a planning package enters the planning horizon, for CAM review.
6. **BCR impact tracing.** Given a proposed baseline change, enumerate affected work packages, IMS activities, MR/UB movements, and freeze-period conflicts before the change board meets.
7. **Risk-adjusted EAC summarization.** Turn risk register entries and schedule risk analysis outputs into a written MR adequacy assessment (MR remaining versus risk exposure remaining).
8. **Natural language query over control accounts** for CAMs and PMs, restricted by the same ACLs as the transactional system.

Compliance boundary: a human must certify every EV claim (the CAM), every VAR (the CAM and Program Controls Manager), every EAC (the PM, with finance concurrence where it drives revenue recognition), and every government deliverable (the PM or designated certifier). This is not preference: submissions to the government carry False Claims Act and false statements exposure, the EVMS System Description names accountable owners by role, and DCMA CAM interviews test whether the CAM actually understands and owns the numbers. AI that writes a narrative the CAM cannot defend in an interview is a compliance liability, so the workflow must force CAM review, not just capture a click.

Grounding and auditability rules for AI output feeding government deliverables: every generated statement must be traceable to identified source records (table, key, snapshot period); generation must run against the same period snapshot the deliverable is built from, never live data; prompts, retrieved context, model/version, and outputs are logged immutably and retained with the deliverable's evidence package; no synthetic or extrapolated numbers may appear in any quantitative field (AI drafts words, never invents figures); AI access inherits the export-control and CUI ACLs of the underlying data; and the System Description or a companion procedure must document where AI assists so surveillance does not discover it by surprise.

## Operating Model

Organization: almost always a matrixed model. A central PP&C organization (under the Director of Program Planning & Controls) owns standards, the EVMS System Description, tools, training, and surveillance readiness; program controls managers, analysts, and schedulers are deployed to programs and take daily direction from PMs while remaining accountable to PP&C standards. Variants: fully program-embedded (strong programs, weak center; risks System Description drift and inconsistent practice, common at fast-growing mid-tiers) versus shared-services PP&C (strong center pooling analysts across programs; efficient but CAM support suffers if analysts do not know the program). Best practice at scale is the strong-center matrix with a formal EVMS governance board. CAMs are never PP&C staff: they are the engineering/manufacturing/supply chain leads who own the work, which is exactly why the RAM and CAM training are PP&C's problem.

Calendar, tied to close, EAC, ICS, and audit cycles:

| Cadence | What this team does |
|---|---|
| Monthly | Accounting close lands ACWP in ACDOCA; PP&C runs the EV close on the Dassian snapshot (typically 3 to 5 working days after accounting close); CAMs claim EV and update status; tie-out of BCWS/BCWP/ACWP; VARs on threshold breaches; MR/UB log update; IPMDAR/533 production, certification, and submission per CDRL (IPMDAR requires delivery of all reporting components to the EVM-CR no later than 16 business days after the contractor's accounting period end per DI-MGMT-81861C; the legacy IPMR timeline was 12 working days, extendable to 17 for the Format 5 narrative with CO approval); internal program reviews; DECM self-check |
| Quarterly | EAC/ETC update cycle (CAM bottoms-up ETCs, PM challenge sessions, finance concurrence, feed to revenue recognition and Group Reporting); CFSR preparation and submission; portfolio reviews; internal EVMS surveillance sample (mock CAM interviews, data traces) |
| Annually | Comprehensive EAC (full bottoms-up re-plan of remaining work, all accounts, risk-adjusted with MR adequacy review); EVMS self-assessment and System Description refresh; support to the incurred cost submission (finance owns the ICS, due six months after fiscal year end, but PP&C supplies program cost reconciliations); support to forward pricing rate proposal assumptions; rolling wave planning conference for the next horizon; DCMA surveillance plan negotiation |
| Event-driven | IBR within roughly 180 days of a new award; BCRs and freeze-period exception boards; OTB/OTS formal reprogramming when the baseline is no longer executable; CAR responses and corrective action plans; compliance review preparation when crossing the $100M validation threshold or after major findings |

Government counterparts: the PCO (procuring contracting officer) owns the contract and receives the deliverables; the ACO (administrative contracting officer, usually DCMA) administers it; the DCMA EVMS Center and its EVMS specialists run surveillance and compliance reviews; DCMA industrial specialists and the program support team sit onsite at larger primes; DCAA auditors interface through finance but pull this stream into CAS consistency and EAC support questions. Know which DCMA CAR level triggers what before you need to.

## How a Consultant Engages This Function

Workshop casting: design workshops fail without the Director of PP&C (standards and System Description authority), a working CAM or two (reality check on data entry burden), the master scheduler (cost-schedule seam), the EVMS compliance lead (guideline traceability), and the R2R controller (ACWP/rates reconciliation contract). Cast the Dassian/SAP architect as a participant, not the chair. For WBS/coding mask workshops add the proposal/estimating lead, because CAS 401 consistency starts in the BOE. PMs attend decision checkpoints, not working sessions.

Decision-to-signoff ladder:

| Decision | Required sign-off |
|---|---|
| WBS standards, coding mask, control account sizing policy | Director of PP&C + finance controller |
| EV methods catalog and variance thresholds | Director of PP&C (must match or update the EVMS System Description) |
| Cost-schedule integration design (P6 to Dassian mapping level) | Director of PP&C + master scheduler lead |
| Reconciliation contract (ACWP timing, rate application, tie-out procedure) | Finance controller + Director of PP&C, jointly |
| Migration approach for in-flight programs (baseline preservation) | Director of PP&C + PM of each affected program; DCMA informed |
| Anything changing the System Description | Director of PP&C, with a DCMA notification plan |

Common failure modes of implementations in this stream:

- Rebuilding the IMS inside SAP, or mapping P6 at the wrong grain (activity-to-WBS instead of activity-to-work-package), so EV and schedule never reconcile.
- WBS designed by finance for settlement convenience, ignoring the OBS/RAM, producing control accounts no CAM can own.
- Too many control accounts (span of control fiction: hundreds of accounts per CAM equivalent), which DCMA reads as a paper EVMS.
- Configuring Dassian/PS in ways the EVMS System Description does not describe; the gap surfaces as CARs, not as go-live defects.
- Migrating an in-flight program without preserving the budget trace and period history, then failing the first post-cutover data trace.
- Leaving ETC in spreadsheets "temporarily," which becomes permanent and unauditable.
- Ignoring material earned value: material BCWP needs a defined method tied to production receipts/issues and MMAS pegging data, or the largest cost element on hardware programs is unmeasured.
- Opening charging before work authorization workflow exists, then trying to retrofit discipline onto live charge codes.
- Treating freeze-period enforcement as a training topic instead of a system control (it must be blocked, not discouraged).

What world class looks like: one WBS mastered in PS serving EVMS, cost collection, and revenue recognition simultaneously; touchless monthly flow from P6 status and CAM claims through the Dassian snapshot to a certified IPMDAR with zero manual reconciliation; ACWP tie-out that is a report, not a project; VAR cycle inside five working days with narratives CAMs can defend in interviews; EAC produced quarterly from system-resident ETCs with a documented risk adjustment and MR adequacy statement; DECM metrics green and CAR-free surveillance; and new awards standing up their baseline (WBS, RAM, WADs, BCWS) within the IBR window without heroics. When a consultant sees that, the correct move is to protect it; when they see less, the ladder above tells them which decision to fix first and who must sign it.
