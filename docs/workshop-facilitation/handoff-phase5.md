# Hand-off — Phase 5 (facilitation PPTX export + download buttons) — FINAL

Phase 5 of the Workshop Facilitation Content build, and the FINAL phase. Reads: `PLAN.md`
§6 (Phase 5), §3 (slide model), §7 (recipes), §9 (hand-off); `handoff-phase2a.md`
(`WorkshopSlide` / `WorkshopSlideBlock` shapes); `handoff-phase4.md` (`loadFacilitationDeck`
signature/return shape, which Phase 5 reuses).
App: `mach12ai/diagram-app`. DB: `lmuwylgbabcdnfmtscom`. Repo: `jlee-revtech/-Mach12-Diagram-Solution`.
agent-core consumed: `@jlee-revtech/agent-core@0.6.0`.

## 1. What I built

- `src/lib/workshop/export.ts` (CHANGED) — added `exportFacilitationPptx(meta, slides)`.
  One PPTX slide per `WorkshopSlide`, rendered by `slide.kind`, matching the recap-pptx
  look (16:9 layout `13.333x7.5`, brand blue `2563EB`, dark `0F172A`, grey `475569`,
  `pptxgenjs.default` dynamic import). Reuses the file's existing `download()` and `safe()`
  helpers (no second downloader). Imports `WorkshopSlide` + `WorkshopSlideBlock` from
  `@jlee-revtech/agent-core`.
- `src/app/workshops/[id]/present/page.tsx` (CHANGED) — a "Download PPTX" button in the top
  bar (next to "Notes") that calls `exportFacilitationPptx` on the already-loaded `deck` state.
- `src/app/workshops/[id]/page.tsx` (CHANGED, prep view) — a "⤓ Download facilitation deck
  (PPTX)" button in the Sections header, next to "▶ Enter Workshop Experience". It calls
  `loadFacilitationDeck(null, ws.id)` then `exportFacilitationPptx`. Enabled once at least one
  section has authored content (`hasAnyContent`, same gate as the Experience button). Styled
  to match the existing recap "Export Deck" / "Regenerate brief" outline buttons.
- `package.json` + `src/lib/version.ts` (CHANGED) — app version `0.3.124` -> `0.3.125`.
- `docs/workshop-facilitation/handoff-phase4.md` (CHANGED) — Phase 4's commit-hash record
  (a stray one-line doc edit left in the tree from Phase 4; staged to clean the tree).
- `docs/workshop-facilitation/handoff-phase5.md` (this file).

No agent-core, API-route, or DB-schema changes (per constraints). No embedding/import run.

## 2. Public surface — `exportFacilitationPptx`

```ts
// src/lib/workshop/export.ts
export async function exportFacilitationPptx(
  meta: { title: string; customerName?: string; topic?: string; durationMinutes?: number },
  slides: WorkshopSlide[],
): Promise<void>
```

- One slide per `WorkshopSlide`, switched on `slide.kind`:
  - `title` -> title slide: big heading, subheading in blue, `{customerName} · Workshop
    facilitation deck` footer.
  - `agenda` / `bullets` -> heading (+ subheading kicker) + a native bullet list from
    `slide.bullets`.
  - `context` -> heading + body paragraphs (joined from `blocks[].body`, falling back to
    `bullets`).
  - `decision` / `evaluation` -> heading + a 2-column card grid over `slide.blocks`.
    Prose blocks and the "Recommended…" block span full width (recommendation gets a blue
    tinted card); pros/cons blocks render side-by-side PROS (green) / CONS (red) sub-columns;
    bullet blocks render as a bulleted card. This mirrors the present view's `blockSpan()` /
    `SlideBlock` logic so the deck and the HTML walkthrough do not drift.
- `slide.facilitatorNotes` -> PowerPoint speaker notes via `pptSlide.addNotes(...)` (only when
  present).
- Downloads as `{safe(title)}-facilitation.pptx` via the shared `download()` helper.
- Block rendering is defensive: `blocks` / `bullets` / `pros` / `cons` are all treated as
  optional; empty pros/cons render a muted "None". A simple height estimator keeps cards inside
  the 16:9 stage and stops laying out once the column reaches the bottom margin.

