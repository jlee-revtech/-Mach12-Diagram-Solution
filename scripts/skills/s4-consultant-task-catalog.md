# The S/4HANA Consultant Task and Deliverable Catalog (Configuration, Documents, Data)

Cross-cutting skill for every workstream consultant agent. This is the canonical catalog
of what an SAP S/4HANA functional consultant actually PRODUCES on a US GovCon
implementation, organized into three output families: Configuration, Documents, and
Data. Use it to plan work, to check whether the team (human or agent) has full coverage
of the consultant job, and to know what evidence grounds each output. Phases follow SAP
Activate (Discover, Prepare, Explore, Realize, Deploy, Run).

## Family A: Configuration outputs

The consultant changes the system. Every configuration task has the same lifecycle:
read the current state first, design the target values, write them, verify by reading
back, capture the transport, and document the change (Family B config workbook entry).

Configuration task classes (each stream owns its slice):

1. Enterprise structure: company codes, controlling areas, plants, storage locations,
   purchasing and sales organizations, personnel areas, valuation areas. These are
   architecture decisions (export segregation, CAS segments, program vs site) executed
   as config.
2. Financial and controlling config: chart of accounts and cost elements, ledgers and
   currencies, fiscal year variants, document types and number ranges, cost center and
   profit center hierarchies, costing sheets and overhead keys, results analysis keys
   and versions, settlement profiles, payment terms and programs.
3. Value-stream process config: order types, item categories, schedule line categories,
   pricing procedures and condition types, MRP parameters, availability check,
   production scheduling profiles, quality inspection types, maintenance order types
   and task list types, asset classes and depreciation areas, project profiles and
   coding masks, timekeeping profiles (data entry profiles, field selections).
4. Cross-application config: output management (forms per document), status schemas
   and user statuses, partner determination, text determination, batch and serial
   number profiles, IUID-relevant serialization, workflow scenarios (Flexible
   Workflow), approval hierarchies and release strategies.
5. Integration config: RFC destinations and communication arrangements (design only in
   customer systems; execution is Basis work), IDoc partner profiles, API activation,
   event configuration.
6. Transport discipline: changes captured on transports with a naming convention,
   sequenced (config before master data dependencies), documented, and imported through
   the landscape on a schedule. A consultant who cannot say which transport carries
   their change is not done.

Quality bar: config is idempotent where scripted (skip or update if exists, never
duplicate), copied from a proven template where one exists (template plant, template
company code), verified by read-back after write, and every write has a config
workbook entry (object, key, values, rationale, transport, author, date).

## Family B: Document deliverables

The consultant writes things people sign. Documents divide by phase:

Explore phase:
1. Process hierarchy / BPML: the leveled process list (value stream, process group,
   process, variant) that scopes the project and anchors every later document.
2. Fit-to-standard workshop outputs: per-process workshop notes, demonstrated standard,
   decisions, and the fit or gap verdict per requirement.
3. Fit-gap register / backlog: every gap with its disposition (config, extension,
   process change, deferred) and RICEFW classification for build items.
4. Key design decisions (KDD): one document per consequential choice (for example
   project vs plant stock for contract material, ML active or not, EVMS in Dassian PPC
   vs external Cobra). Records options considered, decision, rationale, compliance
   impact, and who approved.
5. Business process design documents (BPD): per process, the to-be design: process
   flow, roles (People dimension), org units touched, master data consumed, config
   dependencies, controls, compliance notes (which FAR/DFARS/CAS requirements the
   design satisfies), reports and outputs, open items.
6. Solution architecture document: the cross-stream design record (enterprise
   structure, integration landscape, RICEFW rollup, compliance matrix, phasing).

Realize phase:
7. Functional specifications (FS) and technical specifications (TS) for every RICEFW
   item (reports, interfaces, conversions, enhancements, forms, workflow). See the
   enhancement spec-writing skill for structure and the clean-core decision ladder.
8. Configuration workbook: the running record of every config object set, per module,
   with values and rationale. This is what makes the build auditable and repeatable.
9. Authorization concept: role catalog mapped to positions (from the People
   dimension), segregation-of-duties matrix with mitigations, auditor access design,
   export-control access rules, Fiori catalog/space assignment.
10. Test documentation: test strategy, unit test scripts (per config/RICEFW item),
    string and integration test scenarios (cross-stream, end to end: quote to cash,
    procure to pay, plan to produce, hire to pay), UAT scripts in business language,
    defect log, test results with evidence screenshots or extracts.
11. Data migration documents: migration strategy, object inventory with owners,
    source-to-target mapping workbook per object, cleansing rules, mock run results
    and reconciliation reports, cutover data plan.
12. Interface specifications: per interface, the contract (trigger, payload, mapping,
    error handling, reprocessing, monitoring, volumes) and the partner-system
    agreement.
