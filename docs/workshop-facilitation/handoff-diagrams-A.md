# Hand-off - Diagrams Phase A (agent-core diagram spec + guidance param + publish)

Phase A of the "Facilitation Content: Diagrams + Prompt-Entry" enhancement. Reads:
`PLAN-diagrams-and-prompt.md` (the enhancement spec), `PLAN.md` (§7 recipes, §9 hand-off),
and `handoff-phase2a.md` (the existing agent-core workshop API).

- agent-core repo: `jlee-revtech/agent-core` (source at `agent-core/src/workshop.ts`).
- app repo: `jlee-revtech/-Mach12-Diagram-Solution` (source at `mach12ai/diagram-app/`).
- Published: **`@jlee-revtech/agent-core@0.6.2`** (GitHub Packages).
- App now consumes **`^0.6.2`**; app version **0.3.128**.

This phase is types + prompt + slide plumbing ONLY. No SVG renderer, no UI, no routes,
no DB (those are Phases B and C).

## 1. What I built

### agent-core (`agent-core/src/workshop.ts`, changed)

- **New diagram vocabulary** (exported):
  - `WorkshopDiagramType = "flow" | "matrix" | "quadrant" | "layers"`.
  - `WorkshopDiagram` (all fields optional except `type`; per-type fields below).
- **Attached diagrams to the content model** (all optional):
  - `OverviewSectionContent`, `WorkstreamSectionContent`, `EvaluationSectionContent`
    each gain `diagrams?: WorkshopDiagram[]`.
  - `KeyDecision` gains `diagram?: WorkshopDiagram`.
  - `WorkshopSlide` gains `diagram?: WorkshopDiagram` (this is the field Phase B renders).
- **Extended the three forced-tool schemas** so the model MAY emit diagrams:
  - Added a reusable `DIAGRAM_SCHEMA` (JSON-schema for one `WorkshopDiagram`: `type`
    enum required; per-type fields optional; quadrant `points[].x/y` are numbers 0..1),
    plus `DIAGRAMS_ARR_SCHEMA` (array of it).
  - `OVERVIEW_SECTION_TOOL`, `WORKSTREAM_SECTION_TOOL`, `EVALUATION_SECTION_TOOL` each
    gained `diagrams` (NOT required). `WORKSTREAM_SECTION_TOOL`'s keyDecision item schema
    gained `diagram: DIAGRAM_SCHEMA` (NOT required).
  - Section prompt gained the diagram guidance line (`DIAGRAM_PROMPT_GUIDANCE`, appended
    to `ctxParts` for every section kind): "Include a diagram ONLY where it genuinely
    showcases the content ... When you do, fill only the fields for that diagram type."
- **`guidance?: string`** added to `GenerateBriefInput` and `GenerateSectionInput`.
  Threaded into both prompts as `Additional facilitator guidance to honor across this
  content: ${guidance}`. In `generateSectionContent`, `feedback` (per-section revise)
  and `guidance` (global steer) are SEPARATE inputs, both threaded when present.
- **`buildSlides`** now emits diagram slides:
  - Section-level `diagrams`: one extra slide per diagram (heading = `diagram.title` or
    the section heading; `caption` becomes a single bullet; `slide.diagram` set). Overview
    diagrams -> `bullets` kind; workstream -> `context` kind; evaluation -> `evaluation` kind.
  - `KeyDecision.diagram`: attached to that decision's existing slide via `slide.diagram`
    (no extra slide). `buildFacilitationDeck` picks all of this up automatically since it
    concatenates `buildSlides`.
- **Sanitizer**: `stripDashes` still wraps the full `SectionGenerationResult` (built with
  `content.diagrams` and each `keyDecision.diagram` already attached) BEFORE return, and it
  deep-walks objects/arrays/strings, so all new diagram string fields are sanitized. No move
  was needed (verified by inspection: sanitize call is the last step in every branch).
- maxTokens bumped for headroom: workstream 3200 -> 3600, evaluation 2800 -> 3200.

### agent-core (`agent-core/package.json`, changed)
- Version `0.6.1` -> `0.6.2`.

### app (`mach12ai/diagram-app/`)
- `package.json`: `@jlee-revtech/agent-core` `^0.6.1` -> `^0.6.2`; app `0.3.127` -> `0.3.128`.
- `package-lock.json`: resolves `@jlee-revtech/agent-core@0.6.2`.
- `src/lib/version.ts`: `APP_VERSION` `0.3.127` -> `0.3.128`.
- `docs/workshop-facilitation/PLAN-diagrams-and-prompt.md` (the enhancement spec, committed now).
- `docs/workshop-facilitation/handoff-diagrams-A.md` (this file).

No app UI, routes, or DB touched. Nothing in the app consumes diagrams yet (Phase B/C).

## 2. Public surface Phase B / C import from `@jlee-revtech/agent-core@0.6.2`

```ts
export type WorkshopDiagramType = "flow" | "matrix" | "quadrant" | "layers";

export interface WorkshopDiagram {
  type: WorkshopDiagramType;
  title?: string;
  caption?: string;
  // flow: an ordered sequence of steps, elbow arrows between them
  steps?: { label: string; sublabel?: string }[];
  // matrix: a comparison table (options x criteria, RACI, etc.)
  columns?: string[];
  rows?: { label: string; cells: string[] }[];
  // quadrant: two labeled axes + items positioned in 0..1 space
  xAxis?: { low: string; high: string };
  yAxis?: { low: string; high: string };
  points?: { label: string; x: number; y: number }[];   // x,y in 0..1
  // layers: grouped boxes in horizontal bands + optional elbow connectors by node label
  layers?: { label: string; nodes: string[] }[];
  connections?: { from: string; to: string; label?: string }[];
}
```

