-- ═══════════════════════════════════════════════════════════
-- Mach12.ai / Solution Architecture Studio — Canonical workstream remap
--
-- Aligns the diagram-app workstream catalog to the SAP Solution Studio canonical
-- codes: 10 A&D value streams + 3 cross-cutting platform agents. Only bid-to-win
-- and contract-to-closeout fold (into offer-to-cash); design-to-release,
-- acquire-to-retire, and sustainment-mro are first-class standalone streams.
-- Homed artifacts and cross-workstream alignments on a folded code are repointed
-- to the canonical row first so nothing is orphaned.
--
-- Crosswalk (legacy -> canonical):
--   bid-to-win            -> offer-to-cash
--   contract-to-closeout  -> offer-to-cash
--
-- IDEMPOTENT: ensures the 13 canonical rows exist, repoints, then drops the two
-- folded legacy rows. Safe to re-run.
-- ═══════════════════════════════════════════════════════════

do $$
declare
  v_org    uuid;
  v_legacy uuid;
  v_canon  uuid;
  m        record;
begin
  for v_org in select id from organizations loop

    -- 1) Ensure all 13 canonical workstreams exist for this org.
    insert into workstreams (organization_id, code, name, description, color, icon, sort_order, is_standard)
    select v_org, c.code, c.name, c.description, c.color, c.icon, c.sort_order, true
    from (values
      ('record-to-report',       'Record-to-Report (Finance / EVMS / DCAA)',                'End-to-end financial accounting and reporting: GL, assets, cost, indirect rates, settlement, revenue recognition, and close.', '#EAB308', 'ledger',    1),
      ('plan-to-perform',        'Plan-to-Perform (Program & Portfolio Management)',         'EVMS-grade program and portfolio management: baseline, control accounts, work authorization, EAC/ETC, risk, and variance reporting.', '#6366F1', 'portfolio', 2),
      ('design-to-release',      'Design-to-Release (Engineering / PLM)',                    'Requirements through design, configuration management, engineering change, and BOM release with first article inspection.', '#8B5CF6', 'drafting',  3),
      ('plan-to-produce',        'Plan-to-Produce (Program Execution)',                      'Production planning, MRP, shop-floor execution, quality inspection, and production-order settlement.', '#10B981', 'factory',   4),
      ('inventory-to-deliver',   'Inventory-to-Deliver (Logistics & Delivery)',              'Materials management, warehousing/EWM, inventory, and outbound delivery with DD250 acceptance.', '#14B8A6', 'truck',     5),
      ('acquire-to-retire',      'Acquire-to-Retire (Asset / Property / GFP)',               'Government and contractor property accountability and fixed-asset lifecycle from acquisition through disposition.', '#EC4899', 'asset',     6),
      ('sustainment-mro',        'Sustainment / MRO',                                        'Depot and field maintenance, repair, and overhaul with installed-base and warranty management.', '#F43F5E', 'wrench',    7),
      ('source-to-pay',          'Source-to-Pay (Procurement & Subcontracts)',               'Supplier management, sourcing, subcontracting with FAR/DFARS flowdowns, and procure-to-pay.', '#F59E0B', 'cart',      8),
      ('offer-to-cash',          'Offer-to-Cash (Capture, Contracts, Billing & Rev-Rec)',    'Sell-side lifecycle from capture and proposal through contract setup, CLIN/SLIN billing, deliveries acceptance, and revenue recognition.', '#2563EB', 'contract',  9),
      ('hire-to-retire',         'Hire-to-Retire (Workforce / Clearances)',                  'Workforce lifecycle: talent and clearances, records, compliant timekeeping, payroll, labor distribution, and offboarding.', '#F97316', 'people',   10),
      ('security-authorization', 'Security & Authorization',                                 'Cross-stream role design, authorizations, segregation-of-duties, and access governance.', '#64748B', 'shield',   11),
      ('analytics-reporting',    'Analytics & Reporting',                                    'Cross-stream embedded analytics, operational and management reporting, and planning.', '#06B6D4', 'chart',    12),
      ('development-technology', 'Development & Technology',                                 'Cross-stream RICEFW, RAP extensions, CDS modeling, integration, and clean-core engineering.', '#0EA5E9', 'code',     13)
    ) as c(code, name, description, color, icon, sort_order)
    where not exists (
      select 1 from workstreams w where w.organization_id = v_org and w.code = c.code
    );

    -- 2) Fold the two legacy capture/contract codes into offer-to-cash.
    for m in select * from (values
      ('bid-to-win',           'offer-to-cash'),
      ('contract-to-closeout', 'offer-to-cash')
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
