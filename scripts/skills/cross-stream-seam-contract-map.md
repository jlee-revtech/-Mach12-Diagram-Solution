---
name: The Cross-Stream Seam Contract Map
description: Every seam between the 13 A&D value streams: what crosses it, who adjudicates when the two specialists disagree, the SAP mechanism that carries the contract, and the field failure modes. The Solution Architect's adjudication authority.
license: internal
---

# The Cross-Stream Seam Contract Map

A&D S/4HANA implementations do not usually fail inside a value stream. They fail at the seams, where one stream's output becomes another's authoritative input, and where two competent specialists each design their own side correctly while nobody owns the boundary between them.

This map names every seam, states its contract as an obligation, names the ADJUDICATOR (the stream whose ruling wins when the two disagree), gives the SAP mechanism that carries the contract, and lists how it breaks in the field. Cite this map when you rule on a seam. If a design question crosses two streams and is not in this map, that is itself a finding: the seam is undefined and someone will discover it in integration testing.

## Adjudication rule

When two workstream specialists disagree at a seam, the adjudicator's ruling wins. The adjudicator is not always the producing stream. It is the stream that carries the regulatory or accounting accountability for the outcome. The losing stream's concern must still be recorded as a risk, not discarded.

## Seam index

| Seam | Producer | Consumer | Adjudicator |
|---|---|---|---|
| EVMS actuals and rates | record-to-report | plan-to-perform | **plan-to-perform** |
| Contract to revenue recognition (POB) | offer-to-cash | record-to-report | **offer-to-cash** |
| GFP receipt to property record | source-to-pay | acquire-to-retire | **acquire-to-retire** |
| eBOM release to mBOM | design-to-release | plan-to-produce | **design-to-release** |
| Production output to inventory ownership | plan-to-produce | inventory-to-deliver | **plan-to-produce** |
| Subcontract components at vendor | source-to-pay | plan-to-produce | **source-to-pay** |
| Labor actuals to cost objects | hire-to-retire | record-to-report | **hire-to-retire** |
| Production order settlement | plan-to-produce | record-to-report | **record-to-report** |
| Delivery acceptance to billing | inventory-to-deliver | offer-to-cash | **offer-to-cash** |
| Rotable pool and condition-based stock | sustainment-mro | inventory-to-deliver | **sustainment-mro** |
| Capital asset to the ledger | acquire-to-retire | record-to-report | **record-to-report** |
| Award to program baseline | offer-to-cash | plan-to-perform | **offer-to-cash** |
| Estimating system and its actual-cost history | plan-to-perform | offer-to-cash | **offer-to-cash** |
| As-designed to as-maintained configuration | design-to-release | sustainment-mro | **design-to-release** |
| Access control as a business system control | security-authorization | development-technology | **security-authorization** |
| Reported numbers and their lineage | analytics-reporting | record-to-report | **record-to-report** |

## EVMS actuals and rates

**Producer:** record-to-report
**Consumer:** plan-to-perform
**Adjudicator:** plan-to-perform
**Seam key:** `p2pf-r2r-evms`

**The contract.** Plan-to-Perform OWNS Earned Value Management: the performance measurement baseline, control accounts and CAM assignment, work authorization, BCWS/BCWP/ACWP, CPI/SPI, EAC/ETC, and IPMR/533 reporting. It SPECIFIES the actual-cost and rate dependencies that Record-to-Report FULFILLS: actual cost of work performed from ACDOCA cost postings, cost-element and settlement actuals, and the indirect and burden rates that price the baseline. Record-to-Report never derives earned value; Plan-to-Perform never re-derives actual cost.

**SAP mechanism.** ACDOCA line items and CO settlement feed ACWP; costing sheets and activity rates (KP26) price both the baseline and the actuals; Dassian PPC holds the time-phased plan (cost, hours, revenue) and the EVM engine reads actuals from CO.

**Failure modes.**

- Earned value reconciles to a cost extract rather than to ACDOCA, so the program books and the general ledger disagree at the CAM level
- The baseline is priced at forward rates and the actuals post at provisional rates, and nobody owns the rate variance in the EAC
- Record-to-Report changes the cost element to line-ID mapping mid-year and the ACWP series breaks with no restatement
- A control account exists in the EVM tool but has no WBS element carrying cost in SAP

