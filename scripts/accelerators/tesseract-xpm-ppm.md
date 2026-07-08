---
name: Tesseract XPM (Project Portfolio Management)
description: Project and portfolio management accelerator: WBS, resource plans, CAS/DCAA rate pools and a versioned burden engine, workflow and forms, CATS timesheet, PMAR planning, and ACDOCA actuals, running on Supabase or S/4HANA.
workstreams: plan-to-perform, record-to-report, hire-to-retire, offer-to-cash, analytics-reporting
license: internal
---

# Tesseract XPM (Project Portfolio Management)

## What It Does

Tesseract XPM (repo `ppm-app`) is the program execution layer that GovCon and A&D primes want and that standard SAP PS does not provide. It covers portfolio intake, WBS, baselines, forecasting, resource planning, rates, timekeeping, and change control, then pushes the financially meaningful pieces into S/4HANA.

| Capability | Substance |
|---|---|
| Portfolio and project | Portfolios, projects, lifecycle profiles with gated phases, risks, issues, milestones |
| WBS and cost nodes | Hierarchy editor, control accounts, CAM assignment, ERP Sync to reserve a real project definition and push WBS |
| Resource management | Demand-planning grid with time-phased plan lines, autosave, versioned forecasts and what-if clones |
| Rates | Labor rates by org and discipline; a versioned costing-sheet burden engine (Fringe -> OH -> G&A -> COM), internal vs external rate class |
| CAS/DCAA rates | Cost waterfall: cost record (ACDOCA posting) -> cost pool (CAS 418) -> rate pool (Fringe/OH/G&A/Material Handling) -> rate segment (CAS division) |
| Workflow | One engine: AI and manual builder, forms builder (19 field types, in-form approvals), conditional routing, parallel approval with quorum, SLA escalation, people groups |
| Timesheet | CATS-backed OData V4, DCAA/FAR/21 CFR 11 overlay, PTO posting, approval routing, charge-object policy |
| PMAR planning | Value-category by month grid (Revenue, Cost, Hours), Excel and AI import, push to Results Analysis |
| Reporting | Backlog waterfall from Results Analysis, WBS actuals, currency rates |
| Implementation Delivery | Six gated phases for S/4 agile delivery, sprints, feature backlog, migration objects, defects |

Two backends: Supabase for SaaS, or `VITE_DATA_SOURCE=sap` routing entities to S/4 read services plus a CAP/HANA layer with per-entity fallback. The timesheet additionally has a fully in-boundary build hosted as a BSP inside S/4.

## When To Position It

Position it when the client runs SAP PS for structure but manages programs in Excel; when indirect rates are the audit exposure and CAS 418 pool composition lives in spreadsheets; when they pay for Deltek Costpoint and SAP and staff a reconciliation team; when DCAA timekeeping needs attestation, e-signature, and charge-object policy CATS cannot carry; when forecasting must land in Results Analysis.

Do NOT position it when:

- There is no SAP PS or Controlling footprint. Without WBS and ACDOCA there is no anchor and it becomes a generic PPM tool competing on price.
- The requirement is schedule management (CPM, resource leveling). This is cost and structure first.
- The client is a commercial manufacturer with no indirect-rate exposure. Rates and CAS are the differentiator.
- The whole product must run in-boundary. Only the timesheet has that build today. Say so.

## How It Fits The SAP Design

Touches Plan-to-Perform (primary), Record-to-Report (rates, actuals), Hire-to-Retire (time, PTO), Offer-to-Cash (billing inputs, backlog), Analytics.

Replaces: the Excel PMAR template and its upload; standalone rate workbooks; the schedule side-file; a Costpoint project-accounting seat; a homegrown timesheet.

Augments: PS stays the system of record for project definition, WBS, budget, actuals, and settlement. Results Analysis stays the revenue engine. CATS stays the time repository.

Standard-SAP alternative: SAP PPM plus Commercial Project Management plus Fiori Project Control. The accelerator wins on (1) the indirect-rate model, which standard SAP does not carry above the costing sheet, (2) the PMAR grid and its push into the Results Analysis overlay, (3) the unified workflow and forms engine, (4) UX density, which is why program managers abandon the project builder. It does not win on budgeting and availability control, settlement, or statistical key figures.

## Integration Points

In: WBS and project headers from CDS views; actuals from ACDOCA (leading ledger, cost-element categories 01/41/42/43, which excludes settlement credits and revenue); commitments from COOI; time from CATSDB; rates from TCURR.

Out: project definitions and WBS via a background-job BAPI harness, because the PS create BAPIs raise dialog messages that abort a synchronous work process; PMAR revenue and cost into the Results Analysis overlay and the add-on plan tables; change requests raised as a PS claim and incorporated into a baseline version; timesheet rows posted to CATS through a wrapper function module that commits in its own session.

