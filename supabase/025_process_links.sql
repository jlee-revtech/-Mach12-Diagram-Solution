-- ═══════════════════════════════════════════════════════════
-- Mach12.ai — Process Studio cross-pillar links
-- A thin, polymorphic link table joining a process leaf to other
-- artifacts (a scaffolded data diagram, a SIPOC capability, another
-- process model). target_id has NO hard FK on purpose — it points
-- across pillars (diagrams / capabilities / process_models) and we
-- avoid cross-pillar cascade coupling, mirroring how the app already
-- stores loose ID references in jsonb.
--
-- Note: the primary leaf↔SIPOC link is stored directly on
-- process_nodes.sipoc_capability_id (migration 022). This table is for
-- the scaffold lineage and any additional many-to-many links.
--
-- SAFE / NON-DESTRUCTIVE: create-if-not-exists only.
-- ═══════════════════════════════════════════════════════════

create table if not exists process_node_links (
  id uuid primary key default gen_random_uuid(),
  process_node_id uuid not null references process_nodes(id) on delete cascade,
  link_kind text not null,              -- 'data_diagram' | 'sipoc_capability' | 'process_model'
  target_id uuid not null,              -- diagrams.id / capabilities.id / process_models.id (polymorphic, no FK)
  label text,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

create index if not exists idx_process_node_links_node on process_node_links(process_node_id);
create index if not exists idx_process_node_links_target on process_node_links(target_id);

alter table process_node_links enable row level security;

-- Access via parent node → model → org
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'process_node_links' and policyname = 'Users can view process_node_links') then
    create policy "Users can view process_node_links"
      on process_node_links for select
      using (
        process_node_id in (
          select n.id from process_nodes n
          join process_models m on m.id = n.process_model_id
          where m.organization_id in (select organization_id from profiles where id = auth.uid())
        )
      );
  end if;
  if not exists (select 1 from pg_policies where tablename = 'process_node_links' and policyname = 'Users can manage process_node_links') then
    create policy "Users can manage process_node_links"
      on process_node_links for all
      using (
        process_node_id in (
          select n.id from process_nodes n
          join process_models m on m.id = n.process_model_id
          where m.organization_id in (select organization_id from profiles where id = auth.uid())
        )
      );
  end if;
end $$;

-- Public read for shared process models (so a shared leaf can show its links)
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'process_node_links' and policyname = 'shared_process_links_anon_read') then
    create policy shared_process_links_anon_read on process_node_links
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
