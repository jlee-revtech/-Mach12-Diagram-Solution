---
stream: analytics-reporting
---

# Analytics and Reporting for GovCon SAP: The Eight-Dimension Operating Profile

Analytics and Reporting is the platform value stream at a GovCon aerospace and defense company running SAP S/4HANA. Its remit is singular: one reporting architecture that serves every other value stream's owed reports, in three categories at once: government deliverables (IPMDAR, CFSR, NASA 533, incurred cost schedules, eSRS, GFP inventory), auditor support (DCAA and DCMA extracts that tie to the ledger), and management reporting (program reviews, EAC waterfalls, backlog, rates). This team does not own the numbers; the streams do. It owns the pipes, the definitions, the reconciliation discipline, and the proof that every externally submitted figure came from ACDOCA and can be reproduced on demand. A deep companion bundle (sap-ad-program-analytics) covers the report catalog and technical stack in depth; this profile goes deep on People, Operating Model, governance, and how the platform serves the ten value streams.

## People

| Title | What they own | What they sign off | Day-to-day pains |
|---|---|---|---|
| VP or Director of FP&A | Management reporting calendar, consolidated EAC roll-up, backlog reporting for SEC disclosure, flash reporting | Backlog figures released to Investor Relations, quarterly EAC consolidation, management report definitions | Program EACs arrive late and in Excel; three definitions of "funded backlog" circulating; close-plus-5 deadline vs data quality |
| Director of Program Planning and Control (PP&C / EVMS) | EVMS reporting compliance, IPMDAR production, IBR readiness, EVM data quality across programs | IPMDAR datasets before submission to the EVM Central Repository, baseline change reporting | DCMA compliance metric flags on EVM data; reconciling the EVM engine (often Deltek Cobra) to ACDOCA actuals every month |
| EVMS / program analysts | Program-level CPI/SPI analysis, variance analysis reports, program review pack content, control account data hygiene | Nothing externally; they prepare, CAMs and the PP&C director certify | Chasing CAM narratives at close; manual re-keying between the schedule tool, the EVM engine, and SAP |
| BI / data engineering lead (analytics platform owner) | Analytical CDS view library, SAC content, Datasphere models, extract jobs, report catalog, snapshot infrastructure | Technical release of new reports to production, retirement of shadow data marts | Every stream wants a custom report yesterday; legacy BW content nobody will let die; Excel exports of exports |
| Compliance reporting owner (Government Accounting / Compliance Director) | Incurred Cost Submission (ICS/ICE schedules), provisional billing rate monitoring, CAS Disclosure Statement consistency in reporting | ICE model before submission to DCAA, rate variance alerts escalated to the CFO | Proving Schedule H ties to the ledger contract by contract; audit requests landing mid-close |
| Data governance lead | Definitions catalog (what counts as backlog, funded, EAC, at-completion), hierarchy stewardship, master data reporting standards | Definition changes, hierarchy changes that alter report roll-ups | Streams silently redefining metrics in local spreadsheets; hierarchy changes breaking prior-period comparability |
| Controller / Assistant Controller | The ledger itself, close calendar, tie-out of all external reporting to ACDOCA | Ledger tie-out certification for every externally submitted number | Reconciling items between subledgers and reports; being the last signature before anything leaves the building |
| SAP analytics architect (IT) | CDS development standards, transport discipline for analytical objects, Fiori analytical app catalog, SAC/Datasphere connectivity | Custom CDS view designs, access control (DCL) on analytical views | Business builds ungoverned SAC stories against raw views; performance of analytical queries on large ACDOCA volumes |
| Small Business Liaison Officer (SBLO) | Subcontracting plan performance data, eSRS ISR/SSR submissions | ISR and SSR figures in eSRS | Pulling subcontract award data from purchasing that was never coded for size status reporting |

Typical reporting lines: FP&A and the compliance reporting owner report to the CFO (compliance often through the Controller). PP&C reports either to the COO/programs organization or to the CFO; where it sits changes who arbitrates EVM vs finance disputes. The BI/data engineering team reports to the CIO in most companies, to the CFO in the best-run ones, because the report backlog is a finance problem, not an IT problem. The data governance lead is most effective reporting to the CFO with a dotted line to the CIO.

