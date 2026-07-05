# Workshop Facilitation Content — Master Build Plan

Status: **authoritative spec**. Every phase agent reads THIS file plus the latest
`handoff-phaseN.md` in this folder, builds its phase, writes the next hand-off, and
passes the baton. Do not re-explore what is already documented here.

App: **Solution Architecture Studio** = `mach12ai/diagram-app` (Next.js, Supabase
`lmuwylgbabcdnfmtscom`, git repo `jlee-revtech/-Mach12-Diagram-Solution`).
Shared brain: `@jlee-revtech/agent-core` (git `jlee-revtech/agent-core`, GitHub Packages).

---

## 1. Goal

Add a **facilitation-content authoring layer** to the Workshops feature, sitting
between the existing Brief and the Live transcript. Requirements (from Josh):

| # | Requirement | Where it lands |
|---|---|---|
| 1 | Click into each agenda section, generate content for it | Per-section generator + section editor panel |
| 2 | Overview sections (welcome, ground rules, decision framing) use standard content | Template-driven overview generation (personalized to customer/topic) |
| 3 | Where content is needed, ask the knowledge base to be seeded | Workstream generator grounds via `kb_*`; thin grounding emits a `kbGaps` callout |
| 4 | Workstream cadence: (1) Focused Context, (2) Key Decisions, (3) factors/pros-cons + leading questions leading to a recommended decision | `WorkstreamSectionContent` shape |
| 5 | Cross-workstream "Solution Architecture Evaluation" when workstreams diverge | `evaluation` section reading all workstream recommended decisions |
| 6 | Download a well-formatted PowerPoint facilitation document | `exportFacilitationPptx` from the shared `WorkshopSlide[]` model |
| 7 | Walk through in HTML in the "Workshop Experience" | Full-screen present route over the same `WorkshopSlide[]` model |
| 8 | Tie content to the agenda topics from the brief | Content keyed to `workshop_agenda_items`; new `workshop_agenda_content` table |
| 9 | Facilitator NL feedback updates content on the fly | `feedback` param on generate; works in prep + present |
| 10 | Agents ask clarifying questions throughout the update process | `clarifyingQuestions[]` in every generate/revise result |
| 11 | Facilitator sets workshop length; tailor content to time slots | `duration_minutes`; time-boxed agenda + per-section depth scales with its minutes |

**Core design invariant:** one normalized `WorkshopSlide[]` model (produced by
`buildFacilitationDeck` in agent-core) drives BOTH the PPTX export AND the HTML
walkthrough, so they never drift. Section content is stored *semantically*; slides
are *derived*.

**Decisions locked (Josh, this session):** generators live in **agent-core** (the
shared brain), not the app. Delivery is **end-to-end, commit per increment**.

---

## 2. Current-state map (verified this session)

### App files (`mach12ai/diagram-app/`)
- `src/app/workshops/page.tsx` (201 lines) — list + new-workshop form. State: `title, topic, objective, customer, wsCodes, focus`. Creates a workshop row, then routes to `/workshops/[id]`.
- `src/app/workshops/[id]/page.tsx` (514 lines) — the Room. Stages: prep(draft) → scheduled → live → completed. Calls `/api/workshops/{brief,facilitate,contribute,capture,recap,apply}`. Renders agenda rail, transcript, facilitator panel, capture cards, recap + export buttons. **This is where the "Workshop Experience" and section authoring plug in.**
- `src/lib/workshop/types.ts` — app domain types (Workshop, agenda item, capture, brief, recap).
- `src/lib/workshop/server.ts` — server helpers: `assemblePreRead`, `recentTranscript`, roster (uses service key).
- `src/lib/workshop/export.ts` — `exportRecapDocx`, `exportRecapPptx` (recap only, today). Uses `docx` + `pptxgenjs` (dynamic import `pptxgenjs.default`). Deck is 13.333x7.5 (16:9); brand blue `#2563EB`, text `#0F172A`, grey `#475569`.
- `src/lib/supabase/workshops.ts` — PostgREST data access under RLS.
- `src/lib/knowledge/search.ts` — `createKnowledgeClient({url, serviceKey, voyageKey, voyageModel})` from agent-core; `.search({query, workstreams, tenantKey, limit})` returns `{mode, hits}`.
- `src/lib/version.ts` + `package.json` — version (currently **0.3.119**). `src/components/VersionBadge.tsx` renders it.
- `src/app/api/workshops/{brief,facilitate,contribute,capture,recap,apply,voice-token}/route.ts`.
- `.npmrc` — points `@jlee-revtech` at GitHub Packages, token via `${NODE_AUTH_TOKEN}`.
- `scripts/apply-migration.mjs` — applies a `.sql` via Supabase Management API (needs `SUPABASE_ACCESS_TOKEN`).

