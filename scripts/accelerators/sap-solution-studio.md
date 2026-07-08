---
name: SAP Solution Studio
description: Five-pillar SAP execution cockpit (Data, Process, People/Security, Technology, Agents) with 13 configuration agents, approval-token gated apply, read-only classrun introspection, an API-first data loader, and cross-system transport conflict analysis.
workstreams: record-to-report, plan-to-perform, design-to-release, plan-to-produce, inventory-to-deliver, acquire-to-retire, sustainment-mro, source-to-pay, offer-to-cash, hire-to-retire, security-authorization, analytics-reporting, development-technology
license: internal
---

# SAP Solution Studio

## What It Does

SAP Solution Studio (repo `cds-lineage-explorer`) is the execution half of the Super Consultant Agents platform. Where Solution Architecture Studio designs the target, Solution Studio connects to the real system, introspects it, plans the work, and, under a human approval gate, does the work.

**Data** (`/data`). Sources, ingestion, conversion, quality, test fixtures, egress, analysis. The loader moves master and transactional data through released SAP APIs only (OData V2/V4 batch, SOAP for journal entries). The path is plan (AI-ranked candidate entities with dependencies) to stage to simulate (duplicate probe and readiness) to load to rollback (catalog-driven). All load state persists, so a run is restart-safe. A second track connects to a legacy ECC system through a tiered adapter (ADT, a Z extractor, or table read) and runs a brownfield assessment: config discovery, guardrailed data assessment, custom-code deep read, and a simplification catalog, on a durable checkpointed job runner.

**Process** (`/process`). Blueprints, workflows, transactions, documentation, a demo/scenario runner, plus custom RAP workflow development and Flexible Workflow.

**People / Security** (`/people`). Roles, authorizations, org, security review. These pages are placeholders today. The capability behind them, working name Tesseract Guard, is a written master plan: ABAC for S/4 (row visibility through CDS DCL, field masking, action blocking, with a PAP/PIP/PDP/PEP split) plus an access-governance replacement (requests, provisioning, SoD, firefighter, recertification), GovCon and ITAR first. Be honest: the need-to-know proof of concept is live-verified, taking a user from 13,698 visible WBS to zero by default and then to five by grant. The rest is plan.

**Technology** (`/technology`). CDS lineage graph, CDS analyzer, ABAP explorer, Fiori Studio, tech specs, transports, transport landscape, delivery cockpit, chat.

**Agents** (`/agents`). The Agent Configurator: an orchestrator console over 13 configuration agents whose codes match the canonical workstream taxonomy exactly. Each agent carries a **configuration checklist** (the standard customizing sequence for its stream) and a **standalone activity catalog** (configuration, master-data, and data-staging activities with typed input schemas, where enumerated fields are validated dropdowns, never free text).

Three run modes. **Plan** is a dry run streamed over SSE. **Run** walks the checklist. **Apply** writes to the connected SAP client, only through an executor. Executors come from one factory and are idempotent (skip if exists), copy from a template where needed, roll back a failed insert, commit only at the end, and are syntax-checked before activation so a wrong field name fails safe with no write. `prepare()` is pure and builds the exact ABAP or released-API request for approval; `execute()` rebuilds it from the same inputs and never trusts client-sent code. Apply is gated by an orchestrator approval and, for remote callers, by a signed expiring token bound to the activity key and a hash of the inputs.

Field auto-suggest queries existing configuration through a read-only classrun. With no SAP connection and no transport, apply and suggest degrade with an honest message; they do not fabricate. An execution-provider seam selects the write target: `classrun` (generate, activate, run: the development path) or `released-api` (the clean-core path that deploys nothing). If an activity has no released-API mapping and the target is released-api, the agent refuses rather than faking it.

**Transport Landscape** models a multi-track topology as a graph, connects to each system through a per-system client registry (credentials in memory only, never persisted), and runs cross-system merge-conflict analysis in consolidation or retrofit mode. Per conflict: object overlap, severity by object type, sequence and overtaker assessment, where-used impact, and a retrofit status that survives re-runs. If a required system has no live client it returns a 409 and analyzes nothing.

## When To Position It

Position it for a brownfield ECC to S/4 assessment that needs facts rather than a questionnaire; when data migration is the schedule risk and "we cannot restart the load" is the objection; when the landscape has parallel project tracks and retrofit is done by memory; when the client wants AI in configuration but their security team will not tolerate an agent with write access; when CDS lineage or custom-code where-used is opaque.

Do NOT position it when:

- The client expects a supported product with a support contract. This is an internal accelerator.
- The client wants access governance today. The People pages are placeholders. Sell the proof of concept and the plan, or sell nothing.
- The client will not grant SAP connectivity. Without a live client, every honest surface degrades to a message.
- Someone wants an autonomous agent that configures SAP unattended. That is not what this is and we will not build it.

## How It Fits The SAP Design

Touches all thirteen streams by construction.

Replaces: the configuration rationale spreadsheet; the manual transport retrofit review; the legacy data-load estate; the custom-code inventory that was true once.

Augments: ADT and Eclipse remain the developer's tools, Cloud ALM remains the program's tool. This is the consultant's instrument between the design and the transaction.

