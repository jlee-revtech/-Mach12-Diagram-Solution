# Hand-off - Content Reframe Phase D2 (final): app renderer to the reframed shape

Final phase of the "Facilitation Content Reframe" (Addendum 3). Reads:
`PLAN-content-reframe.md` (target = "Phase D2"), `handoff-reframe-D1.md` (the exact new
types), and `PLAN.md` (§7 version bump + git discipline, §9 hand-off protocol).

D1 restructured `@jlee-revtech/agent-core` (published 0.6.3, app consumes ^0.6.3) so section
content now comes back as labeled bulleted sub-sections with a required per-decision visual,
and left the app build intentionally RED because the renderer still referenced the old
`focusedContext` shape. D2 updates the app renderer to the new shape and gets the build GREEN.

App: `jlee-revtech/-Mach12-Diagram-Solution`, app version bumped **0.3.131 -> 0.3.132**,
agent-core **0.6.3**.

## 1. Files changed

- `src/components/workshop/SectionEditor.tsx` - the section content renderer, rewired to the
  new shape (details below).
- `src/app/api/workshops/section/route.ts` - one call site fixed for the reshape (details below).
- `package.json` + `src/lib/version.ts` - version 0.3.131 -> 0.3.132.
- `docs/workshop-facilitation/handoff-reframe-D2.md` - this hand-off.

`src/lib/workshop/export.ts` and `src/app/workshops/[id]/present/page.tsx` were NOT changed:
they render `WorkshopSlide[]` from `buildSlides` / `buildFacilitationDeck` (agent-core, updated
in D1). They never read `content.focusedContext` or `KeyDecision.options/factors`, so they
typecheck and render against the new slide content unchanged. `src/lib/workshop/deck.ts` also
unchanged (it only calls `buildSlides` / `buildFacilitationDeck`).

## 2. How the workstream section now renders (SectionEditor.tsx)

`WorkstreamBody` replaced the old single `focusedContext` paragraph with four labeled
sub-sections, all short bullets, reusing the existing `Block` / `Bullets` / `ProsCons` helpers
and the same brand tokens:

1. **Overall considerations** (`c.overallConsiderations`) - blue bullets.
2. **Current state** (`c.currentState`) - cyan bullets.
3. **Options for future state** (`c.futureStateOptions`) - one card per option: `label`,
   optional `summary` line, then a `ProsCons` block (pros/cons).
4. **Key decisions** (`c.keyDecisions.map(DecisionCard)`) under a "Key decisions" label.
Then the section-level visual via `<SectionDiagrams diagrams={c.diagrams} />` (unchanged helper).
The first three collapse into a single card; sub-sections with no content are omitted.

`DecisionCard` now renders:
- `d.context` as **Context** bullets (was a paragraph).
- `d.leadingQuestions` bullets (kept), marker "?".
- The highlighted **Recommended decision** block: `recommendation` line + `rationale` as
  **Rationale** bullets (was a paragraph) + the confidence badge (kept).
- The now-REQUIRED `d.diagram` via `DiagramCard`, directly under the recommendation with a
  "Decision visual" label so it clearly belongs to that decision.
- `d.options` and `d.factors` references are GONE (options moved to the section level).

`EvaluationBody` renders `c.rationale` as **Rationale** bullets (now `string[]`, was a
paragraph). Divergences, overall recommendation, pros/cons, tradeoffs, and `SectionDiagrams`
are all kept.

`OverviewBody` is unchanged (its shape did not change).

## 3. Defensive handling of old persisted rows

A previously generated section can still carry the OLD shape in the DB (a `focusedContext`
string, `context` / `rationale` as strings, missing `overallConsiderations` / `currentState`,
`options` / `factors`, etc.). The renderer never crashes on those:

- New helper `asBullets(v): string[]` = `Array.isArray(v) ? v : v ? [String(v)] : []`. It
  coerces a maybe-string-that-should-be-an-array into bullets: an array passes through, a lone
  string becomes a one-item list, null/undefined becomes an empty list. Used for decision
  `context`, decision `rationale`, `overallConsiderations`, `currentState`, and evaluation
  `rationale`.
- Every array access is guarded with `(x || [])`: `futureStateOptions`, `keyDecisions`,
  `leadingQuestions`, `divergences`, `dv.positions`, evaluation `pros` / `cons`, and each
  option's `pros` / `cons`. `recommendedDecision` is defaulted so a missing block does not throw.
- Old rows therefore render whatever is present (e.g. a former `focusedContext` blob simply
  does not appear, since that field is no longer read). Josh regenerates for the full new
  structure and the required per-decision visuals.

## 4. Route fix (reshape type error)

`src/app/api/workshops/section/route.ts` builds `workstreamDecisions` for the evaluation
generate call. `d.recommendedDecision.rationale` is now `string[]`, but
`GenerateSectionInput.workstreamDecisions[].decisions[].rationale?` is still `string` (D1 did
not change that input contract). The one call site now joins the bullets
(`Array.isArray(r) ? r.join('; ') : (r || undefined)`) and is defensive against old rows that
persisted a plain string. This was the only reshape type error outside SectionEditor.tsx; no
behavior change to the route otherwise.

## 5. Verification

- Grepped `src` for `focusedContext`, `.factors`, `.options`, and string uses of decision
  `context` / `rationale`: the only remaining hits are the intended new usages in
  SectionEditor.tsx (`asBullets(d.context)` etc.) and the fixed route line. `focusedContext`,
  `d.options`, and `d.factors` are fully gone.
- `npm run build` (Next.js 16.2.1 / Turbopack): **PASS, clean**. "Compiled successfully",
  "Finished TypeScript" with zero errors, all 27 routes generated (incl. `/workshops/[id]`
  and `/workshops/[id]/present`).
- No `any` was introduced; the real agent-core types are imported.
- NOTE: verified by type-check + build only. NOT visually inspected in a browser this phase.

## 6. Josh action item

REGENERATE existing workshop sections (use the per-section "Regenerate content" /
"Regenerate" button in the prep view, or the live "Update this section" bar in the Workshop
Experience) so old-shape rows in `workshop_agenda_content` are replaced with the new
labeled/bulleted structure (Overall considerations, Current state, Options for future state,
Key decisions) and the required per-decision visuals. Until a section is regenerated it renders
only whatever the old row still holds (no crash), so it will look sparse.

## 7. Git

- Repo: `jlee-revtech/-Mach12-Diagram-Solution`, branch `master`.
- Staged (only these): `src/components/workshop/SectionEditor.tsx`,
  `src/app/api/workshops/section/route.ts`, `package.json`, `src/lib/version.ts`,
  `docs/workshop-facilitation/handoff-reframe-D2.md`. Parallel-session WIP
  (`scripts/import-vibe-skills.mjs`, `src/lib/workstream/catalog.ts`) NOT staged.
- Commit: `<HASH>` `fix(workshops): render reframed labeled/bulleted section content + per-decision visual [reframe D2]`.
- Push: `<STATUS>`.
