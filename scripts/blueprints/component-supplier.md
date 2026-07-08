---
name: Tier-2 / Tier-3 Component Supplier (Build-to-Print and Build-to-Spec)
description: Blueprint for an A&D component supplier selling hardware to primes under long-term agreements and fixed-price POs; drives plant-stock standard costing, discrete MRP, lot and serial traceability, flowdown compliance without full CAS, and a point-in-time versus over-time rev-rec decision.
license: internal
---

# Tier-2 / Tier-3 Component Supplier (Build-to-Print and Build-to-Spec)

The one A&D model where the correct SAP answer looks like a commercial discrete manufacturer with a compliance overlay, not a defense prime. Consultants who impose a project-stock, GPD, Results Analysis playbook on a machine shop with 4,000 part numbers and a two-week lead time will destroy the business. The job is to be ruthlessly ordinary in plan-to-produce and surgically precise in the four places the defense supply chain actually differs: flowdowns, traceability, customer property, and export control.

Two sub-models must be separated in the first workshop:

| | Build-to-print | Build-to-spec |
| --- | --- | --- |
| Who owns the design | The prime or the government | The supplier |
| Data rights | Prime's drawing; supplier holds process | DFARS 252.227-7013/-7014 data rights matter |
| Competitive posture | Re-competed on price; margin compression | Sole source or qualified source; margin defensible |
| Change control | The prime's ECO drives the supplier | Supplier's ECO must be qualified by the prime |
| SAP consequence | MBOM and routing are the supplier's IP; drawing is a controlled attachment | Full design-to-release with EBOM, ECN, configuration management |
| Rev-rec consequence | No alternative use; over-time recognition is arguable | Often catalog-adjacent; point in time is cleaner |

## Business Model

Revenue is a stream of purchase orders released against long-term agreements at fixed unit prices with contractual step-downs. The supplier makes money on capacity utilization, quoting discipline, NRE and tooling recovery, and material escalation management. Nobody bills cost plus fee.

| Revenue line | Contract type | Economics |
| --- | --- | --- |
| Production hardware under an LTA | FFP unit price, multi-year, price step-downs and quantity commitments | Volume and utilization; the step-down assumes a learning curve that must actually be achieved |
| Spot / annual POs | FFP | Higher margin, lower volume; quoting hit rate is the KPI |
| NRE and tooling | FFP or cost-reimbursed NRE line | Recovery timing drives cash; tooling title often passes to the customer |
| Aftermarket spares (primes, depots, DLA) | FFP, IDIQ, DLA long-term contracts | Highest margin in the mix; often the same part at 3x the production price |
| Direct government awards | FFP, IDIQ with delivery orders, occasionally an SBIR | Introduces prime-contractor obligations the supplier may not be ready for |

Economics driving SAP: gross margin per part number per customer is the operating metric and must be a query, not a quarterly study; the cost of a part is standard cost plus variance, and variance analysis is the real cost accounting; material escalation on specialty metals can wipe out an LTA's margin, so purchase price variance is P&L-critical; a missed first article or a lost material certification stops shipment, and a stopped shipment on a prime's line is an existential customer event; CAS almost never attaches, and preserving that is worth real money.

## Enterprise Structure

- **Company code:** usually one. Where a supplier serves both A&D and a genuinely different commercial market (automotive, medical, industrial), a company-code split is generally **not** warranted, because there is no CAS coverage to firewall against. Use profit centers.
- **Controlling area:** one.
- **Plants:** one per manufacturing site; plant is the valuation area. Storage locations model the physical flow: receiving, raw stores, WIP staging, outside processing, bonded/quarantine, finished goods, customer property cage. The customer property cage is a storage location, and it is not optional.
- **Stock model:** plant stock, anonymous, valuated at standard cost. Make-to-stock (strategy 10) for LTA parts with a release schedule; make-to-order without project (strategy 20) where the part is customer-specific; consumption-based planning for commodities. **Do not turn on GPD. Do not use project stock.**
- **The exception to design for:** a prime occasionally flows down a segregation requirement, or the supplier holds a cost-type subcontract. Handle it by making a small number of parts sales-order stock (special stock E) or by physically segregating in a dedicated storage location with a batch attribute, never by converting the whole plant to project stock.
- **Customer property:** prime-furnished tooling, gauges, test fixtures, and sometimes material arrive under FAR 52.245-1 flowdown. Model as non-valuated stock in the customer property storage location plus equipment masters for tooling. The tooling is an asset the supplier does not own and must be able to inventory on demand.
- **Profit center:** by product line or customer program, whichever the CEO uses to make investment decisions.

