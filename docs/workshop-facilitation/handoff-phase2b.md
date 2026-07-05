# Hand-off — Phase 2b (API routes: section generation + brief duration/section wiring)

Phase 2b of the Workshop Facilitation Content build. Reads: `PLAN.md` §5, §7, §8, §9;
`handoff-phase1.md` (DB + data access); `handoff-phase2a.md` (agent-core signatures).
App: `mach12ai/diagram-app`. DB: `lmuwylgbabcdnfmtscom`. Repo: `jlee-revtech/-Mach12-Diagram-Solution`.
agent-core consumed: `@jlee-revtech/agent-core@0.6.0`.

## 1. What I built

- `src/app/api/workshops/section/route.ts` (NEW) — `POST /api/workshops/section`. Generates or
  revises the facilitation content for one agenda section. Branches by `section_kind`, assembles
  grounding, calls `generateSectionContent`, injects an app-side KB gap when grounding is thin,
  persists the row (upsert on `agenda_item_id`, version bump), returns the result.
- `src/app/api/workshops/brief/route.ts` (CHANGED) — now accepts `durationMinutes` and an optional
  `workshopId`. Passes `durationMinutes` to `generateBrief`. When `workshopId` is supplied, persists
  the agenda items server-side carrying `section_kind` + `workstream_code`, stores `duration_minutes`
  and the `brief` on the workshop, and sets status `scheduled`. Without `workshopId` it stays
  read-only compute (backward compatible with the current client flow).
- `src/lib/supabase/workshops.ts` (CHANGED) — tightened `AgendaContentRow`: `content: SectionContent | null`,
  `clarifying_questions: ClarifyingQuestion[]`, `kb_gaps: KbGap[]` (imported from
  `@jlee-revtech/agent-core`); removed the `// TODO(phase2b)` note. `upsertAgendaContent`'s param
  types tightened to match (`content?: SectionContent | null`, `clarifyingQuestions?: ClarifyingQuestion[]`,
  `kbGaps?: KbGap[]`).
- `src/lib/workshop/server.ts` (CHANGED) — added `workstreamName(db, orgId, code)` service-key helper
  (single-code -> display name), used by the section route for workstream + evaluation grounding.
- `package.json` + `src/lib/version.ts` (CHANGED) — app version `0.3.121` -> `0.3.122`.
- `docs/workshop-facilitation/handoff-phase2b.md` (this file).

No UI, no deck route (Phase 4/5 assemble the deck client-side). agent-core untouched. No schema
change (Phase 1 owns it). No embedding/import scripts run.

## 2. Public surface Phase 3 depends on

### `POST /api/workshops/section`

Request body (JSON):
```ts
{
  workshopId: string          // required
  orgId: string               // required (org-scopes the workshop)
  agendaItemId: string        // required (must belong to the workshop)
  feedback?: string           // NL revise; presence forces status 'final'
  clarificationAnswers?: { question: string; answer: string }[]  // presence forces 'final'
}
```

Response `200` (JSON) — the full `SectionGenerationResult` plus the persisted `version` + `status`:
```ts
{
  content: SectionContent            // OverviewSectionContent | WorkstreamSectionContent | EvaluationSectionContent (discriminated on .kind)
  clarifyingQuestions: ClarifyingQuestion[]   // [] when none
  kbGaps: KbGap[]                    // may include one app-injected gap (see §status/grounding)
  groundingUsed: boolean
  version: number                    // persisted row version (1 on first create, +1 per regenerate)
  status: 'needs_input' | 'final'    // persisted row status
}
```

Error responses (JSON `{ error: string }`):
- `400` — missing `orgId`/`workshopId`/`agendaItemId`, or malformed body.
- `404` — workshop not found for org, or agenda item not found for workshop.
- `502` — `generateSectionContent` returned null (model produced nothing).

Notes for the UI:
- The route reads `section_kind`, `workstream_code`, `objective`, `timebox_minutes`, `focus_type`
  off the agenda item and `topic`/`customer_name`/`objective`/`duration_minutes`/`workstream_codes`
  off the workshop. The UI does not pass any of these; it only passes the four body fields above.
