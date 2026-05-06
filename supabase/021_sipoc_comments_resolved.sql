-- ═══════════════════════════════════════════════════════════
-- Resolution state for SIPOC comment threads
--
-- A thread = group of sipoc_comments rows sharing
-- (capability_map_id, capability_id, region, item_id).
--
-- Resolution is a per-thread concept stored on every row of the
-- thread. Resolving a thread sets resolved_at/resolved_by_name on
-- all its rows; posting a new reply naturally creates a row with
-- resolved_at = NULL, which re-opens the thread.
--
-- Anonymous viewers via /share/<code> can resolve and unresolve
-- threads (matches their insert rights). Org members can do
-- everything on their org's maps.
--
-- SAFE / NON-DESTRUCTIVE:
--   * add column if not exists
--   * create policy if not exists (wrapped in DO block)
-- ═══════════════════════════════════════════════════════════

alter table sipoc_comments
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by_name text;

create index if not exists idx_sipoc_comments_resolved
  on sipoc_comments(capability_map_id, resolved_at);

do $$ begin
  -- Org members: update on their org's maps (resolve / unresolve)
  if not exists (select 1 from pg_policies where tablename = 'sipoc_comments' and policyname = 'sipoc_comments_org_update') then
    create policy sipoc_comments_org_update on sipoc_comments
      for update using (
        capability_map_id in (
          select id from capability_maps where organization_id in (
            select organization_id from org_members where user_id = auth.uid()
          )
        )
      ) with check (
        capability_map_id in (
          select id from capability_maps where organization_id in (
            select organization_id from org_members where user_id = auth.uid()
          )
        )
      );
  end if;

  -- Anon: update resolution state when the map has a non-expired share link
  if not exists (select 1 from pg_policies where tablename = 'sipoc_comments' and policyname = 'sipoc_comments_shared_anon_update') then
    create policy sipoc_comments_shared_anon_update on sipoc_comments
      for update using (
        capability_map_id in (
          select capability_map_id from capability_map_shares
          where (expires_at is null or expires_at > now())
        )
      ) with check (
        capability_map_id in (
          select capability_map_id from capability_map_shares
          where (expires_at is null or expires_at > now())
        )
      );
  end if;
end $$;
