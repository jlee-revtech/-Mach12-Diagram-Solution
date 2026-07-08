---
name: ZMACH12 S/4HANA Accelerator Objects
description: The Z package behind every Mach12 accelerator: cost and delivery engines, an SD contract wrapper, ZUI_M12_* OData V4 services, a WBS-to-WBS substitution stack, the ML accrual poster, the backlog builder, POB on WBS, and the read-only agent query classrun.
workstreams: record-to-report, plan-to-perform, offer-to-cash, inventory-to-deliver, plan-to-produce, hire-to-retire, analytics-reporting, development-technology
license: internal
---

# ZMACH12 S/4HANA Accelerator Objects

## What It Does

Every Mach12 application that touches SAP touches it through one Z package. This is the catalog: what each object does, which workstream it serves, and how it reaches a demo. Five hard-won patterns govern it.

1. **Reads are CDS views published as OData V4 service bindings.** Every exposed key field is cast to a primitive type to strip the conversion exits the V4 model rejects. Use the design-time service path, not the published runtime URL, which lies on some kernels.
2. **BAPI writes go through an RFC-enabled wrapper function module** called with a destination of NONE, so the BAPI runs in its own session. This is the only way a BAPI that internally issues an update-task call and needs an explicit commit can run from a RAP action handler without dumping. RFC-enable such modules in a function group that already has working remote modules; a brand-new group will not initialize.
3. **Dialog-tainted Project System writes go through a background job harness.** The project-maintain and project-create BAPIs raise dialog messages that abort a non-dialog work process.
4. **Engines are global classes with a single `run( json )` entry point.** A thin bridge class is overwritten per call by the calling application and invokes the engine locally through a classrun. This is how applications with no Cloud Connector footprint reach SAP: over ADT, not OData.
5. **Every custom table has the client as the first field and as part of the key.** Blocking rule, not preference.

## When To Position It

Open this catalog when a client asks how deep the integration goes; when basis or security scopes the SAP footprint (one package, customer namespace, a handful of classes, function modules, service bindings); when we must prove the applications write to SAP rather than shadow it; and when scoping, to separate "already built" from "would be built."

Do NOT open it when:

- The client is a clean-core purist who will not accept a customer class in the ABAP stack. Then the answer is Solution Studio's released-API execution target and a smaller feature set. Say so before the security review, not after.
- The client is on SAP Public Cloud. Most of this assumes private cloud or on-premise with ADT write access, direct table reads, and customer exits.
- The audience is business. This is for architects and basis.

Never present hostnames, users, or transport numbers. The package name is the only identifier a client needs.

## How It Fits The SAP Design

Touches Record-to-Report (cost engine, ML accrual, backlog, POB), Plan-to-Perform (project and WBS deploy, WBS actuals, change-request claim, PMAR push), Offer-to-Cash (SD contract wrapper, backlog, POB), Inventory-to-Deliver (delivery engine), Plan-to-Produce (production-order charge objects), Hire-to-Retire (CATS post), Analytics, and Development-Technology (the classrun harness).

Replaces nothing. Every object is additive. Delete the package and SAP behaves exactly as it did. It augments standard PS, SD, CO, CATS, and Results Analysis: the engines orchestrate standard objects, the wrappers call standard BAPIs, the CDS views read standard tables.

Standard-SAP alternative: released OData APIs plus the Migration Cockpit plus standard Fiori. Released APIs do not cover Results Analysis overlays, CATS with a compliance overlay, WBS-to-WBS posting substitution, backlog waterfalls, or a performance-obligation identifier on a WBS. They do cover material master, business partner, purchase order, and journal entry perfectly well. Use them; Solution Studio's execution-provider seam makes that choice explicit.

## Integration Points

Three transports from an application to this package:

| Path | Used by | Shape |
|---|---|---|
| OData V4 over a proxy | Tesseract XPM | Browser calls a same-origin path; a serverless function forwards to a proxy holding the destination and handling CSRF; the proxy calls the service binding through a connectivity agent |
| ADT bridge | Contract Studio, Spend Studio live mode | The application overwrites a thin bridge class and runs it through the ADT classrun endpoint, which invokes the stable engine locally. No proxy, no Cloud Connector |
| Same-origin, in-boundary | The S/4-hosted timesheet BSP | A BSP inside SAP calls service bindings and ICF handlers with the SAP session cookie. Zero external egress except the AI proxy |

