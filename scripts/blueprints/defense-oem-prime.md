---
name: Defense OEM Prime Contractor
description: Blueprint for a US defense prime that designs, produces, and delivers major end items under cost-reimbursable and incentive contracts; drives full CAS coverage, EVMS-validated program control, project-stock GPD manufacturing, and Results Analysis rev-rec as the core SAP design.
license: internal
---

# Defense OEM Prime Contractor

The hardest A&D design in the catalog: every DFARS business system is in scope at once, the contract is simultaneously a sales document, a cost object, a schedule baseline, and a funding envelope, and the customer audits the accounting system that produces the invoice.

## Business Model

The prime wins development at low or negative margin, absorbs technical risk, and monetizes the position in production and sustainment.

| Phase | Contract type | Margin | System demand |
| --- | --- | --- | --- |
| EMD / tech maturation | CPFF, CPIF, CPAF, OTA prototype | 6 to 9 pct fee, award fee at risk | Cost by control account, monthly cost voucher, EVMS |
| LRIP | FPIF, UCA converting to FPIF | Target/ceiling, share ratio | Actual vs target cost; watch the point of total assumption |
| Full-rate production | FFP, FPIF option lots | 10 to 14 pct, learning curve | Project-stock costing, progress payments or PBP |
| Sustainment | CLS, PBL, FFP spares, T&M O&A | 15 to 25 pct | Installed base, rotable pools, availability metrics |

Economics driving SAP: revenue on cost-type and long-duration fixed-price work is recognized over time, so Results Analysis is mandatory; cash comes from progress payments (FAR 52.232-16, customary 80 percent of incurred cost) or PBP (FAR 52.232-32), both needing auditable incurred-cost-by-contract; fee is computed against negotiated cost, making EAC accuracy a P&L input; indirect rates are the product's true cost driver and are audited annually. Customers: a program office (contracting party), DCMA (administration, property, EVMS surveillance), DCAA (audit), plus FMS cases with their own currency and offset posture.

## Enterprise Structure

- **Company code:** one CAS-covered defense entity. Where a genuine, balanced commercial business exists (real catalog/market items in substantial quantities), separate it into its own company code and ideally its own legal entity, joined by an arm's-length priced intercompany PO/SO. FAR 31.205-26(e) governs whether that transfer may be at price or must be at cost. Fold a small captive commercial tail in; it cannot earn a credible firewall.
- **Controlling area:** one, spanning all company codes, fiscal year variant aligned to the CAS cost accounting period (CAS 406). One controlling area preserves a single cost center hierarchy, one set of activity rates, and consolidated program margin.
- **Margin analysis:** account-based (ACDOCA carries characteristics). Characteristics must include contract, CLIN, program, WBS, customer, segment.
- **Plants:** one per manufacturing site; valuation area = plant. Avoid co-locating commercial plant-stock MRP and defense GPD project stock in one plant; per-material stock-type decisions in a mixed plant produce cross-contract consumption incidents.
- **Profit center** carries the CAS segment / indirect-rate pool boundary; the S/4 **Segment** field carries external reporting segment. Both post on every ACDOCA line, so allocation and disclosure-statement reporting are queries, not reconciliations.
- **Stock:** valuated project stock (special stock Q) pegged to the WBS for contract-funded material. Non-valuated only where the clause set demands zero contractor book value. GFP never carries value; segregate by stock segment and storage location.
- **GPD / PMMO on** for defense plants: Grouping consolidates program requirements, Pegging binds supply to a specific contract demand, Distribution assigns receipts. Strategies 20/21 and 81/85 dominate. Nothing is fungible.

## Value Stream Emphasis

