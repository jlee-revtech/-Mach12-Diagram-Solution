-- ═══════════════════════════════════════════════════════════
-- Reusable System Group Templates
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

create table if not exists group_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  description text,
  created_by uuid references profiles(id),
  template_data jsonb not null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_group_templates_org on group_templates(organization_id);

alter table group_templates enable row level security;

-- Org members can view templates
create policy "Org members can view group templates"
  on group_templates for select
  using (
    organization_id in (
      select organization_id from org_members where user_id = auth.uid()
    )
  );

-- Org members can create templates
create policy "Org members can create group templates"
  on group_templates for insert
  with check (
    organization_id in (
      select organization_id from org_members where user_id = auth.uid()
    )
  );

-- Creators can update their templates
create policy "Creators can update group templates"
  on group_templates for update
  using (created_by = auth.uid());

-- Creators can delete their templates
create policy "Creators can delete group templates"
  on group_templates for delete
  using (created_by = auth.uid());