## Value Stream Emphasis

| Workstream | Emphasis | Why | Signature SAP design |
| --- | --- | --- | --- |
| record-to-report | Medium | Ordinary corporate accounting; no CAS pools, no incurred cost submission | Standard GL/CO; overhead via costing sheets on production orders; product cost by order and by period |
| plan-to-perform | Low | No EVMS. Programs exist but are not earned-value managed | Skip PS for production. A light internal-order or WBS structure only for NRE and qualification programs |
| design-to-release | High for build-to-spec, Medium for build-to-print | Design ownership determines data rights, change control, ECO origin | Build-to-spec: PLM plus SAP change master and ECN. Build-to-print: SAP holds MBOM and routing; the customer drawing is a controlled DIR tied to the customer's ECO number |
| plan-to-produce | Critical | This is the business: capacity, sequencing, first article, special processes, yield | Discrete production orders (or repetitive at high volume), routings with work centers and standard values, outside-processing operations, QM inspection lots, batch and serial traceability |
| inventory-to-deliver | Critical | On-time delivery to a prime's line is the survival metric; certs must ship with the part | Delivery, packing, EDI 856 ASN, certificate of conformance and material certification as output; kanban/consignment/VMI where the prime demands it |
| acquire-to-retire | Medium | Machine tools are the capital base; customer-owned tooling is not the supplier's asset | Standard asset accounting; customer tooling as equipment, not asset; tooling amortization recovered through NRE lines |
| sustainment-mro | Low to Medium | Some suppliers repair their own product; most do not | A small CS/PM footprint if repair exists; otherwise skip |
| source-to-pay | Critical | Raw material (specialty metals), outside processing (heat treat, NDT, coating), electronic components | Scheduling agreements for raw stock; subcontracting POs (item category L, special stock O) for outside processing; specialty-metals and counterfeit-parts flowdowns on the PO; Nadcap-qualified supplier lists |
| offer-to-cash | High | LTAs, price step-downs, escalation clauses, EDI POs, and one very hard rev-rec question | Sales scheduling agreements with condition records carrying step-down pricing by validity period; EDI 850/860/856/810; the over-time vs point-in-time decision |
| hire-to-retire | Medium | Direct labor is standard-costed; no DCAA floor checks | Time recording via production order confirmations; no CATS charge-object compliance burden |
| security-authorization | High | ITAR technical data on drawings; DFARS 252.204-7012 and CMMC flow down from every prime | US-person attribute; DIR and material master document access by export classification; the CMMC boundary almost certainly includes SAP because drawings are attached there |
| analytics-reporting | High | Margin per part per customer, PPV, scrap and yield, OTD, quote hit rate | CDS layer over ACDOCA, production order actuals, delivery performance. Do not build an EVM reporting layer nobody wants |
| development-technology | Low to Medium | Cert/COC output, EDI mappings, portal integrations, IUID marking data | Keep the core clean. The extensions are outputs and interfaces, not accounting logic |

## Cost Object Strategy

- **The production order is the cost object.** Cost is collected by order, variances calculated at settlement, and the order settles to the material with variance to a variance account and, in account-based margin analysis, to profitability characteristics. Standard product cost by order.
- Repetitive manufacturing (product cost by period) suits high-volume stable parts. Do not mix paradigms within a plant without a clear rule.
- Standard cost is set annually (or semi-annually) by costing run, with material, labor, machine, setup, outside processing, and overhead components. The cost component split is what makes margin analysis meaningful; design it before the first costing run.
- Internal orders: NRE projects, tooling builds, qualification and first-article programs, capital. NRE recovered through a customer-billed line settles to revenue; supplier-funded NRE settles to expense or is capitalized where criteria are met.
- **WBS and PS:** only where the supplier holds a genuine development program with milestones and a customer-visible schedule. Do not deploy PS to manage production.
- Overhead: costing sheets on production orders (material overhead on material, production overhead on labor and machine time). With no CAS coverage, the pools and bases are a management decision, not a disclosure statement. That is a freedom primes do not have; use it.

