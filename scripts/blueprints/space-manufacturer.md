---
name: Space Manufacturer (Spacecraft, Launch, Payloads)
description: Blueprint for a satellite, launch vehicle, or payload manufacturer selling to NASA, Space Force, and commercial operators; drives unit-of-one project costing, NASA 533 reporting, orbital-incentive variable consideration, and a mixed CAS/commercial-item compliance posture in SAP.
license: internal
---

# Space Manufacturer (Spacecraft, Launch, Payloads)

Space is A&D with the volume removed and the risk concentrated. Two very different animals live here and the design must be told which one it serves: the traditional NASA / national-security space contractor (cost-reimbursable, NASA 533 reporting, full CAS) and the commercial space company (competitive FFP milestones, Space Act Agreements, vertical integration). Most clients are a hybrid drifting toward the second.

## Business Model

| Revenue line | Contract type | Economics | SAP consequence |
| --- | --- | --- | --- |
| NASA science / exploration | CPFF, CPAF, occasionally CPIF | Fee 6 to 10 pct, award fee on milestones | Cost vouchers; NASA Form 533M/533Q per NFS 1852.242-73 |
| National security space | CPIF for development, FFP after prototype, OTA prototype | Classified overlays, rapid tranches | Program WBS, heavy security overlay, milestone payments |
| Commercial GEO/LEO satellites | FFP with orbital incentive payments over on-orbit life | Incentives 5 to 15 pct of price, paid annually for 15 years | Variable consideration constrained; significant financing component |
| Launch services | FFP per launch, mission assurance premiums | Reusability makes launch an asset-utilization business | Booster as serialized asset with cycle counters; refurbishment per flight |
| Rideshare / hosted payload | FFP per kg or per port | High volume, low touch | Point-in-time recognition; do not over-engineer |
| Space Act Agreements | Milestone payments, no FAR clauses | Paid on milestone achievement, not cost | No cost voucher, but milestone evidence must be auditable |

Economics driving SAP: unit of one, so there is no learning curve and no meaningful standard-cost variance; engineering is 40 to 60 percent of cost, so design-to-release and labor distribution outweigh plan-to-produce; nonconformance is expensive and configuration is contractual, so as-built traceability to the piece part is a requirement; if the company holds any full-CAS-covered contract, CAS 403 reaches every segment including the commercial satellite line. Commercial space companies deliberately structure to stay competitive-FFP and commercial-item so CAS never attaches, and the ERP design must protect that posture rather than undermine it.

## Enterprise Structure

- **Company code:** separate the government-contracting entity from the commercial launch/satellite entity where the commercial business is real and market-priced. This is the highest-value structural move a commercial space company makes: it keeps competitive FFP work out of the CAS-covered business unit and off the DCAA cost-audit surface. Where government work dominates, one CAS-covered code and a profit-center split.
- **Controlling area:** one, spanning all codes. Space companies acquire aggressively; one controlling area lets an acquired propulsion shop consolidate without a costing re-platform.
- **Plants:** one per site (integration and test, propulsion, avionics, launch site, recovery/refurbishment). Valuation area = plant. Cleanroom and bonded storage are storage locations, not plants.
- **Stock:** valuated project stock (special stock Q) pegged to the spacecraft or vehicle WBS; GPD grouping and pegging on for government plants. Commercial launch vehicle production is closer to serial manufacturing and can legitimately run plant stock with make-to-stock strategies. That divergence is another reason to separate the entities.
- **Profit center** = CAS segment / rate pool boundary. **Segment** = external reporting segment (Launch, Satellites, Services).
- **Asset accounting** matters more than at a typical prime: launch infrastructure, test stands, cleanrooms, and (for reusable vehicles) the flight hardware itself are capital. A recovered booster is a serialized asset with a flight counter, depreciated unit-of-production over expected flights. Link the asset to an equipment master so refurbishment orders settle against it.

## Value Stream Emphasis

