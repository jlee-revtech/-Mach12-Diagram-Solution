# Hand-off - Diagrams Phase B (SVG renderer + editor/walkthrough render + PPTX rasterization)

Phase B of the "Facilitation Content: Diagrams + Prompt-Entry" enhancement. Reads:
`PLAN-diagrams-and-prompt.md` (the enhancement spec, "Phase B"), `handoff-diagrams-A.md`
(the exact `WorkshopDiagram` type + where diagrams attach), and `PLAN.md` (§7 recipes, §9
hand-off). App-only. No agent-core, no routes, no DB, no package publish.

- app repo: `jlee-revtech/-Mach12-Diagram-Solution` (source at `mach12ai/diagram-app/`).
- Consumes `@jlee-revtech/agent-core@^0.6.2` (unchanged). App version **0.3.128 -> 0.3.129**.

Followed the `diagrams` skill: elbow / orthogonal connectors only (H/V paths, verified zero
diagonal `<line>` elements emitted), connections dock to face centers with an arrowhead gap,
boxes measured-to-content before layout (no overlaps), consistent per-type sizing + grid
alignment, layered spacing, brand palette (blue #2563EB, ink #0F172A, slate #475569, cyan
#06B6D4, semantic green/amber/red/violet), opaque label chips.

## 1. Files added / changed

- **`src/lib/workshop/diagramSvg.ts`** (NEW) - pure, DOM-free renderer. `renderWorkshopDiagramSvg`
  returns a self-contained SVG string (inline attributes, system font stack, one reusable
  arrowhead marker). Implements all four types (flow, matrix, quadrant, layers). Defensive:
  missing per-type fields render an empty frame instead of throwing; `null`/non-object input is
  coerced to a safe default.
- **`src/components/workshop/DiagramView.tsx`** (NEW) - shared client component. `DiagramView`
  renders the SVG and injects it via `dangerouslySetInnerHTML` (app-built SVG from structured
  data, not raw LLM output). `makeResponsive` strips the intrinsic `width`/`height` attrs and adds
  `preserveAspectRatio` + `style="width:100%;height:auto"` so the viewBox drives the aspect ratio
  while the SVG scales to its column. `DiagramCard` wraps it in a bordered, horizontally-scrollable
  card matching the editor styling. Both imported by the editor and the walkthrough.
- **`src/components/workshop/SectionEditor.tsx`** (CHANGED) - imports `DiagramCard` +
  `WorkshopDiagram`. New `SectionDiagrams` helper renders `content.diagrams` below each per-kind
  body (Overview / Workstream / Evaluation bodies). `DecisionCard` renders `keyDecision.diagram`
  after the recommended-decision block. Editor renders at intrinsic width 520-560px.
- **`src/app/workshops/[id]/present/page.tsx`** (CHANGED) - imports `DiagramView`. `SlideStage`
  short-circuits to a new `DiagramSlide` when `slide.diagram` is set (before the kind switch), so a
  diagram slide shows the heading + the diagram prominently (intrinsic width 880px, filling the
  stage) plus any caption bullets beneath.
- **`src/lib/workshop/export.ts`** (CHANGED) - new `svgToPngDataUrl` (browser canvas at 2x, white
  fill, `toDataURL('image/png')`, returns `''` on failure). `exportFacilitationPptx` gained a
  diagram branch right after the heading band: renders the SAME SVG (intrinsic width 960), rasterizes
  it, and `addImage` centered below the heading preserving aspect ratio (fit to the area minus
  heading + caption room), with caption bullets at the bottom. Rasterization failure skips the image
  and never throws out of the export.
- **`src/lib/version.ts`** + **`package.json`** - `0.3.128` -> `0.3.129`.
- **`docs/workshop-facilitation/handoff-diagrams-B.md`** (this file).

## 2. Public surface (signatures Phase C / future callers use)

```ts
// src/lib/workshop/diagramSvg.ts
export interface SvgResult { svg: string; width: number; height: number }
export function renderWorkshopDiagramSvg(
  d: WorkshopDiagram,
  opts?: { width?: number; theme?: 'light' | 'dark' },
): SvgResult
// width is clamped to [360, 1100] (default 720). theme accepted for forward-compat;
// current palette is a light surface (embeds well in white PPTX slides + light editor cards).

// src/components/workshop/DiagramView.tsx
export default function DiagramView(props: { diagram: WorkshopDiagram; width?: number; className?: string }): JSX.Element
export function DiagramCard(props: { diagram: WorkshopDiagram; width?: number }): JSX.Element

// src/lib/workshop/export.ts (module-private, not exported)
async function svgToPngDataUrl(svg: string, width: number, height: number): Promise<string>
```

Per-type rendering (all fields optional except `type`; missing = skipped):
- **flow**: measured rounded-rect step boxes L-to-R, wrap after 4 per row, numbered chips, optional
  sublabel. Same-row connectors are right-face -> left-face (H). Row wraps route V-H-V through a
  mid-gutter into the top-center of the next row's first box.
- **matrix**: header row (`columns`) in a blue band + left header column (`rows[].label`) tinted;
  cells wrapped to even data-column widths; zebra rows; thin borders; rounded outer frame.
- **quadrant**: square plot, axes crossing at center (H + V lines), the four `xAxis.low/high` +
  `yAxis.low/high` labels at the axis ends, faint quadrant fills, `points[]` at (x,y) in 0..1 (y up,
  clamped) as labeled dots; labels anchored by half (right half -> end-anchored, left -> start) with
  opaque chips so they never spill off the frame.
- **layers**: horizontal bands top-to-bottom, a reserved left label gutter (128px, never overlapping
  a node), nodes as a centered row of measured boxes; `connections[]` dock source bottom-center ->
  target top-center, routed V-H-V through the mid-gutter, optional edge label as an opaque chip.

## 3. How the three surfaces consume it (ONE representation)

- **Editor** (`SectionEditor.tsx`): `SectionDiagrams` maps `content.diagrams` to `DiagramCard`;
  `DecisionCard` renders `d.diagram`. Injected SVG, responsive.
- **Walkthrough** (`present/page.tsx`): `DiagramSlide` renders `slide.diagram` via `DiagramView`.
  Reuses the exact same component/injection path as the editor (both import `DiagramView`).
- **PPTX** (`export.ts`): the diagram branch rasterizes the SAME `renderWorkshopDiagramSvg` output
  to PNG and `addImage`s it. No per-surface diagram logic; the SVG is the single source.

`buildSlides` (agent-core, Phase A) already emits one slide per section-level diagram carrying
`slide.diagram` (+ `slide.bullets = [caption]`), and attaches a KeyDecision diagram to that
decision's slide. Phase B renders any slide where `slide.diagram` is set; the editor additionally
renders the raw `content.diagrams` / `keyDecision.diagram` structures directly.

## 4. Verification

- **App build**: `npm run build` (Next 16) -> "Compiled successfully in 5.6s", "Finished
  TypeScript" with zero errors. No `any` (imports `WorkshopDiagram` / `WorkshopSlide` from
  agent-core). Only warning is the pre-existing Next workspace-root inference (unrelated).
