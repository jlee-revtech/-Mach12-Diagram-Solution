// The raw org-model dump, and the two ways of producing it.
//
// This is the exact JSON shape ZCL_M12_ORG_MODEL_DUMP emits. Both read paths
// converge on it so the model builder never knows which one ran:
//
//   freestyle - the dump class's own SELECTs, replayed one at a time through the
//               ADT data preview. Read-only, portable, needs nothing deployed on
//               the target. This is the default and works on any NW 7.40+ system.
//   classrun  - the dump class itself, when it happens to exist. One round trip
//               instead of thirteen, which matters on a slow system.

import { ORG_MODEL_DUMP_CLASS, PC_HIERARCHY_DUMP_CLASS } from './dumpClasses'
import type { PullDiagnostic, SapReader } from './types'

export interface RawDump {
  controlling_areas: { kokrs: string; name: string; currency: string; chart: string; fiscal_var: string }[]
  coarea_cocode: { kokrs: string; bukrs: string }[]
  company_codes: { bukrs: string; name: string; country: string; currency: string; chart: string }[]
  business_areas: { gsber: string; name: string }[]
  profit_centers: { prctr: string; kokrs: string; name: string }[]
  profit_center_cocode: { kokrs: string; prctr: string; bukrs: string }[]
  plants: { werks: string; name: string; bukrs: string }[]
  storage_locations: { werks: string; lgort: string; name: string }[]
  cost_centers: { kokrs: string; kostl: string; bukrs: string; gsber: string; prctr: string; name: string }[]
  sales_orgs: { vkorg: string; bukrs: string; name: string }[]
  purchasing_orgs: { ekorg: string; name: string; bukrs: string }[]
  purchorg_plant: { ekorg: string; werks: string }[]
  wbs_ra: {
    posid: string; name: string; bukrs: string; kokrs: string; level: string
    ra_key: string; prctr: string; project: string; project_name: string
  }[]
}

export interface RawHierarchy {
  groups: { setname: string; text: string }[]
  edges: { parent: string; child: string }[]
  leaves: { setname: string; from: string; to: string }[]
}

const EMPTY: RawDump = {
  controlling_areas: [], coarea_cocode: [], company_codes: [], business_areas: [],
  profit_centers: [], profit_center_cocode: [], plants: [], storage_locations: [],
  cost_centers: [], sales_orgs: [], purchasing_orgs: [], purchorg_plant: [], wbs_ra: [],
}

// Row caps mirroring the dump class, so both paths return comparable volumes.
const CAP = {
  profitCenters: 500,
  profitCenterCocode: 2000,
  storageLocations: 1000,
  costCenters: 600,
  wbsRa: 800,
  plain: 1000,
  hierarchy: 3000,
}

/**
 * One freestyle read. Never throws: a failed read is recorded as a diagnostic and
 * yields an empty slice, so one missing table (an industry solution absent, an
 * authorization gap) degrades that section instead of failing the whole pull.
 */
async function read<T>(
  reader: SapReader,
  diagnostics: PullDiagnostic[],
  step: string,
  table: string,
  sql: string,
  maxRows: number,
  map: (row: Record<string, string>) => T
): Promise<T[]> {
  const started = Date.now()
  try {
    const res = await reader.dataPreview(sql, maxRows)
    diagnostics.push({
      step, table, rows: res.rows.length, totalRows: res.totalRows,
      truncated: res.truncated, ms: Date.now() - started,
    })
    return res.rows.map(map)
  } catch (err) {
    diagnostics.push({
      step, table, rows: 0, ms: Date.now() - started,
      error: err instanceof Error ? err.message : 'read failed',
    })
    return []
  }
}

const s = (v: string | undefined) => (v ?? '').trim()

/**
 * How many reads may be in flight at once.
 *
 * Not a throughput knob - a courtesy limit. Each read occupies a dialog work
 * process for its duration, and these run 17-28s apiece on the reference
 * sandbox. Firing all thirteen at once would hold thirteen work processes on
 * someone's system for half a minute; four keeps the pull well under any
 * serverless budget without being rude to the target.
 */
const MAX_CONCURRENT_READS = 4

/**
 * Run thunks with at most `limit` in flight, preserving order.
 *
 * Tuple-typed like Promise.all so a heterogeneous read list keeps a distinct
 * type per position instead of collapsing to a union.
 */
async function withConcurrency<T extends readonly (() => Promise<unknown>)[]>(
  limit: number,
  thunks: [...T]
): Promise<{ -readonly [K in keyof T]: Awaited<ReturnType<T[K]>> }> {
  const results = new Array(thunks.length)
  let next = 0
  const worker = async (): Promise<void> => {
    for (;;) {
      const i = next++
      if (i >= thunks.length) return
      results[i] = await thunks[i]()
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, thunks.length) }, worker))
  return results as { -readonly [K in keyof T]: Awaited<ReturnType<T[K]>> }
}

/**
 * Replay the dump class's SELECTs through the data preview.
 *
 * Reads run concurrently: the PRPS/PROJ join alone is ~17s on the sandbox, and
 * serialising thirteen reads behind it would blow any serverless time budget.
 */