Who a consultant must have in the room: report catalog and stack decisions need the BI lead, SAP analytics architect, and FP&A director. Definition decisions (backlog, EAC, funded) need FP&A, the Controller, and data governance, with PP&C if the definition touches EVM. Anything touching a government deliverable format needs the compliance reporting owner or PP&C director, never IT alone. Auditor access design needs the Controller and compliance owner plus security. Decisions made without the Controller in the room get relitigated at tie-out.

## Process

End-to-end processes this stream runs:

1. **Close-to-report production.** Financial close completes in FI/CO; the platform team then executes the reporting calendar: snapshot the period (versioned, immutable), refresh analytical models, produce the flash pack, then program review packs, then government deliverables in CDRL date order. Everything downstream keys off "close plus N working days."
2. **Government deliverable production and submission.** For each owed report: pull from the governed source, transform to the mandated format (IPMDAR JSON/dataset formats, ICE Excel schedules, NF 533 layout), reconcile to ACDOCA, route for certification, submit through the relevant portal, archive the exact submitted file plus its reconciliation.
3. **Definitions and change governance.** A standing definitions board (data governance lead chairing, FP&A/Controller/PP&C members) approves any change to metric definitions, hierarchies, or report logic, with effective-dating so prior periods remain reproducible.
4. **Demand management (new report intake).** Every stream's report request goes through one intake: is it already in the catalog, can embedded analytics answer it, does it need SAC or Datasphere, or is it a one-off extract. Without this gate the team becomes a report factory.
5. **Audit and data-call support.** Standing extract service for DCAA/DCMA requests: reproducible queries, versioned outputs, a log of what was provided to whom and when.

GovCon overlay this stream owns or feeds:

| Requirement | Instrument | What this stream does |
|---|---|---|
| Incurred Cost Submission, due six months after fiscal year end | FAR 52.216-7 (Allowable Cost and Payment) | Produces the ICE model schedules (A through O); Schedule H (direct costs by contract) and Schedule I (cumulative claimed vs billed) must tie to ACDOCA by contract |
| EVMS reporting on covered contracts | DFARS 252.234-7002; EIA-748 (32 guidelines); EVMS required at roughly $20M and a DCMA-validated system at roughly $50M for cost or incentive contracts (DFARS 234.201); FFP contracts are generally excluded | Produces IPMDAR datasets (DI-MGMT-81861 series, successor to the IPMR); feeds DCMA's automated EVMS compliance metrics testing |
| Contract funds status | CFSR, DID DI-MGMT-81468 | Formats funding, expenditure, and forecast data from PS/Dassian into the CFSR layout per contract CDRL |
| NASA contractor financial management reporting | NASA Form 533M (monthly) and 533Q (quarterly) under the NASA FAR Supplement | Produces NF 533 cost reports from project actuals and forecasts |
| Small business subcontracting reporting | FAR 52.219-9; eSRS | Supplies subcontract award data for semiannual ISRs and the annual SSR |
| Government property reporting | FAR 52.245-1 (property management, records, physical inventory); DFARS 252.211-7007 (GFP reporting into the IUID Registry via the PIEE GFP module) | Produces GFP inventory and reconciliation reports from the property records |
| MMAS | DFARS 252.242-7004 (ten standards) | Produces MMAS metrics packs (e.g., inventory accuracy, delivery performance) that support the DCAA MMAS audit and the ACO's system adequacy determination |
| Accounting system adequacy | DFARS 252.242-7006 (eighteen criteria); business systems clause DFARS 252.242-7005 with payment withholds for significant deficiencies | The reporting layer is evidence: criteria on reliable data, billings reconciling to cost accounts, and interim cost reporting are demonstrated through this stream's outputs |
| Cost accounting consistency | CAS 401 (consistency in estimating, accumulating, reporting), CAS 405 (unallowable costs excluded from claims), CAS 406 (cost accounting period), CAS 410/418 (allocation) | Reports must present costs consistently with the Disclosure Statement; unallowables visibly segregated in ICS schedules |

Control points: (a) no external submission without ledger tie-out signed by the Controller's organization; (b) no submission without a versioned snapshot of source data; (c) certification by the accountable owner (PP&C for IPMDAR, compliance owner for ICE, SBLO for eSRS); (d) definitions frozen during production of a deliverable.

