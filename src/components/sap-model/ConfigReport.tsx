'use client'

import type { SapEnterpriseModel } from '@/lib/sap-model/types'
import { ENTITY_META } from '@/lib/sap-model/entityMeta'

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/40 rounded-xl p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-[var(--m12-text)]">{title}</h3>
        {hint && <p className="text-[11px] text-[var(--m12-text-muted)] mt-0.5">{hint}</p>}
      </div>
      {children}
    </div>
  )
}

const th = 'text-left text-[10px] uppercase tracking-wider text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)] font-medium px-2.5 py-1.5'
const td = 'px-2.5 py-1.5 text-[12px] text-[var(--m12-text-secondary)] border-t border-[var(--m12-border)]/25'
const mono = 'font-[family-name:var(--font-space-mono)]'

export default function ConfigReport({ model: m }: { model: SapEnterpriseModel }) {
  const raTotal = m.raByCompanyCode.reduce((n, r) => n + r.count, 0)

  return (
    <div className="space-y-4 max-w-[1100px] pb-12">
      {/* Controlling area + org summary */}
      <Section
        title={`Controlling Area ${m.controllingArea.kokrs} — ${m.controllingArea.name}`}
        hint={`The top of the SAP enterprise structure for this scope. Operating currency ${m.controllingArea.currency}, chart of accounts ${m.controllingArea.chart}, fiscal-year variant ${m.controllingArea.fiscalVar}. ${m.companyCodes.length} company codes are assigned to it (TKA02), giving them a shared cost-accounting and management-reporting boundary.`}
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
          {[
            { k: 'company_code', label: 'Company Codes', value: m.companyCodes.length },
            { k: 'plant', label: 'Plants', value: m.plants.length },
            { k: 'storage_location', label: 'Storage Locs', value: m.plants.reduce((n, p) => n + p.storageLocations.length, 0) },
            { k: 'sales_org', label: 'Sales Orgs', value: m.salesOrgs.length },
            { k: 'purchasing_org', label: 'Purchasing Orgs', value: m.purchasingOrgs.length },
            { k: 'profit_center', label: 'Profit Centers', value: m.profitCenters.total },
            { k: 'cost_center', label: 'Cost Centers', value: m.costCenters.total },
            { k: 'business_area', label: 'Business Areas', value: m.businessAreas.length },
            { k: 'wbs_ra', label: 'RA-keyed WBS', value: raTotal },
            { k: 'wbs_ra', label: 'RA Projects', value: m.raProjects.length },
          ].map((c) => {
            const meta = ENTITY_META[c.k as keyof typeof ENTITY_META]
            return (
              <div key={c.label} className="rounded-lg border border-[var(--m12-border)]/30 px-2.5 py-2" style={{ background: meta.color + '0d' }}>
                <div className={`text-lg font-bold ${mono}`} style={{ color: meta.color }}>{c.value}</div>
                <div className="text-[10px] text-[var(--m12-text-muted)] leading-tight">{c.label}</div>
              </div>
            )
          })}
        </div>
      </Section>

      {/* Company codes */}
      <Section title="Company Codes" hint="Each company code is a self-balancing legal/financial entity. Plants, sales orgs and purchasing orgs are assigned to exactly one company code; profit & cost centers are shared from the controlling area.">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={th}>Code</th><th className={th}>Name</th><th className={th}>Ctry</th><th className={th}>Curr</th>
                <th className={th}>Chart</th><th className={th}>Plants</th><th className={th}>Prof. Ctr</th><th className={th}>Cost Ctr</th><th className={th}>RA WBS</th>
              </tr>
            </thead>
            <tbody>
              {m.companyCodes.map((c) => (
                <tr key={c.bukrs}>
                  <td className={`${td} ${mono} font-semibold text-[var(--m12-text)]`}>{c.bukrs}</td>
                  <td className={td}>{c.name}</td>
                  <td className={`${td} ${mono}`}>{c.country}</td>
                  <td className={`${td} ${mono}`}>{c.currency}</td>
                  <td className={`${td} ${mono}`}>{c.chart}</td>
                  <td className={`${td} ${mono}`}>{c.plantCount}</td>
                  <td className={`${td} ${mono}`}>{c.profitCenterCount}</td>
                  <td className={`${td} ${mono}`}>{c.costCenterCount}</td>
                  <td className={`${td} ${mono} font-semibold`} style={{ color: c.wbsRaCount ? ENTITY_META.wbs_ra.color : undefined }}>{c.wbsRaCount || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Assignment matrix */}
      <Section title="How the structure is configured" hint="Every relationship below is established by a specific SAP configuration object. This is the wiring the diagram visualizes.">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={th}>Relationship</th><th className={th}>Configured via</th><th className={th}>Count</th><th className={th}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {m.assignments.map((a) => (
                <tr key={a.relationship}>
                  <td className={`${td} text-[var(--m12-text)] font-medium`}>{a.relationship}</td>
                  <td className={`${td} ${mono} text-[var(--m12-text-secondary)]`}>{a.via}</td>
                  <td className={`${td} ${mono} font-semibold`}>{a.count}</td>
                  <td className={`${td} text-[var(--m12-text-muted)]`}>{a.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Plants & storage locations */}
      <Section title="Plants & Storage Locations" hint="Plants tie to a company code through their valuation area (T001K); storage locations (T001L) are inventory-managing sub-locations within a plant.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {m.plants.map((p) => (
            <div key={p.werks} className="flex items-start gap-2.5 rounded-lg border border-[var(--m12-border)]/30 px-2.5 py-2">
              <span className={`${mono} text-[12px] font-bold shrink-0`} style={{ color: ENTITY_META.plant.color }}>{p.werks}</span>
              <div className="min-w-0">
                <div className="text-[12px] text-[var(--m12-text-secondary)] truncate">{p.name} <span className="text-[var(--m12-text-muted)]">· CC {p.bukrs}</span></div>
                <div className="text-[10px] text-[var(--m12-text-muted)] mt-0.5">
                  {p.storageLocations.length
                    ? <><span style={{ color: ENTITY_META.storage_location.color }}>{p.storageLocations.length} sloc</span> · <span className={mono}>{p.storageLocations.slice(0, 10).join(', ')}{p.storageLocations.length > 10 ? '…' : ''}</span></>
                    : 'no storage locations'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Sales & purchasing orgs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Section title="Sales Organizations" hint="TVKO — one company code each.">
          <div className="space-y-1.5">
            {m.salesOrgs.map((s) => (
              <div key={s.vkorg} className="flex items-center gap-2 text-[12px]">
                <span className={`${mono} font-bold`} style={{ color: ENTITY_META.sales_org.color }}>{s.vkorg}</span>
                <span className="text-[var(--m12-text-secondary)] truncate">{s.name}</span>
                <span className={`${mono} text-[10px] text-[var(--m12-text-muted)] ml-auto`}>CC {s.bukrs}</span>
              </div>
            ))}
          </div>
        </Section>
        <Section title="Purchasing Organizations" hint="T024E (company code) + T024W (plant assignment).">
          <div className="space-y-1.5">
            {m.purchasingOrgs.map((p) => (
              <div key={p.ekorg} className="flex items-center gap-2 text-[12px]">
                <span className={`${mono} font-bold`} style={{ color: ENTITY_META.purchasing_org.color }}>{p.ekorg}</span>
                <span className="text-[var(--m12-text-secondary)] truncate">{p.name}</span>
                <span className={`${mono} text-[10px] text-[var(--m12-text-muted)] ml-auto`}>{p.plants.length ? `plants ${p.plants.join(', ')}` : `CC ${p.bukrs}`}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* Revenue Recognition / Results Analysis */}
      <Section
        title="Revenue Recognition — Results Analysis (RA) keys on WBS"
        hint="The Results Analysis key (PRPS-ABGSL) on a WBS element marks the level at which SAP performs revenue recognition / results analysis. We traversed projects only down to the WBS levels where a key is set — below shows every such level in controlling area A000."
      >
        <div className="overflow-x-auto mb-3">
          <table className="w-full border-collapse">
            <thead>
              <tr><th className={th}>RA Key</th><th className={th}>Meaning</th><th className={th}>WBS</th><th className={th}>Set at levels</th></tr>
            </thead>
            <tbody>
              {m.raKeys.map((r) => (
                <tr key={r.key}>
                  <td className={`${td} ${mono} font-bold`} style={{ color: ENTITY_META.wbs_ra.color }}>{r.key}</td>
                  <td className={td}>{r.label}</td>
                  <td className={`${td} ${mono} font-semibold`}>{r.count}</td>
                  <td className={`${td} ${mono} text-[var(--m12-text-muted)]`}>
                    {Object.entries(r.levels).sort().map(([l, n]) => `L${l}×${n}`).join('   ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-[var(--m12-text-muted)] mb-2">
          {raTotal} WBS elements across {m.raProjects.length} projects carry an RA key. Distribution by company code:
          {' '}{m.raByCompanyCode.map((r) => `${r.bukrs} (${r.count})`).join(', ')}.
        </p>
      </Section>

      {/* RA projects */}
      <Section title="Projects carrying RA-keyed WBS" hint="Project definitions in A000 with at least one revenue-recognition (RA-keyed) WBS element, ordered by WBS count.">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr><th className={th}>Project</th><th className={th}>Description</th><th className={th}>CC</th><th className={th}>RA WBS</th><th className={th}>RA Keys</th></tr>
            </thead>
            <tbody>
              {m.raProjects.map((p) => (
                <tr key={p.project}>
                  <td className={`${td} ${mono} font-semibold text-[var(--m12-text)]`}>{p.project}</td>
                  <td className={`${td} truncate max-w-[280px]`}>{p.name}</td>
                  <td className={`${td} ${mono}`}>{p.bukrs}</td>
                  <td className={`${td} ${mono} font-semibold`}>{p.wbsCount}</td>
                  <td className={`${td} ${mono} text-[var(--m12-text-muted)]`}>{p.keys.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Profit centers by company code (alignment) */}
      <Section title={`Profit Centers by Company Code — ${m.profitCenters.total} total`} hint="Profit centers live at controlling-area level but are aligned to company codes via CEPC_BUKRS. Here they are grouped within each company code.">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {m.companyCodes.filter((c) => (m.profitCentersByCompanyCode[c.bukrs] ?? []).length).map((c) => (
            <div key={c.bukrs} className="rounded-lg border border-[var(--m12-border)]/30 p-2.5">
              <div className="flex items-baseline gap-2 mb-1.5">
                <span className={`${mono} text-[12px] font-bold text-[var(--m12-text)]`}>{c.bukrs}</span>
                <span className="text-[10px] text-[var(--m12-text-muted)] truncate">{c.name}</span>
                <span className={`${mono} text-[10px] ml-auto`} style={{ color: ENTITY_META.profit_center.color }}>{(m.profitCentersByCompanyCode[c.bukrs] ?? []).length}</span>
              </div>
              <div className="space-y-0.5">
                {(m.profitCentersByCompanyCode[c.bukrs] ?? []).map((p) => (
                  <div key={p.prctr} className="flex items-center gap-2 text-[10px]">
                    <span className={`${mono} font-semibold`} style={{ color: ENTITY_META.profit_center.color }}>{p.prctr}</span>
                    <span className="text-[var(--m12-text-secondary)] truncate">{p.name}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Cost centers by company code */}
      <Section title={`Cost Centers by Company Code — ${m.costCenters.total} total`} hint="CSKS — each cost center carries exactly one company code and one profit center. Showing the first few per company code; use the diagram drill-in for the full list.">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {m.companyCodes.filter((c) => (m.costCentersByCompanyCode[c.bukrs] ?? []).length).map((c) => {
            const list = m.costCentersByCompanyCode[c.bukrs] ?? []
            const shown = list.slice(0, 8)
            return (
              <div key={c.bukrs} className="rounded-lg border border-[var(--m12-border)]/30 p-2.5">
                <div className="flex items-baseline gap-2 mb-1.5">
                  <span className={`${mono} text-[12px] font-bold text-[var(--m12-text)]`}>{c.bukrs}</span>
                  <span className="text-[10px] text-[var(--m12-text-muted)] truncate">{c.name}</span>
                  <span className={`${mono} text-[10px] ml-auto`} style={{ color: ENTITY_META.cost_center.color }}>{list.length}</span>
                </div>
                <div className="space-y-0.5">
                  {shown.map((x) => (
                    <div key={x.kostl} className="flex items-center gap-2 text-[10px]">
                      <span className={`${mono} font-semibold`} style={{ color: ENTITY_META.cost_center.color }}>{x.kostl}</span>
                      <span className="text-[var(--m12-text-secondary)] truncate">{x.name}</span>
                      <span className={`${mono} text-[9px] text-[var(--m12-text-muted)] ml-auto shrink-0`}>{x.prctr}</span>
                    </div>
                  ))}
                  {list.length > shown.length && <div className="text-[9px] text-[var(--m12-text-muted)] pt-0.5">+{list.length - shown.length} more</div>}
                </div>
              </div>
            )
          })}
        </div>
      </Section>
    </div>
  )
}
