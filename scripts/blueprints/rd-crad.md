---
name: R&D and Contracted Research Organization (IRAD, CRAD, SBIR/STTR, OTA)
description: Blueprint for an organization whose product is research: IRAD, contracted R&D, SBIR/STTR, OTA prototypes, grants and cooperative agreements; drives funding-source segregation, data-rights protection through cost accounting, and multi-regime compliance in SAP.
license: internal
---

# R&D and Contracted Research Organization (IRAD, CRAD, SBIR/STTR, OTA)

Research organizations are the only A&D model where the cost accounting system is also the intellectual property protection system. Where the money came from determines who owns the results. Mix IRAD dollars with CRAD dollars on the same development, and the government acquires government purpose rights in something the company paid to invent. No lawyer undoes that afterward; only the ledger prevents it. That sentence reorganizes the entire SAP design.

Four kinds of organization share this problem: a small SBIR-funded technology company, an R&D division inside a prime, a nonprofit research institute or UARC, and a prototyping shop living on OTAs.

## Business Model

| Funding instrument | Legal regime | Cost regime | What it buys |
| --- | --- | --- | --- |
| IRAD | None; company money | FAR 31.205-18 allowability as indirect cost; CAS 420; DFARS 231.205-18 reporting for major contractors | Retained IP, unlimited rights kept by the company |
| CRAD (contracted R&D) | FAR; typically CPFF completion or term, sometimes FFP | FAR 31.2 cost principles; CAS if covered | Government funds development; government purpose or unlimited rights follow |
| SBIR / STTR Phase I | FAR-based, FFP or cost-plus; roughly $300K, 6 to 12 months (SBA indexes annually) | FAR 31.2 | Feasibility. The small business retains SBIR data rights |
| SBIR / STTR Phase II | Roughly $2M, 24 months | FAR 31.2 | Prototype development, still under SBIR data rights |
| SBIR Phase III | Any funding source, no SBIR dollars; sole-source authority derived from the SBIR | FAR 31.2 | The commercial payoff. Phase III sole-source authority is the entire point of the program |
| OTA prototype (10 U.S.C. 4022) | Not a FAR contract, not a grant | Whatever the agreement negotiates; often none of FAR 31.2 | Rapid prototyping. Nontraditional participation or a one-third cost share is generally required. A successful prototype supports a follow-on production OT without further competition |
| OTA research (10 U.S.C. 4021) | Not a FAR contract | Negotiated | Basic and applied research, often with cost share |
| Grant / cooperative agreement | Assistance, not procurement; 2 CFR 200 | Uniform Guidance cost principles; F&A under a NICRA, not CAS | Public benefit research. Effort certification, subrecipient monitoring, equipment title rules |
| CRADA | 15 U.S.C. 3710a | Negotiated, typically in-kind | Collaboration with a government lab; IP terms negotiated up front |

The organization survives on indirect rate recovery and grows on retained IP. IRAD is the strategic weapon: allowable as an indirect cost, so the government effectively co-funds it through the overhead and G&A rates while the company keeps the rights. Protecting that requires IRAD to be accounted for as an independent effort, not sponsored, not required by a contract, and never charged directly to a contract. For a small SBIR company the economics are simpler and more brutal: Phase I and Phase II are cost-covering, not profit-generating. All value is created at Phase III, where sole-source authority lets the company sell at a negotiated price with no competition.

## Enterprise Structure

- **Company code:** usually one; sometimes one per legal entity where a nonprofit institute has a for-profit affiliate. Where an organization holds both FAR contracts and Uniform Guidance grants, keep them in one company code and separate them by funding object.
- **Controlling area:** one.
- **The dominant structural axis is not organization, it is funding source.** Every cost object must answer: who paid for this, under what instrument, with what data rights, in what appropriation, expiring when.
  - **Funds Management (FM)** carries the appropriation dimension: fund, funds center, commitment item, functional area, and budget with availability control. This is where color of money lives (RDT&E vs procurement, two-year vs three-year money, expiration and cancellation).
  - **Grants Management (GM)** carries the sponsored-program dimension for grants: grant master, sponsored program, sponsored class, and the F&A rate under the NICRA. Deploy GM when Uniform Guidance awards are material; skip it when the book is all FAR contracts.
  - **PS** carries the work dimension: project definition and WBS.
  - **Cost centers** carry the indirect rate structure: fringe, overhead, G&A, and the IR&D/B&P pool.
