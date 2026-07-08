---
name: Naval Shipbuilder
description: Blueprint for a US naval shipbuilder under CPIF lead-ship and FPI follow-ship contracts; drives hull-as-project costing, ESWBS structures, government title to work in process, cross-hull material borrow control, and forward-loss provisioning in SAP.
license: internal
---

# Naval Shipbuilder

The longest-cycle, highest-change, most capital-intensive model in the catalog. A hull takes five to nine years, the contract is modified hundreds of times, the government takes title to work in process while it is still steel on a platen, and the lead ship is usually a loss recovered on the follow ships. Any design that treats a hull like a large production order fails in year one.

## Business Model

| Revenue line | Contract type | Economics | Design consequence |
| --- | --- | --- | --- |
| Lead ship / first-of-class | CPIF, sometimes CPFF or a UCA converting to CPIF | Near-zero or negative margin; the price of the franchise | Cost vouchers, EVMS-validated control, share ratio and ceiling modeling |
| Follow ships | FPIF then FFP; multi-year procurement or block buy | Margin arrives with the learning curve, 6 to 12 pct | Cost-to-cost POC, forward-loss testing, learning-curve EACs |
| Advance procurement / EOQ material | Separate CLIN or contract, funded years ahead of the ship | Material bought before the hull is under contract | Peg to a future hull; transfer at cost when the ship contract is awarded |
| Change orders, ECPs, REAs, claims | Definitized mods, undefinitized change orders (UCOs) | A substantial fraction of total revenue | Every mod is a scope, budget, and funding event; undefinitized work must be identifiable in the ledger |
| Availabilities, drydocking, modernization | CPAF, CPIF, FFP per availability | Shorter cycle, growth-work driven | Separate cost objects; growth-work authorization gates |
| Nuclear component and refueling work | Cost-reimbursable, NAVSEA 08 oversight | Unique regulatory overlay | Separate security and authorization boundary |

Economics driving SAP: the lead ship's loss is recognized immediately and in full as a forward loss provision, so the EAC is a P&L trigger that changes monthly, not a report. Under FAR 52.232-16 progress payments, title to WIP, material, and special tooling vests in the government as costs are incurred, turning the yard's WIP into government property with FAR 52.245-1 stewardship obligations. Cross-hull material borrow is operationally necessary and is precisely what MMAS Standard 4 prohibits absent a compliant mechanism. Change-order volume means the baseline is never stable. Capital is enormous (dry docks, cranes, covered ways), so CAS 409/414/417 and facilities capital cost of money are material to recovery.

## Enterprise Structure

- **Company code:** one CAS-covered code per shipyard legal entity. Yards performing commercial work (Jones Act hulls, offshore, commercial repair) should isolate it into its own code where it is a real, market-priced business; a captive commercial repair line rarely earns a firewall.
- **Controlling area:** one, spanning new construction and repair, so craft labor rates, shop overhead pools, and shared services allocate consistently.
- **Plants:** at minimum one for new construction and one for repair/availabilities, because material, MRP, and property paradigms diverge. Separate fabrication, assembly, and outfitting only if physical inventory and MRP actually differ; otherwise use storage locations and work centers. Valuation area = plant.
- **Work centers** by shop and trade (steel fabrication, pipe, electrical, machinery, paint, test) with real capacity and craft labor rates driving activity allocation and shop-load reporting. Craft rates are a CAS 418 question.
- **Profit center** = CAS segment / pool boundary (new construction, repair, engineering services). **Segment** = external reporting segment.
- **Project stock:** valuated (special stock Q) pegged to the hull. GPD grouping, pegging, and distribution are mandatory, not optional: hull-level pegging is what enforces MMAS Standard 4, and borrow-payback must be built on top of pegging, not around it.
- **Advance procurement material** bought before the ship contract exists needs a home: a dedicated AP project with a WBS per future hull, and a documented at-cost transfer to the ship WBS on award. Do not park it in plant stock.

## Value Stream Emphasis

