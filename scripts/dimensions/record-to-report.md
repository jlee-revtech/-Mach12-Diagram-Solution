---
stream: record-to-report
---

# Record-to-Report in a US Government Contractor: The Eight-Dimension Operating Profile

Record-to-Report (R2R) at a GovCon aerospace and defense company is not "the accounting department." It is the function that owns the government-facing cost accounting system: the indirect rate structure, revenue recognition on contracts, the incurred cost submission, and the DFARS accounting business system. In an SAP S/4HANA world, its spine is the ACDOCA universal journal: every number that leaves the building (an invoice in WAWF, a claimed rate in the ICE model, a backlog figure in a 10-K) must tie back to ACDOCA line items, or the function has failed at its core job. This profile teaches how the function actually works, dimension by dimension.

## People

R2R at a defense OEM prime or a Tier-2 supplier is staffed by a small number of roles that a consultant must be able to name, cast into workshops, and never confuse with each other.

| Role | Owns | Signs off | Day-to-day pains |
|---|---|---|---|
| VP Finance / Corporate Controller | The close, the trial balance, external financials, SOX 302/404 sub-certifications | Chart of accounts design, accounting policy, RA/rev-rec methods (with external auditor), close calendar | Close takes too long; rev-rec judgment calls land on their desk at day 4; auditors and DCAA both want the same people in the same week |
| Assistant Controller | Close execution, journal entry review, account reconciliations, intercompany | Period open/close (OB52 discipline), recon sign-off, manual JE approvals | Manual journals with no support; late allocations that reopen periods; Blackline recons that nobody clears |
| Government Compliance Director | CAS Disclosure Statement, FAR 31.205 unallowable policy, ICS, business system adequacy, DCAA/DCMA relationship | Pool and base architecture, allocation methodology changes, ICS certification package, audit responses | Cost impact analyses for any accounting change; being pulled into every design decision too late; defending timekeeping findings they did not cause |
| Indirect Rates Analyst / Rates Manager | Pool build-up, provisional and forward rates, monthly rate monitoring, ICE model schedules | Monthly actual-rate calc, quarterly true-up recommendation, FPRP math | Rates live in spreadsheets next to SAP; base data pulled from three systems; every reorg breaks the pool-to-cost-center mapping |
| Cost Accounting Manager | Cost center hierarchy, allocation cycles, costing sheets, service center billing rates, CO-PC | Assessment/distribution cycle changes, activity rates (KP26), settlement strategy | Cycles that fail at 11 pm on workday 2; orphan cost centers after org changes; unallowables posted to allowable cost elements |
| Senior Project Accountant | Project cost integrity, settlement runs, RA execution, EAC-to-rev-rec bridge per program | RA results by program, ITD cost tie-outs, program-level flux explanations | Programs with stale EACs driving wrong POC revenue; charge corrections that arrive after RA has run; CAMs who do not understand settlement |
| Government Billing Specialist | Invoice generation, WAWF/PIEE submission, unbilled AR analysis, provisional-rate billing | Invoice packages, rate-variance catch-up bills, closeout invoices | WAWF rejections for CLIN/ACRN mismatches; unbilled that nobody can explain; final invoices blocked on rate settlement years later |
| External Reporting Manager (public companies) | 10-Q/10-K support, ASC 606 disclosures, remaining performance obligation (backlog) reporting | Backlog roll-forward, contract asset/liability presentation, flux narratives | Backlog reconciles to nothing without a system feed; RA output needs manual reshaping for disclosure |
| GL Accountant (shared services) | Journal processing, fixed assets (FI-AA), accruals, bank recs | Individual recons and JEs within delegated limits | Volume; unclear ownership of legacy-system balances after S/4 cutover |

Typical reporting lines: the Controller organization (Assistant Controller, Cost Accounting Manager, GL accountants, project accountants, billing) reports to the VP Finance/Controller, who reports to the CFO. The Government Compliance Director usually reports to the CFO directly, or occasionally to the General Counsel, and must sit outside the close chain so compliance opinions are independent of close pressure. The Rates Analyst sits either under the Controller or under Compliance; where they sit tells you who really owns the rate structure.

