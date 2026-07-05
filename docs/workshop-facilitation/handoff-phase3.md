# Hand-off — Phase 3 (Section-authoring UI + duration selector)

Phase 3 of the Workshop Facilitation Content build. Reads: `PLAN.md` §6 (Phase 3), §3
(type shapes), §7 (recipes), §9 (hand-off); `handoff-phase1.md` (DB + data access);
`handoff-phase2a.md` (agent-core types); `handoff-phase2b.md` (section + brief routes).
App: `mach12ai/diagram-app`. DB: `lmuwylgbabcdnfmtscom`. Repo: `jlee-revtech/-Mach12-Diagram-Solution`.
agent-core consumed: `@jlee-revtech/agent-core@0.6.0`.

## 1. What I built

- `src/components/workshop/sectionMeta.ts` (NEW) — metadata maps in the `CAPTURE_META`
  style: `SECTION_META` (section-kind label/color/icon), `CONTENT_STATUS_META`
  (empty|generating|draft|needs_input|final pill), `CONFIDENCE_META` (low|medium|high
  badge), and `sectionMetaFor(kind)` (falls back to overview styling for null kinds).
- `src/components/workshop/SectionCard.tsx` (NEW) — selectable prep-view card per agenda
  item: index, section-kind badge, workstream chip, timebox, content-status pill, title +
  objective. Clicking calls `onSelect`.
- `src/components/workshop/SectionEditor.tsx` (NEW) — the editor panel for the selected
  card. Generate/Regenerate (POST `/api/workshops/section`), per-kind content render,
  clarifying questions with inline answers + "Regenerate with answers", KB-gap callouts
  with collapsible seeding steps + "Copy seeding steps", NL-feedback box + "Update section".
  Uses Framer Motion (`AnimatePresence`/`motion`) for the clarifying-questions and
  seeding-steps panels. Seeds its local view from the loaded content row so already-
  generated sections render without re-generating.
- `src/app/workshops/page.tsx` (CHANGED) — added the "Workshop length" `<select>`
  (`DURATION_OPTIONS`, default 120) to the new-workshop form; carries `duration_minutes`
  into `createWorkshop`.
- `src/app/workshops/[id]/page.tsx` (CHANGED) — the Room prep view. Now a two-column
  layout (section cards left, editor right). Brief generation switched to the server-side
  persistence flow (see §3). Added content-row loading, duration control + persistence,
  and the prep-level evaluation action.
- `src/lib/workshop/types.ts` (CHANGED) — added `DURATION_OPTIONS` + `DEFAULT_DURATION_MINUTES`;
  added `duration_minutes: number | null` to the `Workshop` interface.
- `src/lib/supabase/workshops.ts` (CHANGED) — extended `createWorkshop`'s `data` param with
  optional `duration_minutes`. (Existing `listAgendaContent` / `updateWorkshopDuration` from
  Phase 1 are consumed as-is.)
- `package.json` + `src/lib/version.ts` (CHANGED) — app version `0.3.122` -> `0.3.123`.
- `docs/workshop-facilitation/handoff-phase3.md` (this file).

No agent-core, API-route, or DB-schema changes (per constraints). No embedding/import run.

## 2. Component API (props the next phases can reuse)

```ts
// src/components/workshop/SectionCard.tsx (default export)
function SectionCard(props: {
  item: WorkshopAgendaItem
  index: number
  content?: AgendaContentRow | null   // loaded row; drives the status pill
  workstream?: Workstream | null      // for the chip color/name
  selected: boolean
  onSelect: () => void
}): JSX.Element

// src/components/workshop/SectionEditor.tsx (default export)
function SectionEditor(props: {
  workshopId: string
  orgId: string
  item: WorkshopAgendaItem
  workstream?: Workstream | null
  content?: AgendaContentRow | null   // seeds the initial rendered content
  onSaved: (result: SectionGenerationResult & { version?: number; status?: string }) => void
}): JSX.Element
// onSaved fires after every generate/revise; the Room passes `reloadContent`.

// src/components/workshop/sectionMeta.ts
export const SECTION_META: Record<SectionKind, { label; color; icon }>
export const CONTENT_STATUS_META: Record<AgendaContentStatus, { label; color }>
export const CONFIDENCE_META: Record<'low'|'medium'|'high', { label; color }>
export function sectionMetaFor(kind: SectionKind | null | undefined): { label; color; icon }
```

