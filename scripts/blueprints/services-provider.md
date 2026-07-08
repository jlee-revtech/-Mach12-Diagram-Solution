---
name: Professional and Engineering Services Provider
description: Blueprint for a government services contractor delivering labor under T&M, CPFF, and FFP LOE task orders against IDIQ vehicles; drives labor-centric costing, DCAA-compliant timekeeping, provisional indirect rate billing, and the right-to-invoice rev-rec expedient in SAP.
license: internal
---

# Professional and Engineering Services Provider

A services contractor sells hours. There is no inventory, no production order, no bill of material. Eighty to ninety percent of cost is labor and its associated fringe, overhead, and G&A. The ledger's only real job is to accumulate cost by contract and employee, apply provisional indirect rates, and produce an invoice DCAA will accept. Every SAP program at a services firm that fails, fails because someone treated it as a manufacturing implementation with the manufacturing turned off, instead of a labor-costing and billing implementation with an ERP attached.

The incumbent is almost always Deltek Costpoint (or Unanet, JAMIS), and it does one thing extremely well: it turns a timesheet into a compliant voucher. SAP can do this, and does it better once contract complexity rises, but only if the design starts from the timesheet and works outward.

## Business Model

| Contract type | How the money works | What must exist |
| --- | --- | --- |
| T&M / Labor Hour (FAR 52.232-7) | Bill hours at a fixed rate per labor category, plus materials and ODCs at cost with a handling rate; a ceiling price caps total billing | LCAT on every hour; employee-to-LCAT qualification mapping; ceiling monitoring by CLIN; billing rate table by LCAT by contract year |
| CPFF (completion form) | Reimburse allowable cost, pay a fixed fee; the deliverable is an outcome | Cost by contract at provisional rates; fee accrual on negotiated cost; POC recognition |
| CPFF (term form / LOE) | Reimburse cost for a level of effort over a period; fee earned by delivering the hours | Hours-delivered tracking against the LOE commitment; fee earned ratably with hours |
| CPAF | Cost plus base fee plus award fee by evaluation period | Award fee constrained to probable amounts per period |
| FFP LOE | Fixed price for a stated level of effort | Over-time recognition on hours delivered |
| FFP deliverable | Fixed price for a defined product (a study, a system, a report) | POC or milestone recognition |
| IDIQ vehicles (GSA MAS, OASIS+, SEWP, CIO-SP) | The vehicle is a hunting license; revenue comes from task orders | The vehicle is not a contract object. The task order is |

The firm makes money on the spread between the billing rate and the fully loaded cost of the hour, multiplied by utilization. Indirect rates are the entire margin story: bid at a rate, incur at a rate, bill at a provisional rate, settle at a final negotiated rate years later. A firm that overruns its bid overhead rate on an FFP LOE contract loses money it cannot recover; a firm that underruns its provisional rate on a cost-type contract owes money back. The rate structure is not accounting plumbing, it is the product. Second driver: whether G&A applies to subcontract dollars and whether a materials-handling rate applies to ODCs is worth millions and is defined by the disclosed cost accounting practice, not by preference.

## Enterprise Structure

- **Company code:** one per legal entity. Services firms grow by acquisition. Where an acquired unit has a materially different rate structure or CAS status, keep the code separate until the pools are harmonized: CAS 401/402 consistency makes a forced merge of rate structures a disclosure-statement change requiring a cost-impact analysis.
- **Controlling area:** one, spanning all codes, for consolidated rate application, a single cost center hierarchy, and one employee/resource pool.
- **Segment:** services firms typically operate multiple CAS segments with distinct rate structures. Model the segment as a profit center node and, where required externally, as the S/4 Segment. **A segment is a rate structure, and a rate structure is a cost center hierarchy node.**
- **No plants** in the manufacturing sense. Create one plant per company code to satisfy purchasing prerequisites and expensed material, and nothing more. Do not implement inventory management.
- **The structural dimension nobody expects: on-site versus off-site overhead.** Most services firms disclose separate overhead pools for work at government facilities (on-site, lower overhead because the government provides the facility) and at contractor facilities (off-site). The pool determination is per contract, sometimes per task order. This must be a **derivable attribute of the charge object**, not a manual timesheet selection, or the labor distribution is wrong and the disclosure statement violated.
- **Cost centers: the hierarchy IS the indirect rate structure.** Fringe pool, overhead pools (on-site, off-site, by segment), G&A pool, and the associated bases (total cost input or value-added). Unallowable cost centers or cost elements sit outside the pools. Get this right in week one; everything downstream depends on it.
- Where a genuine commercial services business of scale exists, separate the company code: a commercial entity holding no CAS-covered contract is not a CAS-covered business unit. A small commercial book folds in.

