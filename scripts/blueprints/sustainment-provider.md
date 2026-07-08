---
name: Sustainment Provider (Aftermarket, Depot MRO, PBL/CLS)
description: Blueprint for an aftermarket business running depot repair, rotable exchange pools, spares, and PBL/CLS; drives serialized installed base, condition-based split valuation, government property segregation, and outcome-based revenue recognition in SAP.
license: internal
---

# Sustainment Provider (Aftermarket, Depot MRO, PBL/CLS)

Sustainment is where A&D margin lives, and it is the model most often designed last and worst. The unit on the bench usually belongs to someone else, the workscope is unknown until teardown, the part changes value as its condition changes, and on PBL the deliverable is an availability percentage rather than a repair. A design that treats the depot as "Plant Maintenance with extra steps" cannot answer the two questions the program manager asks weekly: where are my assets, and are we going to make the metric.

## Business Model

| Model | What the customer buys | Revenue shape | Margin driver |
| --- | --- | --- | --- |
| Transactional repair (repair and return) | A repair event on their serial number | FFP per repair, or T&M | Workscope discipline; over-and-above (O&A) capture |
| Exchange | A serviceable unit now, for their carcass | Exchange fee plus O&A on the carcass | Rotable pool utilization; carcass return rate |
| Spares sales | Parts, to the prime, a depot, or DLA | FFP, IDIQ delivery orders | Price realization on sole-source parts; inventory turns |
| CLS | The contractor runs sustainment: supply, maintenance, field teams | Fixed monthly plus cost-reimbursable elements | Efficiency against a cost baseline; award fee |
| PBL | An outcome: availability, fill rate, turnaround ceiling | Fixed price per period, plus incentives and disincentives tied to metrics | Reliability improvement. Every repair avoided is margin |
| Commercial aftermarket | Repair, overhaul, used serviceable material | FFP per event, flat-rate, power-by-the-hour | Turn time and pool efficiency |

**The economics are inverted relative to production.** Transactionally, more repairs mean more revenue. Under PBL, more repairs mean less margin, because revenue is fixed and the repair is cost. Whoever configures the system must understand that, because on PBL every status timestamp and goods movement is contract data, not operational exhaust. Teams design for transactional repair (that is what the demo scripts show), then discover the program is PBL and nobody captured the timestamps and pool states the metrics require.

Most real programs are hybrids: a PBL CLIN for availability, transactional CLINs for O&A and out-of-scope work, an exchange mechanism, and a spares line. Design the object model for the superset and let CLIN assignment on the order and the settlement rule decide where cost and revenue land.

## Enterprise Structure

- **Company code:** usually the same legal entity as the OEM, unless the sustainment business was acquired or deliberately separated. Where a genuine commercial aftermarket business exists at scale (airline customers, market-priced repairs), a separate company code with an arm's-length buy/sell is worth evaluating: it is a real market business and can transfer at price under FAR 31.205-26(e).
- **Controlling area:** one, shared with production if the OEM and the depot are the same company. Sustainment cost objects consume the same activity types and rates.
- **Plants:** one maintenance plant per physical depot site. Field and CLS operating sites are additional plants where they hold stock and post movements, or planning plants referencing the depot where they do not. Do not fold a depot and a manufacturing site into one plant; MRP behavior, valuation, and property segregation all want the separation.
- **Storage locations** mirror the physical flow, because the location is the queue-state signal: induction dock, evaluation/teardown, awaiting parts, awaiting O&A approval (a physical hold area), test, quarantine/MRB, serviceable stores, shipping. Reports that infer queue state from storage location are cheap and robust.
- **Work centers:** one per shop, bay, or test stand, with real capacity (shifts, headcount). Shop load and PBL capacity answers come straight from work center capacity data; activity rates feed both order costing and resource-related billing.
- **Valuation: condition-based split valuation is the foundational decision and cannot be retrofitted.** A valuation category for condition on each rotable material, with valuation types for new, serviceable/refurbished, and unserviceable/defective. SAP blocks changing the valuation category on a material with stock, open documents, or valuation history in the current or previous period. Converting a live fleet means draining stock to zero, closing documents, changing the material, and reposting, serial by serial, plant by plant. Decide before cutover and load conversion stock directly into the correct valuation types.
- **Ownership segregation:** government-owned pool assets (GFP) and contractor-owned pool assets never share a stock segment. Separate storage locations plus special stock/ownership indicators. Every metric and every physical inventory must be runnable per ownership.

## Value Stream Emphasis

