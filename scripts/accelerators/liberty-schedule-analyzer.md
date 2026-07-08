---
name: Liberty Schedule Analyzer
description: Development schedule analysis accelerator: critical-path math over a task network, sprint capacity and bow-wave analysis, working-day arithmetic, xlsx ingest that preserves app-owned columns, and AI recommendations with an audited accept/reject loop.
workstreams: plan-to-perform, development-technology
license: internal
---

# Liberty Schedule Analyzer

## What It Does

Liberty Schedule Analyzer (repo `liberty-schedule`, DB prefix `lb_*`) is a focused instrument for one recurring failure mode: a large SAP development or build schedule, maintained in a spreadsheet, that nobody can analyze. It ingests the spreadsheet, computes the critical path, models sprint capacity, surfaces the bow wave of work sliding right, and asks an AI for recommendations a human accepts or rejects, with the decision persisted exactly like a hand edit.

| Area | Substance |
|---|---|
| Critical path | Forward and backward pass. Early start and finish are the as-scheduled dates; late finish and start are computed against the project end; slack is late start minus early start; critical is zero slack |
| Negative slack, deliberately | If a successor starts before its predecessor ends, slack goes negative for the violating task. Intentional: it surfaces as-scheduled finish-to-start violations instead of silently repairing them, which is what a scheduling tool would do and what hides the problem |
| Dependencies | Externalized from day one into a predecessor/successor edge table, so the multi-predecessor refactor needs no schema change. Cycle detection currently walks the single-predecessor chain |
| Sprints and capacity | Working-day math with a holiday table and per-developer capacity; sprint capacity in hours; effort from story points or an override; earned hours from percent complete |
| Bow wave | Work that has traveled from its original sprint, and the hours it carries forward |
| xlsx ingest | Re-import overwrites spreadsheet-owned columns and preserves app-owned columns through a coalesce-on-conflict. A source marker distinguishes split children and app-created rows, so re-import never deletes work done in the app |
| AI analysis | Deterministic aggregates are computed locally and feed both the reports and the prompt, so the model and the reports never disagree. Recommendations persist, and accept/reject flows through the same path as a hand edit |
| Audit | Before and after JSON written by database triggers on tasks, dependencies, and both comment tables |

Tables: `lb_tasks`, `lb_sprints`, `lb_dependencies`, `lb_task_comments`, `lb_project_comments`, `lb_developers`, `lb_holidays`, `lb_audit_log`, plus `lb_ai_analyses`, `lb_ai_recommendations`, `lb_ai_ingest_sessions`. Stack: Vite plus Vitest over Supabase. The critical-path math, cascade behavior, cycle detection, and a regression suite are unit-tested with fixtures and snapshots.

Not built, and say so: authentication (row-level security is permissive), resource leveling, multi-predecessor logic in the critical-path walk (the table supports it, the algorithm does not), and any SAP integration whatsoever.

## When To Position It

Position it when an SAP program's build schedule is a spreadsheet with hundreds of tasks and one "Depends On" column, and the program manager cannot say what is on the critical path; when work keeps sliding right and nobody can quantify the bow wave; when the client wants a schedule opinion fast without standing up Primavera; and as a low-risk first deliverable on an assessment, where ingesting their spreadsheet and returning the critical path in a day solves the credibility problem.

Do NOT position it when:

- The client already runs Primavera P6 or Microsoft Project with a scheduler who knows how to use it. This is not a scheduling tool, it will lose that comparison, and it should.
- The requirement is contractual EVMS reporting (integrated program schedule, control accounts, IPMR formats). That is Tesseract XPM plus the add-on project management engine.
- The network has anything other than finish-to-start relationships, or lags, or constraints. The math does not model them.
- Resource leveling or automatic rescheduling is required. It computes and reports; it does not repair.
- Multi-predecessor networks are the norm today. The table is ready; the algorithm is not. Do not promise it as shipped.

## How It Fits The SAP Design

Touches Plan-to-Perform (schedule, capacity, earned progress) and Development-Technology (the schedule is usually a RICEFW or build backlog).

Replaces: the spreadsheet's inability to answer a question. It does not replace the spreadsheet; it ingests it and hands back a re-importable view, preserving anything the app added.

Augments: nothing in SAP, today. There is no integration. The natural next step, if funded, is to read the SAP project structure and effort actuals so percent complete stops being self-reported.

Standard-SAP alternative: PS network activities with scheduling, Cloud ALM task management, or Jira with a critical-path plugin. The accelerator wins on (1) taking the spreadsheet as it is, rather than requiring the client to move first, (2) exposing as-scheduled violations rather than repairing them, which is the diagnostic a consultant needs, (3) an AI recommendation loop grounded in the same aggregates the reports show, every accept or reject audited, (4) a day of work to stand up. It does not win as a system of record for a schedule. It is an analyzer, and the name is accurate.

