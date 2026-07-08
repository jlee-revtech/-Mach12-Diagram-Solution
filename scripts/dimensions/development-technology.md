---
stream: development-technology
---

# Development and Technology for GovCon SAP: The Eight-Dimension Operating Profile

## People

The Development and Technology stream is the platform function: it delivers RICEFW objects, clean-core extensions, integrations, and landscape/transport management for every other value stream. It has no business process of its own; its customers are the other streams, and its regulator exposure comes through them. The roles below are the ones you will actually meet at a defense OEM prime or a Tier-2 supplier running S/4HANA.

| Role | Owns | Signs off | Day-to-day pains |
|---|---|---|---|
| CIO / IT Director | IT budget, vendor contracts, platform strategy, NIST SP 800-171 posture for the SAP estate | Architecture decisions with cost impact, cloud vs on-prem, AI tooling adoption | Flat budget vs growing RICEFW demand; audit findings landing on IT; CMMC readiness |
| Enterprise Architect | Target architecture, clean-core policy, system-of-record decisions, integration topology | Fit-to-standard exceptions, new custom object approval, buy vs build | Every program wants its own exception; legacy ECC habits imported into S/4 |
| SAP Development Lead (ABAP/RAP) | RICEFW register, coding standards, code review, developer staffing | Technical specs, ATC exemptions, namespace and naming standards | Spec churn from functional teams; heroic fixes bypassing the register |
| ABAP / RAP Developer | Individual RICEFW builds, unit tests, technical spec authorship | Nothing alone; peer review required before release | Ambiguous functional specs; being handed production incidents for code they did not write |
| Integration Architect | Interface catalog, middleware patterns, PIEE/WAWF, PLM, P6, payroll and bank interfaces | Interface contracts, error-handling and reprocessing design | Point-to-point sprawl; partners changing file layouts without notice; EDI trading-partner onboarding |
| SAP Basis Lead | Landscape health, kernel and support-pack levels, transport infrastructure (STMS), system refreshes | Refresh schedules, patch windows, performance remediations | Refresh requests colliding with test cycles; SPAU/SPDD backlog at upgrade time |
| Release / Transport Manager | Transport queue, release calendar, cutover freeze, retrofit tracking | Import into QAS and PRD, emergency transport approval | Out-of-sequence transports; "just this one hotfix" pressure during freeze |
| SAP Security and Authorizations Lead | PFCG roles, SU24 data, SoD ruleset, firefighter (emergency access) process | Role changes, production access grants, auditor access | Role creep; SoD conflicts surfacing in audit rather than in design |
| Test Automation Lead | Regression suite for compliance-critical paths, test data management | Test exit criteria per release, regression scope | Automation broken by every UI change; unscrambled data requests from testers |
| BTP Platform Owner | BTP subaccounts, Integration Suite tenants, side-by-side extension lifecycle, consumption cost | BTP service activations, destination and connectivity setup | Shadow BTP apps built outside governance; credit burn surprises |

Typical reporting lines: developers and integration architects report to the SAP Development Lead, who reports with the Basis Lead and Security Lead to the CIO/IT Director. The Enterprise Architect usually reports to the CIO directly. The Release Manager may sit in IT or in a PMO; either way they must be independent of the developers whose transports they approve. At program-aligned companies, business analysts embedded in programs raise demand, but the build organization stays central.

Who must be in the room: custom-object approval needs the Enterprise Architect, the Development Lead, and the requesting stream's process owner (never IT alone). Transport freeze decisions need the Release Manager, Basis Lead, and the billing/finance process owner because freezes are timed to invoice and close cycles. Production access exceptions need the Security Lead plus the CIO. Interface contract changes need the Integration Architect plus the external party's technical owner.

## Process

The stream runs four end-to-end processes: (1) demand-to-deploy for RICEFW objects, (2) integration lifecycle (contract, build, monitor, reprocess), (3) landscape and transport management, and (4) release and cutover management. Everything below is the GovCon-flavored version of those.

