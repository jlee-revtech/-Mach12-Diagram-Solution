# SAP Enhancement Specification Authoring, Functional & Technical (Clean-Core Aligned)

Cross-cutting skill for every workstream consultant. When a requirement cannot be met by
standard SAP or configuration, you produce a **Functional Specification (FS)** and a
**Technical Specification (TS)** for the enhancement. This skill defines the decision
discipline, the document structure, and per-enhancement-type technical guidance, all
aligned to SAP **clean core**. Always name the process step / workstream the enhancement
supports and give a RICEFW code so it is traceable.

## Fit-to-standard first: the decision ladder

Never jump straight to custom code. Walk this ladder and record where the requirement lands
and why the higher rungs were rejected:

1. **Standard SAP**, a delivered app, transaction, or released API already does it.
2. **Configuration / customizing**, SPRO / IMG, condition technique, output management,
   BRF+ decisions, standard Flexible Workflow scenarios.
3. **Clean-core extensibility**, key-user extensibility, developer extensibility (ABAP
   Cloud / RAP), or side-by-side extensibility on SAP BTP, using **released** objects and
   extension points only.
4. **Custom development**, only when 1-3 cannot meet the requirement. Still built
   clean-core-aligned (customer namespace, released APIs, upgrade-stable), never by
   modifying SAP objects.

State the chosen rung explicitly in both the FS ("why standard doesn't fit") and the TS
("clean-core approach chosen").

## Clean core: the principles that constrain every spec

Clean core keeps the digital core standard, upgrade-stable, and cloud-ready. Apply these to
every enhancement:

- **Three-tier extensibility.** Prefer, in order: (a) **key-user / in-app** extensibility
  (custom fields & logic, custom CDS, custom business objects, adaptation projects, BRF+,
  Flexible Workflow) for simple, admin-owned changes; (b) **developer extensibility** on the
  stack with **ABAP Cloud** (RAP business objects, released CDS, Business Add-Ins that are
  released, restricted ABAP language version) for logic that must run close to the data;
  (c) **side-by-side** on **SAP BTP** (CAP/Node/Java, RAP on BTP, Fiori/React apps, iPaaS)
  for decoupled apps, heavy UIs, and integrations.
- **Released APIs and extension points only.** Consume SAP APIs published on SAP Business
  Accelerator Hub / released CDS views / released BAdIs and workflow scenarios. Do not call
  or copy unreleased objects. Cite the released API used in the TS.
- **No modifications, no core-object copies.** No changes to SAP repository objects, no
  access-key mods, no cloning of SAP code. Everything lives in the customer namespace
  (Z/Y or a registered namespace) or on BTP.
- **Upgrade stability & governance.** Assume the digital core is updated frequently. Design
  so an SAP upgrade cannot break the enhancement. Run ATC with the cloud-readiness variant.
- **Classic extensibility is a documented last resort.** Implicit/explicit enhancements,
  classic BAdIs/user-exits, customer-exit function modules, and direct-table Z development
  are only for on-prem where no clean-core path exists, and must be justified, isolated,
  and flagged as technical debt in the TS.

## RICEFW + modern enhancement taxonomy

Classify every enhancement and carry the code through FS → TS → build → test:
**R**eports, **I**nterfaces, **C**onversions, **E**nhancements, **F**orms, **W**orkflow, plus the modern additions in scope here: **custom tables / data models**, **custom OData
services**, **custom web apps (Fiori / React)**, and **integrations (iPaaS)**.

---

## Functional Specification (FS), structure

1. **Header & traceability**, title, RICEFW code, workstream / value stream, owning
   process step (link to the process-model leaf), author, status, version.
2. **Business context & objective**, the business outcome, who benefits, why it matters
   (tie to the value stream and, for A&D/GovCon, to FAR/DFARS/CAS/DCAA/EVMS/ITAR where
   relevant).
3. **Gap & fit-to-standard analysis**, what standard SAP does today, why it is insufficient,
   which rung of the decision ladder this lands on and why higher rungs were rejected.