Auth: proxy-held destination credentials on the OData path; ADT credentials in tenant settings on the bridge path; the standard SAP session in-boundary. No SAP credential reaches a browser in the first two.

## SAP-Side Objects

| Object | Type | Purpose |
|---|---|---|
| `ZCL_M12_COST_ENGINE` | ABAP class | `discover` finds cost objects; `lineitems` returns ACDOCA actuals (cost-element categories 01/41/42/43) plus COOI commitments (value types 21 to 24), enriched with cost-element text, cost center, personnel number, activity type. How a cost voucher gets its billing backup |
| `ZCL_M12_DELIVERY_ENGINE` | ABAP class | Release order then outbound delivery against a synced SD contract. Incoterms mandatory or the order is incomplete |
| `Z_M12_SD_CONTRACT_CREATE` | RFC function module | Flattens the CLIN then SLIN tree into BAPI items. Must pass the pricing logic switch that copies manual condition values, or every line posts a zero net value |
| `ZCL_M12_FBS_PS` | ABAP class | Idempotently orchestrates project-definition and bulk-WBS creation for a financial breakdown structure |
| `Z_MACH12_DEPLOY_BAPI` / `Z_MACH12_WBS_BULK_BAPI` | RFC function modules | Project-definition create (idempotent hit if it exists) and bulk WBS create, skipping existing elements |
| PS mass-load pattern | Sequence, not an object | Initialize, multi-create, precommit, commit, run as a background job: the classrun exhausts its roll area and the create BAPI raises a dialog message |
| `ZUI_M12_WBS_STRUCT_O4` | OData V4 binding | WBS hierarchy from PRPS, PROJ, PRHI. Account-assignment and billing-element indicators are distinct fields, commonly confused |
| `ZUI_M12_WBS_ACTUALS_O4` | OData V4 binding | Posted WBS actual cost from ACDOCA. The cost-element category filter is load-bearing: without it settlement credits net the WBS to zero |
| `ZUI_M12_PROJECT_O4`, `ZUI_M12_COA_O4`, `ZUI_M12_PRDORD_O4`, `ZUI_M12_PERSONNEL_O4` | OData V4 bindings | Project header; chart of accounts; production orders as charge objects with status flags; personnel master with cost-center and activity texts |
| `ZUI_M12_TIMESHEET_O4` | RAP BO + OData V4 | Timesheet over standard CATSDB. The compliance overlay lives in Z tables; the time value never does |
| `Z_M12_CATS_POST` | RFC function module | Wraps the CATS insert BAPI plus commit; derives activity type and cost center from HR infotypes, because the activity type is mandatory and its absence silently rolls back |
| `ZTMACH12_PRJ_FX` + `Z_M12_FX_UPSERT` + `ZUI_PRJ_FX_O4` | Table, RFC FM, RAP OData | Project currency rates: the reference implementation for browser-to-SAP CRUD. Keep key fields primitive; PS data elements break the V4 metadata |
| `ZMACH12_WBSLINKS` + `ZCL_MACH12_WBS_LINK_FINDER` + `ZRGGBS000` | Table, class, substitution exit pool | Reroutes a posting on a source WBS to a linked WBS at CO line-item and FI document-line level. CO substitution activates at controlling-area level, not company-code level |
| ML accrual poster (cross-plant) | ABAP class | Posts material-ledger accruals from live pegging, read at post time so no snapshot goes stale. Pools at company-code level by resolving plant to valuation area |
| `ZTMACH12_BACKLOG` + `ZCL_M12_BACKLOG_BUILD` + `ZUI_M12_BACKLOG_O4` | Table, class, OData V4 | Monthly waterfall (ending = beginning + new awards - cancellations +/- adjustments - work performed) at performance-obligation grain. Work Performed is the period delta of the Results Analysis calculated values |
| POB on WBS | User field, Z check table, RAP OData V4 | The performance-obligation identifier in a relabeled WBS user field, mandatory whenever the Results Analysis key is set. The ASC 606 anchor |
| `Z_M12_BCR_CLAIM_CREATE` / `_PUSH_TO_CLAIM` / `_INCORPORATE` | RFC function modules | Change request to a PS claim notification (via the claim BAPI, not the quality-notification BAPI), plan deltas pushed against it, then re-inserted against a baseline version |
| `Z_M12_RAENH_LD` / `Z_M12_PPC_PUSH` | RFC function modules | PMAR revenue and cost into the Results Analysis overlay and the time-phased plan; both auto-resolve the billing WBS |
| `ZCL_M12_AGENT_QUERY`, `ZCL_M12_ORG_MODEL_DUMP`, `ZCL_M12_PC_HIER_DUMP` | Read-only classruns | Configuration lookups behind Suggest-from-S/4; the org structure and profit-center hierarchy as JSON |
| Demo executor (`RunExecutor` action) | RAP service | Post a class name and a JSON parameter string; the runner invokes that executor, which calls a wrapper function module. Every application-triggered write reaches SAP this way, without a new service binding per feature |
| In-boundary config store + ICF handler | Table + ICF service | Client-first composite key, JSON payload, one read/upsert endpoint, so the S/4-hosted timesheet's admin screens keep their query shape with no external persistence |

