-- ═══════════════════════════════════════════════════════════
-- Mach12.ai — Capability Map (capability → system realization)
--   cm_capabilities         : org-scoped business/application capabilities
--   cm_capability_systems   : maps a capability to a Logical Bedrock System
--                             (bedrock_systems) OR a Physical System
--                             (bedrock_physical_systems). Exactly one per row.
--
-- Distinct from the SIPOC capability_maps/capabilities tables. The "systems"
-- universe is the bedrock catalog from migration 033.
--
-- SAFE / NON-DESTRUCTIVE: create-if-not-exists.
-- ═══════════════════════════════════════════════════════════

create table if not exists cm_capabilities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  description text,
  domain text,                               -- grouping, e.g. 'Finance', 'Supply Chain'
  color text,
  sort_order int default 0,
  source text default 'manual',              -- 'manual' | 'ai'
  archived_at timestamptz,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_cm_capabilities_org on cm_capabilities(organization_id);

create table if not exists cm_capability_systems (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  capability_id uuid not null references cm_capabilities(id) on delete cascade,
  bedrock_system_id uuid references bedrock_systems(id) on delete cascade,
  physical_system_id uuid references bedrock_physical_systems(id) on delete cascade,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  -- exactly one of (logical, physical) is set
  constraint cm_capability_systems_one_target check (
    (bedrock_system_id is not null)::int + (physical_system_id is not null)::int = 1
  )
);

create index if not exists idx_cm_capsys_cap on cm_capability_systems(capability_id);
create index if not exists idx_cm_capsys_org on cm_capability_systems(organization_id);
-- prevent duplicate mappings
create unique index if not exists uq_cm_capsys_logical on cm_capability_systems(capability_id, bedrock_system_id) where bedrock_system_id is not null;
create unique index if not exists uq_cm_capsys_physical on cm_capability_systems(capability_id, physical_system_id) where physical_system_id is not null;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'cm_capabilities_updated_at') then
    create trigger cm_capabilities_updated_at before update on cm_capabilities
      for each row execute function update_updated_at();
  end if;
end $$;

alter table cm_capabilities enable row level security;
alter table cm_capability_systems enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='cm_capabilities' and policyname='Org members can view cm_capabilities') then
    create policy "Org members can view cm_capabilities" on cm_capabilities for select
      using (organization_id in (select organization_id from profiles where id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename='cm_capabilities' and policyname='Org members can manage cm_capabilities') then
    create policy "Org members can manage cm_capabilities" on cm_capabilities for all
      using (organization_id in (select organization_id from profiles where id = auth.uid()))
      with check (organization_id in (select organization_id from profiles where id = auth.uid()));
  end if;

  if not exists (select 1 from pg_policies where tablename='cm_capability_systems' and policyname='Org members can view cm_capability_systems') then
    create policy "Org members can view cm_capability_systems" on cm_capability_systems for select
      using (organization_id in (select organization_id from profiles where id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename='cm_capability_systems' and policyname='Org members can manage cm_capability_systems') then
    create policy "Org members can manage cm_capability_systems" on cm_capability_systems for all
      using (organization_id in (select organization_id from profiles where id = auth.uid()))
      with check (organization_id in (select organization_id from profiles where id = auth.uid()));
  end if;
end $$;