Who must be in the room: pool and base decisions require the Compliance Director, Rates Analyst, and Cost Accounting Manager together (never just one). RA/rev-rec method decisions require the Controller plus the external audit relationship owner. Billing format and WAWF configuration require the Billing Specialist plus someone who has actually keyed an invoice into PIEE. Chart of accounts and cost element design requires the Controller, Cost Accounting Manager, and Compliance Director, because unallowable segregation is baked in at that layer.

## Process

R2R in GovCon is five interlocking process loops plus a compliance overlay.

**Core loops.**
1. **Journal-to-close**: journal capture (FB50, interfaces, allocations), asset accounting (AFAB depreciation, AJAB year-end), accruals, intercompany, reconciliation, period close in a fixed workday calendar. Everything posts to ACDOCA; there is no separate CO ledger to reconcile in S/4HANA, which is precisely why GovCon controllers like it.
2. **Allocate-to-rate**: labor and expense hit cost centers; fringe is allocated to labor-bearing pools; site overhead pools allocate over direct labor bases; service centers bill out at established rates; G&A allocates over its chosen base. In SAP this is assessment/distribution cycles (KSU5/KSV5), activity allocation, and Dassian Cost Management costing sheets applying overhead to projects at transaction time. The cost center standard hierarchy is deliberately designed to mirror the pool structure: one node per pool, so a pool's cost is a cost center group total and the rate calc is a report, not a spreadsheet archaeology project.
3. **Settle-and-recognize**: month-end project settlement (CJ88/CJ8G), then Results Analysis computes percentage-of-completion revenue (cost-to-cost POC being the dominant method on cost-type and long-duration fixed-price work), posting revenue in excess of billings or billings in excess of revenue. Dassian RAENH extends classic RA with performance-obligation-level (POB) recognition aligned to ASC 606.
4. **Bill-and-collect interface**: RA and billing must reconcile. Revenue recognized minus amounts billed equals the contract asset/liability position; the unbilled AR analysis decomposes it into rate variance, billing lag, withholds, and milestones not yet met. Invoices flow to WAWF inside PIEE (cost vouchers on SF 1034 for cost-type work, progress payment requests on SF 1443 for fixed-price with progress payments).
5. **Consolidate-and-report**: SAP Group Reporting (ACDOCU) consolidates entities; external reporting produces ASC 606 disclosures including remaining performance obligations (the SEC backlog number), which must tie to the RA and contract data, not to a business-development pipeline spreadsheet.

**GovCon overlay this stream owns or feeds.**
- **FAR 52.216-7 (Allowable Cost and Payment)** drives interim billing at provisional rates and the annual incurred cost submission, due six months after fiscal year end (June 30 for a calendar-year contractor), prepared in DCAA's ICE model (Schedules A through O; Schedule H is direct cost by contract, Schedule I reconciles claimed to billed). The Certificate of Final Indirect Costs (FAR 52.242-4) is signed by an executive, which is why the numbers behind it must be system-derived.
- **FAR 31.201-6 and FAR 31.205** require accounting for unallowable costs so they never enter a billing rate: at a well-run contractor this means dedicated unallowable cost elements and, for departments that generate them routinely, dedicated unallowable cost centers, excluded from pool cost but (critically, per CAS 405) still included in allocation bases where they belong.
- **CAS**: CAS 401 consistency between estimating, accumulating, and reporting; CAS 402 consistency in allocating costs incurred for the same purpose (the same cost cannot be charged direct on one contract while remaining in an indirect pool allocated to others); CAS 403 home office expense allocation to segments (three-tier: direct allocation, homogeneous pools, then residual expenses allocated over a base representative of total activity, with the three-factor formula of payroll, revenue, and net book value mandatory only when residual expenses exceed the CAS 403-40(c)(2) revenue-based threshold, which they routinely do at large contractors, hence the shorthand); CAS 410 G&A allocation, which permits a total cost input, value-added (TCI less materials and subcontracts), or single-element base; the TCI-vs-value-added choice is one of the most consequential design decisions in the whole implementation because it shifts G&A burden between material-heavy and labor-heavy programs; CAS 405 unallowables; CAS 406 the cost accounting period; CAS 418 consistency in classifying costs as direct or indirect; CAS 420 IR&D and B&P treatment. All of these are documented in the CAS Disclosure Statement, and any change in cost accounting practice triggers advance notification to the cognizant ACO and a cost impact analysis. Consultants who redesign pools without budgeting Disclosure Statement lead time cause real damage.
- **DFARS 252.242-7006 (Accounting System Administration)** defines the 18 adequacy criteria for the accounting business system: proper segregation of direct from indirect, identification and accumulation of direct costs by contract, a logical and consistent indirect allocation method, a timekeeping system that identifies labor by cost objective, labor distribution, interim determination of costs (billings reconcile to books), exclusion of unallowables, and so on. R2R owns this system determination. Under DFARS 252.242-7005, a disapproved system exposes the contractor to payment withholds. Timekeeping and labor distribution, though executed in Hire-to-Retire, is this system's most audited input: labor is the cost you cannot re-verify from a vendor invoice.
- Rates feed the **estimating system (DFARS 252.215-7002)** through forward pricing rate proposals (FPRPs), and cost actuals feed **EVMS (DFARS 252.234-7002)**, both owned elsewhere but dependent on R2R data integrity.

