---
stream: hire-to-retire
---

# Hire-to-Retire in a US Government Contractor: The Eight-Dimension Operating Profile

Hire-to-Retire in a GovCon aerospace and defense company is not an HR back office. It is the front half of the accounting system. Labor is the single most audited cost in government contracting because, unlike material, there is no third-party invoice behind it: the only evidence a labor dollar ever existed is the employee's own timesheet and the controls wrapped around it. That makes timekeeping, labor distribution, and the clearance-gated workforce lifecycle the load-bearing walls of DCAA accounting system adequacy. Everything in this profile flows from that fact.

## People

| Role | What they own | What they sign off | Day-to-day pains |
|---|---|---|---|
| HR Director (division or sector) | Workforce lifecycle policy, hiring plan execution, HRIS data quality, employment law compliance | Hire/term actions, policy changes, reduction-in-force plans, Section 503/VEVRAA AAP certification inputs | Reqs open 90+ days for cleared roles; HR data in three systems that disagree; program managers hiring around process |
| Payroll Manager | Gross-to-net accuracy, payroll calendar, tax filings, payroll-to-GL posting | Payroll release each cycle, off-cycle payments, W-2 accuracy, payroll-to-labor-cost reconciliation | Retro timesheet corrections landing after payroll close; multi-state tax; outsourced provider (ADP) file failures at the interface |
| Timekeeping Administrator | Daily time capture operations, delinquency chasing, correction processing, CATS profile administration | Timesheet corrections (processing, not approval), period close of the time capture system | Same 5% of employees late every week; supervisors approving in bulk without review; corrections missing reason codes |
| Labor Compliance Manager (often under Finance/Compliance, not HR) | Timekeeping policy, total time accounting method, floor check readiness, labor charging investigations | Timekeeping policy and training content, disposition of mischarging allegations, ICS labor schedules (with Controller) | Being the person DCAA calls first; proving a negative on every anonymous hotline labor allegation |
| Facility Security Officer (FSO) | Facility and personnel clearances, DISS/NBIS actions, sponsorship, visit requests, insider threat program touchpoints, SEAD-3 reporting | Clearance sponsorship submissions, visit authorization requests, badge and classified access grants, self-inspection results | Clearance pipeline is the staffing bottleneck; program managers promising cleared bodies that do not exist; DCSA reviews |
| Training and Compliance Coordinator | Annual timekeeping training, ethics training, security refreshers, training completion evidence | Training completion certifications handed to auditors | Chasing the last 3% to completion before the audit; proving training content matched the policy in effect that year |
| Staffing / Resource Manager | Matching people to charge numbers, labor category assignment, utilization, bench management | Assignment of an employee to a labor category on T&M orders (with Contracts), utilization targets | Qualified-and-cleared is a two-key lock; utilization pressure versus indirect charging discipline |
| HRIS / HCM Systems Lead | SuccessFactors or HCM configuration, integrations to payroll, time, badging, IAM | System change requests touching employee master data, interface designs | Every downstream system keys off HR events but HR was never told it is an integration hub |
| Program Control interface (CAM/analyst, sits in Plan-to-Perform) | Consumes labor actuals against control accounts | Nothing in this stream, but screams first when labor posts late or to wrong WBS | Labor corrections reopening EAC positions |

Typical reporting lines: HR Director to sector VP HR or CHRO. Payroll Manager usually reports into Finance (Controller), not HR, at defense primes; at mid-tier firms it varies. Timekeeping Administrator and Labor Compliance Manager almost always sit under Finance or a Compliance office because timekeeping is an accounting system control, not an HR benefit. The FSO reports into Security (which may sit under Legal, Operations, or the GC office) and is a named position with government accountability under the NISPOM rule (32 CFR Part 117).

Who a consultant must have in the room:

- Timekeeping policy or CATS design decisions: Labor Compliance Manager, Timekeeping Administrator, Payroll Manager, and a Controller delegate. HR alone cannot decide this.
- Work schedule, exempt/non-exempt, and total time method: Payroll Manager, Labor Compliance, HR Director, and employment counsel.
- Clearance-gated onboarding and access design: FSO, HRIS lead, IT/IAM owner, and export control officer.
- Labor category structures for T&M: Staffing Manager, Contracts, and Billing.

