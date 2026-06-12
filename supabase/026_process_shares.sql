-- ═══════════════════════════════════════════════════════════
-- Read-only share links for Process Models (Process Studio)
-- Mirrors 015_capability_map_shares.sql.
--
-- SAFE / NON-DESTRUCTIVE:
--   * create table if not exists
--   * create policy if not exists (wrapped in DO block)
--   * No drop / rename / update / delete statements
-- ═══════════════════════════════════════════════════════════

create table if not exists process_model_shares (
  id uuid primary key default gen_random_uuid(),
  process_model_id uuid not null references process_models(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  code text not null unique,
  created_by uuid references profiles(id),
  expires_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists idx_process_model_shares_code on process_model_shares(code);
create index if not exists idx_process_model_shares_model on process_model_shares(process_model_id);

alter table process_model_shares enable row level security;

-- Org members can manage shares; anyone (including anon) can SELECT to validate codes
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'process_model_shares' and policyname = 'process_shares_select_all') then
    create policy process_shares_select_all on process_model_shares
      for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'process_model_shares' and policyname = 'process_shares_org_manage') then
    create policy process_shares_org_manage on process_model_shares
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

-- ─── Public-read policies for shared process models ────
-- Allow anon SELECT on models / nodes / lanes (and the org logical_systems
-- + personas the lanes reference) when the model has an active share link.

do $$ begin
  -- process_models: public read for shared models
  if not exists (select 1 from pg_policies where tablename = 'process_models' and policyname = 'shared_process_models_anon_read') then
    create policy shared_process_models_anon_read on process_models
      for select using (
        id in (
          select process_model_id from process_model_shares
          where (expires_at is null or expires_at > now())
        )
      );
  end if;

  -- process_nodes: public read for shared models (graph_data is a column here)
  if not exists (select 1 from pg_policies where tablename = 'process_nodes' and policyname = 'shared_process_nodes_anon_read') then
    create policy shared_process_nodes_anon_read on process_nodes
      for select using (
        process_model_id in (
          select process_model_id from process_model_shares
          where (expires_at is null or expires_at > now())
        )
      );
  end if;

  -- process_node_lanes: public read for shared models
  if not exists (select 1 from pg_policies where tablename = 'process_node_lanes' and policyname = 'shared_process_lanes_anon_read') then
    create policy shared_process_lanes_anon_read on process_node_lanes
      for select using (
        process_node_id in (
          select n.id from process_nodes n
          where n.process_model_id in (
            select process_model_id from process_model_shares
            where (expires_at is null or expires_at > now())
          )
        )
      );
  end if;

  -- logical_systems: public read for orgs with shared process models
  if not exists (select 1 from pg_policies where tablename = 'logical_systems' and policyname = 'shared_process_systems_anon_read') then
    create policy shared_process_systems_anon_read on logical_systems
      for select using (
        organization_id in (
          select organization_id from process_model_shares
          where (expires_at is null or expires_at > now())
        )
      );
  end if;

  -- personas: public read for orgs with shared process models
  if not exists (select 1 from pg_policies where tablename = 'personas' and policyname = 'shared_process_personas_anon_read') then
    create policy shared_process_personas_anon_read on personas
      for select using (
        organization_id in (
          select organization_id from process_model_shares
          where (expires_at is null or expires_at > now())
        )
      );
  end if;
end $$;
