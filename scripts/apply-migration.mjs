#!/usr/bin/env node
// Apply a .sql migration to the Supabase project via the Management API.
//   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/apply-migration.mjs supabase/040_workshops.sql
// The token is a Supabase personal access token (from the `supabase` CLI login,
// stored in the OS keyring as "Supabase CLI:supabase"). Project ref is derived
// from KNOWLEDGE_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL in .env.local.
// Idempotent migrations (create-if-not-exists) are safe to re-run.

import { readFileSync } from 'node:fs'
import { join, dirname, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = dirname(fileURLToPath(import.meta.url))
const APP_DIR = join(DIR, '..')
for (const l of readFileSync(join(APP_DIR, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}
const url = process.env.KNOWLEDGE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const ref = (url || '').match(/https:\/\/([a-z0-9]+)\.supabase/)?.[1]
const token = process.env.SUPABASE_ACCESS_TOKEN
const file = process.argv[2]
if (!ref) { console.error('Cannot derive project ref from KNOWLEDGE_SUPABASE_URL'); process.exit(1) }
if (!token) { console.error('Set SUPABASE_ACCESS_TOKEN (sbp_...) — from `supabase` CLI keyring'); process.exit(1) }
if (!file) { console.error('Usage: node scripts/apply-migration.mjs <path-to-.sql>'); process.exit(1) }

const sql = readFileSync(isAbsolute(file) ? file : join(process.cwd(), file), 'utf8')

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ query: sql }),
})
const text = await res.text()
if (!res.ok) { console.error(`FAILED ${res.status}: ${text}`); process.exit(1) }
console.log(`Applied ${file} to ${ref}. Response: ${text.slice(0, 400) || '(ok)'}`)
