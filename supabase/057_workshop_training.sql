-- ═══════════════════════════════════════════════════════════
-- Mach12.ai — Workshop Training / Enablement archetype
--   (1) workshops.systems_in_scope — the tools / technology in scope for the
--       session (SAP S/4HANA, Dassian, Twenty5 IPE, Ariba, Fieldglass, ...).
--       Part of the prep context; agent-core threads it into the brief and every
--       section generate (grounds the training tool modules especially).
--   (2) archetype 'training' — the workshop's shape adds a third value alongside
--       'decision' and 'assessment'. Section kinds are free text on
--       workshop_agenda_items.section_kind; training adds 'training' (per role),
--       'curriculum' (Learning Path) and 'certification' (Knowledge Check). No
--       enum change needed.
--   (3) workshop-screenshots storage bucket — public-read bucket the Playwright
--       capture route writes tool screenshots to (referenced by imageUrl inside
--       the training section content JSON). Server writes with the service key
--       (bypasses RLS); public read so the prep view + share page render images.
--
-- Run via scripts/apply-migration.mjs or the Supabase Management API.
-- SAFE / NON-DESTRUCTIVE: add-if-not-exists only. Re-running is safe.
-- ═══════════════════════════════════════════════════════════

-- ─── (1) tools / technology in scope ────────────────────────
alter table workshops add column if not exists systems_in_scope text[] not null default '{}'::text[];

-- ─── (3) screenshots storage bucket ─────────────────────────
insert into storage.buckets (id, name, public)
values ('workshop-screenshots', 'workshop-screenshots', true)
on conflict (id) do update set public = true;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Public read workshop-screenshots'
  ) then
    create policy "Public read workshop-screenshots" on storage.objects for select
      using (bucket_id = 'workshop-screenshots');
  end if;
end $$;