What DCAA/DCMA walk through when they audit: DCAA incurred cost auditors trace ICE Schedule H lines to ACDOCA postings and to billings (they will ask you to run the query in front of them); they test that unallowable costs are excluded and that indirect rates recompute from the pools and bases in the ledger. DCMA EVMS reviews test the 32 guidelines, run automated metrics against your IPMDAR submissions, and trace a sample of control accounts from the schedule through the EVM engine to SAP actuals; a broken EVM-to-ACDOCA reconciliation is the single most common finding. Both agencies test data reproducibility: can you regenerate the exact submitted number today.

## Technology and Systems

SAP stack (the decision ladder, in order):

1. **S/4HANA Embedded Analytics first.** Analytical CDS views (interface views plus consumption views annotated as analytical queries) over ACDOCA, PRPS, and the Dassian objects; consumed via Fiori analytical apps, the Query Browser, Custom Analytical Queries, Analytical List Pages, and KPI tiles. Real-time, no data movement, no reconciliation burden. Default answer for operational and single-system reporting.
2. **SAP Analytics Cloud (SAC)** for planning, dashboards, and executive storyboards: live connection to embedded CDS queries where possible, import models only where planning requires them.
3. **Datasphere (or an existing BW/4HANA)** only when the question is genuinely cross-source: SAP plus the EVM engine, the schedule tool, HR, or CRM pipeline data. This is the cross-source layer, not the default landing zone.
4. **Formatted extracts** for government deliverable formats that mandate a file layout (IPMDAR datasets, ICE Excel, NF 533, CFSR): generated from governed views, never hand-built.

Dassian add-ons: **GPD / PACE reporting** provides the GovCon-native program cost reporting layer over the /DSN/ data model: period snapshots, EVM-format outputs (CPR/IPMR/IPMDAR-shaped data, NASA 533, CFSR support), and program cost structures aligned to CLIN/WBS/control account. Where Dassian PPC holds the time-phased plan and RAENH drives revenue recognition, GPD/PACE is the reporting face the platform team integrates into the CDS/SAC stack rather than rebuilding.

Surrounding non-SAP systems typically found at a GovCon company, with keep/retire/integrate guidance:

| System (real products) | Role | Guidance |
|---|---|---|
| Deltek Cobra, forProject | EVM cost processor | Keep if DCMA-validated system description names it; integrate monthly actuals from ACDOCA and never let it become the cost ledger of record |
| Encore Analytics Empower | EVM analytics and DCMA-metric self-testing | Keep; feed it IPMDAR datasets, use it to pre-test submissions |
| Oracle Primavera P6, Microsoft Project | Scheduling (IMS) | Keep; integrate schedule status to the EVM engine and milestone data to the review packs |
| Power BI, Tableau | Departmental BI | Contain: point them at governed views or Datasphere, never at extracts of extracts; retire duplicative content into the catalog |
| Snowflake or Databricks | Enterprise data platform | Integrate as the cross-source layer only if it predates you and is governed; otherwise Datasphere covers the need |
| OneStream, Oracle Hyperion/HFM | Consolidation and close | Keep; ACDOCA feeds it; backlog and EAC disclosures reconcile through it |
| Workiva | SEC reporting | Keep; backlog numbers flow to it under the FP&A director's sign-off |
| ProPricer | Estimating/pricing | Integrate rate data one way (from the governed rate source outward) |
| Legacy BW 7.x | Old warehouse | Retire deliberately: migrate the few load-bearing queries to CDS/Datasphere, sunset the rest with usage statistics as evidence |

Government portals at the boundary: **PIEE** (invoicing via WAWF, the GFP module and IUID Registry, Electronic Data Access for contract docs), the **EVM Central Repository (EVM-CR)** for IPMDAR submissions, **eSRS** for subcontract reports, **SAM.gov** for entity data. ICE submissions go to DCAA through the assigned auditor. None of these accept system-to-system feeds from your stack in a way you should depend on; treat them as manual-upload boundaries with archived payloads.

Per-topic gotchas:

- Analytical CDS on large ACDOCA volumes needs deliberate design (aggregation levels, association pruning); a naive consumption view that joins everything will time out in the Query Browser and discredit the embedded-first ladder.
- SAC live connections preserve S/4 authorizations; SAC import models do not, so an import model of program cost data silently bypasses DCL restrictions unless SAC-side security is rebuilt.
- Datasphere replication jobs become the new shadow marts if each analyst can spin up private spaces; govern space creation like transport access.
- The EVM engine's period calendar and SAP fiscal periods drift (445 calendars, close timing); pin the reconciliation to an agreed cut and document it in the EVMS system description.

