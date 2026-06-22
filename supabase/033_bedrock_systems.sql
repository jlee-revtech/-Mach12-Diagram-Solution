-- ═══════════════════════════════════════════════════════════
-- Mach12.ai — Bedrock Data Integrations
--   bedrock_systems            : per-org catalog of Logical Bedrock Systems.
--                                One row per SYSTEM_TEMPLATES category (system_type).
--                                This is the org's best-of-breed platform architecture.
--   bedrock_physical_systems   : physical platforms assigned to a logical system
--                                (e.g. ERP -> SAP S/4HANA, Oracle EBS).
--   diagrams.diagram_kind            : 'architecture' (default) | 'bedrock_integration'
--   diagrams.source_process_model_id : lineage for Regenerate-from-BPML.
--
-- The 19 logical systems are seeded client-side from the Systems palette
-- (src/lib/supabase/bedrock-systems.ts) so it runs under the user's RLS — no
-- service role needed. Mirrors the workstreams seed pattern (030).
--
-- SAFE / NON-DESTRUCTIVE: create-if-not-exists + add-column-if-not-exists.
-- ═══════════════════════════════════════════════════════════

create table if not exists bedrock_systems (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  system_type text not null,                 -- one of the 19 SystemType slugs
  label text not null,                       -- editable display label (default from template)
  description text,
  color text,
  sort_order int default 0,
  workstream_id uuid references workstreams(id) on delete set null,
  is_standard boolean default false,         -- true for the 19 seeded categories
  archived_at timestamptz,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (organization_id, system_type)      -- one logical row per category per org
);

create index if not exists idx_bedrock_systems_org on bedrock_systems(organization_id);

create table if not exists bedrock_physical_systems (
  id uuid primary key default gen_random_uuid(),
  bedrock_system_id uuid not null references bedrock_systems(id) on delete cascade,
  name text not null,                        -- e.g. 'SAP S/4HANA'
  vendor text,                               -- e.g. 'SAP'
  is_primary boolean default false,          -- the org's best-of-breed pick
  sort_order int default 0,
  created_at timestamptz default now()
);

create index if not exists idx_bedrock_physical_parent on bedrock_physical_systems(bedrock_system_id);

-- Distinguish AI-generated bedrock integration diagrams from hand-drawn ones,
-- and record their source process model for Regenerate-from-BPML.
alter table diagrams add column if not exists diagram_kind text not null default 'architecture';
alter table diagrams add column if not exists source_process_model_id uuid references process_models(id) on delete set null;
create index if not exists idx_diagrams_source_model on diagrams(source_process_model_id);

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'bedrock_systems_updated_at') then
    create trigger bedrock_systems_updated_at before update on bedrock_systems
      for each row execute function update_updated_at();
  end if;
end $$;

alter table bedrock_systems enable row level security;
alter table bedrock_physical_systems enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='bedrock_systems' and policyname='Org members can view bedrock_systems') then
    create policy "Org members can view bedrock_systems" on bedrock_systems for select
      using (organization_id in (select organization_id from profiles where id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename='bedrock_systems' and policyname='Org members can manage bedrock_systems') then
    create policy "Org members can manage bedrock_systems" on bedrock_systems for all
      using (organization_id in (select organization_id from profiles where id = auth.uid()))
      with check (organization_id in (select organization_id from profiles where id = auth.uid()));
  end if;

  if not exists (select 1 from pg_policies where tablename='bedrock_physical_systems' and policyname='Org members can view bedrock_physical_systems') then
    create policy "Org members can view bedrock_physical_systems" on bedrock_physical_systems for select
      using (bedrock_system_id in (
        select id from bedrock_systems
        where organization_id in (select organization_id from profiles where id = auth.uid())));
  end if;
  if not exists (select 1 from pg_policies where tablename='bedrock_physical_systems' and policyname='Org members can manage bedrock_physical_systems') then
    create policy "Org members can manage bedrock_physical_systems" on bedrock_physical_systems for all
      using (bedrock_system_id in (
        select id from bedrock_systems
        where organization_id in (select organization_id from profiles where id = auth.uid())))
      with check (bedrock_system_id in (
        select id from bedrock_systems
        where organization_id in (select organization_id from profiles where id = auth.uid())));
  end if;
end $$;
