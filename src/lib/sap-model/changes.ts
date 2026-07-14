// Draft "Changes" to the SAP enterprise data model and turn them into executable
// Configuration Instructions, each routed to the workstream agent that owns the
// org object. Deterministic — the org-object → workstream mapping and the SAP
// config steps (T-codes, tables, transport policy) are known, not guessed.
import type { SapEnterpriseModel } from './types'

export type OrgChangeKind =
  | 'company_code'
  | 'plant'
  | 'storage_location'
  | 'sales_org'
  | 'purchasing_org'
  | 'purchasing_group'
  | 'business_area'

export type ChangeOperation = 'add' | 'modify'

export interface ChangeField {
  name: string
  label: string
  from: string | null // null when adding
  to: string
}

export interface ChangeItem {
  id: string
  entityKind: OrgChangeKind
  operation: ChangeOperation
  key: string
  label: string
  fields: ChangeField[]
  workstreamCode: string
  agentLabel: string
}

export interface TargetSystem {
  system?: string
  client?: string
  controllingArea?: string
  pulledOn?: string
}

export interface ChangeSet {
  id: string
  title: string
  description?: string | null
  status: string
  target_system: TargetSystem
  changes: ChangeItem[]
  instructions?: InstructionPackage | null
  created_at?: string
  updated_at?: string
}

// ── Field + config schema per org object ────────────────────────────────────

export interface FieldSpec { name: string; label: string; help?: string }

export interface EntitySchema {
  kind: OrgChangeKind
  label: string
  keyField: string
  keyLabel: string
  fields: FieldSpec[]
  /** Canonical workstream code that owns this org object. */
  workstreamCode: string
  workstreamLabel: string
  /** Primary maintenance T-code. */
  primaryTcode: string
  /** Config tables an agent introspects to see current state. */
  tables: string[]
  transportByDefault: boolean
  transportNote: string
}

