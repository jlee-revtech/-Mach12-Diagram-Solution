-- ═══════════════════════════════════════════════════════════
-- Read-only share links for the Capability Map WORKSPACE
-- (org-level cm_capabilities + cm_capability_systems + bedrock_* + workstreams).
--
-- Distinct from capability_map_shares (which shares a single SIPOC capability_map).
-- A cm_capability_share grants anon (logged-out) READ of the org's capability
-- list and its logical/physical system mappings for as long as the link is valid.
--
-- SAFE / NON-DESTRUCTIVE: create-if-not-exists only; no drop/alter/delete.
-- ═══════════════════════════════════════════════════════════

create table if not exists cm_capability_shares (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  code text not null unique,
  created_by uuid references profiles(id),
  expires_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists idx_cm_cap_shares_code on cm_capability_shares(code);
create index if not exists idx_cm_cap_shares_org on cm_capability_shares(organization_id);

alter table cm_capability_shares enable row level security;

do $$ begin
  -- Anyone (incl. anon) can SELECT a share row to validate a code.
  if not exists (select 1 from pg_policies where tablename='cm_capability_shares' and policyname='cm_cap_shares_select_all') then
    create policy cm_cap_shares_select_all on cm_capability_shares for select using (true);
  end if;
  -- Org members manage their own shares.
  if not exists (select 1 from pg_policies where tablename='cm_capability_shares' and policyname='cm_cap_shares_org_manage') then
    create policy cm_cap_shares_org_manage on cm_capability_shares for all
      using (organization_id in (select organization_id from profiles where id = auth.uid()))
      with check (organization_id in (select organization_id from profiles where id = auth.uid()));
  end if;
end $$;

-- ─── Anon read policies, gated by a valid (non-expired) cm_capability_share ──
do $$ begin
  if not exists (select 1 from pg_policies where tablename='cm_capabilities' and policyname='cm_shared_caps_anon_read') then
    create policy cm_shared_caps_anon_read on cm_capabilities for select using (
      organization_id in (select organization_id from cm_capability_shares
        where (expires_at is null or expires_at > now()))
    );
  end if;

  if not exists (select 1 from pg_policies where tablename='cm_capability_systems' and policyname='cm_shared_capsys_anon_read') then
    create policy cm_shared_capsys_anon_read on cm_capability_systems for select using (
      organization_id in (select organization_id from cm_capability_shares
        where (expires_at is null or expires_at > now()))
    );
  end if;

  if not exists (select 1 from pg_policies where tablename='bedrock_systems' and policyname='cm_shared_bedrock_anon_read') then
    create policy cm_shared_bedrock_anon_read on bedrock_systems for select using (
      organization_id in (select organization_id from cm_capability_shares
        where (expires_at is null or expires_at > now()))
    );
  end if;

  if not exists (select 1 from pg_policies where tablename='bedrock_physical_systems' and policyname='cm_shared_bedrock_phys_anon_read') then
    create policy cm_shared_bedrock_phys_anon_read on bedrock_physical_systems for select using (
      bedrock_system_id in (
        select id from bedrock_systems where organization_id in (
          select organization_id from cm_capability_shares
          where (expires_at is null or expires_at > now()))
      )
    );
  end if;

  if not exists (select 1 from pg_policies where tablename='workstreams' and policyname='cm_shared_workstreams_anon_read') then
    create policy cm_shared_workstreams_anon_read on workstreams for select using (
      organization_id in (select organization_id from cm_capability_shares
        where (expires_at is null or expires_at > now()))
    );
  end if;
end $$;
