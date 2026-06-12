-- ═══════════════════════════════════════════════════════════
-- Mach12.ai — Process Studio (third pillar)
-- Process models: a navigable value-chain hierarchy
--   L1 Scenario → L2 Process Group → L3 Process (leaf, owns a BPMN graph)
-- Leaf BPMN graph is a single jsonb blob on process_nodes.graph_data
--   (mirrors diagrams.canvas_data). Lanes are normalized out into
--   process_node_lanes so they can reference the org logical_systems pool.
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor).
-- SAFE / NON-DESTRUCTIVE: create-if-not-exists only.
-- ═══════════════════════════════════════════════════════════

-- ─── Process Models (top-level container, org-scoped) ───
create table if not exists process_models (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  title text not null default 'Untitled Process Model',
  description text,
  source_reference_id uuid,                 -- lineage: instantiated from process_reference_scenarios(id) (mig 023); no hard FK
  created_by uuid references profiles(id),
  updated_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  archived_at timestamptz default null
);

-- ─── Process Nodes (the value-chain hierarchy) ──────────
-- level: 1 = Scenario, 2 = Process Group, 3 = Process (leaf)
-- node_kind: 'scenario' | 'process_group' | 'process' (denormalized convenience)
-- Leaf-only fields (null/false on L1/L2):
--   is_leaf, graph_data (BPMN blob), sipoc_capability_id, scope_item_ref
create table if not exists process_nodes (
  id uuid primary key default gen_random_uuid(),
  process_model_id uuid not null references process_models(id) on delete cascade,
  parent_id uuid references process_nodes(id) on delete cascade default null,
  level integer default 1,
  node_kind text default 'scenario',
  name text not null,
  description text,
  color text default null,
  sort_order integer default 0,
  is_leaf boolean default false,
  graph_data jsonb default null,            -- { lanes, nodes, edges, viewport } — null until leaf editor opened
  sipoc_capability_id uuid references capabilities(id) on delete set null,
  scope_item_ref text,                      -- e.g. SAP best-practice scope-item code (string only, no licensed content)
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── Process Node Lanes (lane → logical_system map) ─────
-- The ONE thing pulled out of graph_data, because lanes reference the
-- org-scoped logical_systems pool (drives the data-diagram scaffold + reporting).
create table if not exists process_node_lanes (
  id uuid primary key default gen_random_uuid(),
  process_node_id uuid not null references process_nodes(id) on delete cascade,
  lane_key text not null,                   -- matches a lane id inside graph_data.lanes
  logical_system_id uuid references logical_systems(id) on delete set null,
  persona_id uuid references personas(id) on delete set null,
  label text,
  sort_order integer default 0,
  created_at timestamptz default now()
);

-- ─── Indexes ────────────────────────────────────────────
create index if not exists idx_process_models_org on process_models(organization_id);
create index if not exists idx_process_models_archived on process_models(archived_at);
create index if not exists idx_process_nodes_model on process_nodes(process_model_id);
create index if not exists idx_process_nodes_parent on process_nodes(parent_id);
create index if not exists idx_process_nodes_sipoc on process_nodes(sipoc_capability_id);
create index if not exists idx_process_node_lanes_node on process_node_lanes(process_node_id);

-- ─── Auto-update updated_at triggers ────────────────────
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'process_models_updated_at') then
    create trigger process_models_updated_at
      before update on process_models
      for each row execute function update_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'process_nodes_updated_at') then
    create trigger process_nodes_updated_at
      before update on process_nodes
      for each row execute function update_updated_at();
  end if;
end $$;

-- ═══════════════════════════════════════════════════════════
-- Row Level Security (RLS) — org-scoped via profiles, mirroring
-- 006_capability_maps.sql. Child tables resolve access by parent join.
-- ═══════════════════════════════════════════════════════════

alter table process_models enable row level security;
alter table process_nodes enable row level security;
alter table process_node_lanes enable row level security;

-- ─── Process Models: org members read, creators/admins write ──
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'process_models' and policyname = 'Org members can view process_models') then
    create policy "Org members can view process_models"
      on process_models for select
      using (organization_id in (select organization_id from profiles where id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'process_models' and policyname = 'Org members can create process_models') then
    create policy "Org members can create process_models"
      on process_models for insert
      with check (organization_id in (select organization_id from profiles where id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'process_models' and policyname = 'Creators can update process_models') then
    create policy "Creators can update process_models"
      on process_models for update
      using (
        created_by = auth.uid()
        or organization_id in (
          select organization_id from profiles where id = auth.uid() and role = 'admin'
        )
      );
  end if;
  if not exists (select 1 from pg_policies where tablename = 'process_models' and policyname = 'Creators can delete process_models') then
    create policy "Creators can delete process_models"
      on process_models for delete
      using (
        created_by = auth.uid()
        or organization_id in (
          select organization_id from profiles where id = auth.uid() and role = 'admin'
        )
      );
  end if;
end $$;

-- ─── Process Nodes: access via parent model ─────────────
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'process_nodes' and policyname = 'Users can view process_nodes') then
    create policy "Users can view process_nodes"
      on process_nodes for select
      using (
        process_model_id in (
          select id from process_models
          where organization_id in (select organization_id from profiles where id = auth.uid())
        )
      );
  end if;
  if not exists (select 1 from pg_policies where tablename = 'process_nodes' and policyname = 'Users can manage process_nodes') then
    create policy "Users can manage process_nodes"
      on process_nodes for all
      using (
        process_model_id in (
          select id from process_models
          where organization_id in (select organization_id from profiles where id = auth.uid())
        )
      )
      with check (
        process_model_id in (
          select id from process_models
          where organization_id in (select organization_id from profiles where id = auth.uid())
        )
      );
  end if;
end $$;

-- ─── Process Node Lanes: access via parent node → model ─
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'process_node_lanes' and policyname = 'Users can view process_node_lanes') then
    create policy "Users can view process_node_lanes"
      on process_node_lanes for select
      using (
        process_node_id in (
          select n.id from process_nodes n
          join process_models m on m.id = n.process_model_id
          where m.organization_id in (select organization_id from profiles where id = auth.uid())
        )
      );
  end if;
  if not exists (select 1 from pg_policies where tablename = 'process_node_lanes' and policyname = 'Users can manage process_node_lanes') then
    create policy "Users can manage process_node_lanes"
      on process_node_lanes for all
      using (
        process_node_id in (
          select n.id from process_nodes n
          join process_models m on m.id = n.process_model_id
          where m.organization_id in (select organization_id from profiles where id = auth.uid())
        )
      );
  end if;
end $$;
