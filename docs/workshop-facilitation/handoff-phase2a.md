# Hand-off — Phase 2a (agent-core generators + publish + wire into app)

Phase 2a of the Workshop Facilitation Content build. Reads: `PLAN.md` §2, §3, §7, §8, §9
and `handoff-phase1.md`.

- agent-core repo: `jlee-revtech/agent-core` (source at `agent-core/`).
- app repo: `jlee-revtech/-Mach12-Diagram-Solution` (source at `mach12ai/diagram-app/`).
- Published: **`@jlee-revtech/agent-core@0.6.0`** (GitHub Packages).

## 1. What I built

### agent-core (`agent-core/src/workshop.ts`, changed)

- Extended `WorkshopAgendaItem` with optional `sectionKind?: SectionKind` and
  `workstreamCode?: string`.
- Added all Phase 2a types: `SectionKind`, `OverviewSectionContent`, `KeyDecision`,
  `WorkstreamSectionContent`, `EvaluationDivergence`, `EvaluationSectionContent`,
  `SectionContent` (discriminated union on `kind`), `ClarifyingQuestion`, `KbGap`,
  `SectionGenerationResult`, `WorkshopSlideBlock`, `WorkshopSlide`, `GenerateSectionInput`.
- Implemented `generateSectionContent(input)` with three internal `ForcedTool`
  schemas (`overview_section`, `workstream_section`, `evaluation_section`). Each tool
  carries its kind-specific content plus the shared `clarifyingQuestions` / `kbGaps` /
  `groundingUsed`. Branches on `input.sectionKind`; strong A&D-aware system prompt
  (FAR/DFARS/CAS/DCAA/EVMS/ITAR where relevant); depth-tailoring baked into the prompt
  (`depthGuidance`: ~1 key decision per 8-10 min, min 1 max 4; overview 3-6 talking
  points); KB-gap rule and clarifying-questions behavior baked in. Assembles a
  `SectionGenerationResult` with `content.kind` set and workstream content carrying
  `workstreamCode` / `workstreamName` from input. Returns `null` if the model returns
  nothing.
- Implemented the pure (no-LLM) helpers: `buildSlides(section, opts?)`,
  `buildFacilitationDeck(input)`, `normalizeAgendaTimeboxes(agenda, durationMinutes?)`.
- Extended `generateBrief`: added `durationMinutes?` to `GenerateBriefInput`; extended
  `BRIEF_TOOL`'s agenda-item schema with `sectionKind` (enum) + `workstreamCode`;
  instructs the model to classify each agenda item, assign a `workstreamCode` for
  workstream items, and append a final `evaluation` item when 2+ workstreams are in
  scope; post-processes the returned agenda through `normalizeAgendaTimeboxes`.
- `index.ts` unchanged: it already does `export * from "./workshop.js"`, so all new
  exports flow through automatically (verified).

### agent-core (`agent-core/package.json`, changed)
- Version `0.5.0` -> `0.6.0`.

### app (`mach12ai/diagram-app/`)
- `package.json` (changed): `@jlee-revtech/agent-core` dep `^0.5.0` -> `^0.6.0`; app
  version `0.3.120` -> `0.3.121`.
- `package-lock.json` (changed): resolves `@jlee-revtech/agent-core@0.6.0`.
- `src/lib/version.ts` (changed): `APP_VERSION` `0.3.120` -> `0.3.121`.
- `docs/workshop-facilitation/handoff-phase2a.md` (this file).

No app UI or API routes were touched (that is Phase 2b). Nothing in the app yet
consumes the new functions.

## 2. Public surface Phase 2b/3/4/5 import from `@jlee-revtech/agent-core`