**Demand-to-deploy with RICEFW governance.** Every Report, Interface, Conversion, Enhancement, Form, and Workflow gets an ID in a RICEFW register (for example INT-042, RPT-107) at intake and keeps it through retirement. The gates, in order:

1. **Fit-to-standard challenge.** Before any custom object is approved, the requester must show why standard S/4HANA (or an already-owned add-on such as the Dassian A&D suite maintained by this team) cannot meet the need. The Enterprise Architect chairs this; "the users are used to the old screen" is not a pass.
2. **Reuse-before-build review.** The Development Lead checks the register for an existing object, CDS view, or API that already does the job. Duplicated Z-reports are the most common register pathology.
3. **Functional spec gate.** The requesting stream's process owner signs the FS. No FS signature, no build. The FS states the business rule, not the technical design.
4. **Technical spec gate.** The developer writes the TS (the developer's deliverables are documents too); the Development Lead approves it. The TS names the objects, the extension tier (see clean core below), the authorization checks, and the error handling.
5. **Build, peer review, ATC.** Code review plus a clean ABAP Test Cockpit run before release from DEV. ATC exemptions require the Development Lead's signature and an expiry date.
6. **Test and transport.** QAS import, functional sign-off, regression suite for touched compliance paths, then PRD import in sequence during a transport window.

**Engineering standards enforced at gates 4 and 5:** all objects in the registered customer namespace or Z/Y with a published naming convention; every custom table declares the client as the first field and part of the key; every custom transaction and every data-changing custom program performs explicit AUTHORITY-CHECK calls (with SU24 proposals maintained); no hardcoded company codes, plants, or other org units (use configuration tables or TVARVC-style parameters). These four rules are non-negotiable because auditors and upgrades both punish violations.

**Landscape and transport discipline.** Three-system path DEV to QAS to PRD (a project N+1 line during major programs, with a retrofit process to keep the maintenance line and project line converged, typically managed in Solution Manager ChaRM or SAP Cloud ALM). Transports carry the RICEFW ID in the description, are sequenced by the Release Manager, and import to PRD only in published windows. During cutover a transport freeze applies: only defect-fix transports approved by the cutover manager move, and the freeze calendar is agreed with finance so nothing lands mid close or mid invoice run.

**GovCon overlay.** This stream owns no FAR clause directly, but it is the control environment under every DFARS business system, so it feeds all of them:

- **DFARS 252.242-7005 (Contractor Business Systems)** and the specific systems it disciplines: accounting (DFARS 252.242-7006), estimating (DFARS 252.215-7002), MMAS (DFARS 252.242-7004), purchasing (DFARS 252.244-7001), property (DFARS 252.245-7003), and EVMS (DFARS 252.234-7002, per EIA-748). SAP custom code and interfaces are inside the boundary of these systems: an interface that drops receipts breaks MMAS criteria; a custom allocation program that diverges from the disclosed practice breaks the accounting system.
- **CAS consistency**: CAS 401 (consistency between estimating, accumulating, and reporting) and CAS 405 (unallowable cost accounting) are owned by finance, but custom reports and conversions must not create a second version of the truth. The platform control is: any custom object touching cost data traces to the FS signed by the finance process owner.
- **DFARS 252.204-7012** (Safeguarding Covered Defense Information) plus NIST SP 800-171 and the CMMC clause DFARS 252.204-7021: the SAP landscape holds CUI, so 800-171 controls (access, audit logging, media protection, incident response capability) apply to DEV and QAS as much as PRD, and the clause's own paragraph (c) obligation to rapidly report cyber incidents to DoD via DIBNet within 72 hours of discovery rides along, because the clause follows the data, not the system role.
- **FAR 52.215-2 (Audit and Records)** and **FAR 52.216-7 (Allowable Cost and Payment)**: the platform must preserve records and audit trails that support incurred cost submissions and floor checks.

**What DCAA/DCMA walk through when they audit this stream** (usually as IT general controls supporting a business system review): the change management trail (demand ticket to FS to TS to transport to PRD import, with approvals), evidence that developers cannot write to production, the emergency change log and its review signatures, interface completeness and error-handling controls (what happens to a failed WAWF submission or a dropped goods receipt), user access recertification records, and the security audit log configuration. Have the RICEFW register and transport records reconciled before they arrive; an unexplained PRD import is a finding.

**Test engineering.** Automated regression exists first for the compliance-critical paths: time capture and transfer to payroll and cost, billing and the PIEE/WAWF invoice chain, and government property transactions. Tooling is typically Tricentis Tosca (SAP resells it as Enterprise Continuous Testing) or Worksoft Certify. Test data management is a governed service: refreshes are scheduled by Basis, scrambled before release to testers (see Data), and test IDs are provisioned with production-shaped roles so authorization defects surface in QAS, not PRD.

**Documentation duties.** The stream owes three living document sets: technical specs (one per RICEFW object, updated on change), interface contracts (field mappings, error semantics, retry/reprocess rules, partner contacts, one per interface), and operations runbooks (job chains, month-end sequence, interface monitoring and recovery steps). An undocumented interface is an audit and a continuity risk at once.

## Technology and Systems

**SAP core for this stream:** ABAP and RAP (the RESTful Application Programming Model) for extensions, Core Data Services (CDS) for the view and analytics layer, SAP Gateway / OData (V2 via SEGW, V4 via RAP service definitions and bindings, activated in /IWFND/ administration) for APIs, and SAP BTP for side-by-side extensions and integration (Integration Suite for middleware, the BTP ABAP Environment for cloud ABAP, SAP Build Work Zone for launchpad). Developer tooling: ABAP Development Tools in Eclipse, abapGit for version control, ATC/Code Inspector for quality gates, and Solution Manager ChaRM or Cloud ALM for change orchestration. There are no Dassian modules in this stream, but the platform team administers the Dassian /DSN/ and /VNO/ namespace add-on for the streams that use it: applying vendor transports, regression-testing it at upgrade, and extending around it under the same RICEFW governance.

**Clean core is the operating doctrine**, expressed as a three-tier extensibility ladder that every TS must place itself on:

| Tier | What it is | When to use | Guardrails |
|---|---|---|---|
| 1. Key-user (in-app) | Custom fields and logic via the Fiori extensibility apps, no ABAP workbench | Field additions, simple validations, form/email tweaks | Fastest and safest; check it first every time |
| 2. Developer extensibility (ABAP Cloud / RAP on-stack) | Cloud-ready ABAP inside S/4, RAP business objects, CDS, released BAdIs | New apps and logic tightly coupled to S/4 data | ABAP Cloud language version; released APIs and extension points only |
| 3. Side-by-side (BTP) | Apps on BTP ABAP Environment or CAP, integrating through released APIs and events | Different lifecycle, external users, heavy UX, cross-system logic | No direct DB access to S/4; API-contract coupling only |

Classic ABAP (unreleased APIs, implicit enhancements, modifications) is the exception tier and needs an Enterprise Architect waiver with a remediation date. The payoff is upgrade-stable custom code: SPDD/SPAU effort and upgrade regression scope shrink to near zero for compliant objects, which is what makes annual patching affordable. Run the cloud-readiness ATC variants and the Custom Code Migration analysis before every upgrade to keep score.

**Surrounding non-SAP systems typically found at a GovCon A&D company, with keep/retire/integrate guidance:**

| System (real products) | Typical verdict | Notes |
|---|---|---|
| PLM: Siemens Teamcenter or PTC Windchill | Keep, integrate | Engineering BOM master; hand off EBOM to SAP MBOM with a governed change-number process; never try to move PLM into SAP |
| Scheduling: Oracle Primavera P6, sometimes MS Project Server | Keep, integrate | Bidirectional WBS/activity sync; dates and progress flow to SAP PS, cost actuals flow back |
| EVM engines: Deltek Cobra, forProject | Integrate or retire if SAP-side EVM (for example Dassian) is adopted | One EVM system of record only; two is an EVMS finding waiting to happen |
| Estimating: ProPricer | Keep, integrate | Feed rate decks from SAP; estimating system adequacy (DFARS 252.215-7002) depends on consistent rates |
| ITSM: ServiceNow or Jira Service Management | Keep | Demand intake and change tickets should link to RICEFW IDs and transports |
| ALM/DevOps: Azure DevOps, Jira, GitHub/GitLab | Keep | Pair with abapGit; the register can live here as a work-item type |
| Test automation: Tricentis Tosca, Worksoft Certify | Keep | Own the compliance-path regression suite |
| HCM/Payroll: Workday, UKG, ADP | Keep, integrate | Time and labor cost interfaces are compliance-critical (labor floor checks) |
| Banking | Integrate | Payment files and statements via Integration Suite or direct host-to-host; treasury owns content, platform owns the pipe |
| Supply-chain portals: Exostar | Keep, integrate | Common prime/supplier exchange in A&D |

**Government portals at the boundary** (the platform team owns the technical connection, the business streams own the content): PIEE, the Procurement Integrated Enterprise Environment, hosting WAWF for invoicing and receiving reports (interfaced per DFARS 252.232-7003, which mandates electronic payment requests), the GFP module for government property, and the IUID Registry; SAM.gov for entity registration data; EDA for contract documents; DIBBS for DLA solicitations at suppliers who play there. WAWF supports EDI and file-based submission as well as web entry; a prime at volume should automate invoice and receiving-report submission from SAP billing output, with the reprocess path documented in the interface contract. Government EDI more broadly (856 ship notices, 810 invoices with GovCon-specific content) runs through the same middleware with trading-partner-specific maps.

## Data

This stream's "master data" is the metadata of the platform itself. Owners are the roles named in People.

| Data object | Main SAP tables / stores | Owner |
|---|---|---|
| Custom code inventory | TADIR (object directory), REPOSRC (source), CDS/RAP artifacts (DDLS, BDEF, SRVD, SRVB) | SAP Development Lead |
| RICEFW register | Usually ALM tool (Azure DevOps/Jira); sometimes a Z-table mirror | SAP Development Lead |
| Transports and change history | E070, E071 (transport headers/objects), CTS logs | Release / Transport Manager |
| Interface catalog and configs | RFCDES (RFC destinations via SM59), SOAMANAGER config, /IWFND/ service catalog, Integration Suite artifacts | Integration Architect |
| Batch job schedule | TBTCO/TBTCP (SM37), job chains in the runbook | SAP Basis Lead |
| Number ranges for custom objects | NRIV (via SNRO) | SAP Development Lead |
| Roles and authorizations | AGR_* tables (PFCG), SU24 proposals (USOBT_C/USOBX_C) | Security and Authorizations Lead |
| Interface message logs | SAP AIF (Application Interface Framework) or middleware logs | Integration Architect |
| Test data sets | Scrambled QAS/DEV copies, synthetic data packs | Test Automation Lead |

**Migration role.** The platform team operates the migration machinery for every stream during an implementation: the SAP S/4HANA Migration Cockpit ("Migrate Your Data" app, with LTMOM for custom migration objects), plus custom conversion programs registered as RICEFW C-objects. Load sequencing is a platform deliverable even though the data content belongs to the streams: configuration and cross-client transports first, then org structure, then master data in dependency order (GL accounts and cost elements, cost centers, materials, BOMs/routings, vendors/customers or Business Partners, projects/WBS, then open transactional items: open POs, open sales orders/contracts, open AR/AP, inventory balances), then reconciliation reports, then cutover balances. Every conversion run produces a signed reconciliation (record counts and value totals against the legacy extract) because those reconciliations are the audit evidence that the accounting system conversion was controlled.

**CUI and export control.** Production data in a GovCon SAP system should be treated as containing CUI unless proven otherwise: contract numbers and pricing, CDRL content, technical parameters on material masters and documents, and anything traceable to covered defense information. Formally, what is CUI follows the contract's markings and the CUI Registry categories, not the database it sits in; blanket treatment of the production client is a deliberate conservative scoping choice because row-level CUI determination inside an ERP is rarely practical. Some of it is also export controlled under ITAR (22 CFR 120-130) or EAR: drawings and technical data attached via document management, engineering characteristics on materials for defense articles. Two hard rules follow. First, **DFARS 252.204-7012 follows the data**: a DEV or QAS client refreshed from production is in scope for NIST SP 800-171 controls the moment the copy lands, so non-production copies must be scrambled/obfuscated (SAP TDMS, EPI-USE Data Sync Manager, and Qlik Gold Client are the common tools; scramble names, pricing, bank data, and technical text; preserve referential integrity so testing still works) or the non-prod tier must be protected to the same standard. Second, export-controlled technical data restricts who may even see it: offshore or non-US-person developers and testers cannot access unscrambled copies containing ITAR data, which is usually the binding constraint on the support model, not the security tooling.

## Security and Authorizations

**PFCG role shapes for this stream.** Build roles by system tier, not by person:

- **Developer (DEV only):** full S_DEVELOP, workbench transactions, transport creation (S_TRANSPRT create/release for their own requests). No developer role exists in QAS or PRD; production systems are set not-modifiable in SE06/SCC4.
- **Developer display (QAS/PRD):** display-only workbench, ST22 dumps, SM37 job logs, read-only SE16N restricted by S_TABU_DIS authorization groups. Debug is display-only; S_DEVELOP object type DEBUG with activity 02 (debug with replace) is never granted in PRD to anyone as a standing right.
- **Basis administration:** system administration without role-maintenance rights (no PFCG/SU01 change), so Basis cannot self-provision access.
- **Security administration:** PFCG/SU01 without Basis system rights and without developer rights.
- **Release Manager:** STMS import rights in QAS/PRD (S_TRANSPRT, S_CTS_ADMI), no ability to create or change transport content.
- **Firefighter (emergency access):** a logged, time-boxed elevated ID via SAP GRC Access Control Emergency Access Management or an equivalent break-glass procedure; every use generates a session log reviewed and signed by a controller who is not the firefighter.

**Segregation-of-duties toxic pairs in the landscape:**

| Toxic pair | Risk | Mitigation |
|---|---|---|
| Develop code AND import to PRD | Untested or malicious code straight to production | Release Manager owns imports; developers have no STMS rights in PRD |
| Create transport AND approve its release | Self-approved change | Peer review plus lead approval recorded in ChaRM/Cloud ALM before release |
| Debug-with-replace in PRD AND any business role | Alter live data bypassing all application controls | Never standing; firefighter only, with session log review |
| Basis admin AND role/user administration | Self-provisioned access, invisible privilege escalation | Split Basis and Security roles; alert on SU01 events for privileged IDs |
| Table maintenance (SM30/SE16N change) in PRD AND custom code ownership | Data changes outside change control | S_TABU_DIS/S_TABU_NAM display-only in PRD; config changes travel by transport |
| Interface user credentials AND dialog logon | Service account used interactively, breaking attribution | System-type users for RFC/API accounts; restrict S_RFC to named function groups; monitor dialog logons |
| Job scheduling admin AND developer | Schedule own unreviewed program in PRD batch | S_BTCH_JOB admin separated from development; job changes via change control |

**Auditor access design.** DCAA and external auditors get a purpose-built display-only role: read access to the application areas under audit, SE16N display restricted by authorization group, SM37 log display, and read access to change documents. Security audit log (SM20 / RSAU_READ_LOG) coverage for privileged IDs is evidence auditors ask for, so configure it before they do. Never hand an auditor a copied power-user role; scope creep in auditor access is itself a finding.

**Export-control specifics.** SAP authorizations do not know nationality, so export control is enforced by construction: segregate ITAR technical data behind document-management and table authorization groups mapped to US-persons-only roles, keep identity-provider groups (Azure AD/Entra or equivalent) as the system of record for person status, and design the support model so that any path a non-US-person could follow (support tickets with attachments, debug sessions, table dumps, unscrambled refreshes) is either blocked or scrubbed. Review this jointly with the empowered official in the trade compliance office at least annually.

## Analytics and Reporting

The platform stream owes operational reporting about itself, plus the analytics infrastructure other streams build on.

| Report | To whom | Cadence | SAP source |
|---|---|---|---|
| RICEFW burndown and gate status | Program/portfolio leadership, stream leads | Weekly during projects | Register (ALM tool), reconciled to TADIR/E070 |
| Transport and change report (what moved to PRD, by whom, with approvals) | Change advisory board; internal audit | Weekly; full trail quarterly | E070/E071, ChaRM/Cloud ALM records |
| Emergency change and firefighter usage log | CIO, internal audit, DCAA IT walkthrough support | Monthly review, signed | GRC EAM session logs, security audit log |
| ATC / code quality dashboard | Development Lead, Enterprise Architect | Per release | ATC results, exemption list with expiry |
| Interface health (volumes, failures, aging unresolved errors) | Integration Architect, affected stream owners | Daily operational; monthly trend | SAP AIF or Integration Suite monitoring |
| Batch job exceptions for the close/billing job chains | Basis, finance and billing owners | Daily during close week | SM37/TBTCO plus runbook checklist |
| ITGC evidence package (access recerts, change trail, log review) | Internal audit; DCMA/DCAA on request | Quarterly assembly, annual audit | PFCG/AGR_*, E070, SM20 extracts |
| Upgrade/clean-core scorecard (classic-ABAP debt, unreleased-API usage) | CIO, Enterprise Architect | Quarterly | ATC cloud-readiness runs, Custom Code Migration app |
| BTP consumption and license position | CIO | Monthly | BTP cost reports, SAP license measurement |

**Embedded analytics vs warehouse guidance.** Operational, single-system, current-state reporting belongs in embedded analytics: CDS view entities with analytical annotations consumed in Fiori, built by this team as RPT objects under the same register. Cross-system, historical, or heavily modeled reporting (EVM trends joining P6 and SAP, rate analysis across years) belongs in the warehouse tier: SAP Datasphere or SAP Analytics Cloud, or the corporate platform (Snowflake or Azure Synapse feeding Power BI is the common A&D pattern). The platform team's rule: one governed extraction path per subject area (CDS-based extraction or approved replication), because uncontrolled side extracts become the "second set of books" that CAS 401 consistency arguments die on.

**KPIs the client roles are measured on:** transport failure/rollback rate and emergency-change percentage (Release Manager, target under roughly 5 percent emergency share), interface error rate and mean time to reprocess (Integration Architect), ATC-clean rate at release and clean-core debt trend (Development Lead), system availability and patch currency (Basis Lead), recertification completion and SoD-conflict count (Security Lead), regression pass rate and automation coverage of compliance paths (Test Automation Lead), and IT cost per user plus audit findings closed on time (CIO).

## Role of AI

Concrete, defensible uses in this stream at a GovCon contractor:

1. **Spec-to-scaffold drafting:** generate first-cut RAP business objects, CDS views, and OData service skeletons from the approved technical spec. The developer remains the author of record; generated code passes the same peer review and ATC gates as hand-written code.
2. **Legacy code explanation and remediation triage:** summarize what a 15-year-old Z-program actually does, flag unreleased-API usage, and propose the extensibility-ladder tier for its replacement, feeding the clean-core scorecard.
3. **ATC and code-review assistance:** propose fixes for findings, draft the justification text for legitimate exemptions, and pre-review pull requests for the standards in Process (namespace, client-first key, authority checks, no hardcoded org units).
4. **Test asset generation:** derive regression test cases and data variants from functional specs and interface contracts, especially for the time, billing, and property paths where coverage is a compliance posture.
5. **Interface mapping drafts:** propose field mappings between SAP structures (IDoc segments, API payloads) and partner formats (WAWF/EDI, P6, PLM BOM extracts) for the Integration Architect to verify against the contract.
6. **Documentation generation:** draft technical specs from code diffs, runbook steps from job chains, and interface contracts from middleware artifacts, closing the documentation debt this stream chronically carries.
7. **Transport risk classification:** score a release candidate by objects touched, shared-object collision with open transports, and proximity to close/billing windows, as an input (not a verdict) for the Release Manager.
8. **Incident triage copilot:** cluster dumps (ST22) and interface errors against known runbook patterns to speed diagnosis during close week.

**Compliance boundary.** AI never certifies. A human with delegated authority must certify anything that becomes a government deliverable or a representation to the government: invoices and receiving reports submitted through PIEE/WAWF (submission carries a certification of accuracy), EVM data and IPMDAR (formerly IPMR) deliverables, incurred cost submissions, and business system self-assessments. The reason is legal, not stylistic: the False Claims Act attaches liability to the person and company certifying, and "the model generated it" is not a defense. Inside the SDLC, the human gates are the ones that already exist (FS/TS approval, peer review, transport approval); AI output enters only through them, never around them.

**Grounding and auditability rules for AI feeding government deliverables:** retrieval-grounded only (approved specs, contracts, and standards as sources, with citations in the output); prompts and outputs logged and retained like other quality records so an auditor can reconstruct what the model saw; model and knowledge-base versions recorded per run; a named human reviewer recorded per artifact; and export-control routing enforced at the gateway: ITAR/CUI technical data goes only to authorized environments (Azure Government or AWS GovCloud hosted models, or on-prem inference), never to public consumer endpoints, because a prompt containing ITAR data sent to an uncontrolled endpoint is an export.

## Operating Model

**Organization.** Two dominant shapes. (a) **Shared services:** one central SAP platform organization under the CIO serving all programs; strongest transport discipline and cheapest, but programs complain about queue times. (b) **Program-aligned matrix:** central Basis, security, and release management, with developer and analyst pods dotted-lined to major programs; faster for program-funded work but needs a hard rule that pods still ship through the central register and transport path. Pure program-owned development (each program its own developers and standards) is an anti-pattern that produces namespace collisions and audit findings; consultants should name it and kill it early. In either shape, this function sits under the CIO/IT Director, peer to (not inside) the finance and operations functions it serves, with the Enterprise Architect as the bridge to business-side process owners.

**Calendar.** The platform calendar is derived from the money calendar: close, billing, EAC, incurred cost, and audit cycles set the windows.

- **Weekly:** transport window(s) to PRD on fixed days; CAB review; interface error triage.
- **Monthly:** patch window (never in close week); month-end job-chain support with the runbook open; firefighter log review; the standing rule that **billing, time, and payroll-touching changes never deploy mid invoice run or mid payroll run**: those transports wait for the post-billing window.
- **Quarterly:** release train for feature transports (bundled, regression-tested, imported in one sequenced window); BTP consumption and license review; ITGC evidence assembly; SoD ruleset review.
- **Annually:** support pack / feature pack stack upgrade with SPDD/SPAU and full compliance-path regression; DR test; user access recertification; NIST SP 800-171 self-assessment refresh with the score posted to SPRS (DFARS 252.204-7019/7020 only require a score no more than three years old, so the annual refresh is good practice rather than the clause cadence; CMMC under 252.204-7021 adds annual affirmations of continuing compliance); support for the incurred cost submission season (ICS due six months after fiscal year end under FAR 52.216-7, with IT pulling the supporting data extracts); external financial audit and any DCAA/DCMA business system walkthrough support.
- **Program-driven:** cutover freezes for go-lives; EAC cycle support when finance needs report changes frozen or fast-tracked.

**Government counterparts.** This stream rarely faces the PCO (Procuring Contracting Officer) directly; it faces the machinery around the ACO (Administrative Contracting Officer): DCMA business systems analysts and engineers who evaluate MMAS, purchasing, property, and EVMS (including how the toolchain implements EIA-748 guidelines), and DCAA auditors whose IT general controls walkthrough covers change management, access, and audit trails in the SAP landscape. The platform team's job in those encounters is to make the change trail boring: register, specs, approvals, transports, and logs that reconcile on the first pass.

## How a Consultant Engages This Function

**Workshop casting.** For RICEFW governance and clean-core policy workshops: Enterprise Architect (chair), Development Lead, Release Manager, plus one process owner per affected stream; the CIO opens and closes but does not need every session. For integration design: Integration Architect, the counterpart system owner (PLM admin, P6 scheduler, payroll analyst), and the business owner of the data. For landscape/cutover planning: Basis Lead, Release Manager, and the finance/billing owner who controls the freeze-sensitive dates. Never run a fit-to-standard challenge without the business process owner in the room; IT cannot waive a business requirement, and business cannot waive an architecture standard.

**Decision-to-signoff ladder:**

| Decision | Required sign-offs |
|---|---|
| New custom object (any RICEFW) | Process owner (FS) + Enterprise Architect (fit-to-standard) + Development Lead (TS) |
| Classic-ABAP / unreleased-API exception | Enterprise Architect waiver with remediation date |
| Interface contract (new or changed) | Integration Architect + both system owners + affected process owner |
| Transport freeze dates | Release Manager + Basis Lead + finance/billing owner |
| Production access exception | Security Lead + CIO; time-boxed, logged |
| Non-prod refresh and scrambling scope | Basis Lead + Security Lead + data owners; trade compliance if ITAR data present |
| AI tooling for development | CIO + Security Lead + trade compliance (endpoint authorization) |

**Common failure modes of implementations in this stream:**

- **RICEFW explosion:** no fit-to-standard teeth, so the register hits hundreds of objects and the upgrade path dies. Countermeasure: publish the count weekly to steering; make every approval name its tier on the extensibility ladder.
- **Clean-core theater:** the policy deck says clean core while developers ship implicit enhancements because deadlines. Countermeasure: ATC gates in the transport path, not in a slide.
- **Transport chaos:** out-of-sequence imports, QAS drift from PRD, "hotfix culture." Countermeasure: one Release Manager with real authority, ToC-based testing, retrofit tracked to zero weekly.
- **Billing change deployed mid invoice run:** the single most memorable self-inflicted wound; a pricing or output change lands while WAWF submissions are mid-cycle and the month's invoices need rework. Countermeasure: the calendar rule above, enforced by the import schedule itself.
- **Unscrambled CUI in test:** a production refresh lands in QAS, offshore testers log in, and the company has a 7012 problem nobody scoped. Countermeasure: scrambling is part of the refresh runbook, not a follow-up task.
- **Interface error backlog as silent debt:** thousands of unreprocessed AIF/middleware errors mean the books and the portals disagree. Countermeasure: aging-based SLA with stream owners accountable for content errors, platform for transport errors.
- **Documentation deferred to hypercare:** specs and runbooks promised "after go-live" never arrive; the first DCAA walkthrough goes badly. Countermeasure: document completeness is a gate exit criterion, and the developer's deliverables are documents too.

**What world class looks like:** a single RICEFW register that reconciles to TADIR and E070 with zero orphans; custom code that is upgrade-stable enough that annual stack upgrades take a regression cycle, not a project; a transport path where the emergency share stays in single-digit percentages and every emergency has a reviewed log; compliance-path regression (time, billing, property) automated and green before every import window; interface monitoring where the oldest unresolved error is days old, not months; non-production environments that are scrambled by default and provably 800-171-clean; and an audit posture where a DCAA IT walkthrough is a half-day of pulling already-assembled evidence. When this stream is world class, every other stream's business system audit gets easier, which is the entire point of the platform function.