### Data model (`supabase/040_workshops.sql`)
- `workshops` (id, organization_id, title, topic, objective, customer_name, status[draft|scheduled|live|completed|archived], focus_areas text[], workstream_codes text[], scheduled_at, started_at, ended_at, brief jsonb, recap jsonb, settings jsonb, created_by, timestamps).
- `workshop_participants`, `workshop_scenarios`.
- `workshop_agenda_items` (id, workshop_id, sort_order, title, objective, focus_type, timebox_minutes, status[pending|active|done|skipped], linked_artifact_type, linked_artifact_id, notes, timestamps).
- `workshop_messages` (transcript), `workshop_captures` (decision|action|deliverable|risk|question|architecture_change|parking_lot; proposed→confirmed→applied→dismissed).
- RLS: child tables scoped through the parent workshop's org. Follow this exact pattern for new tables.

### Knowledge base (`supabase/knowledge/001_knowledge_repo.sql`)
- `kb_workstream_catalog` (canonical 13 workstream codes), `kb_workstream_agents` (per-code persona), `kb_sources` (skill|baseline|customer-doc|reference; `tenant_key` NULL=global; `workstream_codes text[]`), `kb_chunks` (pgvector 1024).
- RPCs `kb_match_chunks` (semantic) + `kb_search_chunks_text` (lexical fallback).
- Seeding is via `scripts/import-*.mjs`. A "seed the KB" request in this feature does NOT run embeddings inline: it surfaces the gap + the bundle recipe (see §7).

### agent-core (`agent-core/src/`, installed v0.5.0)
- `workshop.ts` (408 lines): `WorkshopFocus`, `CaptureType`, `WorkshopAgendaItem {title, objective?, focusType?, timeboxMinutes?, status?}`, `WorkshopBrief {summary, objectives, agenda[], preRead, gaps, keyQuestions, risks}`, `buildFacilitatorPersona`, `generateBrief`, `runFacilitation`, `runCapture`, `generateRecap`.
- **Structured-output helper** (reuse this exactly):
  ```ts
  interface ForcedTool { name: string; description: string; input_schema: Record<string, unknown>; }
  async function structured<T>(apiKey, model, system, user, tool: ForcedTool, maxTokens=1600): Promise<T|null>
  const STR = { type: "string" } as const;
  const STR_ARR = { type: "array", items: { type: "string" } } as const;
  ```
  It calls `anthropic.messages.create` with `tool_choice:{type:"tool", name}` and returns the tool-use `input` as `T`.
- `index.ts` re-exports `./workshop.js` (all new exports flow through automatically).
- Build: `npm run build` (tsc → `dist/`). Publish: see §7 recipe. Default model `DEFAULT_AGENT_MODEL` (`claude-sonnet-4-6`) from `./types.js`.

---

## 3. Target types (canonical — defined in agent-core `workshop.ts`, Phase 2a)