## Value Stream Emphasis

| Workstream | Emphasis | Why | Signature SAP design |
| --- | --- | --- | --- |
| record-to-report | Critical | The rate structure, the incurred cost submission, and the invoice all live here | Cost center hierarchy = pools and bases; provisional rate application via costing sheets or assessment cycles; unallowable segregation; an annual incurred-cost extract |
| plan-to-perform | High | Task orders have budgets, funding limits, EACs, burn rates; EVMS is rare | WBS per task order/CLIN; funded value tracked separately from total value; funding-limit alerts at 75 and 85 pct; no earned value unless imposed |
| design-to-release | Low | No product. Deliverables are documents and software | Skip. Where the firm delivers software, its SDLC lives outside SAP |
| plan-to-produce | Low | No manufacturing | Skip entirely. Do not install PP |
| inventory-to-deliver | Low | No inventory. ODCs and materials are expensed on receipt against the contract | Direct account assignment on the PO to the WBS; no stock, no valuation |
| acquire-to-retire | Low to Medium | Laptops, lab equipment, leasehold improvements; GFE in employee hands | Standard asset accounting; GFE as non-valuated equipment records with custodial assignment |
| sustainment-mro | Low | Not applicable unless the firm operates equipment | Skip |
| source-to-pay | Medium-High | Subcontractor labor is often 30 to 50 pct of revenue; consent to subcontract; ODC pass-through | PO per subcontract with account assignment to the WBS; subcontractor invoice matched to subcontractor timesheets; handling-rate and G&A application per disclosed practice; FAR 52.244-2 consent tracking |
| offer-to-cash | Critical | Cost vouchers, T&M invoices with LCAT rate tables and ceiling checks, provisional-to-final true-up, fee withholding | Dassian Contracts & Billing supporting cost-based billing at provisional rates, T&M rate tables, ceiling and funding checks, fee withholding under FAR 52.216-8 |
| hire-to-retire | Critical | Labor is the product. Timekeeping is the primary accounting record and the primary audit target | Timesheet with charge-object validation, daily entry, employee-owned entries, supervisor approval, full change audit trail with reason codes; labor distribution; LCAT and qualification data |
| security-authorization | High | Facility clearance, program access, PII in HR data, CUI in deliverables | PFCG with derivation; timesheet and labor-cost visibility restricted by organization; contract-level restriction where programs are compartmented |
| analytics-reporting | Critical | Utilization, realization, indirect rate variance, EAC by task order, funded backlog, DSO | CDS layer over ACDOCA plus CATS plus PS; a monthly rate variance report finance actually uses to set the next provisional rates |
| development-technology | Medium | Timesheet UX, LCAT validation, ceiling checks, ICS extract | The timesheet is the extension that must be excellent. Everything else stays clean core |

## Cost Object Strategy

- **The cost object is the WBS element.** One project per contract; one WBS branch per CLIN or task order; one element per funding line where funding is incrementally released. Depth beyond three or four levels is almost always a mistake.
- Every direct labor hour posts to a WBS element with an activity type. Every subcontractor invoice and ODC posts to a WBS element. Indirect labor posts to cost centers. That is the whole model.
- **No production orders. No internal orders for contract work.** Internal orders are for B&P, IR&D, capital, and overhead collectors. B&P and IR&D settle into the G&A or IR&D pool per CAS 420; a B&P cost landing on a contract WBS is unallowable direct cost and a serious finding.
- Labor rate design:

| Option | Mechanism | Fits | Risk |
| --- | --- | --- | --- |
| Actual employee rate | Each employee's actual salary rate posts to the cost object | Small firms; firms with a disclosed actual-rate practice | Exposes individual salaries to anyone with cost-object display; heavy master data churn |
| Average / category rate | Activity type per labor category or cost center, priced annually, variance to the cost center | Most mid-size firms | Rate variance must be allocated defensibly (CAS 418) |
| Standard rate with true-up | Activity rate at forward pricing, revalued at actual | Firms with FPRAs | Requires a revaluation run and an audit trail |

Recommend average/category rate via activity types above roughly 500 employees, actual employee rate below that. Whichever is chosen becomes a **disclosed cost accounting practice**, and changing it later requires a CAS 401 cost-impact analysis.