Auth: Supabase Auth with RLS, or XSUAA/IAS on BTP. SAP calls traverse a proxy holding the destination and handling CSRF, so no SAP credential reaches the browser. The in-boundary timesheet uses the SAP session cookie.

Deployment: React SPA on Vercel plus Supabase; or CAP on BTP with HANA Cloud; or a BSP inside S/4.

## SAP-Side Objects

| Object | Type | Purpose |
|---|---|---|
| `ZC_M12_WBS_ACTUALS` / `ZUI_M12_WBS_ACTUALS_O4` | CDS view + OData V4 | Posted WBS actual cost from ACDOCA by period and cost element |
| `ZC_M12_WBS_STRUCT` / `ZUI_M12_WBS_STRUCT_O4` | CDS view + OData V4 | WBS hierarchy from PRPS, PROJ, PRHI with billing-element and account-assignment flags |
| `ZC_M12_PROJECT` / `ZUI_M12_PROJECT_O4` | CDS view + OData V4 | Project header read |
| `ZC_M12_PRDORD` / `ZUI_M12_PRDORD_O4` | CDS view + OData V4 | Production orders as charge objects, status flags from JEST |
| `ZTMACH12_PRJ_FX`, `Z_M12_FX_UPSERT`, `ZUI_PRJ_FX_O4` | Table, RFC FM, RAP OData | Project currency rates, read and write direct from the browser |
| `ZI_M12_TIMESHEET` / `ZUI_M12_TIMESHEET_O4` | RAP BO + OData V4 | Timesheet over standard CATSDB; compliance overlay in Z tables, never the time value |
| `Z_M12_CATS_POST` | RFC function module | Wraps the CATS insert BAPI plus commit; derives activity type and cost center from HR infotypes |
| `Z_MACH12_DEPLOY_BAPI` | RFC function module | Project definition create via `BAPI_PROJECT_MAINTAIN` |
| `BAPI_BUS2054_CREATE_MULTI` | Standard BAPI | Bulk WBS create, run inside a background job |
| `Z_M12_BCR_CLAIM_CREATE` / `_PUSH_TO_CLAIM` / `_INCORPORATE` | RFC function modules | Change request to PS claim to plan tables to baseline version |
| `Z_M12_RAENH_LD` / `Z_M12_PPC_PUSH` | RFC function modules | PMAR load into the Results Analysis overlay and the time-phased plan |
| `ZTMACH12_BACKLOG` / `ZUI_M12_BACKLOG_O4` | Table + OData V4 | Monthly backlog waterfall fed by Results Analysis |

## Demo Path

1. Portfolio dashboard. KPI tiles are computed from live data, not typed.
2. Project, ERP Sync, Reserve. A real project definition appears in the SAP project builder. The app writes to SAP; it does not shadow it.
3. Push the WBS. Refresh SAP and show the coding mask. Structure is authored once, where the PM works.
4. Rates Management, Costing Sheets. Build a burden stack, version it, assign it to a WBS node. The indirect rate is a versioned, auditable object.
5. Organizational Management, CAS/DCAA Rates. Drill from rate segment through rate pool and cost pool to individual ACDOCA postings. Every rate traces to a posting. This is the DCAA answer.
6. Forecasting, PMAR Planning. Enter revenue and cost by value category, then Load to SAP RA. The forecast lands in the revenue engine.
7. Reporting, Backlog. Work Performed is sourced from Results Analysis, so the reported number ties to the ledger.
8. Timesheet. Charge an ineligible object; the policy engine blocks it with the real SAP message. Policy is enforced at entry, not at audit.
9. Workflow Studio. Ask the AI for a change-request approval routing to Finance above a threshold. Promote and run it. Minutes, not a Flexible Workflow project.
10. Implementation Delivery. Sprints, feature backlog, cross-workstream dependencies. The tool that runs the implementation runs the programs afterward.

## Positioning Notes

To a CFO: your indirect rates are defensible only because a person can explain the spreadsheet. Here the rate is a versioned object with a drill path from rate segment to journal entry line, and the forecast lands in Results Analysis, so the backlog you report ties to the ledger.

To a program manager: one place to plan resources, control the baseline, raise a change request, and see actuals, without the SAP GUI. The WBS you build here is the WBS in SAP.

To a CIO: additive. PS stays the system of record. Reads come from CDS views over a proxy holding the credential server-side; writes go through wrapper function modules in one Z package.

Discriminator vs Deltek Costpoint: Costpoint is a second general ledger. It wins out of the box and loses forever on duplicate master data and the reconciliation team. We keep one ledger.

Discriminator vs Cognitus: they extend SAP transactions. We sell the workbench and the planning intelligence above them, plus AI surfaces no certified add-on carries.

Discriminator vs Dassian standalone: Dassian is the deeper A&D cost and rev-rec engine and we do not compete with it. Tesseract XPM feeds Dassian PPC and the Results Analysis overlay, so where a client owns Dassian we are the front end that makes it usable.