## Process

The end-to-end workforce lifecycle, with the control point at each phase:

| Phase | What happens | Control point |
|---|---|---|
| Requisition and hire | Req approved against staffing plan; offer often contingent on clearance eligibility or interim grant; labor category fit assessed for services work | Offer letter language matches clearance contingency; comp within FAR 31.205-6 reasonableness support |
| Onboarding | I-9/E-Verify, export-control (US person) determination, badge issuance, system access provisioning, timekeeping policy training BEFORE the first timesheet | No time entry rights until training complete; no controlled-system access until export determination recorded |
| Daily time capture | Employee enters own hours daily against valid cost objects; total time for exempt staff | Charge object validity and status checked at entry; delinquency flagged same week |
| Approval | Supervisor with knowledge of the work approves; cost-object-aware routing for matrixed staff | No self-approval; alternate approver chain documented |
| Transfer and payroll | Time transfers to HR time management and CO; payroll gross-to-net runs in-house or at the provider | Approved time only; retro changes re-trigger approval |
| Labor distribution | Labor cost lands on final and intermediate cost objectives; direct/indirect split per disclosed practice | Payroll-to-labor reconciliation each cycle; unreconciled variance escalated |
| Lifecycle changes | Transfers, promotions, leave, clearance status changes, citizenship changes | Every HR event re-evaluates cost distribution defaults, approver, and access |
| Offboarding | Badge pulled, access revoked, clearance debrief, final pay, records retention starts | Revocation on effective date, not weekly batch; debrief documented in the security record |

Clearances as a workforce lifecycle (not an HR afterthought): the FSO owns it end to end. Sponsorship starts when a contract with classified performance justifies it; the subject submits via eApp (NBIS), fingerprints go through SWFT, and adjudicated eligibility appears in DISS. Interim eligibility often arrives first and may be enough to start uncleared-adjacent work; program assignment logic must distinguish interim from final. Periodic reinvestigations are giving way to continuous vetting enrollment under Trusted Workforce 2.0, which converts a five-or-ten-year event into an always-on status the FSO monitors. Visit authorization requests (VARs in DISS) are the mechanism for cleared work at another facility, and they are a real scheduling constraint for program travel. Clearance status gates three things in this stream's system design: project assignment (staffing cannot assign an uncleared person to a slot requiring one), physical access (badge zones), and logical access (classified and export-controlled systems). SEAD-3 reportable activities (foreign travel, foreign contacts, financial issues) make the FSO a permanent consumer of employee self-reporting, which is a workflow, not a spreadsheet.

Onboarding/offboarding as a control system: the joiner/mover/leaver event in HR is the single trigger for badge, IAM, export flag, and timekeeping enablement. If a consultant finds badge issuance, account provisioning, and US person determination running as three disconnected tickets, that is the first finding; wire all three to the HR action so the audit trail is one chain.

GovCon overlay this stream owns or feeds:

| Requirement | Instrument | What this stream owes |
|---|---|---|
| Timekeeping system criterion | DFARS 252.242-7006(c)(9) | A timekeeping system that identifies employees' labor by intermediate or final cost objectives |
| Labor distribution criterion | DFARS 252.242-7006(c)(10) | A labor distribution system that charges direct and indirect labor to the appropriate cost objectives |
| Preaward accounting system survey | SF 1408 | Timekeeping and labor distribution answers; often the first audit a growing contractor ever faces |
| Final indirect rates | FAR 52.216-7 | Incurred cost submission due within six months of fiscal year end; labor schedules including payroll reconciliation |
| T&M payments | FAR 52.232-7 | Hours billed only for employees meeting the labor category qualifications; timekeeping evidence per hour |
| Uncompensated overtime | FAR 52.237-10 | Disclosure of the accounting treatment of hours over 40 for exempt staff on service proposals |
| Service Contract Labor Standards | FAR 52.222-41 | SCA wage determination mapping to internal job codes; health and welfare fringe compliance |
| Construction wage rates | FAR 52.222-6 | Davis-Bacon certified payrolls where construction work applies |
| Employment eligibility | FAR 52.222-54 | E-Verify enrollment and case handling wired into onboarding |
| Ethics and mandatory disclosure | FAR 52.203-13 | Labor mischarging is the classic disclosure trigger; investigation and disclosure process |
| CAS consistency | CAS 401, 402, 418 | Labor charged consistently with estimating practice; same-purpose costs treated alike; disclosed direct vs indirect labor rules |
| Unallowables and period | CAS 405, 406 | Unallowable labor (e.g., lobbying time) identified at entry; cost accounting period discipline |
| Compensation reasonableness | FAR 31.205-6 | Compensation cap compliance and reasonableness support; feeds ICS |