- Indirect rate application: fringe on labor cost, overhead (on-site or off-site) on labor plus fringe, G&A on total cost input or a value-added base. Implement as costing-sheet overhead on the cost object, or via Dassian's forward-rate engine with rate decks by fiscal year. Provisional rates apply during the year; the year-end true-up revalues cost and drives the final voucher and the incurred cost submission.

Revenue recognition:

| Contract | Method | Notes |
| --- | --- | --- |
| T&M / LH | Right-to-invoice expedient (ASC 606-10-55-18) | Revenue equals the invoiceable amount. Ceiling and funding constraints cap it |
| CPFF completion | Cost-to-cost POC | Fee recognized proportionally on the negotiated fee |
| CPFF term / LOE | Hours delivered, or right to invoice | Fee earned as the LOE is delivered, not as cost is incurred. A firm running hot on senior labor delivers fewer hours and earns less fee |
| CPAF | Cost plus base fee; award fee constrained | Evaluated per award-fee period |
| FFP LOE | Over time on hours delivered | An output measure |
| FFP deliverable | POC or milestone | Depends on whether control transfers over time |

Classic PS Results Analysis handles the POC cases on the billing WBS. **For T&M and cost-type right-to-invoice contracts, the revenue is literally the invoice; do not run POC on them.** RAENH becomes relevant when a task order carries multiple POBs on different patterns.

Funding control is a first-class requirement, not a report. FAR 52.232-22 (Limitation of Funds) obliges notification at 75 percent of funded value; FAR 52.232-20 (Limitation of Cost) at 75 percent of estimated cost. Model funded value and total value as distinct amounts on the WBS, with budget availability control triggering warnings and hard stops. A firm working past its funded ceiling has performed at risk and may never be paid.

## Compliance Profile

- **Accounting System (DFARS 252.242-7006): the defining requirement.** Its criteria are effectively the SAP design spec: direct/indirect segregation; identification and exclusion of unallowables (FAR 31.201-6, CAS 405); timekeeping identifying labor by intermediate and final cost objective; labor distribution charging direct and indirect labor to appropriate cost objectives; interim determination of contract costs through routine posting to books of account; exclusion from billings of amounts unallowable under FAR 31; billings reconcilable to the cost accounts.
- **Purchasing (252.244-7001):** applies once a CPSR triggers. Subcontract consent under FAR 52.244-2, price/cost analysis documentation, flowdowns.
- **Estimating (252.215-7002):** at $50M of prior-year DoD cost-type awards (or $10M with a CO determination).
- **EVMS (252.234-7002):** rarely applies. Large systems-engineering and technical-assistance contracts occasionally carry it. Do not build EVMS speculatively.
- **MMAS (252.242-7004):** does not apply. There is no material.
- **Property (252.245-7003 / FAR 52.245-1):** applies wherever GFE exists (laptops, test equipment). Custodial records and physical inventory.
- **CAS:** modified coverage is the norm; full coverage arrives with scale. Modified applies CAS 401, 402, 405, 406 only. Full brings 403 (home office), 410 (G&A base), 418 (pool and base homogeneity), 420 (IR&D/B&P). Confirm current thresholds against 48 CFR 9903.201-2 and the solicitation; the FY2026 NDAA changed them and the conforming regulation lags. Practical CAS 418 impact: the on-site/off-site pool split must be homogeneous and causally allocated, and the government will test it.
- **Rates:** FAR 42.704 (provisional billing rates), FAR 42.705 (final indirect cost rates), FAR 52.216-7 (Allowable Cost and Payment), requiring the incurred cost proposal within six months after fiscal year end. The DCAA ICE model schedules must be producible from SAP with minimal manual assembly; Schedule H (claimed direct cost by contract) is the reconciliation that catches every design shortcut.
- **DCAA floor checks:** an auditor arrives unannounced and asks an employee what charge number they are working on, then compares it to the timesheet. Controls that survive: employee enters own time daily, changes require a reason code and leave an audit trail, supervisors approve, charge objects are validated against authorized assignments and effective dates.
- **Labor standards:** Service Contract Labor Standards (FAR 52.222-41) imposes wage determinations and fringe minimums on non-exempt service employees, reaching the cost model through the wage determination attached to the contract. Davis-Bacon (FAR 52.222-6) applies to construction work.
- **Uncompensated overtime:** exempt employees working over 40 hours dilute the effective hourly rate. DCAA expects total time accounting where the firm records all hours worked; FAR 52.237-10 governs uncompensated overtime in proposals. The timesheet must capture all hours and the labor distribution must dilute the rate accordingly, or the firm has overcharged the government.
- **Cyber:** DFARS 252.204-7012, 7019/7020, 7021 (CMMC). Deliverables and technical data are CUI. The timesheet system holds PII, not CUI; the deliverable repository holds CUI.
- **Set-asides (8(a), SDVOSB, WOSB, HUBZone):** limitations on subcontracting (FAR 52.219-14) require the prime to perform a minimum percentage of the cost of contract performance incurred for personnel. That percentage must be measurable from the ledger, by contract.

