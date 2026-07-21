-- ═══════════════════════════════════════════════════════════
-- Mach12.ai — Workshop Archetype
-- workshops.archetype: the workshop's shape.
--   'decision'   (default) — Key Design Decision: decision analysis and
--                 recommendation per workstream + cross-workstream evaluation.
--   'assessment' — Assessment / Discovery: conversational current-state
--                 assessment driven to assessment questions, discovery
--                 questions (pain points), process / data / technology
--                 opportunities, and an AI-sequenced Opportunity Roadmap.
-- Existing workshops keep 'decision' (today's behavior).
--
-- Section kinds are free text on workshop_agenda_items.section_kind; the
-- assessment archetype introduces 'assessment' (per workstream) and 'roadmap'
-- (final synthesis) alongside overview / workstream / evaluation. No enum change.
--
-- SAFE / NON-DESTRUCTIVE: add-if-not-exists only. Re-running is safe.
-- ═══════════════════════════════════════════════════════════

alter table workshops add column if not exists archetype text not null default 'decision';