| Workstream | Emphasis | Why | Signature SAP design |
| --- | --- | --- | --- |
| record-to-report | Critical | CAS pools/bases, forward-loss provisions, incurred cost submission, government title to WIP | Cost center hierarchy = pool structure; a forward-loss process reading the locked EAC; unallowable segregation by cost element |
| plan-to-perform | Critical | EVMS-validated, multi-year, thousands of control accounts per hull | ESWBS-aligned WBS, control accounts at CAM level, network activities as work packages, PPC for time-phased plan and EAC by hull and stage |
| design-to-release | High | Build strategy by unit, module, zone, stage; drawings released by zone | The 3D product model is the source; SAP holds the MBOM by stage/unit and the change master |
| plan-to-produce | Critical | Stage-of-construction erection sequence; steel, pipe, cable takeoff by unit | Production orders per unit/module settling to the hull WBS; routings by shop; material staged by unit; no anonymous MRP pooling |
| inventory-to-deliver | Medium | The ship is delivered once, after trials | Delivery and DD250 at ship delivery; the real problem is staging and kitting to the erection sequence, not outbound logistics |
| acquire-to-retire | Critical | Dry docks, cranes, covered ways, special tooling; capital under construction runs for years | Investment orders and AuC; CAS 409 lives; CAS 417 cost of money on capital under construction; special tooling title may vest in the government |
| sustainment-mro | High | Availabilities, drydocking, modernization, planning yard | Separate plant and order types; growth-work authorization gate; depot MRO patterns apply |
| source-to-pay | Critical | Massive material spend, long lead, DPAS DO/DX, specialty metals, domestic sourcing | Account-assigned procurement to hull project stock; DFARS 252.225-7008/-7009; Berry Amendment; long-lead PRs against the AP WBS; SCFM on combat systems and propulsion |
| offer-to-cash | Critical | Progress payments with title vesting, liquidation, hundreds of mods, REAs and claims | Dassian Contracts & Billing: CLIN/SLIN/ACRN, mod versioning, SF1443 progress payments, liquidation rate management |
| hire-to-retire | Critical | Craft labor is the dominant direct cost; union agreements; apprentice pipelines | CATS or a shop-floor time system with charge-object validation to hull/stage/unit; craft rate structure; headcount planning is a program input |
| security-authorization | High | Nuclear programs, CUI, controlled drawings, facility clearance | PFCG with org-level derivation; project-level restriction; nuclear data segregated; CMMC boundary includes the drawing repository |
| analytics-reporting | Critical | EAC by hull, learning curve, forward-loss exposure, growth work | CDS layer over ACDOCA plus PS plus PPC; period-locked close snapshot; a standing EAC-to-forward-loss bridge |
| development-technology | Medium-High | Borrow-payback, title-vesting property records, mod/UCO handling, stage-of-construction reporting | Those four are the near-universal extensions; resist everything else |

## Cost Object Strategy

The hull is a project. The project definition is the hull; the WBS is the Expanded Ship Work Breakdown Structure (ESWBS) mapped to the contract WBS (MIL-STD-881 sea-systems appendix governs the contract WBS). Get the mapping right in week one; it is the most consequential data model decision on the program.

1. Levels: project definition (hull), contract WBS levels 1 to 3 (product-oriented), control accounts, work packages. Control accounts number in the hundreds to low thousands per hull. Work packages are network activities.
2. **Do not build a 20,000-element WBS.** The second dimension (stage of construction, unit, zone) belongs on the network activity or production order, not as extra WBS levels. A WBS encoding both product and stage becomes unmaintainable across mods and unrecognizable to the CAM.
3. Production orders carry unit and module fabrication and outfitting, take account assignment from pegged project stock, and settle to the control-account WBS. The order's unit/stage reference enables erection-sequence reporting.
4. Internal orders: IRAD, B&P, capital, yard overhead collectors. Never a hull.
5. Availabilities: separate project (or service order under a repair project) in the repair plant. Growth work requires an authorization gate exactly like over-and-above in depot MRO: a user status blocking operation release and goods issue until the government authorizes.
6. Settlement: production order to control-account WBS with an allocation structure preserving cost element groups, so CAS pool identity survives settlement. Avoid WBS-to-WBS settlement.