## 3. How the brief-route integration changed (important for consistency)

The old prep flow called `/api/workshops/brief` WITHOUT `workshopId`, then persisted the
agenda client-side via `replaceAgenda` + `updateWorkshop` (which dropped `section_kind` /
`workstream_code`). Per `handoff-phase2b.md`, that is now wrong.

New flow in `generateBrief` (`src/app/workshops/[id]/page.tsx`):
```ts
POST /api/workshops/brief
body: { workshopId, orgId, topic, objective, customerName, workstreamCodes, focusAreas, durationMinutes }
```
The route persists the agenda server-side (with `section_kind` + `workstream_code`), stores
`duration_minutes` + `brief`, sets status `scheduled`, and appends the evaluation item.
The client NO LONGER calls `replaceAgenda`/`updateWorkshop` for the agenda. After the call
it runs `setParticipants` (roster for the live room, which the route does not manage) then
`load()` to re-read the persisted agenda + content rows from the DB, so normalized timeboxes
and section metadata show.

## 4. How content is loaded + rendered per kind

- **Loaded once per workshop** in the Room's `load()` via `listAgendaContent(id)` into
  `content: AgendaContentRow[]`. A `Map<agenda_item_id, AgendaContentRow>` (`contentByItem`)
  keys cards + the editor. After a section generate/revise, only `reloadContent()` runs
  (`listAgendaContent` again) so the card pills + evaluation gating update without a full reload.
- **SectionEditor** seeds its local view from `content.content`; on generate/revise it POSTs
  `/api/workshops/section` and re-renders the returned `SectionGenerationResult`.
- **Render by `content.kind`** (the discriminator):
  - `overview` -> headline + talking points (bulleted) + facilitator notes.
  - `workstream` -> Focused Context paragraph, then each `KeyDecision`: title, context,
    `options[]` as pros/cons columns, `factors[]` list, `leadingQuestions[]` list, and a
    highlighted Recommended decision (recommendation + rationale + confidence badge).
  - `evaluation` -> `divergences[]` (topic, each position as workstreamCode + stance, the
    tension), then a highlighted overall recommendation with pros/cons columns, tradeoffs,
    rationale.
- **Clarifying questions** (`clarifyingQuestions[]`): shown with an input per question; the
  "Regenerate with answers" button re-calls the route with `clarificationAnswers`.
- **KB gaps** (`kbGaps[]`): a callout "Knowledge base needs seeding: <topic>[ for <workstream>]"
  with collapsible seeding steps (PLAN §7 recipe, rendered client-side) + "Copy seeding steps".
  It NEVER runs embeddings/imports.
- **Evaluation action** (`runSection` in the Room): a prep-level button on the left column,
  enabled once `hasWorkstreamContent` (any workstream section has a non-null content row).
  It POSTs `/api/workshops/section` for the evaluation agenda item, selects it, and reloads
  content. Copy states it synthesizes across the workstream recommendations.

## 5. Verification

- `npm run build` (Next 16.2.1, Turbopack) -> "Compiled successfully in 6.9s",
  "Finished TypeScript in 9.5s", 27/27 static pages, no errors. `/workshops`,
  `/workshops/[id]`, and `/api/workshops/section` all in the route manifest. No `any` used;
  all types imported from `@jlee-revtech/agent-core` and `src/lib/supabase/workshops.ts`.
