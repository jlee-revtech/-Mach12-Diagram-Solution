import { FIORI_CATALOG, type FioriTile } from './fioriCatalog'
import type { ProcessElementData, ProcessGraph } from './types'

// ─────────────────────────────────────────────────────────────
// Test Plan model + deterministic "which system / Fiori tile" classifier.
// Each process step already carries rich delivery metadata (fioriTile, module,
// tcode, systemIds, ricefwCodes). We classify it into Standard SAP S/4HANA vs
// Dassian add-on vs Custom (RICEFW/Z) vs a non-SAP system vs a manual/offline
// activity — first from that metadata, and only fall back to AI for the gaps.
// ─────────────────────────────────────────────────────────────

// Pixel size the AI renders each Fiori mockup at (and the html-to-image canvas).
export const MOCKUP_WIDTH = 1000
export const MOCKUP_HEIGHT = 620

export type StepSystemKind = 'standard_sap' | 'dassian' | 'custom' | 'non_sap' | 'manual'

export const SYSTEM_KIND_LABEL: Record<StepSystemKind, string> = {
  standard_sap: 'Standard SAP S/4HANA',
  dassian: 'Dassian A&D',
  custom: 'Custom / RICEFW',
  non_sap: 'Non-SAP System',
  manual: 'Manual / Offline',
}

export interface StepClassification {
  kind: StepSystemKind
  systemLabel: string          // human label of the system the tester logs into
  fioriTile?: string           // Fiori (or Dassian) tile title
  fioriAppId?: string          // SAP Fiori app id, e.g. F0842
  tcode?: string               // SAP transaction code, e.g. ME21N
  confident: boolean           // true when grounded in step metadata (not inferred)
}

const STANDARD_MODULES = new Set([
  'FI', 'CO', 'FI-AA', 'TR', 'PS', 'MM', 'SD', 'PP', 'PM', 'QM', 'PP-MRP',
  'EWM', 'PPM', 'HCM', 'CATS',
])

// A tcode that starts with Z or Y is a customer object (custom development).
const isCustomTcode = (t?: string) => !!t && /^[zy]/i.test(t.trim())

/**
 * Classify a single BPMN step into the system + tile a tester would actually use.
 * `resolveSystemName` maps a logical_system id to its display name (from the store).
 */
export function classifyStep(
  data: ProcessElementData,
  resolveSystemName: (id: string) => string | null,
): StepClassification {
  const tile = data.fioriTile
  const tcode = data.tcode?.trim() || undefined
  const module = data.module?.trim() || undefined
  const ricefw = (data.ricefwCodes || []).filter(Boolean)
  const sysNames = (data.systemIds || []).map(resolveSystemName).filter(Boolean) as string[]

  // 1) Structured Dassian tile wins outright.
  if (tile?.source === 'dassian') {
    return { kind: 'dassian', systemLabel: `Dassian · ${tile.title}`, fioriTile: tile.title, confident: true }
  }
  // 2) Structured standard Fiori tile.
  if (tile?.source === 'fiori') {
    return {
      kind: isCustomTcode(tcode) ? 'custom' : 'standard_sap',
      systemLabel: 'SAP S/4HANA', fioriTile: tile.title, fioriAppId: tile.appId, tcode, confident: true,
    }
  }
  // 3) Module explicitly flagged Dassian.
  if (module === 'Dassian') {
    return { kind: 'dassian', systemLabel: 'Dassian A&D', tcode, confident: true }
  }
  // 4) Custom development: Z/Y tcode or any RICEFW build object referenced.
  if (isCustomTcode(tcode) || ricefw.length > 0) {
    return {
      kind: 'custom',
      systemLabel: ricefw.length ? `Custom (RICEFW ${ricefw.join(', ')})` : 'Custom (Z-transaction)',
      fioriAppId: data.fioriApp || undefined, tcode, confident: true,
    }
  }
  // 5) Standard SAP module, tcode, or free-text Fiori app named.
  if ((module && STANDARD_MODULES.has(module)) || tcode || data.fioriApp) {
    return {
      kind: 'standard_sap', systemLabel: 'SAP S/4HANA',
      fioriTile: data.fioriApp || undefined, tcode, confident: !!(tcode || data.fioriApp),
    }
  }
  // 6) A service task touching a named non-SAP system.
  if (data.elementType === 'serviceTask' && sysNames.length) {
    return { kind: 'non_sap', systemLabel: sysNames.join(' / '), confident: true }
  }
  // 7) Manual task, or a step with a named system but no SAP context.
  if (data.elementType === 'manualTask') {
    return { kind: 'manual', systemLabel: sysNames[0] || 'Manual / Offline', confident: false }
  }
  if (sysNames.length) {
    return { kind: 'non_sap', systemLabel: sysNames.join(' / '), confident: false }
  }
  // 8) No system context at all — assume SAP S/4HANA, to be confirmed by AI.
  return { kind: 'standard_sap', systemLabel: 'SAP S/4HANA (to confirm)', confident: false }
}

/** A flattened, AI-ready view of one step + its classification. */
export interface ClassifiedStep {
  label: string
  elementType: string
  description?: string
  lane?: string | null
  role?: string | null
  systemKind: StepSystemKind
  systemLabel: string
  fioriTile?: string
  fioriAppId?: string
  tcode?: string
}

const GATEWAY_OR_EVENT = new Set([
  'startEvent', 'endEvent', 'intermediateEvent', 'boundaryEvent',
  'exclusiveGateway', 'parallelGateway', 'inclusiveGateway', 'eventBasedGateway',
])

