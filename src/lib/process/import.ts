import * as XLSX from 'xlsx'
import { v4 as uuid } from 'uuid'
import type { ProcessGraph, ProcessLane, BpmnElementType } from '@/lib/process/types'
import {
  createProcessModel, updateProcessModel, createProcessNode, saveProcessGraph,
} from '@/lib/supabase/process-models'

// ─── BPMN 2.0 → ProcessGraph ───────────────────────────

const BPMN_ELEMENT_MAP: Record<string, BpmnElementType> = {
  startEvent: 'startEvent', endEvent: 'endEvent',
  intermediateThrowEvent: 'intermediateEvent', intermediateCatchEvent: 'intermediateEvent', boundaryEvent: 'boundaryEvent',
  task: 'task', userTask: 'userTask', serviceTask: 'serviceTask', manualTask: 'manualTask',
  scriptTask: 'task', businessRuleTask: 'serviceTask', sendTask: 'serviceTask', receiveTask: 'task',
  subProcess: 'subProcess', callActivity: 'subProcess', transaction: 'subProcess',
  exclusiveGateway: 'exclusiveGateway', parallelGateway: 'parallelGateway',
  inclusiveGateway: 'inclusiveGateway', eventBasedGateway: 'eventBasedGateway', complexGateway: 'inclusiveGateway',
}

const FLOW_TAGS = new Set(Object.keys(BPMN_ELEMENT_MAP))

export function parseBpmnToGraph(xml: string): { title: string; graph: ProcessGraph } {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.querySelector('parsererror')) throw new Error('Invalid BPMN/XML file')

  const all = Array.from(doc.getElementsByTagName('*'))
  const local = (el: Element) => el.localName

  // Title: participant name → process name → definitions
  const participant = all.find(e => local(e) === 'participant')
  const process = all.find(e => local(e) === 'process')
  const title = participant?.getAttribute('name') || process?.getAttribute('name') || 'Imported Process'

  // DI bounds: bpmnElement → {x,y}
  const pos = new Map<string, { x: number; y: number }>()
  for (const shape of all.filter(e => local(e) === 'BPMNShape')) {
    const ref = shape.getAttribute('bpmnElement')
    const bounds = Array.from(shape.children).find(c => local(c) === 'Bounds')
    if (ref && bounds) pos.set(ref, { x: parseFloat(bounds.getAttribute('x') || '0'), y: parseFloat(bounds.getAttribute('y') || '0') })
  }

  // Lanes
  const laneEls = all.filter(e => local(e) === 'lane')
  const elementLane = new Map<string, string>()
  const lanes: ProcessLane[] = laneEls.map((laneEl, i) => {
    const id = laneEl.getAttribute('id') || `lane${i}`
    Array.from(laneEl.children).filter(c => local(c) === 'flowNodeRef').forEach(ref => {
      const t = ref.textContent?.trim(); if (t) elementLane.set(t, id)
    })
    return { id, label: laneEl.getAttribute('name') || `Lane ${i + 1}`, order: i }
  })
  if (lanes.length === 0) lanes.push({ id: 'lane0', label: 'Process', order: 0 })

  // Flow elements
  const nodes = all
    .filter(e => FLOW_TAGS.has(local(e)))
    .map((el, i) => {
      const id = el.getAttribute('id') || `n${i}`
      const laneId = elementLane.get(id) || lanes[0].id
      const p = pos.get(id) || { x: 90 + i * 190, y: (lanes.findIndex(l => l.id === laneId) * 150) + 50 }
      return {
        id,
        type: 'processElement' as const,
        position: { x: p.x, y: p.y },
        data: { label: el.getAttribute('name') || BPMN_ELEMENT_MAP[local(el)], elementType: BPMN_ELEMENT_MAP[local(el)], laneId },
      }
    })
  const nodeIds = new Set(nodes.map(n => n.id))

  // Sequence flows
  const edges = all
    .filter(e => local(e) === 'sequenceFlow')
    .map((el, i) => ({
      id: el.getAttribute('id') || `e${i}`,
      source: el.getAttribute('sourceRef') || '',
      target: el.getAttribute('targetRef') || '',
      type: 'sequenceFlow' as const,
      data: { kind: 'sequence' as const, ...(el.getAttribute('name') ? { label: el.getAttribute('name')! } : {}) },
    }))
    .filter(e => nodeIds.has(e.source) && nodeIds.has(e.target))

  return { title, graph: { lanes, nodes: nodes as ProcessGraph['nodes'], edges: edges as ProcessGraph['edges'] } }
}