- **Plants:** one, minimal. Research organizations have labs, not factories. Special test equipment and lab consumables are the only inventory of note; expense most of it on receipt with direct account assignment.
- **IRAD and B&P** live on their own cost objects (internal orders or a dedicated indirect project hierarchy) settling into the IR&D/B&P pool per CAS 420. Settlement from an IRAD cost object to a contract WBS must be **technically impossible**, not merely discouraged: configure the settlement profile to permit only the pool cost center as receiver.
- **Cost share:** on an OTA, a cost-sharing FAR contract (FAR 16.303), or a Uniform Guidance award, contributed cost must be recorded on the same project, distinguishable by funding source. Model as a separate WBS branch or a distinct fund on the same WBS. A cost share that cannot be substantiated is a repayment.

## Value Stream Emphasis

| Workstream | Emphasis | Why | Signature SAP design |
| --- | --- | --- | --- |
| record-to-report | Critical | Indirect rate recovery is the business; IRAD allowability and CAS 420; Uniform Guidance F&A under a NICRA | Cost center hierarchy = pools; IR&D/B&P pool with hard settlement rules; unallowable segregation; a rate structure surviving both FAR 31.2 and 2 CFR 200 |
| plan-to-perform | High | Every award has a period of performance, a funding ceiling, a milestone plan, a report schedule | WBS per award; FM budget with availability control by fund; milestone and deliverable calendar; EVMS almost never applies |
| design-to-release | High | The output is a design, a prototype, and a data package. Data rights assertions attach to specific technical data | Document management with data-rights markings as attributes; an assertion register under DFARS 252.227-7017; link each technical data item to the funding source that created it |
| plan-to-produce | Low | Prototypes are built once, often by hand or by a partner | No production orders. Materials expensed to the WBS. If a prototype build genuinely needs a BOM and routing, use one order and settle to the WBS |
| inventory-to-deliver | Low | Deliverables are reports, data, and one or two prototype units | Direct account assignment; deliverable tracking as milestones, not sales-order lines |
| acquire-to-retire | Medium-High | Lab equipment, special test equipment, government-title property; Uniform Guidance equipment title rules differ from FAR | Asset accounting; special test equipment often government-title under FAR 52.245-1; 2 CFR 200.313 equipment rules for grants; capitalization thresholds by funding source |
| sustainment-mro | Low | Not applicable | Skip |
| source-to-pay | Medium | Subawards and consultants; university subcontracts; Uniform Guidance procurement standards differ from FAR | PO with account assignment to WBS and fund; subrecipient vs contractor determination (2 CFR 200.331); FAR 52.244-2 consent on FAR awards; STTR requires a research institution partner performing a set share |
| offer-to-cash | High | Cost vouchers, OTA milestone invoices, grant drawdowns, FFP SBIR invoices | Dassian Contracts & Billing for FAR cost vouchers; simple milestone billing for OTAs; grant drawdown against the sponsored program |
| hire-to-retire | Critical | Labor is the entire cost base; effort certification on grants; PI employment rules on SBIR | Timesheet with charge-object validation across funding sources; effort certification as a distinct process from timekeeping; PI effort percentages |
| security-authorization | Critical | Fundamental research exclusion vs export-controlled work; data-rights-marked technical data; foreign nationals in labs | US-person attribute; project-level restriction; a documented per-project determination of whether the fundamental research exclusion applies |
| analytics-reporting | High | Rate variance, IRAD portfolio return, burn against expiring appropriations, Phase III pipeline | CDS layer over ACDOCA plus PS plus FM/GM; an expiring-funds report that runs weekly, not annually |
| development-technology | Medium | Effort certification, data-rights assertion register, expiring-funds alerts | The rest stays clean core |

## Cost Object Strategy

