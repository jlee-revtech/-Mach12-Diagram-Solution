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
  // ── Bank ──
  F('tr-manage-banks', 'Manage Banks', 'Treasury · Bank'),
  F('tr-bank-statements', 'Manage Incoming Bank Statements', 'Treasury · Bank'),
  // ── HCM / Time ──
  F('hcm-my-timesheet', 'My Timesheet', 'HCM · Time', 'F1823'),
  F('hcm-approve-timesheets', 'Approve Timesheets', 'HCM · Time'),
  F('hcm-run-payroll', 'Run Payroll', 'HCM · Payroll'),

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