## Surround Landscape

| System | Role | SAP posture |
| --- | --- | --- |
| Deltek Costpoint / Unanet / JAMIS | Incumbent ERP: timekeeping, labor distribution, billing, incurred cost | Replace. Risks are incurred-cost continuity, disclosed practice continuity, and the timesheet's user experience |
| Deltek Time & Expense | The timesheet | Replace with CATS plus a purpose-built Fiori timesheet, or retain and integrate. The audit controls are the requirement, not the tool |
| ProPricer / Deltek Cost Volume | Proposal pricing, rate build-up | Integrate. SAP supplies historical actuals and the rate structure |
| GovWin IQ / Salesforce | Capture and pipeline; the vehicle and task-order funnel | Integrate. Task-order award seeds the project and funding |
| PIEE (WAWF/iRAPT), IPP, agency portals | Invoice submission | Integrate. Cost vouchers and T&M invoices go out through these |
| DCAA ICE model workbooks | Incurred cost submission | Replace the source with a CDS extract; keep the workbook format |
| SuccessFactors / Workday / ADP | HR, payroll, LCAT and qualification data | Integrate. Employee master, LCAT, clearance level, labor rate flow into the cost model |
| Primavera P6 / MS Project | Occasionally on large SETA contracts | Integrate only if the customer requires an IMS |
| Deltek Cobra | Only where EVMS is imposed | Rare. Do not assume it |

## Dassian Fit

- **Contracts & Billing: yes, and this is the core reason a services firm chooses SAP plus Dassian over standard SD.** Standard SD cannot produce a cost voucher that applies provisional indirect rates by pool to the current period's incurred cost, checks it against a funded ceiling and a total ceiling by CLIN, withholds fee under FAR 52.216-8, and reconciles to the ledger. Dassian's cost-based billing engine (CLIN/SLIN, fee, fee retention, overhead conditions) is built for exactly this. T&M billing with an LCAT rate table by contract year is also a Dassian pattern.
- **Cost Management: yes.** The forward-rate engine, rate decks by fiscal year, provisional rate application, and cost revaluation at final rates is the single most valuable Dassian capability here. Building it with costing sheets alone means a manual revaluation project every year.
- **Project Management / PPC: light, or skip.** Time-phased plan and EAC by task order is useful. Full EVM (BCWS/BCWP, CAM assignment, IPMDAR) is over-scoped unless the customer imposes EVMS.
- **Results Analysis / RAENH: selective.** Classic PS RA handles POC on CPFF completion and FFP deliverable contracts. RAENH earns its keep when a large task order carries multiple POBs, or when POBs cross projects.
- **SCFM: light.** Useful where subcontractor labor is a large fraction of revenue and subcontract funding must be tracked against prime funding. Many firms manage this with PO commitment tracking and a funding report.
- **Flowdowns / clause library:** yes if a CPSR is on the horizon.
- **Standard SAP suffices** for GL, AP, AR, asset accounting, purchasing, CATS (with a good custom front end), cost center accounting, and the entire absence of PP, MM inventory, QM, and PM.

## Design Decisions and Traps

