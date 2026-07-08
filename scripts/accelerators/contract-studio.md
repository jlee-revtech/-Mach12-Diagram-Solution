---
name: Tesseract Contract Studio
description: GovCon capture-to-closeout CLM accelerator: SAM and award intake, Section M shred, 264-clause intelligence, CLIN/SLIN/ACRN structures, mod engine, billing, ASC 606 rev rec, progress payments, and SAP SD/PS integration.
workstreams: offer-to-cash, record-to-report, plan-to-perform, inventory-to-deliver, analytics-reporting
license: internal
---

# Tesseract Contract Studio

## What It Does

Contract Studio (repo `proposal-studio`, DB prefix `ps_`) runs the full contract lifecycle for government contractors: solicitation in, closeout out, with the money math wired to SAP. It presents as two personas, Capture (pre-award) and Delivery (post-award), over one deal spine.

| Pre-award | Substance |
|---|---|
| Intake and shred | RFP or award PDF in; AI derives pursuit metadata, then streams requirements, evaluation factors, clauses, risks, dates, and Sections A-M with accept/change/reject per item. SAM.gov search imports with dedup (no key means a 503, never mock rows) |
| Section M and compliance | Factors, subfactors, basis of award (LPTA, best-value tradeoff) drive a Section L to M crosswalk, with a re-baseline loop when an amendment shifts requirement keys |
| Proposal suite | Volumes and AI narrative, color teams, key personnel, past performance, reps and certs, teaming and flowdowns, OCI screens (FAR 9.5), RFR economics |
| Cost and pricing | BOE roll-up: labor to fringe to overhead to ODC/subs to cost of money to G&A to fee; price to win; TINA threshold |
| Negotiation | Rounds, position ledger, BATNA and walk-aways, BAFO, redline sessions promoted into positions |

| Post-award | Substance |
|---|---|
| Structure and mods | CLIN / SLIN / ELIN tree, ACRN funding, SOW, CDRLs, deliveries, clauses, versioned so conformed equals active. A mod clones the active version, diffs it, emits an SF 30 Block 14 change list, supersedes; field control limits what a mod type may touch |
| Clause Intelligence | 264 curated FAR Part 52, DFARS Part 252, and Section H clauses, split into corpus (versions, alternates, fill-ins) and deal-side sets, instances, deviations, plus obligations and flowdown rules |
| Documents | 20 GovCon forms with Tier A/B PDF output; TipTap templates with versioning, branding, DOCX export; DocuSign envelopes |
| Billing and cost objects | Plan to determination-typed group per CLIN (FFP milestone, cost-plus-fee, T&M, recurring) to event scaffold, AI-drafted. CLINs align to SAP cost objects, giving a live actuals and commitments report; billing backup is the ACDOCA detail behind the SF 1034/1035 |
| RevRec and progress payments | ASC 606 revenue contracts, POB groups, recognition method, relative SSP allocation, per-CLIN transfer-of-control tests. FAR 52.232-16 detection, FFP CLIN flagging, SF 1443 math with liquidation and the FAR cap |
| FBS, closeout, vehicles | FBS generated from policy, gated to the Finance Lead, deployed to SAP PS; FAR 4.804-1 closeout tasks with an SLA clock; IDIQ, OTA, BPA vehicles; customer portal; Capture and Delivery cockpits |

## When To Position It

Position it when contract data lives in a capture CRM, a shared drive, and SAP SD; when awards arrive as 150-page PDFs with hundreds of CLINs keyed in by hand; when mod volume is high and three people give three answers to "what does the contract say"; when ASC 606 obligations exist only in a memo; when SF 1443 is built in Excel; when billing backup is a manual ACDOCA extract every month.

Do NOT position it when:

- The client is commercial with no FAR exposure. The commercial profile exists, but the value is the FAR/DFARS depth.
- The requirement is e-signature and clause redlining with no financials. Position the Word add-in alone.
- The client runs Dassian CLM end to end and is satisfied. Sell pre-award and the add-in, and be honest that post-award overlaps.
- Procurement demands a certified, in-boundary product today. The SAP-native backend is code-generated, not deployed.

## How It Fits The SAP Design

Touches Offer-to-Cash (primary), Record-to-Report (cost objects, rev rec), Plan-to-Perform (FBS to PS), Inventory-to-Deliver (DD250 and outbound deliveries), Analytics.

Replaces: the capture SharePoint; the CLIN spreadsheet; the mod tracker; the SF 1443 workbook; the manual billing-backup extract.

Augments: SD stays the sales-document system of record once an award is synced. PS carries the financial breakdown structure. ACDOCA and COOI stay the single source of cost and commitment. Dassian, where present, stays the cost and rev-rec engine.

Standard-SAP alternative: SAP Sales Contract plus Dassian CLM, or Ariba Contracts. The accelerator wins on (1) the shred, which turned a 445,000-character redacted award into 40 CLINs, 146 SLINs, 25 ACRNs, and 247 clauses in one pass, (2) the versioned mod engine with Block 14 diffs, (3) ASC 606 as data rather than a configuration side effect, (4) capture, which SAP does not have. It does not win on pricing conditions, credit management, ATP, or billing document output.