| Workstream | Emphasis | Why | Signature SAP design |
| --- | --- | --- | --- |
| record-to-report | Critical | CAS pools on the government side; rapid close and cash discipline commercially | Cost center hierarchy = pool structure; unallowables segregated; 533M/533Q as a CDS extract from ACDOCA plus PS, not a spreadsheet |
| plan-to-perform | Critical | NASA and SSC impose EVMS; NPR 7120.5 gates the NASA lifecycle (KDP-A through KDP-E) | MIL-STD-881 space-systems WBS; control accounts with CAM; PPC time-phased plan; NASA 533 is a distinct report family from the DoD IPMDAR |
| design-to-release | Critical | Engineering dominates cost; configuration is contractual; ECRs run constantly through PDR/CDR | PLM owns EBOM/CAD; SAP change master for MBOM revisions; DIRs under export control; as-designed to as-built comparison is a real requirement |
| plan-to-produce | Medium-High | Unit of one; assembly is integration; MRB and rework dominate | Production orders per major assembly settling to WBS; heavy QM (inspection lots, defect catalogs, MRB notifications); piece-part serialization on Class S hardware |
| inventory-to-deliver | Medium | Delivery may literally be a launch; acceptance may occur on orbit | Outbound delivery plus DD250 on government work; the revenue trigger may be launch or on-orbit checkout, not shipment |
| acquire-to-retire | High | Launch infrastructure, test stands, reusable flight hardware, NASA-owned facilities in custody | Investment orders and AuC; unit-of-production depreciation for boosters; CAS 409 lives distinct from book; FCCOM under CAS 414 |
| sustainment-mro | High for launch, Low for satellites | Booster refurbishment between flights is depot MRO under another name | Refurbishment order (PM04) against the serialized booster; condition-based split valuation on recovered engines; flight-cycle measurement points |
| source-to-pay | High | EEE parts screening, lot acceptance, DPAS, long-lead items ordered before authorization to proceed | Account-assigned procurement to project stock; source approval and QPL enforcement; batch management carrying lot-acceptance-test results; long-lead PRs against a pre-award WBS |
| offer-to-cash | High | Orbital incentives, milestone payments, and cost vouchers coexist | Dassian Contracts & Billing on the government side; milestone billing plans commercially; incentive receivable as constrained variable consideration with a financing component |
| hire-to-retire | High | Labor is the base of the indirect rates; uncompensated overtime among exempt engineers is a DCAA focus | CATS with charge-object validation; total-time accounting so effective rates dilute correctly |
| security-authorization | Critical | USML Category XV and EAR ECCN 9x515 both apply depending on the item; classified programs add DCSA overlays | US-person attribute on the user master; project/WBS-level restriction; DIR access by export classification; classified program data usually not in the commercial SAP at all |
| analytics-reporting | High | NASA 533M/533Q, EVMS, mission assurance metrics, cost per kg to orbit | CDS analytical layer; a period-locked close snapshot so restated actuals cannot rewrite a submitted 533 |
| development-technology | Medium-High | 533 generation, orbital incentive tracking, flight-counter depreciation, export classification | Those four extensions are near-universal. Everything else stays clean core |

## Cost Object Strategy

- The WBS is the spine and it is deep: bus, payload, structures, thermal, power, propulsion, GN&C, C&DH, flight software, I&T, launch support, ground segment, mission operations. Use the MIL-STD-881 space-systems appendix as the dictionary and resist mirroring the org chart.
- Control accounts sit at the WBS/organization intersection. On NASA work the 533 reporting categories must be derivable from the WBS, so design the WBS and the 533 mapping in the same workshop.
- Production orders are secondary. On a unit of one most cost arrives as labor confirmations against network activities and as directly account-assigned POs. A production order is justified only where a real BOM and routing exist (an avionics box, a tank, an engine). Settle it to the WBS.
- Internal orders: IRAD, B&P, capital (AuC). IRAD is the lifeblood of a space company and is CAS 420 indirect cost; it settles to the IR&D pool, never to a contract WBS.
- Reusable launch hardware: the booster is a fixed asset, each flight a use event. Refurbishment between flights is a PM04 order settling to the asset (if capitalizable) or to expense. Unit-of-production depreciation needs a flight counter, which lives naturally as an equipment measurement point. This is the design that turns cost per launch from a finance estimate into a query.