- **The project (PS) is the cost object.** One project per award. WBS branches by task or by year of performance. Where cost share exists, either a parallel WBS branch or the same WBS with distinct funds; pick one convention and never mix them.
- Funding source is carried as the fund (FM) and, on grants, the grant and sponsored program (GM). Budget availability control on the fund enforces the ceiling and the period of performance. That is the mechanism stopping a researcher from charging a closed appropriation.
- **IRAD projects:** internal orders or a dedicated indirect project hierarchy, each with a technical objective, budget, start and end, settling to the IR&D pool. For a major contractor (DFARS 231.205-18(c)(iii)(C), where IR&D plus B&P exceeded roughly $11M in the preceding fiscal year), IRAD projects must be reported to the DoD DTIC database and the contractor must engage in a technical interchange with a DoD representative for the cost to be allowable. The IRAD project master therefore needs the fields the DTIC submission requires, populated at project creation, not reconstructed at year end.
- **B&P:** separate internal orders, same pool, never on a contract.
- **The mixed-funding trap and its mechanism.** Under DFARS 252.227-7013 the government gets **unlimited rights** in technical data developed exclusively with government funds, **limited rights** in data developed exclusively at private expense, and **government purpose rights** in data developed with **mixed** funding (typically five years, then unlimited). The determination is made at the level of the item, component, or process, not the whole program. So an engineer who charges four hours of a CRAD contract to debug an algorithm invented under IRAD has just converted that algorithm's data rights from limited to government purpose. The controls that prevent it:
  1. Charge-object validation at time entry (employees can only charge projects they are assigned to).
  2. A written technical boundary between the IRAD and CRAD efforts, reflected in the WBS and the statement of work.
  3. A data-rights assertion register (DFARS 252.227-7017) maintained as data, linking each asserted item/component/process to its funding source and assertion category, produced at proposal time and maintained through performance.
  4. Document markings applied at release, derived from the register.
- **Special test equipment and prototypes:** title frequently vests in the government. Determine title per award before the first purchase order.

Revenue recognition:

| Instrument | Method | Notes |
| --- | --- | --- |
| CPFF completion CRAD | Cost-to-cost POC, or right-to-invoice expedient | Fee on negotiated cost |
| CPFF term / LOE CRAD | Hours delivered; fee earned with the LOE | Common on research contracts |
| FFP SBIR Phase I / II | Over time (POC) if no alternative use plus right to payment; else on delivery | Read the termination clause. Most SBIR FFP awards support over-time |
| Cost-type SBIR | Right to invoice | Simple |
| OTA milestone | Milestone-based if milestones evidence transfer of control; else over time on cost | OT terms vary; read the agreement |
| Grant / cooperative agreement (nonprofit) | Contribution (ASC 958) or exchange transaction (ASC 606) | Depends on whether the resource provider receives commensurate value. Determined per award; not optional |
| IRAD | No revenue | Cost only. It is an investment |

Classic PS Results Analysis handles the POC cases on the billing WBS. Right-to-invoice contracts should have no RA run against them. RAENH is over-scoped for most research organizations.

## Compliance Profile

Four compliance regimes coexist and must not be blended.