## Contract to revenue recognition (POB)

**Producer:** offer-to-cash
**Consumer:** record-to-report
**Adjudicator:** offer-to-cash
**Seam key:** `o2c-r2r-revrec`

**The contract.** Offer-to-Cash owns the contract structure and the ASC 606 performance obligation determination: which CLINs group into which POB, the transaction price and its allocation, and variable consideration. It hands Record-to-Report a POB carried on a cost object, with a stated recognition method. Record-to-Report owns the mechanics: the Results Analysis key, the valuation method, the POC computation, and the posting. The POB identification is an accounting judgment made once, by Offer-to-Cash with the Revenue Manager and external audit, and Record-to-Report does not silently re-scope it.

**SAP mechanism.** POB identifier on the WBS billing element (FAKKZ = X); RA key assigned to the cost object; Dassian RAENH computes cost-to-cost POC and posts recognized revenue, deferred revenue, and the contract asset/liability position; billing documents from the billing plan or DP90 close the loop.

**Failure modes.**

- Revenue is recognized per WBS element rather than per performance obligation, so ASC 606 disclosure cannot be produced
- A contract mod changes the transaction price and the RA valuation is not re-run against the new value
- Billing and revenue are reconciled monthly by spreadsheet because unbilled AR has no systematic decomposition
- Cost elements that must be excluded from the POC base are still included in the RA line-ID assignment

## GFP receipt to property record

**Producer:** source-to-pay
**Consumer:** acquire-to-retire
**Adjudicator:** acquire-to-retire
**Seam key:** `s2p-a2r-gfp`

**The contract.** Government-furnished property never enters the company through a purchase order paid for by the company, and never lands on the balance sheet. Source-to-Pay owns the receipt event and the physical goods movement; Acquire-to-Retire owns the property record, the unique item identifier, the custodian, and the accountability to the government. The Government Property Administrator adjudicates: if the receipt did not create a property record with a UII and a custodian, the receipt is not complete regardless of what the material document says.

**SAP mechanism.** GFP receipt without valuation (or with a zero-value/statistical treatment), a special stock indicator that segregates ownership, an equipment master or property record carrying the UII, and the IUID registry submission through PIEE.

**Failure modes.**

- GFP is received against a standard PO and capitalized, putting government property on the contractor balance sheet
- Material arrives, stock is correct, and no property record is created; the annual property report has a population it cannot explain
- Property is consumed in production and the property record is never relieved (relief of stewardship missing)
- Subcontractor-held government property is invisible because the seam only covers the prime's own receipts

## eBOM release to mBOM

**Producer:** design-to-release
**Consumer:** plan-to-produce
**Adjudicator:** design-to-release
**Seam key:** `d2r-p2pr-bom`

**The contract.** Design-to-Release owns the technical baseline and its configuration control: the engineering BOM, the change master, and the effectivity. Plan-to-Produce owns the manufacturing BOM, the routing, and producibility. The contract is that no manufacturing BOM changes without an engineering change master, and no engineering release reaches the shop floor without a manufacturing engineering disposition of in-flight orders and stock. Design-to-Release adjudicates what the configuration IS; Plan-to-Produce adjudicates how it is built.

**SAP mechanism.** Engineering change master (AENR) with effectivity; PLM to S/4 BOM transfer; BOM (MAST/STKO/STPO) with production version; the change impact assessment across open production orders, planned orders, stock, and open purchase orders.

**Failure modes.**

- The mBOM is a one-time copy of the eBOM and drifts silently; BOM accuracy falls below the MMAS threshold
- A change is released with date effectivity while the program needs serial effectivity, so as-built configuration cannot be reconstructed
- Class I changes reach production before the government contracting officer approves them
- STPO component quantities are read without dividing by the STKO base quantity, so every downstream requirement is wrong

## Production output to inventory ownership

**Producer:** plan-to-produce
**Consumer:** inventory-to-deliver
**Adjudicator:** plan-to-produce
**Seam key:** `p2pr-i2d-stock`

**The contract.** The goods receipt from a production order decides the stock paradigm: plant stock, project stock (special stock Q), sales-order stock (E), or consignment (K). Plan-to-Produce owns that decision because it flows from the contract's inventory segregation requirement and the MMAS design. Inventory-to-Deliver owns everything after: storage, physical inventory accuracy, and the outbound movement. Neither may reassign special stock across contracts without the authorized, logged transfer.

