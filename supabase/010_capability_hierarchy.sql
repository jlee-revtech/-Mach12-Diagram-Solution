-- ═══════════════════════════════════════════════════════════
-- Capability Hierarchy + Reusable Templates
-- Adds parent_id, level, color to capabilities for
-- L1 (Core Area) → L2 (Capability) → L3 (Functionality/SIPOC)
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ═══════════════════════════════════════════════════════════

-- Hierarchy fields
alter table capabilities add column if not exists parent_id uuid references capabilities(id) on delete cascade default null;
alter table capabilities add column if not exists level integer default 3;
alter table capabilities add column if not exists color text default null;

create index if not exists idx_capabilities_parent on capabilities(parent_id);

-- Reusable capability templates
create table if not exists capability_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  description text,
  created_by uuid references profiles(id),
  template_data jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_capability_templates_org on capability_templates(organization_id);

create trigger capability_templates_updated_at
  before update on capability_templates
  for each row execute function update_updated_at();

alter table capability_templates enable row level security;

create policy "Org members can view capability_templates"
  on capability_templates for select
  using (organization_id in (select organization_id from profiles where id = auth.uid()));

create policy "Org members can create capability_templates"
  on capability_templates for insert
  with check (organization_id in (select organization_id from profiles where id = auth.uid()));

create policy "Org members can update capability_templates"
  on capability_templates for update
  using (organization_id in (select organization_id from profiles where id = auth.uid()));

create policy "Org members can delete capability_templates"
  on capability_templates for delete
  using (organization_id in (select organization_id from profiles where id = auth.uid()));
