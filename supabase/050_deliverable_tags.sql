-- ═══════════════════════════════════════════════════════════
-- Deliverable tags: a free-form tag structure so the Deliverables view can be
-- pivoted / expanded / collapsed by tag (phase, client, module, workstream,
-- release, etc.). Additive and non-destructive.
-- ═══════════════════════════════════════════════════════════

alter table deliverables add column if not exists tags text[] not null default '{}'::text[];

-- GIN index for tag membership queries / future filtering.
create index if not exists idx_deliverables_tags on deliverables using gin (tags);