13. Training and adoption materials: role-based work instructions (transaction-level
    click paths), quick reference cards, train-the-trainer decks, day-in-the-life
    scenarios per persona.

Deploy phase:
14. Cutover plan and runbook: sequenced task list with owners, durations,
    dependencies, verification steps, and rollback points; freeze calendar;
    hypercare plan and exit criteria; go/no-go checklist with criteria.

GovCon-specific documents (the differentiator; these make a GovCon implementation
different from commercial):
15. Business system compliance matrices: per DFARS business system (accounting,
    estimating, purchasing, property, MMAS, EVMS), map each adequacy criterion to the
    SAP design element(s) that satisfy it. This is the document DCMA reviews against.
16. DCAA walkthrough package: the transaction trail demonstration (timecard through
    labor distribution through project cost through invoice) with system evidence.
17. EVMS system description alignment: how the SAP + scheduling tool design implements
    the 32 guidelines the company's system description claims.
18. MMAS system description alignment: how material costing, transfers, and inventory
    accuracy metrics are produced.
19. Incurred cost submission support design: how the ICE model schedules are fed from
    the ledger (which reports, which reconciliations).
20. Property management plan alignment: how FAR 52.245-1 record requirements map to
    asset and equipment master design.

Quality bar for all documents: traceable (every document names the process steps,
workstream, and RICEFW codes it covers), grounded (cites actual configured values and
actual client architecture, not generic SAP prose; if generated with system access,
introspect first and quote real values), versioned with an owner and approval record,
and written in the client roles' vocabulary.

## Family C: Data outputs

The consultant makes data exist. Three purposes: migration (production data), testing
(representative fixtures), demonstration (sandbox storytelling). Never mix them:
demo data has no place in a production client.

1. Master data loads, per stream (the canonical object list):
   - Finance: GL accounts, cost centers, profit centers, activity types and rates,
     statistical key figures, internal orders.
   - Projects: project definitions, WBS hierarchies (respect coding masks), networks
     and activities, milestones, budgets and plan versions.
   - Sales/contracts: customers (BP), sales contracts with CLIN/SLIN line structures,
     pricing conditions, credit data.
   - Procurement: vendors (BP), purchasing info records, source lists, contracts and
     scheduling agreements.
   - Manufacturing: materials (all views, plant-specific), BOMs, work centers,
     routings, production versions, inspection plans.
   - Logistics: storage locations and bins, batches, serial numbers, initial stock
     (with correct special stock indicators: project stock Q, sales order stock E,
     vendor consignment K, GFP as applicable).
   - Assets/property: asset masters with acquisition data, equipment masters,
     functional locations, measuring points; government property flags and IUID.
   - HR-adjacent: personnel mini-masters where CATS needs them, employee-to-cost
     assignment data.
2. Load mechanics, in order of preference: standard migration cockpit objects where
   they fit; released APIs; BAPIs wrapped in idempotent loaders with explicit commit
   discipline and batch sizing for volume; direct table writes only where the object
   has no API and the risk is understood (sandbox pattern). Always stage, validate,
   load, verify counts and spot records, and produce a reconciliation report.
3. Mock conversion cycles: at least two mock runs plus a dress rehearsal at production
   volumes, each with timed execution, error rates, and reconciliation sign-off by the
   data owner (financial balances tie out to the legacy trial balance; open items
   match; stock values match).
4. Test data fixtures: per test scenario, the minimum master and transactional data to
   execute it (a contract with billable CLINs, a project with budget, a material with
   stock, an open PO to receive). Built by the same loaders, tagged so they can be
   found and cleaned.
5. Transactional data generation for demos and training: end-to-end story data
   (contract award through billing) built through real transactions or BAPIs so
   documents flow correctly. Volume-scaled where the demo needs aging (backlog,
   WIP, open items across periods).
6. Cutover data sequencing: config transports, then foundational master data (org,
   GL, cost centers), then dependent masters (materials before BOMs before routings;
   BPs before contracts), then open transactional items (open POs, open sales orders,
   open projects with budgets, stock, open AR/AP, GL balances), each with a
   verification gate before the next wave.

## The execution discipline (how an agent or consultant performs these in SAP)

1. Read before write: introspect the live config or data area first; never assume.
2. Plan and get approval: state exactly what will be written (objects, keys, values)
   and to which client/transport, and get an explicit human approval for every write.
3. Write idempotently: skip or update when the object exists; copy from templates;
   commit once at the end; roll back on partial failure.
4. Verify: read back what was written; for data loads, reconcile counts and values.
5. Document: emit the config workbook or load log entry at write time, not later.
6. Degrade honestly: if the system is unreachable or the authorization is missing, say
   so and stop; never fabricate results or pretend a write happened.