```ts
export type SectionKind = "overview" | "workstream" | "evaluation";

// (2) overview sections — standard content, personalized
export interface OverviewSectionContent {
  kind: "overview";
  headline: string;
  talkingPoints: string[];
  facilitatorNotes?: string;
}

// (4) one key decision inside a workstream section
export interface KeyDecision {
  id: string;                 // stable slug, e.g. "co-mingle-vs-separate-cc"
  title: string;
  context: string;            // why this decision matters for this workstream + topic
  options?: { label: string; pros: string[]; cons: string[] }[];
  factors?: string[];         // decision factors to weigh
  leadingQuestions: string[]; // questions that lead the room to the recommendation
  recommendedDecision: { recommendation: string; rationale: string; confidence?: "low"|"medium"|"high" };
}

export interface WorkstreamSectionContent {
  kind: "workstream";
  workstreamCode: string;
  workstreamName?: string;
  focusedContext: string;     // (1) how the workshop topic applies to this workstream
  keyDecisions: KeyDecision[];// (2)+(3)
}

// (5) cross-workstream evaluation
export interface EvaluationDivergence {
  topic: string;
  positions: { workstreamCode: string; stance: string }[];
  tension: string;
}
export interface EvaluationSectionContent {
  kind: "evaluation";
  divergences: EvaluationDivergence[];
  overallRecommendation: string;
  pros: string[];
  cons: string[];
  tradeoffs?: string[];
  rationale: string;
}

export type SectionContent = OverviewSectionContent | WorkstreamSectionContent | EvaluationSectionContent;

// (10) + (3) returned alongside content on every generate/revise
export interface ClarifyingQuestion { id: string; question: string; why?: string; }
export interface KbGap { workstreamCode?: string; topic: string; suggestedBundleId?: string; rationale: string; }

export interface SectionGenerationResult {
  content: SectionContent;
  clarifyingQuestions: ClarifyingQuestion[];
  kbGaps: KbGap[];
  groundingUsed: boolean;
}

// The normalized slide model — single source of truth for PPTX + HTML walkthrough
export interface WorkshopSlideBlock { label?: string; body?: string; bullets?: string[]; pros?: string[]; cons?: string[]; }
export interface WorkshopSlide {
  kind: "title" | "agenda" | "bullets" | "context" | "decision" | "evaluation";
  heading: string;
  subheading?: string;
  bullets?: string[];
  blocks?: WorkshopSlideBlock[];
  facilitatorNotes?: string;
}
```

### agent-core function signatures (Phase 2a)

```ts
export interface GenerateSectionInput {
  sectionKind: SectionKind;
  title: string;
  objective?: string;
  topic: string;
  customerName?: string;
  workstream?: { code: string; name: string };   // required for kind=workstream
  focus?: WorkshopFocus;
  timeboxMinutes?: number;                          // (11) tailor depth to the slot
  durationMinutes?: number;                         // total workshop length, for context
  modelContext?: string;                            // arch pre-read scoped to this section/ws
  knowledgeContext?: string;                        // RAG chunk text the app retrieved
  knowledgeThin?: boolean;                          // app signals weak retrieval → prompt KB-gap
  clarificationAnswers?: { question: string; answer: string }[];
  priorContent?: SectionContent;                    // revise path
  feedback?: string;                                // (9) NL feedback for revise
  // evaluation only:
  workstreamDecisions?: { workstreamCode: string; workstreamName?: string; decisions: { title: string; recommendation: string; rationale?: string }[] }[];
  anthropicApiKey: string;
  model?: string;
}
export function generateSectionContent(input: GenerateSectionInput): Promise<SectionGenerationResult | null>;

// pure, deterministic — no LLM
export function buildSlides(section: SectionContent, opts?: { title?: string; timeboxMinutes?: number }): WorkshopSlide[];
export function buildFacilitationDeck(input: {
  title: string; customerName?: string; topic?: string; durationMinutes?: number;
  sections: { agendaTitle: string; timeboxMinutes?: number; content: SectionContent }[];
}): WorkshopSlide[];

// extend generateBrief: agenda items gain sectionKind + workstreamCode; input gains durationMinutes
export function normalizeAgendaTimeboxes(agenda: WorkshopAgendaItem[], durationMinutes?: number): WorkshopAgendaItem[];
```

**generateBrief changes:** add `durationMinutes?` to `GenerateBriefInput`; extend
`WorkshopAgendaItem` with `sectionKind?: SectionKind` and `workstreamCode?: string`;
extend `BRIEF_TOOL` schema so each agenda item is classified (overview vs workstream,
with a workstreamCode when workstream-specific); instruct the model to timebox the
agenda to sum to `durationMinutes`; always append a final `evaluation` item when 2+
workstreams are in scope. Post-process with `normalizeAgendaTimeboxes`.

**Depth tailoring rule (bake into the prompt):** ~1 key decision per 8-10 minutes of
timebox, min 1, max 4; overview sections get 3-6 talking points. The app also passes a
soft cap derived from the box.

**KB-gap rule (bake into the prompt):** if `knowledgeThin` or the model lacked concrete,
customer/A&D-specific grounding for a workstream section, populate `kbGaps` with
`{workstreamCode, topic, suggestedBundleId, rationale}` describing the vibe-skill bundle
that should be seeded. Overview + evaluation rarely need grounding.

---

## 4. Data model changes (Phase 1) — `supabase/046_workshop_facilitation.sql`