export const ENTITY_SCHEMAS: Record<OrgChangeKind, EntitySchema> = {
  company_code: {
    kind: 'company_code',
    label: 'Company Code',
    keyField: 'bukrs',
    keyLabel: 'Company Code (BUKRS)',
    fields: [
      { name: 'name', label: 'Name' },
      { name: 'country', label: 'Country' },
      { name: 'currency', label: 'Currency' },
      { name: 'chart', label: 'Chart of Accounts' },
      { name: 'controllingArea', label: 'Controlling Area' },
      { name: 'fiscalVar', label: 'Fiscal Year Variant' },
    ],
    workstreamCode: 'record-to-report',
    workstreamLabel: 'Record-to-Report (Finance)',
    primaryTcode: 'OX02',
    tables: ['T001 (company code)', 'TKA02 (CoCode↔CO area)', 'T004 (chart of accounts assignment)'],
    transportByDefault: true,
    transportNote: 'Company code definition is customizing — capture in a Customizing transport.',
  },
  plant: {
    kind: 'plant',
    label: 'Plant',
    keyField: 'werks',
    keyLabel: 'Plant (WERKS)',
    fields: [
      { name: 'name', label: 'Name' },
      { name: 'bukrs', label: 'Company Code' },
      { name: 'valuationArea', label: 'Valuation Area', help: 'Usually equals the plant' },
      { name: 'country', label: 'Country' },
      { name: 'city', label: 'City' },
    ],
    workstreamCode: 'plan-to-produce',
    workstreamLabel: 'Plan-to-Produce',
    primaryTcode: 'OX10',
    tables: ['T001W (plant)', 'T001K (valuation area↔CoCode)', 'T001 (company code)'],
    transportByDefault: true,
    transportNote: 'Plant definition and CoCode assignment are customizing — capture in a Customizing transport.',
  },
  storage_location: {
    kind: 'storage_location',
    label: 'Storage Location',
    keyField: 'lgort',
    keyLabel: 'Storage Location (LGORT)',
    fields: [
      { name: 'name', label: 'Description' },
      { name: 'werks', label: 'Plant' },
    ],
    workstreamCode: 'inventory-to-deliver',
    workstreamLabel: 'Inventory-to-Deliver',
    primaryTcode: 'OX09',
    tables: ['T001L (storage locations by plant)'],
    transportByDefault: false,
    transportNote:
      'Storage locations (T001L) are usually created directly in each client and are NOT transported. Create in dev, then repeat per client (or enable table transport if your landscape requires it).',
  },
  sales_org: {
    kind: 'sales_org',
    label: 'Sales Organization',
    keyField: 'vkorg',
    keyLabel: 'Sales Org (VKORG)',
    fields: [
      { name: 'name', label: 'Name' },
      { name: 'bukrs', label: 'Company Code' },
    ],
    workstreamCode: 'offer-to-cash',
    workstreamLabel: 'Offer-to-Cash',
    primaryTcode: 'OVX5',
    tables: ['TVKO (sales org)', 'TVKO-BUKRS (sales org↔CoCode)'],
    transportByDefault: true,
    transportNote: 'Sales org definition + CoCode assignment are customizing — capture in a Customizing transport.',
  },
  purchasing_org: {
    kind: 'purchasing_org',
    label: 'Purchasing Organization',
    keyField: 'ekorg',
    keyLabel: 'Purchasing Org (EKORG)',
    fields: [
      { name: 'name', label: 'Name' },
      { name: 'bukrs', label: 'Company Code', help: 'Blank = cross-company purchasing org' },
      { name: 'plants', label: 'Assigned Plants', help: 'Comma-separated plant keys' },
    ],
    workstreamCode: 'source-to-pay',
    workstreamLabel: 'Source-to-Pay',
    primaryTcode: 'OX08',
    tables: ['T024E (purch org)', 'T024W (purch org↔plant)', 'T024E-BUKRS (purch org↔CoCode)'],
    transportByDefault: true,
    transportNote: 'Purchasing org definition + assignments are customizing — capture in a Customizing transport.',
  },
  purchasing_group: {
    kind: 'purchasing_group',
    label: 'Purchasing Group',
    keyField: 'ekgrp',
    keyLabel: 'Purchasing Group (EKGRP)',
    fields: [
      { name: 'name', label: 'Description' },
      { name: 'phone', label: 'Telephone' },
    ],
    workstreamCode: 'source-to-pay',
    workstreamLabel: 'Source-to-Pay',
    primaryTcode: 'OME4',
    tables: ['T024 (purchasing groups)'],
    transportByDefault: true,
    transportNote: 'Purchasing groups (T024) are client-independent customizing — capture in a Customizing transport.',
  },
  business_area: {
    kind: 'business_area',
    label: 'Business Area',
    keyField: 'gsber',
    keyLabel: 'Business Area (GSBER)',
    fields: [{ name: 'name', label: 'Description' }],
    workstreamCode: 'record-to-report',
    workstreamLabel: 'Record-to-Report (Finance)',
    primaryTcode: 'OX03',
    tables: ['TGSB (business areas)'],
    transportByDefault: true,
    transportNote: 'Business areas (TGSB) are client-independent customizing — capture in a Customizing transport.',
  },
}

export const ORG_CHANGE_KINDS = Object.keys(ENTITY_SCHEMAS) as OrgChangeKind[]

export function agentForKind(kind: OrgChangeKind): { workstreamCode: string; agentLabel: string } {
  const s = ENTITY_SCHEMAS[kind]
  return { workstreamCode: s.workstreamCode, agentLabel: s.workstreamLabel }
}

// ── Current-state lookups against the live snapshot (prefill "from") ─────────

