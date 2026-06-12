-- ═══════════════════════════════════════════════════════════
-- Mach12.ai — Process Studio reference library (SHARED SEED)
-- A curated, A&D-tailored best-practice process catalog modeled on
-- SAP value-chain structure (Scenario → Process Group → Process → Step).
--
-- RLS DEVIATION (intentional): these tables are GLOBAL — they have NO
-- organization_id. Every authenticated org reads the same catalog.
-- Reads are public (select using true); there is NO write policy, so with
-- RLS enabled only the service_role / postgres role (which bypasses RLS)
-- can seed or revise the catalog. Orgs never mutate the seed — they
-- INSTANTIATE a scenario into an editable, org-scoped process_models row
-- (process_models.source_reference_id records lineage).
--
-- Versioning: never mutate a published library in place. To revise, insert
-- a new process_reference_libraries row with a bumped version and re-seed;
-- flip is_active to switch the browser to it.
--
-- SAFE / NON-DESTRUCTIVE: create-if-not-exists only.
-- ═══════════════════════════════════════════════════════════

create table if not exists process_reference_libraries (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  version text not null,
  source text default 'curated',          -- 'curated' | 'signavio-import' | 'ai-bootstrapped'
  published_at timestamptz default now(),
  is_active boolean default true
);

create table if not exists process_reference_scenarios (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null references process_reference_libraries(id) on delete cascade,
  parent_id uuid references process_reference_scenarios(id) on delete cascade default null,
  level integer not null,                  -- 1=Scenario, 2=Process Group, 3=Process (leaf)
  node_kind text not null,                 -- 'scenario' | 'process_group' | 'process'
  name text not null,
  description text,
  scope_item_ref text,                     -- SAP best-practice scope-item code (string only)
  sort_order integer default 0,
  graph_data jsonb default null            -- optional pre-built BPMN leaf for a reference process
);

create table if not exists process_reference_overlays (
  id uuid primary key default gen_random_uuid(),
  reference_scenario_id uuid not null references process_reference_scenarios(id) on delete cascade,
  overlay_kind text not null,              -- 'control'|'variant'|'accelerator'|'kpi'|'scope_item'|'compliance'
  payload jsonb not null default '{}',
  sort_order integer default 0
);

create index if not exists idx_ref_scenarios_library on process_reference_scenarios(library_id);
create index if not exists idx_ref_scenarios_parent on process_reference_scenarios(parent_id);
create index if not exists idx_ref_overlays_scenario on process_reference_overlays(reference_scenario_id);

alter table process_reference_libraries enable row level security;
alter table process_reference_scenarios enable row level security;
alter table process_reference_overlays enable row level security;

-- Public read of the curated catalog; NO write policy (service-role only writes).
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'process_reference_libraries' and policyname = 'ref_libraries_read_all') then
    create policy ref_libraries_read_all on process_reference_libraries for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'process_reference_scenarios' and policyname = 'ref_scenarios_read_all') then
    create policy ref_scenarios_read_all on process_reference_scenarios for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'process_reference_overlays' and policyname = 'ref_overlays_read_all') then
    create policy ref_overlays_read_all on process_reference_overlays for select using (true);
  end if;
end $$;