| Workstream | Emphasis | Why | Signature SAP design |
| --- | --- | --- | --- |
| record-to-report | Critical | CAS pools/bases, unallowable segregation, incurred cost submission | Cost center hierarchy = pool structure; costing sheets or Dassian FR overhead; unallowable cost elements excluded from billing and from RA POC lines |
| plan-to-perform | Critical | EVMS-validated program control is contractual above threshold | MIL-STD-881 WBS, control accounts with CAM assignment, network activities as work packages, Dassian PPC for BCWS/BCWP/ACWP and IPMDAR |
| design-to-release | High | Configuration control, EBOM to MBOM, first article, ECN traceability to contract | PLM owns EBOM; SAP owns MBOM, change master, material versions, as-built serial record |
| plan-to-produce | Critical | Contract-pegged, non-fungible production; serialized traceability | GPD project stock, production orders settled to WBS, QM first-article inspection lots, no anonymous MRP pooling |
| inventory-to-deliver | High | Government acceptance is a financial event, not a shipping event | Outbound delivery plus DD250 (WAWF receiving report in PIEE); acceptance point drives revenue and property transfer |
| acquire-to-retire | Medium | Special test equipment, tooling, facilities capital cost of money | Investment orders and AuC settling to assets; CAS 409 lives distinct from book; CAS 414 FCCOM on DD Form 1861 |
| sustainment-mro | Medium at award, High later | The sustainment tail becomes the margin engine | Serialized installed base; refurbishment orders (PM04) with condition-based split valuation. Usually a follow-on phase |
| source-to-pay | Critical | Purchasing must survive DFARS 252.244-7001; 60 to 70 pct of value is subcontracted | Account-assigned procurement to project stock, flowdown clause library on the PO, DPAS DO/DX rating, CAGE, source approval, SCFM |
| offer-to-cash | Critical | The invoice is cost plus indirect plus fee, computed from the ledger and audited | Dassian Contracts & Billing: CLIN/SLIN/ACRN, cost-based billing, SF1443 progress payments and PBP, DD250-triggered billing |
| hire-to-retire | High | Labor is the base of most indirect rates and the target of DCAA floor checks | CATS with charge-object validation against WBS/network; labor distribution; uncompensated overtime handling |
| security-authorization | Critical | ITAR/EAR technical data, CUI, program need-to-know, DCSA facility clearance | PFCG with org-level derivation; project/WBS-level restriction over PS and PLM data; US-person attribute; CMMC scoping of the SAP boundary |
| analytics-reporting | High | IPMDAR, EAC/ETC, rate variance, backlog | CDS layer over ACDOCA plus PS plus PPC; period-locked close snapshot so restated actuals cannot rewrite a submitted report |
| development-technology | Medium | RA exits, DD250/WAWF output, GFP interfaces, PPC integration | Those four are the unavoidable extensions. Everything else stays clean core |

## Cost Object Strategy

The WBS is the spine; everything settles to it.

1. One project definition per contract (or per major CLIN family). WBS mirrors the MIL-STD-881 product-oriented structure.
2. The control account is the WBS element at the intersection of scope and organization; it carries the CAM. Work packages are network activities below it. **Block postings to summary WBS** via the operative indicators: a stray posting above the control account is the most common EVMS surveillance finding in SAP.
3. Production orders take account assignment from pegged project stock and settle to the control-account WBS. Never settle a production order to a cost center on contract work.
4. Internal orders are reserved for IR&D, B&P, capital/investment, and overhead collectors. IR&D and B&P settle to the indirect pool per CAS 420, never to a contract WBS.
5. Settlement uses an allocation structure that preserves cost element groups, so CAS pool identity survives settlement. Avoid WBS-to-WBS settlement; summarization handles reporting.

Revenue recognition by contract type:

| Contract | Method | Notes |
| --- | --- | --- |
| CPFF / CPIF / CPAF | Cost-to-cost POC, or right-to-invoice expedient | Fee accrual on negotiated fee; award fee only to the extent probable of no significant reversal |
| FPIF | Cost-to-cost POC | Model share ratio and ceiling; incentive is variable consideration, constrained until estimable |
| FFP long-duration production | Cost-to-cost POC | Units-of-delivery defensible only on high-rate lots with substantively uniform units |
| FFP spares / commercial item | Point in time | Recognize on DD250 acceptance |
| T&M / LH | Right to invoice | ASC 606-10-55-18 practical expedient |