export function existingEntities(model: SapEnterpriseModel, kind: OrgChangeKind): { key: string; label: string; fields: Record<string, string> }[] {
  switch (kind) {
    case 'company_code':
      return model.companyCodes.map((c) => ({
        key: c.bukrs, label: `${c.bukrs} — ${c.name}`,
        fields: { name: c.name, country: c.country, currency: c.currency, chart: c.chart, controllingArea: model.controllingArea.kokrs, fiscalVar: model.controllingArea.fiscalVar },
      }))
    case 'plant':
      return model.plants.map((p) => ({
        key: p.werks, label: `${p.werks} — ${p.name}`,
        fields: { name: p.name, bukrs: p.bukrs, valuationArea: p.werks, country: '', city: '' },
      }))
    case 'storage_location':
      return model.plants.flatMap((p) =>
        p.storageLocations.map((l) => ({ key: l, label: `${p.werks} / ${l}`, fields: { name: '', werks: p.werks } }))
      )
    case 'sales_org':
      return model.salesOrgs.map((s) => ({ key: s.vkorg, label: `${s.vkorg} — ${s.name}`, fields: { name: s.name, bukrs: s.bukrs } }))
    case 'purchasing_org':
      return model.purchasingOrgs.map((p) => ({
        key: p.ekorg, label: `${p.ekorg} — ${p.name}`,
        fields: { name: p.name, bukrs: p.bukrs, plants: p.plants.join(', ') },
      }))
    case 'purchasing_group':
      return [] // not in the snapshot; add-only in practice
    case 'business_area':
      return model.businessAreas.map((b) => ({ key: b.gsber, label: `${b.gsber} — ${b.name}`, fields: { name: b.name } }))
    default:
      return []
  }
}

// ── Configuration Instructions ──────────────────────────────────────────────

export interface InstructionStep { seq: number; action: string; ref: string; detail: string }

export interface ChangeInstruction {
  changeId: string
  entityKind: OrgChangeKind
  operation: ChangeOperation
  key: string
  title: string
  workstreamCode: string
  agentLabel: string
  desiredState: Record<string, string>
  introspection: string[]
  steps: InstructionStep[]
  transportNeeded: boolean
  transportNote: string
  prerequisites: string[]
}

export interface InstructionPackage {
  generatedAt: string | null
  targetSystem: TargetSystem
  instructions: ChangeInstruction[]
  summary: { byWorkstream: Record<string, number>; transportsNeeded: number; total: number }
}

const toMap = (c: ChangeItem): Record<string, string> => Object.fromEntries(c.fields.map((f) => [f.name, f.to]))
const changedFields = (c: ChangeItem): ChangeField[] => c.fields.filter((f) => (f.from ?? '') !== f.to)

