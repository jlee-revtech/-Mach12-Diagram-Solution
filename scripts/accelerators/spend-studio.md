---
name: Spend Studio
description: Spend analytics and procurement intelligence accelerator over SAP internal orders and WBS: budget control, campaign planning, AI-drafted purchase requisitions from an approved plan, invoice extraction, and coding-block remediation.
workstreams: source-to-pay, record-to-report, analytics-reporting
license: internal
---

# Spend Studio

## What It Does

Spend Studio (repo `spend-studio`, DB prefix `sc_`) is a modern spend-management workspace sitting on SAP S/4HANA cost objects (internal orders and WBS elements). It replaces a legacy commitment-and-spend bolt-on and targets the gap on nearly every source-to-pay assessment: the ERP holds the data, users cannot see or act on it, and a shadow spreadsheet estate grows around it.

| Surface | What it holds |
|---|---|
| Home | AI narrative over the spend position, KPI tiles, action queue |
| Budgets | Budget headers and lines against internal orders and WBS, audit trail, shifts between lines |
| Campaign plan | The vehicle-by-period planning grid where most spend is committed, with an AI-assisted build |
| POs and approvals | PO and PO line management with the approval chain resident in the app; the external approval-network round trip collapses into one server action |
| Invoices | Non-PO and PO capture, AI extraction from scanned images, coding-block error remediation |
| Vendors, Reports, Admin | Vendor data; natural-language reporting; GL accounts, cost-object catalog, reference data |

Verified schema: `sc_lob`, `sc_title`, `sc_internal_order`, `sc_wbs_element`, `sc_gl_account`, `sc_vendor`, `sc_budget`, `sc_budget_line`, `sc_budget_audit`, `sc_budget_shift`, `sc_media_plan`, `sc_media_cell`, `sc_po`, `sc_po_line`, `sc_po_approval`, `sc_invoice`, `sc_invoice_line`, `sc_io_rollup`, `sc_ai_audit`.

The AI is not decoration: narrative variance explanation, paste-an-email PO drafting, invoice extraction, coding-block fixes, and natural-language reporting. Every model call is written to `sc_ai_audit`.

Honest status: this is a prototype scaffold. Shell, design system, primitives, schema, seed, and the AI copilot route are built; workspace pages are route stubs at varying depth. The SAP adapter has two implementations behind one interface, a deterministic mock and a live provider chosen by a header mode switch. The live write path is specified in `docs/SAP_INTEGRATION.md`; the read views and wrapper function modules are named there but not all deployed. Do not demo live writes without checking the sandbox first.

## When To Position It

Position it when the client has a spend or commitment application bolted onto SAP whose requirements, read carefully, are almost all standard in SAP or the procurement network, and the real gap is user experience, planning velocity, and reporting access. Also when campaign or program spend is planned on a grid and then hand-keyed as requisitions over days; when budget owners cannot see commitment plus actual without a report request; when invoice coding blocks fail on entry and the correction loop is a helpdesk ticket; and when a Source-to-Pay assessment needs a tangible artifact rather than a slide.

Do NOT position it when:

- The client needs sourcing, supplier lifecycle management, or contract negotiation. That is Ariba territory and Spend Studio deliberately does not compete.
- The requirement is procurement analytics across many ERPs. This is transactional plus planning, not a warehouse.
- There is no internal-order or WBS discipline. Without a coherent cost object the budget and rollup models have nothing to hang on.
- Procurement demands a certified, supported product with an SLA. This is an accelerator and a prototype. Say so early, in writing.

## How It Fits The SAP Design

Touches Source-to-Pay (primary), Record-to-Report (budget vs commitment vs actual, coding-block correctness), Analytics.

Replaces: the legacy spend bolt-on; the planning spreadsheet; the manual requisition entry cycle; the scanned-invoice retrieval portal.

Augments: SAP stays the system of record for the internal order, WBS, requisition, purchase order, and invoice document. Commitments come from the CO commitment tables, actuals from the universal journal. The approval network keeps its policy; Spend Studio surfaces and triggers.

Standard-SAP alternative: Fiori Manage Purchase Requisitions, Manage Budgets, and Supplier Invoice, plus Ariba Guided Buying. The accelerator wins on (1) the planning grid, which has no SAP equivalent and is where the spend decision is actually made, (2) generating a batch of requisitions from an approved plan in one action, (3) AI extraction and coding-block remediation at the point of entry, (4) narrative reporting for budget owners who will never learn a Fiori filter bar. It does not win on purchasing document logic, release strategies, three-way match, or payment.

## Integration Points

