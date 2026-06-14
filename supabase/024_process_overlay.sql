-- ═══════════════════════════════════════════════════════════
-- Mach12.ai — Process Studio A&D overlay (org-scoped, editable)
-- RevTech/Mach12 know-how attached to an org process node: compliance
-- controls (CAS/DCAA/EVMS/FAR/DFARS/CMMC/ITAR), GovCon variants, KPIs,
-- accelerators, and scope-item references. payload is jsonb because the
-- overlay kinds are heterogeneous and will iterate.
--
-- This is the editable, per-org counterpart to process_reference_overlays
-- (the shared seed). Access resolves via parent node → model → org.
--
-- SAFE / NON-DESTRUCTIVE: create-if-not-exists only.
-- ═══════════════════════════════════════════════════════════

create table if not exists process_overlays (
  id uuid primary key default gen_random_uuid(),
  process_node_id uuid not null references process_nodes(id) on delete cascade,
  overlay_kind text not null,             -- 'control'|'variant'|'accelerator'|'kpi'|'scope_item'|'compliance'
  payload jsonb not null default '{}',
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_process_overlays_node on process_overlays(process_node_id);

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'process_overlays_updated_at') then
    create trigger process_overlays_updated_at
      before update on process_overlays
      for each row execute function update_updated_at();
  end if;
end $$;

alter table process_overlays enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'process_overlays' and policyname = 'Users can view process_overlays') then
    create policy "Users can view process_overlays"
      on process_overlays for select
      using (
        process_node_id in (
          select n.id from process_nodes n
          join process_models m on m.id = n.process_model_id
          where m.organization_id in (select organization_id from profiles where id = auth.uid())
        )
      );
  end if;
  if not exists (select 1 from pg_policies where tablename = 'process_overlays' and policyname = 'Users can manage process_overlays') then
    create policy "Users can manage process_overlays"
      on process_overlays for all
      using (
        process_node_id in (
          select n.id from process_nodes n
          join process_models m on m.id = n.process_model_id
          where m.organization_id in (select organization_id from profiles where id = auth.uid())
        )
      );
  end if;
  if not exists (select 1 from pg_policies where tablename = 'process_overlays' and policyname = 'shared_process_overlays_anon_read') then
    create policy shared_process_overlays_anon_read on process_overlays
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
end $$;
