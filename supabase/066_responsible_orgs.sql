-- ═══════════════════════════════════════════════════════════
-- Mach12.ai — Responsible Orgs (capability ownership)
--
--   cm_responsible_orgs           : per-tenant catalog of the BUSINESS
--                                   organizations that own capabilities —
--                                   Finance, Supply Chain, Program Management,
--                                   Engineering, Quality, and so on.
--   cm_capabilities.responsible_org_id : which one owns this capability.
--
-- NOTE ON NAMING: `organizations` in this schema is the TENANT (RevTech, Codan).
-- These are a different thing entirely — the client's own internal org chart —
-- so the table and column are named `responsible_org` throughout to keep the
-- two from being confused in code.
--
-- The catalog is org-scoped and starts empty: each client names its own
-- organizations rather than inheriting a guessed standard set.
--
-- SAFE / NON-DESTRUCTIVE: create-if-not-exists + add-column-if-not-exists.
-- ═══════════════════════════════════════════════════════════

create table if not exists cm_responsible_orgs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  code text,                                 -- optional short tag, e.g. 'FIN'
  description text,
  color text,
  sort_order int default 0,
  archived_at timestamptz,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_cm_resp_orgs_org on cm_responsible_orgs(organization_id);

-- One name per tenant, case-insensitively — stops "Finance" and "finance"
-- becoming two entries in the dropdown. Archived rows keep their name reserved
-- so restoring one can never collide.
create unique index if not exists uq_cm_resp_orgs_name
  on cm_responsible_orgs(organization_id, lower(name));

-- on delete set null: removing an org from the catalog un-assigns it from its
-- capabilities rather than deleting the capabilities.
alter table cm_capabilities
  add column if not exists responsible_org_id uuid references cm_responsible_orgs(id) on delete set null;

create index if not exists idx_cm_capabilities_resp_org
  on cm_capabilities(responsible_org_id)
  where responsible_org_id is not null;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'cm_responsible_orgs_updated_at') then
    create trigger cm_responsible_orgs_updated_at before update on cm_responsible_orgs
      for each row execute function update_updated_at();
  end if;
end $$;

alter table cm_responsible_orgs enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='cm_responsible_orgs' and policyname='Org members can view cm_responsible_orgs') then
    create policy "Org members can view cm_responsible_orgs" on cm_responsible_orgs for select
      using (organization_id in (select organization_id from profiles where id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename='cm_responsible_orgs' and policyname='Org members can manage cm_responsible_orgs') then
    create policy "Org members can manage cm_responsible_orgs" on cm_responsible_orgs for all
      using (organization_id in (select organization_id from profiles where id = auth.uid()))
      with check (organization_id in (select organization_id from profiles where id = auth.uid()));
  end if;
end $$;

-- The read-only capability share link reads under the anon role, so it needs
-- the catalog too or a shared card would show no owner at all. Same shape and
-- naming as the anon read policies in migration 039.
do $$ begin
  if not exists (select 1 from pg_policies where tablename='cm_responsible_orgs' and policyname='cm_shared_resp_orgs_anon_read') then
    create policy cm_shared_resp_orgs_anon_read on cm_responsible_orgs for select using (
      organization_id in (select organization_id from cm_capability_shares
        where (expires_at is null or expires_at > now()))
    );
  end if;
end $$;
