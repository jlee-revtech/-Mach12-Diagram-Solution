// Z*/Y* PFCG naming governance (shared contract): customer-namespace role
// names start with Z or Y, are stored UPPERCASE, max 30 chars, and use
// letters/digits/underscore/colon only (PFCG allows more; we keep it strict).

export function normalizeSapRoleName(raw: string): string {
  return raw.trim().toUpperCase()
}

/** Error message for an SAP role name, or null when valid. Empty = "not set" = valid. */
export function sapRoleNameError(raw: string): string | null {
  const v = normalizeSapRoleName(raw)
  if (!v) return null
  if (!/^[ZY]/.test(v)) return 'Must start with Z or Y (customer namespace).'
  if (v.length > 30) return 'Max 30 characters.'
  if (!/^[A-Z0-9_:]+$/.test(v)) return 'Letters, digits, underscore, or colon only.'
  return null
}
