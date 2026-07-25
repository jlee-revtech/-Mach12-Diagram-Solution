import type { FioriTileRef } from './types'

// ─────────────────────────────────────────────────────────────
// Seeded "Fiori Reference": a curated, validated starter list of standard
// SAP S/4HANA Fiori tiles plus Dassian A&D add-on tiles, for assigning a
// process step to the app a user would actually launch. Titles + functional
// areas are real; `appId` is included only where well-known. Extend as needed.
// ─────────────────────────────────────────────────────────────

export interface FioriTile extends FioriTileRef {
  area: string   // functional grouping for search/scan
}

const F = (id: string, title: string, area: string, appId?: string): FioriTile =>
  ({ id, title, area, source: 'fiori', ...(appId ? { appId } : {}) })
const D = (id: string, title: string, area: string): FioriTile =>
  ({ id, title, area, source: 'dassian' })

export const FIORI_CATALOG: FioriTile[] = [
  // ── Finance: General Ledger ──
  F('fi-manage-journal-entries', 'Manage Journal Entries', 'Finance · G/L', 'F0717'),
  F('fi-post-general-journal', 'Post General Journal Entries', 'Finance · G/L', 'F0718'),
  F('fi-display-gl-balances', 'Display G/L Account Balances', 'Finance · G/L', 'F0707'),
  F('fi-manage-gl-master', 'Manage G/L Account Master Data', 'Finance · G/L'),
  F('fi-clear-gl', 'Clear G/L Accounts', 'Finance · G/L'),
  F('fi-verify-journal', 'Verify General Journal Entries', 'Finance · G/L'),
  F('fi-intercompany', 'Manage Intercompany Postings', 'Finance · G/L'),
  // ── Finance: AP / AR ──
  F('fi-create-supplier-invoice', 'Create Supplier Invoice', 'Finance · AP', 'F0859'),
  F('fi-manage-supplier-items', 'Manage Supplier Line Items', 'Finance · AP', 'F0712'),
  F('fi-manage-customer-items', 'Manage Customer Line Items', 'Finance · AR', 'F0711'),
  F('fi-manage-payments', 'Manage Automatic Payments', 'Finance · AP'),
  F('fi-process-receivables', 'Process Receivables', 'Finance · AR'),
  // ── Asset Accounting ──
  F('aa-manage-asset-master', 'Manage Fixed Assets (Master Data)', 'Asset Accounting'),
  F('aa-post-acquisition', 'Post Acquisition', 'Asset Accounting'),
  F('aa-asset-explorer', 'Asset Accounting Explorer', 'Asset Accounting'),
  F('aa-depreciation-run', 'Schedule Depreciation Run', 'Asset Accounting'),
  F('aa-asset-retirement', 'Post Asset Retirement', 'Asset Accounting'),
  // ── Controlling ──
  F('co-manage-cost-centers', 'Manage Cost Centers', 'Controlling'),
  F('co-manage-cost-center-master', 'Manage Cost Center Master Data', 'Controlling'),
  F('co-manage-profit-centers', 'Manage Profit Centers', 'Controlling'),
  F('co-manage-activity-types', 'Manage Activity Types', 'Controlling'),
  F('co-statistical-key-figures', 'Manage Statistical Key Figures', 'Controlling'),
  F('co-manage-internal-orders', 'Manage Internal Orders', 'Controlling'),
  F('co-allocations', 'Manage Allocations', 'Controlling'),
  F('co-run-allocation', 'Run Allocations', 'Controlling'),
  F('co-overhead-calc', 'Run Overhead Calculation', 'Controlling'),
  F('co-profitability', 'Profitability Analysis', 'Controlling'),
  // ── Project System ──
  F('ps-project-control', 'Project Control - Projects', 'Project System'),
  F('ps-project-builder', 'Project Builder', 'Project System', 'CJ20N'),
  F('ps-manage-projects', 'Manage Projects', 'Project System'),
  F('ps-plan-project', 'Plan Project Costs', 'Project System'),
  F('ps-actual-settlement', 'Actual Settlement: Projects', 'Project System', 'CJ88'),
  F('ps-budget', 'Manage Project Budget', 'Project System'),
  F('ps-wbs-elements', 'Manage WBS Elements', 'Project System'),
  // ── Procurement (MM) ──
  F('mm-manage-pr', 'Manage Purchase Requisitions', 'Procurement', 'F1048'),
  F('mm-create-pr', 'Create Purchase Requisition', 'Procurement', 'F1643'),
  F('mm-manage-po', 'Manage Purchase Orders', 'Procurement', 'F0842'),
  F('mm-create-po', 'Create Purchase Order', 'Procurement', 'ME21N'),
  F('mm-post-goods-receipt', 'Post Goods Receipt', 'Procurement', 'MIGO'),
  F('mm-supplier-evaluation', 'Monitor Supplier Confirmations', 'Procurement'),
  F('mm-manage-material', 'Manage Material Master', 'Materials'),
  F('mm-material-docs', 'Material Documents Overview', 'Materials'),
  // ── Sales (SD) ──
  F('sd-manage-sales-orders', 'Manage Sales Orders', 'Sales', 'F1873'),
  F('sd-create-sales-order', 'Create Sales Orders', 'Sales', 'VA01'),
  F('sd-schedule-billing', 'Schedule Billing Creation', 'Sales'),
  F('sd-manage-billing', 'Manage Billing Documents', 'Sales'),
  // ── Production (PP) ──
  F('pp-manage-production-orders', 'Manage Production Orders', 'Production'),
  F('pp-confirm-operations', 'Confirm Production Operations', 'Production'),
  F('pp-run-mrp', 'Schedule MRP Runs', 'Production'),
  F('pp-capacity', 'Manage Production Capacity', 'Production'),
  // ── Plant Maintenance / Quality ──
  F('pm-manage-maint-orders', 'Manage Maintenance Orders', 'Plant Maintenance'),
  F('qm-record-results', 'Record Inspection Results', 'Quality'),
  // ── Bank / Treasury ──
  F('tr-manage-banks', 'Manage Banks', 'Treasury · Bank'),
  F('tr-bank-statements', 'Manage Incoming Bank Statements', 'Treasury · Bank'),
  F('tr-cash-position', 'Manage Cash Position', 'Treasury · Cash'),
  F('tr-cash-flow-analyzer', 'Cash Flow Analyzer', 'Treasury · Cash'),
  F('tr-manage-bank-accounts', 'Manage Bank Accounts', 'Treasury · Bank'),
  F('tr-track-bank-transfers', 'Track Bank Transfers', 'Treasury · Bank'),
  // ── HCM / Time ──
  F('hcm-my-timesheet', 'My Timesheet', 'HCM · Time', 'F1823'),
  F('hcm-approve-timesheets', 'Approve Timesheets', 'HCM · Time'),
  F('hcm-run-payroll', 'Run Payroll', 'HCM · Payroll'),
  F('hcm-record-working-times', 'Record Working Times (CATS)', 'HCM · Time', 'CAT2'),
  F('hcm-transfer-time-data', 'Transfer Time Data to Controlling', 'HCM · Time', 'CAT7'),
  F('hcm-maintain-hr-master', 'Maintain HR Master Data', 'HCM · Core', 'PA30'),
  F('hcm-org-management', 'Organizational Management', 'HCM · Core', 'PPOME'),

  // ── Finance: Close / Consolidation ──
  F('fi-manage-recurring-journal', 'Manage Recurring Journal Entries', 'Finance · Close'),
  F('fi-post-currency-adjustments', 'Post Currency Adjustments', 'Finance · Close'),
  F('fi-manage-closing-tasks', 'Manage Closing Tasks', 'Finance · Close'),
  F('fi-trial-balance', 'Trial Balance', 'Finance · Reporting'),
  F('fi-financial-statement', 'Display Financial Statement', 'Finance · Reporting'),
  F('fi-gr-manage-group-structure', 'Manage Group Structure', 'Finance · Consolidation'),
  F('fi-gr-run-consolidation', 'Run Consolidation Tasks', 'Finance · Consolidation'),
  F('fi-gr-group-data-analysis', 'Group Data Analysis', 'Finance · Consolidation'),
  // ── Finance: AP / AR extras ──
  F('fi-post-incoming-payments', 'Post Incoming Payments', 'Finance · AR', 'F1345'),
  F('fi-enter-incoming-invoice', 'Enter Incoming Invoice', 'Finance · AP', 'MIRO'),
  F('fi-manage-payment-proposals', 'Manage Payment Proposals', 'Finance · AP'),
  F('fi-manage-dunning', 'Manage Dunning Notices', 'Finance · AR'),
  F('fi-manage-credit-accounts', 'Manage Credit Accounts', 'Finance · AR'),
  F('fi-manage-dispute-cases', 'Manage Dispute Cases', 'Finance · AR'),
  // ── Margin Analysis ──
  F('co-market-segments', 'Analyze Market Segments (Margin Analysis)', 'Controlling'),
  F('co-pl-analysis', 'P&L Statement Analysis', 'Controlling'),

  // ── Sales / Billing extras ──
  F('sd-create-sales-contract', 'Create Sales Contracts', 'Sales', 'VA41'),
  F('sd-manage-sales-contracts', 'Manage Sales Contracts', 'Sales'),
  F('sd-manage-customer-returns', 'Manage Customer Returns', 'Sales'),
  F('sd-manage-credit-memo-requests', 'Manage Credit Memo Requests', 'Sales'),
  F('sd-create-billing-documents', 'Create Billing Documents', 'Sales · Billing', 'VF01'),
  F('sd-resource-related-billing', 'Resource-Related Billing', 'Sales · Billing', 'DP91'),
  F('sd-sales-order-fulfillment', 'Sales Order Fulfillment Monitor', 'Sales'),
  F('sd-manage-debit-memo-requests', 'Manage Debit Memo Requests', 'Sales · Billing'),

  // ── Procurement extras ──
  F('mm-manage-rfq', 'Manage Requests for Quotation', 'Procurement'),
  F('mm-manage-supplier-quotations', 'Manage Supplier Quotations', 'Procurement'),
  F('mm-manage-purchase-contracts', 'Manage Purchase Contracts', 'Procurement'),
  F('mm-manage-scheduling-agreements', 'Manage Scheduling Agreements', 'Procurement'),
  F('mm-manage-service-entry', 'Manage Service Entry Sheets', 'Procurement'),
  F('mm-manage-sources-of-supply', 'Manage Sources of Supply', 'Procurement'),
  F('mm-monitor-po-items', 'Monitor Purchase Order Items', 'Procurement'),
  F('mm-manage-info-records', 'Manage Purchasing Info Records', 'Procurement'),
  F('mm-manage-supplier-invoices', 'Manage Supplier Invoices', 'Procurement'),

  // ── Inventory / Warehouse / Logistics ──
  F('im-manage-stock', 'Manage Stock', 'Inventory'),
  F('im-stock-single-material', 'Stock - Single Material', 'Inventory'),
  F('im-transfer-stock', 'Transfer Stock - In-Plant', 'Inventory'),
  F('im-physical-inventory', 'Manage Physical Inventory Documents', 'Inventory'),
  F('im-count-physical-inventory', 'Count Physical Inventory', 'Inventory'),
  F('ewm-warehouse-tasks', 'Process Warehouse Tasks', 'Warehouse (EWM)'),
  F('ewm-manage-handling-units', 'Manage Handling Units', 'Warehouse (EWM)'),
  F('ewm-manage-inbound-deliveries', 'Manage Inbound Deliveries', 'Warehouse (EWM)'),
  F('le-create-outbound-delivery', 'Create Outbound Delivery', 'Logistics', 'VL01N'),
  F('le-manage-outbound-deliveries', 'Manage Outbound Deliveries', 'Logistics'),
  F('le-pick-outbound-delivery', 'Pick Outbound Delivery', 'Logistics'),
  F('le-post-goods-issue', 'Post Goods Issue', 'Logistics', 'VL02N'),
  F('tm-manage-freight-orders', 'Manage Freight Orders', 'Transportation (TM)'),
  F('tm-track-shipments', 'Track Shipments', 'Transportation (TM)'),

  // ── Production extras ──
  F('pp-create-production-order', 'Create Production Order', 'Production', 'CO01'),
  F('pp-convert-planned-orders', 'Convert Planned Orders', 'Production'),
  F('pp-monitor-material-coverage', 'Monitor Material Coverage', 'Production · MRP', 'MD04'),
  F('pp-manage-pirs', 'Manage Planned Independent Requirements', 'Production · Planning', 'MD61'),
  F('pp-release-production-orders', 'Release Production Orders', 'Production'),
  F('pp-manage-work-centers', 'Manage Work Centers', 'Production', 'CR02'),
  F('pp-manage-production-versions', 'Manage Production Versions', 'Production'),
  F('pp-shop-floor-dispatching', 'Dispatch Production Operations', 'Production'),

  // ── Quality Management ──
  F('qm-manage-inspection-lots', 'Manage Inspection Lots', 'Quality', 'QA32'),
  F('qm-manage-usage-decisions', 'Manage Usage Decisions', 'Quality'),
  F('qm-manage-quality-notifications', 'Manage Quality Notifications', 'Quality', 'QM01'),
  F('qm-manage-quality-tasks', 'Manage Quality Tasks', 'Quality'),
  F('qm-manage-inspection-plans', 'Manage Inspection Plans', 'Quality', 'QP01'),
  F('qm-quality-certificates', 'Manage Quality Certificates', 'Quality'),
  F('qm-manage-control-charts', 'Manage Control Charts', 'Quality'),
  F('qm-calibration', 'Manage Calibration of Test Equipment', 'Quality'),

  // ── Engineering / PLM ──
  F('plm-manage-documents', 'Manage Documents (DMS)', 'Engineering · PLM', 'CV01N'),
  F('plm-manage-material-bom', 'Maintain Material BOM', 'Engineering · PLM', 'CS01'),
  F('plm-manage-change-records', 'Manage Engineering Change Records', 'Engineering · PLM', 'CC01'),
  F('plm-manage-routings', 'Maintain Routings', 'Engineering · PLM', 'CA01'),
  F('plm-manage-characteristics', 'Manage Characteristics', 'Engineering · PLM', 'CT04'),
  F('plm-manage-classes', 'Manage Classification', 'Engineering · PLM', 'CL02'),
  F('plm-handover-to-manufacturing', 'Hand Over Product Structure to Manufacturing', 'Engineering · PLM'),
  F('plm-manage-product-structure', 'Manage Product Structure', 'Engineering · PLM'),

  // ── Enterprise Asset Management (PM) ──
  F('pm-manage-maint-notifications', 'Manage Maintenance Notifications', 'Plant Maintenance', 'IW21'),
  F('pm-create-maint-request', 'Create Maintenance Request', 'Plant Maintenance'),
  F('pm-manage-equipment', 'Manage Equipment (Technical Objects)', 'Plant Maintenance', 'IE01'),
  F('pm-manage-functional-locations', 'Manage Functional Locations', 'Plant Maintenance', 'IL01'),
  F('pm-manage-maintenance-plans', 'Manage Maintenance Plans', 'Plant Maintenance', 'IP42'),
  F('pm-schedule-maintenance-plans', 'Schedule Maintenance Plans', 'Plant Maintenance', 'IP10'),
  F('pm-confirm-maintenance-jobs', 'Confirm Maintenance Jobs', 'Plant Maintenance', 'IW41'),

  // ── Service / MRO ──
  F('cs-manage-service-orders', 'Manage Service Orders', 'Service · MRO'),
  F('cs-manage-service-notifications', 'Manage Service Notifications', 'Service · MRO'),
  F('cs-manage-service-contracts', 'Manage Service Contracts', 'Service · MRO'),
  F('cs-manage-warranty-claims', 'Manage Warranty Claims', 'Service · MRO'),
  F('cs-manage-inhouse-repairs', 'Manage In-House Repairs', 'Service · MRO'),
  F('cs-manage-returns-for-repair', 'Manage Customer Returns for Repair', 'Service · MRO'),

  // ── Trade Compliance (GTS) ──
  F('gts-trade-compliance-cockpit', 'Trade Compliance Cockpit (GTS)', 'Trade Compliance'),
  F('gts-manage-export-licenses', 'Manage Export Licenses (GTS)', 'Trade Compliance'),
  F('gts-classify-products', 'Classify Products - Legal Control (GTS)', 'Trade Compliance'),

  // ── Master Data ──
  F('md-manage-business-partner', 'Manage Business Partner Master Data', 'Master Data', 'BP'),
  F('md-manage-customer-master', 'Manage Customer Master Data', 'Master Data'),
  F('md-manage-supplier-master', 'Manage Supplier Master Data', 'Master Data'),
  F('md-manage-product-master', 'Manage Product Master Data', 'Master Data'),
  F('md-mass-maintenance', 'Mass Maintenance of Master Data', 'Master Data', 'MM17'),

  // ── Cross-App / Workflow / Analytics ──
  F('ca-my-inbox', 'My Inbox (Approvals)', 'Cross-App', 'F0862'),
  F('ca-manage-workflows', 'Manage Workflows', 'Cross-App'),
  F('ca-manage-situations', 'Manage Situation Types', 'Cross-App'),
  F('ca-query-browser', 'Query Browser', 'Analytics'),
  F('ca-manage-kpis', 'Manage KPIs and Reports', 'Analytics'),
  F('ca-manage-teams', 'Manage Teams and Responsibilities', 'Cross-App'),

  // ── Dassian A&D add-on tiles ──
  D('dsn-ppc-workbench', 'PPC Workbench', 'Dassian · Project'),
  D('dsn-ppc-analytics', 'PPC Analytics', 'Dassian · Project'),
  D('dsn-evm-reporting', 'EVM Reporting (CPR/IPMR)', 'Dassian · Project'),
  D('dsn-bid-estimating', 'Bid Estimating', 'Dassian · Project'),
  D('dsn-cam-assignments', 'Cost Account Manager Assignments', 'Dassian · Project'),
  D('dsn-risk-register', 'Risk Register', 'Dassian · Project'),
  D('dsn-repsnap', 'Period Snapshot (REPSNAP)', 'Dassian · Project'),
  D('dsn-contract-workbench', 'Contract Workbench', 'Dassian · Contracts'),
  D('dsn-master-contract', 'Master Contract', 'Dassian · Contracts'),
  D('dsn-modifications', 'Contract Modifications', 'Dassian · Contracts'),
  D('dsn-flowdown', 'Flowdown Clause Library', 'Dassian · Contracts'),
  D('dsn-abs', 'Acceptance Billing Summary (ABS)', 'Dassian · Billing'),
  D('dsn-dd250', 'DD250 Deliveries', 'Dassian · Billing'),
  D('dsn-pbp', 'Performance Based Payments (PBP)', 'Dassian · Billing'),
  D('dsn-bil-billing', 'BIL Billing', 'Dassian · Billing'),
  D('dsn-payment-plans', 'Payment Plans', 'Dassian · Billing'),
  D('dsn-oh-calc', 'Overhead Calculation (OH)', 'Dassian · Cost'),
  D('dsn-forward-rate', 'Forward Rate Engine (FR)', 'Dassian · Cost'),
  D('dsn-rate-pricing', 'Rate Pricing (DRP)', 'Dassian · Cost'),
  D('dsn-rate-billing', 'Rate Billing (DRB)', 'Dassian · Cost'),
  D('dsn-eoc-groups', 'Element of Cost (EOC) Groups', 'Dassian · Cost'),
  D('dsn-scfm', 'Supplier Contract Financial Mgmt (SCFM)', 'Dassian · Cost'),
  D('dsn-incurred-cost', 'Incurred Cost Submission', 'Dassian · Compliance'),
  D('dsn-sis-p6', 'Primavera P6 Schedule Integration (SIS)', 'Dassian · Project'),
  D('dsn-cats-approval', 'CATS Timesheet Approval', 'Dassian · Project'),
]

export function searchFioriTiles(query: string, source?: 'fiori' | 'dassian'): FioriTile[] {
  const q = query.trim().toLowerCase()
  let list = FIORI_CATALOG
  if (source) list = list.filter(t => t.source === source)
  if (!q) return list
  return list.filter(t =>
    t.title.toLowerCase().includes(q) ||
    t.area.toLowerCase().includes(q) ||
    (t.appId?.toLowerCase().includes(q) ?? false)
  )
}
