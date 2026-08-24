// Per-browser SAP credential store.
//
// SAS runs on Vercel, so there is no long-lived process to hold an in-memory
// connection the way Solution Studio does on Cloud Foundry - the next request
// can land on a different instance. Credentials therefore travel in an
// AES-256-GCM encrypted httpOnly cookie: the browser holds the ciphertext, only
// the server can read it, and nothing lands in the database.
//
// Keyed by systemId so a user can be logged into several systems at once, which
// is the whole point of "pull the org model from the system(s)".

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import type { SapCredentials } from './types'

export const SAP_COOKIE = 'sas_sap'
/** Idle lifetime of a logon. Short by design - it is a live SAP session. */
export const SAP_COOKIE_MAX_AGE = 12 * 60 * 60 // seconds

type Vault = Record<string, SapCredentials>

/**
 * 32-byte key derived from a server secret. SAP_SESSION_SECRET is the intended
 * source; REALIZATION_SHARED_SECRET is accepted as a fallback so an existing
 * deployment works without a new variable. Null when neither is set, which
 * disables direct mode with an honest message rather than encrypting with a
 * hardcoded key.
 */
function key(): Buffer | null {
  const secret = process.env.SAP_SESSION_SECRET || process.env.REALIZATION_SHARED_SECRET
  if (!secret || secret.trim().length < 16) return null
  return createHash('sha256').update(secret.trim()).digest()
}

export function credentialStoreAvailable(): boolean {
  return key() !== null
}

function seal(vault: Vault): string | null {
  const k = key()
  if (!k) return null
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', k, iv)
  const body = Buffer.concat([cipher.update(JSON.stringify(vault), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${body.toString('base64url')}`
}

function open(raw: string | undefined): Vault {
  const k = key()
  if (!k || !raw) return {}
  const parts = raw.split('.')
  if (parts.length !== 3) return {}
  try {
    const decipher = createDecipheriv('aes-256-gcm', k, Buffer.from(parts[0], 'base64url'))
    decipher.setAuthTag(Buffer.from(parts[1], 'base64url'))
    const out = Buffer.concat([decipher.update(Buffer.from(parts[2], 'base64url')), decipher.final()])
    const parsed = JSON.parse(out.toString('utf8')) as Vault
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    // Tampered, truncated, or sealed under a rotated secret. Treat as empty:
    // the user simply logs in again.
    return {}
  }
}

/** Read the whole vault out of a request's cookie header. */
export function readVault(req: Request): Vault {
  const cookie = req.headers.get('cookie') ?? ''
  for (const part of cookie.split(/;\s*/)) {
    if (part.startsWith(`${SAP_COOKIE}=`)) {
      return open(decodeURIComponent(part.slice(SAP_COOKIE.length + 1)))
    }
  }
  return {}
}

export function readCredentials(req: Request, systemId: string): SapCredentials | null {
  return readVault(req)[systemId] ?? null
}

/** Add or replace one system's credentials, returning the Set-Cookie value. */
export function sealWith(
  req: Request,
  systemId: string,
  creds: SapCredentials | null
): string | null {
  const vault = readVault(req)
  if (creds) vault[systemId] = creds
  else delete vault[systemId]

  if (Object.keys(vault).length === 0) return clearedCookie()

  const sealed = seal(vault)
  if (!sealed) return null
  return cookie(encodeURIComponent(sealed), SAP_COOKIE_MAX_AGE)
}

export function clearedCookie(): string {
  return cookie('', 0)
}

function cookie(value: string, maxAge: number): string {
  const bits = [
    `${SAP_COOKIE}=${value}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ]
  // Vercel is always HTTPS; localhost is not, and Secure would drop the cookie.
  if (process.env.NODE_ENV === 'production') bits.push('Secure')
  return bits.join('; ')
}