## Integration Points

In: an xlsx export of the client's schedule, ingested through a script that maps spreadsheet-owned columns and coalesces app-owned columns on conflict; developer capacity and holiday calendars from configuration.

Out: the analyzed schedule (critical path, slack, capacity per sprint, bow wave); AI recommendations as persisted records with an accept or reject disposition; an audit log of every change.

Persistence: Supabase Postgres. Row-level security is permissive and there is no authentication. This is a single-consultant, single-program tool today and it should not be pointed at customer-confidential data on a shared project without that being fixed first.

AI path: an Edge Function invokes the model. The deterministic aggregates are computed client-side and passed in, keeping the prompt small and guaranteeing the model reasons over the same numbers on the human's screen.

Deployment: a Vite single-page application over Supabase. No server, no proxy, no SAP connection.

## SAP-Side Objects

None. This accelerator has no SAP footprint today, and pretending otherwise in front of an architect is the fastest way to lose the room.

Described functionally, the objects it would need if a client funds the integration (none of these exist):

| Object | Type | Purpose |
|---|---|---|
| Network activity read | CDS view + OData V4 binding | Pull the project network, activities, and relationships so the task network is sourced rather than re-typed |
| Activity confirmation read | CDS view | Actual work confirmed per activity, so percent complete stops being self-reported |
| WBS actuals read | Existing service | The WBS actuals binding already built for Tesseract XPM would serve the cost side without new work |
| Effort actual by personnel number | CDS view over the time table | Hours per developer per period, replacing the capacity assumption with a measurement |

The correct statement to a client: today it reads your spreadsheet; the SAP read path exists in our other accelerators and could be pointed at this in a sprint; nothing is built.

## Demo Path

1. Show the client's own xlsx. We start where you are: no migration, no data model workshop.
2. Run the ingest. Tasks, sprints, developers, holidays, and dependencies load. Dependencies are edges in a table, not a text column, from the first import.
3. Open the grid. The critical path is highlighted and slack shows per task. This is the answer the spreadsheet could not give.
4. Point at a task with negative slack. Its successor starts before it finishes, and the tool did not quietly fix it. Now the program manager knows.
5. Edit a task's finish date. The cascade runs through the successor chain and the critical path recomputes. The math is live and it is unit-tested.
6. Open the capacity panel. Sprint capacity against consumed effort, from story points converted to hours with per-task overrides. The sprint is oversubscribed, and by exactly how much.
7. Open the bow wave. Tasks that traveled from their original sprint, and the hours they carry. Next sprint is not next sprint's work.
8. Run the AI analysis. The model receives the aggregates you just looked at and returns recommendations: resequence, split, reassign, flag for follow-up.
9. Accept one recommendation and reject another. Both persist, and the audit log carries the before and after JSON. An AI suggestion is a change like any other, and it is auditable.
10. Re-import the client's updated spreadsheet. Spreadsheet-owned columns are overwritten; app-created split children and comments survive. The round trip is safe.

## Positioning Notes

To a CFO: development schedule slip is the leading indicator of a cost overrun, and today it is invisible until a sprint review. This quantifies the bow wave: the hours that moved and where they landed. It costs a day to stand up.

To a program manager: keep your spreadsheet. We tell you what is on the critical path, which tasks violate their predecessors, and how oversubscribed each sprint actually is. When you accept an AI recommendation it is recorded like any other change, with a before and after.

To a CIO: there is no SAP integration, and nothing leaves your control except a trimmed task list sent to the model containing task names, sprints, developers, and effort. Row-level security is permissive today, so do not put customer-confidential program data in a shared project until we harden it. That is a real limitation, on the roadmap, not in the product.

Discriminator vs Deltek Costpoint: no overlap. Costpoint does not analyze schedules.

Discriminator vs Cognitus: no overlap.

Discriminator vs Dassian standalone: partial. Dassian's project management vertical carries earned value, control accounts, and a Primavera bridge. If the client needs contractual EVMS, position Dassian plus Tesseract XPM and do not bring this. This is the diagnostic for a development schedule with no EVMS discipline and no time to acquire one.

Discriminator vs Primavera and Microsoft Project: those are systems of record with schedulers attached. This is a consultant's analyzer. Do not let the conversation become a feature comparison; it will lose. The pitch is: your schedule is a spreadsheet, and by tomorrow morning I will tell you what is wrong with it.