Implement with classic PS Results Analysis (RA key on the billing WBS, cost-based POC valuation method), or Dassian RAENH where recognition is at CLIN or performance-obligation level. The POB rarely equals the WBS; RAENH's overlay lets an obligation span or subdivide WBS elements. Structure RA line IDs so unallowable and non-POC cost elements are excluded from the POC numerator **by category**, not by manual journal.

EVMS posture: the SAP ledger is the ACWP source of truth. BCWS and BCWP live in the EVM engine. Whichever holds earned value, the ACWP tie-out to ACDOCA must be a query, not a meeting.

## Compliance Profile

DFARS 252.242-7005 (Contractor Business Systems) is the umbrella; all six apply at scale.

- **Accounting System (252.242-7006):** most consequential. Its criteria are effectively an SAP design spec: direct/indirect segregation, unallowable identification (FAR 31.201-6, CAS 405), contract-level accumulation, timekeeping and labor distribution, interim rate application, exclusion of unallowables from billings.
- **EVMS (252.234-7002):** per DFARS 234.201, EIA-748 compliance on cost or incentive contracts at or above $20M; a government-validated system at or above $100M. Below $20M, apply only if the program office imposes it.
- **Purchasing (252.244-7001):** CPSR examines flowdowns, price/cost analysis, negotiation documentation. Flowdown management belongs on the PO, not in a Word template.
- **Estimating (252.215-7002):** at $50M of prior-year DoD cost-type awards (or $10M with a CO determination). Estimating lives in ProPricer; the actuals and rate structure feeding it come from SAP.
- **MMAS (252.242-7004):** why project-stock segregation and pegging are compliance features. Standard 4 (no unauthorized cross-contract material use) is exactly what GPD pegging enforces.
- **Property (252.245-7003 / FAR 52.245-1):** GFP and contractor-acquired property, physical inventory, LTDD. On awards issued on or after 22 January 2024, DFARS 252.245-7005 consolidates GFP and loss reporting, requires PIEE GFP module transactions within 7 days, and requires IUID marking of serially managed items.

**CAS:** full coverage. One covered award pulls the segment into full coverage and triggers CAS 403 home-office allocation across all segments. The FY2026 NDAA raised the full-coverage trigger, the modified-coverage band, and the TINA threshold; the 48 CFR 9903 conforming update lags the statute, so confirm thresholds in the solicitation rather than quoting from memory. Standards with SAP consequences: 401/402 (consistency, why a cost element cannot be direct on one contract and indirect on another), 403, 405, 406, 407, 409, 410, 411, 414/417, 418, 420.

**ITAR/EAR:** USML technical data on the network. Access control is an authorization design (US-person attribute, need-to-know, project-level restriction on PS and DMS objects), never a company-code split. DDTC does not recognize org structure as an export control.

**CUI / cyber:** DFARS 252.204-7012 (safeguarding, 72-hour incident reporting), 7019/7020 (SPRS), 7021 (CMMC). SAP holds CUI (drawings on the DIR, technical data attachments), so SAP is in the assessment boundary. Scope this in week one.

**Other:** DPAS rated orders (15 CFR 700); specialty metals (252.225-7008/-7009); counterfeit electronic parts (252.246-7007/-7008); Berry Amendment (252.225-7012); TINA certified cost or pricing data on sole-source negotiations above threshold.

## Surround Landscape

