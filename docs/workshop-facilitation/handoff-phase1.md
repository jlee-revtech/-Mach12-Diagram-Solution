# Hand-off — Phase 1 (Data model)

Phase 1 of the Workshop Facilitation Content build. Reads: `PLAN.md` §4, §7, §8, §9.
App: `mach12ai/diagram-app`. DB: `lmuwylgbabcdnfmtscom`. Repo: `jlee-revtech/-Mach12-Diagram-Solution`.

## 1. What I built

- `supabase/046_workshop_facilitation.sql` (new) — migration adding the facilitation-content data model:
  - `workshops.duration_minutes int` (requirement 11).
  - `workshop_agenda_items.section_kind text` + `workshop_agenda_items.workstream_code text` (requirement 8, classify agenda items).
  - new table `workshop_agenda_content` (per-section semantic content), plus index `idx_ws_content_workshop`, an `updated_at` trigger, RLS enabled, and the two org-membership policies mirroring the 040 child-table pattern.
- `src/lib/supabase/workshops.ts` (changed) — added the `AgendaContentRow` type (loose `content: unknown`) + five data-access functions. Also re-exports `SectionKind`.
- `src/lib/workshop/types.ts` (changed) — added exported `SectionKind` union and extended `WorkshopAgendaItem` with optional `section_kind` + `workstream_code` (snake_case, matching the file's DB-mirror convention; these are the exact PostgREST column names `listAgenda` returns).
- `package.json` + `src/lib/version.ts` (changed) — version bumped `0.3.119` -> `0.3.120`, BUILD_DATE `2026-07-05`.
- `docs/workshop-facilitation/handoff-phase1.md` (this file).

## 2. Public surface the next phases depend on

### DB (migration 046, applied to `lmuwylgbabcdnfmtscom`)

```sql
-- workshops
duration_minutes int   -- nullable

-- workshop_agenda_items
section_kind text      -- 'overview' | 'workstream' | 'evaluation' (nullable)
workstream_code text   -- nullable

-- workshop_agenda_content (NEW)
id uuid pk default gen_random_uuid()
workshop_id uuid not null  -> workshops(id) on delete cascade
agenda_item_id uuid not null -> workshop_agenda_items(id) on delete cascade
section_kind text not null            -- overview | workstream | evaluation
content jsonb                         -- SectionContent (loose in DB)
clarifying_questions jsonb default '[]'
kb_gaps jsonb default '[]'
status text not null default 'empty'  -- empty | generating | draft | needs_input | final
version int not null default 1
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
UNIQUE (agenda_item_id)
-- index idx_ws_content_workshop on (workshop_id)
-- RLS: SELECT (view) + FOR ALL (manage, covers INSERT/UPDATE/DELETE) for org members
--   USING/WITH CHECK: workshop_id in (select id from workshops where organization_id in
--     (select organization_id from profiles where id = auth.uid()))
```

### App types (`src/lib/workshop/types.ts`)

```ts
export type SectionKind = 'overview' | 'workstream' | 'evaluation'
// WorkshopAgendaItem now also has:
//   section_kind?: SectionKind | null
//   workstream_code?: string | null
```

### Data access (`src/lib/supabase/workshops.ts`)

```ts
export type { SectionKind } // re-exported from workshop/types
export type AgendaContentStatus = 'empty' | 'generating' | 'draft' | 'needs_input' | 'final'

// TODO(phase2b): tighten `content`/`clarifying_questions`/`kb_gaps` by importing
// SectionContent (and ClarifyingQuestion[]/KbGap[]) from @jlee-revtech/agent-core.
export interface AgendaContentRow {
  id: string
  workshop_id: string
  agenda_item_id: string
  section_kind: SectionKind
  content: unknown
  clarifying_questions: unknown
  kb_gaps: unknown
  status: AgendaContentStatus
  version: number
  created_at: string
  updated_at: string
}

export function listAgendaContent(workshopId: string): Promise<AgendaContentRow[]>
export function getAgendaContent(agendaItemId: string): Promise<AgendaContentRow | null>
export function upsertAgendaContent(data: {
  workshopId: string
  agendaItemId: string
  sectionKind: SectionKind
  content?: unknown
  clarifyingQuestions?: unknown
  kbGaps?: unknown
  status?: AgendaContentStatus
}): Promise<AgendaContentRow>   // creates if none for agenda_item_id, else PATCH + version+1
export function updateWorkshopDuration(workshopId: string, minutes: number): Promise<void>
export function setAgendaSectionMeta(
  agendaItemId: string,
  meta: { sectionKind?: SectionKind; workstreamCode?: string | null },
): Promise<void>
```

Notes for the next phase:
- These are browser-side PostgREST helpers (user JWT via `localStorage`), same style as the rest of the module. Server routes (Phase 2b) that use the service key should mirror `server.ts` / the existing route pattern rather than call these.
- `upsertAgendaContent` reads the existing row first (via `getAgendaContent`), so it is a read-then-write, not a DB `ON CONFLICT` upsert. Fine for the single-facilitator prep flow; if a route needs atomic upsert under concurrency, use PostgREST `Prefer: resolution=merge-duplicates` on the `agenda_item_id` unique key instead.

## 3. Verification

- Migration applied: `node scripts/apply-migration.mjs supabase/046_workshop_facilitation.sql` -> `Applied ... to lmuwylgbabcdnfmtscom. Response: []`. Confirmed via follow-up `information_schema` + `pg_policies` queries: `workshop_agenda_content` has all 11 columns; both policies (`view` + `manage`) exist; `workshop_agenda_items.section_kind` + `workstream_code` and `workshops.duration_minutes` all present.
- Build clean: `npm run build` (Next 16.2.1, Turbopack) -> `Compiled successfully`, `Finished TypeScript`, 26/26 static pages, no errors. TypeScript ran as part of the build and passed with my changes.

## 4. Gotchas / open items

- **Parallel WIP in the tree.** `scripts/import-vibe-skills.mjs` and `src/lib/workstream/catalog.ts` had un-committed changes from another session. I did NOT stage them (per PLAN §7 "never git add -A"). They remain modified/uncommitted in the working tree.
- **Next.js workspace-root warning** (multiple lockfiles: repo-root `package-lock.json` above the app). Pre-existing, unrelated to Phase 1; build still succeeds. See the "Next standalone CF root" memory note if it ever needs silencing via `turbopack.root`.
- `content: unknown` is deliberate (PLAN §4). Phase 2b tightens it against agent-core's `SectionContent`. Do not widen to `any`.
- I chose the 040 two-policy shape (`for select` view + `for all` manage) verbatim rather than four separate SELECT/INSERT/UPDATE/DELETE policies, because `for all` is exactly how 040 grants INSERT/UPDATE/DELETE to org members. This is the "mirror the exact 040 pattern" instruction, not a new shape.

## 5. Git

- Repo: `jlee-revtech/-Mach12-Diagram-Solution`, branch `master`.
- Commit: `0761404` (`feat(workshops): facilitation content data model (migration 046) [phase 1]`).
- Staged ONLY: `supabase/046_workshop_facilitation.sql`, `src/lib/supabase/workshops.ts`, `src/lib/workshop/types.ts`, `package.json`, `src/lib/version.ts`, `docs/workshop-facilitation/PLAN.md`, `docs/workshop-facilitation/handoff-phase1.md`.
- Push: SUCCEEDED (`c3b41d1..0761404 master -> master`).
- The parallel-session WIP (`scripts/import-vibe-skills.mjs`, `src/lib/workstream/catalog.ts`) was stashed during the rebase/push and popped back afterward; it remains uncommitted in the working tree, untouched.