```sql
-- (11) total length
ALTER TABLE workshops ADD COLUMN IF NOT EXISTS duration_minutes int;

-- (8) classify agenda items
ALTER TABLE workshop_agenda_items ADD COLUMN IF NOT EXISTS section_kind text;   -- overview|workstream|evaluation
ALTER TABLE workshop_agenda_items ADD COLUMN IF NOT EXISTS workstream_code text;

-- per-section facilitation content
CREATE TABLE IF NOT EXISTS workshop_agenda_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id uuid NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  agenda_item_id uuid NOT NULL REFERENCES workshop_agenda_items(id) ON DELETE CASCADE,
  section_kind text NOT NULL,                 -- overview|workstream|evaluation
  content jsonb,                              -- SectionContent (loosely typed in DB)
  clarifying_questions jsonb DEFAULT '[]'::jsonb,
  kb_gaps jsonb DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'empty',       -- empty|generating|draft|needs_input|final
  version int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agenda_item_id)
);
CREATE INDEX IF NOT EXISTS idx_ws_content_workshop ON workshop_agenda_content(workshop_id);
ALTER TABLE workshop_agenda_content ENABLE ROW LEVEL SECURITY;
-- RLS: mirror the 040 child-table pattern (org membership via parent workshop).
-- Copy the exact USING/ WITH CHECK EXISTS(...) shape used for workshop_agenda_items.
```

Read `supabase/040_workshops.sql` for the exact RLS helper/policy shape and replicate it
for `workshop_agenda_content` (SELECT/INSERT/UPDATE/DELETE for org members).

Data access to add in `src/lib/supabase/workshops.ts`:
- `listAgendaContent(client, workshopId): Promise<AgendaContentRow[]>`
- `getAgendaContent(client, agendaItemId): Promise<AgendaContentRow | null>`
- `upsertAgendaContent(client, {workshopId, agendaItemId, sectionKind, content, clarifyingQuestions, kbGaps, status}): bump version on update`
- `updateWorkshopDuration(client, workshopId, minutes)`
- `setAgendaSectionMeta(client, agendaItemId, {sectionKind, workstreamCode})`

Phase 1 types the `content` jsonb loosely (a local `AgendaContentRow` with `content: unknown`).
Phase 2b tightens by importing `SectionContent` from agent-core.

---

## 5. API routes (Phase 2b)

- **`POST /api/workshops/section`** — body `{ workshopId, orgId, agendaItemId, feedback?, clarificationAnswers? }`.
  1. Load the workshop + the agenda item (get `section_kind`, `workstream_code`, `timebox_minutes`, `objective`).
  2. For `workstream`: assemble `modelContext` (arch pre-read scoped to that workstream, reuse `server.ts assemblePreRead` logic) + `knowledgeContext` via `createKnowledgeClient().search({query, workstreams:[code]})`; set `knowledgeThin = hits.length < 2 || topScore < threshold`.
  3. For `evaluation`: gather all `workstream` rows from `workshop_agenda_content`, extract each `keyDecisions[].{title, recommendedDecision}` → `workstreamDecisions`.
  4. For `overview`: no grounding needed.
  5. Load prior content row (if any) → `priorContent` (revise path when `feedback` present).
  6. Call `generateSectionContent(...)` with the Anthropic key from env.
  7. `upsertAgendaContent` (status `final`, or `needs_input` if `clarifyingQuestions.length` and unanswered); if `kbGaps` from LLM is empty but `knowledgeThin`, inject one app-side.
  8. Return `SectionGenerationResult`.
- **Brief route** (existing `/api/workshops/brief`): accept `durationMinutes`; pass to `generateBrief`; persist `sectionKind`/`workstreamCode` onto the created `workshop_agenda_items`; store `duration_minutes` on the workshop; create the evaluation agenda item.
- **Deck data** for present/pptx: a helper (server or client) that loads all agenda items + their content rows in order and calls `buildFacilitationDeck`. Can be a route `GET /api/workshops/[id]/deck` or done client-side; pick whichever is simplest given RLS (client-side with the user JWT is fine).