**SAP mechanism.** Goods receipt movement type with the special stock indicator; valuated project stock vs non-valuated; the transfer posting that moves stock between special stocks and the authorization plus audit trail behind it.

**Failure modes.**

- Everything lands in plant stock because that is what the demo showed, and the MMAS review finds no contract segregation
- Borrow and payback across contracts happens by phone call and a transfer posting with no authorization record
- Non-valuated project stock is chosen without realizing the inventory value then lives only on the WBS
- Initial stock is loaded at cutover without the special stock indicator and can never be re-segregated

## Subcontract components at vendor

**Producer:** source-to-pay
**Consumer:** plan-to-produce
**Adjudicator:** source-to-pay
**Seam key:** `s2p-p2pr-subcontract`

**The contract.** Subcontracting moves company material into a vendor's custody (special stock indicator O) while the company retains title and, where the material is government property, the government retains title. Source-to-Pay owns the subcontract, its flowdowns, and the consent-to-subcontract; Plan-to-Produce owns the component provision and the receipt of the finished component. Where the provided material is government-furnished, Acquire-to-Retire must be told, because subcontractor control of government property is a FAR 52.245-1 obligation of the prime.

**SAP mechanism.** Subcontracting purchase order with component list; movement type 541 to provide components; special stock O at vendor; goods receipt of the finished part consumes the provided components; the subcontract cost model in CO.

**Failure modes.**

- Components are provided but never reconciled; special stock O at vendor is a black hole nobody counts
- Government property is provided to a subcontractor with no property record and no flowdown of the property clause
- The subcontract's flowdown set is assembled by the buyer from a template rather than from the prime contract's clause matrix
- Scrap at the subcontractor is absorbed without a cost impact or a property loss report

## Labor actuals to cost objects

**Producer:** hire-to-retire
**Consumer:** record-to-report
**Adjudicator:** hire-to-retire
**Seam key:** `h2r-r2r-labor`

**The contract.** Hire-to-Retire owns the timekeeping control: daily employee entry, supervisor approval, a reason-coded audit trail on every change, and the direct/indirect charging discipline. It hands Record-to-Report labor hours already attested and approved, mapped to a cost object. Record-to-Report owns the rate applied and the resulting cost posting. The timekeeping control is the one DCAA tests in a floor check, and Record-to-Report must not repair bad time data by journal entry, because that destroys the control.

**SAP mechanism.** CATS time records (CATSDB) with approval, transferred to CO/PS/PM cost objects; labor category to activity type mapping; actual or standard labor rates; the labor distribution reconciliation back to payroll and to ACDOCA.

**Failure modes.**

- Labor corrections are made in Finance by journal entry rather than as a reason-coded time correction, so the audit trail dies at the GL
- Uncompensated overtime is not captured, so effective labor rates on exempt staff are wrong and the total time accounting policy is unevidenced
- The charge number is open when it should be closed; employees charge a completed contract
- Labor distribution does not tie to payroll and the reconciliation is a quarterly spreadsheet nobody signs

## Production order settlement

**Producer:** plan-to-produce
**Consumer:** record-to-report
**Adjudicator:** record-to-report
**Seam key:** `p2pr-r2r-settlement`

**The contract.** Plan-to-Produce generates cost on production and refurbishment orders. Record-to-Report owns the settlement design: the settlement profile, the allowed receivers, and the settlement rule that moves that cost to the program cost object or to inventory. The order type and its settlement receiver are a joint decision, but the settlement rule and its accounting consequence are Record-to-Report's ruling.

**SAP mechanism.** Order type, settlement profile, allocation structure, settlement rule; variance calculation and its posting; the WBS or CO-PA receiver.

**Failure modes.**

- Production variance settles to CO-PA on a cost-type contract, so program cost is understated
- Orders settle to a WBS element that is not the billing element and the cost never reaches revenue recognition
- Unsettled orders at period end silently defer cost out of the EVMS actuals
- The settlement strategy is unconfigured for the company code, and WBS creation itself fails

## Delivery acceptance to billing

**Producer:** inventory-to-deliver
**Consumer:** offer-to-cash
**Adjudicator:** offer-to-cash
**Seam key:** `i2d-o2c-dd250`

