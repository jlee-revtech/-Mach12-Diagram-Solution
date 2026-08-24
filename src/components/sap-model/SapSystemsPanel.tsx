'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Cloud, Database, KeyRound, LogOut, Pencil, Plus, Server, ShieldCheck, Trash2,
} from 'lucide-react'

import { Button, EmptyState, LoadingState, StatusBadge } from '@/components/common'
import {
  connectSystem, createSystem, deleteSystem, disconnectSystem,
  fetchSignedIn, fetchSystems, updateSystem, type SapCapabilities,
} from '@/lib/sap/browserClient'
import type { SapSystem, SapSystemInput } from '@/lib/sap/types'

/**
 * The SAP system registry: which systems this org can hook into, which of them
 * this browser is signed in to, and the "pull the org model" trigger.
 *
 * Mirrors the system picker in SAP Solution Studio, with one difference that
 * matters here - the list is org-scoped in Supabase rather than per-browser
 * localStorage, so a team shares it. Passwords are never part of that: they go
 * straight to SAP to be verified and then into an encrypted httpOnly cookie.
 */

interface Props {
  orgId: string
  userId: string
  token: string | null
  onPull: (system: SapSystem) => void
  pullingSystemId?: string | null
}

export default function SapSystemsPanel({ orgId, userId, token, onPull, pullingSystemId }: Props) {
  const [systems, setSystems] = useState<SapSystem[]>([])
  const [capabilities, setCapabilities] = useState<SapCapabilities | null>(null)
  const [signedIn, setSignedIn] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<SapSystem | 'new' | null>(null)
  const [logonFor, setLogonFor] = useState<SapSystem | null>(null)

  const refresh = useCallback(async () => {
    setError(null)
    try {
      const [{ systems: list, capabilities: caps }, ids] = await Promise.all([
        fetchSystems(token, orgId),
        fetchSignedIn(token).catch(() => [] as string[]),
      ])
      setSystems(list)
      setCapabilities(caps)
      setSignedIn(new Set(ids))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load systems.')
    } finally {
      setLoading(false)
    }
  }, [orgId, token])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function handleSave(input: SapSystemInput) {
    const existing = editing !== 'new' ? editing : null
    if (existing) await updateSystem(token, orgId, existing.id, input)
    else await createSystem(token, orgId, userId, input)
    setEditing(null)
    await refresh()
  }

  async function handleDelete(system: SapSystem) {
    if (!confirm(`Remove "${system.name}" from the registry? Stored snapshots are kept.`)) return
    try {
      await deleteSystem(token, orgId, system.id)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove the system.')
    }
  }

  async function handleSignOut(system: SapSystem) {
    await disconnectSystem(token, system.id)
    await refresh()
  }

  if (loading) return <LoadingState variant="inline" label="Loading systems..." />

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-lg border border-status-red/30 bg-status-red-bg text-status-red px-3 py-2 text-body-sm">
          {error}
        </div>
      )}

      <CapabilityNote capabilities={capabilities} />

      <div className="flex items-center justify-between">
        <h3 className="text-heading-sm font-display text-text-primary">Registered systems</h3>
        {!editing && (
          <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => setEditing('new')}>
            Add system
          </Button>
        )}
      </div>

      {editing && (
        <SystemForm
          system={editing === 'new' ? null : editing}
          capabilities={capabilities}
          onCancel={() => setEditing(null)}
          onSave={handleSave}
        />
      )}

      {systems.length === 0 && !editing ? (
        <EmptyState
          variant="dashed"
          icon={<Server size={32} />}
          title="No SAP systems registered"
          description="Add a system to pull its organizational model straight out of the source. Connection details are shared with your organization; passwords are never stored."
          action={
            <Button variant="primary" size="md" icon={<Plus size={14} />} onClick={() => setEditing('new')}>
              Add your first system
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {systems.map((s) => (
            <SystemCard
              key={s.id}
              system={s}
              signedIn={signedIn.has(s.id)}
              pulling={pullingSystemId === s.id}
              onLogon={() => setLogonFor(s)}
              onSignOut={() => handleSignOut(s)}
              onPull={() => onPull(s)}
              onEdit={() => setEditing(s)}
              onDelete={() => handleDelete(s)}
            />
          ))}
        </div>
      )}

      {logonFor && (
        <LogonDialog
          system={logonFor}
          orgId={orgId}
          token={token}
          onClose={() => setLogonFor(null)}
          onDone={async () => {
            setLogonFor(null)
            await refresh()
          }}
        />
      )}
    </div>
  )
}

