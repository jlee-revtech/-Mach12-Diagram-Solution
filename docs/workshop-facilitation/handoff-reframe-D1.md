# Hand-off - Content Reframe Phase D1 (agent-core content shape + publish)

Phase D1 of the "Facilitation Content Reframe" (Addendum 3). Reads:
`PLAN-content-reframe.md` (this fix's spec; target = "Phase D1" + "New WorkstreamSectionContent
shape"), `PLAN.md` (§7 recipes, §9 hand-off), and `handoff-diagrams-A.md` (prior diagram state).

- agent-core repo: `jlee-revtech/agent-core` (source at `agent-core/src/workshop.ts`).
- app repo: `jlee-revtech/-Mach12-Diagram-Solution` (source at `mach12ai/diagram-app/`).
- Published: **`@jlee-revtech/agent-core@0.6.3`** (GitHub Packages).
- App now consumes **`^0.6.3`**; app version **0.3.131**.

This phase is types + tool schemas + prompts + slide plumbing in agent-core ONLY. No app
renderer, no UI, no routes, no DB. **The app build is intentionally RED after this commit**
because the app renderer (`SectionEditor.tsx` `WorkstreamBody` / `DecisionCard` /
`EvaluationBody`) still references the OLD shape (`focusedContext`, `d.options`, `d.factors`,
string `context` / `rationale`). Fixing the renderer to the new shape is **Phase D2's job**.
Per the task, `npm run build` was NOT run as a gate on the app for this phase.

## 1. What changed (agent-core `src/workshop.ts`)

### New / restructured content types (the surface Phase D2 must match)

```ts
// NEW
export interface FutureStateOption {
  label: string;
  summary?: string;        // one short sentence, optional
  pros: string[];
  cons: string[];
}

// RESTRUCTURED (dropped options + factors; context/rationale now string[]; diagram now REQUIRED)
export interface KeyDecision {
  id: string;
  title: string;                 // framed around the primary topic
  context: string[];             // bullets (was a string blob)
  leadingQuestions: string[];
  recommendedDecision: {
    recommendation: string;      // one short sentence
    rationale: string[];         // bullets (was a string blob)
    confidence?: "low" | "medium" | "high";
  };
  diagram: WorkshopDiagram;      // REQUIRED: every decision has a visual
}

// RESTRUCTURED (removed focusedContext; added the four labeled sub-sections)
export interface WorkstreamSectionContent {
  kind: "workstream";
  workstreamCode: string;
  workstreamName?: string;
  overallConsiderations: string[];         // bullets: why this topic matters, the stakes
  currentState: string[];                  // bullets: the as-is relevant to the decision
  futureStateOptions: FutureStateOption[]; // the menu of to-be options
  keyDecisions: KeyDecision[];             // each framed around the primary topic + a visual
  diagrams?: WorkshopDiagram[];            // optional section-level visual
}

// CHANGED: rationale string -> string[]
export interface EvaluationSectionContent {
  kind: "evaluation";
  divergences: EvaluationDivergence[];
  overallRecommendation: string;   // one short sentence
  pros: string[];
  cons: string[];
  tradeoffs?: string[];
  rationale: string[];             // bullets (was a string)
  diagrams?: WorkshopDiagram[];    // now strongly prompted (quadrant/matrix)
}
```

`OverviewSectionContent` unchanged (`headline`, `talkingPoints: string[]`,
`facilitatorNotes?: string`, `diagrams?`). `WorkshopDiagram` / `WorkshopSlide` unchanged from
diagrams-A (`slide.diagram?` is still how a diagram reaches a slide).

### Tool schemas
- `WORKSTREAM_SECTION_TOOL`: top-level `required` is now `overallConsiderations, currentState,
  futureStateOptions, keyDecisions, clarifyingQuestions, kbGaps, groundingUsed` (no
  `focusedContext`). `overallConsiderations` / `currentState` = STR_ARR; `futureStateOptions` =
  array of `{label STR req, summary STR, pros STR_ARR req, cons STR_ARR req}`; each keyDecisions
  item = `{id, title, context STR_ARR, leadingQuestions STR_ARR, recommendedDecision
  {recommendation STR, rationale STR_ARR, confidence enum}, diagram DIAGRAM_SCHEMA}` with the
  item `required` list INCLUDING `diagram` (forces a visual per decision). Section-level
  `diagrams` still present (not required).
- `EVALUATION_SECTION_TOOL`: `rationale` = STR_ARR; `diagrams` now has a description that
  requires one section diagram (quadrant/matrix); still not in the top-level `required`.

### Prompts (`generateSectionContent`)
- Shared system prompt gained a brevity paragraph: "Be concise and scannable. Use short bullet
  points, one idea each, aim under 18 words. Never write long paragraphs or walls of text. Any
  prose string is at most 1 to 2 short sentences."
- Workstream user prompt now instructs the four labeled sub-sections (Overall Considerations,
  Current State, Options for Future State, Key Decisions framed around the primary topic) and
  REQUIRES a diagram per key decision (flow / matrix-quadrant / layers by fit) plus one
  section-level diagram.
- Evaluation user prompt now requires one section diagram (quadrant/matrix).
- Clarifying-questions + KB-gap + guidance/feedback behavior unchanged.

### Result assembly + slides
- Workstream return maps to `overallConsiderations`, `currentState`, `futureStateOptions`,
  `keyDecisions`, `diagrams` (no `focusedContext`).
- Evaluation return maps `rationale` as an array.
- `stripDashes` still wraps the whole `SectionGenerationResult` as the last step of every
  branch; it deep-walks objects/arrays/strings so the new `string[]` fields and nested option
  arrays are all sanitized (verified by inspection).

### buildSlides (workstream) now emits, in order:
1. `bullets` slide "<ws>: Overall Considerations" (bullets = `overallConsiderations`).
2. `bullets` slide "<ws>: Current State" (bullets = `currentState`).
3. `context` slide "<ws>: Options for Future State" (blocks = one per `futureStateOption`, each
   `{label, body=summary?, pros, cons}`; `slide.diagram = content.diagrams[0]` if present).
4. ONE `decision` slide per KeyDecision: heading = `d.title`; blocks = Context bullets (`d.context`)
   + Leading questions bullets + a Recommendation block (`body = recommendation`, `bullets =
   rationale`, label carries confidence); `slide.diagram = d.diagram` (always present now).
5. Any extra section diagrams beyond the first -> one `context` diagram slide each.
The old `focusedContext` context slide was removed. Evaluation slide now renders `rationale` as
bullets. `buildFacilitationDeck` picks all of this up unchanged (it flatMaps `buildSlides`).
`maxTokens` unchanged (workstream 3600, evaluation 3200).

## 2. Verification
- `cd agent-core && npm run build` -> tsc zero errors.
- `dist/workshop.d.ts`: `FutureStateOption`, `overallConsiderations`, `currentState`,
  `futureStateOptions` present; `KeyDecision.diagram: WorkshopDiagram` (required, not optional);
  `KeyDecision.context: string[]`; `recommendedDecision.rationale: string[]`;
  `EvaluationSectionContent.rationale: string[]`; `focusedContext` GONE (grepped, confirmed).
- Publish: `NODE_AUTH_TOKEN="$(gh auth token)" npm publish` -> `+ @jlee-revtech/agent-core@0.6.3`
  (active gh account `jlee-revtech`, has `write:packages`; 0.6.3 did not already exist).
- App: dep bumped `^0.6.2` -> `^0.6.3`; `npm install` resolved
  `node_modules/@jlee-revtech/agent-core/dist/workshop.d.ts` with `overallConsiderations` +
  `futureStateOptions` and no `focusedContext`; `package-lock.json` pins 0.6.3.
- App `npm run build` NOT run this phase (intentional; app renderer is D2). Expect it to FAIL
  until D2 updates the renderer.

## 3. Phase D2 (app renderer) - what to change to match this shape
- `SectionEditor.tsx` `WorkstreamBody`: render the four labeled sub-sections with bullets:
  Overall Considerations (`c.overallConsiderations`), Current State (`c.currentState`), Options
  for Future State (`c.futureStateOptions` as option cards with `summary` + pros/cons), Key
  Decisions.
- `DecisionCard`: `d.context` is now `string[]` (render bullets, not a paragraph);
  `d.recommendedDecision.rationale` is now `string[]` (bullets); keep `leadingQuestions`; render
  the now-REQUIRED `d.diagram` prominently (already uses `DiagramCard`). No more `d.options` /
  `d.factors`.
- `EvaluationBody`: `c.rationale` is now `string[]` (render bullets).
- Section-level `c.diagrams` still rendered via `SectionDiagrams` (unchanged).
- Be DEFENSIVE for old persisted rows (old shape may be missing new fields or carry
  `focusedContext`): guard every `.map`, fall back gracefully, never crash. Old sections can be
  regenerated.
- Grep the app for `focusedContext`, `.factors`, `d.options`, and string uses of decision
  `context` / `rationale`; remove/adapt them all. Present walkthrough + PPTX are driven by
  `buildSlides`, so mostly automatic; verify a decision slide shows its diagram and bullets.
- Bump app version; build clean; commit; write `handoff-reframe-D2.md`.

## 4. Git
- **agent-core** (`jlee-revtech/agent-core`, branch `main`):
  - Staged: `src/workshop.ts`, `package.json` only.
  - Commit: `<AGENT_CORE_HASH>` `feat(workshop): reframe workstream content into labeled bulleted sections + required per-decision visual [reframe D1]`.
  - Push: `<AGENT_CORE_PUSH>`.
- **app** (`jlee-revtech/-Mach12-Diagram-Solution`, branch `master`):
  - Staged: `package.json`, `package-lock.json`, `src/lib/version.ts`,
    `docs/workshop-facilitation/PLAN-content-reframe.md`,
    `docs/workshop-facilitation/handoff-reframe-D1.md` only. (Parallel WIP NOT staged.)
  - Commit: `<APP_HASH>` `chore(workshops): consume agent-core 0.6.3 (content reframe) [reframe D1]`.
  - Push: `<APP_PUSH>`.
  - NOTE: app build is intentionally RED until D2 updates the renderer.