### Caller shape

Both callers map their own workshop object into the `meta` shape (the prep view holds the full
`Workshop` with snake_case fields; the present view holds `DeckWorkshop` with camelCase; the
`meta` object normalizes both). `slides` comes straight from `loadFacilitationDeck(...).slides`.

## 3. End-to-end feature recap (whole build)

The full flow now available in the app, layer by layer:

1. Set duration. New-workshop form + prep panel expose a "Workshop length" selector
   (`DURATION_OPTIONS` in `src/lib/workshop/types.ts`); persisted to `workshops.duration_minutes`
   (`updateWorkshopDuration`).
2. Generate brief with a classified, timeboxed agenda. `POST /api/workshops/brief` calls
   agent-core `generateBrief` (now takes `durationMinutes`), which classifies each agenda item
   (`sectionKind` overview|workstream|evaluation + `workstreamCode`), timeboxes to sum to the
   duration (`normalizeAgendaTimeboxes`), and appends a final `evaluation` item when 2+
   workstreams are in scope. The route persists agenda rows with `section_kind` /
   `workstream_code` plus `duration_minutes`.
3. Author each section. Prep view (`src/app/workshops/[id]/page.tsx`) renders agenda items as
   `SectionCard`s; selecting one opens `SectionEditor`. "Generate content" -> `POST
   /api/workshops/section` -> agent-core `generateSectionContent`:
   - overview -> standard talking points personalized to customer/topic;
   - workstream -> Focused Context + Key Decisions (options as pros/cons, factors, leading
     questions, a recommended decision), grounded via `kb_*` retrieval; thin grounding emits
     `kbGaps` callouts (the §7 seeding recipe, surfaced not executed);
   - evaluation -> cross-workstream synthesis reading every workstream recommended decision.
   Every generate/revise returns `clarifyingQuestions` (answer inline -> regenerate) and
   supports NL `feedback` revise. Content stored in `workshop_agenda_content` (migration 046).
4. Workshop Experience walkthrough. `/workshops/[id]/present`
   (`src/app/workshops/[id]/present/page.tsx`) loads the deck via `loadFacilitationDeck`
   (`src/lib/workshop/deck.ts`) and renders the normalized `WorkshopSlide[]` as full-screen
   16:9 HTML slides with prev/next + keyboard nav, an agenda rail, a speaker-notes toggle, and
   a live NL-revise bar (POSTs `/api/workshops/section` and reloads in place).
5. Download facilitation PPTX. `exportFacilitationPptx` (`src/lib/workshop/export.ts`) over the
   same `WorkshopSlide[]`, with download buttons in the prep view and the present view.

### Key files / routes / exports per layer

- DB: `supabase/046_workshop_facilitation.sql` — `workshops.duration_minutes`;
  `workshop_agenda_items.section_kind` / `workstream_code`; `workshop_agenda_content` table
  (`content` jsonb, `clarifying_questions`, `kb_gaps`, `status`, `version`; RLS mirrors 040).
- agent-core `@jlee-revtech/agent-core@0.6.0` (`workshop.ts`): types `SectionKind`,
  `OverviewSectionContent`, `KeyDecision`, `WorkstreamSectionContent`, `EvaluationSectionContent`,
  `SectionContent`, `ClarifyingQuestion`, `KbGap`, `SectionGenerationResult`,
  `WorkshopSlideBlock`, `WorkshopSlide`, `GenerateSectionInput`; functions
  `generateSectionContent`, `buildSlides`, `buildFacilitationDeck`, `normalizeAgendaTimeboxes`;
  extended `generateBrief` / `GenerateBriefInput` / `WorkshopAgendaItem`.
- API routes: `POST /api/workshops/brief` (duration + section classification wiring),
  `POST /api/workshops/section` (generate/revise, grounding, KB-gap injection).
- Data access (`src/lib/supabase/workshops.ts`): `listAgendaContent`, `getAgendaContent`,
  `upsertAgendaContent`, `updateWorkshopDuration`, `setAgendaSectionMeta`.
