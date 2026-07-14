-- ═══════════════════════════════════════════════════════════
-- Mach12.ai — Process Studio richer delivery metadata
-- Informed by real SAP S/4HANA process documentation (Signavio export):
-- per-activity Responsible/RACI/IT-System/Fiori-Tcode/related-docs/RICEFW,
-- a RICEFW build-object register, an integration/interface register, plus
-- process lifecycle (as-is/to-be/interim) and named variants.
--
-- Per-activity metadata (role/RACI/systems/tcode/RICEFW refs) lives in the
-- element's graph_data jsonb (no migration needed for that — types only).
-- This migration adds the relational pieces that need querying/reuse.
--
-- SAFE / NON-DESTRUCTIVE: add-column-if-not-exists + create-if-not-exists.
-- ═══════════════════════════════════════════════════════════

-- ─── Lifecycle + variant on org nodes and reference scenarios ──
alter table process_nodes add column if not exists lifecycle text;            -- 'as_is'|'to_be'|'interim'|null
alter table process_nodes add column if not exists variant_label text;        -- e.g. 'Capital', 'Facilities', 'Labor'
alter table process_reference_scenarios add column if not exists lifecycle text;
alter table process_reference_scenarios add column if not exists variant_label text;

-- ─── RICEFW register (org-scoped build-object catalog) ──
-- R/I/C/E/F/W = Reports, Interfaces, Conversions, Enhancements, Forms, Workflows.
create table if not exists process_ricefw (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  code text not null,                    -- e.g. 'INT-014' (org's own numbering, not a client's)
  ricefw_type text not null,             -- 'report'|'interface'|'conversion'|'enhancement'|'form'|'workflow'
  title text not null,
  description text,
  status text default 'identified',      -- 'identified'|'in_design'|'in_build'|'tested'|'deployed'
  complexity text,                       -- 'low'|'medium'|'high'
  process_node_id uuid references process_nodes(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_process_ricefw_org on process_ricefw(organization_id);
create index if not exists idx_process_ricefw_node on process_ricefw(process_node_id);

-- ─── Interface / integration register (per process node) ──
create table if not exists process_interfaces (
  id uuid primary key default gen_random_uuid(),
  process_node_id uuid not null references process_nodes(id) on delete cascade,
  source_system_id uuid references logical_systems(id) on delete set null,
  target_system_id uuid references logical_systems(id) on delete set null,
  direction text,                        -- 'inbound'|'outbound'|'bidirectional'
  frequency text,                        -- e.g. 'Daily', 'Real-time', 'On demand'
  integration_tech text,                 -- e.g. 'CPI iFlow', 'IDoc', 'OData', 'File'
  interface_ref text,                    -- a RICEFW interface code or external id
  description text,
  sort_order integer default 0,
  created_at timestamptz default now()
);

create index if not exists idx_process_interfaces_node on process_interfaces(process_node_id);

-- ─── Triggers ──
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'process_ricefw_updated_at') then
    create trigger process_ricefw_updated_at before update on process_ricefw
      for each row execute function update_updated_at();
  end if;
end $$;

-- ═══════════════════════════════════════════════════════════
-- RLS
-- ═══════════════════════════════════════════════════════════
alter table process_ricefw enable row level security;
alter table process_interfaces enable row level security;

do $$ begin
  -- RICEFW: org members CRUD (mirror org-scoped pattern)
  if not exists (select 1 from pg_policies where tablename='process_ricefw' and policyname='Org members can view process_ricefw') then
    create policy "Org members can view process_ricefw" on process_ricefw for select
      using (organization_id in (select organization_id from profiles where id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename='process_ricefw' and policyname='Org members can manage process_ricefw') then
    create policy "Org members can manage process_ricefw" on process_ricefw for all
      using (organization_id in (select organization_id from profiles where id = auth.uid()))
      with check (organization_id in (select organization_id from profiles where id = auth.uid()));
  end if;

  -- Interfaces: access via parent node → model → org
  if not exists (select 1 from pg_policies where tablename='process_interfaces' and policyname='Users can view process_interfaces') then
    create policy "Users can view process_interfaces" on process_interfaces for select
      using (process_node_id in (
        select n.id from process_nodes n join process_models m on m.id = n.process_model_id
        where m.organization_id in (select organization_id from profiles where id = auth.uid())));
  end if;
  if not exists (select 1 from pg_policies where tablename='process_interfaces' and policyname='Users can manage process_interfaces') then
    create policy "Users can manage process_interfaces" on process_interfaces for all
      using (process_node_id in (
        select n.id from process_nodes n join process_models m on m.id = n.process_model_id
        where m.organization_id in (select organization_id from profiles where id = auth.uid())));
  end if;
  if not exists (select 1 from pg_policies where tablename='process_interfaces' and policyname='shared_process_interfaces_anon_read') then
    create policy shared_process_interfaces_anon_read on process_interfaces for select
      using (process_node_id in (
        select n.id from process_nodes n where n.process_model_id in (
          select process_model_id from process_model_shares where (expires_at is null or expires_at > now()))));
  end if;
end $$;