- **Renderer runtime check**: compiled `diagramSvg.ts` standalone with tsc and rendered sample
  flow/matrix/quadrant/layers. Results: flow 720x284, matrix 720x189, quadrant 720x517, layers
  720x304; **zero diagonal `<line>` elements** in any output (every `<line>` is H or V by
  construction; every connector is an `M/H/V`-only `<path>`). Empty (`{type:'flow'}`) and `null`
  inputs both degrade to an 84px empty frame without throwing. Layer connectors confirmed as clean
  V-H-V elbow routes docked to face centers.
- **NOT visually inspected in a browser**: I did not launch the app / a browser, so the SVG was
  verified structurally (dimensions, no-diagonal, no-throw, path geometry) but not eyeballed
  rendered. The PPTX `svgToPngDataUrl` path (Image + canvas) is browser-only and was not executed;
  it is guarded to return `''` on any failure so the export can never throw.

## 5. Gotchas / notes for Phase C

- **Where diagrams render (so "Regenerate content" refreshes them naturally)**: diagrams live
  entirely inside the section content JSON (`content.diagrams`, `keyDecision.diagram`) and, via
  `buildSlides`, on `slide.diagram`. Phase C's section route already persists the whole
  `SectionContent` returned by `generateSectionContent`, so regenerating a section overwrites its
  diagrams and both surfaces re-render on the next deck load. Phase C needs nothing structural from
  Phase B.
- The renderer clamps `opts.width` to [360, 1100]. The editor passes 520-560 (narrow column), the
  walkthrough 880, the PPTX 960. Wrapping-per-row (flow/layers) is driven by that width.
- Text width is estimated (`fontSize * 0.58` per char), not measured against a real font, so box
  sizing is approximate; padding + wrap caps keep it overlap-free but exact text metrics will differ
  slightly across fonts. This is intentional for a pure DOM-free renderer.
- `dangerouslySetInnerHTML` is used in `DiagramView`; it is safe here because the SVG is built by the
  app from the typed structure with all text XML-escaped (`esc()`), never from raw LLM HTML.
- Parallel-session WIP `scripts/import-vibe-skills.mjs` and `src/lib/workstream/catalog.ts` were
  NOT staged or touched. Never `git add -A`.

## 6. Git

- app (`jlee-revtech/-Mach12-Diagram-Solution`, branch `master`):
  - Staged ONLY: `src/lib/workshop/diagramSvg.ts`, `src/components/workshop/DiagramView.tsx`,
    `src/components/workshop/SectionEditor.tsx`, `src/app/workshops/[id]/present/page.tsx`,
    `src/lib/workshop/export.ts`, `package.json`, `src/lib/version.ts`,
    `docs/workshop-facilitation/handoff-diagrams-B.md`.
  - Commit: `<APP_HASH>` `feat(workshops): render content diagrams as SVG (editor + walkthrough) + PPTX rasterization [diagrams B]`.
  - Push: `<APP_PUSH>`.
