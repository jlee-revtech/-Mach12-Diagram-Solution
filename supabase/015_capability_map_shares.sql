-- ═══════════════════════════════════════════════════════════
-- Read-only share links for Capability Maps
--
-- SAFE / NON-DESTRUCTIVE:
--   * create table if not exists
--   * create policy if not exists (wrapped in DO block)
--   * No drop / rename / update / delete statements
-- ═══════════════════════════════════════════════════════════

create table if not exists capability_map_shares (
  id uuid primary key default gen_random_uuid(),
  capability_map_id uuid not null references capability_maps(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  code text not null unique,
  created_by uuid references profiles(id),
  expires_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists idx_cap_map_shares_code on capability_map_shares(code);
create index if not exists idx_cap_map_shares_map on capability_map_shares(capability_map_id);

alter table capability_map_shares enable row level security;

-- Org members can manage shares; anyone (including anon) can SELECT to validate codes
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'capability_map_shares' and policyname = 'cap_map_shares_select_all') then
    create policy cap_map_shares_select_all on capability_map_shares
      for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'capability_map_shares' and policyname = 'cap_map_shares_org_manage') then
    create policy cap_map_shares_org_manage on capability_map_shares
      for all using (
        organization_id in (
          select organization_id from org_members where user_id = auth.uid()
        )
      ) with check (
        organization_id in (
          select organization_id from org_members where user_id = auth.uid()
        )
      );
  end if;
end $$;

-- ─── Public-read policies for shared maps ──────────────
-- Allow anon SELECT on maps/capabilities/inputs/outputs/entities
-- when the map has an active (non-expired) share link.

-- Helper: check if a map_id has a valid share
-- (used in policies below)

do $$ begin
  -- capability_maps: public read for shared maps
  if not exists (select 1 from pg_policies where tablename = 'capability_maps' and policyname = 'shared_maps_anon_read') then
    create policy shared_maps_anon_read on capability_maps
      for select using (
        id in (
          select capability_map_id from capability_map_shares
          where (expires_at is null or expires_at > now())
        )
      );
  end if;

  -- capabilities: public read for shared maps
  if not exists (select 1 from pg_policies where tablename = 'capabilities' and policyname = 'shared_caps_anon_read') then
    create policy shared_caps_anon_read on capabilities
      for select using (
        capability_map_id in (
          select capability_map_id from capability_map_shares
          where (expires_at is null or expires_at > now())
        )
      );
  end if;

  -- capability_inputs: public read for shared maps
  if not exists (select 1 from pg_policies where tablename = 'capability_inputs' and policyname = 'shared_inputs_anon_read') then
    create policy shared_inputs_anon_read on capability_inputs
      for select using (
        capability_id in (
          select id from capabilities where capability_map_id in (
            select capability_map_id from capability_map_shares
            where (expires_at is null or expires_at > now())
          )
        )
      );
  end if;

  -- capability_outputs: public read for shared maps
  if not exists (select 1 from pg_policies where tablename = 'capability_outputs' and policyname = 'shared_outputs_anon_read') then
    create policy shared_outputs_anon_read on capability_outputs
      for select using (
        capability_id in (
          select id from capabilities where capability_map_id in (
            select capability_map_id from capability_map_shares
            where (expires_at is null or expires_at > now())
          )
        )
      );
  end if;

  -- personas: public read for orgs with shared maps
  if not exists (select 1 from pg_policies where tablename = 'personas' and policyname = 'shared_personas_anon_read') then
    create policy shared_personas_anon_read on personas
      for select using (
        organization_id in (
          select organization_id from capability_map_shares
          where (expires_at is null or expires_at > now())
        )
      );
  end if;

  -- information_products: public read for orgs with shared maps
  if not exists (select 1 from pg_policies where tablename = 'information_products' and policyname = 'shared_ips_anon_read') then
    create policy shared_ips_anon_read on information_products
      for select using (
        organization_id in (
          select organization_id from capability_map_shares
          where (expires_at is null or expires_at > now())
        )
      );
  end if;

  -- logical_systems: public read for orgs with shared maps
  if not exists (select 1 from pg_policies where tablename = 'logical_systems' and policyname = 'shared_systems_anon_read') then
    create policy shared_systems_anon_read on logical_systems
      for select using (
        organization_id in (
          select organization_id from capability_map_shares
          where (expires_at is null or expires_at > now())
        )
      );
  end if;

  -- tags: public read for orgs with shared maps
  if not exists (select 1 from pg_policies where tablename = 'tags' and policyname = 'shared_tags_anon_read') then
    create policy shared_tags_anon_read on tags
      for select using (
        organization_id in (
          select organization_id from capability_map_shares
          where (expires_at is null or expires_at > now())
        )
      );
  end if;
end $$;