## Data

Single source of truth discipline is the core of this dimension. ACDOCA, the S/4HANA Universal Journal, is the financial spine: every cost, hour-driven dollar, and revenue figure in any report must trace to it (or to ACDOCP for plan). The platform team wages a permanent war on shadow Excel data marts: any spreadsheet that accumulates data, applies logic, and feeds a decision or a deliverable is a defect to be replaced by a governed view. Definitions governance is the other half: "backlog" (total vs funded vs unfunded, and its tie to ASC 606 remaining performance obligations), "funded" (contract funding per Dassian/PS funding objects, not sales order value), and "EAC" (which version, whose sign-off) each have exactly one definition in the catalog, effective-dated.

| Data object | Main SAP tables | Owner (from People) |
|---|---|---|
| Universal Journal actuals | ACDOCA (BKPF headers) | Controller |
| Plan/forecast data | ACDOCP; Dassian PPC plan tables in /DSN/ namespace | FP&A director (values), PP&C (time-phased EVM plan) |
| Project/WBS structures | PROJ, PRPS | Owned by the Program Execution stream; governed for reporting by data governance lead |
| Cost centers, activity types, GL accounts | CSKS, CSLA, SKA1/SKAT | Controller (GL), FP&A (cost center hierarchy content) |
| Profit centers | CEPC | Controller |
| Hierarchies and sets for roll-ups | SETNODE/SETLEAF (classic sets), S/4 global hierarchies | Data governance lead |
| Labor time records (CATS) | CATSDB (PS/PM/PP confirmations persist in AFRU; posted cost lines land in ACDOCA) | Time stream; consumed here for hours reporting |
| Material movements / inventory | MATDOC; material ledger CKMLCR | Materials stream; consumed for MMAS metrics and GFP |
| Period snapshots | Custom Z snapshot tables plus Dassian REPSNAP-style period snapshots | BI/data engineering lead |
| Report and metric definitions | Definitions catalog (tooling varies) | Data governance lead |

Migration objects and load sequencing for this stream (it mostly consumes, but must migrate its own history): (1) after finance and PS master data are loaded by their streams, load hierarchies, sets, and mapping tables; (2) load rate history (provisional and actual indirect rates by year) because rates dashboards and ICS support need it; (3) load prior-period snapshots and EVM baselines (historical BCWS/BCWP/ACWP by control account) so trend reporting does not start blind; (4) rebuild or migrate report definitions and SAC models; (5) run parallel reconciliation (legacy report vs new stack, same period) before any legacy report is retired. Never migrate legacy report logic sight unseen; migrate the requirement, not the SQL.

CUI and export control: IPMDAR datasets are designated CUI by their DID; other contract cost data (CFSR, contract-identifiable cost detail) is CUI when so marked or when it meets the covered defense information definition under DFARS 252.204-7012, protected per NIST SP 800-171, and the conservative default is to treat contract-identifiable defense cost data as in scope; the analytics stack that stores or renders it falls under those controls. Program-identifiable data on ITAR programs (22 CFR ITAR) can itself be export controlled by association even when purely financial, so program-restricted analytical access is a requirement, not a nicety. Consolidated backlog before public release is material nonpublic information under SEC rules: access-restrict it like CUI even though it is not.

## Security and Authorizations

PFCG role shapes for this stream:

- **Stream display roles** (one per value stream): display-only analytical access scoped by company code, profit center, and project via CDS access control (DCL), plus the relevant Fiori analytical catalog. No table browsing (S_TABU_DIS tightly restricted).
- **Analytics power user**: adds Query Browser and Custom Analytical Queries authoring, still display-only on data, restricted to a sandbox space in SAC.
- **BI developer**: CDS/SAC/Datasphere development in dev only; transported to production by a separate release role. No production data changes ever.
- **Compliance reporting role**: adds the extract execution and snapshot creation authorizations; held by the small production team.
- **Auditor role**: time-boxed, display-only, logged; see below.