function CapabilityNote({ capabilities }: { capabilities: SapCapabilities | null }) {
  if (!capabilities) return null
  const { directAvailable, bridgeAvailable } = capabilities
  if (directAvailable && bridgeAvailable) return null

  return (
    <div className="rounded-lg border border-border bg-surface-muted px-3 py-2 text-[12px] text-text-secondary space-y-1">
      {!directAvailable && (
        <div>
          <b className="text-text-primary">Direct logon is off.</b> Set{' '}
          <code className="font-mono">SAP_SESSION_SECRET</code> to enable it - credentials are held
          in an encrypted cookie and there is no key to encrypt them with.
        </div>
      )}
      {!bridgeAvailable && (
        <div>
          <b className="text-text-primary">The Solution Studio bridge is off.</b> Set{' '}
          <code className="font-mono">SSS_REALIZATION_URL</code> and{' '}
          <code className="font-mono">REALIZATION_SHARED_SECRET</code> to reach on-prem systems from
          this deployment.
        </div>
      )}
    </div>
  )
}

function SystemCard({
  system, signedIn, pulling, onLogon, onSignOut, onPull, onEdit, onDelete,
}: {
  system: SapSystem
  signedIn: boolean
  pulling: boolean
  onLogon: () => void
  onSignOut: () => void
  onPull: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const bridged = system.mode === 'bridge'
  // A bridged system needs no per-user logon: Solution Studio owns that session.
  const ready = bridged || signedIn

  return (
    <div className="bg-white rounded-lg border border-border shadow-card p-4 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span
          className={`w-9 h-9 rounded-lg inline-flex items-center justify-center shrink-0 ${
            bridged ? 'bg-gradient-to-br from-brand-500 to-cyan-500 text-white' : 'bg-brand-50 text-brand-600'
          }`}
        >
          {bridged ? <Cloud size={17} /> : <Server size={17} />}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-display text-heading-sm text-text-primary truncate">{system.name}</h4>
            {ready ? (
              <StatusBadge size="sm" status={bridged ? 'Bridged' : 'Signed in'} />
            ) : (
              <StatusBadge size="sm" status="Not signed in" />
            )}
          </div>
          <div className="text-body-sm text-text-secondary truncate font-mono">
            {bridged
              ? `via Solution Studio → ${system.destinationName}`
              : `${system.host}:${system.port}`}
          </div>
          <div className="text-[11px] text-text-tertiary mt-1 flex items-center gap-1.5 flex-wrap">
            {system.useSsl && !bridged && <ShieldCheck size={11} />}
            {system.client && <>Client {system.client}</>}
            {system.language && <><span aria-hidden>·</span>{system.language}</>}
            {system.username && !bridged && <><span aria-hidden>·</span>{system.username}</>}
            {system.defaultControllingArea && (
              <><span aria-hidden>·</span>CO area {system.defaultControllingArea}</>
            )}
          </div>
          {system.description && (
            <p className="text-[11px] text-text-tertiary mt-1">{system.description}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant="primary"
          size="sm"
          icon={<Database size={14} />}
          loading={pulling}
          disabled={!ready || pulling}
          onClick={onPull}
        >
          {pulling ? 'Pulling...' : 'Pull org model'}
        </Button>
        {!bridged &&
          (signedIn ? (
            <Button variant="ghost" size="sm" icon={<LogOut size={14} />} onClick={onSignOut}>
              Sign out
            </Button>
          ) : (
            <Button variant="secondary" size="sm" icon={<KeyRound size={14} />} onClick={onLogon}>
              Sign in
            </Button>
          ))}
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="sm" iconOnly icon={<Pencil size={14} />} aria-label={`Edit ${system.name}`} onClick={onEdit} />
          <Button variant="ghost" size="sm" iconOnly icon={<Trash2 size={14} />} aria-label={`Remove ${system.name}`} onClick={onDelete} />
        </div>
      </div>
    </div>
  )
}

function SystemForm({
  system, capabilities, onCancel, onSave,
}: {
  system: SapSystem | null
  capabilities: SapCapabilities | null
  onCancel: () => void
  onSave: (input: SapSystemInput) => Promise<void>
}) {
  const [mode, setMode] = useState<'direct' | 'bridge'>(system?.mode ?? 'direct')
  const [name, setName] = useState(system?.name ?? '')
  const [host, setHost] = useState(system?.host ?? '')
  const [port, setPort] = useState(String(system?.port ?? 44300))
  const [client, setClient] = useState(system?.client ?? '100')
  const [language, setLanguage] = useState(system?.language ?? 'EN')
  const [username, setUsername] = useState(system?.username ?? '')
  const [useSsl, setUseSsl] = useState(system?.useSsl ?? true)
  const [destinationName, setDestinationName] = useState(system?.destinationName ?? '')
  const [kokrs, setKokrs] = useState(system?.defaultControllingArea ?? '')
  const [description, setDescription] = useState(system?.description ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const destinations = capabilities?.destinations ?? []

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await onSave({
        name, mode, host, port: parseInt(port, 10), client, language, username,
        useSsl, destinationName, defaultControllingArea: kokrs, description,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the system.')
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="bg-white rounded-lg border border-border shadow-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-display text-heading-sm text-text-primary">
          {system ? `Edit ${system.name}` : 'Add a system'}
        </h4>
        <Button variant="ghost" size="sm" type="button" onClick={onCancel}>Cancel</Button>
      </div>

      <div className="flex gap-1 bg-surface-muted rounded-lg p-1 w-fit">
        {(['direct', 'bridge'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`px-3 py-1.5 rounded text-body-sm font-medium transition-colors ${
              mode === m ? 'bg-white text-brand-600 shadow-card' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {m === 'direct' ? 'Direct connection' : 'Via Solution Studio'}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-text-tertiary -mt-2">
        {mode === 'direct'
          ? 'This app opens an ADT session straight at the host. Works locally and against any internet-reachable system; an on-prem host will not be reachable from the deployed app.'
          : 'ADT reads are relayed through SAP Solution Studio on Cloud Foundry, which holds the BTP destination and the Cloud Connector route. Use this for on-prem systems.'}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Display name" required>
          <input className={INPUT} value={name} onChange={(e) => setName(e.target.value)} placeholder="Sandbox S/4HANA" required />
        </Field>

        {mode === 'direct' ? (
          <>
            <Field label="Host" required>
              <input className={INPUT} value={host} onChange={(e) => setHost(e.target.value)} placeholder="vhcals4hcs" required />
            </Field>
            <Field label="Port" required>
              <input className={INPUT} value={port} onChange={(e) => setPort(e.target.value)} inputMode="numeric" required />
            </Field>
            <Field label="Client" required>
              <input className={INPUT} value={client} onChange={(e) => setClient(e.target.value)} placeholder="100" required />
            </Field>
            <Field label="Default user">
              <input className={INPUT} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="JLEE" />
            </Field>
          </>
        ) : (
          <>
            <Field label="Destination" required>
              {destinations.length > 0 ? (
                <select className={INPUT} value={destinationName} onChange={(e) => setDestinationName(e.target.value)} required>
                  <option value="">Select a destination...</option>
                  {destinations.map((d) => (
                    <option key={d.name} value={d.name}>
                      {d.name}{d.description ? ` — ${d.description}` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <input className={INPUT} value={destinationName} onChange={(e) => setDestinationName(e.target.value)} placeholder="S4HANA_ADT" required />
              )}
            </Field>
            <Field label="Client (for the record)">
              <input className={INPUT} value={client} onChange={(e) => setClient(e.target.value)} placeholder="100" />
            </Field>
          </>
        )}

        <Field label="Language">
          <input className={INPUT} value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="EN" />
        </Field>
        <Field label="Default controlling area">
          <input className={INPUT} value={kokrs} onChange={(e) => setKokrs(e.target.value.toUpperCase())} placeholder="A000" />
        </Field>
      </div>

      <Field label="Notes">
        <input className={INPUT} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this system is for" />
      </Field>

      {mode === 'direct' && (
        <label className="flex items-center gap-2 text-body-sm text-text-secondary">
          <input type="checkbox" checked={useSsl} onChange={(e) => setUseSsl(e.target.checked)} />
          Use HTTPS
        </label>
      )}

      {error && (
        <div className="rounded-lg border border-status-red/30 bg-status-red-bg text-status-red px-3 py-2 text-body-sm">
          {error}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button variant="primary" size="md" type="submit" loading={busy}>
          {system ? 'Save changes' : 'Add system'}
        </Button>
        <span className="text-[11px] text-text-tertiary">Passwords are never saved here.</span>
      </div>
    </form>
  )
}

function LogonDialog({
  system, orgId, token, onClose, onDone,
}: {
  system: SapSystem
  orgId: string
  token: string | null
  onClose: () => void
  onDone: () => Promise<void>
}) {
  const [username, setUsername] = useState(system.username ?? '')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const status = await connectSystem(token, orgId, system.id, { username, password })
      if (!status.connected) {
        setError(status.message)
        setBusy(false)
        return
      }
      setPassword('')
      await onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.')
      setBusy(false)
    }
  }

  // Dismiss on backdrop click only when the gesture BEGAN on the backdrop, so
  // selecting text inside the dialog and releasing outside does not close it.
  const [downOnBackdrop, setDownOnBackdrop] = useState(false)

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onMouseDown={(e) => setDownOnBackdrop(e.target === e.currentTarget)}
      onMouseUp={(e) => {
        if (downOnBackdrop && e.target === e.currentTarget) onClose()
        setDownOnBackdrop(false)
      }}
    >
      <form
        onSubmit={submit}
        className="bg-white rounded-xl border border-border shadow-lg w-full max-w-md p-5 space-y-4"
      >
        <div>
          <h4 className="font-display text-heading-sm text-text-primary">Sign in to {system.name}</h4>
          <p className="text-[11px] text-text-tertiary mt-1 font-mono">
            {system.host}:{system.port} · client {system.client}
          </p>
        </div>

        <Field label="SAP user" required>
          <input className={INPUT} value={username} onChange={(e) => setUsername(e.target.value)} autoFocus required />
        </Field>
        <Field label="Password" required>
          <input className={INPUT} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>

        <p className="text-[11px] text-text-tertiary">
          Verified against SAP, then held in an encrypted cookie in this browser only. It is never
          written to the database and never leaves the server in a response.
        </p>

        {error && (
          <div className="rounded-lg border border-status-red/30 bg-status-red-bg text-status-red px-3 py-2 text-body-sm">
            {error}
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button variant="primary" size="md" type="submit" loading={busy}>Sign in</Button>
          <Button variant="ghost" size="md" type="button" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </div>
  )
}

const INPUT =
  'w-full h-9 px-2.5 rounded-lg border border-border bg-white text-body-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-500/30'

function Field({
  label, required, children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-medium text-text-secondary">
        {label}
        {required && <span className="text-status-red"> *</span>}
      </span>
      {children}
    </label>
  )
}
