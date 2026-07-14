-- ═══════════════════════════════════════════════════════════
-- Fix the workstream_rollup "Systems" and "Integrations" counts (they showed 0
-- on the Workstreams cards and in every workstream agent's get_workstream_overview).
--
-- Root cause: the view counted the wrong tables.
--   - systems      counted logical_systems.workstream_id, which nothing sets.
--   - integrations counted process_interfaces, a register nothing populates.
--
-- The org's real systems live in bedrock_systems (tagged to value streams in the
-- Bedrock Catalog via workstream_ids, and/or linked to capabilities). The real
-- integration architecture lives as edges in the value stream's data-architecture
-- diagrams. Count those instead so the numbers flow through to the cards AND the
-- agents' knowledge base.
--
-- Only the `systems` and `integrations` subqueries change; every other column is
-- preserved. security_invoker keeps base-table RLS scoping per calling user.
-- Idempotent (create or replace).
-- ═══════════════════════════════════════════════════════════

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
  -- Systems: bedrock systems tied to this value stream, either tagged directly in
  -- the Bedrock Catalog (workstream_ids / workstream_id) or realized by one of the
  -- value stream's capabilities. Counted once per system.
  (select count(*) from bedrock_systems bs
     where bs.archived_at is null and (
       w.id = any(coalesce(bs.workstream_ids, '{}'::uuid[]))
       or bs.workstream_id = w.id
       or exists (
         select 1 from cm_capability_systems cs
         join cm_capabilities cc on cc.id = cs.capability_id
         where cs.bedrock_system_id = bs.id and cc.workstream_id = w.id
       )
     ))                                                                                                        as systems,
  (select count(*) from diagrams            d  where d.workstream_id  = w.id)                                  as diagrams,
  -- Integrations: system-to-system data flows (edges) across this value stream's
  -- data-architecture / bedrock integration diagrams.
  (select coalesce(sum(
       case when jsonb_typeof(d.canvas_data -> 'edges') = 'array'
            then jsonb_array_length(d.canvas_data -> 'edges')
            else 0 end
     ), 0)
     from diagrams d where d.workstream_id = w.id)                                                             as integrations
from workstreams w
where w.archived_at is null;

alter view workstream_rollup set (security_invoker = true);
grant select on workstream_rollup to authenticated;
