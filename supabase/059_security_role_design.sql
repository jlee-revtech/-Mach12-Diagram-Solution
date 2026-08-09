-- ═══════════════════════════════════════════════════════════
-- 059: Security role design on process_roles.
-- Extends process_roles into SAP security-role designs (single/derived/composite
-- Z*/Y* PFCG roles), adds per-role SAP access items (Fiori tiles, transactions,
-- programs, tables, auth objects), composite membership, and AI-assignment
-- provenance on persona_roles.
--
-- SAFE / NON-DESTRUCTIVE: create-if-not-exists + add-column-if-not-exists.
-- ═══════════════════════════════════════════════════════════

alter table process_roles add column if not exists sap_role_name text;
alter table process_roles add column if not exists role_type text not null default 'single'
  check (role_type in ('single','derived','composite'));
alter table process_roles add column if not exists derived_from text;
alter table process_roles add column if not exists org_levels text;

-- Per-role SAP access items (what the role grants)
create table if not exists process_role_access (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  role_id uuid not null references process_roles(id) on delete cascade,
  access_type text not null check (access_type in ('fiori_tile','transaction','program','table','auth_object')),
  value text not null,
  title text,
  fiori_app_id text,
  source text not null default 'manual' check (source in ('manual','ai')),
  note text,
  created_at timestamptz default now(),
  unique (role_id, access_type, value)
);

-- Composite role membership (composite → member single/derived roles)
create table if not exists process_role_members (
  id uuid primary key default gen_random_uuid(),
  composite_role_id uuid not null references process_roles(id) on delete cascade,
  member_role_id uuid not null references process_roles(id) on delete cascade,
  created_at timestamptz default now(),
  unique (composite_role_id, member_role_id),
  check (composite_role_id <> member_role_id)
);

-- AI-assignment provenance on persona ↔ role links
alter table persona_roles add column if not exists source text not null default 'manual'
  check (source in ('manual','ai'));
alter table persona_roles add column if not exists confidence numeric;
alter table persona_roles add column if not exists rationale text;

create index if not exists idx_process_role_access_org on process_role_access(organization_id);
create index if not exists idx_process_role_access_role on process_role_access(role_id);
create index if not exists idx_process_role_members_composite on process_role_members(composite_role_id);
create index if not exists idx_process_role_members_member on process_role_members(member_role_id);

alter table process_role_access enable row level security;
alter table process_role_members enable row level security;

do $$ begin
  -- process_role_access: org members CRUD (org resolved via organization_id)
  if not exists (select 1 from pg_policies where tablename='process_role_access' and policyname='Org members can view process_role_access') then
    create policy "Org members can view process_role_access" on process_role_access for select
      using (organization_id in (select organization_id from profiles where id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename='process_role_access' and policyname='Org members can manage process_role_access') then
    create policy "Org members can manage process_role_access" on process_role_access for all
      using (organization_id in (select organization_id from profiles where id = auth.uid()))
      with check (organization_id in (select organization_id from profiles where id = auth.uid()));
  end if;

  -- process_role_members: access via the composite role's org
  if not exists (select 1 from pg_policies where tablename='process_role_members' and policyname='Org members can view process_role_members') then
    create policy "Org members can view process_role_members" on process_role_members for select
      using (composite_role_id in (select id from process_roles where organization_id in (select organization_id from profiles where id = auth.uid())));
  end if;
  if not exists (select 1 from pg_policies where tablename='process_role_members' and policyname='Org members can manage process_role_members') then
    create policy "Org members can manage process_role_members" on process_role_members for all
      using (composite_role_id in (select id from process_roles where organization_id in (select organization_id from profiles where id = auth.uid())));
  end if;
end $$;
