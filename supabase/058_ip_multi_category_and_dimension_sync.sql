-- ═══════════════════════════════════════════════════════════
-- Mach12.ai — SIPOC feedback (Boeing / Josephine Smith):
--
-- 1. Information Products can carry MULTIPLE categories.
--    `categories text[]` is the new source of truth; the legacy
--    `category` column is kept as the primary (first) category so
--    templates / AI flows / older readers keep working.
--
-- 2. One-time consolidation of dimensions per Information Product.
--    Dimensions are attributes of the IP itself, but historically each
--    capability_inputs / capability_outputs row kept its own copy, so
--    edits made on one usage never flowed to the others. The app now
--    syncs dimension edits to every usage of the IP; this backfill
--    makes existing data consistent by writing the per-IP UNION of
--    dimensions (deduped by name, tag assignments merged) back to
--    every usage row. Union-only: no dimension name is ever dropped.
--    Linked inputs (source_output_id set) inherit from their upstream
--    output and are intentionally left untouched.
--
-- Suggested run (Supabase SQL Editor):
--   begin;
--   -- paste statements below
--   select count(*) from information_products where cardinality(categories) > 0;
--   -- spot-check an IP used in several places:
--   -- select id, dimensions from capability_inputs where information_product_id = '<ip>';
--   commit;
-- ═══════════════════════════════════════════════════════════

-- ─── 1. Multi-category ──────────────────────────────────
alter table information_products
  add column if not exists categories text[] default '{}';

update information_products
set categories = array[category]
where category is not null
  and btrim(category) <> ''
  and (categories is null or cardinality(categories) = 0);

-- ─── 2. Consolidate dimensions per IP across all usages ─
create temp table _ip_dims as
with dim_rows as (
  select ci.information_product_id as ip_id,
         d.elem as dim, d.ord as ord, 0 as side_ord, ci.created_at
  from capability_inputs ci
  cross join lateral jsonb_array_elements(coalesce(ci.dimensions, '[]'::jsonb))
    with ordinality as d(elem, ord)
  where ci.source_output_id is null
  union all
  select co.information_product_id,
         d.elem, d.ord, 1, co.created_at
  from capability_outputs co
  cross join lateral jsonb_array_elements(coalesce(co.dimensions, '[]'::jsonb))
    with ordinality as d(elem, ord)
),
named as (
  select ip_id,
         lower(btrim(dim->>'name')) as key,
         dim, created_at, side_ord, ord,
         row_number() over (
           partition by ip_id, lower(btrim(dim->>'name'))
           order by created_at, side_ord, ord
         ) as rn
  from dim_rows
  where coalesce(btrim(dim->>'name'), '') <> ''
),
tag_union as (
  select n.ip_id, n.key,
         jsonb_agg(distinct to_jsonb(t.tag_id)) as tag_ids
  from named n
  cross join lateral jsonb_array_elements_text(coalesce(n.dim->'tag_ids', '[]'::jsonb)) as t(tag_id)
  group by n.ip_id, n.key
),
canonical as (
  select n.ip_id,
         (n.dim || jsonb_build_object('tag_ids', coalesce(tu.tag_ids, '[]'::jsonb))) as dim,
         n.created_at, n.side_ord, n.ord
  from named n
  left join tag_union tu on tu.ip_id = n.ip_id and tu.key = n.key
  where n.rn = 1
)
select ip_id, jsonb_agg(dim order by created_at, side_ord, ord) as dims
from canonical
group by ip_id;

update capability_inputs ci
set dimensions = f.dims
from _ip_dims f
where ci.information_product_id = f.ip_id
  and ci.source_output_id is null
  and ci.dimensions is distinct from f.dims;

update capability_outputs co
set dimensions = f.dims
from _ip_dims f
where co.information_product_id = f.ip_id
  and co.dimensions is distinct from f.dims;

drop table _ip_dims;