| Toxic pair (SoD) | Risk | Mitigation |
|---|---|---|
| Develop report logic + release to production | Undetected logic manipulation of externally submitted figures | Separate transport release role; peer review of CDS changes touching deliverable feeds |
| Create/modify snapshot + submit deliverable | Rewriting history after certification | Snapshots write-once by authorization; submission role cannot author snapshots |
| Maintain hierarchies/definitions + produce management reports | Silent metric redefinition to hit targets | Definitions board approval workflow; hierarchy changes logged and effective-dated |
| Post journal entries + certify tie-out | Self-certification of one's own postings | Tie-out certifier in Controller org has no posting access to the entities certified |
| SAC model admin + SAC data connection admin | Uncontrolled data paths into planning models | Split model content ownership from connectivity; connections owned by IT architect |
| Broad ACDOCA display + no program restriction | Export-control and CUI exposure via analytics | DCL-based program/project restriction as the default; unrestricted display is an exception with justification |

Auditor access design: DCAA and DCMA generally work from provided extracts, not system logons; when direct access is granted (increasingly requested), it is a dedicated display-only role, restricted to the contracts and periods under audit, time-boxed to the audit, with usage logging retained. Best practice is an "audit workspace": a folder of versioned, reproducible extracts with the query definitions included, so every data call is answerable without ad hoc pulls. Never give auditors roles cloned from employees.

Export-control specifics: ITAR program data is restricted to authorized persons (US persons unless licensed); analytical roles and SAC stories for those programs carry program-level DCL restrictions, and cross-program roll-ups shown to non-cleared audiences must aggregate above program identifiability. Datasphere/warehouse replication of restricted program data requires the same controls at the target, which is a common gap: the ERP is locked down and the warehouse is wide open.

## Analytics and Reporting

The fleet's owed-report catalog at a glance (this platform team produces or industrializes all of these on behalf of the owning streams):

| Report | To whom | Cadence | SAP source |
|---|---|---|---|
| IPMDAR (performance, schedule, cost datasets) | DoD customer via EVM-CR | Monthly per CDRL | ACDOCA actuals + Dassian PPC plan/EV data via GPD/PACE, merged with EVM engine output |
| CFSR (DI-MGMT-81468) | Customer PCO/buying office | Quarterly (typical, per CDRL) | Dassian funding objects, PS commitments/actuals (ACDOCA, COOI-type commitments) |
| NASA 533M / 533Q | NASA center | Monthly / quarterly | ACDOCA + ACDOCP by project, NF 533 format extract |
| ICS/ICE schedules | DCAA | Annually, six months after FYE | ACDOCA by contract; pools and bases from CO allocations |
| eSRS ISR / SSR | eSRS (contracting officer review) | Semiannual / annual | Purchasing data (EKKO/EKPO lineage) with size-status enrichment |
| GFP inventory reports | PIEE GFP module / property administrator | Annual and event-driven | Property records reconciled to plant/inventory data (MATDOC) |
| MMAS metrics pack | DCAA (audit) / DCMA ACO (system determination) | Monthly/quarterly internal, on demand for reviews | Inventory accuracy, MRP performance data from materials tables |
| Backlog and remaining performance obligations | SEC via 10-Q/10-K (through Workiva), Investor Relations | Quarterly | Dassian contract/funding data + RAENH revenue recognition, reconciled to ACDOCA |
| Program review pack (CPI/SPI trends, EAC waterfall, risk burndown, milestone status) | Program managers, executives | Monthly | Embedded CDS over ACDOCA/PRPS + Dassian GPD/PACE + schedule tool milestones |
| Rates monitoring dashboard (actual vs provisional indirect rates) | CFO, compliance owner, pricing | Monthly | CO pools and bases from ACDOCA, rate master data |

Embedded vs warehouse guidance: if the report is single-system, current-period or trailing-trend, and consumed by operators, it belongs in embedded analytics (analytical CDS + Fiori). If it requires planning write-back or executive dashboard packaging, SAC on live CDS connections. If it joins non-SAP sources or needs heavy history beyond what snapshots hold, Datasphere/BW. Custom CDS is warranted when standard VDM views cannot express a GovCon object (control-account-level EV joins, funding vs cost positions, POB-level margin); it is not warranted to replicate a spreadsheet's formatting. Every custom analytical view goes in the catalog with an owner and a definition link.

Reconciliation discipline: every externally submitted number ties to ACDOCA and is reproducible. Mechanically: versioned snapshot at production time, a stored reconciliation (report total vs ledger total, differences explained line by line), and the submitted artifact archived byte-for-byte. Program review packs follow a fixed monthly rhythm: data cut at close+N, analyst narrative, CAM/PM review, executive session; the pack's numbers are the same numbers in the IPMDAR, or the variance is explained on page one.

