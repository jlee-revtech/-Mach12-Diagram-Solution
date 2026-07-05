# Hand-off - Diagrams Phase C (prompt entries + guidance wiring, migration 047) - FINAL

Phase C (final) of the "Facilitation Content: Diagrams + Prompt-Entry" enhancement.
Reads: `PLAN-diagrams-and-prompt.md` (spec: "Phase C", "Guidance param", "Regenerate
content semantics"), `handoff-diagrams-A.md` (agent-core `guidance?` param),
`PLAN.md` (§4 DB/RLS, §5 routes, §7 recipes, §9 hand-off), `handoff-phase1.md` +
`handoff-phase2b.md` (DB columns + section/brief route shapes).

- App repo: `jlee-revtech/-Mach12-Diagram-Solution` (source at `mach12ai/diagram-app/`).
- DB: `lmuwylgbabcdnfmtscom`. agent-core consumed: `@jlee-revtech/agent-core@0.6.2`.
- App version **0.3.129 -> 0.3.130**.

This phase is app-only: DB migration + types + routes threading guidance + prompt UI
at both levels. agent-core untouched (it already carries `guidance?` from Phase A).

## 1. What I built

- `supabase/047_workshop_facilitation_prompt.sql` (NEW) -
  `ALTER TABLE workshops ADD COLUMN IF NOT EXISTS facilitation_prompt text;`
  Applied to `lmuwylgbabcdnfmtscom` (verified, see §3).
- `src/lib/workshop/types.ts` (CHANGED) - added `facilitation_prompt?: string | null`
  to the `Workshop` type.
- `src/lib/supabase/workshops.ts` (CHANGED) - added `facilitation_prompt: string | null`
  to `updateWorkshop`'s `updates` union (no dedicated helper needed; `updateWorkshop`
  is used from the page).
- `src/app/api/workshops/section/route.ts` (CHANGED) - the workshop select now loads
  `facilitation_prompt`; it is trimmed to `guidance` and passed to
  `generateSectionContent`. Kept the per-section `feedback` param separate; BOTH flow
  through when present.
- `src/app/api/workshops/brief/route.ts` (CHANGED) - accepts optional `guidance` in the
  body; when a `workshopId` is supplied and no body `guidance`, reads
  `workshops.facilitation_prompt` and passes it to `generateBrief`.
- `src/app/workshops/[id]/page.tsx` (CHANGED) - prep view now has:
  - a persisted **guidance textarea** ("Guidance for all content") bound to
    `ws.facilitation_prompt`, saved via `updateWorkshop(ws.id, { facilitation_prompt })`
    on blur and on an explicit "Save guidance" button;
  - a **"Regenerate content"** button that saves the prompt first, then calls the section
    route for every agenda item that currently has a content row, at concurrency 2, with
    live "Regenerating N/M..." progress, then `reloadContent()`; gated on
    `hasAnyContent`. Existing "Regenerate brief" unchanged (picks up guidance server-side).
- `src/components/workshop/SectionEditor.tsx` (CHANGED) - the prompt box is now always
  available (before content exists too), labelled "Prompt: generate or enrich this
  section, optional". `generate()` sends the box text as `feedback` when present, so the
  FIRST generation honors it; after content exists the same box drives enrich/revise.
  The box is cleared on a successful generate/revise. Clarifying-questions + KB-gap
  behavior untouched. Removed the old separate `updateWithFeedback` path (folded into
  `generate`).
- `package.json` + `src/lib/version.ts` (CHANGED) - `0.3.129 -> 0.3.130`.
- `docs/workshop-facilitation/handoff-diagrams-C.md` (this file).

## 2. New DB column + how guidance is threaded

### DB (migration 047, applied to `lmuwylgbabcdnfmtscom`)
```sql
-- workshops
facilitation_prompt text   -- nullable; workshop-level guidance steer
```

### Guidance threading (server-side; NO client body change for the steer)
- **Section route** (`POST /api/workshops/section`): loads
  `workshops.facilitation_prompt`, trims it, passes it as `guidance` to
  `generateSectionContent`. The per-section `feedback` (the SectionEditor prompt box) is
  a SEPARATE param; both are threaded when present. So each section generate honors the
  global steer, and the section box adds a per-section instruction on top.
- **Brief route** (`POST /api/workshops/brief`): body gains optional `guidance?: string`.
  When `workshopId` is present and body `guidance` is absent, the route reads
  `workshops.facilitation_prompt` (org-scoped) and passes it as `guidance` to
  `generateBrief`. The page's existing "Regenerate brief" call passes `workshopId`, so it
  honors the saved guidance with NO client change.

Because the routes read the column, the client never has to send the steer in the section
POST body. "Regenerate content" only needs to save the prompt first, then fire plain
`{ workshopId, orgId, agendaItemId }` calls.

## 3. Regenerate-content behavior + section-prompt change