## Integration Points

In: solicitation and award documents; SAM.gov records; SAP WBS, orders, networks, and sales orders for cost-object discovery; ACDOCA actuals and COOI commitments; PRPS and PROJ for masked identifiers.

Out: the CLIN tree pushed to SAP as an SD contract; outbound deliveries against it; the FBS deployed as a project definition plus WBS; billing events; DocuSign envelopes.

Critical for consultants: SAP writes go over an ADT bridge, not an OData proxy. There is no Cloud Connector footprint. A thin classrun stub is overwritten per call and invokes a stable Z engine class. Without ADT credentials in tenant settings, endpoints stage rather than execute, and say so.

Auth: application users with a persona header; Finance Lead role gating in middleware on the FBS and RevRec write paths; magic link plus OTP for the customer portal.

Deployment: Vite React SPA plus a Hono API over Supabase Postgres, on Vercel. A nested CAP project generates its CDS model from the Drizzle schema, so a HANA Cloud backend is a flip rather than a rewrite.

## SAP-Side Objects

| Object | Type | Purpose |
|---|---|---|
| `Z_M12_SD_CONTRACT_CREATE` | RFC function module | Flattens CLINs then SLINs to BAPI items and calls `BAPI_CONTRACT_CREATEFROMDATA` plus commit. Must pass the pricing logic switch that copies manual condition values, or every line posts a zero net value |
| `ZCL_M12_DELIVERY_ENGINE` | ABAP class | Release order then outbound delivery. Incoterms are mandatory or the order is incomplete |
| `ZCL_M12_COST_ENGINE` | ABAP class | `discover` finds cost objects; `lineitems` returns ACDOCA actuals plus COOI commitments, enriched with cost-element text, cost center, personnel number, activity type |
| `ZCL_M12_FBS_PS` | ABAP class | Idempotent project-definition and bulk-WBS creation for the FBS |
| `Z_MACH12_DEPLOY_BAPI` / `Z_MACH12_WBS_BULK_BAPI` | RFC function modules | Project create and bulk WBS create, skipping elements that exist |
| ACDOCA / COOI | Standard tables | Actuals (leading ledger, cost-element categories 01/41/42/43) and open commitments (value types 21 to 24) |
| PRPS / PROJ / PRHI | Standard tables | WBS, project header, hierarchy. Display uses the masked edit columns; filtering uses the raw internal id resolved via the object number |

## Demo Path

1. Mission Control. One cockpit across capture and delivery.
2. Document Loader. Drop a solicitation PDF. The shred streams requirements, clauses, risks, and dates. Accept, change, reject: extraction is human-in-the-loop.
3. Compliance Matrix. Upload an amendment; the re-baseline banner fires. Amendments do not silently invalidate the matrix.
4. Bid-decision gate, then Handoff. A proposal is minted, clauses copy, risks seed, the phase advances. The gate is real.
5. Delivery. Load a several-hundred-page award. Review the CLIN/SLIN tree with NSP badges, ACRN funding, SOW, CDRLs, deliveries, clauses. Create the draft contract and approve it.
6. Modifications. Change a CLIN value and a PoP date. The Block 14 diff and superseded version appear. Conformed copy is computed.
7. Cost Objects. Find the WBS by its masked id, assign it to a cost-reimbursable CLIN, open the Cost Report. Real ACDOCA lines, exported to Excel. Billing backup is the ledger.
8. Progress Payments. FAR 52.232-16 is detected; flag eligible FFP CLINs and show the SF 1443 schedule with liquidation and cap. The clause drives eligibility.
9. Terms, Send to SAP. The CLIN tree becomes an SD contract with per-line net values.
10. Deliveries, Create. Real outbound deliveries return with document numbers. The contract you shredded is a live SAP sales document.

## Positioning Notes

To a CFO: revenue recognition is currently a memo and a spreadsheet. Here it is a data model: performance obligations, relative-SSP allocation, an explicit transfer-of-control test per CLIN. Progress payments compute SF 1443 against liquidation and the cap. Billing backup is the ACDOCA lines, exported.

To a program manager: you stop asking what the current contract says. The conformed version is computed from the mod chain, and CDRLs, deliveries, and closeout tasks schedule off anchor events rather than memory.

To a CIO: no new ledger. Our footprint is a handful of Z classes and wrapper function modules in one package, read over ADT with your credentials.

Discriminator vs Deltek Costpoint: Costpoint has contracts and billing, and it is another system of record with its own master data. Contract Studio reads and writes SAP.

Discriminator vs Cognitus: they resell and configure SAP A&D. The award shred, the ASC 606 model, and the entire capture half do not exist in that portfolio.

Discriminator vs Dassian standalone: Dassian is the deeper post-award engine and we say so. Our edge is pre-award, the document intelligence, and the UX. Where a client owns Dassian, the honest pitch is Contract Studio for capture plus the Word add-in, Dassian for cost and rev rec, and we integrate them.