Revenue recognition, the decision with the largest audit consequence in this blueprint:

| Situation | Method | Reasoning |
| --- | --- | --- |
| Standard or near-catalog part, stock available, alternative customers exist | Point in time on transfer of control | Alternative use exists; no over-time criterion met |
| Build-to-print part unique to one customer, with an enforceable right to payment for work performed to date including a reasonable margin | Over time, cost-to-cost POC | ASC 606-10-25-27(c). Many A&D LTAs contain a termination-for-convenience clause creating exactly this right |
| Build-to-print unique part, but the PO gives no right to payment beyond incurred cost on termination | Point in time | Without the margin element the right-to-payment criterion fails |
| NRE and tooling | Over time if the customer controls the asset as created; else on completion | Read the tooling title clause |
| Spares against an IDIQ | Point in time per delivery order | Each delivery order is generally the contract |

The over-time decision is made **per contract**, driven by the termination-for-convenience language and the state-law enforceability of the right to payment. It determines whether the supplier carries contract assets instead of inventory, which changes the balance sheet materially. Get the auditor's concurrence in writing during design, because the configuration (Results Analysis on a sales-order cost object versus plain standard-cost inventory relief) follows from it and is expensive to reverse. Where over-time applies to a subset of parts, implement with sales-order stock (special stock E) and RA on the sales document item, not a wholesale conversion to PS.

## Compliance Profile

- **DFARS 252.242-7005 business systems generally do not apply.** These clauses attach to the contract, and a subcontractor holding only fixed-price subcontracts does not carry them. Exceptions that change everything: a direct government cost-type prime contract (Accounting System, 252.242-7006), or a prime that contractually flows down a business-system requirement (read the subcontract; some do). **Property (FAR 52.245-1) does flow down** and applies whenever the prime furnishes tooling or material.
- **CAS: usually exempt, and the exemptions are worth defending.** The relevant ones at 48 CFR 9903.201-1(b): small business; firm-fixed-price awarded on adequate price competition without certified cost or pricing data; commercial products and services; awards below the TINA threshold. The moment the supplier accepts a sole-source cost-type subcontract above threshold and submits certified cost or pricing data, modified CAS coverage can attach and the entity needs a Disclosure Statement. That is a CEO strategy decision, not an accounting detail; surface it in week one.
- **TINA:** certified cost or pricing data on sole-source negotiations above the threshold. The FY2026 NDAA raised it; confirm the value in the specific subcontract. Where the supplier is sole source above threshold, the historical actuals SAP produces become an audit artifact.
- **Flowdowns that reach into SAP:**
  - DFARS 252.204-7012 (safeguarding CUI, 72-hour reporting), 252.204-7019/-7020 (SPRS score), 252.204-7021 (CMMC). If drawings and specifications are attached to SAP objects, SAP is in the CMMC boundary. The single most common surprise in a Tier-2 SAP program.
  - DFARS 252.225-7008/-7009 (specialty metals): domestic melt certification for titanium, certain steels, and superalloys. The certification travels with the batch. Model melt source and country of origin as **batch characteristics**, not a text note on the PO.
  - DFARS 252.225-7012 (Berry Amendment) where applicable.
  - DFARS 252.246-7007/-7008 (counterfeit electronic parts): traceability to the original component manufacturer or an authorized/franchised distributor. Batch-level supplier traceability, enforced.
  - DFARS 252.211-7003 (item unique identification): IUID marking above threshold and of serially managed items. The UII must be recorded and reported.
  - DPAS (15 CFR 700): rated orders (DO/DX) accepted or rejected within statutory timeframes, with the rating flowed to the supplier's own POs. Carry the rating from the sales document to the purchase order.
  - FAR 52.245-1 property: customer-furnished tooling and material, physical inventory, LTDD reporting.
- **Quality:** AS9100 (AS9110 maintenance, AS9120 distributors), AS9102 first article inspection, Nadcap accreditation for special processes (heat treat, NDT, chemical processing, welding). SAP consequence: inspection plans and lots, results recording, certificate of conformance output, and the ability to reproduce an AS9102 FAI package from the system.
- **ITAR/EAR:** technical data on the drawings. Authorization design, not org structure.

