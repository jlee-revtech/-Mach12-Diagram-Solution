# Hand-off - Reliable Key Decisions + Diagrams, skip-empty deck slides

Fix for: a real generation returned an EMPTY `keyDecisions` array and no diagrams, so a
workshop section rendered with no decisions and no visuals. This phase forces decisions and
diagrams at the schema + prompt level in `@jlee-revtech/agent-core`, and makes `buildSlides`
skip empty slides so sparse content never yields blank slides.

- agent-core repo: `jlee-revtech/agent-core` (source `agent-core/src/workshop.ts`).
- app repo: `jlee-revtech/-Mach12-Diagram-Solution` (source `mach12ai/diagram-app/`).
- Published: **`@jlee-revtech/agent-core@0.6.5`** (GitHub Packages). NOTE: 0.6.4 was already
  published by a parallel change (RTR/EVMS ownership), so this fix landed on 0.6.5.
- App now consumes **`^0.6.5`**; app version **0.3.137**.

This phase is schema + prompt + slide plumbing in agent-core ONLY, plus the app dep bump and
version. No app renderer, route, UI, or DB change.

## 1. Schema changes (`agent-core/src/workshop.ts`)

### WORKSTREAM_SECTION_TOOL
- `keyDecisions` array property: added `minItems: 2` and `maxItems: 4` (forces 2 to 4 key
  decisions). The keyDecision item `required` already lists `diagram`, so every decision carries
  a diagram. Description updated to say "Always produce 2 to 4."
- `diagrams` (section-level) property: replaced the shared `DIAGRAMS_ARR_SCHEMA` (which said
  "most sections need none") with an inline schema carrying `minItems: 1` and a description
  requiring a current-state architecture (layers) or a future-state options comparison
  (matrix/quadrant). Added `diagrams` to the tool's top-level `required` list.

### EVALUATION_SECTION_TOOL
- `diagrams` property: added `minItems: 1`. Added `diagrams` to the tool's top-level `required`
  list (was absent). Forces at least one quadrant/matrix section diagram.

Net effect on `required`:
- workstream: `overallConsiderations, currentState, futureStateOptions, keyDecisions, diagrams,
  clarifyingQuestions, kbGaps, groundingUsed`.
- evaluation: `divergences, overallRecommendation, pros, cons, rationale, diagrams`.

## 2. Prompt changes (`generateSectionContent`)

- WORKSTREAM branch instruction now states, emphatically and guidance-proof: "You MUST produce
  2 to 4 Key Decisions framed around the primary topic. EACH Key Decision MUST include a diagram
  (the type that best shows that decision: flow for a process or sequence, matrix or quadrant to
  compare options, layers for an architecture). You MUST also include at least one section-level
  diagram ... These structural requirements are mandatory regardless of any facilitator guidance
  about tone or brevity: honor the guidance in wording, never by dropping decisions or diagrams."
- EVALUATION branch instruction gained the equivalent "You MUST include at least one section
  diagram ... mandatory regardless of any facilitator guidance about tone or brevity: honor the
  guidance in wording, never by dropping the diagram."
- Existing brevity (short bullets), the four labeled sub-sections, and the guidance/feedback
  behavior are unchanged.

## 3. buildSlides skip-empty changes (`buildSlides`)

- Overview: only push the talking-points slide if `talkingPoints.length > 0`; still push its
  diagram slides.
- Workstream: only push "Overall Considerations" if `overallConsiderations.length > 0`; only
  push "Current State" if `currentState.length > 0`; only push "Options for Future State" if
  `futureStateOptions.length > 0` OR a section diagram exists. Decision-slide emission unchanged
  (decisions now always exist).
- Evaluation: `evalBlocks` is built up conditionally, dropping any empty block (no overall
  recommendation, empty Pros, empty Cons, empty Tradeoffs, empty Rationale). The summary slide is
  only pushed if at least one block survives. Divergence slides are only pushed when the
  divergence carries positions; the Tension block is omitted when tension is empty.

## 4. Verification

- `cd agent-core && npm run build` -> tsc zero errors. `dist/workshop.js` shows `minItems` at
  three sites (keyDecisions=2, workstream diagrams=1, evaluation diagrams=1).
- Publish: `NODE_AUTH_TOKEN="$(gh auth token)" npm publish` -> `+ @jlee-revtech/agent-core@0.6.5`
  (active gh account `jlee-revtech`, has `write:packages`; 0.6.4 already existed so bumped to
  0.6.5).
- App: dep bumped `^0.6.4` -> `^0.6.5`; `npm install` resolved
  `node_modules/@jlee-revtech/agent-core/dist/workshop.js` with 3 `minItems`; `package-lock.json`
  pins 0.6.5. App `npm run build` -> "Compiled successfully".
- Live verify (2 runs, real Anthropic call, workstream section for Moog "Commercial vs Defense
  Company Code Structure", timebox 20, duration 120, guidance "Keep it executive-level"):
  - run 1: decisions=2, every decision has a diagram (2/2), sectionDiagrams=1, options=3 -> PASS
  - run 2: decisions=2, every decision has a diagram (2/2), sectionDiagrams=1, options=3 -> PASS

## 5. Git

- agent-core (`jlee-revtech/agent-core`, branch `main`):
  - Staged: `src/workshop.ts`, `package.json` only.
  - Commit: `4bed664` `feat(workshop): require 2-4 key decisions each with a diagram + a section diagram; skip empty deck slides [0.6.5]`.
  - Push: succeeded (`a57889f..4bed664  main -> main`).
- app (`jlee-revtech/-Mach12-Diagram-Solution`, branch `master`):
  - Staged: `package.json`, `package-lock.json`, `src/lib/version.ts`,
    `docs/workshop-facilitation/handoff-decisions-diagrams.md` only. (Parallel WIP NOT staged.)
  - Commit: `f034c12` `chore(workshops): consume agent-core 0.6.5 (mandatory decisions + diagrams)`.
  - Push: succeeded (`2213a37..f034c12  master -> master`).
