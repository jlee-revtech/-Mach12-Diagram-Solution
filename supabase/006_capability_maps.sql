-- ═══════════════════════════════════════════════════════════
-- Mach12.ai — SIPOC Capability Mapping
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ═══════════════════════════════════════════════════════════

-- ─── Personas (org-scoped, reusable across maps) ────────
create table if not exists personas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  role text,
  description text,
  color text default '#6366F1',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── Information Products (org-scoped, reusable) ────────
create table if not exists information_products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  description text,
  category text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── Logical Systems (org-scoped, reusable) ─────────────
create table if not exists logical_systems (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  system_type text,
  description text,
  color text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── Capability Maps (top-level container) ──────────────
create table if not exists capability_maps (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  title text not null default 'Untitled Capability Map',
  description text,
  created_by uuid references profiles(id),
  updated_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  archived_at timestamptz default null
);

-- ─── Capabilities (the "P" in SIPOC — L3 BPML) ─────────
create table if not exists capabilities (
  id uuid primary key default gen_random_uuid(),
  capability_map_id uuid not null references capability_maps(id) on delete cascade,
  name text not null,
  description text,
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── Capability Inputs (I in SIPOC) ─────────────────────
-- Links a capability to an input information product
-- supplier_persona_ids: personas who supply this input (S in SIPOC)
-- source_system_ids: logical systems this input comes from
create table if not exists capability_inputs (
  id uuid primary key default gen_random_uuid(),
  capability_id uuid not null references capabilities(id) on delete cascade,
  information_product_id uuid not null references information_products(id) on delete cascade,
  supplier_persona_ids jsonb default '[]',
  source_system_ids jsonb default '[]',
  sort_order integer default 0,
  created_at timestamptz default now()
);

-- ─── Capability Outputs (O in SIPOC) ────────────────────
-- Links a capability to an output information product
-- consumer_persona_ids: personas who consume this output (C in SIPOC)
create table if not exists capability_outputs (
  id uuid primary key default gen_random_uuid(),
  capability_id uuid not null references capabilities(id) on delete cascade,
  information_product_id uuid not null references information_products(id) on delete cascade,
  consumer_persona_ids jsonb default '[]',
  sort_order integer default 0,
  created_at timestamptz default now()
);

-- ─── Indexes ────────────────────────────────────────────
create index if not exists idx_personas_org on personas(organization_id);
create index if not exists idx_info_products_org on information_products(organization_id);
create index if not exists idx_logical_systems_org on logical_systems(organization_id);
create index if not exists idx_capability_maps_org on capability_maps(organization_id);
create index if not exists idx_capability_maps_archived on capability_maps(archived_at);
create index if not exists idx_capabilities_map on capabilities(capability_map_id);
create index if not exists idx_capability_inputs_cap on capability_inputs(capability_id);
create index if not exists idx_capability_outputs_cap on capability_outputs(capability_id);

-- ─── Auto-update updated_at triggers ────────────────────
create trigger capability_maps_updated_at
  before update on capability_maps
  for each row execute function update_updated_at();

create trigger capabilities_updated_at
  before update on capabilities
  for each row execute function update_updated_at();

create trigger personas_updated_at
  before update on personas
  for each row execute function update_updated_at();

create trigger information_products_updated_at
  before update on information_products
  for each row execute function update_updated_at();

create trigger logical_systems_updated_at
  before update on logical_systems
  for each row execute function update_updated_at();

-- ═══════════════════════════════════════════════════════════
-- Row Level Security (RLS)
-- ═══════════════════════════════════════════════════════════

alter table personas enable row level security;
alter table information_products enable row level security;
alter table logical_systems enable row level security;
alter table capability_maps enable row level security;
alter table capabilities enable row level security;
alter table capability_inputs enable row level security;
alter table capability_outputs enable row level security;

-- ─── Personas: org members CRUD ─────────────────────────
create policy "Org members can view personas"
  on personas for select
  using (organization_id in (select organization_id from profiles where id = auth.uid()));

create policy "Org members can create personas"
  on personas for insert
  with check (organization_id in (select organization_id from profiles where id = auth.uid()));

create policy "Org members can update personas"
  on personas for update
  using (organization_id in (select organization_id from profiles where id = auth.uid()));

create policy "Org members can delete personas"
  on personas for delete
  using (organization_id in (select organization_id from profiles where id = auth.uid()));

-- ─── Information Products: org members CRUD ─────────────
create policy "Org members can view information_products"
  on information_products for select
  using (organization_id in (select organization_id from profiles where id = auth.uid()));

create policy "Org members can create information_products"
  on information_products for insert
  with check (organization_id in (select organization_id from profiles where id = auth.uid()));

create policy "Org members can update information_products"
  on information_products for update
  using (organization_id in (select organization_id from profiles where id = auth.uid()));

create policy "Org members can delete information_products"
  on information_products for delete
  using (organization_id in (select organization_id from profiles where id = auth.uid()));

-- ─── Logical Systems: org members CRUD ──────────────────
create policy "Org members can view logical_systems"
  on logical_systems for select
  using (organization_id in (select organization_id from profiles where id = auth.uid()));

create policy "Org members can create logical_systems"
  on logical_systems for insert
  with check (organization_id in (select organization_id from profiles where id = auth.uid()));

create policy "Org members can update logical_systems"
  on logical_systems for update
  using (organization_id in (select organization_id from profiles where id = auth.uid()));

create policy "Org members can delete logical_systems"
  on logical_systems for delete
  using (organization_id in (select organization_id from profiles where id = auth.uid()));

-- ─── Capability Maps: org members read, creators write ──
create policy "Org members can view capability_maps"
  on capability_maps for select
  using (organization_id in (select organization_id from profiles where id = auth.uid()));

create policy "Org members can create capability_maps"
  on capability_maps for insert
  with check (organization_id in (select organization_id from profiles where id = auth.uid()));

create policy "Creators can update capability_maps"
  on capability_maps for update
  using (
    created_by = auth.uid()
    or organization_id in (
      select organization_id from profiles where id = auth.uid() and role = 'admin'
    )
  );

create policy "Creators can delete capability_maps"
  on capability_maps for delete
  using (
    created_by = auth.uid()
    or organization_id in (
      select organization_id from profiles where id = auth.uid() and role = 'admin'
    )
  );

-- ─── Capabilities: access via parent map ────────────────
create policy "Users can view capabilities"
  on capabilities for select
  using (
    capability_map_id in (
      select id from capability_maps
      where organization_id in (select organization_id from profiles where id = auth.uid())
    )
  );

create policy "Users can create capabilities"
  on capabilities for insert
  with check (
    capability_map_id in (
      select id from capability_maps
      where organization_id in (select organization_id from profiles where id = auth.uid())
    )
  );

create policy "Users can update capabilities"
  on capabilities for update
  using (
    capability_map_id in (
      select id from capability_maps
      where organization_id in (select organization_id from profiles where id = auth.uid())
    )
  );

create policy "Users can delete capabilities"
  on capabilities for delete
  using (
    capability_map_id in (
      select id from capability_maps
      where organization_id in (select organization_id from profiles where id = auth.uid())
    )
  );

-- ─── Capability Inputs: access via parent capability ────
create policy "Users can view capability_inputs"
  on capability_inputs for select
  using (
    capability_id in (
      select c.id from capabilities c
      join capability_maps cm on cm.id = c.capability_map_id
      where cm.organization_id in (select organization_id from profiles where id = auth.uid())
    )
  );

create policy "Users can manage capability_inputs"
  on capability_inputs for all
  using (
    capability_id in (
      select c.id from capabilities c
      join capability_maps cm on cm.id = c.capability_map_id
      where cm.organization_id in (select organization_id from profiles where id = auth.uid())
    )
  );

-- ─── Capability Outputs: access via parent capability ───
create policy "Users can view capability_outputs"
  on capability_outputs for select
  using (
    capability_id in (
      select c.id from capabilities c
      join capability_maps cm on cm.id = c.capability_map_id
      where cm.organization_id in (select organization_id from profiles where id = auth.uid())
    )
  );

create policy "Users can manage capability_outputs"
  on capability_outputs for all
  using (
    capability_id in (
      select c.id from capabilities c
      join capability_maps cm on cm.id = c.capability_map_id
      where cm.organization_id in (select organization_id from profiles where id = auth.uid())
    )
  );
