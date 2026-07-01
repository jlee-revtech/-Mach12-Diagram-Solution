import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Apply a confirmed architecture_change capture to the real model. The change is
// written as a process OVERLAY (kind 'accelerator' = a to-be enhancement) on the
// target workstream's homed process model — real, visible in the process model,
// and reversible (delete the overlay). The capture is marked applied with a
// pointer to what was created.

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function POST(req: NextRequest) {
  try {
    const { orgId, captureId } = await req.json()
    if (!orgId || !captureId) return json({ error: 'orgId and captureId are required' }, 400)
    const auth = req.headers.get('authorization') || ''
    const db = createClient(SUPA_URL, SUPA_ANON, {
      global: { headers: auth ? { Authorization: auth } : {} },
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: cap } = await db.from('workshop_captures').select('*').eq('id', captureId).maybeSingle()
    if (!cap) return json({ error: 'Capture not found' }, 404)
    if (cap.capture_type !== 'architecture_change') return json({ error: 'Only architecture_change captures can be applied to the model' }, 400)

    const payload = (cap.payload || {}) as Record<string, unknown>
    const wsCode = (cap.workstream_code as string) || (payload.workstreamCode as string) || null
    if (!wsCode) return json({ error: 'This change has no target workstream; set one before applying.' }, 422)

    const { data: ws } = await db.from('workstreams').select('id,name').eq('organization_id', orgId).eq('code', wsCode).maybeSingle()
    if (!ws) return json({ error: `No workstream "${wsCode}" in this org.` }, 422)

    // Target: the workstream's homed process model, and a node to attach to.
    const { data: pm } = await db.from('process_models').select('id,title').eq('workstream_id', ws.id).is('archived_at', null).limit(1)
    if (!pm?.[0]) return json({ error: `No process model is homed to ${ws.name} yet — generate its process first, then apply.` }, 422)
    let nodeId: string | null = null
    if (payload.targetId) {
      const { data: t } = await db.from('process_nodes').select('id').eq('id', payload.targetId).eq('process_model_id', pm[0].id).maybeSingle()
      nodeId = t?.id ?? null
    }
    if (!nodeId) {
      const { data: root } = await db.from('process_nodes').select('id').eq('process_model_id', pm[0].id).eq('level', 1).order('sort_order').limit(1)
      nodeId = root?.[0]?.id ?? null
    }
    if (!nodeId) return json({ error: 'The target process model has no nodes to annotate.' }, 422)

    const notes = [cap.detail, payload.change, payload.rationale].filter(Boolean).join(' — ') || undefined
    const { data: overlay, error: ovErr } = await db.from('process_overlays').insert({
      process_node_id: nodeId,
      overlay_kind: 'accelerator',
      payload: { title: `Workshop: ${cap.title}`, notes, acceleratorRef: cap.workshop_id ? `workshop:${cap.workshop_id}` : undefined },
      sort_order: 0,
    }).select('id').single()
    if (ovErr) return json({ error: `Failed to write overlay: ${ovErr.message}` }, 500)

    await db.from('workshop_captures').update({
      status: 'applied',
      applied_at: new Date().toISOString(),
      payload: { ...payload, applied: { overlayId: overlay.id, nodeId, modelId: pm[0].id, modelTitle: pm[0].title } },
    }).eq('id', captureId)

    return json({ ok: true, applied: { overlayId: overlay.id, modelTitle: pm[0].title, workstream: ws.name } }, 200)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'bad request' }, 400)
  }
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}