Revenue recognition:

| Contract | Method | Notes |
| --- | --- | --- |
| CPFF / CPAF (NASA, SSC) | Cost-to-cost POC or right-to-invoice expedient | Award fee recognized only to the extent probable of no significant reversal; NASA award-fee periods bound the constraint |
| FFP satellite with orbital incentives | Over-time POC (no alternative use plus enforceable right to payment) | Base price in the transaction price at inception; incentives constrained until on-orbit history supports them; the 15-year stream has a significant financing component and must be discounted |
| FFP launch service | Point in time at launch, or over time where no alternative use plus right to payment | Argue this once, document it, stop re-litigating it quarterly |
| OTA prototype milestone | Over time if milestones evidence transfer of control; else on acceptance | OT terms vary wildly; read the agreement, not the template |
| Space Act Agreement (funded) | Milestone-based | Milestone evidence must be reproducible from the system |

Use classic PS Results Analysis where contract = project = POB. Move to Dassian RAENH when one spacecraft contract carries multiple obligations (spacecraft, launch integration, ground segment, extended mission ops) recognized on different patterns, which is common. The orbital-incentive receivable is a treasury and revenue problem, not an RA problem; forcing RA to model it produces nonsense.

EVMS: NASA and DoD both impose EIA-748 but consume different reports (533M/533Q vs IPMDAR). Build one earned-value dataset and two renderings. Never maintain two datasets.

## Compliance Profile

- **DFARS business systems (252.242-7005):** Accounting (252.242-7006) and Property (252.245-7003 / FAR 52.245-1) apply to essentially every space contractor with a government contract. EVMS (252.234-7002) at or above $20M for cost/incentive contracts, validated at or above $100M. Purchasing (252.244-7001) once a CPSR triggers. Estimating (252.215-7002) at $50M of prior-year DoD cost-type awards. MMAS (252.242-7004) applies but matters less than at a high-volume prime; pegging discipline still protects you.
- **NASA-specific:** the NASA FAR Supplement supplements or replaces several DFARS instruments. NFS 1852.242-73 drives NASA Form 533M (monthly) and 533Q (quarterly). NPR 7120.5 defines the lifecycle and Key Decision Points; the baseline is gated at KDP-C. NASA property clauses and the NASA property management system differ from DoD's PIEE flow: do not assume WAWF/PIEE covers a NASA award.
- **CAS:** full coverage for a traditional space prime. For a commercial space company the whole strategy is to keep contracts either competitively awarded FFP without certified cost or pricing data, or commercial items, both CAS-exempt. Space Act Agreements carry no FAR clauses at all. Protecting that is an enterprise-structure decision: the entity that signs a CPFF NASA contract becomes CAS-covered and CAS 403 reaches home-office cost allocated to every segment. Confirm current thresholds against 48 CFR 9903.201-2 and the solicitation; the FY2026 NDAA changed them and the conforming regulation lags.
- **Export control:** spacecraft and related items sit under USML Category XV (ITAR) or, since the 2014 reform, EAR ECCN 9x515 for certain commercial satellites and components. Classification determines who may see a drawing, and the two regimes have different license mechanics. SAP must restrict DIRs, material master views, and PS technical data by export classification and US-person status. That is authorization design, not org structure.
- **Launch:** FAA Part 450 vehicle operator licensing, range safety, and (for reusable vehicles) the flight-history and configuration records supporting a license. Increasingly the same data as the maintenance records.
- **Workmanship and parts:** NASA-STD-8739 series, J-STD-001 Space Addendum, EEE parts levels (Class S / Level 1 for flight) with lot acceptance and radiation lot testing. SAP consequence: batch management with characteristics, inspection lots with results recording, and the ability to answer "which flight units contain a part from lot X" in minutes. That is a batch-derivation and where-used problem, designed, not hoped for.
- **Property:** FAR 52.245-1. NASA-owned test facilities and GFE instruments in contractor custody are common and audited.