4. **Functional requirements**, itemized, numbered, each independently testable
   (REQ-01, REQ-02 …). Separate "must / should / could".
5. **Process flow**, as-is and to-be; actors, roles, personas, and hand-offs; where the
   enhancement fires in the flow.
6. **Data**, inputs and outputs; the master and transactional objects and specific fields
   touched; sources and targets; data volumes.
7. **Business rules, calculations & determinations**, logic in business language
   (formulas, decision tables, derivations, defaulting, validations).
8. **UI / UX expectations**, screens, fields, actions, list vs object page, offline,
   mobile, accessibility, languages (if a UI is in scope).
9. **Integrations & dependencies**, upstream/downstream systems, events, other RICEFW
   items, sequencing.
10. **Security & authorizations**, roles, authorization objects, segregation-of-duties,
    data-level restrictions, export-control/clearance segregation.
11. **Non-functional**, volumes, performance/response, availability, retention, audit.
12. **Acceptance criteria**, testable pass/fail conditions mapped to each requirement.
13. **Assumptions, risks, and out-of-scope.**

## Technical Specification (TS), common structure

1. **Solution overview & clean-core approach**, the extensibility tier chosen (key-user /
   developer / side-by-side) and why; the released APIs / extension points used.
2. **Architecture**, components and layers (data → logic → service → UI → integration),
   the systems involved, and where each piece runs (S/4 stack vs BTP).
3. **Objects & governance**, every object to build with customer-namespace naming,
   package, software component, and transport / gCTS / BTP deployment target.
4. **Data model**, tables / CDS entities, semantic keys, **client field first and key on
   every custom table/CDS/table-function**, fields, data elements/domains, associations,
   value helps.
5. **Logic**, algorithms and pseudocode, determinations/validations/actions, error and
   exception handling, message classes.
6. **Services & interfaces**, API signatures, released APIs consumed, service definitions
   and bindings, contract (request/response, idempotency, paging).
7. **Security**, authorization objects and checks, CDS access control (DCL), roles
   (PFCG/IAG), BTP XSUAA scopes/role collections, principal propagation.
8. **Performance & scalability**, data volumes, indexing, pushdown to HANA (code-to-data),
   pagination, async where heavy.
9. **Transport & deployment**, transport strategy, dependencies/sequence, feature flags,
   environment promotion.
10. **Testing**, ABAP Unit / unit tests, ATC (cloud-ready variant), integration tests,
    UAT scripts, test data. Reference the workstream's test-plan approach.
11. **Monitoring & operations**, logging (Application Log / BTP logging), alerting, job
    scheduling, error queues, support runbook.
12. **Fallback / rollback**, how to disable or revert safely.

---

## Per enhancement-type technical guidance

### Custom ABAP
- **RAP-first.** Model logic as a RAP business object (managed or unmanaged), not classic
  reports/dialog programs. Use **ABAP Cloud** (the restricted, cloud-ready language version)
  and **released** APIs/CDS/BAdIs only. Prefer determinations, validations, and actions in
  a behavior pool over procedural code.
- Classic ABAP (reports, module pool, enhancement implementations, customer-exit FMs) only
  on on-prem where no clean-core path exists; isolate it, keep it in the customer namespace,
  and flag it as technical debt.
- Clean, testable code: ABAP Unit tests, ATC-clean (cloud-readiness variant), Clean ABAP
  style, message classes for errors, no `SELECT *`, no hard-coded literals.

### Custom Tables / Data Models
- Prefer, in order: **key-user custom fields** on standard objects → **custom CDS views /
  custom business objects** → a **Z DDIC transparent table** only when persistence of a
  genuinely new entity is required.
- Every custom table, CDS view exposing base data, table function, or abstract entity must
  have the **client field FIRST and marked as KEY** (client-dependent by default).
