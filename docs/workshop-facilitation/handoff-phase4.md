# Hand-off — Phase 4 (Workshop Experience present route + shared deck loader)

Phase 4 of the Workshop Facilitation Content build. Reads: `PLAN.md` §6 (Phase 4), §3
(slide model), §7 (recipes), §9 (hand-off); `handoff-phase2a.md` (agent-core
`buildFacilitationDeck` / `buildSlides` / `WorkshopSlide` / `SectionContent`);
`handoff-phase2b.md` (`/api/workshops/section` shape); `handoff-phase3.md` (content
loading: `listAgendaContent` -> `contentByItem` by `agenda_item_id`; agenda in `sort_order`).
App: `mach12ai/diagram-app`. DB: `lmuwylgbabcdnfmtscom`. Repo: `jlee-revtech/-Mach12-Diagram-Solution`.
agent-core consumed: `@jlee-revtech/agent-core@0.6.0`.

## 1. What I built

- `src/lib/workshop/deck.ts` (NEW) — the shared deck loader `loadFacilitationDeck`. Loads
  the workshop + agenda (`sort_order`) + content rows (`listAgendaContent`), builds `sections`
  from agenda items that have a non-null content row, derives `slides` via
  `buildFacilitationDeck`, and computes a parallel `slideSections` array (agenda_item_id per
  slide index, null for the two leading slides). Phase 5 REUSES this for the PPTX.
- `src/app/workshops/[id]/present/page.tsx` (NEW) — the full-screen "Workshop Experience"
  client route. Loads the deck, renders the current `WorkshopSlide` on a 16:9 stage
  (brand-styled, dark presentation background), prev/next + keyboard nav (Arrow keys, Escape
  to exit, N toggles notes), a slide counter, an agenda progress rail, a speaker-notes toggle,
  and the live NL-revise bar.
- `src/app/workshops/[id]/page.tsx` (CHANGED) — added an "▶ Enter Workshop Experience" button
  in the prep-view Sections header. Enabled once any section has authored content
  (`hasAnyContent = content.some(c => !!c.content)`); navigates to `/workshops/[id]/present`.
  Existing prep / live / recap UI untouched.
- `package.json` + `src/lib/version.ts` (CHANGED) — app version `0.3.123` -> `0.3.124`.
- `docs/workshop-facilitation/handoff-phase4.md` (this file).

No agent-core, API-route, or DB-schema changes (per constraints). No embedding/import run.

## 2. Public surface Phase 5 depends on

### `src/lib/workshop/deck.ts`

```ts
export interface DeckWorkshop {
  id: string
  title: string
  customerName: string | null
  topic: string | null
  durationMinutes: number | null
}
export interface DeckSection {
  agendaItemId: string
  agendaTitle: string
  timeboxMinutes?: number
  content: SectionContent        // from @jlee-revtech/agent-core
}
export interface LoadedDeck {
  slides: WorkshopSlide[]        // from @jlee-revtech/agent-core
  slideSections: (string | null)[]   // parallel to slides; agenda_item_id or null
  workshop: DeckWorkshop
  sections: DeckSection[]
}
export type DeckClient = unknown

export function loadFacilitationDeck(
  client: DeckClient,             // pass-through placeholder (see note below)
  workshopId: string,
): Promise<LoadedDeck>
```

**`slideSections` invariant.** `buildFacilitationDeck` returns
`[titleSlide, agendaSlide, ...sections.flatMap(s => buildSlides(s.content, {title, timeboxMinutes}))]`.
So `slideSections = [null, null, ...]` then, per section in agenda order, the section's
`agendaItemId` pushed `buildSlides(section.content, {title, timeboxMinutes}).length` times.
It is recomputed with the SAME `buildSlides` opts `buildFacilitationDeck` uses internally, so
the present view's per-slide section mapping is exact and the PPTX (which iterates `slides`)
stays in lockstep.

**`client` argument.** Currently a pass-through placeholder (`DeckClient = unknown`; the
present route passes `null`). The data-access helpers (`getWorkshop` / `listAgenda` /
`listAgendaContent` in `src/lib/supabase/workshops.ts`) read the user JWT from `localStorage`
themselves under RLS, so no client is threaded through today. The parameter is kept in the
signature (per PLAN §6) so Phase 5 and any future server-side variant can supply a real
Supabase client without a signature change. Phase 5 can call
`loadFacilitationDeck(null, workshopId)` and use `.slides` / `.workshop`.

### Present route
- Path: `/workshops/[id]/present` (`src/app/workshops/[id]/present/page.tsx`), a client
  component that renders its own full-screen surface (fixed inset, dark background, outside the
  normal shell chrome).
- On mount it calls `loadFacilitationDeck(null, id)`. Empty state (deck loads but 0 slides,
  i.e. no content authored) shows a message + "Back to prep" button.

## 3. How present + revise work

- **Slide model rendering.** `SlideStage` switches on `slide.kind`:
  - `title` -> big heading + subheading + gradient rule.
  - `agenda` -> numbered `bullets`.
  - `bullets` -> heading + bullet list (subheading rendered as the kicker).
  - `context` -> heading + body paragraph (joined from `blocks[].body`).
  - `decision` / `evaluation` -> `BlocksSlide`: a heading + a 2-col grid of `WorkshopSlideBlock`s.
    Body-only blocks and the "Recommendation" block span both columns (recommendation is blue-
    highlighted); pros/cons blocks render as green/red columns; bullet blocks render as a list.
    This mirrors the SectionEditor block shapes from Phase 3.
  - Type sizes use `vw` units so text scales with the 16:9 stage.