| Workstream | Emphasis | Why | Signature SAP design |
| --- | --- | --- | --- |
| record-to-report | High | CLS cost-type elements carry CAS; PBL revenue is a series obligation; refurbishment cost capitalization policy | Refurbishment cost either capitalizes into the serviceable valuation price or hits expense. Decide once with the program Finance lead and never revisit it informally |
| plan-to-perform | Medium | PBL and CLS programs have cost baselines but rarely full EVMS | WBS or internal order per PBL/CLS CLIN to collect program cost. EVMS only where a CLS contract is cost/incentive above the DFARS 234.201 threshold |
| design-to-release | Medium | Repair procedures, technical data, engineering dispositions, as-maintained vs as-designed configuration | Repair procedures as PM/CS task lists; DIRs for technical data; configuration comparison against allowed parts per position needs a custom install check, not a standard one |
| plan-to-produce | Low to Medium | Manufacturing exists only for details and kits | Production orders for detail manufacture. The overhaul event belongs on PM/CS orders where refurbishment valuation and RRB integration live |
| inventory-to-deliver | Critical | The pool is the business. In-transit carcasses, units at vendors, and serviceable stock are all pool state | A pool status view unioning stock by valuation type, special stock at vendors, in-transit STO stock, and open refurbishment orders. Build it in week two |
| acquire-to-retire | Medium | Test stands, tooling, GSE; the rotable pool may be a capitalized asset on power-by-the-hour programs | Standard asset accounting; internal PM orders for tooling kept out of contract cost objects |
| sustainment-mro | Critical | This is the entire model | Serialized installed base (functional location hierarchy per tail, equipment at position leaves); service notification as RTAT clock start; service orders for customer-owned units; refurbishment orders (PM04) for pool assets; usage decision as the repair-complete event |
| source-to-pay | Critical | Subcontracted repair at OEMs and repair stations; DMSMS obsolescence; counterfeit parts | Subcontracting PO (item category L) with the unserviceable unit provided as a component; special stock at the vendor; unserviceable out, serviceable back; a report of GFP sitting at vendors |
| offer-to-cash | Critical | Four billing mechanics coexist: resource-related, FFP per event, exchange fee, PBL periodic | Dassian Contracts & Billing for CLIN/DD250/PBL billing plans; DIP profile for resource-related billing and O&A quotation; incentive adjustments tied auditably to the metric calculation |
| hire-to-retire | Medium-High | Certifying staff authority; technician qualifications; field team deployment | Qualification and certification data on the employee; who may sign an airworthiness release is an authorization design point |
| security-authorization | High | ITAR technical data; CUI in maintenance manuals; movement-type authorization protecting customer property | PFCG with org-level derivation; lock down the movement types converting customer stock to contractor stock; certifying-authority roles |
| analytics-reporting | Critical | RTAT, pool availability, awaiting-parts, warranty recovery, O&A rate, vendor turn time. On PBL these are contract data | CDS views over notification dates, order status history, usage decision timestamps, stock by valuation type and ownership. Clock-stop rules must each be a distinct status with a timestamp |
| development-technology | Medium-High | Pool status view, PBL metric calculation, GFP reporting to PIEE, install-compatibility check, release output | Those five are the near-universal extensions. Resist everything else |

## Cost Object Strategy

Decision ladder for what carries the work, first match wins:

1. **Customer-owned unit, repair event is or may become billable per event:** a CS repair sales order and its service order. The service order carries cost; resource-related billing (DP90) and O&A quotation (DP80) hang off it. Default for repair-and-return.
2. **Contractor-owned rotable needing overhaul, no per-event billing:** a PM refurbishment order (order type PM04, created via IW81, received via IW8W). It is the only maintenance order type with native from/to valuation type handling on the header, and the only order-based mechanism that collects overhaul cost while changing condition. A 309 transfer posting changes valuation type but captures no cost; the subcontract PO mapping changes condition but only for external work. PM04 is the vehicle for all internal pool overhauls.
3. **Internal maintenance on contractor plant, tooling, and GSE:** a plain PM order in a separate order type, settling to a cost center. Shop labor on tooling must never leak into a contract cost object.
4. **PBL or CLS where repairs are cost, not revenue:** the same order types (refurbishment for pool assets, service orders for customer assets), but settling to the program cost object (a WBS or internal order under the PBL CLIN) rather than generating a billing request. The order type governs stock and valuation behavior; the billing seam is governed by the settlement rule and the absence of DP90.

Do not invent a repair flavor of the production order. Production orders belong to detail manufacture and kitting.

