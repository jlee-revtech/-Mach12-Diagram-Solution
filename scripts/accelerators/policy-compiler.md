---
name: Policy Compiler
description: Turns an English policy statement into a deterministic validation, climbing an ast | llm | compiled ladder, with an equivalence gate that must reach 100 percent agreement before a policy flips to generated ABAP or TypeScript.
workstreams: hire-to-retire, record-to-report, security-authorization, development-technology
license: internal
---

# Policy Compiler

## What It Does

The Policy Compiler bridges "a compliance officer can write a rule in English" and "the rule runs deterministically inside SAP with no model in the loop." It lives in SAP Solution Studio at `/agents/policy-compiler` and operates on the policy stores of the applications it serves, starting with the Tesseract XPM timesheet's Policy Library.

The core idea is an **execution-mode ladder**, a field on every rule definition:

| Mode | How the rule runs | Cost | When it applies |
|---|---|---|---|
| `ast` | A deterministic walk over a structured condition tree | Free | The rule fits the fixed field vocabulary. The default, and always has been |
| `llm` | The runtime interprets the natural-language source at the decision point, with a verdict cache | Tokens per uncached decision | The rule is richer than the vocabulary can express. Ship today, spend tokens |
| `compiled` | A generated artifact runs (an ABAP method or a TypeScript function) behind a binding carrying the reference, a checksum, and the equivalence evidence | Free | The compiler has proven the artifact agrees with the LLM on every synthetic boundary case |

The ladder is the product. An author writes English, the rule ships that day on the `llm` lane, and later the Development Technology agent compiles it down. Nothing about the business process changes when it moves.

Two compile targets. The front-end target is the default because it deploys nothing.

**ABAP target.** An AST-to-ABAP transpiler plus an LLM synthesis path for conditions the transpiler cannot express. It emits a self-contained class per policy that deserializes its context from JSON and returns a verdict, deploys it through the write path the configuration agents use, then writes a binding back so the runtime stops calling the model.

**TypeScript target.** An AST evaluator ported from the runtime's condition evaluator, plus a reducer classifying each condition as `expressible`, `needs_helper`, or `needs_sap_data`. An expressible policy flips to `compiled` with a `ts_function` binding by writing the AST back, needing no deployment, because the runtime router already evaluates an AST. A `needs_helper` policy records a `pending_build`, opens a real pull request adding a standalone helper plus its test, and stays on the `llm` lane until it merges.

**The equivalence gate** makes it defensible. Before any policy flips from `llm` to `compiled`, the compiler generates synthetic boundary contexts, evaluates them against both the LLM and the compiled artifact (ABAP via a classrun, TypeScript in process), and requires 100 percent agreement. Anything less and the flip is refused. The evidence is stamped onto the binding with a checksum, so a later change to either side breaks it and the policy falls back rather than silently drifting.

Status, honestly: phases P0 through P4 are built and unit-tested across both consuming repositories. What remains is live deployment: an ICF dispatcher class, an environment variable pointing the runtime at it, and one real end-to-end compile.

## When To Position It

Position it when the client has a compliance rule estate (DCAA timekeeping, FAR labor charging, export control, segregation of duties) living in a policy PDF and a developer's head; when they want AI to enforce policy and their auditor wants to know how a decision was reached; when every new rule costs a sprint, so rules do not get written and the control does not exist; when token cost at the decision point is the objection to an LLM-in-the-loop design.

Do NOT position it when:

- The rules are already expressible in a mature deterministic engine (BRFplus, a validation and substitution stack, Flexible Workflow conditions) and nobody is asking for natural-language authoring.
- The rules require data the runtime does not have at the decision point. The reducer classifies these `needs_sap_data`, they stay on the LLM lane, and they stay expensive.
- The client will not accept generated code in a productive system. Then the TypeScript target is the only lane; say so.
- Somebody wants "AI decides." The compiler exists precisely so the AI stops deciding.

## How It Fits The SAP Design

Touches Hire-to-Retire (timekeeping and labor-charging policy, the deepest use case), Record-to-Report (cost allowability, charge-object eligibility), Security-Authorization (the planned target for attribute dictionaries and DCL aspects in the ABAC roadmap), and Development-Technology (the compiler and the pull-request path).

Replaces: hard-coded validation in enhancements; the policy PDF; the developer ticket per rule.

Augments: the deterministic policy dispatcher the consuming runtime already has. That engine was already deterministic at execution; the LLM was authoring-only. The compiler removes the ceiling, which was a fixed field vocabulary of eleven attributes.

Standard-SAP alternative: BRFplus, or classic validation and substitution. The accelerator wins on (1) natural-language authoring by the person who owns the control, (2) the ladder, which decouples ship date from optimization date, (3) the equivalence proof, which no hand-written rule carries, (4) one policy definition serving both a front-end gate and an ABAP-side gate. It does not win on rules that are genuinely BRFplus-shaped (decision tables, rate lookups) or that must run inside a standard posting exit.

