-- ═══════════════════════════════════════════════════════════
-- Reusable System Data Elements (org-scoped) attachable to
-- Information Products. Typed in once, reusable across IPs.
--
-- SAFE / NON-DESTRUCTIVE:
--   * create table if not exists
--   * add column if not exists (defaults to '{}')
-- ═══════════════════════════════════════════════════════════

create table if not exists system_data_elements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (organization_id, name)
);

create index if not exists idx_sde_org on system_data_elements(organization_id);

alter table system_data_elements enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'system_data_elements' and policyname = 'sde_org_members_all') then
    create policy sde_org_members_all on system_data_elements
      for all
      using (
        organization_id in (
          select organization_id from org_members where user_id = auth.uid()
        )
      )
      with check (
        organization_id in (
          select organization_id from org_members where user_id = auth.uid()
        )
      );
  end if;
end $$;

alter table information_products
  add column if not exists data_element_ids uuid[] default '{}';