Settlement: the service order settles to a billing request (transactional) or to the PBL/CLS WBS (outcome-based), and the same order type must support both, selected by a settlement rule derived from the CLIN on the sales document. Refurbishment orders settle to the material (changing the serviceable valuation price) or to expense, per the capitalization policy. Internal PM orders settle to cost centers. **O&A operations must be separately identifiable on the order** (operation grouping or sub-order) so O&A cost and billing reconcile independently of the standard workscope.

Revenue recognition:

| Model | Method | Notes |
| --- | --- | --- |
| FFP repair per event | Point in time, on release/acceptance | Cost sits on the service order; margin is order cost against the fixed price, so order-to-line traceability must be clean |
| T&M repair / O&A | Right to invoice (ASC 606-10-55-18) | DP90 output is the revenue |
| Exchange | Point in time, on issue of the serviceable unit | The carcass return is a separate obligation; a late or missing carcass converts to an outright sale at full unit price |
| PBL | Series of distinct services / stand-ready obligation, recognized ratably | Incentives and disincentives are variable consideration, constrained until estimable. Repairs are cost |
| CLS with cost-reimbursable elements | POC or right to invoice on the cost-type CLINs; ratable on the fixed monthly CLIN | Two POBs, two patterns, one contract |
| Spares under an IDIQ | Point in time per delivery order | Simple |

Where a PBL fixed CLIN and transactional CLINs live on one contract, POBs do not align to a single WBS. That is the condition under which Dassian RAENH earns its license; classic PS Results Analysis assumes contract = project = obligation.

## Compliance Profile

- **Property (FAR 52.245-1) is the dominant regime** and the one most likely to produce a finding. The unit under repair is not contractor inventory and must never carry value on the contractor's books. The standard CS repair flow receives the returned unit into sales order stock (special stock E) as non-valuated stock, controlled by the requirement class of the returns item. Smoke-test every induction path for zero FI impact on the unit itself before go-live, and re-test after every requirement class change.
- **DFARS 252.245-7005 (Management and Reporting of Government Property)** applies to awards issued on or after 22 January 2024. It consolidated the former 252.211-7007 (GFP reporting), 252.245-7002 (loss reporting), and 252.245-7004, removed 252.245-7001, and added two duties hitting depot MRO directly: IUID marking of serially managed reparable items (MIL-STD-130), and reporting of GFP transactions within 7 days through the PIEE GFP module. Cite 252.211-7007 only as a legacy reference on pre-2024 awards that still contain it, and pull the clause from the actual contract rather than paraphrasing scope.
- **DFARS 252.245-7003 (Property Management System):** one of the six business systems under 252.242-7005, and the one that matters most here. An inadequate property system triggers payment withholds.
- **Accounting System (252.242-7006):** applies wherever CLS or PBL contracts carry cost-reimbursable elements, dragging in provisional rates and the incurred cost submission.
- **Purchasing System (252.244-7001):** applies once a CPSR triggers. Vendor repair subcontracts carry property stewardship flowdowns, because GFP sent to a subcontractor extends the custodial chain.
- **MMAS (252.242-7004):** applies where material is bought against contracts. Less dominant than at a prime, but pool assets bought on one program and consumed on another is exactly what Standard 4 prohibits.
- **EVMS (252.234-7002):** only on cost or incentive CLS contracts at or above the DFARS 234.201 thresholds. Most PBL contracts are fixed price and carry none.
- **CAS:** attaches where the entity holds CAS-covered contracts. Fixed-price PBL awarded competitively without certified cost or pricing data may be exempt; a sole-source cost-type CLS above threshold is not. The cost accounting practice for refurbishment cost (capitalize into the serviceable price vs expense) is a **disclosed practice** and cannot be changed casually.
- **Airworthiness and certification:** FAA Part 145 repair station certificate for commercial aftermarket work (EASA Part 145 for European operators), with the authorized release certificate (FAA Form 8130-3) or its military equivalent. SAP does not generate a legal 8130-3. The standard pattern is an output form triggered off the usage decision or service order completion, the signed document attached to the equipment/serial record, and a user status blocking outbound delivery until the release document exists. Who may sign is an authorization design point.
- **Quality:** AS9110, defect and cause catalogs built from the program's failure taxonomy or the OEM's fault codes, inspection lots on receipt of repaired units, usage decision as the release event.
- **Other:** counterfeit electronic parts (DFARS 252.246-7007/-7008); DMSMS obsolescence, which stalls inductions invisibly and needs a dedicated status and a missing-parts report tied to the RTAT clock-stop rules; ITAR technical data in maintenance manuals; CMMC where CUI lives in the maintenance data.

