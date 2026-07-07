-- ═══════════════════════════════════════════════════════════
-- Mach12.ai — Shared Knowledge Repository, migration 002
-- Adds the machinery for the self-training loop (Workpackage I) and the RevTech
-- template-as-criteria store (Workpackage H1):
--   1. kb_sources.status         active | draft | archived  (drafts stay dark
--                                until Josh promotes them; retrieval sees active only)
--   2. kb_training_runs          one row per self-training cycle, with its stage,
--                                harvest findings, draft source ids, and eval delta
--   3. kb_criteria               the RevTech S/4HANA template as machine-checkable
--                                criteria (powers check_template_conformance)
--   4. retrieval RPCs now filter to active sources (drafts are never retrieved)
--
-- SAFE / NON-DESTRUCTIVE: add-column-if-not-exists + create-if-not-exists +
-- create-or-replace. Existing sources default to status 'active', so nothing
-- that was retrievable before this migration stops being retrievable.
-- ═══════════════════════════════════════════════════════════

-- ─── 1. Source lifecycle status ────────────────────────────
-- Free text (no CHECK, matching kb_sources.kind): active | draft | archived.
alter table kb_sources add column if not exists status text not null default 'active';
create index if not exists kb_sources_status on kb_sources(status);

-- ─── 2. Self-training runs ─────────────────────────────────
-- Service-role only (RLS enabled, no authenticated policy): the training-run
-- engine reads/writes these through server routes.
create table if not exists kb_training_runs (
  id uuid primary key default gen_random_uuid(),
  workstream_code text not null,               -- workstream the run trains, or 'enterprise'
  focus text,                                  -- optional narrowing focus for the cycle
  connectors jsonb,                            -- which harvest connectors were used / available
  stage text not null default 'harvest',       -- harvest | draft | verify | queued | promoted | rejected
  findings jsonb,                              -- harvested gaps, eval misses, logged kbGaps, evidence
  draft_source_ids uuid[] default '{}',        -- kb_sources rows (status=draft) this run produced
  eval_delta jsonb,                            -- per-category eval score movement vs baseline
  created_by uuid,
  created_at timestamptz default now(),
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_note text,                            -- Josh's promote/reject rationale
  updated_at timestamptz default now()
);
create index if not exists kb_training_runs_ws on kb_training_runs(workstream_code);
create index if not exists kb_training_runs_stage on kb_training_runs(stage);

-- ─── 3. RevTech template criteria ──────────────────────────
-- The RevTech S/4HANA reference build as queryable, scored conformance criteria.
-- Global rows (tenant_key null) are the template itself (RevTech IP); tenant rows
-- are customer-specific overlays. RLS mirrors kb_sources: authenticated may read
-- global; all writes go through service-role server routes.
create table if not exists kb_criteria (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  workstream_code text not null,
  pillar text,                                 -- People | Process | Data | Technology
  statement text not null,                     -- the criterion ("what good looks like")
  rationale text,
  evidence jsonb,                              -- { how: sas_query | sap_query | manual, ... }
  severity text default 'should',              -- must | should | may
  source_ref text,                             -- where the criterion comes from (skill, memory, config)
  version text,
  status text not null default 'active',       -- active | draft | archived
  tenant_key text,                             -- null = global RevTech template; else customer slug
  created_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create unique index if not exists kb_criteria_code_global on kb_criteria(code) where tenant_key is null;
create unique index if not exists kb_criteria_code_tenant on kb_criteria(code, tenant_key) where tenant_key is not null;
create index if not exists kb_criteria_ws on kb_criteria(workstream_code);
create index if not exists kb_criteria_status on kb_criteria(status);

alter table kb_training_runs enable row level security;
alter table kb_criteria      enable row level security;

do $$ begin
  -- kb_training_runs: intentionally no authenticated policy (service-role only).
  if not exists (select 1 from pg_policies where tablename='kb_criteria' and policyname='kb_criteria_auth_read_global') then
    create policy kb_criteria_auth_read_global on kb_criteria for select to authenticated using (tenant_key is null and status = 'active');
  end if;
end $$;

-- ─── 4. Retrieval filters to active sources ────────────────
-- Both RPCs now join kb_sources and drop chunks whose source is draft/archived,
-- so training drafts are never retrieved by the live agents until promoted.
-- coalesce keeps pre-migration rows (no status) visible.
create or replace function kb_match_chunks(
  query_embedding extensions.vector(1024),
  match_count int default 8,
  filter_tenant text default null,
  filter_workstreams text[] default null
) returns table (id uuid, source_id uuid, content text, workstream_codes text[], similarity float)
language sql stable as $$
  select c.id, c.source_id, c.content, c.workstream_codes,
         1 - (c.embedding <=> query_embedding) as similarity
  from kb_chunks c
  join kb_sources s on s.id = c.source_id
  where c.embedding is not null
    and coalesce(s.status, 'active') = 'active'
    and (filter_tenant is null or c.tenant_key is null or c.tenant_key = filter_tenant)
    and (filter_workstreams is null or c.workstream_codes && filter_workstreams)
  order by c.embedding <=> query_embedding
  limit match_count
$$;

create or replace function kb_search_chunks_text(
  query_text text,
  match_count int default 8,
  filter_tenant text default null,
  filter_workstreams text[] default null
) returns table (id uuid, source_id uuid, content text, workstream_codes text[], rank float)
language sql stable as $$
  with q as (
    select to_tsquery('english', string_agg(w, ' | ')) as tsq
    from (
      select distinct unnest(
        regexp_split_to_array(lower(regexp_replace(coalesce(query_text,''), '[^a-z0-9 ]', ' ', 'gi')), '\s+')
      ) as w
    ) words
    where length(w) > 1
  )
  select c.id, c.source_id, c.content, c.workstream_codes,
         ts_rank(to_tsvector('english', c.content), (select tsq from q)) as rank
  from kb_chunks c
  join kb_sources s on s.id = c.source_id
  where (select tsq from q) is not null
    and coalesce(s.status, 'active') = 'active'
    and (filter_tenant is null or c.tenant_key is null or c.tenant_key = filter_tenant)
    and (filter_workstreams is null or c.workstream_codes && filter_workstreams)
    and to_tsvector('english', c.content) @@ (select tsq from q)
  order by rank desc
  limit match_count
$$;