export async function importBpmnFile(file: File, orgId: string, userId: string): Promise<string> {
  const text = await file.text()
  const { title, graph } = parseBpmnToGraph(text)
  const model = await createProcessModel(orgId, userId, title)
  // One leaf process holding the imported flow
  const leaf = await createProcessNode(model.id, title, 0, null, 3, 'process', null)
  await saveProcessGraph(leaf.id, graph)
  return model.id
}

// ─── Excel / CSV hierarchy → process model tree ────────

interface HierRow { l1: string; l2?: string; l3?: string }

function detectColumns(header: string[]): { l1: number; l2: number; l3: number } {
  const norm = header.map(h => String(h || '').toLowerCase().trim())
  const find = (...keys: string[]) => norm.findIndex(h => keys.some(k => h.includes(k)))
  let l1 = find('scenario', 'value chain', 'l1', 'level 1', 'end-to-end', 'end to end')
  let l2 = find('process group', 'group', 'l2', 'level 2', 'process area')
  let l3 = find('process step', 'process', 'l3', 'level 3', 'activity', 'step')
  // Fallback to first three columns
  if (l1 < 0) l1 = 0
  if (l2 < 0) l2 = 1
  if (l3 < 0) l3 = 2
  return { l1, l2, l3 }
}

export async function parseHierarchyWorkbook(file: File): Promise<{ title: string; rows: HierRow[] }> {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const aoa = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, blankrows: false }) as string[][]
  if (aoa.length < 2) throw new Error('Spreadsheet has no data rows')
  const { l1, l2, l3 } = detectColumns(aoa[0])
  const rows: HierRow[] = []
  for (let i = 1; i < aoa.length; i++) {
    const r = aoa[i]
    const v1 = (r[l1] || '').toString().trim()
    const v2 = (r[l2] || '').toString().trim()
    const v3 = (r[l3] || '').toString().trim()
    if (!v1 && !v2 && !v3) continue
    rows.push({ l1: v1, l2: v2 || undefined, l3: v3 || undefined })
  }
  const title = file.name.replace(/\.(xlsx|xls|csv)$/i, '') || 'Imported Process Model'
  return { title, rows }
}

export async function importHierarchyFile(file: File, orgId: string, userId: string): Promise<string> {
  const { title, rows } = await parseHierarchyWorkbook(file)
  const model = await createProcessModel(orgId, userId, title)

  // Build hierarchy, carrying last-seen L1/L2 down for sparse rows
  const l1Ids = new Map<string, string>()
  const l2Ids = new Map<string, string>()
  let lastL1 = '', lastL2 = ''

  for (const row of rows) {
    const l1name = row.l1 || lastL1
    if (l1name) lastL1 = l1name
    let l1id = l1Ids.get(l1name)
    if (l1name && !l1id) {
      const n = await createProcessNode(model.id, l1name, l1Ids.size, null, 1, 'scenario', null)
      l1id = n.id; l1Ids.set(l1name, l1id)
    }

    const l2name = row.l2 || (row.l1 ? '' : lastL2)
    if (l2name) lastL2 = l2name
    let l2id: string | undefined
    if (l2name && l1id) {
      const key = `${l1name}//${l2name}`
      l2id = l2Ids.get(key)
      if (!l2id) {
        const siblings = [...l2Ids.keys()].filter(k => k.startsWith(`${l1name}//`)).length
        const n = await createProcessNode(model.id, l2name, siblings, l1id, 2, 'process_group', null)
        l2id = n.id; l2Ids.set(key, l2id)
      }
    }

    if (row.l3) {
      const parent = l2id || l1id || null
      const level = l2id ? 3 : 2
      await createProcessNode(model.id, row.l3, 0, parent, level, level === 3 ? 'process' : 'process_group', null)
    }
  }

  await updateProcessModel(model.id, userId, { description: `Imported from ${file.name}` })
  return model.id
}