Revenue recognition:

| Contract | Method | Notes |
| --- | --- | --- |
| CPIF lead ship | Cost-to-cost POC | Incentive fee is variable consideration; model target cost, ceiling, share ratio. The point of total assumption is a management metric, not just a pricing curve |
| FPIF / FFP follow ships | Cost-to-cost POC | Over time: no alternative use plus enforceable right to payment. Forward-loss provision at contract level unless hulls are separate contracts |
| Change orders, definitized | Modify transaction price, cumulative catch-up | The mod must be a document, not a note |
| Undefinitized change orders | Recognize the enforceable portion; constrain the rest | Authorized unpriced work is the classic overstatement risk |
| REAs and claims | Only when enforceable and probable of no significant reversal | Where restatements come from |
| Availabilities (CPAF/CPIF) | Cost-to-cost POC; award fee constrained | Growth work billed under its own authorization |

Classic PS Results Analysis (cost-based POC on the billing WBS) works where contract and project align. Dassian RAENH is needed where a contract carries multiple hulls as separate POBs, or where the POB boundary does not align to a WBS. Forward-loss provisioning is not something classic RA does gracefully: drive the loss posting off the locked EAC snapshot, carrying the reserve on a separate WBS or dedicated provision cost element so it never contaminates the POC numerator.

## Compliance Profile

All six DFARS 252.242-7005 business systems apply, and three are unusually consequential.

- **MMAS (252.242-7004)** is the defining compliance problem of shipbuilding. Standard 4 prohibits using material bought for one contract on another without a compliant transfer, yet yards borrow across hulls constantly because the erection sequence demands it. The compliant answer is a borrow-payback process: pegged project stock, a documented transfer posting moving value between hull WBS elements at cost, an aging report on outstanding paybacks, and a control preventing borrow from a hull whose contract is closed. Standards 1 (MRP validity), 3 (records), 6 (physical inventory accuracy), and 9 (system audits) all get tested.
- **Property (252.245-7003 / FAR 52.245-1)** is unusual here because progress payments under FAR 52.232-16(d) vest title to WIP, material, and special tooling in the government as cost is incurred. A substantial fraction of what the yard shows as inventory and CIP is government property. SAP must report government-title WIP by contract. Title vesting under the progress payment clause is not the same as GFP under FAR 52.245-1, and the two record sets are maintained differently: get contracts counsel to state the yard's position in writing before designing the reports.
- **EVMS (252.234-7002):** validated system required (DFARS 234.201: EIA-748 compliance at or above $20M; determined-compliant system at or above $100M).
- Accounting (252.242-7006), Purchasing (252.244-7001), and Estimating (252.215-7002) all apply at scale.

**CAS:** full coverage. The standards that bite: 407 (standard cost, where craft labor is standard-costed), 409 (depreciation on dry docks and cranes, lives differing from book), 414 and 417 (cost of money on facilities capital and on capital under construction, real money when a covered way is built over three years), 418 (pool/base homogeneity across new construction and repair), 420 (IR&D/B&P), 401/402 (why a cost element cannot be direct on a hull and indirect on an availability).

**Contract financing:** FAR 52.232-16 progress payments, customary 80 percent, liquidated against delivery invoices. Some ship contracts use performance-based payments (FAR 52.232-32). Model both the liquidation mechanics and the title vesting.

**Domestic sourcing:** Berry Amendment (DFARS 252.225-7012), specialty metals (252.225-7008/-7009), Buy American, plus shipbuilding-specific statutory sourcing restrictions on components such as anchor chain and propellers. Read the contract's clause list rather than relying on a checklist.

**Cyber and CUI:** DFARS 252.204-7012, 7019/7020/7021 (CMMC). Ship drawings are CUI. If the drawing repository or the DIR sits in SAP, SAP is in the assessment boundary.