| System | Role | SAP posture |
| --- | --- | --- |
| Deltek Cobra / MPM | EVM cost engine (BCWS/BCWP) | Replace with Dassian PPC only where the client will revalidate; otherwise integrate (ACWP out, EV metrics back) |
| Primavera P6 / Open Plan | IMS, critical path, resource-loaded schedule | Integrate. PS networks are not a scheduling engine at 30,000-activity scale |
| Costpoint / Deltek | Incumbent ERP at services-heavy primes | Replace. Risk is incurred-cost submission and pool/base continuity |
| ProPricer | Proposal pricing, forward pricing rates | Integrate. SAP feeds historical actuals; ProPricer returns the negotiated basis of estimate |
| Teamcenter / Windchill | EBOM, CAD, configuration, ECO | Integrate. SAP owns MBOM, routing, change master, as-built |
| Solumina / Apriso (MES) | Shop floor execution, buyoff, nonconformance | Integrate. Confirmations, consumption, quality results to SAP orders |
| PIEE (WAWF/iRAPT, GFP, SPRS) | DD250, GFP transactions, invoicing | Integrate. GFP transactions within 7 days |
| Kinaxis / o9 | Supply/demand what-if | Integrate cautiously; GPD pegging complicates external planning tools |
| Salesforce / GovWin | Capture and pipeline | Integrate. Opportunity-to-contract handoff seeds project and CLIN structure |

## Dassian Fit

The archetype Dassian buyer. All verticals apply.

- **Contracts & Billing:** mandatory. Standard SD cannot model a CLIN/SLIN/ELIN tree with ACRN funding lines, DD250 acceptance billing summaries, progress payments and PBP, and cost-based billing computed from ACDOCA at provisional rates. SD gives you a sales document and a billing plan; it does not give you an ACRN.
- **Cost Management:** mandatory where billing runs at forward or provisional rates and settles to actual. The FR engine applies rate decks by period and revalues at final rates. Costing sheets carry one overhead structure, not a rate deck with a retroactive true-up.
- **Project Management / PPC:** mandatory if SAP is the EVM system of record. Time-phased plan cost/hours/revenue by WBS and version, CAM assignment, CPR/IPMR/NASA 533 generation.
- **Results Analysis / RAENH:** mandatory when POBs do not align 1:1 with WBS, or for world-wide POC across a multi-project POB. Classic PS RA suffices for a single-project, single-POB contract.
- **SCFM:** mandatory at 60 to 70 percent subcontract content.
- **Flowdowns / clause library:** mandatory for the CPSR.
- **Standard SAP suffices** for PR/PO mechanics, MRP, inventory, QM, PM, asset accounting, GL, and hire-to-retire.

## Design Decisions and Traps

