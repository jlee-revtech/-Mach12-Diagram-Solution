-- ═══════════════════════════════════════════════════════════
-- Mach12.ai — Workstreams (value-stream alignment)
-- An org-scoped catalog of value streams. Every pillar entity (process,
-- persona, role, data element, information product, logical system, capability,
-- diagram) aligns to a workstream via a "home" workstream_id (added in 031).
--
-- The 10 standard workstreams are seeded from the A&D value streams that ship
-- in Process Studio's reference library (see scripts/seed-reference.mjs L1
-- scenarios). Seeding is client-side (src/lib/supabase/workstreams.ts) so it
-- runs under the user's RLS — no service role needed.
--
-- SAFE / NON-DESTRUCTIVE: create-if-not-exists.
-- ═══════════════════════════════════════════════════════════

create table if not exists workstreams (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  code text not null,                       -- canonical slug, e.g. 'source-to-pay'
  name text not null,
  description text,
  color text,                               -- accent hex, e.g. '#2563EB'
  icon text,                                -- icon key resolved in the UI
  sort_order int default 0,
  source_reference_scenario_id uuid references process_reference_scenarios(id) on delete set null,
  is_standard boolean default false,        -- true for the 10 seeded streams
  archived_at timestamptz,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (organization_id, code)
);

create index if not exists idx_workstreams_org on workstreams(organization_id);

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'workstreams_updated_at') then
    create trigger workstreams_updated_at before update on workstreams
      for each row execute function update_updated_at();
  end if;
end $$;

alter table workstreams enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='workstreams' and policyname='Org members can view workstreams') then
    create policy "Org members can view workstreams" on workstreams for select
      using (organization_id in (select organization_id from profiles where id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename='workstreams' and policyname='Org members can manage workstreams') then
    create policy "Org members can manage workstreams" on workstreams for all
      using (organization_id in (select organization_id from profiles where id = auth.uid()))
      with check (organization_id in (select organization_id from profiles where id = auth.uid()));
  end if;

  -- public read for orgs that have shared process models / capability maps
  -- (so shared/public views can render workstream chips)
  if not exists (select 1 from pg_policies where tablename='workstreams' and policyname='shared_workstreams_anon_read') then
    create policy shared_workstreams_anon_read on workstreams for select
      using (
        organization_id in (select organization_id from process_model_shares where (expires_at is null or expires_at > now()))
        or organization_id in (select organization_id from capability_map_shares where (expires_at is null or expires_at > now()))
      );
  end if;
end $$;
