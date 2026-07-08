---
name: Delivery Cockpit
description: The surface where agents ship code: a managed-repository console that proposes path-allowlisted GitHub changes, opens pull requests, auto-merges on green CI, and deploys the CI-built front-end bundle into SAP as a BSP.
workstreams: development-technology
license: internal
---

# Delivery Cockpit

## What It Does

The Delivery Cockpit (SAP Solution Studio, route `/technology/delivery`) closes the loop that every "AI writes code" demo leaves open. The Development Technology agent could already write ABAP into SAP. This lets it manage the **application source code** too, and deliver the built artifact back into SAP as a Business Server Page. That makes it a full-stack delivery agent rather than a data-layer agent.

**A managed-repository registry.** Every repository the agent may touch is declared with an owner, a repository name, an **allowed-paths list**, an auto-merge flag, and an optional BSP target. The registry is configuration; the agent cannot extend it at runtime.

**A change-proposal service.** The agent calls `proposeChange`. Before any write, the path allowlist is enforced. Then a branch is created, files are committed through the contents API, a pull request is opened, and, if the repository allows it, auto-merge is enabled through the GraphQL mutation so the pull request lands the moment required checks go green. The console lists open pull requests with their CI state.

**A BSP deployment channel.** A platform-hosted service cannot run a foreign repository's npm build, so the topology is deliberate: **CI builds, the Studio deploys.** A workflow in the consuming repository builds the SAP-targeted bundle on push and publishes a zip as a release asset. The Studio downloads that asset, reads or creates the BSP application metadata, and uploads the zip through the ADT UI5 repository service. One button: Deploy front-end.

The first real consumer is the Policy Compiler. When it classifies a policy as `needs_helper` it opens an actual pull request adding a standalone helper function plus its test at the allowlisted path. That repository auto-collects helpers by glob, so once the pull request merges nothing needs wiring, and the compiler leaves the policy on the interpreted lane until then.

Status, honestly: the console, the client, the registry, path enforcement, the pull-request and auto-merge path, the release-asset download, and the BSP upload are all built. What remains is live setup, a customer-environment task: mint a fine-grained personal access token (contents read/write, pull requests read/write, actions read) and bind it as a platform secret; enable branch protection with a required check and allow auto-merge; run CI once; do one BSP deploy.

Two environment caveats to say out loud before a demo. The standard ABAP repository service behind the UI5 upload is not always healthy on older kernels; the fallback is the design-time UI5 repository API, and HTML must be uploaded as text rather than binary. And BSP application names are capped at fifteen characters, while a connection routed through a connectivity proxy has a header-size ceiling a large certificate chain will exceed. Neither is a design flaw; both will ruin an unrehearsed demo.

## When To Position It

Position it when the client has accepted AI-assisted configuration and asks whether it can also change the application; when the front end runs inside the SAP boundary as a BSP and the deployment path is a person with a zip file; when Solution Studio agents need to evolve the Tesseract applications and that evolution should arrive as reviewable pull requests; and when a security team asks how an agent could be allowed near a repository, because the allowlist, branch protection, required checks, and auto-merge-only-on-green are the entire answer.

Do NOT position it when:

- The client's source is not on GitHub. This is a GitHub REST plus GraphQL client. Other forges would need an adapter that does not exist.
- The release process requires human merge. Turn auto-merge off and the value collapses to "the agent opens pull requests," which is real but smaller.
- The front end is Fiori Elements deployed through the standard ADT deploy configuration. Use that. This is for a bundled single-page app that must land as a BSP.
- There is no CI. The topology assumes CI produces the artifact.

## How It Fits The SAP Design

Touches Development-Technology only. This is a platform capability, not a business process.

Replaces: the manual zip-and-upload BSP deployment; the "someone will make that change" backlog item; a consultant committing directly to a shared branch.

Augments: the client's existing CI. The cockpit does not build. It consumes a build artifact and opens pull requests that the client's own checks gate. The ABAP write path is unchanged. This channel is for the TypeScript and React side, plus BSP delivery of its bundle.

Standard-SAP alternative: SAP Continuous Integration and Delivery on BTP, or the ABAP and UI5 deploy toolchains driven from a pipeline, plus ChaRM or gCTS for transport. The accelerator wins on (1) being the only path where an agent's proposal becomes a governed pull request with a path allowlist enforced before any write, (2) putting the BSP deploy behind one button in the same console as the rest of the solution work, (3) closing the Policy Compiler loop, where the compiler is the caller and a helper function is the payload. It does not win as a general-purpose CI/CD platform.