1. **Company code for a mixed commercial/defense enterprise.** One code with profit-center split; separate codes with intercompany buy/sell; separate legal entities. **Recommend** separate codes (evaluate separate entities) when commercial is real and balanced; fold in when it is a rounding error. **Fails as:** a co-mingled entity drags the commercial cost structure into DCAA audit and CAS 403 allocation, and inherits flowdowns it never priced.
2. **EVM system of record.** PPC sole source; Cobra sole source with SAP feeding ACWP; dual books. **Recommend** a single source; if the EVMS is already validated on Cobra, feed Cobra and do not chase PPC in wave one. **Fails as:** dual books make the monthly ACWP reconciliation a two-week manual exercise and the first surveillance review finds an unexplained variance.
3. **Summary WBS posting.** Allow postings anywhere; block above the control account. **Recommend** block, via operative indicators. **Fails as:** a stray posting is invisible to the control account, so ACWP does not roll up and BCWP has no matching actual.
4. **Valuated vs non-valuated project stock.** **Recommend** valuated Q stock for contractor-acquired material, non-valuated for GFM. **Fails as:** non-valuated everywhere removes inventory value from the balance sheet and hides material in contract cost; plant stock with a WBS on consumption makes MMAS Standard 4 unenforceable.
5. **POC basis.** Cost-to-cost vs units-of-delivery, per CLIN. **Recommend** cost-to-cost for development and LRIP; units-of-delivery only on high-rate FFP lots with uniform units. **Fails as:** units-of-delivery on a learning-curve lot books a fake margin on first articles and a loss on the last, and no smoothing entry will be accepted.
6. **Where the indirect rate lives.** Costing sheets; Dassian FR rate decks; a spreadsheet plus journal. **Recommend** rate decks (or period-dependent costing sheets if the structure is simple), applied provisionally with a documented true-up. **Fails as:** a rate in a spreadsheet means the invoice cannot be reproduced from the ledger, which is an accounting-system finding by definition.
7. **Unallowable segregation.** Dedicated cost elements; an attribute plus billing/RA exclusion; manual removal at invoicing. **Recommend** dedicated cost elements grouped under an unallowable hierarchy node, excluded from DIP profiles and RA POC lines by category. **Fails as:** manual removal leaves unallowables inside the POC numerator, inflating revenue, and DCAA applies FAR 42.709 penalties.
8. **CLIN/ACRN modeling.** Sales line plus a Z-field; WBS = CLIN; a Dassian contract hierarchy. **Recommend** Dassian. **Fails as:** an ACRN as a text field makes funds control manual, and when one appropriation overruns while another has money left, nobody can prove which color of money paid for what.
9. **Timekeeping validation.** CATS with a charge-object check; an external tool; honor system. **Recommend** hard validation that the employee may charge that WBS/network on that date. **Fails as:** DCAA floor checks fail, the accounting system goes to significant deficiency, and payment withholds follow under 252.242-7005.
10. **CMMC boundary around SAP.** Declare out of scope; put SAP in the enclave; segment the CUI-bearing objects. **Recommend** assume SAP is in scope and design the boundary before the first DIR attachment loads. **Fails as:** an assessor finds drawings on material masters in an unscoped system and the C3PAO assessment stops.
11. **Progress payment liquidation.** Down payment against the sales document; a separate financing document; a spreadsheet. **Recommend** model in Dassian so incurred cost, SF1443 request, receipt, and liquidation are all ledger documents. **Fails as:** the liquidation rate drifts, the contract is over-financed, and the government recoups with interest.
12. **Period-close snapshot immutability.** Report live; snapshot and lock. **Recommend** snapshot EVM and rate-application inputs at close. **Fails as:** a retroactive correction in month 8 silently changes month 6 ACWP, and every submitted IPMDAR is now wrong.

## Discovery Questions

### People

1. Who is the CAM population, how many control accounts does the average CAM own, and are assignments maintained anywhere but a spreadsheet?
2. Is program controls distinct from finance, and which one owns the EAC?

### Process

1. Walk me through the last cost voucher: from a labor hour to an invoice line, name every system and manual step.
2. What is the current determination status on each of the six DFARS business systems, and are any payment withholds in effect?
3. When were the last CPSR, EVMS surveillance review, and incurred-cost audit, and what remains open?

### Technology / Systems

1. What is the EVM system of record, is it validated, and would the client accept revalidation on a new system?
2. Which system owns the EBOM, and at what point does a design release become an MBOM in SAP?

### Data

1. Show me the largest program's WBS. Is it MIL-STD-881 product-oriented, and does the control-account level exist as a distinct level?
2. How is GFP recorded today, and can you produce a serialized GFP inventory by contract within an hour?

### Security / Authorizations

1. What is the export-control access model on technical data, and does anything in SAP hold USML technical data or CUI?
2. Is SAP inside the CMMC assessment boundary? Who decided, and is it documented?

### Analytics & Reporting

1. Which report is the source of the EAC given to the CFO, and which is the source of the EAC given to the customer? If they differ, why?

### Role of AI

1. Where do analysts spend the most hours reconciling data a query should answer (variance narratives, EAC roll-ups, rate true-ups)? Those are the AI candidates, not invoice generation.

### Operating Model

1. Is finance organized by program, by function, or both, and does the program controller have authority over the close calendar?