## Surround Landscape

| System | Role | SAP posture |
| --- | --- | --- |
| Teamcenter / Windchill / 3DEXPERIENCE | EBOM, CAD, ECR/ECO, as-designed baseline | Integrate. Nobody replaces PLM at a space company |
| Solumina, Apriso, in-house MES | Work instruction execution, buyoff, nonconformance, as-built | Integrate. The as-built record is created here; SAP receives confirmations, consumption, NCRs |
| Deltek Cobra / MPM / wInsight | EVM engine; CPR/IPMDAR/533 rendering | Integrate first; target PPC replacement only if the client will revalidate |
| Primavera P6 / MS Project | IMS and critical path through KDP gates | Integrate. Never rebuild the IMS in PS networks |
| ProPricer | Proposal pricing | Integrate. SAP supplies historical actuals and rate structure |
| Costpoint / Unanet | Incumbent ERP at smaller space primes | Replace. Risk is pool/base continuity across the cutover fiscal year |
| PIEE (WAWF, GFP, SPRS) | DoD invoicing, DD250, GFP transactions | Integrate for DoD. NASA awards use different mechanisms |
| Ground segment / mission ops | Telemetry, health, on-orbit performance | Integrate one narrow feed: the health metric that gates the orbital incentive |

## Dassian Fit

- **Contracts & Billing:** needed on the government side (CLIN/SLIN/ACRN, cost vouchers, DD250, progress payments). Not needed for pure commercial launch and rideshare, where an SD milestone billing plan suffices. That split is itself an argument for separate entities: the commercial entity runs vanilla SD.
- **Cost Management:** needed wherever provisional rates are billed and trued up. The FR engine plus rate decks is the right home for a multi-pool, multi-year rate structure with retroactive revaluation. Costing sheets are adequate for a single-pool commercial entity.
- **Project Management / PPC:** needed if SAP is the EVM system of record. PPC's plan versions (baseline, EAC, revenue) map onto NASA baseline/replan discipline, and it is the natural home of 533 generation.
- **Results Analysis / RAENH:** needed when a contract carries multiple POBs on different patterns (spacecraft over time, ground software point in time, mission ops as a series). Classic PS RA is adequate for single-POB cost-plus work.
- **SCFM:** needed where subcontract content is high (bus from one supplier, payload from another). Less critical at vertically integrated commercial space companies, which is why they run lighter.
- **Standard SAP suffices** for asset accounting (including unit-of-production depreciation driven by a measurement point feed), QM, PM refurbishment, batch management, MM, and all of hire-to-retire.

## Design Decisions and Traps