Diagrams attach to content (all optional):

```ts
interface OverviewSectionContent    { /* ... */ diagrams?: WorkshopDiagram[]; }
interface WorkstreamSectionContent  { /* ... */ diagrams?: WorkshopDiagram[]; }
interface EvaluationSectionContent  { /* ... */ diagrams?: WorkshopDiagram[]; }
interface KeyDecision               { /* ... */ diagram?:  WorkshopDiagram; }
```

Diagrams reach the deck via one slide field (THIS is what Phase B renders):

```ts
interface WorkshopSlide {
  kind: "title" | "agenda" | "bullets" | "context" | "decision" | "evaluation";
  heading: string;
  subheading?: string;
  bullets?: string[];
  blocks?: WorkshopSlideBlock[];
  facilitatorNotes?: string;
  diagram?: WorkshopDiagram;   // NEW: render this when present
}
```

Guidance params (Phase C wiring): both threaded into the prompt when present.

```ts
interface GenerateBriefInput   { /* ... */ guidance?: string; }
interface GenerateSectionInput { /* ... */ feedback?: string; guidance?: string; }
// feedback = per-section revise instruction; guidance = global workshop steer.
// generateSectionContent threads BOTH when present, independently.
```

### How buildSlides emits diagram slides (so Phase B knows what to expect)

- A section with `diagrams: [d1, d2]` yields its normal text slide(s), then one extra
  slide per diagram, each carrying `slide.diagram = dN`, `slide.heading = dN.title ||
  <section heading>`, and (if present) `slide.bullets = [dN.caption]`.
- A `KeyDecision` with a `diagram` carries it on that decision's own slide (`slide.diagram`);
  no extra slide is added.
- `buildFacilitationDeck` (title slide + agenda slide + `flatMap(buildSlides)`) surfaces all
  of these unchanged. Phase B: iterate the deck, and for any slide where `slide.diagram` is
  set, render `renderWorkshopDiagramSvg(slide.diagram)` (HTML) / rasterize it (PPTX).

## 3. Verification

- **agent-core build**: `cd agent-core && npm run build` -> tsc zero errors (strict +
  `noUncheckedIndexedAccess` + `verbatimModuleSyntax`).
- **dist exports**: `dist/workshop.d.ts` shows `WorkshopDiagramType`, `WorkshopDiagram`,
  `diagrams?: WorkshopDiagram[]` on the three content types, `diagram?: WorkshopDiagram`
  on `KeyDecision` and `WorkshopSlide`, and `guidance?: string` on both input interfaces
  (grepped, confirmed). `dist/index.d.ts` re-exports `./workshop.js`.
- **publish**: `NODE_AUTH_TOKEN="$(gh auth token)" npm publish` from `agent-core` ->
  `+ @jlee-revtech/agent-core@0.6.2` (active gh account `jlee-revtech`, has `write:packages`).
  0.6.2 did not already exist, so no bump-to-0.6.3 was needed.
- **app install**: `NODE_AUTH_TOKEN="$(gh auth token)" npm install` -> installed
  `@jlee-revtech/agent-core@0.6.2`; `node_modules/.../dist/workshop.d.ts` shows
  `WorkshopDiagram` + `guidance`; `package-lock.json` pins `^0.6.2`.
- **app build**: `npm run build` (Next 16) -> "Compiled successfully", "Finished
  TypeScript", 27/27 static pages, no errors. (Nothing consumes diagrams yet; this confirms
  the install resolved and types are intact.)

## 4. Gotchas / open items for Phase B/C

- **agent-core does NOT commit `dist/`** (`.gitignore` lists it). Only `src/workshop.ts` +
  `package.json` were staged. GitHub Packages serves the built `dist` from the tarball; the
  repo tree stays source-only. Do not force-add `dist`.
- **App parallel WIP left untouched**: `scripts/import-vibe-skills.mjs` and
  `src/lib/workstream/catalog.ts` are modified/uncommitted from another session. NOT staged,
  NOT touched. Still uncommitted in the working tree. Never `git add -A`.
- **The model may emit no diagrams**, and usually should not for overview. `diagrams` is
  omitted from the content object when the model returns none (only set when
  `res.diagrams?.length`), so Phase B must treat `section.diagrams` / `slide.diagram` as
  optional and render nothing when absent.
- **quadrant points are 0..1** (x = low->high left->right, y = low->high). The schema
  documents this; the renderer must map to pixel space and clamp.
- **Phase B invariant (from the spec)**: ONE pure `renderWorkshopDiagramSvg(d)`; HTML injects
  the SVG, PPTX rasterizes the SAME SVG to PNG. Follow the `diagrams` skill (elbow connectors
  only, no overlap, measured box sizing, brand palette).

## 5. Git

- **agent-core** (`jlee-revtech/agent-core`, branch `main`):
  - Staged: `src/workshop.ts`, `package.json` only.
  - Commit: `<AGENT_CORE_HASH>` `feat(workshop): diagram spec on section content + slides, guidance param [diagrams A]`.
  - Push: `<AGENT_CORE_PUSH>`.
- **app** (`jlee-revtech/-Mach12-Diagram-Solution`, branch `master`):
  - Staged: `package.json`, `package-lock.json`, `src/lib/version.ts`,
    `docs/workshop-facilitation/PLAN-diagrams-and-prompt.md`,
    `docs/workshop-facilitation/handoff-diagrams-A.md` only. (Parallel WIP NOT staged.)
  - Commit: `<APP_HASH>` `chore(workshops): consume agent-core 0.6.2 (diagram spec + guidance) [diagrams A]`.
  - Push: `<APP_PUSH>`.
