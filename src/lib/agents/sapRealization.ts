import type { SapRealization } from '@jlee-revtech/agent-core'

// SAP-realization implementation for the Super Consultant tool belt: an HTTP
// client to SAP Solution Studio's /api/realization endpoint. This is what lets a
// consultant agent in Solution Architecture Studio actually introspect / plan /
// prepare / execute live SAP configuration, and read back the executed-config log
// that documents what was applied. The execution engine lives in Solution Studio
// (ADT classrun); this app reaches it over HTTP with a shared secret. Absent
// config -> undefined -> the realization tools degrade gracefully.

interface RealizationConfig {
  url: string // Solution Studio /api/realization URL
  secret: string // shared secret (x-realization-secret)
}

export function createSapRealization(cfg: RealizationConfig): SapRealization {
  async function call(op: string, payload: Record<string, unknown>): Promise<string> {
    try {
      const res = await fetch(cfg.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-realization-secret': cfg.secret },
        body: JSON.stringify({ op, ...payload }),
      })
      if (!res.ok) return `SAP realization endpoint returned ${res.status}. Live SAP configuration is unavailable right now.`
      const j = (await res.json()) as { result?: string; error?: string }
      return typeof j.result === 'string' ? j.result : j.error || 'No result from the realization endpoint.'
    } catch (e) {
      return `Could not reach the SAP realization endpoint: ${e instanceof Error ? e.message : 'failed'}.`
    }
  }
  return {
    introspectLiveConfig: (workstreamCode, query) => call('introspect_live_config', { workstreamCode, query }),
    listActivities: (workstreamCode) => call('list_activities', { workstreamCode }),
    composeConfigPlan: (workstreamCode, instruction) => call('compose_config_plan', { workstreamCode, instruction }),
    prepareConfig: (workstreamCode, activityKey, inputs) => call('prepare_config', { workstreamCode, activityKey, inputs }),
    executeConfig: (workstreamCode, activityKey, inputs, approvalToken, humanConfirmed) =>
      call('execute_config', { workstreamCode, activityKey, inputs, approvalToken, humanConfirmed }),
    // Workpackage K3: the executed-configuration log, the provenance source for
    // the config-workbook deliverable. Solution Studio returns an honest "no
    // provenance available" string when its workbook store is unconfigured.
    listConfigLog: (workstreamCode, limit) => call('list_config_log', { workstreamCode, limit }),
    // Create a transport (Customizing for config, Workbench for dev objects) and
    // get back its TRKORR. Human confirmation is enforced on both sides.
    createTransport: (workstreamCode, kind, description, humanConfirmed, target) =>
      call('create_transport', { workstreamCode, kind, description, humanConfirmed, target }),
  }
}

/** Build the realization from env, or undefined when not configured (tools degrade). */
export function sapRealizationFromEnv(): SapRealization | undefined {
  const url = process.env.SSS_REALIZATION_URL
  const secret = process.env.REALIZATION_SHARED_SECRET
  if (!url || !secret) return undefined
  return createSapRealization({ url, secret })
}