**Control points**: journal approval workflow with support attached; period lock discipline (OB52); allocation cycle completeness check (zero residual on pool cost centers after assessment); monthly actual-vs-provisional rate monitor; RA-to-billing-to-GL three-way reconciliation; unbilled aging review; ICS tie-out of Schedule H to ACDOCA by contract.

**What DCAA and DCMA walk through.** DCAA performs the pre-award accounting system survey (SF 1408), incurred cost audits of the ICS, forward pricing rate audits, provisional billing rate reviews, paid voucher reviews, and real-time labor testing including floor checks (MAARs 6: unannounced interviews verifying people charge time daily to the right cost objective). DCMA administers: the ACO (or corporate/divisional ACO at large primes) negotiates final indirect rates and forward pricing rate agreements and issues business system determinations based on DCAA findings. When they walk the system, they trace: a timesheet to labor distribution to a cost center or WBS in ACDOCA, an indirect cost through the pool to the rate calc, the rate to the invoice in WAWF, and the invoice back to the ICS claim. Every one of those hops must be demonstrable in the system, not in Excel.

## Technology and Systems

**SAP core for this stream**: FI-GL on the ACDOCA universal journal (single source for FI and CO actuals); FI-AA for fixed assets; CO-CCA for cost centers, activity types, and allocation cycles; CO-PA (account-based, so it lives inside ACDOCA) for program and market-segment margin; CO-PC for product costing where manufacturing exists; PS settlement as the bridge from project cost collection into RA and CO-PA; SAP Group Reporting (ACDOCU) for consolidation.

**Dassian add-ons** (the A&D vertical layer on S/4HANA, /DSN/ and /VNO/ namespaces): Cost Management provides the GovCon rate machinery: overhead calculation, costing sheets that apply fringe/overhead/G&A to projects at posting time, and the Forward Rate (FR) engine holding provisional, forward pricing, and what-if rate sets by version. Results Analysis (RAENH) extends SAP RA for ASC 606 GovCon rev-rec: POC methods at performance obligation level with the audit trail external auditors expect. The decision ladder: use Dassian where standard SAP forces the rate structure into spreadsheets; use standard RA where a program's method is simple cost-to-cost with no POB splitting.

**Typical non-SAP landscape at a GovCon contractor, with keep/retire/integrate guidance**:

| System | Typical use | Guidance |
|---|---|---|
| Deltek Costpoint | Legacy ERP being replaced, or still running in acquired divisions | Retire per division; during coexistence, map its pools-and-projects data into SAP CO objects for consolidated rates (see Data) |
| Deltek Cobra / OPDEC | EVM cost processing | Keep short-term; integrate actuals from ACDOCA; long-term candidates for Dassian PPC-side replacement |
| Workday or ADP | HR/payroll | Keep; labor distribution interface into FI/CO is a top-3 integration and a top-1 audit topic |
| UKG/Kronos or SAP CATS | Timekeeping | Keep whichever satisfies DFARS 252.242-7006 criteria 9-10 (timekeeping by cost objective, labor distribution) as DCAA evaluates them in its timekeeping audit guidance (daily entry, employee attestation, supervisor approval, audit trail); do not run two |
| Concur | Travel and expense | Keep; configure expense types to map to allowable vs unallowable cost elements at the source |
| OneStream or Oracle Hyperion HFM | Consolidation and management reporting | Integrate or retire in favor of Group Reporting; do not run both as "books" |
| Blackline | Account reconciliations and close checklist | Keep; integrate trial balance from ACDOCA |
| Workiva | SEC reporting | Keep (public companies); feed backlog/RPO from the RA layer |
| ProPricer | Proposal pricing | Keep; feed it forward pricing rates from the Dassian FR engine rather than spreadsheets |
| ICE model (Excel) | Incurred cost submission | Unavoidable as the submission format; the win is generating its schedules from ACDOCA extracts, not maintaining it as a parallel ledger |
| Vertex or ONESOURCE | Tax | Keep; out of scope for rate design but shares the GL |