- **Navigation.** Prev/Next buttons; keyboard ArrowLeft/ArrowRight to move, Escape to exit back
  to `/workshops/[id]`, N to toggle notes. A "{n} / {total}" counter in the top bar. The left
  agenda rail lists `deck.sections`; the section owning the current slide (via
  `deck.slideSections[current]`) is highlighted, and clicking a section jumps to its first slide.
- **Speaker notes.** A "Notes" button (disabled when the slide has no `facilitatorNotes`) toggles
  a panel that shows `slide.facilitatorNotes`.
- **Live NL-revise bar (req 9).** A text input + "Update this section" button, ENABLED only when
  `slideSections[current]` is non-null (i.e. a section slide, not the title/agenda slide). It
  POSTs `/api/workshops/section` with `{ workshopId, orgId, agendaItemId: slideSections[current],
  feedback }`. On success it reloads the deck via `loadFacilitationDeck` and repositions the
  viewer to the first slide of that same section (`slideSections.findIndex(...)`). If the response
  carries `clarifyingQuestions` (req 10), they render inline with an answer input each and a
  "Regenerate with answers" button that resubmits with `clarificationAnswers` (consistent with
  Phase 3's SectionEditor). Enter in the input triggers the same revise.

## 4. Verification

- `npm run build` (Next 16.2.1, Turbopack): "Compiled successfully in 6.1s", "Finished
  TypeScript in 9.9s", 27/27 static pages, no errors. `/workshops/[id]/present` appears in the
  route manifest as a dynamic (`ƒ`) route alongside `/workshops/[id]` and
  `/api/workshops/section`. No `any`; all types imported from `@jlee-revtech/agent-core` and
  the app's own modules.
- **UI NOT exercised in a browser.** No dev server was run and no live deck load / section
  revise POST was issued (would need a live Anthropic key + a real workshop with authored
  section content). The wiring is typechecked and compiled only. A first-run smoke (create
  workshop -> generate brief -> generate a section -> Enter Workshop Experience -> navigate ->
  revise a section from the bar) should be done once.

## 5. Gotchas / open items for Phase 5

- **Reuse the loader.** Phase 5 should call `loadFacilitationDeck(null, workshopId).slides` for
  the PPTX and iterate `slides` one-per-slide, rendering `blocks` as pros/cons columns and
  `bullets` as bullet lists and putting `facilitatorNotes` into speaker notes (`slide.addNotes`).
  The same `slides` array drives this present route, so they will not drift.
- **Add PPTX download buttons in BOTH places.** PLAN §6 Phase 5: a "Download facilitation deck
  (PPTX)" button in the prep view (`src/app/workshops/[id]/page.tsx`, near the "Enter Workshop
  Experience" button in the Sections header is a good spot) AND in the present view (the top bar
  next to "Notes" is a good spot). The present route already has the loaded `deck` in state, so
  it can pass `deck.slides` straight to `exportFacilitationPptx`.
- **`exportFacilitationPptx` signature (suggested).** Mirror `exportRecapPptx(ws, recap)` in
  `src/lib/workshop/export.ts`: `exportFacilitationPptx(ws: Workshop | DeckWorkshop, slides:
  WorkshopSlide[])`. Note the present route holds a `DeckWorkshop` (id/title/customerName/topic/
  durationMinutes), not the full `Workshop`; the prep view holds the full `Workshop`. Design the
  signature to accept both (or take just `{ title, customerName }`).
- **Brief regenerate wipes section content** (from Phase 3): the brief route DELETEs + re-INSERTs
  agenda items, cascading `workshop_agenda_content`. The present route reads whatever content
  currently exists; if a facilitator regenerates the brief mid-session the deck empties.
- **Client argument is a placeholder** (see §2). If Phase 5 needs a server-side deck (e.g. a
  route), it must swap the data-access helpers for service-key/JWT-threaded variants; today they
  are browser-only (`localStorage` JWT).
- **Parallel WIP untouched:** `scripts/import-vibe-skills.mjs` and `src/lib/workstream/catalog.ts`
  remain modified/uncommitted from another session. NOT staged (PLAN §7: never `git add -A`).
- **Next.js workspace-root warning** (multiple lockfiles above the app) is pre-existing and
  unrelated; build still succeeds.
- **No em dashes** in any prose/UI copy I authored (Josh's rule).

## 6. Git

- Repo: `jlee-revtech/-Mach12-Diagram-Solution`, branch `master`.
- Staged ONLY: `src/lib/workshop/deck.ts`, `src/app/workshops/[id]/present/page.tsx`,
  `src/app/workshops/[id]/page.tsx`, `package.json`, `src/lib/version.ts`,
  `docs/workshop-facilitation/handoff-phase4.md`.
- Parallel WIP (`scripts/import-vibe-skills.mjs`, `src/lib/workstream/catalog.ts`) NOT staged.
- Commit: `95bb44e` (`feat(workshops): Workshop Experience walkthrough + shared deck loader [phase 4]`).
  6 files changed, 772 insertions(+), 3 deletions(-).
- Push: SUCCEEDED (`ee1f703..95bb44e master -> master`). Branch was already up to date (no
  rebase needed). The two parallel-WIP files were stashed for the push and popped back
  afterward; they remain uncommitted, untouched.
