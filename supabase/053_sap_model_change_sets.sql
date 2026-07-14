-- ═══════════════════════════════════════════════════════════
-- SAP Enterprise Data Model change sets: draft "Changes" to the org structure
-- (add / modify company codes, plants, storage locations, sales orgs, purchasing
-- orgs / groups, business areas ...) with from/to per field, generate the
-- Configuration Instructions + the owning workstream agent, and hand off to
-- SAP Solution Studio for execution.
--
-- Org-scoped RLS mirroring the other Studio tables. Additive / non-destructive.
-- ═══════════════════════════════════════════════════════════

create table if not exists sap_model_change_sets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  title text not null,
  description text,
  -- draft | instructions | dispatched | executing | completed
  status text not null default 'draft',
  -- which live snapshot the changes are diffed against
  target_system jsonb not null default '{}'::jsonb,   -- { system, client, controllingArea, pulledOn }
  -- [{ id, entityKind, operation, key, label, fields:[{name,label,from,to}], workstreamCode, agentLabel }]
  changes jsonb not null default '[]'::jsonb,
  -- generated Configuration Instructions package (per-change steps + transport policy)
  instructions jsonb,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_sap_change_sets_org on sap_model_change_sets(organization_id, created_at desc);

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'sap_model_change_sets_updated_at') then
    create trigger sap_model_change_sets_updated_at before update on sap_model_change_sets
      for each row execute function update_updated_at();
  end if;
end $$;

alter table sap_model_change_sets enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='sap_model_change_sets' and policyname='Org members can view sap change sets') then
    create policy "Org members can view sap change sets" on sap_model_change_sets for select
      using (organization_id in (select organization_id from profiles where id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename='sap_model_change_sets' and policyname='Org members can manage sap change sets') then
    create policy "Org members can manage sap change sets" on sap_model_change_sets for all
      using (organization_id in (select organization_id from profiles where id = auth.uid()))
      with check (organization_id in (select organization_id from profiles where id = auth.uid()));
  end if;
end $$;