**Government portals at the boundary**: PIEE (Procurement Integrated Enterprise Environment) hosting WAWF for invoices and receiving reports and EDA for contract documents; SAM.gov for entity registration data that billing references; Treasury's IPP for some civilian-agency invoicing. WAWF does support documented EDI/SFTP submission (810CV cost vouchers, 810P progress payment requests, 856/857 receiving reports) that large primes run in production, and SAM.gov exposes public entity-management APIs; the real design decision is an EDI feed versus a system-generated package with human submission, driven by invoice volume and the cost of WAWF EDI onboarding, with acceptance status (EDI 824/status feedback or portal status) captured back into SAP either way.

## Data

Master and transactional data for R2R, with SAP tables and owners (role names from People):

| Object | Main SAP tables | Owner |
|---|---|---|
| GL accounts / chart of accounts | SKA1, SKB1, SKAT | Corporate Controller (design), Assistant Controller (maintenance governance) |
| Cost elements (in S/4 unified with GL accounts; secondary cost elements for allocations) | CSKA, CSKB | Cost Accounting Manager, with Compliance Director veto on allowability mapping |
| Cost centers and standard hierarchy (mirrors pool structure) | CSKS, CSKT, hierarchy sets | Cost Accounting Manager; Compliance Director approves pool-node changes |
| Activity types (labor categories, service center outputs) | CSLA | Cost Accounting Manager |
| Statistical key figures (allocation bases like headcount, square footage) | Master in CO SKF objects | Rates Analyst |
| Allocation cycles (assessment/distribution) | T811C and related cycle tables | Cost Accounting Manager |
| Costing sheets / overhead keys (Dassian-extended) | Standard costing sheet config plus /DSN/ rate decks | Rates Analyst (rates), Cost Accounting Manager (structure) |
| Profit centers | CEPC | Corporate Controller |
| Fixed assets | ANLA, ANLB, ANLC | GL Accountant (shared services), Assistant Controller sign-off |
| RA keys, versions, valuation methods, posting rules | RA configuration (OKG1 keys, OKG2 versions, OKG3 valuation methods, OKG8 posting rules) plus Dassian RAENH overlay | Senior Project Accountant executes; Controller owns method |
| WBS elements (consumed, not owned; owned by the project structure stream) | PROJ, PRPS | Project accountants validate costing view: costing sheet, RA key, settlement rule |
| Universal journal actuals | ACDOCA (with BKPF headers) | Assistant Controller |
| Plan/budget data | ACDOCP | Rates Analyst (rate plan), FP&A (operating plan) |
| Consolidated actuals | ACDOCU | External Reporting Manager |

**Costpoint vocabulary mapping** (essential when migrating a Deltek shop or consolidating an acquired division): Costpoint "org" maps to SAP cost center; "account" to GL account/cost element; "project" to WBS element; "project labor category (PLC)" to activity type; "pool" (Manage Cost Pools setup, allocation groups) to a cost center group plus its assessment cycle or Dassian costing sheet row; "pool rates" to costing sheet plus overhead key rates; and Costpoint's three-rate model maps rate by rate: provisional rates (the customer-approved billing rates) to the provisional/billing rate set in the Dassian FR engine, target rates (internal plan and revenue-calc rates) to internal plan and what-if rate sets, and actual rates to the computed actuals in the monthly rate monitor. Costpoint people will keep saying "pools and bases" for years; the consultant's job is to make the SAP cost center hierarchy so cleanly pool-shaped that the vocabulary maps one-to-one.