**The contract.** Inventory-to-Deliver produces the physical delivery and the material inspection and receiving report (DD250). Offer-to-Cash owns the billing event, the CLIN/ACRN allocation, and the WAWF submission. Acceptance is a contractual act tied to a CLIN, not a warehouse event tied to a material. The delivery must carry the CLIN, the ACRN, and the UII, or the invoice will be rejected and the acceptance cannot be recorded.

**SAP mechanism.** Outbound delivery with reference to the contract CLIN; DD250 / ABS in Dassian; goods issue; billing document; WAWF submission with CLIN and ACRN.

**Failure modes.**

- The delivery is created against a material and the CLIN linkage is inferred later by a human
- WAWF rejects on CLIN/ACRN mismatch and the rejection is worked in email, not in the system
- Revenue is recognized on goods issue when the contract says revenue recognizes on government acceptance
- IUID marks are applied but never registered, and the delivery is accepted anyway, creating a downstream property gap

## Rotable pool and condition-based stock

**Producer:** sustainment-mro
**Consumer:** inventory-to-deliver
**Adjudicator:** sustainment-mro
**Seam key:** `mro-i2d-rotables`

**The contract.** A rotable is the same material number in two economically different states: serviceable and unserviceable. Sustainment/MRO owns the condition semantics and the exchange transaction; Inventory-to-Deliver owns the physical stock and its accuracy. Condition-based split valuation is not optional: without it, an exchange transaction moves value that does not exist, and the pool's financial position is fiction.

**SAP mechanism.** Split valuation by condition (valuation type serviceable / unserviceable); serialized equipment master tracking the installed base; the exchange order with an outbound serviceable line and an inbound unserviceable line; refurbishment order raising the carcass to serviceable.

**Failure modes.**

- No split valuation, so a serviceable unit and a carcass carry the same moving average price
- The serial swap on the installed base is not posted, so as-maintained configuration diverges from reality
- Customer property in repair is co-mingled with the contractor's rotable pool
- On a PBL contract the pool status timestamps are not captured, so the availability metric cannot be computed

## Capital asset to the ledger

**Producer:** acquire-to-retire
**Consumer:** record-to-report
**Adjudicator:** record-to-report
**Seam key:** `a2r-r2r-assets`

**The contract.** Acquire-to-Retire owns the asset lifecycle and the property record. Record-to-Report owns the capitalization policy, the depreciation areas, and the cost accounting treatment: CAS 404 capitalization criteria, CAS 409 depreciation, and facilities cost of money. The asset accountant proposes; the Controller and the Compliance Director rule on the accounting policy, because a change in depreciation practice is a cost accounting practice change with a cost impact.

**SAP mechanism.** Asset class, depreciation areas (book, tax, cost accounting/CAS), asset under construction settlement to a final asset, depreciation run, and the asset-to-cost-center or asset-to-pool assignment that lands depreciation in the right indirect pool.

**Failure modes.**

- Depreciation lands in the wrong indirect pool and the rate structure is quietly wrong all year
- Government property is created as a fixed asset, capitalizing something the company does not own
- Assets under construction are never settled and facilities cost of money is computed on a moving target
- The book depreciation area is used for the CAS 409 calculation without a separate cost-accounting area

## Award to program baseline

**Producer:** offer-to-cash
**Consumer:** plan-to-perform
**Adjudicator:** offer-to-cash
**Seam key:** `o2c-p2pf-baseline`

**The contract.** The award document (its CLIN tree, funding by ACRN, statement of work, period of performance, and CDRLs) is the authoritative scope. Offer-to-Cash owns it. Plan-to-Perform converts it into a work breakdown structure and a performance measurement baseline, and it may not invent scope that the contract does not contain nor drop scope that it does. Every contract mod re-opens this seam: a mod that changes scope or funding must reach the baseline change process.

**SAP mechanism.** Sales contract with CLIN/SLIN structure; the project definition and WBS created from the CWBS or the contract structure; funding by ACRN and its limitation-of-funds control; the mod's snapshot and its baseline change request.

**Failure modes.**

- The WBS is built from the proposal's cost model rather than from the contract's CWBS and the customer's reports never reconcile
- Funding by ACRN is not modeled, so limitation-of-funds notices are late and cost is incurred at risk
- A mod is signed and the baseline is never changed; the EAC and the contract value diverge permanently
- The proposal's basis of estimate is discarded at award and the EAC has no traceable starting point