- DDIC discipline: data elements/domains (not primitive types on public interfaces),
  semantic keys, foreign keys/associations, appropriate indexes, delivery class, and
  extensibility (mark released if others extend it).

### Custom OData Connectors / Services
- **Expose:** RAP **service definition** + **service binding** as **OData V4** (UI or A2X /
  Web API). Use OData V2 only for legacy Fiori/consumers. Publish only released CDS.
- **Consume:** call SAP's **released OData APIs** (Business Accelerator Hub) rather than
  building custom extractors; wrap with SAP **API Management** for throttling, keys, and
  policies when exposed externally.
- Contract: entity sets, navigations, actions/functions, `$batch`, paging, ETags; auth via
  XSUAA / OAuth 2.0 / principal propagation; document the service path and metadata.

### Custom Workflows (Clean Core / Flexible Workflow)
- Use **in-app Flexible Workflow** (workflow scenario → steps → **BRF+** preconditions and
  responsibility/agent rules) for approvals inside S/4, or **SAP Build Process Automation**
  (SPA) on BTP for cross-system, human-plus-automation orchestration. Trigger from **RAP
  business events** where possible.
- Do **not** build classic SAP Business Workflow (WS templates / SWDD) on clean-core
  systems. Keep decision logic in BRF+ / decision tables, not hard-coded.
- Specify: trigger/event, steps and outcomes, agents/roles (from the People pillar),
  deadlines and escalation, notifications (email / SAP Task Center / Teams), and the audit
  trail.

### Custom Web Applications (Fiori / React / etc.)
- Prefer, in order: **SAP Fiori Elements** (annotation-driven List Report / Object Page /
  Overview / Analytical) → **freestyle SAPUI5** → a **React (or other) app on SAP BTP**
  (side-by-side) when the UX exceeds Fiori Elements or must run standalone.
- Consume OData V4/V2 or REST; deploy via **approuter + XSUAA**; surface through **SAP Fiori
  Launchpad / Build Work Zone**. Cover responsiveness, accessibility (a11y), i18n, and theming.
- Specify: app type, floorplan, entity/service, actions, navigation, draft handling,
  role/catalog assignment, and (for React/BTP) the runtime, CI/CD, and destination wiring.

### Integrations (iPaaS + platforms)
- **Primary: SAP Integration Suite / Cloud Integration (CPI).** Design integration flows
  (iFlows) with the right adapters (IDoc, SOAP, OData, REST/HTTP, SFTP, JMS/AMQP, Kafka,
  SuccessFactors, Ariba), message mapping, content-based routing, and exception subprocess.
  Use **API Management** for API exposure/keys/throttling and **Event Mesh / Advanced Event
  Mesh** for event-driven (pub/sub) patterns.
- **Also in scope (name the fit):** MuleSoft Anypoint, Dell Boomi, Informatica, Workato,
  Azure Logic Apps / Integration Services, and legacy **SAP PO/PI** (on-prem, being retired).
  Choose based on the customer's landscape; default to Integration Suite for SAP-centric flows.
- Specify per interface: direction (inbound/outbound), sync vs async, trigger, source→target
  mapping, transformation, **idempotency**, error handling/retry/dead-letter, monitoring,
  throughput/volume, and security (OAuth 2.0, mTLS/cert, principal propagation, IP allowlist).
  A&D/GovCon interfaces often include WAWF/iRAPT, EDI (X12/EDIFACT), DCAA/DCMA feeds, and GFP.

---

## Quality bar (self-check before you deliver a spec)
- The clean-core rung is chosen **and justified**, with released APIs/extension points cited.
- Every functional requirement has a matching, testable acceptance criterion.
- The enhancement is traceable to a workstream, a process step, and a RICEFW code.
- Security (auth objects / roles / SoD), performance/volumes, transport/deployment, and
  testing (ABAP Unit + ATC cloud-ready) are all addressed.
- Custom tables/CDS have the client field first and as key.
- Nothing modifies SAP core objects; classic extensibility, if used, is flagged as debt.