- `content.kind` is the discriminator. Render per kind: overview (headline + talkingPoints),
  workstream (focusedContext + keyDecisions[] with options/factors/leadingQuestions/recommendedDecision),
  evaluation (divergences + overallRecommendation + pros/cons + tradeoffs + rationale).
- Regenerating (calling again) bumps `version` and overwrites the same row (upsert on `agenda_item_id`).

### Brief route new body field

`POST /api/workshops/brief` body gains:
```ts
{
  ...existing fields (orgId, topic, objective?, customerName?, workstreamCodes?, focusAreas?, scenarios?),
  durationMinutes?: number    // total workshop length; timeboxes are normalized to sum to it
  workshopId?: string         // when present, the route persists server-side (agenda + section meta + duration + brief)
}
```
Response adds `persisted: boolean` (true when it wrote server-side). The returned `brief.agenda`
items now carry `sectionKind` + `workstreamCode`, and include a final `evaluation` item when 2+
workstreams are in scope (produced by the extended `generateBrief`).

**Persistence behavior when `workshopId` is passed:** the route DELETEs the workshop's existing
`workshop_agenda_items` then INSERTs the brief agenda with `section_kind`/`workstream_code`/
`timebox_minutes`/`focus_type` on each row (`sort_order` = index), stores `brief` + `duration_minutes`
on the workshop, and sets `status='scheduled'`. This is a server-side replacement equivalent to the
client's old `replaceAgenda` + `updateWorkshop`, but it also writes the section metadata (which the
browser `replaceAgenda` helper does not). Phase 3's UI should call the brief route WITH `workshopId`
(and `durationMinutes`) so section metadata lands; it should then NOT also call `replaceAgenda`
(that would wipe the section metadata). The evaluation item is persisted like any other agenda item
(it has `section_kind='evaluation'` and `workstream_code=null`).

### `AgendaContentRow` tightened type (`src/lib/supabase/workshops.ts`)
```ts
import type { SectionContent, ClarifyingQuestion, KbGap } from '@jlee-revtech/agent-core'
export interface AgendaContentRow {
  id: string
  workshop_id: string
  agenda_item_id: string
  section_kind: SectionKind
  content: SectionContent | null
  clarifying_questions: ClarifyingQuestion[]
  kb_gaps: KbGap[]
  status: AgendaContentStatus   // 'empty' | 'generating' | 'draft' | 'needs_input' | 'final'
  version: number
  created_at: string
  updated_at: string
}
```

## 3. Key implementation details

### Status mapping (implemented per PLAN §5 step 7)
```
status = (clarifyingQuestions.length > 0 && !feedback && !(clarificationAnswers?.length))
           ? 'needs_input'
           : 'final'
```
Content is ALWAYS persisted regardless of status. So: a fresh generate that returns clarifying
questions lands as `needs_input` (content stored, but the room should answer the questions); a
revise (`feedback` present) or an answered regenerate (`clarificationAnswers` present) lands as
`final` even if new clarifying questions come back.

### How modelContext + knowledgeContext are assembled (workstream sections only)
- `modelContext` = `assemblePreRead(db, orgId, [workstream_code])` (server.ts) — the customer's homed
  process model + L2 groups + rollup counts scoped to the single workstream. `undefined` when empty.
- `knowledgeContext` = `knowledge.search({ query, workstreams: [workstream_code], limit: 6 })` where
  `query = [title, objective, topic, workstreamName].filter(Boolean).join(' — ')`. Hit `content`s are
  concatenated with blank-line separators, capped at 9000 chars (`KB_CHARS_CAP`). `undefined` when no hits.
- `knowledgeThin = hits.length < 2` (also forced `true` if the search throws or the item has no
  `workstream_code`). When `knowledgeThin` and the model returns no `kbGaps`, the route injects one:
  `{ workstreamCode, topic: (objective || title), rationale: 'No customer or A&D-specific knowledge was retrieved for this workstream topic; seed a vibe-skill bundle to ground it.' }`.