**Nuclear work** carries an additional security, personnel, and records regime with its own access boundary. Assume nuclear program data does not live in the general SAP unless specifically authorized. **ITAR** applies to warship technical data; access is an authorization design.

## Surround Landscape

| System | Role | SAP posture |
| --- | --- | --- |
| Shipbuilding product model (CATIA, NAPA, ShipConstructor) | Product structure, steel and pipe takeoff, nesting, zone/stage definitions | Integrate. Source of the MBOM by unit and stage. SAP never replaces it |
| Teamcenter / Windchill | Configuration, ECR/ECO, drawing release | Integrate |
| Primavera P6 | The IMS: tens of thousands of activities, erection sequence, critical path | Integrate. PS networks hold work packages; P6 holds the schedule |
| Deltek Cobra / MPM / wInsight | EVM engine, CPR/IPMDAR rendering | Integrate. Replacing a validated EVMS mid-program is a program-risk conversation, not an IT one |
| ProPricer | Proposal and change-order pricing, forward pricing rates | Integrate. Mod volume makes this a high-traffic seam |
| MES / shop floor | Work order execution, buyoff, weld records, nonconformance | Integrate. Confirmations and consumption to SAP orders |
| PIEE (WAWF, GFP, SPRS) | Progress payment requests, DD250, GFP transactions | Integrate |
| Shop-floor badge / labor collection | Craft labor hours by hull, stage, unit | Integrate to CATS. The largest cost driver in the enterprise |
| Kinaxis / o9 | Rarely useful | Skip. Long-cycle pegged material does not benefit from a rapid-replan engine |

## Dassian Fit

Every vertical, and Contracts & Billing hardest of all.

- **Contracts & Billing:** mandatory. Mod volume alone justifies it. Standard SD has no concept of a contract modification with a versioned scope snapshot, an ACRN funding line, an authorized-unpriced-work envelope, or a progress payment request with a liquidation rate. Dassian's mod engine (snapshot the contract, apply Block 14 changes, control which fields the mod may touch) is exactly what a yard's change-order machine needs.
- **Cost Management:** mandatory. Multi-pool, multi-year rate decks with forward pricing rate agreements and a year-end true-up; craft labor rates as resource rates; overhead applied provisionally and revalued.
- **Project Management / PPC:** mandatory if SAP is the EVM system of record. Baseline/EAC/revenue version families and CAM assignment map onto the yard's program-control organization. Bid projects and bid estimating also serve change-order pricing.
- **Results Analysis / RAENH:** mandatory when hulls are separate POBs under one contract. Classic PS RA suffices when contract = project = POB.
- **SCFM:** mandatory. Combat systems, propulsion, and major equipment subcontracts run to hundreds of millions with their own funding and flowdown status.
- **Flowdowns / clause library:** mandatory. CPSR exposure is continuous.
- **Standard SAP suffices** for MM, IM, WM, PM, QM, asset accounting (including AuC and CAS-distinct depreciation areas), GL, AP, AR, and hire-to-retire outside the craft-rate structure.

## Design Decisions and Traps