```ts
export type SectionKind = "overview" | "workstream" | "evaluation";

export interface OverviewSectionContent {
  kind: "overview";
  headline: string;
  talkingPoints: string[];
  facilitatorNotes?: string;
}

export interface KeyDecision {
  id: string;                 // stable kebab slug
  title: string;
  context: string;
  options?: { label: string; pros: string[]; cons: string[] }[];
  factors?: string[];
  leadingQuestions: string[];
  recommendedDecision: { recommendation: string; rationale: string; confidence?: "low" | "medium" | "high" };
}

export interface WorkstreamSectionContent {
  kind: "workstream";
  workstreamCode: string;
  workstreamName?: string;
  focusedContext: string;
  keyDecisions: KeyDecision[];
}

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

export type SectionContent =
  | OverviewSectionContent
  | WorkstreamSectionContent
  | EvaluationSectionContent;

export interface ClarifyingQuestion { id: string; question: string; why?: string; }
export interface KbGap { workstreamCode?: string; topic: string; suggestedBundleId?: string; rationale: string; }

export interface SectionGenerationResult {
  content: SectionContent;
  clarifyingQuestions: ClarifyingQuestion[];
  kbGaps: KbGap[];
  groundingUsed: boolean;
}

export interface WorkshopSlideBlock { label?: string; body?: string; bullets?: string[]; pros?: string[]; cons?: string[]; }
export interface WorkshopSlide {
  kind: "title" | "agenda" | "bullets" | "context" | "decision" | "evaluation";
  heading: string;
  subheading?: string;
  bullets?: string[];
  blocks?: WorkshopSlideBlock[];
  facilitatorNotes?: string;
}

export interface GenerateSectionInput {
  sectionKind: SectionKind;
  title: string;
  objective?: string;
  topic: string;
  customerName?: string;
  workstream?: { code: string; name: string };   // required for kind=workstream
  focus?: WorkshopFocus;
  timeboxMinutes?: number;
  durationMinutes?: number;
  modelContext?: string;
  knowledgeContext?: string;
  knowledgeThin?: boolean;
  clarificationAnswers?: { question: string; answer: string }[];
  priorContent?: SectionContent;                  // revise path
  feedback?: string;                              // NL feedback for revise
  workstreamDecisions?: {                         // evaluation only
    workstreamCode: string;
    workstreamName?: string;
    decisions: { title: string; recommendation: string; rationale?: string }[];
  }[];
  anthropicApiKey: string;
  model?: string;
}

export function generateSectionContent(input: GenerateSectionInput): Promise<SectionGenerationResult | null>;

// pure, deterministic, no LLM:
export function buildSlides(section: SectionContent, opts?: { title?: string; timeboxMinutes?: number }): WorkshopSlide[];
export function buildFacilitationDeck(input: {
  title: string; customerName?: string; topic?: string; durationMinutes?: number;
  sections: { agendaTitle: string; timeboxMinutes?: number; content: SectionContent }[];
}): WorkshopSlide[];
export function normalizeAgendaTimeboxes(agenda: WorkshopAgendaItem[], durationMinutes?: number): WorkshopAgendaItem[];

// extended:
export interface WorkshopAgendaItem {
  title: string;
  objective?: string;
  focusType?: WorkshopFocus;
  timeboxMinutes?: number;
  status?: "pending" | "active" | "done" | "skipped";
  sectionKind?: SectionKind;      // NEW
  workstreamCode?: string;        // NEW
}
// GenerateBriefInput now also has: durationMinutes?: number
// generateBrief classifies agenda items (sectionKind + workstreamCode), appends a
// final evaluation item when 2+ workstreams are in scope, and runs the agenda
// through normalizeAgendaTimeboxes before returning.
```

### Behavior notes for Phase 2b (the route author)

- `generateSectionContent` requires `input.workstream` for `kind="workstream"`
  (falls back to `code -> name -> "unknown"` for `workstreamCode` if absent, but
  always pass it). For `kind="evaluation"`, pass `workstreamDecisions` gathered from
  the `workstream` content rows (each `keyDecisions[].{title, recommendedDecision}`).
- Set `knowledgeThin` from the app's retrieval quality; the prompt then emits a
  `kbGaps` entry when grounding is weak. PLAN §5 step 7: if the LLM returns empty
  `kbGaps` but `knowledgeThin` is true, the route injects one app-side.