Env available to routes: `ANTHROPIC_API_KEY`, `KNOWLEDGE_SUPABASE_URL/_SERVICE_KEY`, `VOYAGE_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, service key. Mirror an existing route (`brief/route.ts`) for auth + client construction.

---

## 6. UI (Phases 3-5)

### Phase 3 — Section authoring (prep phase of `/workshops/[id]`)
- After a brief exists, render the agenda as **section cards** (title, timebox, `section_kind` badge, status, workstream chip). Extract into `src/components/workshop/SectionCard.tsx`.
- Clicking a card opens a **section editor panel** `src/components/workshop/SectionEditor.tsx`:
  - "Generate content" (POST `/api/workshops/section`), loading state.
  - Render the content by kind: overview (headline + talking points), workstream (Focused Context → per Key Decision: options/factors as pros-cons, leading questions, recommended decision), evaluation (divergences, overall rec, pros/cons).
  - **Clarifying questions** block: list, answer inline, "Regenerate with answers".
  - **KB-gap** callouts: chip per gap ("Knowledge base needs seeding: <topic> for <workstream>") with the bundle recipe from §7 (link/tooltip), and a "Copy seeding steps" affordance. Do NOT run embeddings from the UI.
  - **NL feedback** box: free text → POST `/api/workshops/section` with `feedback` → re-render.
- A **"Generate Solution Architecture Evaluation"** action (enabled once workstream sections have content) → generates/updates the evaluation section.
- Follow the existing page's design tokens (`var(--m12-*)`, brand blue `#2563EB`, Framer Motion). Match `CAPTURE_META`-style metadata maps for section kinds.
- **Duration input**: add "Workshop length (minutes)" to the new-workshop form (`src/app/workshops/page.tsx`) and/or the prep panel; pass through to the brief call. (Requirement 11.)

### Phase 4 — Workshop Experience (HTML walkthrough)
- New route `src/app/workshops/[id]/present/page.tsx` (full-screen). Loads the deck via `buildFacilitationDeck`, renders `WorkshopSlide[]` as HTML slides (16:9 stage), prev/next + keyboard nav, agenda progress rail, speaker-notes toggle.
- A **live NL-revise bar**: facilitator types feedback about the current slide's section → POST `/api/workshops/section` with `feedback` for that section → reload that section's slides in place. Surface any clarifying questions inline.
- "Enter Workshop Experience" button from the Room prep view.

### Phase 5 — Facilitation PPTX
- `exportFacilitationPptx(ws, deck: WorkshopSlide[])` in `src/lib/workshop/export.ts`, mirroring `exportRecapPptx` style (16:9, brand colors, `pptxgenjs.default` dynamic import). One slide per `WorkshopSlide`; render `blocks` as pros/cons columns, `bullets` as bullet lists; put `facilitatorNotes` in speaker notes (`slide.addNotes`).
- "Download facilitation deck (PPTX)" button in the prep view and the present view.

---

## 7. Recipes (use verbatim)

### Version bump (every phase, per Josh's standing rule)
Bump the patch in `mach12ai/diagram-app/package.json` AND `src/lib/version.ts`. For
agent-core changes bump `agent-core/package.json` minor (0.5.0 → 0.6.0).

### Build check before commit (every phase)
`cd mach12ai/diagram-app && npm run build` must pass clean before committing. For
agent-core: `cd agent-core && npm run build`.

### Apply a migration (Phase 1)
PowerShell (reads the Supabase PAT from Windows Credential Manager as UTF-8 — the
UTF-16 decode gives a garbage token, that is the known gotcha):
```powershell
$sig = @'
using System; using System.Runtime.InteropServices;
public class CredMan {
  [DllImport("advapi32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
  public static extern bool CredRead(string target, int type, int flags, out IntPtr credential);
  [StructLayout(LayoutKind.Sequential)] public struct CREDENTIAL { public int Flags; public int Type; public IntPtr TargetName; public IntPtr Comment; public long LastWritten; public int CredentialBlobSize; public IntPtr CredentialBlob; public int Persist; public int AttributeCount; public IntPtr Attributes; public IntPtr TargetAlias; public IntPtr UserName; }
  public static string Read(string target){ IntPtr p; if(!CredRead(target,1,0,out p)) return null; var c=(CREDENTIAL)Marshal.PtrToStructure(p,typeof(CREDENTIAL)); byte[] b=new byte[c.CredentialBlobSize]; Marshal.Copy(c.CredentialBlob,b,0,c.CredentialBlobSize); return System.Text.Encoding.UTF8.GetString(b); }
}
'@
Add-Type -TypeDefinition $sig -Language CSharp
$env:SUPABASE_ACCESS_TOKEN = [CredMan]::Read("Supabase CLI:supabase")
node scripts/apply-migration.mjs supabase/046_workshop_facilitation.sql   # run from mach12ai/diagram-app
```
Migration is idempotent (IF NOT EXISTS) so re-running is safe. Verify with a follow-up
`SELECT` via the same script or a small query.

