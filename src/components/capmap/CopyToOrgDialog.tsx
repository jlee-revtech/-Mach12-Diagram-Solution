'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Building2, ArrowRight, Check, X, AlertTriangle } from 'lucide-react'
import { Button, backdropClose } from '@/components/common'
import { useAuth } from '@/lib/supabase/auth-context'
import {
  previewCapabilityCopy, copyCapabilitiesToOrg,
  type CopyPreview, type CopyResult,
} from '@/lib/supabase/capmap-copy'

// Copy this org's capability library into a client organization.
//
// The source is always the org you are currently in — the board you are looking
// at IS the base set. The target is another org you belong to, or a new one
// created on the spot (Codan, Gentex, …). Scope decisions are never copied: the
// client's assessment has to be made against the client's programme.

const NEW_ORG = '__new__'

export default function CopyToOrgDialog({
  sourceOrgId, sourceOrgName, capabilityCount, onClose,
}: {
  sourceOrgId: string
  sourceOrgName: string
  capabilityCount: number
  onClose: () => void
}) {
  const { organizations, switchOrg } = useAuth()

  const otherOrgs = useMemo(
    () => organizations.filter(o => o.id !== sourceOrgId),
    [organizations, sourceOrgId],
  )

  const [target, setTarget] = useState<string>(() => (otherOrgs.length ? otherOrgs[0].id : NEW_ORG))
  const [newOrgName, setNewOrgName] = useState('')
  const [includeSystems, setIncludeSystems] = useState(true)

  const [preview, setPreview] = useState<CopyPreview | null>(null)
  const [result, setResult] = useState<CopyResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isNew = target === NEW_ORG
  const ready = isNew ? newOrgName.trim().length > 1 : !!target

  // Escape closes — the mousedown backdrop pattern covers only the pointer path.
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose, busy])

  // Any change to the target invalidates a preview taken against the old one.
  useEffect(() => { setPreview(null); setResult(null); setError(null) }, [target, newOrgName, includeSystems])

  const req = useCallback(() => ({
    sourceOrgId,
    ...(isNew ? { newOrgName: newOrgName.trim() } : { targetOrgId: target }),
    includeLogicalSystems: includeSystems,
  }), [sourceOrgId, isNew, newOrgName, target, includeSystems])

  const runPreview = useCallback(async () => {
    setBusy(true); setError(null)
    try {
      setPreview(await previewCapabilityCopy(req()))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Preview failed')
    } finally {
      setBusy(false)
    }
  }, [req])

  const runCopy = useCallback(async () => {
    setBusy(true); setError(null)
    try {
      setResult(await copyCapabilitiesToOrg(req()))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Copy failed')
    } finally {
      setBusy(false)
    }
  }, [req])

  const goToTarget = useCallback(async () => {
    if (!result) return
    // switchOrg reads from the auth context's org list, which will not include a
    // just-created org until the page reloads — so reload into it.
    await switchOrg(result.targetOrgId).catch(() => {})
    window.location.href = '/'
  }, [result, switchOrg])

  const targetLabel = isNew
    ? (newOrgName.trim() || 'New organization')
    : (otherOrgs.find(o => o.id === target)?.name || 'Organization')

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" {...backdropClose(() => { if (!busy) onClose() })}>
      <div className="bg-white rounded-xl border border-border shadow-modal w-full max-w-lg max-h-[90vh] overflow-y-auto animate-slide-in-up">
        {/* Header */}
        <div className="flex items-start gap-3 px-5 py-4 border-b border-border">
          <div className="flex-1">
            <h3 className="font-display text-heading-sm text-text-primary">Copy capabilities to an organization</h3>
            <p className="text-[11px] text-text-tertiary mt-0.5">
              Copies this org&apos;s {capabilityCount} live {capabilityCount === 1 ? 'capability' : 'capabilities'} into a client
              organization, where they can be scoped independently.
            </p>
          </div>
          <Button variant="ghost" size="sm" iconOnly aria-label="Close" onClick={onClose} disabled={busy} icon={<X size={16} />} />
        </div>

        {result ? (
          /* ─── Done ─── */
          <div className="p-5">
            <div className="flex items-start gap-3 bg-status-green/5 border border-status-green/30 rounded-lg p-4 mb-4">
              <Check size={18} className="text-status-green shrink-0 mt-0.5" />
              <div className="text-body-sm text-text-primary">
                <div className="font-semibold mb-1">
                  {result.copied > 0
                    ? `Copied ${result.copied} ${result.copied === 1 ? 'capability' : 'capabilities'} into ${result.targetOrgName}.`
                    : result.message || `${result.targetOrgName} is already up to date.`}
                </div>
                <ul className="text-[11px] text-text-secondary space-y-0.5 mt-2">
                  {result.createdOrg && <li>Created the organization {result.targetOrgName} and made you an admin.</li>}
                  {result.workstreamsSeeded > 0 && <li>Seeded {result.workstreamsSeeded} value streams.</li>}
                  {result.systemsSeeded > 0 && <li>Seeded {result.systemsSeeded} logical systems.</li>}
                  {result.systemLinks > 0 && <li>Carried {result.systemLinks} logical system mappings.</li>}
                  {result.skipped > 0 && <li>Skipped {result.skipped} already present.</li>}
                  <li>Every copied capability starts as <strong>Not Assessed</strong> — scope it in {result.targetOrgName}.</li>
                </ul>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={onClose}>Stay in {sourceOrgName}</Button>
              <Button variant="primary" onClick={goToTarget} icon={<ArrowRight size={14} />}>
                Switch to {result.targetOrgName}
              </Button>
            </div>
          </div>
        ) : (
          /* ─── Configure ─── */
          <div className="p-5 space-y-5">
            <div>
              <h4 className="text-label uppercase text-text-secondary mb-2">Copy into</h4>
              <div className="space-y-1.5">
                {otherOrgs.map(o => (
                  <label key={o.id} className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${target === o.id ? 'border-brand-500 bg-brand-50' : 'border-border hover:bg-surface-muted'}`}>
                    <input type="radio" name="target-org" value={o.id} checked={target === o.id} onChange={() => setTarget(o.id)} className="accent-brand-500" />
                    <Building2 size={14} className="text-text-tertiary shrink-0" />
                    <span className="text-body-sm text-text-primary flex-1">{o.name}</span>
                  </label>
                ))}
                <label className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${isNew ? 'border-brand-500 bg-brand-50' : 'border-border hover:bg-surface-muted'}`}>
                  <input type="radio" name="target-org" value={NEW_ORG} checked={isNew} onChange={() => setTarget(NEW_ORG)} className="accent-brand-500" />
                  <Building2 size={14} className="text-text-tertiary shrink-0" />
                  <span className="text-body-sm text-text-primary">New organization</span>
                </label>
              </div>
              {isNew && (
                <input
                  value={newOrgName}
                  onChange={e => setNewOrgName(e.target.value)}
                  placeholder="Company name, e.g. Codan"
                  aria-label="New organization name"
                  autoFocus
                  className="mt-2 w-full h-9 px-3 rounded-lg border border-border bg-surface-input text-body-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
                />
              )}
            </div>

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input type="checkbox" checked={includeSystems} onChange={e => setIncludeSystems(e.target.checked)} className="mt-0.5 accent-brand-500" />
              <span className="text-body-sm text-text-primary">
                Carry logical system mappings
                <span className="block text-[11px] text-text-tertiary mt-0.5">
                  Maps to the standard Bedrock catalog (ERP, PLM, MES…), so they remap cleanly. Physical
                  systems are never carried — those are {sourceOrgName}&apos;s landscape, not {targetLabel}&apos;s.
                </span>
              </span>
            </label>

            {preview && (
              <div className="bg-surface-muted border border-border rounded-lg p-3 text-body-sm">
                <div className="flex items-center gap-2 text-text-primary font-medium mb-1.5">
                  <span>{sourceOrgName}</span>
                  <ArrowRight size={13} className="text-text-tertiary" />
                  <span>{preview.willCreateOrg || preview.targetOrgName}</span>
                  {preview.willCreateOrg && <span className="text-[10px] uppercase tracking-wider font-mono text-brand-600 bg-brand-50 border border-brand-200 rounded px-1 py-0.5">new</span>}
                </div>
                <ul className="text-[11px] text-text-secondary space-y-0.5">
                  <li><strong className="text-text-primary">{preview.willCopy}</strong> capabilities will be copied.</li>
                  {preview.willSkip > 0 && <li>{preview.willSkip} already present and will be left alone (scope decisions untouched).</li>}
                  {includeSystems && <li>{preview.systemLinks} logical system mappings will come across.</li>}
                </ul>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
                <AlertTriangle size={14} className="text-red-600 shrink-0 mt-0.5" />
                <span className="text-[11px] text-red-700">{error}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
              {preview ? (
                <Button variant="primary" onClick={runCopy} loading={busy} disabled={!ready}>
                  {busy ? 'Copying…' : `Copy ${preview.willCopy} to ${preview.willCreateOrg || preview.targetOrgName}`}
                </Button>
              ) : (
                <Button variant="primary" onClick={runPreview} loading={busy} disabled={!ready}>
                  {busy ? 'Checking…' : 'Preview copy'}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
