-- ═══════════════════════════════════════════════════════════
-- Comments on SIPOC capability blocks
--
-- Each comment anchors to:
--   * capability_map_id (always)
--   * capability_id     (always — comments are per-capability)
--   * region            ('S' | 'I' | 'P' | 'O' | 'C')
--   * item_type/item_id (optional — points to a specific input/output)
--
-- Anonymous viewers (via /share/<code>) can read and write comments
-- as long as the parent map has an active share link. Org members
-- can read/write/delete comments on their org's maps.
--
-- SAFE / NON-DESTRUCTIVE:
--   * create table if not exists
--   * create policy if not exists (wrapped in DO block)
--   * No drop / rename / update / delete statements
-- ═══════════════════════════════════════════════════════════

create table if not exists sipoc_comments (
  id uuid primary key default gen_random_uuid(),
  capability_map_id uuid not null references capability_maps(id) on delete cascade,
  capability_id uuid not null references capabilities(id) on delete cascade,
  region text not null check (region in ('S','I','P','O','C')),
  item_type text,         -- e.g. 'input' | 'output' | null
  item_id uuid,           -- references capability_inputs.id or capability_outputs.id when item_type set
  author_name text not null check (length(trim(author_name)) > 0),
  body text not null check (length(trim(body)) > 0),
  created_at timestamptz default now()
);

create index if not exists idx_sipoc_comments_map on sipoc_comments(capability_map_id);
create index if not exists idx_sipoc_comments_capability on sipoc_comments(capability_id);
create index if not exists idx_sipoc_comments_item on sipoc_comments(item_id);

alter table sipoc_comments enable row level security;

do $$ begin
  -- Org members: full read on their org's maps
  if not exists (select 1 from pg_policies where tablename = 'sipoc_comments' and policyname = 'sipoc_comments_org_select') then
    create policy sipoc_comments_org_select on sipoc_comments
      for select using (
        capability_map_id in (
          select id from capability_maps where organization_id in (
            select organization_id from org_members where user_id = auth.uid()
          )
        )
      );
  end if;

  -- Org members: insert on their org's maps
  if not exists (select 1 from pg_policies where tablename = 'sipoc_comments' and policyname = 'sipoc_comments_org_insert') then
    create policy sipoc_comments_org_insert on sipoc_comments
      for insert with check (
        capability_map_id in (
          select id from capability_maps where organization_id in (
            select organization_id from org_members where user_id = auth.uid()
          )
        )
      );
  end if;

  -- Org members: delete on their org's maps (moderation)
  if not exists (select 1 from pg_policies where tablename = 'sipoc_comments' and policyname = 'sipoc_comments_org_delete') then
    create policy sipoc_comments_org_delete on sipoc_comments
      for delete using (
        capability_map_id in (
          select id from capability_maps where organization_id in (
            select organization_id from org_members where user_id = auth.uid()
          )
        )
      );
  end if;

  -- Anon: read comments when the map has a non-expired share link
  if not exists (select 1 from pg_policies where tablename = 'sipoc_comments' and policyname = 'sipoc_comments_shared_anon_read') then
    create policy sipoc_comments_shared_anon_read on sipoc_comments
      for select using (
        capability_map_id in (
          select capability_map_id from capability_map_shares
          where (expires_at is null or expires_at > now())
        )
      );
  end if;

  -- Anon: insert comments when the map has a non-expired share link
  if not exists (select 1 from pg_policies where tablename = 'sipoc_comments' and policyname = 'sipoc_comments_shared_anon_insert') then
    create policy sipoc_comments_shared_anon_insert on sipoc_comments
      for insert with check (
        capability_map_id in (
          select capability_map_id from capability_map_shares
          where (expires_at is null or expires_at > now())
        )
      );
  end if;
end $$;