1. **Timesheet: CATS with a custom Fiori front end, retain Deltek T&E, or a third-party tool.** **Recommend** CATS as the data store with a purpose-built UI enforcing daily entry, employee ownership, change reason codes, supervisor approval, and charge-object validation against authorized assignments and effective dates. **Fails as:** a timesheet permitting a manager to enter time for an employee, or allowing a silent edit, fails a floor check and puts the accounting system determination at risk, triggering payment withholds.
2. **On-site vs off-site overhead pool derivation.** Manual timesheet selection; derived from the charge object; derived from the employee's assignment. **Recommend** derived from the charge object, with the WBS carrying the pool attribute, because the contract determines the pool. **Fails as:** employees pick the wrong pool, labor distribution is systematically misallocated, and the disclosure statement is violated across every voucher for a year.
3. **Labor rate basis.** **Recommend** average category rate via activity types above roughly 500 employees; actual below. It must match the disclosure statement. **Fails as:** switching later is a CAS 401 change requiring a cost-impact proposal and possibly a payment to the government.
4. **Where the indirect rate lives.** Costing sheets and assessment cycles; Dassian FR rate decks; a spreadsheet plus journal. **Recommend** Dassian FR, or period-dependent costing sheets if the structure is genuinely simple (one fringe, one overhead, one G&A). **Fails as:** a rate in a spreadsheet means the voucher cannot be reproduced from the ledger, an accounting-system criterion failure by definition.
5. **Funded value vs total value.** **Recommend** track both, with an active alert at 75 percent of funded value per FAR 52.232-22 and a hard block requiring a documented override. **Fails as:** the program works past the funded ceiling, the CO declines to ratify, and the firm eats a quarter of a task order.
6. **Uncompensated overtime.** Record 40 hours regardless; record all hours and dilute; record all hours but do not dilute. **Recommend** record all hours and dilute (total time accounting), consistent with the disclosed practice. **Fails as:** recording 40 while working 55 overcharges the government on cost-type work, the fact pattern behind more than one False Claims Act settlement.
7. **G&A on subcontract and ODC dollars.** **Recommend** whatever the disclosure statement says, implemented in configuration and never overridden manually. **Fails as:** a manual override in the billing spreadsheet inflates invoices; the government recovers with interest and FAR 42.709 penalties.
8. **The IDIQ vehicle as a contract object.** Vehicle as a contract with task orders as line items; vehicle as a master agreement with each task order its own contract and project. **Recommend** the second. **Fails as:** a five-year GWAC modeled as one contract with 300 task-order lines becomes unusable, and funding, ceiling, and rev-rec all break at the task-order level, which is where they live.
9. **B&P and IR&D containment.** **Recommend** internal orders (or a dedicated indirect project hierarchy) with settlement restricted to the pool per CAS 420. **Fails as:** B&P labor on a contract charge number is unallowable direct cost and, if routine, a fraud referral rather than an adjustment.
10. **Incurred cost submission as a design requirement.** Build the ICE schedules by hand each year; design the cost object and cost element structure so the schedules are queries. **Recommend** the second, proven by a dry-run submission from the test system before go-live. **Fails as:** the first ICS after go-live takes four months, does not tie to Schedule H, and DCAA's inadequacy determination puts next year's provisional rates at risk.
11. **Limitations on subcontracting (set-aside firms).** **Recommend** make the prime's share of personnel cost a query over the ledger by contract, with a monthly dashboard. **Fails as:** breaching FAR 52.219-14 is a size-status and eligibility problem, not just a billing problem.
12. **How much of SAP to install.** **Recommend** install nothing in PP, QM, PM, WM, or MM inventory. **Fails as:** a services firm with a plant, a material master, and a production planner has spent two million dollars building a warehouse for hours.

## Discovery Questions

### People

1. Who owns the indirect rate structure, and can that person explain the on-site versus off-site pool determination without opening a spreadsheet?
2. How many employees, how many are exempt, and does the firm practice total time accounting?

### Process

1. Walk me from a Tuesday afternoon timesheet entry to the line on the March cost voucher. Name every system and every human touch.
2. What happens today when an employee needs to change a prior week's timesheet?
3. When were the last DCAA floor check, accounting system audit, and incurred cost audit, and what remains open?

### Technology / Systems

1. Is Costpoint or Unanet in place, and which module is the firm most afraid to give up? (The answer is always the timesheet or the billing engine.)
2. How are LCAT qualifications and clearance levels maintained, and in which system?

### Data

1. Can you produce claimed direct cost by contract (ICE Schedule H) from the system today, and does it tie to the general ledger without adjustment?
2. Do you track funded value and total value separately on every task order, and where?

### Security / Authorizations

1. Who can see an individual employee's labor rate today, is that acceptable to HR, and are any contracts compartmented such that program cost data must be invisible to the rest of finance?

### Analytics & Reporting

1. What is the current-year provisional overhead rate, the year-to-date actual, and who watches the variance, how often?
2. What is utilization, how is it defined, and is that definition the same one used to set the bid rates?

### Role of AI

1. Where does time actually go: assembling the incurred cost submission, reconciling subcontractor invoices to subcontractor timesheets, or writing task-order status narratives? Those are the AI candidates.

### Operating Model

1. Are contracts, program, and finance aligned on who owns the EAC and who may change a billing rate table?
