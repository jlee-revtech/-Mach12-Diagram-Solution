-- ═══════════════════════════════════════════════════════════
-- Reusable Tags (org-scoped) attachable to capability inputs
-- and to individual dimensions within inputs.
--
-- SAFE / NON-DESTRUCTIVE:
--   * create table if not exists       → no-op if already present
--   * add column if not exists         → defaults existing rows to '{}'
--   * no drop / rename / update / delete statements
--
-- Suggested run (Supabase SQL Editor):
--
--   begin;
--   -- paste statements below
--   select count(*) from information_products;
--   select count(*) from capability_inputs;
--   select count(*) from capability_inputs where tag_ids = '{}';
--   -- if counts look correct:
--   commit;
--   -- else: rollback;
-- ═══════════════════════════════════════════════════════════

create table if not exists tags (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  color text default '#64748B',
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (organization_id, name)
);

create index if not exists idx_tags_org on tags(organization_id);

alter table tags enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'tags' and policyname = 'tags_org_members_all') then
    create policy tags_org_members_all on tags
      for all
      using (
        organization_id in (
          select organization_id from org_members where user_id = auth.uid()
        )
      )
      with check (
        organization_id in (
          select organization_id from org_members where user_id = auth.uid()
        )
      );
  end if;
end $$;

alter table capability_inputs
  add column if not exists tag_ids uuid[] default '{}';

-- Dimensions live inside the jsonb `dimensions` column on
-- capability_inputs. Tag assignment is stored as a `tag_ids: string[]`
-- field on each dimension object — no schema change needed.