Standard-SAP alternative: SAP Readiness Check and Custom Code Migration for assessment; the Migration Cockpit for data; ChaRM for transports; Fiori configuration apps. The accelerator wins on (1) restart-safe, rollback-capable, released-API-only loads with an AI plan step, (2) cross-system conflict analysis across parallel tracks, which ChaRM does not do, (3) the agent layer, which composes a plan with real transaction codes and prerequisites from curated knowledge bundles, (4) the approval-token gate, which makes AI-assisted configuration defensible to a security review. It does not win on transport execution and release management.

## Integration Points

In: everything through ADT and the SAP gateway. CDS metadata and dependencies, ABAP source, transport contents parsed from XML, where-used lists, configuration read through read-only classruns, released OData catalogs, and legacy ECC content through the tiered adapter.

Out: generated ABAP classes and configuration inserts (only after approval), released-API request bodies, staged and loaded business data, generated policy artifacts (see the Policy Compiler accelerator), Fiori scaffolds, and BSP deployments (see the Delivery Cockpit accelerator).

Auth: per-system SAP clients created at connect time, credentials in memory only; connection metadata persisted, secrets never. The realization endpoint is protected by a shared secret and, per call, by an approval token: an HMAC over the activity key, a hash of the canonical inputs, and an expiry. The token is opaque to the caller.

Deployment: Next.js plus React on Cloud Foundry, with Postgres for run history, plans, saved activities, transport landscapes, analyses, conflicts, and data-load state.

## SAP-Side Objects

| Object | Type | Purpose |
|---|---|---|
| `ZCL_M12_AGENT_QUERY` | ABAP class (classrun) | Read-only configuration lookups behind Suggest-from-S/4: company code, controlling area, chart of accounts, plant, factory calendar, MRP controller, work center, storage location, order type, cost center |
| Generated `ZCL_*` apply classes | ABAP classes (transient) | Built by `prepare()`, syntax-checked, activated, run once by `execute()`, containing exactly the approved insert or BAPI call |
| T001W / T001K / T001L | Standard tables | Plant, valuation area, storage location, written by their executors |
| SKA1 / SKB1 / SKAT | Standard tables | G/L chart, company-code segment, texts, written by the create-GL executor by mirroring a template account |
| CSKS / CSKT | Standard tables | Cost center master and texts |
| `BAPI_MATERIAL_SAVEDATA` | Standard BAPI | Material master maintain; MRP type, lot size, and MRP controller are mandatory |
| `API_PRODUCT_SRV` | Released OData API | The clean-core alternative target for material master, deep-inserting description plus plant and MRP |
| Plan-to-Produce BAPIs | Standard BAPIs | BOM, routing, purchasing info record, MRP run, production order create/change/confirm/TECO, goods movements, inspection usage decision |
| Transport header and object-list services | Standard | Read for the landscape conflict engine, with ADT where-used for impact |
| Released OData V2/V4 catalogs | Standard | The only sanctioned load path for master and transactional data |

## Demo Path

1. Context Selector. Pick the SAP system before any pillar opens. The tool refuses to pretend it is connected.
2. Technology, CDS Lineage. Load a custom analytical view and walk its dependency graph to the tables. Lineage is discovered, not documented.
3. Data, Analysis. Run config discovery and a custom-code deep read against the legacy system. Brownfield scope becomes evidence.
4. Data, Ingestion. Plan a load, stage, simulate, load, then roll it back. Restart-safe, reversible, released APIs only.
5. Agents console. Thirteen agents, readiness state, each with a checklist and an activity catalog. Enterprise customizing, as data.
6. Open the plan-to-perform agent and type an action. The LLM composes an ordered plan with prerequisites and real transaction codes referencing catalog activity keys.
7. Open the create-plant activity. Every enumerated field is a dropdown; click Suggest and real values arrive from the connected system. The agent reads before it writes.
8. Prepare write. The exact ABAP appears with its approval token. Switch the execution target to released-api on a mapped activity and the OData request body appears instead. Clean core when required.
9. Approve and Execute. Generated, syntax-checked, activated, run. The row appears in SAP. Run it again: idempotent hit, no duplicate.
10. Transport Landscape. Model a support track and two project tracks, connect the systems, run a retrofit analysis. Overlap, severity, overtaker risk, where-used impact. Acknowledge one conflict, re-run, and the status persists.

## Positioning Notes

To a CFO: the two line items that blow up an S/4 budget are data migration rework and retrofit. This makes the load restart-safe and reversible and makes cross-track conflicts visible before they reach production. It adds no license.

To a program manager: every configuration the agent proposes shows the exact object it will write before it writes it. Every apply is idempotent, and every run logs the plan, the inputs, and the outcome. Your audit trail is a table, not a screenshot folder.

To a CIO: no agent has standing write access. Apply requires human approval, and any remote caller must present a signed token bound to a hash of the exact previewed inputs. Executors rebuild the code from the inputs and never trust what the client sent. On a productive system you set the execution target to released-api and nothing is deployed.

Discriminator vs Deltek Costpoint: no overlap.

Discriminator vs Cognitus: Cognitus staffs the configuration. This industrializes it: the checklist, the executor, the idempotency, the approval gate, the audit row. They bill days; we bill an accelerator plus fewer days.

Discriminator vs Dassian standalone: no overlap. The knowledge layer carries Dassian contract, cost, project, and results-analysis skill bundles, so the agents speak Dassian where the client owns it.

Discriminator vs a generic AI coding assistant on ADT: an assistant writes ABAP into an editor. This composes a plan from a curated catalog, validates enumerated inputs against the live system, previews the exact write, and requires a signed human approval. That difference is the entire security review.
