import type { SystemNode, DataFlowEdge, DiagramMeta } from '@/lib/diagram/types'
import type { ProcessGraph, BpmnElementType } from '@/lib/process/types'

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function generateBpmn(
  meta: DiagramMeta,
  nodes: SystemNode[],
  edges: DataFlowEdge[]
): string {
  const processId = `Process_${meta.id.substring(0, 8)}`
  const collaborationId = `Collaboration_${meta.id.substring(0, 8)}`

  // Map nodes to BPMN participants (pools)
  const participants = nodes.map((n, i) => ({
    id: `Participant_${i}`,
    nodeId: n.id,
    name: n.data.physicalSystem
      ? `${n.data.label} (${n.data.physicalSystem})`
      : n.data.label,
    processRef: `Process_${i}`,
  }))

  // Map edges to BPMN message flows with data objects
  const messageFlows = edges.map((e, i) => {
    const sourceParticipant = participants.find((p) => p.nodeId === e.source)
    const targetParticipant = participants.find((p) => p.nodeId === e.target)
    if (!sourceParticipant || !targetParticipant) return null

    return {
      id: `MessageFlow_${i}`,
      name: e.data?.dataElements?.map((el) => el.name).join(', ') || '',
      sourceRef: sourceParticipant.id,
      targetRef: targetParticipant.id,
      dataElements: e.data?.dataElements || [],
    }
  }).filter(Boolean)

  // Build diagram layout info
  const POOL_WIDTH = 300
  const POOL_HEIGHT = 120
  const POOL_GAP_X = 100
  const POOL_GAP_Y = 50

  const cols = Math.ceil(Math.sqrt(nodes.length))

  const poolPositions = nodes.map((n, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    return {
      x: 100 + col * (POOL_WIDTH + POOL_GAP_X),
      y: 100 + row * (POOL_HEIGHT + POOL_GAP_Y),
    }
  })

  // Generate XML
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions
  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  id="Definitions_1"
  targetNamespace="https://mach12.ai/bpmn"
  exporter="Mach12.ai"
  exporterVersion="1.0">

  <!-- Collaboration: ${escapeXml(meta.title)} -->
  <bpmn:collaboration id="${collaborationId}">
${participants.map((p) => `    <bpmn:participant id="${p.id}" name="${escapeXml(p.name)}" processRef="${p.processRef}" />`).join('\n')}
${messageFlows.map((mf) => {
  if (!mf) return ''
  const nameAttr = mf.name ? ` name="${escapeXml(mf.name)}"` : ''
  return `    <bpmn:messageFlow id="${mf.id}"${nameAttr} sourceRef="${mf.sourceRef}" targetRef="${mf.targetRef}" />`
}).join('\n')}
  </bpmn:collaboration>

${participants.map((p) => `  <!-- Process: ${escapeXml(p.name)} -->
  <bpmn:process id="${p.processRef}" isExecutable="false">
    <bpmn:startEvent id="StartEvent_${p.processRef}" />
  </bpmn:process>`).join('\n\n')}

  <!-- Diagram Layout -->
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="${collaborationId}">
${participants.map((p, i) => {
  const pos = poolPositions[i]
  return `      <bpmndi:BPMNShape id="${p.id}_di" bpmnElement="${p.id}" isHorizontal="true">
        <dc:Bounds x="${pos.x}" y="${pos.y}" width="${POOL_WIDTH}" height="${POOL_HEIGHT}" />
      </bpmndi:BPMNShape>`
}).join('\n')}
${messageFlows.map((mf, i) => {
  if (!mf) return ''
  const srcIdx = participants.findIndex((p) => p.id === mf.sourceRef)
  const tgtIdx = participants.findIndex((p) => p.id === mf.targetRef)
  if (srcIdx < 0 || tgtIdx < 0) return ''
  const srcPos = poolPositions[srcIdx]
  const tgtPos = poolPositions[tgtIdx]
  const srcX = srcPos.x + POOL_WIDTH
  const srcY = srcPos.y + POOL_HEIGHT / 2
  const tgtX = tgtPos.x
  const tgtY = tgtPos.y + POOL_HEIGHT / 2
  return `      <bpmndi:BPMNEdge id="${mf.id}_di" bpmnElement="${mf.id}">
        <di:waypoint x="${srcX}" y="${srcY}" />
        <di:waypoint x="${tgtX}" y="${tgtY}" />
      </bpmndi:BPMNEdge>`
}).join('\n')}
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>

</bpmn:definitions>`

  return xml
}

// ─── Process Studio: full BPMN 2.0 from a leaf swimlane graph ──

const BPMN_TAG: Record<BpmnElementType, string> = {
  task: 'task', userTask: 'userTask', serviceTask: 'serviceTask', manualTask: 'manualTask',
  subProcess: 'subProcess', startEvent: 'startEvent', endEvent: 'endEvent',
  intermediateEvent: 'intermediateThrowEvent', boundaryEvent: 'intermediateThrowEvent',
  exclusiveGateway: 'exclusiveGateway', parallelGateway: 'parallelGateway',
  inclusiveGateway: 'inclusiveGateway', eventBasedGateway: 'eventBasedGateway',
}

function bpmnSize(t: BpmnElementType): { w: number; h: number } {
  if (t.endsWith('Event')) return { w: 36, h: 36 }
  if (t.endsWith('Gateway')) return { w: 50, h: 50 }
  return { w: 110, h: 70 }
}

/**
 * Emit standards-compliant BPMN 2.0 (collaboration + single process with a
 * laneSet) from a leaf process's ProcessGraph. Shape bounds come straight from
 * the @xyflow node positions, so no layout solver is needed.
 */
export function generateProcessBpmn(title: string, modelId: string, graph: ProcessGraph): string {
  const short = modelId.replace(/[^a-zA-Z0-9]/g, '').substring(0, 8) || 'proc'
  const processId = `Process_${short}`
  const collabId = `Collaboration_${short}`
  const participantId = `Participant_${short}`

  const elements = graph.nodes
  const lanes = [...graph.lanes].sort((a, b) => a.order - b.order)
  const elementById = new Map(elements.map(n => [n.id, n]))

  // Lane → element ids
  const laneEls = new Map<string, string[]>()
  for (const l of lanes) laneEls.set(l.id, [])
  const unlaned: string[] = []
  for (const el of elements) {
    const lid = (el.data as { laneId?: string })?.laneId
    if (lid && laneEls.has(lid)) laneEls.get(lid)!.push(el.id)
    else unlaned.push(el.id)
  }

  const center = (id: string) => {
    const n = elementById.get(id)!
    const { w, h } = bpmnSize((n.data as { elementType: BpmnElementType }).elementType)
    return { x: n.position.x + w / 2, y: n.position.y + h / 2 }
  }

  // Per-element incoming/outgoing for valid BPMN
  const incoming = new Map<string, string[]>()
  const outgoing = new Map<string, string[]>()
  graph.edges.forEach((e, i) => {
    const fid = `Flow_${i}`
    ;(outgoing.get(e.source as string) ?? outgoing.set(e.source as string, []).get(e.source as string)!).push(fid)
    ;(incoming.get(e.target as string) ?? incoming.set(e.target as string, []).get(e.target as string)!).push(fid)
  })

  const elementXml = elements.map(el => {
    const t = (el.data as { elementType: BpmnElementType }).elementType
    const tag = BPMN_TAG[t] || 'task'
    const name = escapeXml((el.data as { label?: string }).label || '')
    const inc = (incoming.get(el.id) || []).map(f => `      <bpmn:incoming>${f}</bpmn:incoming>`).join('\n')
    const out = (outgoing.get(el.id) || []).map(f => `      <bpmn:outgoing>${f}</bpmn:outgoing>`).join('\n')
    const body = [inc, out].filter(Boolean).join('\n')
    return `    <bpmn:${tag} id="${el.id}" name="${name}">${body ? '\n' + body + '\n    ' : ''}</bpmn:${tag}>`
  }).join('\n')

  const flowXml = graph.edges.map((e, i) => {
    const fid = `Flow_${i}`
    const name = (e.data as { label?: string })?.label
    const nameAttr = name ? ` name="${escapeXml(name)}"` : ''
    return `    <bpmn:sequenceFlow id="${fid}"${nameAttr} sourceRef="${e.source}" targetRef="${e.target}" />`
  }).join('\n')

  const laneSetXml = `    <bpmn:laneSet id="LaneSet_${short}">
${lanes.map(l => `      <bpmn:lane id="Lane_${l.id}" name="${escapeXml(l.label)}">
${(laneEls.get(l.id) || []).map(eid => `        <bpmn:flowNodeRef>${eid}</bpmn:flowNodeRef>`).join('\n')}
      </bpmn:lane>`).join('\n')}
    </bpmn:laneSet>`

  // DI: lane bands + element shapes + edges
  const LANE_LABEL_W = 30
  const maxX = Math.max(400, ...elements.map(n => n.position.x + 140))
  const laneW = maxX + 60
  const laneShapes = lanes.map(l => `      <bpmndi:BPMNShape id="Lane_${l.id}_di" bpmnElement="Lane_${l.id}" isHorizontal="true">
        <dc:Bounds x="0" y="${l.order * 150}" width="${laneW}" height="150" />
      </bpmndi:BPMNShape>`).join('\n')

  const elementShapes = elements.map(el => {
    const t = (el.data as { elementType: BpmnElementType }).elementType
    const { w, h } = bpmnSize(t)
    return `      <bpmndi:BPMNShape id="${el.id}_di" bpmnElement="${el.id}">
        <dc:Bounds x="${Math.round(el.position.x + LANE_LABEL_W)}" y="${Math.round(el.position.y)}" width="${w}" height="${h}" />
      </bpmndi:BPMNShape>`
  }).join('\n')

  const edgeShapes = graph.edges.map((e, i) => {
    const s = center(e.source as string); const t = center(e.target as string)
    return `      <bpmndi:BPMNEdge id="Flow_${i}_di" bpmnElement="Flow_${i}">
        <di:waypoint x="${Math.round(s.x + LANE_LABEL_W)}" y="${Math.round(s.y)}" />
        <di:waypoint x="${Math.round(t.x + LANE_LABEL_W)}" y="${Math.round(t.y)}" />
      </bpmndi:BPMNEdge>`
  }).join('\n')

  // participant shape spans all lanes
  const totalH = Math.max(150, lanes.length * 150)

  return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions
  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  id="Definitions_${short}"
  targetNamespace="https://mach12.ai/bpmn"
  exporter="Mach12.ai Process Studio"
  exporterVersion="1.0">

  <bpmn:collaboration id="${collabId}">
    <bpmn:participant id="${participantId}" name="${escapeXml(title)}" processRef="${processId}" />
  </bpmn:collaboration>

  <bpmn:process id="${processId}" isExecutable="false">
${lanes.length ? laneSetXml + '\n' : ''}${elementXml}
${flowXml}
  </bpmn:process>

  <bpmndi:BPMNDiagram id="BPMNDiagram_${short}">
    <bpmndi:BPMNPlane id="BPMNPlane_${short}" bpmnElement="${collabId}">
      <bpmndi:BPMNShape id="${participantId}_di" bpmnElement="${participantId}" isHorizontal="true">
        <dc:Bounds x="0" y="0" width="${laneW + LANE_LABEL_W}" height="${totalH}" />
      </bpmndi:BPMNShape>
${laneShapes}
${elementShapes}
${edgeShapes}
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>

</bpmn:definitions>`
}