## Integration Points

In: repository metadata, branch and commit state, open pull requests and their check status, and release assets, from the GitHub API. Existing BSP application metadata from the SAP UI5 repository service.

Out: a branch, a commit, a pull request, an auto-merge enablement, and a zip uploaded into a BSP application in a named package under a named transport.

Enforcement points, in order: (1) the repository must be in the registry; (2) every file path in the proposal must match that repository's allowed-paths list, checked before the first API call; (3) branch protection and required checks gate the merge; (4) auto-merge fires only when checks pass. The agent has no route around any of these.

Auth: a fine-grained personal access token scoped to specific repositories with the minimum permission set, resolved from a platform service binding, then an environment variable, then a local file. It never reaches the browser. SAP-side deployment uses the Studio's existing ADT client.

Deployment: the console and delivery library live inside SAP Solution Studio on Cloud Foundry. The CI workflow lives in the consuming repository. Nothing new runs anywhere else.

## SAP-Side Objects

| Object | Type | Purpose |
|---|---|---|
| BSP application (name at most fifteen characters) | BSP repository object | Hosts the built single-page application inside SAP, served same-origin, so the front end uses the SAP session and reaches in-boundary ICF services with no bearer token |
| `/UI5/CL_UI5_REP_DT` | Standard ABAP class | Design-time UI5 repository API: the reliable upload path when the OData-based repository service is unhealthy. HTML must be written as text, not binary |
| ABAP repository service (UI5 repository OData) | Standard service | The primary upload path: create or update the application, then push the zipped bundle |
| ICF node for the BSP | ICF node | Serves the application at its BSP path |
| Transport request and Z package | Standard | Every BSP write is bound to a package and a transport supplied by the console, never inferred |
| Fiori launchpad tile (optional) | Standard | Surfaces the deployed BSP to end users |

## Demo Path

1. Technology, Delivery. The managed-repository list: owner, repository, allowed paths, auto-merge flag, BSP target. The agent's blast radius is declared, not discovered.
2. Ask the agent to propose a change outside the allowlist. The service refuses before touching the network. The allowlist is enforced in code, not in the prompt.
3. Trigger the Policy Compiler on a policy the reducer classifies `needs_helper`. The compiler will not fake a compile.
4. The cockpit opens a real pull request adding the helper and its unit test at the allowlisted path. Open it on GitHub: a reviewable diff, with your CODEOWNERS and your checks.
5. Show the pull-request list with live CI state. Checks pass; auto-merge fires. The agent never merged anything; the pipeline did, on green.
6. The consuming repository auto-collects the merged helper by glob. Nothing was wired; the seam was designed for this.
7. Push to the consuming repository. CI builds the SAP-targeted bundle and publishes the zip as a release asset. The build runs where builds run.
8. Click Deploy front-end. The Studio downloads the asset, reads the BSP metadata, and uploads. One button, no laptop, no manual zip.
9. Open the BSP path in SAP. The application loads same-origin on the SAP session and can call in-boundary ICF services with no external egress.
10. Recompile the policy the merged helper unblocked. It flips to compiled. The loop closed: an agent wrote ABAP, wrote TypeScript, shipped both through governance, and the runtime got cheaper.

## Positioning Notes

To a CFO: the bottleneck in AI-assisted delivery is not the code, it is the path from code to production. This makes that path one pull request and one button, with your existing controls in front of it. You do not buy a new pipeline.

To a program manager: the agent's work arrives as a pull request with tests. Your reviewers review it, your checks gate it, and when it merges the deployment is a button in the same console where the design lives.

To a CIO: the token is fine-grained, scoped to named repositories, held as a platform secret. Every write is checked against a per-repository path allowlist before the first API call. Auto-merge is a per-repository flag that only fires on required checks passing; turn it off and the agent can open pull requests and nothing more. On the SAP side we write one BSP application in one package under one transport.

Discriminator vs Deltek Costpoint, Cognitus, and Dassian standalone: no overlap. This is platform engineering.

Discriminator vs SAP Continuous Integration and Delivery, or a hand-rolled pipeline: those build and deploy, and neither is a place an agent can safely propose a change. The differentiator is not the deployment, it is the governed proposal: the registry, the allowlist, the pull request, and the fact that the agent's authority ends at "open a pull request." Lead with that, because the deployment button is the easy half.
