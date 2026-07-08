---
stream: security-authorization
---

# Security and Authorization for GovCon SAP: The Eight-Dimension Operating Profile

This is the platform stream. It does not own a value stream of its own; it owns role design, segregation of duties (SoD), access governance, export-control access, audit logging, and auditor access for EVERY value stream in the company (Pursue-to-Award, Plan-to-Produce, Procure-to-Pay, Inventory-to-Deliver, Hire-to-Retire, Record-to-Report, and the rest). Deep control design (ruleset content, ITAR enclave architecture detail) lives in the companion bundle sap-ad-security-itar; this profile goes deep on the people, the operating model, and how this team serves the ten operational streams.

## People

The security and authorization function at a GovCon aerospace and defense company is small (often 4 to 12 people for a multi-billion dollar prime) but touches every user. Titles vary; the accountabilities below do not.

| Role | Owns | Signs off on | Day-to-day pains |
| --- | --- | --- | --- |
| CISO (Chief Information Security Officer) | Enterprise security policy, the NIST SP 800-171 System Security Plan (SSP), CMMC posture, incident response | SSP and POA&M content, hosting and boundary decisions, SPRS score currency and the annual CMMC affirmation submitted in SPRS by the company's Affirming Official | Translating SAP-specific risk into board language; owning CMMC scope creep when a program drops CUI into a new system |
| ISSM (Information System Security Manager) | Per-system security posture for systems inside the assessment boundary, audit log configuration and review evidence | Security Audit Log scope, log retention, system-level control implementation statements | SAP evidence does not look like the eMASS or SSP template; chasing Basis for log config drift |
| SAP Security Lead / Security Administrators | PFCG role build, SU24 maintenance, transports of roles, user administration in SAP | Role designs, role-to-position mapping, emergency changes to auths | Ticket volume; "just give me what Bob has" requests; SU53 screenshots at month-end close; being blamed for every dump |
| GRC Analyst | SoD ruleset, risk analysis runs, mitigation assignments, access review campaigns, firefighter administration | Mitigation control adequacy, campaign completeness, ruleset changes | Business owners who rubber-stamp reviews; mitigations with no real monitor behind them |
| IAM Engineer | Identity platform (SailPoint, Saviynt, Okta or Entra ID), joiner/mover/leaver automation, birthright provisioning | Connector design to SAP, lifecycle event mappings from HR | HR data quality (missing termination dates, contractor records with no end date); SAP as the one system that resists flat group models |
| Export Control Officer / Empowered Official | ITAR/EAR authorization decisions, US-person determinations, technology control plans (TCP) | Who may access export-controlled technical data; license and TAA scope; deemed export dispositions | IT teams who treat display access as harmless; foreign-person contractors appearing in AD overnight |
| FSO (Facility Security Officer) | Facility clearance, personnel clearance workflow (DISS/NBIS), insider threat program per 32 CFR part 117 (NISPOM rule) | Clearance status feeds used as provisioning gates; visitor and badge policy that intersects system access | Clearance data lives in government systems, not HR; reconciling it to account status manually |
| IT Internal Audit Manager | ITGC test plan, SOX-style access testing (public companies), audit issue tracking | Nothing operationally (independence); accepts or rejects control evidence | Evidence produced ad hoc per request instead of standing extracts; SoD reports that do not tie to the ruleset version tested |
| Business Role Owners (one per value stream) | The definition of what each job position in their stream may do; approval of role content changes | Role content for their stream, access requests into their data, review campaign results for their people | Asked to approve technical auth objects they cannot read; conflicting pressure from program managers to over-provision |

Reporting lines that matter:

- The CISO typically reports to the CIO, or directly to the CEO or General Counsel at companies that have had an incident.
- The SAP Security Lead almost always sits in IT applications, NOT under the CISO. This is the single most common organizational seam a consultant must bridge: policy lives in one chain, the keyboard lives in another.
- The ECO/Empowered Official reports through Legal or Trade Compliance, never through IT. Empowered Official is a defined ITAR term; the person carries personal signature authority.
- The FSO reports through corporate security (sometimes Legal), with obligations to DCSA that bypass the normal management chain.
- Internal audit reports to the audit committee and must stay outside operational sign-offs to preserve independence.
- The GRC Analyst sits either with the SAP Security Lead in IT or in the controller's compliance group; both work, split ownership of the ruleset does not.

Who must be in the room for which decisions:

| Decision type | Mandatory attendees | Notes |
| --- | --- | --- |
| Role design for a stream | SAP Security Lead, that stream's Business Role Owner, a super-user | Never design roles from the org chart alone; the super-user knows the real job |
| SoD ruleset or mitigation change | GRC Analyst, affected Business Role Owner, internal audit as observer | Audit observes, never approves; they will test it later |
| Any export-control access decision | ECO/Empowered Official | The ECO can veto; nobody in IT can overrule an export determination |
| Hosting, boundary, admin nationality | CISO, ISSM | Plus procurement if an operating contract changes |
| Lifecycle automation design | IAM Engineer, HR stream owner, FSO for clearance feeds | The seam with Hire-to-Retire is contractual: document it |
| Auditor access standard | ISSM, internal audit | Set once, reuse for every audit |

## Process

End-to-end processes this platform team runs, each serving all ten value streams:

1. **Role lifecycle**: design (role-per-job from the stream's role map), build in PFCG in development, SU24 default maintenance, unit test with test IDs, business owner approval, transport to production, assignment. Control point: no role reaches production without documented owner approval and a clean SoD simulation.
2. **Access request and provisioning**: request against a position-based catalog (not a menu of 3,000 technical roles), automated SoD check pre-approval, provisioning via the identity platform or GRC Access Request. Control point: any request that trips a high risk requires a mitigation assignment before provisioning, not after.
3. **Periodic access review / recertification**: quarterly user access reviews (UAR) by managers and role owners, annual SoD and mitigation recertification, quarterly privileged access review. Control point: non-response equals revoke, enforced, or the campaign is theater.
4. **Emergency access (firefighter)**: checkout with reason code, session logging, mandatory log review by an independent controller within a defined SLA (5 business days is the common standard). Control point: firefighter usage trending is reviewed monthly; a user living in firefighter is a role design defect.
5. **User lifecycle (joiner/mover/leaver)**: driven by HR events from the Hire-to-Retire stream, gated by clearance status and export-control (US-person) status. Leaver: same-day lock and validity-date end. Mover: old access removed, not accumulated. Control point: monthly reconciliation of HR terminations against active SAP accounts.
6. **Audit logging and monitoring**: Security Audit Log configured and shipped to the SIEM, table logging for key configuration tables, Read Access Logging where display of sensitive data must be evidenced.
7. **Auditor support**: standing read-only auditor roles, extract packages, and a named walkthrough support person per audit.

**GovCon overlay.** This stream owns no FAR clause outright but is the control substrate for several:

- FAR 52.204-21 (Basic Safeguarding) and DFARS 252.204-7012 (Safeguarding Covered Defense Information and Cyber Incident Reporting): the SAP landscape holding Covered Defense Information falls inside the covered system; 7012 also drives the 72-hour cyber incident reporting path the ISSM owns.
- DFARS 252.204-7019 / 7020 (NIST SP 800-171 DoD Assessment Requirements) and 252.204-7021 (CMMC): the current NIST SP 800-171 self-assessment score posted to SPRS, medium/high assessments by DCMA's DIBCAC, and CMMC Level 2 certification for CUI-handling contracts.
- DFARS 252.242-7005 (Contractor Business Systems) and the system-specific clauses (accounting 252.242-7006, estimating 252.215-7002, MMAS 252.242-7004, EVMS 252.234-7002, purchasing 252.244-7001, property 252.245-7003): every business system adequacy review tests whether access controls and SoD protect the system's data integrity. A DCAA accounting system audit that finds one person can create a vendor, post the invoice, and run the payment run will write it up regardless of how good the chart of accounts is.
- ITAR (22 CFR parts 120 through 130) and EAR (15 CFR parts 730 through 774): release of export-controlled technical data in SAP to a foreign person (including giving a foreign person display access) is an export event; when that release happens inside the US it is a deemed export. The SoD program and the export access program are separate control sets with separate owners (GRC Analyst vs ECO).
- CAS consistency standards (CAS 401, 402) do not name access control, but DCAA treats uncontrolled ability to reclassify costs between direct and indirect as a CAS compliance risk, which lands on this stream's SoD catalog.

**What DCAA/DCMA walk through.** DCAA, typically during accounting system audits and incurred cost audits under FAR 52.216-7, walks:

- How a user gets access end to end: request, approval evidence, SoD check, provisioning record.
- The most recent access review: campaign scope, completion evidence, and proof that revocations actually happened in SAP.
- Who can post journal entries and also maintain the master data those entries depend on (vendor, GL account, cost element).
- The firefighter process: checkout reasons, a sample of session logs, and the independent reviewer's sign-off.
- Terminated employee handling: pick five recent terminations from HR and show lock status and validity end from USR02, plus the lock-event date from user change documents (USH02/SUIM).
- Labor: who can enter time and also approve it (floor-check exposure; expect them to sample real users).

DCMA DIBCAC assessment depth matters: a Medium assessment under the NIST SP 800-171 DoD Assessment Methodology is a review of the SSP and supporting documentation, while a High assessment (like a CMMC Level 2 C3PAO assessment) verifies implementation against live evidence and demonstrations. In a High assessment, expect them to walk the controls against the live system:

- Security Audit Log configuration on screen (RSAU_CONFIG in S/4HANA), retention, and where the logs go.
- Unique user attribution: no shared dialog accounts, generic accounts justified and non-dialog (800-171 3.3.2).
- Least privilege on interface and service accounts: expect to defend every RFC user's S_RFC scope.
- Separation of duties evidence (3.1.4) and least privilege (3.1.5): they accept the GRC report if the ruleset version is documented.
- Multifactor and session controls at the boundary in front of SAP, which pulls the SSO architecture into scope.

Have a named walkthrough support person who can drive SUIM, RSAU_READ_LOG, and the GRC reporting screens without hunting; fumbling the demo reads as a control weakness even when the control is fine.

## Technology and Systems

**SAP stack for this stream** (no Dassian modules; Dassian applications consume this stream's roles like any other):

| Component | What it does here | Notes |
| --- | --- | --- |
| PFCG / SU24 / SU25 | Role build, transaction-to-authorization default proposals, upgrade reconciliation | The center of gravity; SU24 hygiene decides whether roles are maintainable in year 3 |
| SAP GRC Access Control 12.0 | ARA (risk analysis), ARM (access request), BRM (role management), EAM (firefighter) | The common on-premise choice at defense primes; ruleset must be customized, never run stock |
| SAP IAG (Identity Access Governance) | Cloud successor for access analysis, access request, certification, privileged access | Pairs with SAP Cloud Identity Services (IAS/IPS); check data residency before adopting at an ITAR-heavy client |
| Security Audit Log | Kernel-level security event log; RSAU_CONFIG / RSAU_READ_LOG in S/4HANA (SM19/SM20 on older releases) | Primary 800-171 audit evidence (requirements 3.3.1, 3.3.2); ship to SIEM, do not review inside SAP only |
| Table logging / change documents | DBTABLOG via SCU3; CDHDR/CDPOS for master data | Auditors ask for config change history; turn table logging on for customizing before go-live, not after |
| Read Access Logging (SRALMANAGER) | Evidence of who DISPLAYED sensitive data | The standard-delivery SAP answer to deemed export exposure from display access; the separately licensed UI Data Protection Logging/Masking add-ons are the alternatives |
| SNC / UCON / SM59 hygiene | Encrypted GUI/RFC, RFC surface reduction, destination credential control | Interface accounts are the most common least-privilege failure |

**Surrounding non-SAP systems typically found at a GovCon company**: SailPoint (IdentityIQ or Identity Security Cloud) or Saviynt for identity governance; Microsoft Entra ID plus on-premise Active Directory; Okta at mid-tier suppliers; CyberArk for privileged access to OS/DB layers; Splunk or Microsoft Sentinel as SIEM; Pathlock or Xiting as SAP-specific GRC alternatives; Onapsis for SAP vulnerability and interface monitoring; ServiceNow as the request front door; Exostar for identity federation with primes.

Keep/retire/integrate guidance:

| System class | Verdict | Rationale |
| --- | --- | --- |
| Enterprise IGA (SailPoint, Saviynt) | Keep as system of record for identity and lifecycle; integrate SAP into it | Do not let SAP GRC try to govern non-SAP applications; it will lose that fight |
| SAP GRC Access Control / IAG | Keep for what only it does well: authorization-object-level SoD analysis and firefighter | Enterprise IGA tools see roles as opaque entitlements; they cannot see inside AGR_1251 |
| Directory and SSO (AD, Entra ID, Okta) | Keep; integrate via SAML/SNC | The MFA story DIBCAC asks about lives here, in front of SAP |
| PAM (CyberArk) | Keep for OS/DB layer privileged access | GRC EAM covers application-layer emergency access; they are complementary, not competing |
| SIEM (Splunk, Sentinel) | Integrate: ship SAL, and consider SAP Enterprise Threat Detection or Onapsis as the SAP-aware feed | Raw SAL in a SIEM without SAP context generates noise, not detection |
| Homegrown role-mapping Access databases and spreadsheet UARs | Retire on day one | They fail DIBCAC integrity and unique-attribution expectations and cannot survive an evidence request |
| Dual request front doors (GRC ARM plus ServiceNow) | Pick one front door; make the other a pass-through | Two live request paths means users route around the SoD check |

**Government portals at the boundary** (this team governs who holds credentials, not the portals themselves): PIEE/WAWF for invoicing and receiving reports, SAM.gov for registration, SPRS for the 800-171 score, eMASS where RMF packages apply, DISS/NBIS for personnel clearances (FSO-owned). Portal credentials are individual, never shared, and belong in the leaver checklist.

**Hosting**: if the SAP landscape processes CUI or ITAR technical data, expect GovCloud-class hosting (AWS GovCloud (US), Azure Government) or SAP NS2-operated environments, with US-person administration commitments in the operating contract. A standard commercial RISE tenancy with follow-the-sun offshore Basis support is usually a non-starter for the ITAR enclave; get this decision made before the Basis operating model is signed.

## Data

| Data object | Main SAP tables | Owner (from People) | Notes |
| --- | --- | --- | --- |
| Role definitions and content | AGR_DEFINE, AGR_1251, AGR_TEXTS | SAP Security Lead (content approved by Business Role Owners) | The role catalog IS the position map; treat as configuration under change control |
| SU24 default proposals | USOBT_C, USOBX_C | SAP Security Lead | Migrates via SU25 on upgrades; undocumented manual auths here are year-3 technical debt |
| User master | USR02, USR21 and related USR* tables | SAP Security Lead (records), IAM Engineer (lifecycle) | Lock status and validity dates are audit evidence; user group (S_USER_GRP) partitions admin rights |
| Role assignments | AGR_USERS | IAM Engineer / GRC Analyst | The join of AGR_USERS to HR position data is the master reconciliation |
| SoD ruleset, risks, mitigations | GRC repository (Access Control) | GRC Analyst (content), Business Role Owners (accept residual risk) | Version the ruleset; auditors ask which version a report ran against |
| Firefighter IDs and session logs | GRC EAM repository | GRC Analyst | Logs are evidence; retention per the SSP, not per Basis housekeeping defaults |
| Security Audit Log, table logs | File-based SAL, DBTABLOG | ISSM (scope and retention), Basis (operation) | In scope for 800-171 requirements 3.3.x; SIEM copy is the working copy |
| US-person / export status attribute | Sourced from HR (Hire-to-Retire), consumed as a provisioning gate | ECO (determination), IAM Engineer (plumbing) | Never let IT self-determine US-person status; it is a legal determination |
| Clearance status | DISS/NBIS, mirrored to HR or IGA attribute | FSO | Feeds provisioning gates for classified-adjacent systems; usually NOT stored in SAP |

**Migration objects and load sequencing** for a greenfield or re-implementation:

1. Role catalog design signed by each stream's Business Role Owner (a document, not yet a load).
2. SU24 baseline maintained so PFCG pulls correct proposals during the build.
3. Master roles built and transported through the landscape.
4. Derived roles generated per org level (company code, plant) from the masters.
5. GRC connectors configured and the customized SoD ruleset loaded and versioned.
6. SoD simulation of the full role catalog BEFORE any user assignment; fix the catalog, not the users.
7. Users created or converted, carrying US-person status, employee type, and user group attributes.
8. Role assignments loaded position by position from the HR mapping, not from legacy access dumps.
9. Mitigation assignments for the accepted residual conflicts, each with a named monitor and frequency.
10. Firefighter IDs, owners, and controllers last, once normal access is proven sufficient.

Loading users before the ruleset is live is the classic sequencing error: you inherit a conflict backlog on day one and spend cutover weekend writing mitigation fiction. The second classic error is converting legacy role assignments wholesale "to be safe," which imports ten years of access creep into a clean system.

**CUI and export-controlled data in this stream itself**: the SSP, POA&M, and assessment results are CUI. The export access roster (who is authorized to which technical data under which license/TAA) is export-sensitive and ECO-controlled. Audit logs can contain CUI-adjacent metadata (document numbers, program identifiers); treat SIEM retention accordingly. Role definitions themselves are generally not CUI but reveal the control design; do not email the full AGR_1251 dump to third parties casually.

## Security and Authorizations

This section is the security design for the security function itself, plus the cross-stream shapes this team imposes on everyone else.

**PFCG role shapes.** The house philosophy is role-per-job: single roles that mirror named positions from each stream's role map (Buyer, CAM, Billing Specialist, Production Scheduler), with derived roles carrying org-level restrictions (company code BUKRS, plant WERKS, sales org VKORG, controlling area KOKRS) generated from a master role. Rules of the road:

- One master role per position per stream; derivation handles org variance, never copies.
- Composites only to bundle a position from multiple singles (a person, not a pile); never as a dumping ground.
- Enforce a naming convention that encodes stream, position, and org scope so AGR_USERS extracts are self-explanatory to an auditor.
- Display-only variants exist for every position role, and they are treated as access-relevant for export analysis, not as free candy.
- No production role contains S_DEVELOP change access or open S_TABU_DIS; development change access exists only in development systems, controlled via S_DEVELOP, S_TRANSPRT, and system/client change options (SSCR developer keys no longer exist in S/4HANA).

For the security team itself, split the S_USER_* authorization objects across at least three role shapes: role builder (S_USER_AGR, S_USER_AUT, S_USER_PRO, no SU01), user administrator (SU01 with S_USER_GRP scoped by user group, no PFCG change), and security auditor (display-only SUIM, RSAU_READ_LOG, SCU3). User groups partition who may administer whom: security admins cannot administer their own accounts, and firefighter IDs sit in a group only the GRC Analyst's admin role reaches.

**Cross-stream toxic-pair catalog** (illustrative core; the full ruleset covers every stream):

| Toxic pair | Streams touched | Standard mitigation when split is impossible |
| --- | --- | --- |
| Vendor master maintenance (BP) + invoice entry (MIRO/FB60) | Procure-to-Pay, Record-to-Report | Independent monthly review of vendor master changes (CDHDR/CDPOS) against invoices |
| Invoice entry + payment run (F110) | Procure-to-Pay | Payment proposal approved by a second person; bank detail change report |
| PO create (ME21N) + PO release (ME28/ME29N) + goods receipt (MIGO) | Procure-to-Pay, Inventory-to-Deliver | Release strategy enforced in config; GR/IR review |
| GL master (FS00) + journal posting (FB50) | Record-to-Report | Journal entries above threshold workflow-approved |
| Time entry (CAT2) + time approval | Hire-to-Retire, all cost-collecting streams | Hard split, no mitigation accepted: labor floor-check exposure with DCAA |
| WBS/budget maintenance (CJ20N, CJ30) + cost posting/allocations | Program planning, Record-to-Report | Budget change log review by program controls |
| Results analysis execution (KKA2) + revenue-relevant master data | Record-to-Report | Close checklist with independent RA review |
| Material master (MM01) + inventory adjustment (MI07/MIGO) | Plan-to-Produce, Inventory-to-Deliver | Cycle count approval separation; MMAS criteria expect it |
| Role maintenance (PFCG) + user assignment (SU01) | Platform | Hard split within the security team; GRC workflow as compensating path |
| GRC ruleset maintenance + mitigation approval | Platform | Ruleset changes approved by internal audit or a control board |
| Firefighter ID ownership + firefighter log review | Platform | Controller must be independent of the user; enforced in EAM config |

**Auditor access design.** Build one display-only auditor role per business system domain (accounting, estimating, purchasing, MMAS, EVMS, property): display transactions only (FB03, ME23N, CJI3, KSB1, CAT3-equivalents, report transactions), S_TABU_DIS restricted to display on named authorization groups, no export-controlled objects, validity-dated to the audit window, all sessions in the Security Audit Log. Default to extract packages (standing queries delivered as files with row counts and run dates) over live access; when DCAA insists on live access, pair them with the walkthrough support person and log everything. Never hand an auditor a copied end-user role.

**Export-control specifics.** US-person gating: an attribute sourced from the ECO's determination gates assignment of any role that reaches export-controlled technical data (engineering documents in DMS, GOS attachments, material long texts, routing texts on controlled programs). Segregation strategy ladder, cheapest adequate option wins: (1) separate instance/enclave for the most restrictive programs; (2) org-level segregation (dedicated plant or company code for controlled work, derived roles keyed to it); (3) ACL/document-level control (DMS authorization, document status, program-level auth objects) where controlled and uncontrolled work share org units. Deemed export risk lives in DISPLAY access: SE16 on document tables, attachment viewers, and broad reporting roles leak technical data without a single change authorization; use Read Access Logging plus periodic ECO review of who holds display roles on controlled objects. Foreign-person contractors from offshore AMS providers are the recurring incident pattern: the provisioning gate must sit in the identity platform, before any SAP account exists.

## Analytics and Reporting

| Report | To whom | Cadence | SAP source |
| --- | --- | --- | --- |
| SoD conflict and mitigation status | CFO, audit committee, external audit, internal audit | Quarterly (monthly during remediation programs) | GRC ARA batch risk analysis against the versioned ruleset |
| Access review (UAR) completion and revocations | CISO, internal audit | Quarterly, per campaign | GRC/IAG certification campaigns or IGA tool; underlying AGR_USERS |
| Security audit log exceptions | ISSM, SOC | Weekly triage, monthly summary | RSAU_READ_LOG events shipped to SIEM |
| Privileged and firefighter access usage | Control owners, GRC Analyst, internal audit | Monthly | GRC EAM session logs with reviewer sign-off status |
| Terminated user reconciliation | IAM Engineer, HR, internal audit | Monthly | HR termination feed vs USR02 lock/validity status, with lock-event dates from user change documents (USH02/SUIM) |
| Export access roster | ECO/Empowered Official | Quarterly and on demand | AGR_USERS joined to US-person attribute and controlled-role list |
| Interface/service account inventory and least-privilege attestation | ISSM, Basis lead | Semi-annual | SM59 destinations, RFC user list, S_RFC scope review |
| Auditor access provisioning and removal log | Internal audit, DCAA/DCMA on request | Per audit | User change documents (SU01 change history), SAL |
| Role change control board minutes and transport log | Business Role Owners, internal audit | Monthly | Transport records tied to approved role change requests |

Embedded analytics vs warehouse: run operational security reporting (SUIM, GRC dashboards, SAL) inside SAP/GRC where the data lives and freshness matters. Push trend and evidence reporting (12-quarter UAR completion, conflict burn-down, firefighter usage trend) to the enterprise warehouse or the SIEM, because auditors want point-in-time snapshots that survive role and ruleset changes. Never let the only copy of evidence live in a transaction that shows current state; SUIM answers "who has it now," audits ask "who had it in March."

KPIs the client roles are measured on: percent of access reviews completed on time with non-response revoked (GRC Analyst); unmitigated high-risk SoD conflicts, target zero with a dated burn-down (GRC Analyst, Business Role Owners); terminations deprovisioned within 24 hours (IAM Engineer); firefighter logs reviewed within SLA (GRC Analyst); audit findings and repeat findings (CISO, ISSM); percent of access requests auto-provisioned through the position catalog without manual role picking (SAP Security Lead); SPRS score currency and POA&M closure rate (CISO).

## Role of AI

Concrete use cases in this stream, ordered by adoption maturity:

1. **Role mining and redesign**: correlate actual transaction usage (ST03N workload data, SAL events) against assigned role content to propose slimmer role-per-job designs and flag never-used high-risk access. Output is a proposal; the Business Role Owner decides.
2. **SoD explanation and mitigation drafting**: translate an authorization-object-level conflict into business language ("this user can both create a vendor and pay it, here is the fraud path") and draft a mitigation control description for the GRC Analyst to edit.
3. **UAR reviewer assistant**: summarize, per reviewee, what their roles actually allow in plain language, so managers stop rubber-stamping technical role names they cannot read. This measurably improves revocation rates.
4. **Firefighter log triage**: classify EAM session logs against the stated checkout reason, flag sessions where activity diverged from the reason code, and queue only the anomalies for human review.
5. **Deemed-export exposure scanning**: enumerate which users can display export-controlled objects (roles reaching DMS documents, controlled plants, material texts) and diff the result against the ECO's authorization roster.
6. **Audit evidence assembly**: compile the extract package for a DCAA or DIBCAC request (access review records, SAL excerpts, ruleset version, mitigation list) with a coverage checklist, ready for ISSM review.
7. **Access request risk summarization**: at request time, summarize the net-new risk of an approval (conflicts introduced, sensitive objects gained) for the approver.

**Compliance boundary.** A human must certify, and why:

- Access review outcomes: the named reviewer is the reviewer of record; an AI summary informs but does not discharge their attestation.
- Export authorization decisions: US-person determinations and license/TAA scope are legal determinations reserved to the ECO/Empowered Official; an AI recommendation here is an unauthorized export waiting to happen.
- Firefighter log review sign-off: the controller attests; AI only triages the queue.
- SSP/POA&M statements and the SPRS score: the CISO affirms these to the government, and a wrong affirmation carries False Claims Act exposure.
- Anything handed to DCAA or DCMA: a human ran the final query and owns the numbers.

AI never holds an approver role in GRC/IAG workflow and never has write access to the ruleset, mitigations, PFCG, or SU01.

**Grounding and auditability rules** for AI output feeding government deliverables:

- Every generated statement traces to a named system extract (table, transaction, GRC report name, run date, row count) attached alongside the output.
- Extracts are pulled by the tool from the system, never typed or pasted into a prompt by hand.
- Prompts and outputs that feed an evidence package are retained with that evidence for the same retention period.
- The model must refuse to fill gaps: "no log data for April" is the correct answer, not an interpolation.
- Business-language summaries carry the underlying technical identifiers (role names, authorization objects) so a reviewer can verify in SUIM.
- Model access itself is scoped: an AI assistant reading export-controlled rosters or CUI evidence must run inside the assessment boundary, subject to the same US-person and hosting constraints as any other system component.

## Operating Model

**Organization.** Two dominant shapes:

- Shared-services platform (the default and the recommendation): one central SAP security and GRC team serves all programs and streams, with Business Role Owners embedded in each stream as the demand-side counterpart. It keeps the ruleset, the role standard, and audit evidence in one place.
- Program-aligned matrix: large primes with hard program firewalls (special access work, competing customers on adjacent programs) add program-dedicated security administrators who execute within the central standard but hold program-specific org levels and enclave admin rights.

What never works: fully federated security where each program builds its own roles. The SoD ruleset fragments, role naming diverges, and the first enterprise-wide DCAA request takes a quarter to answer. The team typically sits in IT applications or infrastructure under the CIO, with a dotted line to the CISO for policy and to internal audit for control testing; the GRC Analyst function sometimes sits in the controller's compliance organization instead, which works fine as long as ruleset ownership is undivided.

**Service catalog to the ten value streams.** The platform team owes every operational stream the same six services, and a consultant should test each stream against this list: (1) a role set mirroring that stream's position map, current within one release of the stream's process changes; (2) SoD coverage: that stream's transactions represented in the ruleset with owner-accepted risk ratings; (3) access governance: request routing, reviews, and recertification for that stream's users; (4) export-control gating where that stream touches controlled technical data (engineering, manufacturing, and quality streams most heavily); (5) audit logging that captures that stream's compliance-relevant events; (6) auditor access and extract support when that stream's business system is reviewed. When a stream complains about security, the complaint maps to exactly one of these six, which tells you who fixes it.

**Calendar**, tied to the close, EAC, incurred cost, and audit cycles:

| Cadence | Activities |
| --- | --- |
| Monthly | Firefighter log review completion check; SAL/SIEM exception summary; termination reconciliation; role change control board (all PFCG changes reviewed and scheduled); interface account exception review; close-week freeze on role transports affecting finance |
| Quarterly | User access review campaign (staggered by stream to avoid reviewer fatigue); export access roster review with the ECO; SoD conflict report to the audit committee; privileged access review |
| Annually | Full SoD ruleset and mitigation recertification; NIST SP 800-171 self-assessment refresh and SPRS score update; SSP/POA&M revision with the ISSM; disaster recovery access test; SU25/SU24 reconciliation after upgrades; support for the incurred cost submission season (ICS due six months after fiscal year end under FAR 52.216-7, with DCAA ITGC walkthroughs following); external financial audit ITGC testing (public companies) |
| Every 3 years (plus annual affirmation) | CMMC Level 2 assessment cycle for CUI-handling contracts; leadership affirmations in between |

**Government counterparts.** The PCO (procuring contracting officer) sets contract clauses that scope the obligations; the ACO (administrative contracting officer, usually DCMA) owns business system determinations and receives adequacy findings; DCMA specialists run CPSR (purchasing), EVMS compliance reviews, and property audits, each with an access-control chapter; DCMA DIBCAC runs 800-171 medium/high assessments and, in a High assessment, will sit in front of live SAP screens; DCAA runs accounting system and incurred cost audits with ITGC walkthroughs and floor checks (labor SoD exposure). The security team's job during all of these: provision the auditor role, produce the extract package, staff the walkthrough, log everything, and deprovision on exit.

**Seams with the streams.** Hire-to-Retire owns the HR events and person attributes the lifecycle automation consumes; this team owns the automation itself. Each value stream owns its role map content; this team owns the standard, the build, and the enforcement. Trade compliance owns export determinations; this team owns their technical enforcement. Write these seams down in a RACI during the first month or they get renegotiated in every escalation.

## How a Consultant Engages This Function

**Workshop casting.** Role design workshops: run one per value stream, cast the stream's Business Role Owner (decision maker), the SAP Security Lead (standard enforcement), a super-user who does the actual job, and the GRC Analyst (live SoD simulation of every proposed role). SoD ruleset workshops: GRC Analyst, controller or compliance lead, internal audit (observer with a veto voice), Business Role Owners in rotation. Export access workshops: ECO/Empowered Official (decision maker), FSO, the engineering data owner, IAM Engineer, and the hosting/Basis lead; do not run this one without the ECO present. Boundary and hosting workshops: CISO, ISSM, Basis/hosting lead, procurement (for the operating contract terms). Lifecycle workshops: IAM Engineer, HR stream lead, FSO for the clearance feed.

**Decision ladder and sign-offs.**

| Decision | Sign-off required |
| --- | --- |
| Role standard (naming, role-per-job, derivation org levels) | SAP Security Lead plus all stream Business Role Owners; internal audit informed |
| Role content per stream | That stream's Business Role Owner |
| SoD ruleset adoption and changes | GRC Analyst proposes; controller/compliance approves; internal audit reviews |
| Residual risk acceptance / mitigation | Business Role Owner accepts; GRC Analyst validates monitor exists |
| Export access model (enclave vs org-level vs ACL) | ECO decides scope; CISO decides architecture; both sign |
| Hosting/boundary (GovCloud-class, admin nationality) | CISO and ISSM; legal review of the operating contract |
| Auditor access standard | ISSM plus internal audit |
| Firefighter scope and controllers | GRC Analyst plus affected Business Role Owner |

**Common failure modes** in this stream's implementations:

- Security starts in the realization phase after the functional design is frozen; roles get reverse-engineered from tester access, and production inherits test-shaped roles. Start role design when the stream role maps are drafted.
- Role explosion by copy: "copy Bob's role and add MIGO" repeated for five years yields thousands of near-duplicate roles nobody can review. The fix is role-per-job with derivation, plus a hard rule that copies are forbidden.
- SoD ruleset installed stock and never owned: hundreds of thousands of phantom conflicts, so the business learns to ignore the report. Customize to the client's transactions and org reality, then defend a small honest number.
- Mitigations without monitors: a mitigation record that names no report, no reviewer, and no frequency is a finding waiting for an audit.
- Display access treated as harmless: deemed export exposure and CUI leakage live in wide reporting roles and SE16. Include display in the export analysis from day one.
- Firefighter as a lifestyle: production support living in EAM sessions because the support roles were never designed. Track usage trend; design the roles.
- Auditor given a copied super-user role "just for the week," never removed. Standing auditor roles with validity dates, or extract packages.
- Lifecycle automation built against clean HR data that does not exist: contractors, dual-badged employees, and clearance holders all break the happy path. Pilot on the messy populations first.
- The ITAR question deferred to hosting "later": the enclave decision moves servers, contracts, and admin staffing; it cannot be retrofitted cheaply after go-live.

**What world class looks like.** One role catalog that reads like the org chart, where more than 90 percent of access requests auto-provision from position data with zero manual role picking. Zero unmitigated high-risk SoD conflicts, and a conflict count small enough that the CFO knows the number. Quarterly reviews that finish on time because reviewers see plain-language summaries, with non-response revocation actually executed. A DCAA or DIBCAC request answered inside two days from standing extracts, with the walkthrough person calm because the evidence is the same evidence the team already reviews monthly. Export access provably scoped: the ECO can produce, on demand, who can see which controlled technical data and under which authorization. And a role change control board boring enough that nothing about security is ever the go-live surprise.