export async function pullRawViaFreestyle(
  reader: SapReader,
  diagnostics: PullDiagnostic[]
): Promise<RawDump> {
  const [
    controlling_areas, coarea_cocode, company_codes, business_areas,
    profit_centers, profit_center_cocode, plants, storage_locations,
    cost_centers, sales_orgs, purchasing_orgs, purchorg_plant, wbs_ra,
  ] = await withConcurrency(MAX_CONCURRENT_READS, [
    () => read(reader, diagnostics, 'Controlling areas', 'TKA01',
      'SELECT kokrs, bezei, waers, ktopl, lmona FROM tka01', CAP.plain,
      (r) => ({ kokrs: s(r.KOKRS), name: s(r.BEZEI), currency: s(r.WAERS), chart: s(r.KTOPL), fiscal_var: s(r.LMONA) })),

    () => read(reader, diagnostics, 'CO area to company code', 'TKA02',
      'SELECT kokrs, bukrs FROM tka02', CAP.plain,
      (r) => ({ kokrs: s(r.KOKRS), bukrs: s(r.BUKRS) })),

    () => read(reader, diagnostics, 'Company codes', 'T001',
      'SELECT bukrs, butxt, land1, waers, ktopl FROM t001', CAP.plain,
      (r) => ({ bukrs: s(r.BUKRS), name: s(r.BUTXT), country: s(r.LAND1), currency: s(r.WAERS), chart: s(r.KTOPL) })),

    () => read(reader, diagnostics, 'Business areas', 'TGSB',
      'SELECT a~gsber, b~gtext FROM tgsb AS a LEFT OUTER JOIN tgsbt AS b ON b~gsber = a~gsber AND b~spras = @sy-langu', CAP.plain,
      (r) => ({ gsber: s(r.GSBER), name: s(r.GTEXT) })),

    () => read(reader, diagnostics, 'Profit centers', 'CEPC',
      'SELECT a~prctr, a~kokrs, b~ktext FROM cepc AS a LEFT OUTER JOIN cepct AS b ON b~prctr = a~prctr AND b~kokrs = a~kokrs AND b~datbi = a~datbi AND b~spras = @sy-langu WHERE a~datbi = \'99991231\' ORDER BY a~kokrs, a~prctr', CAP.profitCenters,
      (r) => ({ prctr: s(r.PRCTR), kokrs: s(r.KOKRS), name: s(r.KTEXT) })),

    () => read(reader, diagnostics, 'Profit center to company code', 'CEPC_BUKRS',
      'SELECT kokrs, prctr, bukrs FROM cepc_bukrs', CAP.profitCenterCocode,
      (r) => ({ kokrs: s(r.KOKRS), prctr: s(r.PRCTR), bukrs: s(r.BUKRS) })),

    () => read(reader, diagnostics, 'Plants', 'T001W',
      'SELECT a~werks, a~name1, b~bukrs FROM t001w AS a LEFT OUTER JOIN t001k AS b ON b~bwkey = a~bwkey', CAP.plain,
      (r) => ({ werks: s(r.WERKS), name: s(r.NAME1), bukrs: s(r.BUKRS) })),

    () => read(reader, diagnostics, 'Storage locations', 'T001L',
      'SELECT werks, lgort, lgobe FROM t001l ORDER BY werks, lgort', CAP.storageLocations,
      (r) => ({ werks: s(r.WERKS), lgort: s(r.LGORT), name: s(r.LGOBE) })),

    () => read(reader, diagnostics, 'Cost centers', 'CSKS',
      'SELECT a~kokrs, a~kostl, a~bukrs, a~gsber, a~prctr, b~ktext FROM csks AS a LEFT OUTER JOIN cskt AS b ON b~kokrs = a~kokrs AND b~kostl = a~kostl AND b~datbi = a~datbi AND b~spras = @sy-langu WHERE a~datbi = \'99991231\' ORDER BY a~kokrs, a~kostl', CAP.costCenters,
      (r) => ({ kokrs: s(r.KOKRS), kostl: s(r.KOSTL), bukrs: s(r.BUKRS), gsber: s(r.GSBER), prctr: s(r.PRCTR), name: s(r.KTEXT) })),

    () => read(reader, diagnostics, 'Sales organizations', 'TVKO',
      'SELECT a~vkorg, a~bukrs, b~vtext FROM tvko AS a LEFT OUTER JOIN tvkot AS b ON b~vkorg = a~vkorg AND b~spras = @sy-langu', CAP.plain,
      (r) => ({ vkorg: s(r.VKORG), bukrs: s(r.BUKRS), name: s(r.VTEXT) })),

    () => read(reader, diagnostics, 'Purchasing organizations', 'T024E',
      'SELECT ekorg, ekotx, bukrs FROM t024e', CAP.plain,
      (r) => ({ ekorg: s(r.EKORG), name: s(r.EKOTX), bukrs: s(r.BUKRS) })),

    () => read(reader, diagnostics, 'Purchasing org to plant', 'T024W',
      'SELECT werks, ekorg FROM t024w', CAP.plain,
      (r) => ({ ekorg: s(r.EKORG), werks: s(r.WERKS) })),

    () => read(reader, diagnostics, 'WBS with an RA key', 'PRPS',
      'SELECT p~posid, p~post1, p~pbukr, p~pkokr, p~stufe, p~abgsl, p~prctr, j~pspid, j~post1 AS proj_text FROM prps AS p INNER JOIN proj AS j ON j~pspnr = p~psphi WHERE p~abgsl <> @space AND p~loevm = @space ORDER BY j~pspid, p~posid', CAP.wbsRa,
      (r) => ({
        posid: s(r.POSID), name: s(r.POST1), bukrs: s(r.PBUKR), kokrs: s(r.PKOKR),
        level: s(r.STUFE), ra_key: s(r.ABGSL), prctr: s(r.PRCTR),
        project: s(r.PSPID), project_name: s(r.PROJ_TEXT),
      })),
  ])

  return {
    controlling_areas, coarea_cocode, company_codes, business_areas,
    profit_centers, profit_center_cocode, plants, storage_locations,
    cost_centers, sales_orgs, purchasing_orgs, purchorg_plant, wbs_ra,
  }
}