## Surround Landscape

| System | Role | SAP posture |
| --- | --- | --- |
| Prime portals (Exostar, SupplyOn, Ariba, customer-specific) | PO receipt, forecast, ASN, quality data | Integrate. SAP is the system of record for the order |
| EDI VAN / translator | 850, 860, 830/862 forecast, 856 ASN, 810 invoice | Integrate. High-volume, unglamorous, and it must work on day one |
| Teamcenter / Windchill / SolidWorks PDM | EBOM, CAD, ECO (build-to-spec) | Integrate for build-to-spec. Build-to-print suppliers frequently have no PLM and should not be sold one |
| MES (in-house, Plex, ProShop, Solumina) | Operation execution, machine data, DNC, buyoff | Integrate where volume justifies. At smaller suppliers SAP shop-floor confirmation is sufficient and MES is over-scoped |
| CMM / inspection data systems | Dimensional results, FAI packages | Integrate results into QM inspection lots where volume justifies |
| Quoting / estimating (Excel, Paperless Parts) | Quote costing and hit-rate tracking | Integrate loosely. SAP supplies actual cost history to calibrate quotes |
| Legacy ERP (QuickBooks, Epicor, Global Shop, Made2Manage, Plex) | Incumbent | Replace |
| PIEE (WAWF/iRAPT) | Only if selling direct to the government | Integrate only when a direct government award exists |
| Kinaxis / o9 | Overkill | Skip. SAP MRP plus a capacity view is sufficient |

## Dassian Fit

Mostly no, and saying so is the value of this blueprint.

- **Contracts & Billing: not needed** in the typical case. There is no CLIN/SLIN/ACRN tree, no DD250, no progress payments, no cost voucher. Standard SD contracts, sales scheduling agreements, and condition records with validity periods handle LTAs and step-down pricing. Adopt it only if the supplier holds direct government prime contracts with CLIN structures and DD250 acceptance.
- **Cost Management: not needed.** No CAS pools, no forward pricing rate agreements, no provisional-rate true-up. Costing sheets and the standard cost estimate are sufficient and are what the business understands.
- **Project Management / PPC: not needed.** There is no EVMS.
- **Results Analysis / RAENH: only if** the over-time rev-rec decision goes to over time on a material portion of the book. Classic SAP Results Analysis on the sales order item is generally sufficient; RAENH is over-engineered unless POBs span cost objects.
- **SCFM:** no.
- **Flowdowns / clause library: partially useful.** The supplier must flow clauses to its own sub-tier (specialty metals, counterfeit parts, DPAS). A clause library on the PO is genuinely valuable; whether it justifies the license is a commercial question. A well-designed purchasing text determination scheme plus a clause matrix table often does the job.

Where standard SAP suffices: essentially all of it. This is the blueprint where the consultant's job is to talk the client **out of** the defense-prime toolkit.

## Design Decisions and Traps