- Overview: no grounding. Evaluation: no arch/RAG grounding; instead it reads all `workstream` content
  rows for the workshop and builds `workstreamDecisions` = per workstream
  `{ workstreamCode, workstreamName, decisions: keyDecisions.map(d => ({ title, recommendation: d.recommendedDecision.recommendation, rationale: d.recommendedDecision.rationale })) }`.

### Persistence in the section route (why not reuse the browser helper)
The browser `upsertAgendaContent` in `src/lib/supabase/workshops.ts` reads the JWT from
`localStorage`, so it cannot run in a route. The route uses `serverModelDb()` (service key, same
`lmuwylgbabcdnfmtscom` project as the public URL) and a private `upsertAgendaContentServer` that does
the read-then-write upsert on the `agenda_item_id` UNIQUE key, bumping `version` on update. Same
semantics as the browser helper, service-key auth.

### Model
`generateSectionContent` is called WITHOUT `model`, so it uses agent-core's default
`DEFAULT_AGENT_MODEL` (`claude-sonnet-4-6`). The app has no separate configured model to read.

## 4. Verification

- `npm run build` (Next 16.2.x, Turbopack): "Finished TypeScript in 8.8s", 27/27 static pages,
  no errors. `/api/workshops/section` and `/api/workshops/brief` both appear in the route manifest
  as dynamic (`ƒ`) routes. TypeScript ran as part of the build and passed with all my changes.
- **Live LLM + DB request NOT exercised.** The routes are typechecked and compiled but no real POST
  was issued (would need a live Anthropic key + a real workshop/agenda row + Voyage-backed kb). The
  request/response shapes above are from the code, not a captured curl. Phase 3 should smoke it once
  the UI is wired.

## 5. Gotchas / open items

- **Brief route persistence is opt-in via `workshopId`.** Today's client (`/workshops/[id]/page.tsx`
  `generateBrief`) does NOT pass `workshopId` and still persists client-side via `replaceAgenda`
  (which drops section metadata). Phase 3 must switch that call to pass `workshopId` + `durationMinutes`
  and stop calling `replaceAgenda`, or section metadata will never persist. I did not touch the page
  (no UI in this phase).
- **Evaluation depends on workstream content existing first.** The evaluation section reads persisted
  `workshop_agenda_content` rows with `section_kind='workstream'` and non-null content. Generate the
  workstream sections before the evaluation section, or `workstreamDecisions` will be empty and the
  evaluation will be thin. The UI should gate the "Generate Solution Architecture Evaluation" action
  on that (PLAN §6 Phase 3).
- **KB-gap injection is workstream-only.** Overview + evaluation never get an app-injected gap
  (they rarely need grounding, per PLAN §3). The model may still emit `kbGaps` for any kind; the route
  passes those through.
- **Parallel WIP untouched:** `scripts/import-vibe-skills.mjs` and `src/lib/workstream/catalog.ts`
  remain modified/uncommitted from another session. NOT staged (PLAN §7: never `git add -A`).
- **Next.js workspace-root warning** (multiple lockfiles above the app) is pre-existing and unrelated;
  build still succeeds.
- **No em dashes** in any prose/content I authored (Josh's rule). The one pre-existing em dash used as
  a query separator string in the section route (`.join(' — ')`) matches the roster-join convention in
  the existing code and is data, not prose.

## 6. Git

- Repo: `jlee-revtech/-Mach12-Diagram-Solution`, branch `master`.
- Commit: `da694b0` (`feat(workshops): section generation + evaluation API routes; brief duration/section wiring [phase 2b]`).
- Staged ONLY: `src/app/api/workshops/section/route.ts`, `src/app/api/workshops/brief/route.ts`,
  `src/lib/supabase/workshops.ts`, `src/lib/workshop/server.ts`, `package.json`, `src/lib/version.ts`,
  `docs/workshop-facilitation/handoff-phase2b.md`.
- Push: `<STATUS>`.
