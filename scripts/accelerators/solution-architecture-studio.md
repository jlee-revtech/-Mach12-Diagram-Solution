---
name: Solution Architecture Studio (with Process Studio)
description: AI-native architecture workbench: data-flow diagramming, SIPOC and capability maps, BPMN process modeling over an A&D reference library, live SAP enterprise data model, agent-facilitated workshops, a shared knowledge repository, and 13 workstream agents.
workstreams: record-to-report, plan-to-perform, design-to-release, plan-to-produce, inventory-to-deliver, acquire-to-retire, sustainment-mro, source-to-pay, offer-to-cash, hire-to-retire, security-authorization, analytics-reporting, development-technology
license: internal
---

# Solution Architecture Studio (with Process Studio)

## What It Does

Solution Architecture Studio (repo `diagram-app`) is where an SAP transformation gets designed before anyone touches a transaction. It is the process, data, and persona companion to SAP Solution Studio, which holds the configuration and execution side. Together they give the 13 workstream agents one brain.

**Data Architecture.** Multi-tenant collaborative data-flow diagrams with labeled data elements on the arrows and bi-directional flows, contextualized by business process. A Bedrock Systems catalog (logical platform categories plus assigned physical products) feeds an AI generator that maps inter-system flows for each BPML process at temperature zero, grounded only in catalog slugs, laid out in workstream bands with orthogonal routing.

**SAP Enterprise Data Model** (`/data/sap-model`). A live pull of the connected S/4 org structure (controlling area, chart of accounts, company codes, profit and cost centers, plants, valuation areas, storage locations, sales and purchasing orgs, projects and WBS) in three views: Enterprise Schema (entity types, each assignment edge labeled with the config object behind it), Live Configuration (the real instance tree), and Configuration Report. Every aggregate node drills into actual values; the profit-center drill renders the standard hierarchy from the set tables. Real data, not mock.

**Capability Maps.** SIPOC maps at L1/L2/L3 with supplier, input, output, customer context, workstream tags on the L3s, review status (Done / WIP / Not Started), and an Excel export carrying Workstream and Status columns. Separately, Bedrock capability maps assign capabilities to logical or physical systems, with a board grouped by value stream and a pivot sliceable by stream or system.

**Process Studio.** A navigable value-chain hierarchy (L1 Scenario, L2 Group, L3 Process) whose leaves carry real BPMN swimlane graphs, backed by a global A&D reference library: 14 L1 streams, 97 L2 groups, 297 L3 processes, plus overlays, every stream carrying a Master Data and an Analytics group. Orgs instantiate an editable copy. Features: SIPOC L3 linkage, scaffolding a data-architecture diagram from the lanes, A&D compliance overlays (CAS, DCAA, EVMS, FAR, DFARS, CMMC, ITAR), AI generation and gap assessment, and exports (executive SVG, BPMN 2.0, playbook as xlsx/pdf/pptx). A test-plan generator turns a BPMN leaf into an executable SIT/UAT script: each step is deterministically classified as standard SAP, add-on, custom, non-SAP, or manual from its Fiori tile, module, transaction, and RICEFW metadata, then AI writes the cases, exported to xlsx or Word.

**Workshops and Agents.** Agent-facilitated sessions in three acts: Prep (a brief with agenda, a pre-read of the real model, gaps, questions), Live (facilitator drives the agenda, live voice transcription, a scribe extracts captures, specialists pulled by focus), Wrap (recap, apply confirmed changes, next steps). An applied architecture change writes a real, reversible overlay onto the workstream's process model. Recap exports to DOCX and PPTX from one normalized slide model, so deck and walkthrough never drift.

Underneath: the shared Knowledge Repository (`kb_sources`, `kb_chunks` with a 1024-dimension vector column, `kb_workstream_catalog`, `kb_workstream_agents`), voyage-3 embeddings with a lexical fallback when no key is set, and 13 workstream consultant agents plus an enterprise orchestrator that delegates to them over SSE using read-only tools against the org's live model plus RAG.

## When To Position It

Position it when the client is starting an S/4 program and needs a blueprint that survives contact with the SI; when nobody can state the L2 processes; when the client cannot draw their own SAP org structure; when workshops produce a photo of a whiteboard; when test scripts must derive from process design; and whenever we are selling the workstream agents, because this is where a consultant sees them reason over the customer's real model.

Do NOT position it when:

- The client wants a drawing tool. Visio and Lucidchart win that framing. Sell the model, the reference library, and the agents.
- The engagement is a narrow configuration change with no design phase.
- Process content is already governed in Signavio or ARIS with no appetite to move. Integrate at the BPMN export boundary instead.
- Real-time collaboration is the requirement. Collaboration is presence-only with last-write-wins on save. Do not oversell it.

## How It Fits The SAP Design

Touches all thirteen streams. The workstream catalog here is the canonical taxonomy, and its codes must match the SAP Solution Studio agent registry exactly: ten value streams plus three cross-cutting platform streams.

Replaces: the Visio process pack; the Excel BPML; the architecture slide that is stale on delivery; the whiteboard workshop; the test-script authoring week.

Augments: SAP Signavio and Cloud ALM. Signavio holds governed process content for a licensed enterprise; this holds the A&D reference library, the SIPOC and capability layers, and the agents. It exports BPMN 2.0, so it hands off cleanly.

