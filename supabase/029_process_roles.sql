-- ═══════════════════════════════════════════════════════════
-- Mach12.ai — Process Studio Persona Catalog
-- Persona → Roles, many-to-many (a persona is made up of multiple roles; a
-- role can belong to multiple personas). A role can be instantiated as a
-- swimlane in a process model (process_node_lanes.role_id).
--
-- Personas reuse the existing org-scoped `personas` table. Roles are new.
-- SAFE / NON-DESTRUCTIVE: create-if-not-exists + add-column-if-not-exists.
-- ═══════════════════════════════════════════════════════════

create table if not exists process_roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  description text,
  color text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Many-to-many persona ↔ role
create table if not exists persona_roles (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null references personas(id) on delete cascade,
  role_id uuid not null references process_roles(id) on delete cascade,
  created_at timestamptz default now(),
  unique (persona_id, role_id)
);

-- A lane can represent a role
alter table process_node_lanes add column if not exists role_id uuid references process_roles(id) on delete set null;

create index if not exists idx_process_roles_org on process_roles(organization_id);
create index if not exists idx_persona_roles_persona on persona_roles(persona_id);
create index if not exists idx_persona_roles_role on persona_roles(role_id);

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'process_roles_updated_at') then
    create trigger process_roles_updated_at before update on process_roles
      for each row execute function update_updated_at();
  end if;
end $$;

alter table process_roles enable row level security;
alter table persona_roles enable row level security;

do $$ begin
  -- process_roles: org members CRUD
  if not exists (select 1 from pg_policies where tablename='process_roles' and policyname='Org members can view process_roles') then
    create policy "Org members can view process_roles" on process_roles for select
      using (organization_id in (select organization_id from profiles where id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename='process_roles' and policyname='Org members can manage process_roles') then
    create policy "Org members can manage process_roles" on process_roles for all
      using (organization_id in (select organization_id from profiles where id = auth.uid()))
      with check (organization_id in (select organization_id from profiles where id = auth.uid()));
  end if;

  -- persona_roles: access via the persona's org
  if not exists (select 1 from pg_policies where tablename='persona_roles' and policyname='Org members can view persona_roles') then
    create policy "Org members can view persona_roles" on persona_roles for select
      using (persona_id in (select id from personas where organization_id in (select organization_id from profiles where id = auth.uid())));
  end if;
  if not exists (select 1 from pg_policies where tablename='persona_roles' and policyname='Org members can manage persona_roles') then
    create policy "Org members can manage persona_roles" on persona_roles for all
      using (persona_id in (select id from personas where organization_id in (select organization_id from profiles where id = auth.uid())));
  end if;

  -- public read of roles for orgs with shared process models (lane labels on share pages)
  if not exists (select 1 from pg_policies where tablename='process_roles' and policyname='shared_process_roles_anon_read') then
    create policy shared_process_roles_anon_read on process_roles for select
      using (organization_id in (select organization_id from process_model_shares where (expires_at is null or expires_at > now())));
  end if;
end $$;