- **Regenerate content** (workshop level): `regenerateContent()` collects every
  `content` row with non-null `content` (`agenda_item_id`s), saves the current
  `facilitation_prompt` via `updateWorkshop`, then drains a queue with 2 concurrent
  workers, each POSTing `{ workshopId, orgId, agendaItemId }` to the section route (which
  reads guidance server-side). Progress is shown as "Regenerating done/total...". One
  section failing does not abort the batch. On completion it calls `reloadContent()`.
  Gated on `hasAnyContent` (at least one section with content). The agenda is untouched
  (this does NOT re-run the brief).
- **Section prompt** (`SectionEditor`): the prompt box renders in BOTH states (empty and
  populated). `generate()` submits the box as `feedback` when non-empty, so the first
  generation is steered; after content exists the same box enriches/revises (same route,
  same param). The box clears after a successful call. The header "Generate content" /
  "Regenerate" button and the box's own button both call `generate()`. Note the parent
  passes `key={selectedItem.id}` so the box state resets per section; not fought.

## 4. Verification

- **Migration applied**: `node scripts/apply-migration.mjs
  supabase/047_workshop_facilitation_prompt.sql` -> `Applied ... to lmuwylgbabcdnfmtscom.
  Response: []`. Verified with an `information_schema.columns` query via the same script:
  `[{"column_name":"facilitation_prompt","data_type":"text"}]`. Token read from Windows
  Credential Manager as UTF-8 (PLAN §7 CredMan recipe), len 44.
- **Build clean**: `npm run build` (Next 16, Turbopack) -> "Compiled successfully",
  "Finished TypeScript" (9.0s), all pages built, no TypeScript errors. Only the
  pre-existing workspace-root lockfile warning (documented in prior hand-offs). No `any`
  introduced.
- **Live LLM / browser NOT exercised.** No real POST to `/api/workshops/section` or
  `/api/workshops/brief` was issued (would need a live Anthropic key + a real workshop /
  agenda rows). The guidance threading and Regenerate-content flow are typechecked and
  compiled, not smoke-tested end to end. Recommend a live smoke (see §6).

## 5. Whole-enhancement recap ("Diagrams + Prompt-Entry")

The three phases delivered, end to end:

1. **Diagrams in content (A + B).** agent-core (`@jlee-revtech/agent-core@0.6.2`) emits a
   typed `WorkshopDiagram` (flow / matrix / quadrant / layers) on the three content types,
   on `KeyDecision`, and on `WorkshopSlide`. The app has ONE pure
   `renderWorkshopDiagramSvg(d)` (`src/lib/workshop/diagram*`); the section EDITOR renders
   it (`DiagramCard` in `SectionEditor`), the WALKTHROUGH (`/workshops/[id]/present`)
   renders it on `slide.diagram`, and the PPTX exporter rasterizes the SAME SVG to PNG.
   One representation, three surfaces.
2. **Prompt entry at both levels (C).** Per-section prompt box (steers first generate +
   drives enrich/revise) AND a persisted workshop-level guidance prompt
   (`workshops.facilitation_prompt`) threaded as `guidance` into the brief and every
   section, with a "Regenerate content" button that re-runs all sections that have content
   honoring it, keeping the agenda intact. "Regenerate brief" honors the same steer.

## 6. Josh action items

- **Migration 047 already applied** to `lmuwylgbabcdnfmtscom` (verified). No further DB
  action needed. On any other environment (e.g. a fresh Supabase), run
  `node scripts/apply-migration.mjs supabase/047_workshop_facilitation_prompt.sql`.
- **Recommended live smoke test** (not run here): open a workshop with a brief, set a
  short guidance prompt (e.g. "Keep talking points executive-level"), generate a couple of
  sections, then press "Regenerate content" and confirm the sections shift toward the
  steer; also press "Regenerate brief" and confirm the agenda respects it; and in a
  section, type a prompt BEFORE any content and confirm the first generate honors it.
- **No env changes.** The section + brief routes already had `ANTHROPIC_API_KEY` and the
  knowledge env; guidance is a DB column, no new secret.

## 7. Git

- Repo: `jlee-revtech/-Mach12-Diagram-Solution`, branch `master`.
- Staged ONLY: `supabase/047_workshop_facilitation_prompt.sql`,
  `src/lib/workshop/types.ts`, `src/lib/supabase/workshops.ts`,
  `src/app/api/workshops/section/route.ts`, `src/app/api/workshops/brief/route.ts`,
  `src/app/workshops/[id]/page.tsx`, `src/components/workshop/SectionEditor.tsx`,
  `package.json`, `src/lib/version.ts`,
  `docs/workshop-facilitation/handoff-diagrams-C.md`.
  Parallel WIP (`scripts/import-vibe-skills.mjs`, `src/lib/workstream/catalog.ts`) NOT
  staged (PLAN §7: never `git add -A`).
- Commit: `1fd91b6`
  `feat(workshops): section + workshop-level content prompts, guidance wiring, Regenerate content [diagrams C]`.
- Push: SUCCEEDED (`master -> master`).
