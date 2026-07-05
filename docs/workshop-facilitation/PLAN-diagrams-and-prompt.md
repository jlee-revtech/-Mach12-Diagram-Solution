# Facilitation Content: Diagrams + Prompt-Entry (Addendum to PLAN.md)

Authoritative spec for two enhancements on top of the shipped facilitation feature
(see `PLAN.md` for the base, and `handoff-phase1..5.md`). Same rules apply: read this
+ the latest `handoff-diagrams-*.md`, build your phase, bump version, build clean,
commit + push scoped (NEVER `git add -A`; the app tree carries parallel WIP in
`scripts/import-vibe-skills.mjs` + `src/lib/workstream/catalog.ts`, do not stage them),
write your hand-off. Recipes (agent-core publish, DDL apply, version bump, git) are in
`PLAN.md` §7. No em-dashes in anything you author.

Current state at start: app v0.3.126, agent-core 0.6.1 (has the em-dash sanitizer +
`generateSectionContent`/`buildSlides`/`buildFacilitationDeck`/`normalizeAgendaTimeboxes`).

## Goal

1. **Diagrams/visuals in the content, where they showcase something.** The LLM emits
   optional structured diagrams on section content; they render in the section editor,
   the Workshop Experience walkthrough, AND the PPTX, all from ONE representation.
2. **Prompt entry to generate/enrich content**, at TWO levels:
   - **Per section**: a prompt box that generates or enriches THAT section (largely
     exists as the SectionEditor "feedback" box; make it clearly a prompt, and make it
     work on first-generate too).
   - **Workshop level**: a persisted prompt (`facilitation_prompt`) plus a "Regenerate
     content" button. The workshop prompt is threaded into ALL generation (brief +
     every section). "Regenerate content" re-runs every existing section honoring it,
     keeping the agenda intact.

Design invariant carried from PLAN.md: ONE representation drives every surface. For
diagrams, agent-core emits a typed `WorkshopDiagram`; the app has ONE pure
`renderWorkshopDiagramSvg(d): string`; the HTML surfaces inject that SVG; the PPTX
exporter rasterizes that same SVG to PNG and embeds it. No per-surface diagram logic.

## Diagram vocabulary (agent-core `WorkshopDiagram`)

