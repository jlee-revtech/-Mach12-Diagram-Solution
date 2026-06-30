-- ═══════════════════════════════════════════════════════════
-- Mach12.ai / Solution Architecture Studio — Canonical workstream remap
--
-- Aligns the diagram-app workstream catalog to the SAP Solution Studio canonical
-- codes (the 7 A&D value streams + 3 cross-cutting platform agents) and merges
-- the legacy SAS codes into their canonical home, repointing every homed artifact
-- and cross-workstream alignment first so nothing is orphaned.
--
-- Crosswalk (legacy -> canonical):
--   bid-to-win            -> offer-to-cash
--   contract-to-closeout  -> offer-to-cash
--   design-to-release     -> plan-to-produce
--   acquire-to-retire     -> inventory-to-deliver
--   sustainment-mro       -> inventory-to-deliver
--
-- IDEMPOTENT: ensures canonical rows exist, repoints, then drops legacy rows.
-- Safe to re-run (legacy rows already gone -> the inner loop simply continues).
-- ═══════════════════════════════════════════════════════════

do $$
declare
  v_org    uuid;
  v_legacy uuid;
  v_canon  uuid;
  m        record;
begin
  for v_org in select id from organizations loop

    -- 1) Ensure all 10 canonical workstreams exist for this org.
    insert into workstreams (organization_id, code, name, description, color, icon, sort_order, is_standard)
    select v_org, c.code, c.name, c.description, c.color, c.icon, c.sort_order, true
    from (values
      ('record-to-report',       'Record-to-Report (Finance / EVMS / DCAA)',                'End-to-end financial accounting and reporting: GL, assets, cost, indirect rates, settlement, revenue recognition, and close.', '#EAB308', 'ledger',    1),
      ('plan-to-perform',        'Plan-to-Perform (Program & Portfolio Management)',         'EVMS-grade program and portfolio management: baseline, control accounts, work authorization, EAC/ETC, risk, and variance reporting.', '#6366F1', 'portfolio', 2),
      ('plan-to-produce',        'Plan-to-Produce (Engineering & Program Execution)',        'Engineering and configuration management through production planning, MRP, shop-floor execution, and quality.', '#10B981', 'factory',   3),
      ('inventory-to-deliver',   'Inventory-to-Deliver (Logistics, Property & Sustainment)', 'Materials management, warehousing, deliveries, government/contractor property accountability, and depot/field sustainment (MRO).', '#14B8A6', 'truck',     4),
      ('source-to-pay',          'Source-to-Pay (Procurement & Subcontracts)',               'Supplier management, sourcing, subcontracting with FAR/DFARS flowdowns, and procure-to-pay.', '#F59E0B', 'cart',      5),
      ('offer-to-cash',          'Offer-to-Cash (Capture, Contracts, Billing & Rev-Rec)',    'Sell-side lifecycle from capture and proposal through contract setup, CLIN/SLIN billing, deliveries acceptance, and revenue recognition.', '#8B5CF6', 'contract',  6),
      ('hire-to-retire',         'Hire-to-Retire (Workforce / Clearances)',                  'Workforce lifecycle: talent and clearances, records, compliant timekeeping, payroll, labor distribution, and offboarding.', '#F97316', 'people',    7),
      ('security-authorization', 'Security & Authorization',                                 'Cross-stream role design, authorizations, segregation-of-duties, and access governance.', '#64748B', 'shield',    8),
      ('analytics-reporting',    'Analytics & Reporting',                                    'Cross-stream embedded analytics, operational and management reporting, and planning.', '#06B6D4', 'chart',     9),
      ('development-technology', 'Development & Technology',                                 'Cross-stream RICEFW, RAP extensions, CDS modeling, integration, and clean-core engineering.', '#0EA5E9', 'code',     10)
    ) as c(code, name, description, color, icon, sort_order)
    where not exists (
      select 1 from workstreams w where w.organization_id = v_org and w.code = c.code
    );

    -- 2) Merge each legacy code into its canonical home.
    for m in select * from (values
      ('bid-to-win',           'offer-to-cash'),
      ('contract-to-closeout', 'offer-to-cash'),
      ('design-to-release',    'plan-to-produce'),
      ('acquire-to-retire',    'inventory-to-deliver'),
      ('sustainment-mro',      'inventory-to-deliver')
    ) as map(legacy, canon) loop

      select id into v_legacy from workstreams where organization_id = v_org and code = map.legacy;
      select id into v_canon  from workstreams where organization_id = v_org and code = map.canon;
      if v_legacy is null or v_canon is null then continue; end if;

      -- repoint every homed-artifact FK (10 pillar tables)
      update diagrams             set workstream_id = v_canon where workstream_id = v_legacy;
      update capability_maps      set workstream_id = v_canon where workstream_id = v_legacy;
      update capabilities         set workstream_id = v_canon where workstream_id = v_legacy;
      update process_models       set workstream_id = v_canon where workstream_id = v_legacy;
      update process_nodes        set workstream_id = v_canon where workstream_id = v_legacy;
      update personas             set workstream_id = v_canon where workstream_id = v_legacy;
      update process_roles        set workstream_id = v_canon where workstream_id = v_legacy;
      update information_products set workstream_id = v_canon where workstream_id = v_legacy;
      update system_data_elements set workstream_id = v_canon where workstream_id = v_legacy;
      update logical_systems      set workstream_id = v_canon where workstream_id = v_legacy;

      -- repoint cross-workstream alignments, dropping any that would collide
      -- with an alignment that already exists on the canonical workstream
      delete from workstream_alignments a
        where a.workstream_id = v_legacy
          and exists (
            select 1 from workstream_alignments b
            where b.workstream_id = v_canon
              and b.entity_type = a.entity_type
              and b.entity_id   = a.entity_id
          );
      update workstream_alignments set workstream_id = v_canon where workstream_id = v_legacy;

      -- the legacy row is now unreferenced; remove it
      delete from workstreams where id = v_legacy;

    end loop;

  end loop;
end $$;
