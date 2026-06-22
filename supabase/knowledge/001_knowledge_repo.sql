-- ═══════════════════════════════════════════════════════════
-- Mach12.ai — Shared Knowledge Repository
-- A single source of truth, designed to be shared by BOTH the diagram app and
-- the SAP Solution Studio app. Holds the canonical workstream catalog, the
-- per-workstream consultant-agent definitions, and the knowledge sources +
-- pgvector chunks that power RAG.
--
-- Tenancy: global baseline rows have tenant_key = NULL (shared across all
-- tenants); customer-specific rows carry a tenant_key (customer slug).
--
-- Hosted (for now) in the diagram app's Supabase project, behind dedicated
-- KNOWLEDGE_SUPABASE_* env vars + a separate client, so it can be relocated to
-- a dedicated project later by changing config + re-running this file.
--
-- SAFE / NON-DESTRUCTIVE: create-if-not-exists.
-- ═══════════════════════════════════════════════════════════

create extension if not exists vector with schema extensions;

-- ─── Canonical workstream catalog (global, app-agnostic) ───
create table if not exists kb_workstream_catalog (
  code text primary key,
  name text not null,
  description text,
  pillars jsonb,
  sort_order int default 0,
  updated_at timestamptz default now()
);

-- ─── Per-workstream consultant agents (global) ─────────────
create table if not exists kb_workstream_agents (
  code text primary key,                       -- workstream code, or 'enterprise'
  display_name text not null,
  tagline text,
  system_persona text,                         -- the consultant persona prompt
  sap_modules text[] default '{}',
  dassian_modules text[] default '{}',
  knowledge_source_codes text[] default '{}',  -- which kb_sources power this agent
  model text default 'claude-sonnet-4-6',
  temperature real default 0.4,
  is_orchestrator boolean default false,
  sort_order int default 0,
  updated_at timestamptz default now()
);

-- ─── Knowledge sources (skills, baselines, customer docs) ──
create table if not exists kb_sources (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  title text not null,
  description text,
  kind text not null default 'skill',          -- skill | baseline | customer-doc | reference
  origin text default 'solution-studio',        -- solution-studio | diagram-app | upload
  tenant_key text,                              -- null = global baseline; else customer slug
  workstream_codes text[] default '{}',
  version text,
  frontmatter jsonb,
  body text,
  source_app text,                              -- app that authored the row
  created_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- One global row per code, and one row per (code, tenant_key) for tenant rows.
create unique index if not exists kb_sources_code_global on kb_sources(code) where tenant_key is null;
create unique index if not exists kb_sources_code_tenant on kb_sources(code, tenant_key) where tenant_key is not null;

-- ─── RAG chunks (pgvector) ─────────────────────────────────
-- embedding dimension 1024 = Voyage voyage-3. Nullable so ingestion can store
-- chunks first and embed lazily, and so lexical fallback works without a key.
create table if not exists kb_chunks (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references kb_sources(id) on delete cascade,
  tenant_key text,
  workstream_codes text[] default '{}',
  chunk_index int not null,
  content text not null,
  token_count int,
  embedding extensions.vector(1024),
  created_at timestamptz default now()
);

create index if not exists kb_chunks_source on kb_chunks(source_id);
create index if not exists kb_chunks_embedding on kb_chunks using hnsw (embedding extensions.vector_cosine_ops);
create index if not exists kb_chunks_fts on kb_chunks using gin (to_tsvector('english', content));

-- ─── Retrieval functions ───────────────────────────────────
-- Semantic search (cosine). Returns most-similar chunks, filtered by tenant
-- (global rows always visible) and optional workstream overlap.
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
  where c.embedding is not null
    and (filter_tenant is null or c.tenant_key is null or c.tenant_key = filter_tenant)
    and (filter_workstreams is null or c.workstream_codes && filter_workstreams)
  order by c.embedding <=> query_embedding
  limit match_count
$$;

-- Lexical fallback (full-text) for when no embedding provider is configured.
-- ORs the query terms (any-term match) and ranks by relevance, so natural-
-- language questions still retrieve useful chunks without a strict all-terms
-- match.
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
  where (select tsq from q) is not null
    and (filter_tenant is null or c.tenant_key is null or c.tenant_key = filter_tenant)
    and (filter_workstreams is null or c.workstream_codes && filter_workstreams)
    and to_tsvector('english', c.content) @@ (select tsq from q)
  order by rank desc
  limit match_count
$$;

-- ─── RLS ───────────────────────────────────────────────────
-- Reads of global reference data are open to authenticated users; all writes
-- and tenant-scoped reads go through service-role server routes (RLS bypass).
alter table kb_workstream_catalog enable row level security;
alter table kb_workstream_agents  enable row level security;
alter table kb_sources            enable row level security;
alter table kb_chunks             enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='kb_workstream_catalog' and policyname='kb_catalog_auth_read') then
    create policy kb_catalog_auth_read on kb_workstream_catalog for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='kb_workstream_agents' and policyname='kb_agents_auth_read') then
    create policy kb_agents_auth_read on kb_workstream_agents for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='kb_sources' and policyname='kb_sources_auth_read_global') then
    create policy kb_sources_auth_read_global on kb_sources for select to authenticated using (tenant_key is null);
  end if;
  if not exists (select 1 from pg_policies where tablename='kb_chunks' and policyname='kb_chunks_auth_read_global') then
    create policy kb_chunks_auth_read_global on kb_chunks for select to authenticated using (tenant_key is null);
  end if;
end $$;