## Demo Path

1. From Tesseract XPM, Reserve and Push WBS. The project definition and hierarchy appear in the SAP project builder: the deploy wrapper plus the mass-load pattern in a background job.
2. Open the WBS user fields tab. The performance-obligation identifier is a native SAP field, not a side table.
3. From Contract Studio, Send to SAP. Each CLIN and SLIN is a sales-document line with its real net value: the SD wrapper with the pricing logic switch.
4. Deliveries, Create. Two outbound deliveries return with document numbers: the delivery engine, incoterms and all.
5. Align a CLIN to a WBS, open the Cost Report. Real journal lines with cost-element text, cost center, personnel number, activity type, exported to Excel: the cost engine.
6. Post a direct activity allocation against a source WBS with a link row. It lands on the linked WBS: the substitution stack, active at controlling-area level.
7. Enter time against a WBS in another controlling area. The real SAP message returns and the entry is refused. The wrapper and RAP handler fail loudly rather than returning success.
8. Enter a month of PMAR revenue and cost, Load to SAP RA. The load modules resolved the billing WBS themselves.
9. Run the backlog build, open Reporting, Backlog. Work Performed comes from the Results Analysis calculated values.
10. In Solution Studio, Suggest a field value (read-only classrun), Prepare, approve, Execute. Run it again: idempotent hit. Every write is preview-then-approve.

## Positioning Notes

To a CFO: nothing here is a second ledger. The backlog number, the cost-voucher backup, the revenue recognition anchor, and the accrual all resolve to postings in your universal journal. The package adds reading them at the grain your disclosures require, and writing plans back into the engine that produces them.

To a program manager: the project definition in SAP was created by the tool you plan in, and the WBS you charge time against is the WBS you built. No interface file, no nightly job.

To a CIO: one package, customer namespace. Reads are CDS views; writes are wrappers around standard BAPIs. Nothing modifies SAP objects; there is one customer copy of a substitution exit pool, the standard extension point. Every custom table is client-keyed. If you need clean core, we switch the execution target to released APIs and say plainly which features do not survive.

Discriminator vs Deltek Costpoint: this package is why we do not need a second ledger. Their integration story is a nightly extract; ours is a wrapper around the standard BAPI, called synchronously, returning the document number.

Discriminator vs Cognitus: they build Z objects too. Ours ship as a versioned, documented package behind a product, with a demo path per object and a stated clean-core exit.

Discriminator vs Dassian standalone: this package feeds Dassian rather than replacing it. The Results Analysis overlay load and the plan push are the integration surface. Where Dassian is absent we still produce the backlog and the revenue anchor from standard Results Analysis.