### Publish agent-core (Phase 2a)
```bash
cd agent-core
# ensure the active gh account is jlee-revtech (it has write:packages):
gh auth status        # if jlee4113 is active, run: gh auth switch -u jlee-revtech
npm run build
NODE_AUTH_TOKEN="$(gh auth token)" npm publish
```
Then in `mach12ai/diagram-app`: bump the `@jlee-revtech/agent-core` dep to `^0.6.0` in
`package.json` and reinstall: `NODE_AUTH_TOKEN="$(gh auth token)" npm install`. Confirm
`node_modules/@jlee-revtech/agent-core/dist/workshop.d.ts` shows the new exports.

### KB seeding recipe (surfaced to the user by requirement 3 — do NOT auto-run)
To seed a knowledge bundle for a workstream: add
`cds-lineage-explorer/public/vibe-skills/<id>/SKILL.md`; register `<id>` in SSS
`knowledge.ts AGENT_SKILLS[<ws>]`, SAS `catalog.ts knowledgeSourceCodes`, and
`import-vibe-skills.mjs WORKSTREAMS[].skills`; then run
`node scripts/import-vibe-skills.mjs` from `diagram-app/`. The UI shows these steps in
the KB-gap callout; it does not execute them.

### Git discipline (every phase)
Both trees carry parallel-session WIP. **Never `git add -A`.** Stage only the files this
phase created/changed (list them explicitly). Commit with a clear message ending:
```
Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
```
Then `git pull --rebase` and `git push`. If push is rejected or rebase conflicts,
STOP pushing, leave the commit local, and note it in the hand-off. Never force-push.
diagram-app remote = `jlee-revtech/-Mach12-Diagram-Solution`; agent-core =
`jlee-revtech/agent-core`. Use `git -C <abs path>` so you commit in the right repo.

---

## 8. Phases + acceptance

| Phase | Deliverable | Done when |
|---|---|---|
| 1 | Data model: migration 046 applied; data-access fns; loose `AgendaContentRow` type | Migration applied to `lmuwylgbabcdnfmtscom` (verified); `npm run build` clean; committed; `handoff-phase1.md` written |
| 2a | agent-core: new types + `generateSectionContent` + `buildSlides` + `buildFacilitationDeck` + `normalizeAgendaTimeboxes` + generateBrief extensions; built + published 0.6.0; dep bumped in app | `dist/workshop.d.ts` has new exports; app `npm install` resolves 0.6.0; both build clean; committed both repos; `handoff-phase2a.md` |
| 2b | API routes: `/api/workshops/section`; brief route duration + section_kind wiring | Routes typecheck + build; a manual curl or reasoning-through shows the shapes; committed; `handoff-phase2b.md` |
| 3 | Section authoring UI + duration input | `npm run build` clean; SectionCard/SectionEditor render each kind; committed; `handoff-phase3.md` |
| 4 | Workshop Experience present route + live revise | build clean; committed; `handoff-phase4.md` |
| 5 | `exportFacilitationPptx` + download buttons | build clean; committed; `handoff-phase5.md` (final: summary of the whole feature + any follow-ups, e.g. promote nothing / Vercel env notes) |

---

## 9. Hand-off protocol (every phase agent MUST do this last)

Write `docs/workshop-facilitation/handoff-phase<N>.md` containing:
1. **What I built** — every file created/changed, with absolute or repo-relative paths and a one-line purpose each.
2. **Public surface the next phase depends on** — exact type names, function signatures, route paths, DB columns, as code blocks. If you deviated from this PLAN, say so explicitly and why.
3. **Verification** — commands run and their result (build pass, migration applied, publish succeeded, curl output). If something is unverified, say so.
4. **Gotchas / open items** for the next phase.
5. **Git** — repo(s), commit hash(es), and whether the push succeeded. If push failed, say the commit is local.

Keep hand-offs tight and factual. The next agent reads PLAN.md + your hand-off ONLY;
it will not re-read the whole codebase, so give it what it needs.