## Estimating system and its actual-cost history

**Producer:** plan-to-perform
**Consumer:** offer-to-cash
**Adjudicator:** offer-to-cash
**Seam key:** `o2c-p2pf-estimating`

**The contract.** The DFARS estimating system belongs to Offer-to-Cash. Its most important input is actual cost history and program performance data, which Plan-to-Perform and Record-to-Report hold. The contract is that estimates cite that history with traceable lineage, and that estimating and program controls use the same definition of a cost element, a labor category, and a work package. A basis of estimate that cannot be traced to a system of record is a defective pricing finding waiting to happen.

**SAP mechanism.** Actual cost by cost element and WBS from ACDOCA; historical CPI/SPI and EAC accuracy; standard costs from BOM and routing; prior-buy history from purchasing; the rate structure from Record-to-Report.

**Failure modes.**

- Estimating pulls history from a spreadsheet extract nobody can reproduce
- The labor categories in the proposal do not map to the activity types that will carry the cost
- Prior-buy history is used without adjusting for the quantity, configuration, or period of the prior buy
- The proposal's WBS does not match the WBS the program will execute, so no actual will ever validate an estimate

## As-designed to as-maintained configuration

**Producer:** design-to-release
**Consumer:** sustainment-mro
**Adjudicator:** design-to-release
**Seam key:** `d2r-mro-asmaintained`

**The contract.** Design-to-Release owns the as-designed and as-planned configuration; Plan-to-Produce records the as-built; Sustainment/MRO maintains the as-maintained configuration on the installed base. Configuration status accounting is a single obligation running across all three. A modification embodied at the depot must be traceable to the engineering change that authorized it, or the platform's configuration record is not defensible.

**SAP mechanism.** Serialized equipment master and functional location representing the installed base; the as-built record from production; the engineering change master authorizing a service bulletin or modification; the component removal and installation postings.

**Failure modes.**

- The depot embodies a modification against a paper service bulletin and SAP's installed base still shows the pre-mod configuration
- Serial number effectivity is not carried into sustainment, so nobody knows which units have which change
- The as-built genealogy from production is not handed to sustainment at delivery, so the installed base starts empty

## Access control as a business system control

**Producer:** security-authorization
**Consumer:** development-technology
**Adjudicator:** security-authorization
**Seam key:** `sec-all-access`

**The contract.** Every value stream's DFARS business system criteria include access control, segregation of duties, and an audit trail. Security & Authorization owns the role concept, the SoD ruleset, and the export-control access model; each value stream's data owner approves who gets what. Security executes access decisions, it does not make them. Development & Technology must not build an extension that bypasses the authorization check, and must not hold developer authority in production.

**SAP mechanism.** PFCG roles and derived roles by org level; SU24 proposals; GRC Access Control risk analysis and firefighter; CDS DCL row-level security; the security audit log; the transport approval as an IT general control.

**Failure modes.**

- Roles are designed by the security team alone and the SoD conflicts appear at go-live
- A custom transaction has no authorization check and quietly grants what PFCG denies
- Export-control access is granted by job title rather than by a person-based attribute, and a deemed export occurs
- Auditor roles carry change authority because nobody built a proper display-only role

## Reported numbers and their lineage

**Producer:** analytics-reporting
**Consumer:** record-to-report
**Adjudicator:** record-to-report
**Seam key:** `analytics-all-lineage`

**The contract.** Analytics & Reporting builds the semantic layer and the reports; the owning value stream owns the DEFINITION of each metric and certifies the number. A number that an auditor cannot reperform from source line items does not leave the building. Row-level and export-control security must be enforced at the CDS layer so it survives into every downstream tool.

**SAP mechanism.** CDS interface and consumption views over ACDOCA and the operational tables; analytical queries; DCL row-level security; period snapshots so a restated period can still be reproduced.

**Failure modes.**

- Two dashboards show two different backlog numbers because two teams defined it
- A report bypasses DCL by reading a table directly and exports controlled technical data
- The reported number cannot be traced to line items and the auditor reperforms it by hand for six weeks
- Snapshot data is not retained, so a prior-period report can never be reproduced after a master data change
