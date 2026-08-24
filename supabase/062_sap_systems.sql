-- ═══════════════════════════════════════════════════════════
-- SAP system registry + pulled org-model snapshots.
--
-- Solution Architecture Studio can now hook into SAP systems the way SAP
-- Solution Studio does, and pull the organizational model out of them directly
-- instead of rendering a snapshot committed into the repo.
--
-- Two tables:
--   sap_systems         org-scoped registry of the systems a team can reach.
--                       Connection METADATA only - never a password. Direct-mode
--                       credentials live in an encrypted per-browser cookie;
--                       bridge-mode systems carry no credentials at all.
--   sap_org_snapshots   each pull, stored whole as jsonb, with provenance. Keeping
--                       every pull is the point: two systems side by side, and a
--                       real "what changed since the last pull" diff.
--
-- Org-scoped RLS mirroring the other Studio tables. Additive / non-destructive.
-- ═══════════════════════════════════════════════════════════

create table if not exists sap_systems (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  -- 'direct'  = this app opens an HTTPS ADT session straight at host:port
  -- 'bridge'  = ADT reads are relayed through SAP Solution Studio on CF, which
  --             holds the BTP destination / Cloud Connector route
  mode text not null default 'direct' check (mode in ('direct', 'bridge')),
  -- direct-mode coordinates (null for bridge)
  host text,
  port integer,
  use_ssl boolean not null default true,
  client text,
  language text default 'EN',
  -- default logon user; the password is NEVER stored here
  username text,
  -- bridge-mode: the destination name Solution Studio should route to
  destination_name text,
  -- optional pin so a pull defaults to the right controlling area
  default_controlling_area text,
  description text,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_sap_systems_org on sap_systems(organization_id, name);

create table if not exists sap_org_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  system_id uuid references sap_systems(id) on delete set null,
  -- denormalized so a snapshot still reads correctly after its system is removed
  system_label text not null,
  sap_client text,
  controlling_area text not null,
  -- 'freestyle' (portable ADT SQL) | 'classrun' (ZCL_M12_ORG_MODEL_DUMP fast path)
  pulled_via text not null default 'freestyle',
  pulled_by uuid references profiles(id),
  pulled_at timestamptz default now(),
  -- the whole SapEnterpriseModel, exactly the shape the canvas already renders
  model jsonb not null,
  -- per-read diagnostics: which table reads succeeded, row counts, what was capped
  diagnostics jsonb not null default '[]'::jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_sap_snapshots_org on sap_org_snapshots(organization_id, pulled_at desc);
create index if not exists idx_sap_snapshots_system on sap_org_snapshots(system_id, pulled_at desc);

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'sap_systems_updated_at') then
    create trigger sap_systems_updated_at before update on sap_systems
      for each row execute function update_updated_at();
  end if;
end $$;

alter table sap_systems enable row level security;
alter table sap_org_snapshots enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='sap_systems' and policyname='Org members can view sap systems') then
    create policy "Org members can view sap systems" on sap_systems for select
      using (organization_id in (select organization_id from profiles where id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename='sap_systems' and policyname='Org members can manage sap systems') then
    create policy "Org members can manage sap systems" on sap_systems for all
      using (organization_id in (select organization_id from profiles where id = auth.uid()))
      with check (organization_id in (select organization_id from profiles where id = auth.uid()));
  end if;

  if not exists (select 1 from pg_policies where tablename='sap_org_snapshots' and policyname='Org members can view sap snapshots') then
    create policy "Org members can view sap snapshots" on sap_org_snapshots for select
      using (organization_id in (select organization_id from profiles where id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename='sap_org_snapshots' and policyname='Org members can manage sap snapshots') then
    create policy "Org members can manage sap snapshots" on sap_org_snapshots for all
      using (organization_id in (select organization_id from profiles where id = auth.uid()))
      with check (organization_id in (select organization_id from profiles where id = auth.uid()));
  end if;
end $$;