## Surround Landscape

| System | Role | SAP posture |
| --- | --- | --- |
| Mxi Maintenix, TRAX, AMOS, Ramco, IFS | Aviation maintenance: installed base, task cards, compliance | Replace with SAP PM/CS where SAP is the target ERP and the fleet is contractor-sustained. Integrate where the operator owns the maintenance system and the depot only sees the induction |
| MES / shop floor (Solumina, in-house) | Work instruction execution, buyoff, nonconformance | Integrate. Confirmations, consumption, defects flow to SAP orders |
| PIEE (GFP module, WAWF/iRAPT, SPRS) | GFP transaction reporting within 7 days, DD250, invoicing | Integrate. A hard requirement, not a nice-to-have |
| IUID Registry | UII reporting for serially managed items | Integrate. Store the UII on the serial/equipment record |
| Inventory optimization (Servigistics, Baxter Planning) | Pool sizing for a target availability | Integrate. SAP feeds clean demand and turnaround history and holds the resulting stocking levels |
| ILS / Inventory Locator Service, PartsBase | Commercial aftermarket sourcing | Integrate loosely |
| Predictive maintenance / analytics platforms | Failure prediction, reliability engineering | Integrate. Defect codes and removal rates from SAP are the training data |
| DLA systems (EDI/portals) | Spares demand and delivery | Integrate |
| Deltek Cobra / Primavera P6 | Only on CLS contracts with EVMS or a phase-in schedule | Rare. Do not assume it |

## Dassian Fit

- **Contracts & Billing: yes.** A PBL contract is a periodic billing plan with incentive and disincentive adjustment lines that must tie auditably to a metric calculation; a transactional contract is a CLIN structure with DD250 acceptance; an O&A is a quotation and a separate billing line referencing an authorization. Standard SD gives you the sales document and the billing plan; it does not give you an ACRN, a DD250 acceptance billing summary, or a mod-controlled contract baseline. The flowdown clause library also matters because vendor repair subcontracts carry property clauses.
- **Cost Management: selective.** Needed where CLS cost-reimbursable elements are billed at provisional rates and trued up. Not needed on pure fixed-price PBL and transactional repair, where costing sheets and activity rates suffice.
- **Project Management / PPC: light.** A PBL program has a cost baseline, not an earned-value baseline. Use PPC only where a CLS contract carries an EVMS requirement or where the client wants time-phased cost planning by program.
- **Results Analysis / RAENH: yes, when the contract mixes PBL and transactional CLINs.** The POBs do not align to WBS elements, and classic PS RA cannot express a stand-ready obligation recognized ratably alongside a per-event obligation recognized at a point in time on the same contract. Where the depot runs pure transactional repair, classic RA (or no RA at all, since revenue is point-in-time) is correct.
- **SCFM: yes** where subcontracted repair volume is material. Vendor repair subcontracts carry funding, flowdown, and property-stewardship obligations.
- **Standard SAP suffices** for PM and CS in their entirety (notifications, service orders, refurbishment orders, task lists, warranty master data and warranty check), QM (inspection lots, defect catalogs, usage decisions), split valuation, serial number management, subcontracting, asset accounting, and all of hire-to-retire.

## Design Decisions and Traps