1. **Which entity signs the cost-reimbursable contract.** The commercial entity; a dedicated government entity; a new subsidiary. **Recommend** a dedicated government entity, always, even if small. **Fails as:** one CPFF NASA award into the commercial entity makes it CAS-covered, brings CAS 403 allocation across every segment, and puts the commercial cost model in front of DCAA.
2. **Unit-of-one costing.** Production order per assembly; direct WBS assignment only; hybrid. **Recommend** hybrid, with production orders only where a BOM and routing genuinely exist. **Fails as:** forcing production orders onto integration work generates thousands of orders with no variance meaning and a settlement run measured in hours.
3. **Standard cost vs actual on flight hardware.** **Recommend** valuated project stock at actual (or material ledger actual costing); standard costing on a unit of one produces a meaningless variance and confuses the CAS 407 story. **Fails as:** a large production variance sits in a cost center nobody can allocate defensibly to a contract.
4. **Where the as-built record lives.** **Recommend** MES creates it, SAP is the durable record (serial, batch genealogy, equipment hierarchy), PLM holds as-designed. **Fails as:** after a lot recall or on-orbit anomaly, the as-built exists only in an MES database decommissioned with the program.
5. **Batch traceability depth on EEE parts.** None; batch at purchased-part level; batch with characteristics and full where-used genealogy. **Recommend** the third on all Class S / Level 1 parts. **Fails as:** a lot alert arrives and the only answer to "which vehicles contain this lot" is a two-week search of paper travelers.
6. **Orbital incentive payments.** Recognize at inception; recognize as received; recognize as constrained variable consideration with a financing component. **Recommend** the third, releasing the constraint against actual on-orbit reliability. **Fails as:** full recognition up front forces a restatement when a satellite degrades; recognizing as received understates the transaction price and distorts POC.
7. **Reusable booster: asset or inventory.** Expense each vehicle; capitalize with unit-of-production depreciation; hold as inventory. **Recommend** fixed asset with a flight-cycle measurement point feeding depreciation, plus a PM04 order per flight. **Fails as:** expensing on first flight makes cost per launch look catastrophic in year one and free in year five; the audit committee will not accept it.
8. **NASA 533 as report or design input.** **Recommend** design the WBS so the 533 categories are derivable. **Fails as:** categories cannot be derived, a controller re-maps cost by hand monthly, and the 533 stops tying to the ledger.
9. **Export classification as a data attribute.** Manage in folder permissions outside SAP; classify at material/DIR/project level and derive authorization. **Recommend** the second. **Fails as:** a foreign-national engineer with a broad display role sees a Category XV drawing, which is an unauthorized export and a reportable violation.
10. **IRAD boundary.** **Recommend** internal orders (or a dedicated IRAD hierarchy) settling to the IR&D pool per CAS 420, with a hard block on settlement to any contract WBS. **Fails as:** IRAD labor landing on a contract is unallowable direct cost and a criminal-exposure conversation, not an audit finding.
11. **Award fee accrual policy.** Accrue at target; at zero until awarded; at a probability-weighted estimate constrained by history. **Recommend** the third, with a documented policy and locked inputs. **Fails as:** accruing at target on a program that never earned above 70 percent produces a quarterly reversal and a management-override question.
12. **One controlling area across acquisitions.** **Recommend** absorb fast, even at the cost of a temporary cost-element mapping layer. **Fails as:** two controlling areas mean no consolidated activity rate, no consolidated CO-PA, and a rate submission assembled in Excel.

## Discovery Questions

### People

1. Who owns the indirect rate structure, and is that person in the same organization as whoever signs the NASA 533?
2. How many engineering staff are exempt, and does the company practice total-time accounting for uncompensated overtime?

### Process

1. What triggers revenue on a launch: the launch, on-orbit checkout, or customer acceptance? Where is that documented, and does policy match the contract?
2. Walk me through what happens when a lot acceptance test fails on a part already installed in two flight units.
3. Which KDP is the current baseline anchored to, and when was the last replan?

### Technology / Systems

1. Which system creates the as-built record, and will it exist in ten years when an anomaly investigation needs it?
2. Is there an EVM engine today, is it validated, and by which agency?

### Data

1. Can you produce the full parts genealogy of a specific flight unit down to date code and lot?
2. Does the WBS support derivation of the NASA 533 reporting categories without a manual mapping table?

### Security / Authorizations

1. Which items are USML Category XV and which are EAR 9x515, and where is that classification recorded as data?
2. Are foreign nationals employed in engineering, and what technical control (not policy document) prevents access to controlled drawings?

### Analytics & Reporting

1. What is the reported cost per launch or cost per kg to orbit, and can that number be reproduced from the ledger?

### Role of AI

1. Where do anomaly investigation and MRB disposition consume the most engineering hours, and would a retrieval agent over as-built and NCR history help?

### Operating Model

1. Is the commercial business a separate legal entity today? If not, what would it cost to make it one, and does anyone in finance understand what CAS 403 does if it is not?