**Migration objects and load sequence** for this stream: (1) enterprise structure and chart of accounts config; (2) GL account masters; (3) cost centers and the standard hierarchy, built pool-first; (4) activity types and statistical key figures; (5) allocation cycles and costing sheets with the current provisional rate set; (6) profit centers; (7) fixed asset masters and takeover values (AS91 master shells, ABLDT for values, or the S/4 migration cockpit equivalents); (8) GL balances by period and open AR/AP items at cutover; (9) inception-to-date project costs by WBS and cost element, loaded so RA/POC continuity survives cutover (without ITD cost, cost-to-cost POC restarts from zero and rev-rec is wrong on day one); (10) RA method assignment and first parallel RA run against legacy. A mid-fiscal-year cutover forces a stub-period ICS assembled from two systems; schedule the cutover at fiscal year start if the client can tolerate it.

**CUI and export control.** Finance data is mostly not ITAR technical data, but: cost and rate data by contract is proprietary and typically handled as CUI (procurement-sensitive/proprietary categories); forward pricing rates and pool details are competition-sensitive and must not leak across an acquired-entity boundary during integration; classified or special-access programs must be masked in the general ledger (generic WBS descriptions, restricted cost centers, need-to-know reporting), with billing packages for those programs handled in the appropriate enclave rather than the enterprise SAP system. The rule of thumb: the numbers are unclassified, the program association may not be.

## Security and Authorizations

**PFCG role shapes** for R2R (build as single-function roles composed into positions, never as one "finance super role"):
- GL Display (FB03, FBL3N/FAGLL03, table display restricted by authorization group): the base role everyone gets, including auditors.
- GL Poster (FB50/FB01) with tolerance-limited amounts, separated from GL Master Maintainer (FS00).
- Close Manager: OB52 period control, allocation cycle execution, carry-forward (FAGLGVTR); very few holders.
- Cost Structure Maintainer: cost center/hierarchy, cycles, costing sheets; separated from cycle execution in stricter designs.
- Project Accountant: project cost display (CJI3), settlement execution (CJ88/CJ8G), RA execution (KKAJ/KKA2); no RA configuration.
- Rates Analyst: KP26 activity prices, Dassian FR rate maintenance, plan data; display-only on actuals posting.
- Billing Specialist: billing document creation and output; no cash application, no GL posting.
- Compliance/Auditor Display: display-everything, change-nothing (see below).
Use authorization groups on GL accounts and cost centers to fence classified-program objects, and company code plus profit center restrictions to fence segments during acquisitions.

**Segregation-of-duties toxic pairs**:

| Toxic pair | Risk | Mitigation |
|---|---|---|
| GL master maintenance (FS00) + journal posting (FB50) | Create an account and post to it; conceal misstatement or unallowable rerouting | Split roles; monitor new-account postings report monthly |
| Billing creation + cash application (F-28) | Lapping, fictitious billing concealment | Split billing from treasury/AR; unbilled and unapplied-cash reviews |
| Period control (OB52) + journal posting | Backdate entries into closed periods | Close Manager role held by 2-3 people who do not post journals |
| RA configuration (OKG1/OKG2/OKG3/OKG8) + RA execution (KKAJ) | Manipulate rev-rec method to hit a number | Config transport-controlled; method changes require Controller and external-auditor communication |
| Allocation cycle maintenance + cycle execution | Redirect indirect cost between pools to move rates | Split maintain from execute; Compliance Director reviews cycle change log quarterly |
| Asset master maintenance + asset posting (FI-AA) | Fictitious assets, depreciation manipulation | Split; recon of asset subledger to GL in close checklist |
| Vendor/customer master + payment or dunning runs | Adjacent-stream pair that finance shared services often accumulates | Push to the P2P/O2C role design but verify in the R2R SoD ruleset anyway |
Break-glass access goes through a firefighter mechanism (SAP GRC emergency access or equivalent) with logged sessions reviewed by someone outside the close chain. Run the SoD ruleset quarterly and before every role change wave.