Keep it a small, high-value, tractable set. The LLM picks the type that fits and fills
the matching fields; all fields optional except `type`.

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
  points?: { label: string; x: number; y: number }[];
  // layers: grouped boxes in horizontal bands + optional elbow connectors by node label
  layers?: { label: string; nodes: string[] }[];
  connections?: { from: string; to: string; label?: string }[];
}
```

Guidance to bake into the generator prompt: include a diagram ONLY where it genuinely
showcases the content, e.g. a `flow` for a to-be process / decision sequence, a
`quadrant` for trade-off positioning or where workstreams diverge (evaluation), a
`matrix` for option-vs-criteria comparison, `layers` for a systems / integration
architecture. Do not add gratuitous diagrams. Overview sections rarely need one.

## Where diagrams attach

- `OverviewSectionContent`, `WorkstreamSectionContent`, `EvaluationSectionContent` each
  gain optional `diagrams?: WorkshopDiagram[]`.
- `KeyDecision` gains optional `diagram?: WorkshopDiagram`.
- `WorkshopSlide` gains optional `diagram?: WorkshopDiagram`. `buildSlides` emits a slide
  carrying the diagram (heading + optional bullets + the diagram) wherever a section /
  key decision has one, so the deck + walkthrough show it.

## Guidance param (prompt entry plumbing)

- `GenerateBriefInput` gains `guidance?: string`; `GenerateSectionInput` gains
  `guidance?: string` (SEPARATE from the section `feedback`: `guidance` is the global
  workshop steer, `feedback` is the per-section revise instruction; thread BOTH into the
  prompt when present).
- New DB column `workshops.facilitation_prompt text` (migration `047`).
- Brief route: read `workshops.facilitation_prompt` (or accept `guidance` in the body) and
  pass to `generateBrief`.
- Section route: read `workshops.facilitation_prompt` and pass as `guidance`; keep the
  existing `feedback` param for the per-section prompt.

## Regenerate content semantics

- Workshop-level "Regenerate content" button: for every agenda item that currently has a
  content row, call the section route again (guidance = the workshop prompt), sequentially
  or with small concurrency. Keeps the agenda; refreshes/enriches all sections.
- "Regenerate brief" also passes guidance. (Regenerating the brief still cascade-deletes
  section content, that is existing behavior; leave it.)

## Phases

### Phase A - agent-core (publish 0.6.2)
- Add `WorkshopDiagram` + attach `diagrams?`/`diagram?` to the three content types +
  `KeyDecision`, and `diagram?` to `WorkshopSlide`.
- Extend the three `generateSectionContent` forced-tool schemas so the model can emit
  diagrams (the `WorkshopDiagram` shape) where useful; extend the system/user prompt with
  the "include a diagram only where it showcases the content" guidance above.
- Add `guidance?` to `GenerateBriefInput` + `GenerateSectionInput` and thread into prompts.
- `buildSlides`: emit slides carrying `diagram` for section-level diagrams and per-KeyDecision
  diagrams. Keep the em-dash sanitizer covering the new string fields (it deep-walks, so it
  already will; verify).
- Build (tsc clean), bump 0.6.1 -> 0.6.2, publish, bump app dep to ^0.6.2 + install, app
  build clean. Commit both repos. Hand-off `handoff-diagrams-A.md` with the exact new types +
  signatures.

### Phase B - app diagram rendering + PPTX
- `src/lib/workshop/diagram.tsx` (or .ts): pure `renderWorkshopDiagramSvg(d: WorkshopDiagram,
  opts?: { width?: number }): string` returning a clean, self-contained SVG string. FOLLOW THE
  `diagrams` SKILL (invoke it): elbow / orthogonal connectors only (never diagonal), no
  overlapping boxes, docked connection points, consistent sizing, brand palette (blue #2563EB,
  ink #0F172A, grey #475569, surfaces). Implement all four types (flow, matrix, quadrant,
  layers). Measure text to size boxes so nothing overlaps.
- Render the SVG in the section editor (below the content) and in the present walkthrough
  (on `slide.diagram`), via `dangerouslySetInnerHTML` (app-built SVG from structured data,
  not raw LLM output, so it is safe).
- `svgToPngDataUrl(svg, w, h): Promise<string>` (browser canvas: load SVG as Image, draw to
  canvas, `toDataURL('image/png')`). In `exportFacilitationPptx`, for any slide with a
  `diagram`, rasterize via `svgToPngDataUrl` and `slide.addImage({ data, x, y, w, h })`.
- Build clean; commit; hand-off `handoff-diagrams-B.md` (the render fn signature + how present
  + pptx consume it).

### Phase C - app prompt entries + guidance wiring (migration 047)
- Migration `supabase/047_workshop_facilitation_prompt.sql`: `ALTER TABLE workshops ADD COLUMN
  IF NOT EXISTS facilitation_prompt text;` Apply via the PLAN.md §7 recipe. Add
  `facilitation_prompt` to the `Workshop` type + `updateWorkshop` updates + a
  `setFacilitationPrompt` helper (or reuse updateWorkshop).
- Routes: brief route + section route read `workshops.facilitation_prompt` and pass it as
  `guidance` to the agent-core calls (section route keeps `feedback` for the per-section prompt).
- UI:
  - Prep view (workshop level): a persisted prompt textarea ("Guidance for all content:
    tone, emphasis, what to include") + a "Regenerate content" button that re-runs every
    section that has content (guidance = the prompt), with progress; the existing "Regenerate
    brief" also sends guidance.
  - SectionEditor (section level): make the prompt box a clear "Prompt: generate or enrich
    this section" that works on first generate too (send its text as `feedback`).
- Build clean; commit; hand-off `handoff-diagrams-C.md` (final: whole enhancement recap +
  Josh action items, e.g. migration applied, any env notes).

## Hand-off protocol
Same as PLAN.md §9. Each phase: files changed, the public surface the next phase depends on
(types / signatures / routes / columns as code blocks), verification (builds/publish/migration),
gotchas, git commit hash(es) + push status.
