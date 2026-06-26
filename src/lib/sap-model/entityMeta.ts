import type { OrgEntityKind } from './types'

// Visual identity per SAP org-structure entity kind. Colors echo the diagram-app
// system palette so the SAP model feels native to the canvas.
export const ENTITY_META: Record<OrgEntityKind, { label: string; abbr: string; color: string }> = {
  controlling_area: { label: 'Controlling Area', abbr: 'CO', color: '#2563EB' },
  company_code: { label: 'Company Code', abbr: 'CC', color: '#06B6D4' },
  plant: { label: 'Plant', abbr: 'PL', color: '#10B981' },
  storage_location: { label: 'Storage Location', abbr: 'SL', color: '#14B8A6' },
  sales_org: { label: 'Sales Organization', abbr: 'VK', color: '#8B5CF6' },
  purchasing_org: { label: 'Purchasing Org', abbr: 'EK', color: '#F97316' },
  profit_center: { label: 'Profit Center', abbr: 'PC', color: '#EAB308' },
  cost_center: { label: 'Cost Center', abbr: 'KS', color: '#EC4899' },
  business_area: { label: 'Business Area', abbr: 'BA', color: '#64748B' },
  wbs_ra: { label: 'Project / WBS (RA)', abbr: 'RA', color: '#F43F5E' },
}

export const ENTITY_ORDER: OrgEntityKind[] = [
  'controlling_area', 'company_code', 'plant', 'storage_location',
  'sales_org', 'purchasing_org', 'profit_center', 'cost_center',
  'business_area', 'wbs_ra',
]