**Auditor access design.** DCAA resident or visiting auditors get a dedicated display-only composite role: document display, line-item reports (KSB1, CJI3), and read access to the timekeeping system. Fence classified programs out via authorization groups. Never give auditors ad hoc query tools against raw tables without the same fencing. Log auditor access like any other; it is routinely tested in the contractor's own SOX cycle.

**Export-control specifics.** The finance system itself is rarely export controlled, but if the S/4 instance is shared with engineering/manufacturing data (drawings, BOMs with ITAR technical data), hosting and admin access must satisfy export rules (US-person administration or an appropriately structured environment such as a government-community cloud). For R2R specifically: restrict foreign-national access to programs where the WBS description or customer identity reveals controlled program information, and treat rate build-ups shared with foreign parent entities (under an SSA/FOCI mitigation regime) as items requiring compliance review before release.

## Analytics and Reporting

| Report | To whom | Cadence | SAP source |
|---|---|---|---|
| Actual vs provisional indirect rate monitor (by pool) | Controller, Compliance Director, program finance | Monthly, by workday 8-10 | ACDOCA via cost center group reports (KSB1/S_ALR family) or embedded CDS analytics; Dassian Cost Management rate reports |
| Pool and base trend with year-end rate forecast | CFO, Compliance Director | Monthly/quarterly | ACDOCA plus ACDOCP plan data |
| RA / revenue recognition summary by program (POC, reserves, contract asset/liability) | Controller, external auditors | Monthly after RA run | RA results (KKAJ output, Dassian RAENH reporting layer) |
| RA-to-billing-to-GL reconciliation | Assistant Controller | Monthly | ACDOCA, billing documents, RA postings |
| Unbilled AR aging with root-cause decomposition | Controller, Billing Manager, ACO conversations | Monthly | AR open items plus RA position |
| Incurred cost submission (ICE model, Schedules A-O) | DCAA via the cognizant ACO | Annually, six months after FYE | ACDOCA extracts by contract/cost element; Schedule H from project line items |
| Provisional billing rate proposal | DCAA/ACO | Annually (and on significant change) | Rate monitor + budget (ACDOCP) |
| Forward pricing rate proposal support | DCMA cost/price analysts, PCO negotiations | As triggered by proposal volume | Dassian FR engine rate sets, out-year budgets |
| Backlog / remaining performance obligations | SEC (10-Q/10-K), executive team | Quarterly | RA and contract data; Group Reporting (ACDOCU) for consolidated view |
| Close flux analysis and SOX evidence package | Audit committee, external auditors | Quarterly | ACDOCA comparatives, Blackline recon status |

**Embedded vs warehouse guidance.** Rate monitoring, RA output, project cost, and unbilled analysis should run embedded on ACDOCA (CDS views, Fiori analytical apps, or direct Dassian reports): they need document-level drilldown and same-day close data, and every extract-transform hop is a tie-out DCAA will make you defend. Push to a warehouse (SAP Analytics Cloud, Power BI on a governed extract, or Datasphere) only for cross-year trend analytics, consolidated multi-ERP views during coexistence with Costpoint, and executive dashboards. Iron rule: any number leaving the company (ICS, invoice, SEC filing) is produced from, or reconciled to, ACDOCA with a documented tie-out; warehouse numbers are for insight, not for submission.

**KPIs the client roles are measured on**: workdays to close (target 3-5 for local close, plus consolidation); actual-vs-provisional rate variance (kept inside a band, often plus or minus 2-3 points, before a mid-year provisional rate revision is triggered); unbilled AR days and percent unexplained; ICS on-time filing and DCAA adequacy on first pass; open audit findings and business system CARs; WAWF rejection rate; percent of journals automated; recon completion by workday.

## Role of AI

Concrete, deployable use cases in GovCon R2R:

