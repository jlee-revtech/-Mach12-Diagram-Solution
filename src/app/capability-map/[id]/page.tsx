'use client'

import { use, useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/supabase/auth-context'
import { useSIPOCStore } from '@/lib/sipoc/store'
import SIPOCVisual from '@/components/sipoc/SIPOCVisual'
import CapabilityEditor from '@/components/sipoc/CapabilityEditor'

export default function CapabilityMapPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { user, organization, loading: authLoading } = useAuth()

  const map = useSIPOCStore(s => s.map)
  const loading = useSIPOCStore(s => s.loading)
  const loadMap = useSIPOCStore(s => s.loadMap)
  const loadOrgEntities = useSIPOCStore(s => s.loadOrgEntities)
  const updateTitle = useSIPOCStore(s => s.updateTitle)
  const addCapability = useSIPOCStore(s => s.addCapability)

  const [titleInput, setTitleInput] = useState('')
  const [editingTitle, setEditingTitle] = useState(false)

  // Auth gating
  useEffect(() => {
    if (!authLoading && !user) router.push('/auth')
  }, [user, authLoading, router])

  // Load map data
  useEffect(() => {
    if (id) {
      loadMap(id)
    }
  }, [id, loadMap])

  // Load org entities when org is available
  useEffect(() => {
    if (organization) {
      loadOrgEntities(organization.id)
    }
  }, [organization, loadOrgEntities])

  // Sync title input
  useEffect(() => {
    if (map) setTitleInput(map.title)
  }, [map?.title])

  const handleTitleBlur = useCallback(() => {
    setEditingTitle(false)
    if (user && titleInput.trim() && titleInput !== map?.title) {
      updateTitle(titleInput.trim(), user.id)
    }
  }, [user, titleInput, map?.title, updateTitle])

  if (authLoading || !user || loading || !map) {
    return (
      <div className="fixed inset-0 bg-[var(--m12-bg)] flex items-center justify-center">
        <div className="text-[var(--m12-text-muted)] text-sm">Loading...</div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-[var(--m12-bg)] flex flex-col">
      {/* Top bar */}
      <div className="h-12 border-b border-[var(--m12-border)]/40 bg-[var(--m12-bg-card)] flex items-center px-4 gap-4 shrink-0">
        {/* Back button */}
        <button
          onClick={() => router.push('/')}
          className="text-[var(--m12-text-muted)] hover:text-[var(--m12-text)] transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Branding */}
        <span className="text-gradient text-sm font-bold font-[family-name:var(--font-orbitron)] tracking-wide">
          MACH12
        </span>
        <span className="text-[var(--m12-text-muted)] text-xs">/</span>

        {/* Title (inline editable) */}
        {editingTitle ? (
          <input
            value={titleInput}
            onChange={e => setTitleInput(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={e => e.key === 'Enter' && handleTitleBlur()}
            autoFocus
            className="bg-transparent border-b border-[#2563EB] text-sm font-medium text-[var(--m12-text)] py-0.5 focus:outline-none max-w-[300px]"
          />
        ) : (
          <button
            onClick={() => setEditingTitle(true)}
            className="text-sm font-medium text-[var(--m12-text)] hover:text-[#2563EB] transition-colors truncate max-w-[300px]"
          >
            {map.title}
          </button>
        )}

        {/* Badge */}
        <div className="inline-flex items-center gap-1.5 bg-[#8B5CF6]/10 border border-[#8B5CF6]/30 rounded px-2 py-0.5">
          <div className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6]" />
          <span className="text-[9px] font-[family-name:var(--font-space-mono)] text-[#8B5CF6] uppercase tracking-wider font-bold">
            SIPOC
          </span>
        </div>

        <div className="flex-1" />

        {/* Add capability button */}
        <button
          onClick={() => {
            const name = prompt('Capability name:')
            if (name?.trim()) addCapability(name.trim())
          }}
          className="flex items-center gap-1.5 bg-[#2563EB] hover:bg-[#3B82F6] text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          Add Capability
        </button>
      </div>

      {/* Main content: visual + editor */}
      <div className="flex flex-1 overflow-hidden">
        {/* SIPOC visual area */}
        <div className="flex-1 overflow-auto p-6">
          <SIPOCVisual />
        </div>

        {/* Editor sidebar */}
        {organization && <CapabilityEditor orgId={organization.id} />}
      </div>
    </div>
  )
}