/** Pull the testable activities out of a leaf graph, classified and ordered. */
export function classifyGraphSteps(
  graph: ProcessGraph,
  resolveSystemName: (id: string) => string | null,
): ClassifiedStep[] {
  const laneById = new Map((graph.lanes || []).map(l => [l.id, l]))
  return (graph.nodes || [])
    .filter(n => !GATEWAY_OR_EVENT.has((n.data as ProcessElementData).elementType))
    .map(n => {
      const d = n.data as ProcessElementData
      const c = classifyStep(d, resolveSystemName)
      const lane = d.laneId ? laneById.get(d.laneId) : undefined
      const laneName = lane ? (resolveSystemName(lane.systemId || '') || lane.label) : null
      return {
        label: d.label || 'Step',
        elementType: d.elementType || 'task',
        description: d.description,
        lane: laneName,
        role: d.responsibleRole || null,
        systemKind: c.kind,
        systemLabel: c.systemLabel,
        fioriTile: c.fioriTile,
        fioriAppId: c.fioriAppId,
        tcode: c.tcode,
      }
    })
}

/** Catalog tiles whose functional area touches any of the named SAP modules,
 *  so the AI grounds tile/app-id choices in the real curated list. */
export function relevantCatalogTiles(modules: string[]): FioriTile[] {
  if (!modules.length) return FIORI_CATALOG.slice(0, 40)
  const wanted = modules.map(m => m.toLowerCase())
  const areaMatches = (area: string) => wanted.some(m => area.toLowerCase().includes(m))
  const hits = FIORI_CATALOG.filter(t => areaMatches(t.area))
  return hits.length ? hits : FIORI_CATALOG
}

// ─── Result model (mirrors the `process-test-plan` AI JSON) ────────────────

export interface TestStepAction {
  no: number
  action: string
  expected: string
  testData?: string
}

export type TestCaseType = 'Positive' | 'Negative' | 'Edge'
export type TestPriority = 'High' | 'Medium' | 'Low'

export interface TestCase {
  id: string                   // TC-01
  title: string
  processStep: string          // source process step label
  systemKind: StepSystemKind
  systemLabel: string
  fioriTile?: string
  fioriAppId?: string
  tcode?: string
  role?: string
  type: TestCaseType
  priority: TestPriority
  preconditions: string[]
  testData: { field: string; value: string }[]
  steps: TestStepAction[]
  expectedResult: string
  // populated client-side when AI screenshots are requested
  screenshotDataUrl?: string
}

export interface TestPlan {
  processName: string
  modelTitle?: string
  objective: string
  scope: string[]
  outOfScope: string[]
  prerequisites: string[]
  testCases: TestCase[]
}

/** Normalize whatever the AI returned into a well-formed TestPlan (stable ids,
 *  step numbers, and a valid system kind on every case). */
export function normalizeTestPlan(raw: unknown, processName: string, modelTitle?: string): TestPlan {
  const r = (raw || {}) as Record<string, unknown>
  const asArr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
  const asStrArr = (v: unknown): string[] => asArr(v).map(x => String(x)).filter(Boolean)
  const validKind = (k: unknown): StepSystemKind =>
    (['standard_sap', 'dassian', 'custom', 'non_sap', 'manual'].includes(k as string) ? k : 'standard_sap') as StepSystemKind

  const cases = asArr(r.testCases).map((c, i): TestCase => {
    const o = (c || {}) as Record<string, unknown>
    const steps = asArr(o.steps).map((s, j): TestStepAction => {
      const so = (s || {}) as Record<string, unknown>
      return {
        no: j + 1,
        action: String(so.action || so.step || ''),
        expected: String(so.expected || ''),
        testData: so.testData ? String(so.testData) : undefined,
      }
    })
    const td = asArr(o.testData).map(t => {
      const to = (t || {}) as Record<string, unknown>
      return { field: String(to.field || ''), value: String(to.value || '') }
    }).filter(t => t.field || t.value)
    const type = (['Positive', 'Negative', 'Edge'].includes(o.type as string) ? o.type : 'Positive') as TestCaseType
    const priority = (['High', 'Medium', 'Low'].includes(o.priority as string) ? o.priority : 'Medium') as TestPriority
    return {
      id: String(o.id || `TC-${String(i + 1).padStart(2, '0')}`),
      title: String(o.title || `Test Case ${i + 1}`),
      processStep: String(o.processStep || o.title || ''),
      systemKind: validKind(o.systemKind),
      systemLabel: String(o.systemLabel || SYSTEM_KIND_LABEL[validKind(o.systemKind)]),
      fioriTile: o.fioriTile ? String(o.fioriTile) : undefined,
      fioriAppId: o.fioriAppId ? String(o.fioriAppId) : undefined,
      tcode: o.tcode ? String(o.tcode) : undefined,
      role: o.role ? String(o.role) : undefined,
      type,
      priority,
      preconditions: asStrArr(o.preconditions),
      testData: td,
      steps: steps.length ? steps : [{ no: 1, action: 'Execute the step', expected: 'Step completes successfully' }],
      expectedResult: String(o.expectedResult || ''),
    }
  })

  return {
    processName,
    modelTitle,
    objective: String(r.objective || ''),
    scope: asStrArr(r.scope),
    outOfScope: asStrArr(r.outOfScope),
    prerequisites: asStrArr(r.prerequisites),
    testCases: cases,
  }
}