1. **Unallowable cost screening**: classify expense report lines, vendor invoice text, and journal descriptions against FAR 31.205 categories (entertainment, alcohol, lobbying, contributions, fines) and flag suspected unallowables posted to allowable cost elements before the month closes. High volume, pattern-rich, human-confirmable: the ideal first use case.
2. **Rate variance narrative drafting**: generate the monthly pool-by-pool explanation (base erosion vs spend growth, headcount vs occupancy drivers) from the rate monitor data, for the Rates Analyst to edit rather than write.
3. **Close anomaly detection**: score manual journals for outlier amount, timing (posted in the last hours before lock), account combinations, and description quality; route the top decile for extra review.
4. **ICS assembly assist**: draft ICE model schedule tie-outs from ACDOCA extracts, cross-foot the schedules, and flag contracts where Schedule H cost does not reconcile to billings (Schedule I) within tolerance, before DCAA finds it.
5. **Unbilled root-cause classification**: label each unbilled dollar (rate variance, milestone timing, withhold, closeout pending, data error) from billing and RA data, so the monthly review starts from a classified aging instead of a raw one.
6. **WAWF rejection triage**: parse rejection reasons, match to the CLIN/ACRN/period defect in the invoice data, and propose the correction.
7. **Audit response drafting**: assemble first-draft responses to DCAA requests from prior responses, policy documents, and system extracts, with citations to the source documents.
8. **EAC-to-rev-rec impact preview**: summarize which program EAC changes will move POC revenue materially before RA runs, so the Controller sees the quarter's rev-rec shape early.

**Compliance boundary.** AI never certifies. A human executive signs the Certificate of Final Indirect Costs on the ICS (FAR 52.242-4); a human certifies cost or pricing data under FAR 15.406-2 when TINA applies; a human submits each WAWF invoice; controllers and the CFO sign SOX certifications. These are personal certifications with False Claims Act and defective-pricing exposure, and the certifying human must be able to explain every material number without reference to "the model said so." AI output is decision support up to the certification line, never across it.

**Grounding and auditability rules** for AI feeding government deliverables: every AI-produced figure must trace to identified ACDOCA records or named system extracts (no free-recall numbers); regulatory citations in drafts must be verified by a human against the current FAR/DFARS/CAS text before release; prompts, model versions, and outputs used in a deliverable are retained with the deliverable's workpapers; AI-assisted steps appear in the process narrative DCAA walks through, because hiding them converts a tooling choice into an audit finding; and no CUI or proprietary rate data goes to services outside the approved data boundary.

## Operating Model

**Organization.** Two dominant shapes. (a) **Program-aligned matrix**: project accountants and program finance analysts embedded with programs (often reporting solid-line to a Director of Program Finance, dotted to program managers), with GL, assets, allocations, billing, and compliance in a central controller organization. Typical at primes with large programs. (b) **Shared-services-heavy**: transactional accounting (journals, assets, recons, even billing) in a shared services center, with a thin site controller layer and central compliance. Typical at multi-site Tier-2 suppliers and PE-owned platforms. In both, the Government Compliance Director is central and independent, and the rate function is one team enterprise-wide even when everything else is divisionalized: pools are an enterprise structure (CAS 403 home office allocations make the segments interdependent), so rate design cannot be delegated to divisions.

**Calendar.**

| Cadence | Activities |
|---|---|
| Monthly | Close (WD1-WD5 typical): subledger closes, allocation cycles, settlement, RA run, reconciliations; rate monitor by WD8-10; unbilled review; invoice cycle continuous |
| Quarterly | Rate true-up decision: revise provisional billing rates with DCAA/ACO if variance is outside band, and issue rate-variance catch-up or credit invoices; EAC cycle alignment with program management and resulting RA adjustments; SOX certifications; external reporting (public companies): RPO/backlog, flux, disclosures |
| Annually | ICS build and certification (due six months after FYE); next-year provisional billing rate proposal; budget-driven forward rate refresh in the FR engine; FPRP submissions as proposal volume requires; external financial audit; CAS Disclosure Statement review and any cost-impact processing; asset year-end close (AJAB) and carry-forward (FAGLGVTR) |
| Multi-year background | Final rate negotiations with the ACO for prior open years (often 2-4 years behind); contract closeouts unlocked as final rates settle; DCAA incurred cost audit support |

**Government counterparts.** The **PCO** (procuring contracting officer) at the buying command negotiates awards and definitizes using forward pricing rates. The **ACO** at DCMA (corporate or divisional ACO at large contractors) administers: negotiates final indirect rates and forward pricing rate agreements, approves provisional billing rates, and issues business system determinations. **DCMA specialists** include cost/price analysts on FPRPs and business system monitors tracking corrective actions. **DCAA** audits: resident offices at major primes, branch offices for others; they own the ICS audit, floor checks, paid voucher reviews, and the accounting system audit that feeds the ACO's determination. The Compliance Director owns these relationships day-to-day; the Controller and CFO appear for rate negotiations and system determinations.

