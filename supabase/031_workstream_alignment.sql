-- ═══════════════════════════════════════════════════════════
-- Mach12.ai — Workstream alignment
-- Give every pillar entity a nullable "home" workstream_id, plus a polymorphic
-- join (workstream_alignments) for entities that genuinely span more than one
-- workstream, plus a rollup view that powers the Workstreams overview KPIs.
--
-- Node/capability-level workstream_id is nullable and inherits from its parent
-- model/map in the UI when left null.
--
-- SAFE / NON-DESTRUCTIVE: add-column-if-not-exists + create-if-not-exists.
-- ═══════════════════════════════════════════════════════════

-- ─── Home workstream FK on each pillar entity ──────────────
alter table diagrams             add column if not exists workstream_id uuid references workstreams(id) on delete set null;
alter table capability_maps      add column if not exists workstream_id uuid references workstreams(id) on delete set null;
alter table capabilities         add column if not exists workstream_id uuid references workstreams(id) on delete set null;
alter table process_models       add column if not exists workstream_id uuid references workstreams(id) on delete set null;
alter table process_nodes        add column if not exists workstream_id uuid references workstreams(id) on delete set null;
alter table personas             add column if not exists workstream_id uuid references workstreams(id) on delete set null;
alter table process_roles        add column if not exists workstream_id uuid references workstreams(id) on delete set null;
alter table information_products add column if not exists workstream_id uuid references workstreams(id) on delete set null;
alter table system_data_elements add column if not exists workstream_id uuid references workstreams(id) on delete set null;
alter table logical_systems      add column if not exists workstream_id uuid references workstreams(id) on delete set null;

create index if not exists idx_diagrams_ws        on diagrams(workstream_id);
create index if not exists idx_capmaps_ws         on capability_maps(workstream_id);
create index if not exists idx_capabilities_ws    on capabilities(workstream_id);
create index if not exists idx_procmodels_ws      on process_models(workstream_id);
create index if not exists idx_procnodes_ws       on process_nodes(workstream_id);
create index if not exists idx_personas_ws        on personas(workstream_id);
create index if not exists idx_procroles_ws       on process_roles(workstream_id);
create index if not exists idx_infoproducts_ws    on information_products(workstream_id);
create index if not exists idx_dataelements_ws    on system_data_elements(workstream_id);
create index if not exists idx_logsystems_ws      on logical_systems(workstream_id);

-- ─── Polymorphic alignment (entities that span workstreams) ─
create table if not exists workstream_alignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  workstream_id uuid not null references workstreams(id) on delete cascade,
  entity_type text not null,   -- 'persona' | 'data_element' | 'information_product' | 'logical_system' | 'process_model' | 'capability' | 'diagram' | 'role'
  entity_id uuid not null,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  unique (workstream_id, entity_type, entity_id)
);

create index if not exists idx_ws_align_org on workstream_alignments(organization_id);
create index if not exists idx_ws_align_entity on workstream_alignments(entity_type, entity_id);
create index if not exists idx_ws_align_ws on workstream_alignments(workstream_id);

alter table workstream_alignments enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='workstream_alignments' and policyname='Org members can view workstream_alignments') then
    create policy "Org members can view workstream_alignments" on workstream_alignments for select
      using (organization_id in (select organization_id from profiles where id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename='workstream_alignments' and policyname='Org members can manage workstream_alignments') then
    create policy "Org members can manage workstream_alignments" on workstream_alignments for all
      using (organization_id in (select organization_id from profiles where id = auth.uid()))
      with check (organization_id in (select organization_id from profiles where id = auth.uid()));
  end if;
end $$;

-- ─── Rollup view (per-workstream counts for overview KPIs) ──
-- security_invoker so the base-table RLS of the calling user applies, keeping
-- counts scoped to the user's org automatically.
create or replace view workstream_rollup as
select
  w.id              as workstream_id,
  w.organization_id as organization_id,
  w.code            as code,
  (select count(*) from process_models      pm where pm.workstream_id = w.id and pm.archived_at is null)      as process_models,
  (select count(*) from process_nodes       pn where pn.workstream_id = w.id)                                  as process_nodes,
  (select count(*) from capabilities        c  where c.workstream_id  = w.id)                                  as capabilities,
  (select count(*) from capability_maps     cm where cm.workstream_id = w.id and cm.archived_at is null)       as capability_maps,
  (select count(*) from personas            p  where p.workstream_id  = w.id)                                  as personas,
  (select count(*) from process_roles       r  where r.workstream_id  = w.id)                                  as roles,
  (select count(*) from information_products ip where ip.workstream_id = w.id)                                 as information_products,
  (select count(*) from system_data_elements de where de.workstream_id = w.id)                                 as data_elements,
  (select count(*) from logical_systems     ls where ls.workstream_id = w.id)                                  as systems,
  (select count(*) from diagrams            d  where d.workstream_id  = w.id)                                  as diagrams,
  (select count(*) from process_interfaces  pi
     join process_nodes pn2 on pn2.id = pi.process_node_id
     where pn2.workstream_id = w.id)                                                                           as integrations
from workstreams w
where w.archived_at is null;

alter view workstream_rollup set (security_invoker = true);
grant select on workstream_rollup to authenticated;