1. **Condition-based split valuation, decided before cutover.** Split valuation with condition valuation types; batch characteristics carrying condition; no condition tracking. **Recommend** split valuation for every rotable material, loaded directly into the correct valuation types at conversion. **Fails as:** batches do not revalue stock and do not work with refurbishment orders; and once stock or valuation history exists, SAP blocks the valuation category change, so the fix is a drain-and-reload migration per material per plant.
2. **Who carries the repair.** **Recommend** the ladder above. **Fails as:** a refurbishment order created without from/to valuation types puts an overhauled serial back into unserviceable stock, or an unserviceable one into serviceable. Make the valuation types mandatory in the order type's field selection and reconcile pool condition weekly.
3. **Over-and-above authorization gate.** Perform and bill later; a user status blocking operation release and goods issue on O&A operations until written authorization arrives. **Recommend** the status gate, and make it physically block, not decorate. **Fails as:** O&A work performed without authorization is a gift to the government, unbillable, and on GFP it may be a property administration finding as well.
4. **Customer property receipt posting zero value.** Sales order stock (special stock E, non-valuated); customer special stock B where the industry solution supports it; valuated receipt (never). **Recommend** sales order stock E, verified in test to post no FI document for the unit. **Fails as:** a mis-configured requirement class receives the customer's unit as valuated stock, overstating inventory and violating the property accounting principle.
5. **Protecting the ownership segment across movements and transfers.** **Recommend** restrict by authorization the movement types that convert special stock into contractor-owned unrestricted stock (internal storage-location moves within special stock preserve the indicator and are safe), and do not assume a vanilla STO carries the special stock indicator through a field-to-depot retrograde (it does not): design a deliberate two-step transfer or an account-assigned STO variant and make it an explicit test item. **Fails as:** a customer serial lands in contractor-owned stock, or a customer-owned carcass loses its ownership segment in transit from a field site. Either is an audit finding and a financial misstatement.
6. **RTAT clock-stop rules as status design, not reporting.** **Recommend** give each exclusion (awaiting GFP, awaiting customer decision, awaiting O&A approval, awaiting parts) a distinct user status with a timestamp, and negotiate the exclusions in the contract language at the same time. **Fails as:** on PBL the depot eats the government's decision latency in its metrics, and the fee calculation becomes a negotiation instead of a query.
7. **PBL metric data capture as a design requirement.** Build the metrics as reports after go-live; treat every status change and goods movement timestamp as contract data from day one. **Recommend** the second. **Fails as:** the availability number cannot be reproduced from the system, the government computes its own, and the contractor argues from spreadsheets.
8. **Government and contractor pools co-mingled.** **Recommend** segregate by stock segment and ownership at design time. **Fails as:** physical inventories, availability metrics, and property audits all require manual sorting, and auditors sample serials, not spreadsheets.
9. **Vendor turn time visibility.** **Recommend** include special stock at vendor, by serial, with days elapsed, in the pool status view, built in the first release. **Fails as:** units age at OEMs for quarters, invisible to shop reporting, and the program buys spares it already owns.
10. **Serial number profile rigor.** **Recommend** mandatory serialization procedures on goods movements, deliveries, and maintenance/QM, with the stock check indicator on, from day one. **Fails as:** users move serialized parts without serials, the installed base and serial history silently fork from reality, and retro-serializing is manual archaeology.
11. **Warranty check acted on at induction.** **Recommend** route an in-warranty return of the depot's own prior repair to a no-charge workscope with its own status, and create a recovery claim candidate automatically when teardown finds a failed component under vendor warranty. **Fails as:** the depot bills the customer for reworking its own warranty repair (a contract violation) or pays OEM-caused failures out of margin because recovery was never filed. Warranty recovery is real margin on engine and avionics programs.
12. **Refurbishment cost: capitalize or expense.** **Recommend** decide with the program Finance lead, document it as a cost accounting practice, and configure settlement accordingly. **Fails as:** an informal change in treatment mid-program is a CAS 401 consistency problem and distorts every pool-value report before and after.

## Discovery Questions

### People

1. Who owns install/dismantle discipline: production control, configuration management, or nobody? If mechanics move serialized parts with plain goods movements, the installed base rots in months.
2. Who is the certifying authority, how many are there, and what governs who may sign a release?

### Process

1. Ask the contracts administrator for the actual CLIN structure of the largest sustainment contract, not the program's marketing name. Is there a PBL CLIN, and what exactly does it measure?
2. Walk me through an induction: who verifies the serial against the paperwork, and what happens when they do not match?
3. What are the contractual RTAT clock-stop rules, does the system have a distinct status for each, and what physically prevents the shop from starting over-and-above work before authorization?

### Technology / Systems

1. Is there an existing maintenance system (Maintenix, TRAX, AMOS, IFS), who owns the installed base of record, and is it being replaced or integrated?
2. How are GFP transactions reported to PIEE today, and can the 7-day requirement be met?

### Data

1. Do rotable materials carry condition-based split valuation today? If not, what stock and open-document position would a conversion have to unwind?
2. Can you produce, right now, the pool status for a rotable material: serviceable stock by ownership, units at vendors with days elapsed, in-transit carcasses, and open refurbishment orders?
3. Is there a serialized installed base by tail number and position, and does the removal-rate denominator exist?

### Security / Authorizations

1. Which movement types can convert customer or government property into contractor-owned stock, and who has them today?

### Analytics & Reporting

1. If the government computed the availability metric independently from your data, would the numbers match? How do you know?

### Role of AI

1. Where would predicted workscope from teardown history, or automated O&A quotation drafting, save the most cycle time? Predictive failure is a reliability-engineering project, not an ERP one.

### Operating Model

1. On a PBL contract, does anyone in operations understand that every repair they perform is a cost and not a sale, and does the incentive structure for shop management reflect that?