- **UI NOT exercised in a browser.** No dev server was run and no live section/brief POST was
  issued (would need a live Anthropic key + a real workshop). The wiring is typechecked and
  compiled only. A first-run smoke (create workshop -> generate brief -> generate a workstream
  section -> answer a clarifying question -> generate evaluation) should be done once.
- IDE lint surfaced only pre-existing hints/warnings (inline `style=`, missing `type` on
  `<button>`) that match the existing file convention; not build errors.

## 6. Gotchas / open items for Phase 4/5

- **Content-row loader location for the deck.** Phase 4 (present) and Phase 5 (pptx) both
  assemble the deck via `buildFacilitationDeck(agent-core)`. The content rows are loaded in
  `src/app/workshops/[id]/page.tsx` `load()` via `listAgendaContent(id)` -> `content:
  AgendaContentRow[]`, keyed by `contentByItem` (`Map<agenda_item_id, AgendaContentRow>`).
  To build the deck, map agenda items (in `sort_order`) to
  `{ agendaTitle: item.title, timeboxMinutes: item.timebox_minutes, content: row.content }`
  for rows where `content` is non-null, and pass to `buildFacilitationDeck`. RECOMMENDATION:
  factor a shared `src/lib/workshop/deck.ts` loader (e.g. `loadDeck(workshopId): Promise<WorkshopSlide[]>`
  that calls `listAgenda` + `listAgendaContent` + `buildFacilitationDeck`) so present + pptx
  and this prep view can all reuse it. Phase 3 did not create it (nothing needed it yet).
- **Brief regenerate wipes section content.** The brief route DELETEs + re-INSERTs agenda
  items on each call; `workshop_agenda_content` cascades on `agenda_item_id`, so regenerating
  the brief discards existing section content. The "Regenerate brief" button is intentionally
  low-emphasis. If Phase 4 adds present-mode brief regen, warn the facilitator.
- **Duration persistence.** New-workshop form writes `duration_minutes` at create. In the
  Room prep, changing the length select calls `updateWorkshopDuration` immediately, and the
  next brief generate passes the current `durationMinutes`. The normalized timeboxes only
  change after a (re)generate, not on the duration change alone.
- **Evaluation gating** uses "any workstream section has non-null content", matching the
  Phase 2b note that the evaluation reads persisted workstream rows. If zero workstreams are
  in scope, `generateBrief` does not append an evaluation item and the action is absent.
- **Parallel WIP untouched:** `scripts/import-vibe-skills.mjs` and `src/lib/workstream/catalog.ts`
  remain modified/uncommitted from another session. NOT staged (PLAN §7: never `git add -A`).
- **Next.js workspace-root warning** (multiple lockfiles above the app) is pre-existing and
  unrelated; build still succeeds.
- **No em dashes** in any prose/UI copy I authored (Josh's rule).

## 7. Git

- Repo: `jlee-revtech/-Mach12-Diagram-Solution`, branch `master`.
- Staged ONLY: `src/components/workshop/sectionMeta.ts`, `src/components/workshop/SectionCard.tsx`,
  `src/components/workshop/SectionEditor.tsx`, `src/app/workshops/[id]/page.tsx`,
  `src/app/workshops/page.tsx`, `src/lib/workshop/types.ts`, `src/lib/supabase/workshops.ts`,
  `package.json`, `src/lib/version.ts`, `docs/workshop-facilitation/handoff-phase3.md`.
- Parallel WIP (`scripts/import-vibe-skills.mjs`, `src/lib/workstream/catalog.ts`) NOT staged.
- Commit: `414a5b7` (`feat(workshops): section authoring UI + duration selector [phase 3]`).
  10 files changed, 884 insertions(+), 36 deletions(-).
- Push: SUCCEEDED (`4da5f19..414a5b7 master -> master`). Branch was already up to date
  (no rebase needed). The two parallel-WIP files were stashed for the push and popped back
  afterward; they remain uncommitted, untouched.
