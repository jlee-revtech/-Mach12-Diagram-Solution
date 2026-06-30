-- ═══════════════════════════════════════════════════════════
-- Mach12.ai / Solution Architecture Studio — Anon read for
-- System Data Elements on shared capability maps.
--
-- The read-only "Share" link header now offers "Export to Excel"
-- (full capability-map workbook). That workbook includes a Data
-- Elements sheet and the per-IP "Data Elements" column, both of
-- which read from system_data_elements. Migration 015 granted anon
-- read on capabilities / inputs / outputs / personas /
-- information_products / logical_systems / tags, and 030 already
-- grants anon read on workstreams for shared maps — but
-- system_data_elements was never opened up, so those columns came
-- back blank for share viewers. This adds the missing policy so the
-- anon export matches the authed export.
--
-- SAFE / NON-DESTRUCTIVE: create policy if not exists (DO block).
-- No drop / rename / update / delete.
-- ═══════════════════════════════════════════════════════════

do $$ begin
  -- system_data_elements: public read for orgs with an active shared map
  if not exists (
    select 1 from pg_policies
    where tablename = 'system_data_elements'
      and policyname = 'shared_sde_anon_read'
  ) then
    create policy shared_sde_anon_read on system_data_elements
      for select using (
        organization_id in (
          select organization_id from capability_map_shares
          where (expires_at is null or expires_at > now())
        )
      );
  end if;
end $$;