Rates monitoring is the early-warning system: actual indirect rates computed monthly from ACDOCA pools and bases, tracked against provisional billing rates. A sustained gap triggers provisional rate revision requests to DCAA/DCMA before it becomes a year-end billing true-up shock or an ICS finding.

KPIs the client roles are measured on: FP&A director: close-plus-N days to flash, EAC forecast accuracy, zero backlog restatements. PP&C director: on-time IPMDAR rate, DCMA metric flag count, EVM-to-ledger reconciliation breaks. BI lead: catalog coverage of owed reports, report request cycle time, shadow marts retired per quarter, self-service adoption. Compliance owner: ICS on-time and audit findings, rate variance detected-to-actioned lag. Data governance lead: definition disputes escalated, hierarchy change defects.

## Role of AI

Concrete use cases in this stream:

1. **Natural-language query over governed views**: "hours charged to program X overhead pool last quarter" answered from the catalog's CDS views, with the generated query visible. Kills a large share of ad hoc extract requests.
2. **Anomaly detection on charging patterns**: labor and cost postings screened for unusual charge combinations (person/project/pool shifts, end-of-period migrations between contracts), surfacing leads for the compliance owner before DCAA finds them.
3. **Draft variance narratives**: first-draft CAM variance analysis text generated from CPI/SPI/VAC data and prior narratives, edited and owned by the analyst and CAM.
4. **EAC reasonableness screening**: flag EACs inconsistent with performance-index-based ranges or with historical estimate drift, prioritizing FP&A challenge sessions.
5. **Deliverable pre-submission checks**: automated tie-out verification and DCMA-style metric pre-tests on IPMDAR datasets before upload.
6. **Report catalog deduplication**: cluster semantically duplicate reports and shadow marts as retirement candidates with usage evidence.
7. **Audit data-call triage**: map an incoming DCAA request to existing reproducible extracts and draft the response package for the compliance owner.

Compliance boundary: a human with accountable authority certifies anything submitted to the government or released externally. The PP&C director certifies IPMDAR, the compliance owner certifies the ICE model, the SBLO certifies eSRS, the FP&A director releases backlog. This is not ceremony: certifications carry False Claims Act and business-system consequences, and "the model produced it" is not a defense. AI drafts, screens, and reconciles; it never certifies, and it never submits.

Grounding and auditability rules for AI output feeding government deliverables: (a) AI reads only from governed, versioned sources (the same snapshots humans use), never from uncontrolled spreadsheets; (b) every AI-produced figure carries lineage to the source query and snapshot version; (c) generated narratives are stored with their prompts and source data so the review trail is reconstructible; (d) anomaly-detection outputs are leads, not conclusions, and are documented as such to avoid creating unreviewed "known issue" records that discovery could surface; (e) no CUI or export-controlled program data leaves the controlled boundary to reach a model that is not authorized for it.

## Operating Model

Organization: two viable shapes. **Hub-and-spoke** (most common at scale): a central analytics platform team (BI/data engineering, SAP analytics architect, data governance) as a shared service, with program-aligned analysts (EVMS/PP&C, program finance) embedded in the business units as the spokes; the hub owns the stack, catalog, and standards, the spokes own content and narrative. **Fully federated** (each BU runs its own stack) reliably produces definitional chaos and duplicate spend; accept it only as a starting point to consolidate. The tie-breaker rule: deliverable formats, definitions, and the reconciliation regime are always central, regardless of where analysts sit. Headcount shape at a mid-size prime: 6 to 12 in the hub, 1 to 3 analysts per major program in the spokes.

Calendar (the close-plus-N reporting calendar, with N in working days after period close):

- **Monthly**: close completes (N=3 to 5 typical); flash pack at close+1 after that; period snapshot cut; program review packs by close+5 to 8; monthly program reviews in the following week; IPMDAR production and submission per each contract's CDRL due date; rates dashboard refresh and variance review; EVM engine to ACDOCA reconciliation signed.
- **Quarterly**: consolidated EAC cycle (program EACs, FP&A challenge, executive approval); backlog and remaining performance obligation roll-up for SEC reporting, reconciled through consolidation; CFSRs per CDRL; eSRS ISRs semiannually.
- **Annually**: ICS/ICE production culminating six months after fiscal year end (for a calendar-year contractor, the June deadline dominates the spring); provisional billing rates proposed for the new year; forward pricing rate proposal support when requested; eSRS SSR; GFP annual physical inventory and reporting (FAR 52.245-1, with IUID Registry reporting per DFARS 252.211-7007); audit season (DCAA incurred cost, DCMA business system reviews) with the extract service running hot; SAC/Datasphere content review and legacy report retirement wave.

