-- ═══════════════════════════════════════════════════════════
-- Mach12.ai — Workshop Facilitation Content (Phase 1 data model)
-- Adds the facilitation-content authoring layer that sits between the
-- Workshop Brief and the Live transcript:
--   (11) workshops.duration_minutes — facilitator sets total length
--   (8)  workshop_agenda_items.section_kind + workstream_code — classify agenda
--   per-section content: workshop_agenda_content (one row per agenda item),
--        storing the semantic SectionContent jsonb + clarifying questions + KB gaps.
--
-- Slides are DERIVED from this content (buildFacilitationDeck in agent-core);
-- this table is the single source of truth for section content.
--
-- Run this in Supabase SQL Editor or via scripts/apply-migration.mjs.
-- SAFE / NON-DESTRUCTIVE: add-if-not-exists only. Re-running is safe.
-- ═══════════════════════════════════════════════════════════

-- ─── (11) total workshop length ─────────────────────────────
alter table workshops add column if not exists duration_minutes int;

-- ─── (8) classify agenda items ──────────────────────────────
alter table workshop_agenda_items add column if not exists section_kind text;    -- overview | workstream | evaluation
alter table workshop_agenda_items add column if not exists workstream_code text;

-- ─── per-section facilitation content ───────────────────────
create table if not exists workshop_agenda_content (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references workshops(id) on delete cascade,
  agenda_item_id uuid not null references workshop_agenda_items(id) on delete cascade,
  section_kind text not null,                 -- overview | workstream | evaluation
  content jsonb,                              -- SectionContent (loosely typed in DB)
  clarifying_questions jsonb default '[]'::jsonb,
  kb_gaps jsonb default '[]'::jsonb,
  status text not null default 'empty',       -- empty | generating | draft | needs_input | final
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agenda_item_id)
);

create index if not exists idx_ws_content_workshop on workshop_agenda_content(workshop_id);

-- ─── updated_at trigger (mirror 040 style) ──────────────────
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'ws_content_updated_at') then
    create trigger ws_content_updated_at before update on workshop_agenda_content
      for each row execute function update_updated_at();
  end if;
end $$;

-- ─── RLS ────────────────────────────────────────────────────
alter table workshop_agenda_content enable row level security;

-- Mirror the 040 child-table pattern exactly: org membership via the parent
-- workshop. A `for select` view policy + a `for all` manage policy (covering
-- INSERT/UPDATE/DELETE) using the same
--   workshop_id in (select id from workshops where organization_id in
--     (select organization_id from profiles where id = auth.uid()))
-- USING / WITH CHECK shape used for workshop_agenda_items et al.
do $$ begin
  if not exists (select 1 from pg_policies where tablename='workshop_agenda_content' and policyname='Org members can view workshop_agenda_content') then
    create policy "Org members can view workshop_agenda_content" on workshop_agenda_content for select
      using (workshop_id in (select id from workshops where organization_id in (select organization_id from profiles where id = auth.uid())));
  end if;
  if not exists (select 1 from pg_policies where tablename='workshop_agenda_content' and policyname='Org members can manage workshop_agenda_content') then
    create policy "Org members can manage workshop_agenda_content" on workshop_agenda_content for all
      using (workshop_id in (select id from workshops where organization_id in (select organization_id from profiles where id = auth.uid())))
      with check (workshop_id in (select id from workshops where organization_id in (select organization_id from profiles where id = auth.uid())));
  end if;
end $$;
