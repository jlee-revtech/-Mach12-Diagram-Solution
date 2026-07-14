import type { ChangeSet, ChangeItem, InstructionPackage, TargetSystem } from '@/lib/sap-model/changes'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

function token(): string | null {
  try {
    const key = Object.keys(localStorage).find((k) => k.startsWith('sb-') && k.endsWith('-auth-token'))
    if (!key) return null
    return JSON.parse(localStorage.getItem(key) || '{}')?.access_token ?? null
  } catch {
    return null
  }
}
const headers = (): Record<string, string> => ({
  'Content-Type': 'application/json',
  apikey: ANON,
  Authorization: `Bearer ${token()}`,
  Accept: 'application/json',
})

export async function listChangeSets(orgId: string): Promise<ChangeSet[]> {
  const res = await fetch(
    `${URL}/rest/v1/sap_model_change_sets?organization_id=eq.${orgId}&select=*&order=updated_at.desc`,
    { headers: headers() }
  )
  if (!res.ok) return []
  return res.json()
}

export async function createChangeSet(
  orgId: string,
  userId: string,
  data: { title: string; description?: string; target_system: TargetSystem }
): Promise<ChangeSet> {
  const res = await fetch(`${URL}/rest/v1/sap_model_change_sets`, {
    method: 'POST',
    headers: { ...headers(), Prefer: 'return=representation' },
    body: JSON.stringify({
      organization_id: orgId,
      title: data.title,
      description: data.description ?? null,
      target_system: data.target_system,
      changes: [],
      status: 'draft',
      created_by: userId,
    }),
  })
  const arr = await res.json()
  if (!res.ok) throw new Error(arr.message || 'Failed to create change set')
  return Array.isArray(arr) ? arr[0] : arr
}

export async function updateChangeSet(
  id: string,
  updates: Partial<{ title: string; description: string | null; status: string; changes: ChangeItem[]; instructions: InstructionPackage | null }>
): Promise<void> {
  const res = await fetch(`${URL}/rest/v1/sap_model_change_sets?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...headers(), Prefer: 'return=minimal' },
    body: JSON.stringify(updates),
  })
  if (!res.ok) {
    const e = await res.json().catch(() => ({}))
    throw new Error(e.message || 'Failed to update change set')
  }
}

export async function deleteChangeSet(id: string): Promise<void> {
  const res = await fetch(`${URL}/rest/v1/sap_model_change_sets?id=eq.${id}`, { method: 'DELETE', headers: headers() })
  if (!res.ok) {
    const e = await res.json().catch(() => ({}))
    throw new Error(e.message || 'Failed to delete change set')
  }
}