- **FAR contracts:** FAR Part 31 cost principles, DFARS 252.242-7006 accounting system criteria if any cost-type award exists, DCAA audit, provisional and final indirect rates (FAR 42.704, 42.705), incurred cost submission under FAR 52.216-7 within six months of fiscal year end.
- **CAS:** small businesses are exempt (48 CFR 9903.201-1(b)(3)). Most SBIR companies and many research institutes are exempt. The moment the organization exceeds the small business size standard or receives a CAS-triggering award, modified coverage attaches (CAS 401, 402, 405, 406) and full coverage brings CAS 420 (IR&D and B&P accumulated by project and allocated to the segment's cost objectives). Confirm coverage thresholds against 48 CFR 9903.201-2 and the solicitation; the FY2026 NDAA changed them and the conforming regulation lags.
- **Uniform Guidance (2 CFR 200)** for grants and cooperative agreements: negotiated F&A rate (NICRA) instead of CAS-compliant indirect rates, the de minimis rate option, effort certification under 2 CFR 200.430(i), procurement standards at 2 CFR 200.317 through 200.327 (which are not FAR), subrecipient vs contractor determination and subrecipient monitoring (200.331, 200.332), equipment title and disposition (200.313), and the Single Audit above the expenditure threshold. An organization running both regimes needs two rate structures or a documented reconciliation.
- **OTAs:** neither FAR nor Uniform Guidance applies unless the agreement says so. There is no CAS, often no DCAA audit clause, sometimes no cost principles at all. Milestone payments replace vouchers. The compliance burden is whatever was negotiated, so someone must read the agreement and translate it into system controls. Prototype OTs under 10 U.S.C. 4022 generally require either significant nontraditional defense contractor participation or at least one-third cost share from non-federal sources, which must be tracked and substantiated.
- **SBIR/STTR** (SBA Policy Directive): the small business must perform a minimum share of the work (Phase I and Phase II thresholds differ; STTR requires a research institution partner performing a set share). The principal investigator must be primarily employed by the small business. Duplicate funding of the same work from two agencies is prohibited and actively investigated. SBIR data rights protect the data for a protection period (extended to 20 years under the current Policy Directive) under DFARS 252.227-7018. The system must demonstrate which employees charged the SBIR, at what percentage, and that the PI met the employment requirement.
- **Data rights:** DFARS 252.227-7013 (technical data), -7014 (noncommercial computer software), -7017 (identification and assertion), -7018 (SBIR/STTR). The assertion table is submitted with the proposal and maintained. Failure to assert restrictions before award generally means unlimited rights to the government.
- **Export control:** the fundamental research exclusion (ITAR 22 CFR 120.34(a)(8), EAR 15 CFR 734.8) removes from control the results of basic and applied research ordinarily published and broadly shared. It is **lost** when the sponsor imposes publication restrictions or access controls, which most DoD contracts do. Two projects in the same lab, one fundamental research and one export-controlled, need different access controls on their technical data. Make the determination per project, record it as a project attribute, and drive authorization from it.
- **Property:** FAR 52.245-1 on FAR contracts; 2 CFR 200.313 on grants. The rules differ on title, use, and disposition. Special test equipment purchased on a cost-type contract usually belongs to the government.
- **DFARS business systems:** Accounting System (252.242-7006) applies wherever a cost-type FAR contract exists, and it is the one that matters. Purchasing, Estimating, EVMS, and MMAS rarely apply at this scale; Property attaches with GFE.

## Surround Landscape

| System | Role | SAP posture |
| --- | --- | --- |
| Costpoint / Unanet / JAMIS / QuickBooks | Incumbent accounting at small research firms | Replace. Risk is rate continuity and the incurred cost submission |
| GovWin / SAM.gov / Grants.gov / DSIP | Opportunity capture, SBIR submission, grant application | Integrate loosely; award data seeds the project, fund, and grant master |
| Electronic lab notebook, PLM, DOORS / Jama | Technical record; where the invention actually lives | Integrate only the linkage supporting the data-rights assertion register |
| Cayuse / Kuali / InfoEd | Research administration: proposal, award, compliance, effort certification | Either replace with SAP GM plus a custom effort-certification app, or integrate. Do not run two award systems |
| PIEE (WAWF), IPP, ASAP.gov | Voucher and drawdown submission | Integrate |
| Consortium manager portals (OTAs) | Milestone submission and payment | Integrate loosely; usually manual |
| DTIC IR&D database | Mandatory IRAD reporting for major contractors | Integrate as an annual extract from the IRAD project master |
| SuccessFactors / Workday / ADP | Employee master, effort, PI status | Integrate |

## Dassian Fit

- **Contracts & Billing: yes for FAR cost-type work**, because cost vouchers with provisional indirect rates, fee, and fee withholding are not standard SD. For an organization purely grant-funded or purely OTA-funded, standard SD milestone billing plus GM drawdown suffices and Dassian is over-scoped.
- **Cost Management: yes**, wherever provisional rates are billed and trued up, and especially where two rate regimes coexist (FAR indirect rates and a Uniform Guidance NICRA). Rate decks by fiscal year with revaluation is exactly the problem.
- **Project Management / PPC: skip.** No EVMS. Time-phased planning by WBS is available in standard PS.
- **Results Analysis / RAENH: classic PS RA only**, and only on the POC contracts.
- **SCFM: skip**, unless university subawards are large and need funding-versus-flowdown tracking.
- **Flowdowns / clause library: partially.** SBIR data rights and DFARS 252.227-7013/-7014 flowdowns to subawardees matter. A clause matrix on the PO helps; it rarely justifies the vertical alone.

The genuinely Dassian-shaped requirement here is the rate engine. The genuinely SAP-standard requirements are FM, GM, PS, CO, and CATS.

## Design Decisions and Traps

1. **IRAD segregation mechanism.** Policy and training; a separate project hierarchy with settlement restricted to the pool; a separate accounting entity. **Recommend** internal orders or an indirect project hierarchy whose settlement profile permits only the IR&D pool cost center as receiver, plus charge-object validation at time entry. **Fails as:** a single mixed-funded development converts limited-rights data into government purpose rights, and the company's core technology becomes available to competitors at the government's discretion.
2. **Data-rights assertion register as data or as a document.** **Recommend** a maintained register linking item/component/process to funding source and assertion category, with markings derived from it. **Fails as:** an unasserted item delivered with a contract deliverable carries unlimited rights by default, permanently.
3. **Whether to deploy SAP Grants Management.** Model grants as PS projects with a fund; deploy GM; deploy GM plus FM. **Recommend** FM always (appropriations and availability control), GM only when Uniform Guidance awards are material enough to require F&A under a NICRA, effort certification, and subrecipient monitoring. **Fails as:** managing 60 federal grants as ordinary WBS elements produces an inadequate Single Audit.
4. **Effort certification vs timekeeping.** **Recommend** treat them as separate. 2 CFR 200.430(i) expects an after-the-fact confirmation by someone with suitable means of verification, at a level above the timesheet. **Fails as:** a Single Audit finding on payroll allocation, the most common finding in federally funded research.
5. **Two rate regimes.** One structure for both FAR and Uniform Guidance work; two structures with a reconciliation; a NICRA mirroring the FAR rates. **Recommend** one pool structure with two rate applications and a documented reconciliation, if the cognizant agency accepts it. **Fails as:** the F&A proposal and the incurred cost submission draw on inconsistent pools and one of the two auditors disallows the difference.
6. **Fundamental research exclusion determination.** Assume all lab work qualifies; assume none does; determine per project and record it. **Recommend** per project, at award, recorded as a project attribute driving access control on technical data. **Fails as:** a foreign-national post-doc accesses controlled technical data on a project where a publication restriction quietly voided the exclusion. That is an unauthorized export.
7. **Expiring appropriations.** Track period of performance only; implement FM with fund expiration and availability control. **Recommend** FM. **Fails as:** an obligation posted against a canceled appropriation cannot be paid and cannot be moved, and the cost lands in unallowable.
8. **Cost share substantiation.** **Recommend** record cost share on the same WBS under a distinct fund, with the same auditability as reimbursed cost. **Fails as:** an OTA one-third cost share that cannot be substantiated at closeout becomes a repayment plus a finding on the next agreement.
9. **SBIR work-share and PI employment evidence.** Attest annually; make it a query over labor distribution and HR data. **Recommend** the query, produced monthly. **Fails as:** the business cannot demonstrate it performed the required share of Phase II work, or that the PI was primarily employed by the company, and the award is at risk along with Phase III sole-source authority.
10. **Prototype title and special test equipment.** **Recommend** determine title per award and set the asset/expense treatment on the purchase requisition, not at year end. **Fails as:** capitalizing government-title equipment overstates assets, understates contract cost, and the property administrator has no record.
11. **OTA compliance translation.** Apply FAR habits to the OTA; read the agreement and configure only what it requires. **Recommend** read it. An OT may have no cost principles, no audit clause, and no CAS, and imposing FAR machinery destroys the speed that justified the OT. **Fails both ways:** applying FAR overhead where it was not required makes the organization uncompetitive; ignoring a negotiated audit clause produces an unpleasant closeout.
12. **When the small business stops being small.** **Recommend** know the size standard, the date, and that CAS coverage, a Disclosure Statement, and CAS 420 IR&D accounting arrive together. **Fails as:** a company that grew past the size standard two years ago has been billing under a rate structure it never disclosed, and DCAA is about to explain what that costs.

## Discovery Questions

### People

1. Who decides which project an engineer charges when the work could plausibly serve both an IRAD effort and a CRAD contract?
2. Who maintains the data-rights assertion table, and are they in the same building as the people writing the technical data?

### Process

1. Walk me through the last time an IRAD-developed capability was proposed into a government contract. What proved the IP was developed exclusively at private expense?
2. How is effort certification performed on grant-funded work, and by whom?
3. What happens when an appropriation is about to expire and a project still has unspent obligated funds?

### Technology / Systems

1. Which system holds the award terms: period of performance, funding ceiling, data rights, cost share commitment?
2. Is there a research administration system, and would it be replaced or integrated?

### Data

1. Can you produce, for a given technical data item, the funding source or sources that paid for its development?
2. Do you track IRAD projects with the fields the DTIC submission requires, and what is the current NICRA rate relative to the FAR indirect rates?

### Security / Authorizations

1. Which projects qualify for the fundamental research exclusion, where is that determination recorded, and does anything in the system enforce it?
2. Are foreign nationals employed in the labs, and what technical control (not policy document) prevents access to export-controlled project data?

### Analytics & Reporting

1. What is the IRAD portfolio's return, measured how, and does anyone reconcile it to the contracts subsequently won?

### Role of AI

1. Where is the largest analyst burden: assembling the incurred cost submission, tracking data-rights assertions across proposals, or matching SBIR topics to internal capability? The last is the highest-value AI target and the least discussed.

### Operating Model

1. Is the company small under the applicable NAICS size standard today, and what is the plan for the fiscal year in which it stops being small?