1. **Project stock or plant stock.** Project stock and GPD (because the prime uses it); plant stock with standard costing; plant stock with selective sales-order stock. **Recommend** plant stock, with special stock E only where a flowed-down segregation requirement or an over-time rev-rec decision demands it. **Fails as:** GPD in a job shop makes every MRP run pegged and non-fungible, destroys lot-sizing economics, and adds two planners of headcount for no compliance benefit.
2. **Over-time vs point-in-time revenue recognition.** **Recommend** per-contract determination, decided with the external auditor during design, documented in policy, implemented consistently. **Fails as:** a supplier recognizing point in time on contracts meeting the over-time criteria has understated revenue and misclassified contract assets as inventory; the correction is a restatement.
3. **Accepting a cost-type subcontract.** **Recommend** understand before signing that a cost-type sub above the TINA threshold can pull modified CAS coverage, a Disclosure Statement, DCAA access, and an accounting system that segregates unallowables. **Fails as:** sales wins a $30M cost-type sub and the controller discovers in month three that the ERP cannot produce a compliant voucher.
4. **CMMC boundary.** Prohibit CUI in SAP and keep drawings in a separate enclave; put SAP in the boundary; segment SAP. **Recommend** assume SAP is in the boundary the moment a customer drawing is attached to a material master or DIR. **Fails as:** the supplier loses a CMMC assessment on a system nobody scoped, and every DoD prime pauses new awards.
5. **Specialty metals and melt source as data.** A scanned PDF in a folder; batch characteristics with a certificate attached; a text field on the PO. **Recommend** batch characteristics (melt source, country of origin, heat/lot number, certificate link) with derivation to finished-goods batches. **Fails as:** a prime asks for melt-source certification on a lot shipped 18 months ago, the supplier cannot produce it, and that is a delivery hold plus possible false-certification exposure.
6. **Standard cost revaluation cadence.** Annual; semi-annual; rolling with material ledger actual costing. **Recommend** annual standard with a mid-year review, unless material escalation is severe, in which case actual costing earns its complexity. **Fails as:** a standard set before a 40 percent titanium increase makes every production order look wildly unfavorable and the CFO stops trusting the variance report.
7. **Outside processing modeling.** A service PO with no stock movement; a subcontracting PO with the part provided as special stock O; receive back as a new part. **Recommend** the subcontracting PO, so parts at the heat treater are visible, valued, and inventoried. **Fails as:** $2M of WIP at outside processors appears nowhere in inventory, discovered at a physical count.
8. **Serial and batch traceability depth.** **Recommend** batch with derivation through the BOM, and serial numbers only where the customer requires IUID or the part is life-limited. **Fails as:** a raw-material nonconformance forces a recall, the supplier cannot say which finished parts contain the heat, and the whole year's shipments to that customer are suspect.
9. **Customer-furnished tooling.** Capitalize it (wrong); a spreadsheet; equipment master plus non-valuated storage location plus periodic inventory. **Recommend** the third. **Fails as:** the prime's property administrator asks for a tooling inventory, the supplier cannot produce it, and the FAR 52.245-1 flowdown becomes a corrective action request.
10. **Whether to buy PLM.** **Recommend** build-to-print suppliers usually need none; SAP's change master, DIRs, and material revision level suffice, with the customer drawing as a controlled attachment keyed to the customer ECO number. Build-to-spec suppliers need PLM. **Fails as:** a $2M PLM implementation at a shop whose designs all belong to the prime.
11. **LTA step-down pricing.** Manual price maintenance per year; condition records with validity periods; a Z-table. **Recommend** condition records with validity periods plus an escalation clause monitor. **Fails as:** an invoice at last year's price triggers a customer debit memo and chargeback, and AR spends a quarter cleaning it up.
12. **Who owns on-time delivery measurement.** **Recommend** reconcile SAP's confirmed delivery date and actual goods issue against the customer's OTD score monthly, and understand the customer's clock-start rule (PO date? confirmed date? original request date?). **Fails as:** the supplier believes it is at 98 percent OTD, the customer's scorecard says 84 percent, and that gap is how a supplier lands on a corrective action plan.

## Discovery Questions

### People

1. Who owns the quoting process, and does that person have access to actual production cost history by part number?
2. Is there anyone in the company who understands what CAS coverage would mean if a cost-type subcontract were accepted?

### Process

1. Take the top three parts by revenue: who owns the design, and what does each contract's termination-for-convenience clause say about payment on termination?
2. Show me how an outside-processing operation (heat treat, NDT, plating) is handled today from PO to receipt.
3. What is the AS9102 first-article process, and can the FAI package be reproduced from a system?

### Technology / Systems

1. How do customer POs and forecasts arrive, and how many portals must someone log into each morning?
2. Is there an MES, and if not, where do machine operators record time and buyoff?

### Data

1. Can you trace a finished part shipped last year back to the raw material heat lot and melt country, and is melt source recorded as data or as a scanned certificate?
2. Do you know gross margin by part number by customer today, and how long does producing it take?

### Security / Authorizations

1. Are customer drawings stored inside the ERP, on a file share, or in a portal? Is that repository inside the CMMC assessment boundary?
2. What is the SPRS score, and when was the last self-assessment?

### Analytics & Reporting

1. Which delivery-performance number do you manage to: yours or the customer's? What is the gap and why?

### Role of AI

1. Where would faster quoting (cost estimation from drawing plus historical actuals) create the most value, and is the historical cost data clean enough to support it?

### Operating Model

1. Does the same team run commercial and defense work on the same machines, and if so, what physically separates the export-controlled prints from the shop floor's general access?