function stepsFor(c: ChangeItem): { steps: InstructionStep[]; prerequisites: string[] } {
  const s = ENTITY_SCHEMAS[c.entityKind]
  const v = toMap(c)
  const adding = c.operation === 'add'
  const steps: InstructionStep[] = []
  const prereqs: string[] = []
  const push = (action: string, ref: string, detail: string) => steps.push({ seq: steps.length + 1, action, ref, detail })

  switch (c.entityKind) {
    case 'company_code':
      if (adding) {
        push('Define company code', 'OX02 / V_T880', `Create company code ${c.key} "${v.name}" — country ${v.country}, currency ${v.currency}.`)
        push('Assign chart of accounts', 'OB62', `Assign chart of accounts ${v.chart} to company code ${c.key}.`)
        push('Assign fiscal year variant', 'OB37', `Assign fiscal year variant ${v.fiscalVar} to company code ${c.key}.`)
        push('Assign to controlling area', 'OKKP / OX19', `Add company code ${c.key} to controlling area ${v.controllingArea}.`)
        prereqs.push(`Controlling area ${v.controllingArea} exists`, `Chart of accounts ${v.chart} exists`)
      } else {
        for (const f of changedFields(c)) push(`Update ${f.label}`, s.primaryTcode, `Set ${f.label} of company code ${c.key} to "${f.to}" (was "${f.from ?? '—'}").`)
      }
      break
    case 'plant':
      if (adding) {
        push('Define plant', 'OX10 / T001W', `Create plant ${c.key} "${v.name}".`)
        push('Assign plant to company code', 'OX18 / T001K', `Assign plant ${c.key} to company code ${v.bukrs} via valuation area ${v.valuationArea || c.key}.`)
        push('Maintain plant address & calendar', 'OX10', `Maintain address (${[v.city, v.country].filter(Boolean).join(', ') || 'as required'}) and factory calendar for ${c.key}.`)
        prereqs.push(`Company code ${v.bukrs} exists`)
      } else {
        for (const f of changedFields(c)) push(`Update ${f.label}`, f.name === 'bukrs' ? 'OX18 / T001K' : s.primaryTcode, `Set ${f.label} of plant ${c.key} to "${f.to}" (was "${f.from ?? '—'}").`)
      }
      break
    case 'storage_location':
      push(adding ? 'Create storage location' : 'Update storage location', 'OX09 / T001L', `${adding ? 'Create' : 'Update'} storage location ${c.key} "${v.name}" in plant ${v.werks}.`)
      if (adding) prereqs.push(`Plant ${v.werks} exists`)
      break
    case 'sales_org':
      if (adding) {
        push('Define sales organization', 'OVX5 / TVKO', `Create sales org ${c.key} "${v.name}".`)
        push('Assign sales org to company code', 'OVX3', `Assign sales org ${c.key} to company code ${v.bukrs}.`)
        push('Assign distribution channels & divisions', 'OVXA / OVXG', `Assign the required distribution channels and divisions to sales org ${c.key}.`)
        prereqs.push(`Company code ${v.bukrs} exists`)
      } else {
        for (const f of changedFields(c)) push(`Update ${f.label}`, f.name === 'bukrs' ? 'OVX3' : s.primaryTcode, `Set ${f.label} of sales org ${c.key} to "${f.to}" (was "${f.from ?? '—'}").`)
      }
      break
    case 'purchasing_org':
      if (adding) {
        push('Maintain purchasing organization', 'OX08 / T024E', `Create purchasing org ${c.key} "${v.name}".`)
        push('Assign purchasing org to company code', 'OX01', v.bukrs ? `Assign purchasing org ${c.key} to company code ${v.bukrs}.` : `Leave purchasing org ${c.key} cross-company (no CoCode assignment).`)
        if (v.plants) push('Assign purchasing org to plants', 'OX17 / T024W', `Assign purchasing org ${c.key} to plant(s): ${v.plants}.`)
        if (v.bukrs) prereqs.push(`Company code ${v.bukrs} exists`)
        if (v.plants) prereqs.push(`Plant(s) ${v.plants} exist`)
      } else {
        for (const f of changedFields(c)) push(`Update ${f.label}`, f.name === 'plants' ? 'OX17 / T024W' : f.name === 'bukrs' ? 'OX01' : s.primaryTcode, `Set ${f.label} of purchasing org ${c.key} to "${f.to}" (was "${f.from ?? '—'}").`)
      }
      break
    case 'purchasing_group':
      push(adding ? 'Create purchasing group' : 'Update purchasing group', 'OME4 / T024', `${adding ? 'Create' : 'Update'} purchasing group ${c.key} "${v.name}"${v.phone ? `, tel ${v.phone}` : ''}.`)
      break
    case 'business_area':
      push(adding ? 'Define business area' : 'Update business area', 'OX03 / TGSB', `${adding ? 'Create' : 'Update'} business area ${c.key} "${v.name}".`)
      break
  }
  return { steps, prerequisites: prereqs }
}

export function buildInstructions(changeSet: Pick<ChangeSet, 'changes' | 'target_system'>, generatedAt: string | null = null): InstructionPackage {
  const instructions: ChangeInstruction[] = changeSet.changes.map((c) => {
    const s = ENTITY_SCHEMAS[c.entityKind]
    const { steps, prerequisites } = stepsFor(c)
    return {
      changeId: c.id,
      entityKind: c.entityKind,
      operation: c.operation,
      key: c.key,
      title: `${c.operation === 'add' ? 'Add' : 'Modify'} ${s.label} ${c.key}`,
      workstreamCode: c.workstreamCode || s.workstreamCode,
      agentLabel: c.agentLabel || s.workstreamLabel,
      desiredState: toMap(c),
      introspection: [`Read current state from: ${s.tables.join('; ')}`, `Verify whether ${s.label} ${c.key} already exists before creating.`],
      steps,
      transportNeeded: s.transportByDefault,
      transportNote: s.transportNote,
      prerequisites,
    }
  })
  const byWorkstream: Record<string, number> = {}
  for (const i of instructions) byWorkstream[i.agentLabel] = (byWorkstream[i.agentLabel] || 0) + 1
  return {
    generatedAt,
    targetSystem: changeSet.target_system,
    instructions,
    summary: { byWorkstream, transportsNeeded: instructions.filter((i) => i.transportNeeded).length, total: instructions.length },
  }
}
