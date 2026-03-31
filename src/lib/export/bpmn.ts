import type { SystemNode, DataFlowEdge, DiagramMeta } from '@/lib/diagram/types'

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