## Integration Points

In: policy definitions read from either of two stores through one connector, so the compiler is agnostic to where the consuming app lives: a Postgres store over REST, or an in-boundary S/4 configuration store over an ICF endpoint. Each rule carries its natural-language source, its condition AST where one exists, its execution mode, and its compiled binding.

Out: an activated ABAP class in the customer's Z package plus a binding written back; a rewritten condition AST for the TypeScript-expressible case; a real pull request adding a helper function and its test; and the equivalence evidence stamped on the binding.

Runtime call path: the policy router resolves the mode. For `compiled` + `abap_method` it posts the evaluation context as JSON to an ICF dispatcher, which calls the generated class's evaluate method dynamically. For `compiled` + `ts_function` it evaluates the AST in process, and no network call happens. For `llm` it calls the model with a verdict cache, at submit or approval only.

Auth: the compiler runs inside Solution Studio and uses its SAP client and ADT write path. The ICF dispatcher uses standard SAP logon. Policies are read with the consuming app's service credentials, held server-side.

Deployment: a compile console and service in Solution Studio; one ICF handler class and one node in the SAP system; nothing else.

## SAP-Side Objects

| Object | Type | Purpose |
|---|---|---|
| `ZCL_M12_TS_POL_*` | ABAP classes (generated) | One self-contained class per compiled policy, exposing an evaluate method that deserializes its context from JSON and returns a verdict |
| `ZCL_M12_POL_EVAL` | ABAP class (ICF handler) | The dispatcher: resolves the policy's class name from the request and invokes its evaluate method dynamically |
| ICF service node | ICF node | Same-origin endpoint the runtime posts evaluation contexts to; logon data set to standard |
| `/UI2/CL_JSON` | Standard class | JSON serialization on both sides. Its camel-case deserialization drives the flat key names in the evaluation context |
| ADT activation and syntax-check services | Standard | The generated class is checked and activated before it is ever callable |
| ADT classrun | Standard | Runs the generated class against synthetic boundary contexts during the equivalence gate |
| In-boundary config store table | Custom table | Holds policy definitions, execution mode, and compiled binding when the consuming app runs inside S/4 |

## Demo Path

1. Open the consuming application's Policy Library. Three rules sit on the `ast` lane. The runtime is already deterministic; nothing here is a model call.
2. Author a rule in English that the eleven-field vocabulary cannot express, combining a charge object's contract type with the employee's clearance. It lands on the `llm` lane.
3. Trigger it in the runtime. It fires correctly, and the verdict cache shows. The rule shipped in ninety seconds. This is the cost of speed, and it is measurable.
4. Open Solution Studio, Policy Compiler. The policy list loads from the consuming app's store. One console, two stores, no coupling.
5. Select the policy, choose the front-end target. The reducer classifies its conditions `expressible`. Most policies never need SAP.
6. Run Prepare. The equivalence gate generates synthetic boundary contexts and reports agreement between the LLM and compiled verdicts. The flip is earned, not asserted.
7. Apply. The AST is written back and the mode flips to `compiled` with evidence attached. Trigger the rule again: same verdict, zero tokens, zero deployment.
8. Take a policy the reducer classifies `needs_helper`. It opens a real pull request adding a helper and its test, records `pending_build`, and leaves the policy on `llm`. The compiler will not lie about what it can do.
9. Switch a third policy to the ABAP target. Preview the generated class, then Apply: deployed, syntax-checked, activated, equivalence-gated, binding written back with a checksum.
10. In SAP, call the ICF dispatcher with an evaluation context. The verdict comes back from the generated method. The rule now runs inside your boundary and agrees with the model.

## Positioning Notes

To a CFO: your compliance controls are documented in a PDF and implemented in someone's code. This makes the control itself the artifact, written in English by the person who owns it, proven equivalent to a deterministic implementation, and running for free. If the control changes, you change the sentence.

To a program manager: new rules stop being a development ticket. They ship the day the compliance officer writes them, and they get cheaper later without anyone touching the process.

To a CIO: no model runs in the enforcement path once a policy is compiled. Nothing flips to compiled without 100 percent agreement across generated boundary cases, and the evidence is stored with the binding. The default target deploys no ABAP; when you want ABAP, it is one self-contained class per rule in your Z package, syntax-checked before it is reachable.

Discriminator vs Deltek Costpoint, Cognitus, and Dassian standalone: no overlap. This is not something an ERP vendor, an SAP reseller, or an A&D add-on sells.

Discriminator vs BRFplus and classic validation and substitution: those are the right answer for decision tables and posting-time field derivation, and we say so. The compiler wins where the rule is prose, where the same rule must run in a web front end and in ABAP, and where an auditor will ask how you know the code matches the policy. Nobody writing a substitution exit can answer that with evidence. This can.