Standard-SAP alternative: Signavio plus Best Practices Explorer plus Cloud ALM test management. The accelerator wins on (1) A&D and GovCon reference content SAP Best Practices does not carry, (2) the live enterprise data model drawn from the client's own configuration, (3) agents grounded in that model, (4) workshop facilitation and recap as a product feature. It does not win on governed process publication, process mining, or enterprise process ownership workflows.

## Integration Points

In: the live S/4 org structure via read-only classruns emitting JSON; the global process reference library; capability catalogs and Excel imports; customer documents uploaded to the knowledge repository; vibe-skill knowledge bundles imported from SAP Solution Studio; workshop transcripts from browser speech recognition or a streaming cloud provider authenticated by a short-lived server-minted token.

Out: BPMN 2.0; executive SVG; playbook workbooks and decks; test plans as xlsx and Word; workshop recaps as DOCX and PPTX; capability workbooks; reversible process overlays; agent recommendations as cards with citations.

The SAP-realization seam: agents can prepare a configuration write through SAP Solution Studio's realization endpoint. That call is gated by a signed approval token bound to the activity key and a hash of the previewed inputs, with a short expiry. This app carries the token back verbatim and never holds the signing secret, so prepare-before-execute plus human approval is enforced cryptographically, not by prompt.

Auth: organization-based multi-tenancy, per-diagram permissions, RLS scoped through the parent org. Knowledge writes use a server-held service key; agent reads use the user's JWT so the agent sees exactly what the user may see.

Deployment: Next.js plus React, Supabase (Postgres, Auth, RLS, pgvector), a Yjs presence server, on Vercel.

## SAP-Side Objects

Read-only by design. Nothing here writes configuration; writes go through SAP Solution Studio's gated realization path.

| Object | Type | Purpose |
|---|---|---|
| `ZCL_M12_ORG_MODEL_DUMP` | ABAP class (classrun) | Reads the org-structure tables and emits the enterprise data model as JSON |
| `ZCL_M12_PC_HIER_DUMP` | ABAP class (classrun) | Reads the profit-center standard hierarchy from the set tables and emits a tree |
| `ZCL_M12_AGENT_QUERY` | ABAP class (classrun) | Read-only config lookups (company code, controlling area, chart of accounts, plant, factory calendar) |
| TKA01 / TKA02 / T001 / T004T | Standard tables | Controlling area, company-code assignment, company codes, chart-of-accounts texts |
| CEPC / CEPC_BUKRS / CSKS | Standard tables | Profit centers, their company-code assignment, cost centers |
| T001W / T001K / T001L / TVKO / T024E | Standard tables | Plants, valuation areas, storage locations, sales orgs, purchasing orgs |
| PROJ / PRPS | Standard tables | Project definitions and WBS, including the Results Analysis key that marks the revenue-recognition boundary |

## Demo Path

1. Data Architecture. A data-flow diagram with labeled data elements on the arrows. The arrows carry the payload, which is what integration architects argue about.
2. SAP Enterprise Data Model, Live Configuration. Drill a company code into its profit centers, then into the standard hierarchy. This is your system, read live.
3. Enterprise Schema. Each assignment edge is labeled with the config object that creates it. The diagram is the configuration, not a picture of it.
4. Process Studio, Library. Fourteen value streams, each with Master Data and Analytics groups. Instantiate one. You start from an A&D-grade baseline.
5. Open an L3 leaf. A BPMN swimlane graph with lanes mapped to systems and steps tagged standard, add-on, custom, or non-SAP. Run Gap Assessment. Fit-to-standard now has evidence.
6. Create Test Plan from the same leaf. Classified steps, generated test cases with preconditions, data, actions, expected results, exported to Word. SIT scripts fall out of design.
7. Capability Map. L3 capabilities tagged to value streams with Done/WIP badges, then a pivot sliced by physical system. Export the workbook. Scope is now data.
8. Bedrock, Generate Integrations. Regenerate the integration diagram from the BPML with workstream bands and orthogonal connectors. Architecture is derived from process, deterministically.
9. Workstreams. Ask the record-to-report agent a real question. It calls read-only tools against live org data and cites knowledge sources. Grounded, not fluent.
10. Workshops. The brief generated from the real model, then the Room. Confirm one architecture change, apply it as a reversible overlay, export the recap deck.

## Positioning Notes

To a CFO: design rework is the most expensive line in an S/4 program and it is invisible until UAT. This makes the design an object that can be reviewed, tagged, tested, and audited, and the test scripts come from the design, so testing starts with content.

To a program manager: workshops end with confirmed decisions applied to the model and a recap deck, before the room clears. Nobody spends the next week transcribing whiteboard photos.

To a CIO: read-only, three classrun classes, no writes, no transport required to see value. The agents run on your live model with your user's permissions. When they want to write configuration, that goes through SAP Solution Studio, gated by a signed approval token and a human click.

Discriminator vs Deltek Costpoint: no overlap. Do not raise it.

Discriminator vs Cognitus: Cognitus configures. This is what you use to decide what to configure, then to prove it was configured correctly.

Discriminator vs Dassian standalone: no overlap. The reference library and workstream catalog already carry Dassian module expertise per stream, so the agents speak Dassian where the client owns it.

Discriminator vs Signavio, LeanIX, ARIS: those are governance platforms priced and staffed as governance platforms. This is a consultant's instrument: pre-loaded with A&D content, reading the client's live configuration, with agents attached. If the client owns Signavio, do not fight it. Export BPMN and win on the reference library, the enterprise data model, and the workshop.