/** The profit-center standard hierarchy (set class 0106) for one controlling area. */
export async function pullHierarchyViaFreestyle(
  reader: SapReader,
  kokrs: string,
  diagnostics: PullDiagnostic[]
): Promise<RawHierarchy> {
  const sub = sqlLiteral(kokrs)
  const [groups, edges, leaves] = await withConcurrency(MAX_CONCURRENT_READS, [
    () => read(reader, diagnostics, 'Profit center group texts', 'SETHEADERT',
      `SELECT setname, descript FROM setheadert WHERE setclass = '0106' AND subclass = ${sub} AND langu = @sy-langu`, CAP.hierarchy,
      (r) => ({ setname: s(r.SETNAME), text: s(r.DESCRIPT) })),

    () => read(reader, diagnostics, 'Profit center group edges', 'SETNODE',
      `SELECT setname, subsetname, seqnr FROM setnode WHERE setclass = '0106' AND subclass = ${sub} ORDER BY setname, seqnr`, CAP.hierarchy,
      (r) => ({ parent: s(r.SETNAME), child: s(r.SUBSETNAME) })),

    () => read(reader, diagnostics, 'Profit center group leaves', 'SETLEAF',
      `SELECT setname, valfrom, valto, seqnr FROM setleaf WHERE setclass = '0106' AND subclass = ${sub} ORDER BY setname, seqnr`, CAP.hierarchy,
      (r) => ({ setname: s(r.SETNAME), from: s(r.VALFROM), to: s(r.VALTO) })),
  ])
  return { groups, edges, leaves }
}

/**
 * Fast path: run the dump class if the target has it. Returns null on anything
 * unexpected, which simply means the freestyle path runs instead.
 */
export async function pullRawViaClassrun(
  reader: SapReader,
  diagnostics: PullDiagnostic[]
): Promise<RawDump | null> {
  const started = Date.now()
  const out = await reader.runDumpClass(ORG_MODEL_DUMP_CLASS)
  if (!out) return null
  const parsed = parseDumpJson<RawDump>(out)
  if (!parsed || !Array.isArray(parsed.controlling_areas)) return null
  diagnostics.push({
    step: 'Org model dump class', table: ORG_MODEL_DUMP_CLASS,
    rows: parsed.controlling_areas.length, ms: Date.now() - started,
  })
  return { ...EMPTY, ...parsed }
}

export async function pullHierarchyViaClassrun(
  reader: SapReader,
  diagnostics: PullDiagnostic[]
): Promise<RawHierarchy | null> {
  const started = Date.now()
  const out = await reader.runDumpClass(PC_HIERARCHY_DUMP_CLASS)
  if (!out) return null
  const parsed = parseDumpJson<RawHierarchy>(out)
  if (!parsed || !Array.isArray(parsed.groups)) return null
  diagnostics.push({
    step: 'Profit center hierarchy dump class', table: PC_HIERARCHY_DUMP_CLASS,
    rows: parsed.groups.length, ms: Date.now() - started,
  })
  return { groups: parsed.groups ?? [], edges: parsed.edges ?? [], leaves: parsed.leaves ?? [] }
}

/** classrun replies are plain text; the JSON body starts at the first brace. */
function parseDumpJson<T>(raw: string): T | null {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    return JSON.parse(raw.slice(start, end + 1)) as T
  } catch {
    return null
  }
}

/**
 * Quote a value for inline use in an ABAP SQL literal. Controlling-area codes
 * come off a picker populated from the system itself, but this is still string
 * interpolation into SQL - reject anything that is not a plain code.
 */
export function sqlLiteral(value: string): string {
  if (!/^[A-Za-z0-9_-]{1,10}$/.test(value)) {
    throw new Error(`Refusing to build SQL with an unexpected controlling area "${value}".`)
  }
  return `'${value.toUpperCase()}'`
}
