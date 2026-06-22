import { NextResponse } from 'next/server'
import { knowledgeAdmin } from '@/lib/knowledge/sharedClient'

// List the available consultant agents (per-workstream + enterprise orchestrator)
// from the shared knowledge repository.
export async function GET() {
  try {
    const db = knowledgeAdmin()
    const { data, error } = await db
      .from('kb_workstream_agents')
      .select('code, display_name, tagline, is_orchestrator, sap_modules, dassian_modules, sort_order')
      .order('sort_order')
    if (error) throw new Error(error.message)
    return NextResponse.json({ agents: data })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'failed' }, { status: 500 })
  }
}
