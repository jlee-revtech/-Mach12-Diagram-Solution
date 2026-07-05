# Facilitation Content Reframe (Addendum 3)

Josh feedback (2026-07-05) on generated workstream content: (1) it came back as walls of
text; use bullets, never blobs. (2) It should be framed in labeled sections: Overall
Considerations, Current State, Options for Future State, etc. (3) Key Decisions framed
around the primary topic, and EACH decision proposal must have an associated visual.
(4) Diagnosis confirmed live: `focusedContext` returned a 1107-char blob; decision
diagrams DO generate (layers/flow) and DO render in `DecisionCard`, but the blob buries
them. Section-level diagrams came back empty.

Rules that apply everywhere in generated content now: **short bullets, one idea each
(aim under ~18 words). No walls of text. Any prose string is at most 1 to 2 short
sentences. Prefer arrays of short strings over paragraphs.** (Still no em-dashes.)

Base: PLAN.md + PLAN-diagrams-and-prompt.md. App v0.3.130, agent-core 0.6.2. Recipes in
PLAN.md §7. Parallel-WIP rule still applies (never stage `import-vibe-skills.mjs` /
`catalog.ts`; but note they are currently committed, so the tree may be clean).

## New `WorkstreamSectionContent` shape (agent-core)

Replace the old `{ focusedContext: string; keyDecisions[] }` with labeled, bulleted
sub-sections. Diagram is REQUIRED per decision.

```ts
export interface FutureStateOption {
  label: string;
  summary?: string;        // one short sentence, optional
  pros: string[];
  cons: string[];
}
export interface KeyDecision {
  id: string;
  title: string;           // framed around the primary topic
  context: string[];       // bullets (was a string blob)
  leadingQuestions: string[];
  recommendedDecision: {
    recommendation: string;  // one short sentence
    rationale: string[];     // bullets (was a string blob)
    confidence?: "low" | "medium" | "high";
  };
  diagram: WorkshopDiagram;  // REQUIRED: every decision has a visual
}
export interface WorkstreamSectionContent {
  kind: "workstream";
  workstreamCode: string;
  workstreamName?: string;
  overallConsiderations: string[];    // bullets: why this topic matters for this workstream, the stakes
  currentState: string[];             // bullets: the as-is relevant to the decision
  futureStateOptions: FutureStateOption[];  // the menu of to-be options
  keyDecisions: KeyDecision[];        // each framed around the primary topic + a visual
  diagrams?: WorkshopDiagram[];       // optional section-level visual (current-state architecture or an options comparison)
}
```

Dropped from KeyDecision: `options` and `factors` (options now live at the section level
in `futureStateOptions`). `context` and `rationale` become `string[]`.

Also apply brevity to the other kinds:
- `OverviewSectionContent`: `talkingPoints` stays bullets; `facilitatorNotes` at most 2 short
  sentences.
- `EvaluationSectionContent`: change `rationale: string` to `rationale: string[]` (bullets);
  `overallRecommendation` one short sentence; keep pros/cons bullets; STRONGLY prompt a
  section diagram (a quadrant or matrix showing where the workstreams land / diverge). Its
  `diagrams?` already exists; make the model emit one.
- Brief (`generateBrief`): add "be concise, prefer short bullets, no walls of text" to the
  system prompt; keep `preRead` but instruct it to be tight.

## Phase D1 - agent-core (publish 0.6.3)
- Restructure `WorkstreamSectionContent` + `KeyDecision` + add `FutureStateOption` as above.
  Update the `WORKSTREAM_SECTION_TOOL` schema: `overallConsiderations`/`currentState` = STR_ARR;
  `futureStateOptions` = array of {label, summary?, pros[], cons[]}; keyDecisions item with
  `context` STR_ARR, `leadingQuestions` STR_ARR, `recommendedDecision` {recommendation STR,
  rationale STR_ARR, confidence enum}, and `diagram` = DIAGRAM_SCHEMA with `diagram` in the
  keyDecision `required` list (force a visual per decision). Add `diagrams` (section-level)
  and keep it prompted.
- Prompt: produce the four labeled sub-sections (Overall Considerations, Current State,
  Options for Future State, Key Decisions framed around the primary topic). Enforce the
  brevity rules above. Require a diagram per key decision (pick the type that best shows that
  decision: flow for a process/sequence, matrix/quadrant to compare options, layers for
  architecture). Emit one section-level diagram where it helps (e.g. current-state architecture
  or a future-state options comparison).
- Evaluation: `rationale` -> STR_ARR; require a section diagram (quadrant/matrix).
- `buildSlides` (workstream): emit slides for Overall Considerations (bullets), Current State
  (bullets), Options for Future State (bullets/option list, attach a section diagram if present),
  then one slide per KeyDecision (heading, context bullets, leading questions, recommendation)
  with `slide.diagram = decision.diagram`. Remove the old `focusedContext` slide.
- `stripDashes` still wraps the result (deep-walk covers new arrays).
- Build tsc clean; bump 0.6.2 -> 0.6.3; publish; bump app dep to ^0.6.3 + install; app build
  clean; commit both repos; hand-off `handoff-reframe-D1.md` with the exact new types.

## Phase D2 - app renderer
- `SectionEditor.tsx` `WorkstreamBody`: render the four labeled sub-sections with bullets
  (Overall Considerations, Current State, Options for Future State as option cards with
  pros/cons, Key Decisions). `DecisionCard`: render `context` as bullets, `recommendedDecision.
  rationale` as bullets, keep leading questions, and render the REQUIRED `d.diagram` prominently
  (it already uses `DiagramCard`). Render section-level `c.diagrams` (already via SectionDiagrams).
- `EvaluationBody`: render `rationale` as bullets (now string[]); it already renders `c.diagrams`.
- Be DEFENSIVE for old persisted rows (fields may be missing / old shape): guard every
  `.map`, fall back gracefully, never crash. (Old sections can be regenerated.)
- present walkthrough + pptx: driven by `buildSlides`, so mostly automatic; verify a decision
  slide shows its diagram and bullets. No `focusedContext` references remain (grep).
- Bump app version; build clean; commit; hand-off `handoff-reframe-D2.md` (final recap +
  Josh action: regenerate existing sections to pick up the new structure).

## Hand-off protocol: PLAN.md §9.