- `buildFacilitationDeck` maps agenda + content rows to `WorkshopSlide[]`; the same
  array drives Phase 5 PPTX and Phase 4 HTML present. Titleslide + agenda slide are
  prepended automatically. Pass `sections` in agenda order.
- `normalizeAgendaTimeboxes`: scales proportionally (equal split when boxes missing),
  floors each at 5 min, rounds to nearest 5, absorbs drift into the last item, sums to
  `durationMinutes`. Returns a new array (no mutation). No-op copy when
  `durationMinutes` is absent/<=0.

## 3. Verification

- **agent-core build**: `cd agent-core && npm run build` -> tsc zero errors
  (strict + `noUncheckedIndexedAccess` + `verbatimModuleSyntax` all on).
- **dist exports**: `dist/workshop.d.ts` contains `generateSectionContent`,
  `buildSlides`, `buildFacilitationDeck`, `normalizeAgendaTimeboxes`, `SectionContent`,
  `WorkshopSlide`, `GenerateSectionInput`, `SectionGenerationResult`, and all new
  interfaces (grepped, confirmed).
- **publish**: `NODE_AUTH_TOKEN="$(gh auth token)" npm publish` from `agent-core` ->
  `+ @jlee-revtech/agent-core@0.6.0` (active gh account `jlee-revtech`, has
  `write:packages`). 0.6.0 did not already exist, so no bump-to-0.6.1 was needed.
- **app install**: `NODE_AUTH_TOKEN="$(gh auth token)" npm install` -> "changed 1
  package"; `node_modules/@jlee-revtech/agent-core/package.json` shows `0.6.0`; its
  `dist/workshop.d.ts` shows the new exports; `package-lock.json` pins `^0.6.0`.
- **app build**: `npm run build` (Next 16, Turbopack) -> "Compiled successfully",
  "Finished TypeScript", 26/26 static pages, no errors. (Nothing consumes the new
  functions yet; this confirms the install resolved and types are intact.)

## 4. Gotchas / open items

- **agent-core does NOT commit `dist/`** (`.gitignore` lists `dist/`). Only
  `src/workshop.ts` + `package.json` were staged. GitHub Packages serves the built
  `dist` from the published tarball; the repo tree stays source-only. Do not
  force-add `dist`.
- **App parallel WIP left untouched**: `scripts/import-vibe-skills.mjs` and
  `src/lib/workstream/catalog.ts` were modified/uncommitted from another session
  (per Phase 1 hand-off). NOT staged. Still uncommitted in the working tree.
- **Next.js workspace-root warning** (multiple lockfiles above the app) is
  pre-existing and unrelated; build still succeeds.
- **Model default**: `generateSectionContent` uses `DEFAULT_AGENT_MODEL`
  (`claude-sonnet-4-6`) unless the caller passes `model`. Same as the rest of
  `workshop.ts`.
- **No em dashes** in any prose/content I authored (Josh's rule). The one pre-existing
  em dash in the roster join (`code — Name`) was left as-is.

## 5. Git

- **agent-core** (`jlee-revtech/agent-core`, branch `main`):
  - Staged: `src/workshop.ts`, `package.json` only.
  - Commit: `65ab389` `feat(workshop): section content generators, slide model, timeboxing [phase 2a]`.
  - Push: SUCCEEDED (`98d74f0..65ab389 main -> main`).
- **app** (`jlee-revtech/-Mach12-Diagram-Solution`, branch `master`):
  - Staged: `package.json`, `package-lock.json`, `src/lib/version.ts`,
    `docs/workshop-facilitation/handoff-phase2a.md` only. (Parallel WIP NOT staged.)
  - Commit: `1d180b4` `chore(workshops): consume agent-core 0.6.0 [phase 2a]`.
  - Push: SUCCEEDED (`5e070e0..1d180b4 master -> master`). The two parallel-WIP files
    were stashed during the rebase/push (rebase refused with unstaged changes) and
    popped back afterward; they remain uncommitted, untouched.