- UI components: `src/components/workshop/SectionCard.tsx`, `src/components/workshop/SectionEditor.tsx`;
  prep-view wiring in `src/app/workshops/[id]/page.tsx`; new-workshop duration in
  `src/app/workshops/page.tsx`.
- Present route: `src/app/workshops/[id]/present/page.tsx`.
- Deck loader: `src/lib/workshop/deck.ts` (`loadFacilitationDeck` -> `{ slides, slideSections,
  workshop, sections }`).
- Export: `src/lib/workshop/export.ts` (`exportFacilitationPptx`, alongside `exportRecapDocx` /
  `exportRecapPptx`).

## 4. Verification

- `npm run build` (Next 16, Turbopack): "Compiled successfully in 6.1s", "Finished TypeScript
  in 9.7s", no errors. `/workshops/[id]/present` and `/api/workshops/section` present in the
  route manifest. No `any`; `WorkshopSlide` / `WorkshopSlideBlock` imported from
  `@jlee-revtech/agent-core`.
- pptxgenjs 4.x API surface confirmed against `node_modules/pptxgenjs/types/index.d.ts`:
  `ShapeType.roundRect`, `addShape`, `rectRadius`, `addNotes(notes)`, `charSpacing`,
  `bullet.characterCode` (used `characterCode`, not the deprecated `code`).
- agent-core `0.6.0` published (Phase 2a) and installed in the app; migration 046 applied to
  `lmuwylgbabcdnfmtscom` (Phase 1). Not re-verified this phase.
- NOT exercised end-to-end by the agents: live LLM section generation and the browser UI were
  not run (no dev server, no live Anthropic key, no real workshop with authored content, no
  actual PPTX file opened). The PPTX layout math is heuristic; a first real deck should be eyeballed.
  Recommend Josh run a live smoke test: create a workshop -> set duration -> generate brief ->
  author a workstream section (and the evaluation) -> Enter Workshop Experience -> download the
  facilitation PPTX and open it in PowerPoint.

## 5. Follow-ups / Josh action items

- Confirm the diagram-app Vercel project has `ANTHROPIC_API_KEY`, `KNOWLEDGE_SUPABASE_URL` /
  `KNOWLEDGE_SUPABASE_SERVICE_KEY`, and `VOYAGE_API_KEY` set. Section generation + KB grounding
  need them. The brief and recap routes already use `ANTHROPIC_API_KEY`, so that one is likely
  present; the KB envs may need to be added if section grounding returns thin.
- KB seeding for thin workstream topics is manual, via the PLAN §7 recipe (add
  `cds-lineage-explorer/public/vibe-skills/<id>/SKILL.md`, register `<id>` in the three sync
  points, then `node scripts/import-vibe-skills.mjs`). The section editor surfaces the gap +
  steps as a callout; it does not execute embeddings.
- Optional realtime niceties: none required. The present route's live-revise reloads the whole
  deck on each update; a targeted per-section reload or a presence/cursor layer would be polish,
  not a gap.
- Known behavior (from Phase 3/4): regenerating the brief DELETEs + re-INSERTs agenda items,
  cascading `workshop_agenda_content`, so authored section content is wiped. Flag this to
  facilitators or add a confirm before offering brief regeneration mid-authoring.

## 6. Git

- Repo: `jlee-revtech/-Mach12-Diagram-Solution`, branch `master`.
- Staged ONLY: `src/lib/workshop/export.ts`, `src/app/workshops/[id]/present/page.tsx`,
  `src/app/workshops/[id]/page.tsx`, `package.json`, `src/lib/version.ts`,
  `docs/workshop-facilitation/handoff-phase4.md`, `docs/workshop-facilitation/handoff-phase5.md`.
- Parallel WIP (`scripts/import-vibe-skills.mjs`, `src/lib/workstream/catalog.ts`) NOT staged.
- Commit: HEAD of `master` (`feat(workshops): facilitation deck PPTX export + download buttons
  [phase 5]`), 7 files changed. The exact SHA is recorded in the agent's final report (recording
  it inside this committed file would change its own hash).
- Push: SUCCEEDED.