Government counterparts: the **PCO** (procuring contracting officer) receives contract-level deliverables (CFSR, CDRL items) and owns the contract; the **ACO** (administrative contracting officer, usually DCMA) handles provisional billing rates, business system determinations, and final rate agreements; **DCMA specialists** include the EVMS compliance staff (who run the automated metrics and lead compliance reviews) and property administrators (GFP); **DCAA** runs incurred cost audits, provisional rate reviews, forward pricing audits, and MMAS audits (the ACO makes the MMAS system determination on DCAA's audit), and is the recipient of the ICE model. The platform team's relationship with the DCMA EVMS group and the DCAA audit team is continuous, not episodic; treat their standing data requests as products with SLAs.

Where it sits: best practice is under the CFO (often as "Finance Systems and Analytics" or within FP&A), with the SAP analytics architect dotted from IT. When it sits wholly in IT, deliverable accountability blurs and the streams rebuild shadow marts; when it sits in a single business unit, the other units defect from the standard.

## How a Consultant Engages This Function

Workshop casting: for the **report catalog and stack** workshops, cast the BI lead, SAP analytics architect, FP&A director, and one analyst per major stream (they know the real reports, including the hidden Excel ones); for **definitions governance**, cast FP&A, Controller, PP&C, data governance, and revenue accounting (backlog definitions die without them); for **government deliverable industrialization**, cast PP&C, the compliance owner, and the contracts organization (CDRL calendar); for **security and auditor access**, cast the Controller, compliance owner, and the security team. Never run a definitions workshop with IT only: you will get a data model and no agreement.

Which decisions need which sign-offs: stack selection (embedded vs SAC vs Datasphere) is signed by the BI lead and CFO-side sponsor; any definition of backlog/funded/EAC is signed by the CFO or Controller (SEC exposure); IPMDAR pipeline design is signed by the PP&C director (their certification depends on it); ICE schedule automation is signed by the compliance owner; auditor access model is signed by the Controller; retirement of any legacy report is signed by its consuming stream's owner, with usage data attached.

Common failure modes of implementations in this stream:

1. **Warehouse-first**: standing up Datasphere/BW and replicating everything before asking whether embedded analytics answers the question; you inherit a reconciliation burden on day one.
2. **Lift-and-shift of legacy BW/Excel logic**: migrating report SQL instead of report requirements, preserving decade-old definitional drift in a new tool.
3. **No definitions governance**: the stack ships, and three backlog numbers still circulate; the tooling was never the problem.
4. **Report factory dynamics**: no intake gate, so the platform team drowns in one-off requests and the streams go back to Excel.
5. **Ignoring the deliverable formats**: beautiful dashboards but IPMDAR/ICE/NF 533 still hand-built monthly from raw extracts, which is where the compliance risk actually lives.
6. **Snapshotless architecture**: real-time everything, so no submitted number can be reproduced three months later; fails the first DCAA reproducibility test.
7. **Security as an afterthought**: unrestricted analytical roles leaking program-identifiable ITAR/CUI data into SAC stories and warehouse copies.
8. **EVM engine treated as out of scope**: the Cobra-to-ACDOCA reconciliation left manual, which is the most audited joint in the whole architecture.

What "world class" looks like: one catalog covering every owed report with a named owner, source, and definition link; embedded analytics answering the majority of operational questions with zero data movement; every government deliverable produced from governed views with automated tie-out, versioned snapshots, and archived submissions; rates and charging anomalies surfaced monthly, not at audit; a definitions board that meets, decides, and effective-dates; DCAA data calls answered in days from the audit workspace; the monthly program review pack, the IPMDAR, and the ledger telling one story; and a measurable, celebrated count of shadow Excel marts retired each quarter. The platform team is judged by the streams it serves: when program managers, the Controller, and the compliance owner all pull from the same numbers without arguing about whose are right, this function is doing its job.