1. **WBS dimensionality: product vs stage.** Encode both; product WBS with stage on the activity/order; two parallel structures. **Recommend** product-oriented WBS aligned to contract WBS and ESWBS, with stage/unit/zone on the network activity and production order. **Fails as:** a two-dimensional WBS explodes to tens of thousands of elements, every mod requires restructuring, and the CAM cannot find the control account.
2. **Cross-hull material borrow.** Forbid it (unrealistic); allow with a manual log; pegged borrow-payback with a value transfer and aging report. **Recommend** the third. **Fails as:** an MMAS review finds hull-3 material consumed on hull 2 with no transfer, a significant deficiency triggering payment withholds.
3. **Advance procurement material home.** Plant stock until award; a dedicated AP project with a WBS per future hull; a placeholder hull WBS. **Recommend** the second, with a documented at-cost transfer on award. **Fails as:** AP material in plant stock is fungible, gets consumed by whatever needs it, and the appropriation that paid for it cannot be traced.
4. **EAC ownership and the forward-loss trigger.** **Recommend** program controls produces it, finance reviews it, and the EAC of record is a locked snapshot at close. **Fails as:** two EACs mean the forward-loss provision is negotiated rather than calculated, which is exactly the pattern the SEC looks for.
5. **Undefinitized change order accounting.** Recognize the full not-to-exceed value; recognize nothing until definitization; recognize the enforceable portion with the rest constrained. **Recommend** the third, with UCO scope identifiable as its own budget element on the control account. **Fails as:** revenue recognized on an NTE value that later definitizes lower produces a restatement.
6. **Government title to WIP.** Ignore it and handle it in footnotes; tag contracts with title-vesting status and report government-title WIP by contract; treat all progress-payment WIP as government property. **Recommend** the second, after counsel writes down the position. **Fails as:** an inventory the balance sheet says the yard owns and the contract says the government owns, discovered during an audit.
7. **Craft labor rates: standard or actual.** **Recommend** activity rates by work center and craft, set annually as forward pricing rates, variance analyzed at the shop cost center. **Fails as:** actual-rate-by-employee costing is a CAS 401 consistency problem and makes every EAC unreproducible.
8. **Repair and new construction in one plant.** **Recommend** separate plants, one company code, one controlling area, distinct profit centers so pool/base structures can differ under CAS 418. **Fails as:** co-mingled plants mean the availability's growth-work material and the hull's pegged material share MRP and storage, which is both an MMAS and a property problem.
9. **Growth work on availabilities.** Perform and bill later; a status gate blocking release until authorized; a separate order per growth item. **Recommend** a status gate plus separately identifiable operation grouping for the growth scope. **Fails as:** growth work performed before authorization is unbillable; the yard eats it and the PM finds out at close.
10. **Mod handling.** A new sales document per mod; a Dassian contract with mod versioning; a spreadsheet register. **Recommend** Dassian with a field-control matrix. **Fails as:** after mod 180, nobody can state current authorized scope, funding by ACRN, or ceiling without a two-week reconstruction.
11. **Capital under construction and cost of money.** **Recommend** capitalize and compute COM under CAS 414 and 417 with DD Form 1861 output. **Fails as:** leaving COM on the table is a cash giveaway on a multi-year dry dock; taking it without AuC records to support it is an audit finding.
12. **Timekeeping charge-object validation.** **Recommend** validate the hull/stage/unit charge object at entry against the employee's authorized objects. **Fails as:** DCAA floor checks fail, an accounting-system deficiency follows, and the labor distribution cannot be defended on a REA.

## Discovery Questions

### People

1. How many control accounts exist on the largest hull, how many CAMs, where are CAM assignments maintained, and do craft labor agreements constrain how hours are recorded (minimum charge increments, trade-jurisdiction rules)?

### Process

1. Describe how material bought for hull N gets consumed on hull N-1 today, and show me the paperwork that makes it MMAS-compliant.
2. What is the current UCO process from receipt of direction to definitization, and how long does definitization take on average?
3. When were the last MMAS review, EVMS surveillance review, and CPSR, and what remains open?

### Technology / Systems

1. Which system holds the product model, and how does the MBOM reach the ERP by unit and stage?
2. Is the EVMS validated, on which tool, and would the customer accept a change of EVM system of record mid-program?
3. How are craft labor hours collected on the waterfront, and is the charge object validated at entry?

### Data

1. Show me the ESWBS to contract WBS mapping. Is it maintained as data or as a document?
2. Can you produce government-title WIP by contract as of last month end?

### Security / Authorizations

1. Is nuclear work performed in this entity, and what separates that data from the general ERP?
2. Where do controlled ship drawings live, and is that repository in the CMMC assessment boundary?

### Analytics & Reporting

1. Which EAC drives the forward-loss provision, who locks it, on what calendar, and can you report cost by stage of construction reconcilable to the general ledger?

### Role of AI

1. Where do change-order pricing and REA preparation consume the most estimator hours? That is the highest-value AI target here, not shop-floor optimization.

### Operating Model

1. Does program controls report to the program manager or the CFO, and who may change an EAC after close?