In (OData V4 reads over projection CDS views): internal order master and status; WBS elements with the billing-element flag; an internal-order rollup joining the order header to commitment and actual values. The adapter performs the standard CSRF fetch and session handling.

Out (RFC-wrapped BAPI writes): requisition create, non-PO invoice post, internal-order budget update, and PO line close. Each write is wrapped in a Z RFC-enabled function module that calls the BAPI in its own work process, issues an explicit commit with wait, and returns the new key plus a structured error list. This is the required pattern for BAPIs that internally use update-task when called from outside the ABAP stack.

Status sync: production would use Event Mesh or an IDoc. The prototype exposes one inbound endpoint accepting a voucher number and a status transition (blocked, released, paid, reversed).

Mocked boundaries, stated plainly: the external approval network, the identity provider, and the scanned-invoice archive. Identity is Supabase Auth; invoice images are Supabase Storage objects.

Auth: Supabase Auth with row-level security. The SAP adapter holds credentials server-side and is selected per request, never from the browser.

Deployment: Next.js plus React, Tailwind, TanStack Query and Table, Recharts, on Vercel; Supabase for Postgres, Auth, RLS, Storage, and Edge Functions.

## SAP-Side Objects

Three read views and four write wrappers. Objects are described functionally where sandbox deployment is not confirmed.

| Object | Type | Purpose |
|---|---|---|
| Internal order projection view | CDS view + OData V4 binding | Marketing and program internal orders filtered from the order master, with status |
| WBS element projection view | CDS view + OData V4 binding | WBS elements with the billing-element indicator, for cost-object selection |
| Internal-order rollup view | CDS view + OData V4 binding | Order header joined to CO commitment and actual values: the budget-versus-spend number |
| PR create wrapper | RFC function module | Wraps `BAPI_REQUISITION_CREATE` plus explicit commit; returns the requisition number |
| Non-PO invoice wrapper | RFC function module | Wraps `BAPI_INCOMINGINVOICE_CREATE` plus explicit commit |
| IO budget wrapper | RFC function module | Updates internal-order budget |
| PO close wrapper | RFC function module | Wraps `BAPI_PO_CHANGE` to set delivery complete and final invoice on a line |
| AUFK / COSP / COOI / PRPS | Standard tables | Order master, cost totals, open commitments, WBS master, behind the read views |

## Demo Path

1. Home. Read the AI narrative: where spend stands, what changed, what needs attention. A budget owner gets an answer before asking a question.
2. Budgets. Budget, commitment, and actual side by side from the internal-order rollup. One number, one source.
3. Budget shift. Move funds between lines; show the audit row. Reallocation is governed, not an email.
4. Campaign plan. Add cells across vehicles and periods. This is where the money is committed, and it has never lived in SAP.
5. Ask the copilot to draft the plan from a pasted brief. The AI drafts, the human commits, and every call is audited.
6. Switch the header to Live S/4 and click Generate POs. Requisitions are created against the real internal order with the correct GL coding, numbers streaming back as toasts. A multi-day cycle collapses to seconds.
7. Approvals. Approve a purchase order; the release action fires to SAP. The approval round trip disappears from the user's view.
8. Invoices. Upload a scanned invoice; AI extracts vendor, amount, and lines, then flags and corrects a wrong coding block before it becomes a ticket.
9. Reports. Ask a natural-language question about commitment by cost object. Reporting access is the requirement most clients actually have.
10. Admin, AI audit. Every prompt, model, and outcome in `sc_ai_audit`. An AI-infused finance app is auditable or it is not deployable.

## Positioning Notes

To a CFO: every requirement in your legacy spend tool already exists somewhere in SAP. What you are buying is a budget owner seeing commitment plus actual against a cost object without a report request, and committing a plan without a data-entry queue. The AI is audited, row by row.

To a program or marketing manager: you plan in a grid because a grid is the right shape for the decision. Keep the grid, then press one button and the requisitions exist in SAP with the right coding.

To a CIO: no new ledger, no new master data. Three read views and four wrapper function modules in one Z package. If the app is retired, the SAP footprint reverts cleanly.

Discriminator vs Deltek Costpoint: not a competitor here. Costpoint has no campaign planning grid and no AI invoice remediation.

Discriminator vs Cognitus: Cognitus delivers configured SAP. Spend Studio is the experience layer that makes configured SAP usable to a non-SAP user.

Discriminator vs Dassian standalone: no overlap. Dassian is contract, cost, and project; this is procurement demand and budget control.

Discriminator vs a straight Fiori project: Fiori gives you the same transactions in a nicer wrapper, without the planning grid, batch requisition generation, invoice extraction, or narrative reporting. Be explicit that this is a prototype accelerator, and price the engagement as a build.