The timekeeping control set (kept tight here; the govcon-timekeeping-compliance bundle carries the depth): daily entry of all hours worked, entry by the employee themselves (never an admin or supervisor on their behalf), supervisor approval by someone with knowledge of the work, corrections only with an audit trail and a reason code, and annual documented timekeeping policy training. Total time accounting sits on top: exempt employees record all hours worked, including uncompensated overtime, and the company discloses how those extra hours affect labor rates. Full dilution (salary divided by total hours worked, so the effective hourly rate drops as hours rise) is the cleanest method; variants that credit the excess to overhead are acceptable if disclosed and consistently applied. The trap is recording only 40 hours for a 50-hour week on a cost-type contract while a fixed-price job absorbs the free hours: that is mischarging even though total pay is unchanged.

What DCAA and DCMA walk through: DCAA performs MAAR 6 labor floor checks (unannounced physical observation plus employee interviews: do you know your charge number, who enters your time, when, who approves it, what do you do if you make a mistake). Being interview-ready is an operating requirement, not an event; a world-class shop runs its own mock floor checks quarterly. DCAA incurred cost audits test the labor schedules of the ICS, in particular the reconciliation of total payroll (per IRS Form 941 filings) to total labor distribution (ICE model Schedule L) and T&M labor hour summaries (Schedule K). T&M voucher reviews test individual employees against contract labor category qualifications. DCMA administers the accounting system determination (the ACO owns the adequacy decision on DCAA's audit input) and DCSA (not DCMA) reviews the security program the FSO runs.

## Technology and Systems

SAP footprint for this stream:

| Component | Role | Notes |
|---|---|---|
| SAP HCM (PA/OM) or SuccessFactors Employee Central | Employee and org master | On S/4, most GovCons run SF EC as system of record with a replicated mini-master (PA0000/0001/0002/0007/0008 subset) in S/4 so time and cost distribution work |
| SAP PT (Time Management) | Work schedules, quotas, time evaluation (RPTIME00) | Needed even when payroll is outsourced, because schedules and quotas drive CATS validation |
| SAP PY (Payroll) | Gross-to-net, posting to FI/CO | Frequently NOT run in SAP; ADP GlobalView or full ADP outsourcing is common; labor distribution must still land in SAP CO regardless |
| CATS | Time capture against WBS, networks, orders, cost centers | CAT2 entry, approval, then transfers: CAT6 to HR time, CAT7 to CO, CAT5 to PS; CATSDB is the audit anchor |
| Fiori timesheet apps | Employee self-service entry | Same CATSDB persistence; design the profile, not the tile |
| Dassian Labor / role-based costing | Labor resources and role-based rate application to project labor | Lets planning and actuals price labor by role/category consistently with the forward rate deck |
| Dassian CATS approval | Cost-object-aware timesheet approval workflow | Approval routed by charge object (WBS/CAM), not just org hierarchy; this is the shape DCAA expects |

Surrounding non-SAP systems typically found at a GovCon A&D company: SuccessFactors or Workday (core HR), ADP (payroll, very often outsourced), UKG/Kronos clocks for touch-labor shops, iCIMS or Greenhouse (ATS), Cornerstone or SumTotal (LMS holding the timekeeping training evidence), ServiceNow (onboarding orchestration), Okta or SailPoint (IAM), Lenel OnGuard or Software House C-CURE (badging/physical access), and an industrial security management tool such as SIMS or Access Commander that mirrors clearance data. Legacy Deltek Costpoint or Unanet time modules survive at acquired subsidiaries and are a classic integration headache.

Keep/retire/integrate guidance:

- Keep the outsourced payroll provider (re-insourcing payroll mid-S/4-program is a self-inflicted wound) but insist the labor distribution of record lives in SAP CO, reconciled to the provider's gross pay each cycle.
- Retire subsidiary time systems onto CATS/Fiori wherever the cost objects live in S/4; a time system that cannot see WBS validity and status in real time is a compliance liability, because it lets employees charge closed or invalid objects and forces corrections later.
- Keep UKG/Kronos clocks where badge-in/badge-out drives touch labor, but land the hours in CATSDB as the single labor record; two labor systems of record is an automatic audit finding waiting to happen.
- Integrate, never replicate, the clearance systems: DISS and NBIS (with eApp for subject submissions and SWFT for fingerprints) are government systems of record; the internal security tool caches status, and SAP should hold only a coarse eligibility flag consumed by assignment and access logic.
- Keep the LMS but interface completion records for timekeeping training into the compliance reporting layer; auditors ask for the evidence by employee by year.
- Decision ladder for time capture platform: if cost objects (WBS, networks, orders) live in S/4, time entry belongs in CATS/Fiori, full stop; a non-SAP time tool is only defensible when payroll, HR, and cost accounting all live outside SAP, which is not the situation this profile covers.

Government portals at the boundary: DISS (eligibility and visit requests), NBIS/eApp (subject submissions), SWFT (fingerprints), NISS (facility clearance side), E-Verify (employment eligibility), SAM.gov (wage determinations for SCA/DBA work), the OFCCP contractor portal (Section 503/VEVRAA AAP certification), and the EEO-1/VETS-4212 filing portals. E-Verify is the one genuine integration point: it offers a Web Services interface that onboarding and ATS platforms (and employer agents) commonly use, so wire case creation into onboarding rather than treating it as portal swivel work. The security systems (DISS, NBIS, SWFT, NISS) and the compliance filing portals remain human-in-the-loop for contractors; plan for swivel work there and build the internal tracking around it rather than pretending an API exists.

## Data

| Data object | Main SAP tables | Owner (from People) | Notes |
|---|---|---|---|
| Employee master (actions, org assignment, personal data) | PA0000, PA0001, PA0002 | HR Director (HRIS lead as steward) | US SSN sits in PA0002 field PERID; PII handling applies |
| Work schedule and basic pay | PA0007, PA0008 | Payroll Manager (pay), HR Director (schedule) | Schedule rules drive total time capture for exempt staff |
| Cost distribution | PA0027 | Payroll Manager with Program Control | Default cost assignment when time does not override |
| Org structure | HRP1000, HRP1001 | HR Director | Drives MSS approval fallbacks and structural authorizations |
| Wage types and payroll config | T512W and payroll schema | Payroll Manager | Direct/indirect and allowable/unallowable wage type mapping is a compliance design object |
| Timesheets | CATSDB | Timekeeping Administrator (operations), Labor Compliance Manager (policy) | The single most subpoena-relevant table in the company; corrections and reason codes live here |
| Payroll results | PCL2 clusters | Payroll Manager | Display access is radioactive; see Security |
| Payroll posting to FI/CO | PPOIX and posting documents | Payroll Manager with Controller | One leg of the payroll-to-labor reconciliation |
| Labor actuals in CO | COEP/COBK (from CAT7), ACDOCA in S/4 | Program Control consumes; Timekeeping feeds | The other leg of the reconciliation |
| Labor category assignments | Custom/Dassian role-costing objects | Staffing Manager with Contracts | Qualification evidence (resume, degree, years) attached per T&M billability |
| Clearance eligibility flag, US person status | Custom infotype or custom table; source is DISS/security tool and I-9/export review | FSO (clearance), Export Control Officer (US person) | SAP is a consumer, never the system of record |

Migration objects and load sequencing for this stream:

1. Enterprise and personnel structure configuration plus the wage type catalog (T512W mapping decided with Labor Compliance, because direct/indirect and allowable/unallowable classification is baked in here).
2. Org management objects: org units, positions, reporting relationships (HRP1000/HRP1001), because approvals and structural authorizations hang off them.
3. Employee master via hiring actions in sequence: PA0000/0001/0002 first, then PA0007 (work schedule), PA0008 (pay), PA0027 (cost distribution), then bank and tax infotypes.
4. Time quotas and leave balances as of the cutover date.
5. Year-to-date payroll balances only for a mid-year go-live; a fiscal-year-start cutover avoids YTD conversion entirely and is worth fighting the program plan for.
6. CATS opens at a pay period boundary with no open timesheet migration: close the final period in the legacy tool, reconcile it, and open the first period in CATS clean.

Historical timesheet detail stays in the legacy system or an archive; do not convert it. The FAR 4.703/4.705-2 retention rules are only the regulatory floor (and the specific period for time and attendance records is shorter than the general three-years-after-final-payment rule); prudent GovCon practice retains timekeeping records for six or more years, because the False Claims Act lookback runs six years (up to ten under 31 USC 3731(b)) and a labor mischarging allegation is indefensible without the underlying records. Migrating history into CATSDB destroys the clean provenance of the new system's change documents and gives auditors a mixed-lineage table.

CUI and export control: employee PII and payroll data are sensitive and, on covered contractor systems, fall under DFARS 252.204-7012 and NIST SP 800-171 handling expectations; clearance status and investigation data are tightly need-to-know; US person status (ITAR, 22 CFR parts 120-130, and EAR) is a data element that gates system access and program assignment, so its provenance (I-9 evidence plus export review) must be auditable. Never let clearance or investigation detail replicate into analytics layers.

## Security and Authorizations

PFCG role shapes for this stream:

- HR master data administrator: PA30/PA40 with P_ORGIN restricted by personnel area and infotype; no payroll release, no CATS approval.
- Payroll processor: payroll driver and posting run execution, PCL2 read; no HR master maintenance of pay-relevant infotypes for the population they pay.
- Time administrator: CATS correction processing and delinquency reporting; corrections always with reason code; no approval authority.
- CATS approver: derived roles scoped by cost object responsibility (Dassian cost-object-aware approval) or org unit; approve only, never enter for others.
- Employee self-service: own timesheet entry only, enforced with P_PERNR so employees touch only their own records.
- FSO/security: read HR events feed, maintain the eligibility flag source interface; no HR master or time authority.
- Auditor (DCAA/internal audit): display-only composite; see below.
- Structural authorizations (profiles defined in T77PR, assigned to users via T77UA) fence which org-tree objects are visible for MSS and HR partners, working in combination with the PLOG authorization object that governs PD/OM infotype access.

Segregation-of-duties toxic pairs:

| Toxic pair | Why it is toxic | Mitigation |
|---|---|---|
| Enter own time + approve own time | Defeats the entire labor evidence model | Hard block in workflow; executives are not exempt; designate alternate approvers |
| Maintain PA0008 (pay) + release payroll | Invent a raise and pay it | Split HR comp admin from payroll processing; payroll release dual control |
| Create employee (PA40 hire) + payroll release | Ghost employee fraud | Different roles plus periodic headcount-to-badge-to-payroll tri-reconciliation |
| Process timesheet corrections + approve timesheets | Rewrite labor history silently | Corrections re-trigger approval and post with reason code; monthly correction report to Labor Compliance |
| Maintain labor rates/wage type config + run posting | Steer cost between direct and indirect | Config locked to a separate basis team; transport discipline; quarterly config change review |
| IAM provisioning + HR event processing | Access that outlives employment | Automated joiner/mover/leaver from HR events; weekly orphan account report |

Auditor access design:

- Give DCAA a display-only SAP user scoped to CATS display transactions, labor distribution reports, and the specific data supporting the schedule under audit.
- Never grant PCL2 payroll cluster display broadly; compensation detail beyond the audit sample is not theirs to browse, and over-granting creates a privacy incident inside an audit.
- In practice most shops serve auditors curated extracts with documented lineage from CATSDB and ACDOCA rather than terminal access. Both models are acceptable; the extract model needs a repeatable, versioned query so the auditor (or the next auditor) can re-run the pull and get the same rows.
- Log every auditor session and extract delivery; the access record is itself audit evidence in the next system review.

Export-control specifics: system access to ITAR-controlled technical data is gated on the US person flag and program authorization, wired so an HR event (transfer, leave, termination, citizenship change) automatically re-evaluates access. Offboarding must revoke badge, SAP access, and controlled-system access on the effective date, not at the weekly batch; DCSA self-inspections and export audits both test exactly this seam.

## Analytics and Reporting

| Report | To whom | Cadence | SAP source |
|---|---|---|---|
| Timesheet compliance (late entries, missing days, correction rate by reason code) | Labor Compliance Manager, supervisors, executive scorecard | Weekly | CATSDB (entry vs work date deltas, change documents) |
| Floor check readiness (mock interview results, training currency) | Labor Compliance, Controller | Quarterly | CATSDB plus LMS extract |
| Headcount and hires/terms by program and skill | HR Director, sector leadership | Monthly | PA0000/PA0001 |
| Clearance pipeline (interim, final, in-process, reinvestigation/CV due) | FSO, Staffing Manager, program managers | Weekly | Security tool extract joined to PA0001 assignments |
| Labor utilization (direct vs total available) | Staffing Manager, resource boards | Weekly/Monthly | CATS to CO postings vs schedule hours |
| Direct vs indirect labor mix by pool | Controller, rate analysts | Monthly (close) | ACDOCA by cost element/cost center |
| Uncompensated overtime hours and rate dilution effect | Labor Compliance, pricing | Monthly | CATSDB total hours vs PA0007 schedule; effective rate calc |
| Payroll-to-labor-distribution reconciliation | Payroll Manager, Controller; feeds ICS Schedule L | Every pay cycle, hardened at close | Payroll posting (PPOIX/GL) vs CO labor postings |
| T&M labor hours by category and person | Billing, Contracts; feeds ICS Schedule K | Monthly with vouchers | CATSDB with labor category assignment |
| SCA wage determination compliance | Labor Compliance, HR | Per WD update and annually | PA0008 vs mapped WD rates |
| EEO-1, VETS-4212, Section 503/VEVRAA AAP support | HR Director to EEOC/DOL/OFCCP | Annually | PA0001/PA0002 demographics |

Embedded analytics vs warehouse: run operational compliance monitoring (delinquency, approvals pending, correction alerts) embedded in S/4 (CDS-based queries on CATSDB/ACDOCA) because it must reflect the live period. Push trend analytics, clearance pipeline joins, and workforce planning to the warehouse layer, but strip clearance detail and PII to the minimum coarse fields before data leaves the HR-secured zone. Anything feeding a government deliverable (ICS schedules) must trace back to CATSDB and ACDOCA line items, not to a transformed warehouse copy.

KPIs the client roles are measured on: Timekeeping Administrator on same-day entry rate and correction rate; Labor Compliance on floor check pass rate and audit findings; Payroll Manager on error rate and reconciliation closure time; FSO on clearance cycle time, pipeline coverage of forecast demand, and self-inspection results; Staffing Manager on utilization and time-to-fill for cleared reqs; HR Director on attrition, time-to-fill, and training currency.

## Role of AI

Concrete use cases:

1. Charging guidance assistant: employee asks "which charge number for the design review rework on program X" and the assistant answers from the disclosed practices, charge number guidance sheets, and active WBS status, with citations. Reduces the top floor-check failure (employees who cannot explain their charge number).
2. Timesheet anomaly detection: pattern models over CATSDB flag late-entry clusters, round-number-only charging, identical week-over-week patterns on cost-type work, correction spikes before close, and charging to objects inconsistent with the employee's assignment. Output is a review queue for Labor Compliance, never an automatic reversal.
3. Labor category qualification matching: parse resumes and HR records against T&M labor category qualification text and flag gaps before an employee bills; keeps FAR 52.232-7 exposure out of vouchers.
4. Clearance pipeline forecasting: predict grant timelines from historical case data and staffing demand, so proposals do not promise cleared staffing the pipeline cannot deliver.
5. Floor-check interview readiness: AI-driven practice interviews for employees mirroring MAAR 6 question sets, scored against policy answers, targeting populations with weak compliance metrics.
6. Correction narrative quality: classify correction reason codes and free-text, flagging vague narratives ("fix" or "adjust") that would not survive audit and prompting for specifics at entry time.
7. Policy training personalization: generate role-specific timekeeping training refreshers (touch labor vs exempt engineer vs supervisor) from the single controlled policy source.

Compliance boundary: a human must always make and certify the acts the government relies on. The employee personally attests the timesheet (AI may never enter or alter time); the supervisor personally approves it; an officer of the company certifies the incurred cost submission (FAR 52.216-7 certificate) and the labor category qualification determination behind a T&M invoice is a human decision with evidence attached. AI drafts, flags, and forecasts; it never certifies, approves, or corrects labor records. Mischarging exposure runs through the False Claims Act, so any AI-suggested reclassification of labor must route through the same corrections process, reason codes and all.

Grounding and auditability rules for AI output feeding government deliverables:

- Retrieval only from a version-controlled corpus (disclosed practices, timekeeping policy, contract briefs, wage determination texts), with the source document and version cited inline in the output so a reviewer can check the basis.
- Immutable logs of prompt, model version, retrieved sources, and response, retained as long as the deliverable they supported (record-retention clock, not IT convenience).
- No employee PII, compensation detail, or clearance/investigation data in model context beyond the single field the use case needs; clearance narratives never leave the security enclave.
- Every number in a government deliverable must be reproducible from CATSDB/ACDOCA queries that run independently of the model; the AI may explain the number, never be the source of it.
- Anomaly-detection outputs are advisory queues with human disposition recorded; a model score is never itself the reason code on a labor correction.

## Operating Model

Organization variants: at a defense OEM prime, this stream is a shared service (an enterprise time-and-labor compliance team under the Controller, enterprise HR, central payroll, sector FSOs under a corporate CSO) with program-aligned staffing managers matrixed to programs. At a Tier-2 supplier or mid-tier services firm, HR, payroll, and timekeeping compliance may be five people total, and the FSO is often dual-hatted; the compliance risk is identical, so the control set cannot shrink even when the org does. The stable pattern: timekeeping policy and labor compliance report through Finance, time capture operations sit wherever cost accounting sits, HR owns lifecycle events and data, Security owns clearances, and none of them may unilaterally change the others' controls.

Calendar:

| Cadence | Activities |
|---|---|
| Weekly | Timesheet period close, delinquency chase, approval sweep, clearance pipeline review, IAM joiner/mover/leaver reconciliation |
| Per pay cycle | Payroll run or provider file exchange, payroll-to-labor posting reconciliation, off-cycle corrections |
| Monthly | Labor distribution hardened at financial close; correction and reason-code review; utilization and direct/indirect mix reporting; labor actuals feed EAC updates in Plan-to-Perform |
| Quarterly | Mock floor checks; SoD and access review; training currency check; forward pricing labor rate inputs refreshed with uncompensated OT dilution data |
| Annually | Timekeeping policy training for all hands; ICS labor schedules (K, L) built and reconciled for the submission due six months after FYE; compensation review against the FAR 31.205-6 cap; EEO-1/VETS-4212 filings and Section 503/VEVRAA AAP certification; DCSA self-inspection; SCA WD refresh mapping |
| Event-driven | DCAA MAAR 6 floor checks (unannounced), accounting system audits, T&M voucher reviews, mischarging investigations, RIF actions with WARN and clearance debrief mechanics |

Government counterparts:

- DCAA field audit office: floor checks (MAAR 6), incurred cost audits, accounting system audits, T&M voucher labor testing. The Labor Compliance Manager is their standing point of contact; a designated audit liaison process (single intake, logged requests, tracked responses) is table stakes.
- DCMA ACO (or CACO/DACO for corporate-level matters): owns the accounting system adequacy determination on DCAA's audit input and negotiates final indirect rates; DCMA industrial specialists track touch labor capacity on production programs.
- PCO: engaged when labor issues hit deliveries, T&M billing disputes, or labor category substitution approvals.
- DCSA industrial security representative: the FSO's counterpart for the facility clearance, personnel security program reviews, and self-inspection follow-up.
- DOL Wage and Hour Division for SCA/DBA wage matters; OFCCP for affirmative action compliance under Section 503 (disability) and VEVRAA (veterans). Note the January 2025 revocation of EO 11246 eliminated the race/gender AAP obligations for federal contractors; the Section 503 and VEVRAA AAPs are statutory and survive, and EEO-1 and VETS-4212 filings are unaffected.

Where it sits in the org: this stream spans Finance (timekeeping and labor compliance), HR (lifecycle and data), Security (clearances), and IT (systems and access), which is exactly why it fails when treated as any single department's project. The strongest operating pattern gives it a standing cross-functional governance forum, typically chaired by the Controller with HR, Security, and IT as permanent members, that owns the timekeeping policy, the disclosed labor practices, and the change control over anything touching CATSDB or the payroll interface.

## How a Consultant Engages This Function

Workshop casting: never run a timekeeping design workshop with only HR in the room. The minimum cast for time capture and approval design is Labor Compliance Manager, Timekeeping Administrator, Payroll Manager, a Controller delegate, a program control representative (they own the cost objects time posts to), and the HRIS lead. Add the FSO and export control officer for any onboarding/offboarding or access-gating design. Add Contracts and Billing for labor category and T&M design. Employee experience input (a supervisor and a touch-labor lead) prevents designing a compliant system nobody can use on a shop floor with gloves on.

Sign-off matrix for the decisions that matter:

| Decision | Required sign-offs |
|---|---|
| Total time accounting method and rate dilution treatment | Controller, Labor Compliance, pricing lead; disclosed practice change control |
| Timekeeping policy (entry timing, corrections, reason codes) | Labor Compliance, Controller, HR Director, employment counsel |
| CATS approval routing (org-based vs cost-object-based) | Labor Compliance, program control, Timekeeping Administrator |
| Payroll insource/outsource and reconciliation design | Controller, Payroll Manager, CFO for the contract |
| Clearance flag and US person gating in SAP/IAM | FSO, export control officer, CIO delegate |
| Labor category qualification evidence model | Contracts, Billing, Staffing Manager |
| Auditor access model (terminal vs extract) | Controller, Labor Compliance, internal audit |

Common failure modes of implementations in this stream:

- Replicating a commercial time template that records exception time only for exempt staff. Total time accounting requires positive recording of all hours worked, so the template is structurally noncompliant before the first timesheet is entered.
- Routing CATS approval purely through the HR org chart, so approvers with no knowledge of the work rubber-stamp charges for matrixed employees. Use cost-object-aware approval, which is exactly what the Dassian CATS approval component exists for.
- Treating outsourced payroll as out of scope, then discovering at the first incurred cost submission that nobody can reconcile provider gross pay to SAP labor distribution at the cost element level.
- Leaving corrections as free edits without mandatory reason codes and change-document reporting, which turns every DCAA sample into a fishing expedition.
- Onboarding design that grants system access before the export/US person determination is recorded, or offboarding that revokes on a weekly batch instead of the effective date.
- Cutting over mid pay period, guaranteeing a split-period reconciliation nobody can ever fully explain.
- Migrating historical timesheets into CATSDB, contaminating the new system's audit trail with unowned legacy data.
- Designing the clearance flag as a manually keyed SAP field with no interface discipline, so within a year it disagrees with DISS and staffing decisions run on stale data.

What world class looks like:

- Same-day time entry above 95%, with delinquency measured in hours not days, and supervisors seeing their team's entry status live rather than in a Friday report.
- Corrections under 2% of lines, every one carrying a specific reason code, the original values, and re-approval; the monthly correction review is boring because there is nothing to find.
- Any employee on any floor can answer the MAAR 6 interview questions cold: what they charge, who enters it, when, who approves, and how a mistake gets fixed.
- Payroll-to-labor reconciliation closes within days of each cycle with zero unexplained variance at year end, so ICS Schedule L is an export, not a project, and Schedule K falls out of the same data.
- Uncompensated overtime is visible, disclosed, and priced: the effective rate dilution feeds forward pricing instead of surprising the rate analysts at year end.
- Clearance pipeline visibility is good enough that proposals commit staffing dates with confidence and the FSO is consulted before the bid, not after the award.
- Access grants and revocations fire automatically off HR events on the effective date, and the quarterly access review finds nothing manual to clean up.
- DCAA floor checks come and go without a finding, because the operating rhythm already looked like the audit.
