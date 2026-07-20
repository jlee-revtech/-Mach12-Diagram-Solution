-- ═══════════════════════════════════════════════════════════
-- Mach12.ai — Workshop Primary Workstreams + Prep Attachments
--   (1) workshops.primary_workstream_codes — the workstream(s) the workshop is
--       anchored on. Non-primary ("integrated") workstreams frame their prep
--       input through the primary lens (agent-core threads it into the brief
--       and every section generate).
--   (2) workshop_attachments — facilitator-uploaded reference documents.
--       Text is extracted server-side (same pipeline as /knowledge uploads)
--       and threaded as context into the brief and every section generate.
--
-- Run via scripts/apply-migration.mjs or the Supabase Management API.
-- SAFE / NON-DESTRUCTIVE: add-if-not-exists only. Re-running is safe.
-- ═══════════════════════════════════════════════════════════

-- ─── (1) primary workstream(s) ──────────────────────────────
alter table workshops add column if not exists primary_workstream_codes text[] not null default '{}'::text[];

-- ─── (2) prep attachments ───────────────────────────────────
create table if not exists workshop_attachments (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references workshops(id) on delete cascade,
  file_name text not null,
  format text,                                -- pdf | docx | pptx | xlsx | text
  pages int,                                  -- pdf pages / pptx slides / xlsx sheets
  size_bytes int,
  extracted_text text,                        -- server-extracted text, capped
  chars int not null default 0,               -- length of extracted_text before capping
  status text not null default 'extracted',   -- extracted | no_text | failed
  note text,                                  -- e.g. scanned-PDF warning / failure reason
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_ws_attachments_workshop on workshop_attachments(workshop_id);

-- ─── RLS (mirror the 040/046 child-table pattern) ───────────
alter table workshop_attachments enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='workshop_attachments' and policyname='Org members can view workshop_attachments') then
    create policy "Org members can view workshop_attachments" on workshop_attachments for select
      using (workshop_id in (select id from workshops where organization_id in (select organization_id from profiles where id = auth.uid())));
  end if;
  if not exists (select 1 from pg_policies where tablename='workshop_attachments' and policyname='Org members can manage workshop_attachments') then
    create policy "Org members can manage workshop_attachments" on workshop_attachments for all
      using (workshop_id in (select id from workshops where organization_id in (select organization_id from profiles where id = auth.uid())))
      with check (workshop_id in (select id from workshops where organization_id in (select organization_id from profiles where id = auth.uid())));
  end if;
end $$;