**Where it sits.** R2R is a CFO function. Its most important lateral interfaces: Hire-to-Retire (timekeeping and labor distribution: R2R consumes it and answers for it in audit), the project/program structure function (WBS design determines whether cost collection supports the accounting system criteria), contracts (billing terms, withholds, closeout), and estimating/pricing (which consumes the rates R2R produces).

## How a Consultant Engages This Function

**Workshop casting.** Pool and rate architecture: Compliance Director, Rates Analyst, Cost Accounting Manager, plus a Costpoint-fluent translator if migrating from Deltek; do not run this workshop without the Compliance Director, whatever the scheduling cost. Chart of accounts and cost element design: Controller, Assistant Controller, Cost Accounting Manager, Compliance Director (for unallowable segregation). RA/rev-rec: Controller, Senior Project Accountant, External Reporting Manager, and the external auditor consulted between sessions, not surprised at go-live. Billing and WAWF: Billing Specialist plus a contracts representative who knows the CLIN/ACRN structures. Close design: Assistant Controller plus shared services leads. Always separate the "how the rates work" workshop from the "what the rates are" conversation; the latter is competition-sensitive and smaller-room.

**Decision and sign-off ladder.**

| Decision | Sign-off |
|---|---|
| Pool structure, allocation bases, G&A base (TCI vs value-added, or single-element in narrow cases) | Compliance Director and Controller jointly; ACO notification path via Disclosure Statement assessed before the decision is final |
| Chart of accounts, unallowable cost element scheme | Controller, with Compliance Director concurrence |
| RA/rev-rec methods per contract type | Controller, documented for the external auditor |
| Cost center hierarchy | Cost Accounting Manager, Compliance Director for pool nodes |
| Billing formats and WAWF process | Billing Manager plus Contracts |
| Provisional rate set at cutover | Rates Analyst computes, Compliance Director approves, ACO informed |
| Auditor access and SoD ruleset | Controller plus internal audit |

**Common failure modes in this stream.**
1. Replicating the Costpoint pool structure node-for-node without asking whether the reorg is the once-a-decade chance to simplify (or, worse, "simplifying" pools without a CAS cost impact analysis).
2. Leaving the rate calc in Excel with SAP as a data source, which recreates the tie-out nightmare S/4 was bought to kill; the pool totals must be cost center group totals in ACDOCA and the applied burden must post through costing sheets.
3. Deciding RA methods in the last design sprint, after WBS structures are frozen in shapes that cannot carry the method (no ITD continuity, no POB granularity).
4. No unallowable segregation in the cost element design until UAT, forcing rework of the chart of accounts under time pressure.
5. Mid-year cutover with no stub-period ICS plan and no ITD cost load, breaking both POC revenue and the incurred cost claim.
6. Treating timekeeping as an HR topic and discovering at the SF 1408 walkthrough that the labor distribution interface cannot trace a timesheet line to ACDOCA.
7. Underestimating final-rate history: open prior years remain on legacy-system rates; closeout billing needs both systems' data for years.
8. Building the billing feed without deciding EDI versus human submission up front (WAWF speaks EDI with its own onboarding and test cycle, not a modern REST API), then improvising the submission process in hypercare.

**What world class looks like.** One ACDOCA spine with zero parallel ledgers; the cost center hierarchy readable as the pool structure by a DCAA auditor without a translator; burden applied at transaction time through Dassian costing sheets so program managers see fully burdened cost daily, not at month-end; provisional, forward, and what-if rate sets versioned in the FR engine and consumed by ProPricer and program EACs from one source; RA producing ASC 606 revenue at POB level that reconciles to billing and to the RPO disclosure without manual bridges; the ICE model populated from governed extracts in weeks, adequate on first DCAA pass; unbilled fully decomposed every month with nothing older than the current rate-settlement cycle unexplained; a green accounting system determination that survives auditor rotation; and a close at workday 3-5 where the Controller's team spends its time on analysis and the auditors' walkthrough is boring.
