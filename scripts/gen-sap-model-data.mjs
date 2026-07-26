// Regenerate src/lib/sap-model/data.ts from a live ZCL_M12_ORG_MODEL_DUMP run.
//
// The SAP Model page renders a committed snapshot; when config is added in the
// sandbox (e.g. via Solution Studio Build Playbooks) this script refreshes it:
//
//   1. Run class ZCL_M12_ORG_MODEL_DUMP on vhcals4hcs (sap-vibe MCP
//      run_abap_class) and save the output to a file.
//   2. node scripts/gen-sap-model-data.mjs <dump-file>
//   3. Review the diff, commit, push (Vercel deploys).
//
// Accepts either the raw MCP tool-result wrapper ({className, output}) or the
// bare inner JSON. Scope is controlling area A000. The profit-center hierarchy
// (ZCL_M12_PC_HIER_DUMP) and the curated RA-key labels are PRESERVED from the
// existing data.ts; everything else is rebuilt from the dump.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const KOKRS = "A000";
const here = dirname(fileURLToPath(import.meta.url));
const DATA_TS = join(here, "..", "src", "lib", "sap-model", "data.ts");

const dumpPath = process.argv[2];
if (!dumpPath) {
  console.error("Usage: node scripts/gen-sap-model-data.mjs <dump-file>");
  process.exit(1);
}

// ── Load dump (wrapper or bare) ───────────────────────────────────────────────
const rawDump = readFileSync(dumpPath, "utf8");
let dump;
{
  const parsed = JSON.parse(rawDump.slice(rawDump.indexOf("{")));
  dump = typeof parsed.output === "string" ? JSON.parse(parsed.output) : parsed;
}
if (!Array.isArray(dump.controlling_areas)) {
  console.error("Dump JSON missing controlling_areas - wrong file?");
  process.exit(1);
}

// ── Load existing model (preserve hierarchy + labels + assignment prose) ──────
const prevRaw = readFileSync(DATA_TS, "utf8");
const prev = JSON.parse(
  prevRaw.slice(prevRaw.indexOf("{", prevRaw.indexOf("SAP_ENTERPRISE_MODEL")), prevRaw.lastIndexOf("}") + 1)
);
const raLabel = new Map(prev.raKeys.map((k) => [k.key, k.label]));

// ── A000 scope ────────────────────────────────────────────────────────────────
const ccSet = new Set(dump.coarea_cocode.filter((r) => r.kokrs === KOKRS).map((r) => r.bukrs));
const co = dump.controlling_areas.find((c) => c.kokrs === KOKRS);

const plants = dump.plants.filter((p) => ccSet.has(p.bukrs));
const plantSet = new Set(plants.map((p) => p.werks));
const slocByPlant = new Map();
for (const s of dump.storage_locations) {
  if (!plantSet.has(s.werks)) continue;
  if (!slocByPlant.has(s.werks)) slocByPlant.set(s.werks, []);
  slocByPlant.get(s.werks).push(s.lgort);
}
for (const v of slocByPlant.values()) v.sort();

const pcAssign = dump.profit_center_cocode.filter((r) => r.kokrs === KOKRS && ccSet.has(r.bukrs));
const pcA000 = dump.profit_centers.filter((p) => p.kokrs === KOKRS);
const pcName = new Map(pcA000.map((p) => [p.prctr, p.name]));
const ccA000 = dump.cost_centers.filter((c) => c.kokrs === KOKRS && ccSet.has(c.bukrs));
const salesOrgs = dump.sales_orgs.filter((s) => ccSet.has(s.bukrs));
const purchPlants = new Map();
for (const r of dump.purchorg_plant) {
  if (!r.ekorg) continue;
  if (!purchPlants.has(r.ekorg)) purchPlants.set(r.ekorg, []);
  purchPlants.get(r.ekorg).push(r.werks);
}
const purchasingOrgs = dump.purchasing_orgs
  .filter((p) => ccSet.has(p.bukrs) || (purchPlants.get(p.ekorg) ?? []).some((w) => plantSet.has(w)))
  .map((p) => ({ ekorg: p.ekorg, name: p.name, bukrs: p.bukrs, plants: (purchPlants.get(p.ekorg) ?? []).sort() }));

const wbsRa = dump.wbs_ra.filter((w) => w.kokrs === KOKRS && w.ra_key && ccSet.has(w.bukrs));

const countBy = (rows, key) => {
  const m = {};
  for (const r of rows) m[r[key]] = (m[r[key]] ?? 0) + 1;
  return m;
};

const pcCountByCC = countBy(pcAssign, "bukrs");
const ccCountByCC = countBy(ccA000, "bukrs");
const plantCountByCC = countBy(plants, "bukrs");
const wbsCountByCC = countBy(wbsRa, "bukrs");

const companyCodes = dump.company_codes
  .filter((c) => ccSet.has(c.bukrs))
  .map((c) => ({
    bukrs: c.bukrs,
    name: c.name,
    country: c.country,
    currency: c.currency,
    chart: c.chart,
    plantCount: plantCountByCC[c.bukrs] ?? 0,
    profitCenterCount: pcCountByCC[c.bukrs] ?? 0,
    costCenterCount: ccCountByCC[c.bukrs] ?? 0,
    wbsRaCount: wbsCountByCC[c.bukrs] ?? 0,
    salesOrgs: salesOrgs.filter((s) => s.bukrs === c.bukrs).map((s) => s.vkorg).sort(),
    purchasingOrgs: purchasingOrgs.filter((p) => p.bukrs === c.bukrs).map((p) => p.ekorg).sort(),
  }))
  .sort((a, b) => (b.wbsRaCount - a.wbsRaCount) || a.bukrs.localeCompare(b.bukrs));

// ── RA rollups ────────────────────────────────────────────────────────────────
const raKeyAgg = new Map();
for (const w of wbsRa) {
  if (!raKeyAgg.has(w.ra_key)) raKeyAgg.set(w.ra_key, { key: w.ra_key, count: 0, levels: {} });
  const a = raKeyAgg.get(w.ra_key);
  a.count += 1;
  a.levels[w.level] = (a.levels[w.level] ?? 0) + 1;
}
const raKeys = [...raKeyAgg.values()]
  .sort((a, b) => b.count - a.count)
  .map((a) => ({ ...a, label: raLabel.get(a.key) ?? `RA key ${a.key}` }));

const raCCAgg = new Map();
for (const w of wbsRa) {
  if (!raCCAgg.has(w.bukrs)) raCCAgg.set(w.bukrs, { bukrs: w.bukrs, count: 0, keys: {}, levels: {} });
  const a = raCCAgg.get(w.bukrs);
  a.count += 1;
  a.keys[w.ra_key] = (a.keys[w.ra_key] ?? 0) + 1;
  a.levels[`L${w.level}`] = (a.levels[`L${w.level}`] ?? 0) + 1;
}
const raByCompanyCode = [...raCCAgg.values()].sort((a, b) => b.count - a.count);

const raProjAgg = new Map();
for (const w of wbsRa) {
  const key = w.project || w.posid;
  if (!raProjAgg.has(key)) raProjAgg.set(key, { project: key, name: w.project_name || w.name, bukrs: w.bukrs, wbsCount: 0, keys: new Set() });
  const a = raProjAgg.get(key);
  a.wbsCount += 1;
  a.keys.add(w.ra_key);
}
const raProjects = [...raProjAgg.values()]
  .map((a) => ({ ...a, keys: [...a.keys].sort() }))
  .sort((a, b) => b.wbsCount - a.wbsCount);

// ── Assignments: keep the curated prose, refresh the counts ───────────────────
const assignmentCounts = {
  "Controlling Area → Company Code": ccSet.size,
  "Company Code → Plant": plants.length,
  "Plant → Storage Location": [...slocByPlant.values()].reduce((n, v) => n + v.length, 0),
  "Company Code → Sales Organization": salesOrgs.length,
  "Company Code → Purchasing Organization": purchasingOrgs.length,
  "Purchasing Organization → Plant": [...purchPlants.entries()].filter(([e]) => purchasingOrgs.some((p) => p.ekorg === e)).reduce((n, [, v]) => n + v.length, 0),
  "Company Code → Profit Center": pcAssign.length,
  "Company Code → Cost Center": ccA000.length,
  "Project / WBS → RA Key": wbsRa.length,
};
const assignments = prev.assignments.map((a) => ({
  ...a,
  count: assignmentCounts[a.relationship] ?? a.count,
}));

// ── Drill lists ───────────────────────────────────────────────────────────────
const profitCentersByCompanyCode = {};
for (const r of pcAssign) {
  (profitCentersByCompanyCode[r.bukrs] ??= []).push({ prctr: r.prctr, name: pcName.get(r.prctr) ?? "" });
}
for (const v of Object.values(profitCentersByCompanyCode)) v.sort((a, b) => a.prctr.localeCompare(b.prctr));

const costCentersByCompanyCode = {};
for (const c of ccA000) {
  (costCentersByCompanyCode[c.bukrs] ??= []).push({ kostl: c.kostl, name: c.name, prctr: c.prctr });
}
for (const v of Object.values(costCentersByCompanyCode)) v.sort((a, b) => a.kostl.localeCompare(b.kostl));

// ── Assemble ──────────────────────────────────────────────────────────────────
const today = new Date().toISOString().slice(0, 10);
const model = {
  source: { ...prev.source, pulledOn: today },
  controllingArea: { kokrs: co.kokrs, name: co.name, currency: co.currency, chart: co.chart, fiscalVar: co.fiscal_var },
  companyCodes,
  plants: plants.map((p) => ({ werks: p.werks, name: p.name, bukrs: p.bukrs, storageLocations: slocByPlant.get(p.werks) ?? [] })),
  salesOrgs: salesOrgs.map((s) => ({ vkorg: s.vkorg, name: s.name, bukrs: s.bukrs })),
  purchasingOrgs,
  businessAreas: dump.business_areas.map((b) => ({
    gsber: b.gsber,
    name: b.name,
    used: ccA000.some((c) => c.gsber === b.gsber),
  })),
  profitCenters: {
    byCompanyCode: pcCountByCC,
    total: pcA000.length,
    sample: pcA000.slice(0, 16).map((p) => ({ prctr: p.prctr, name: p.name })),
  },
  costCenters: {
    byCompanyCode: ccCountByCC,
    total: ccA000.length,
    sample: ccA000.slice(0, 13).map((c) => ({ kostl: c.kostl, name: c.name, bukrs: c.bukrs, prctr: c.prctr })),
  },
  raKeys,
  raByCompanyCode,
  raProjects,
  assignments,
  profitCentersByCompanyCode,
  costCentersByCompanyCode,
  wbsRa: wbsRa.map((w) => ({ posid: w.posid, name: w.name, bukrs: w.bukrs, level: w.level, raKey: w.ra_key, project: w.project })),
  profitCenterHierarchy: prev.profitCenterHierarchy,
};

const header = `// AUTO-GENERATED SNAPSHOT — SAP Enterprise Data Model (controlling area A000)
// Source: live pull from the connected S/4HANA sandbox (vhcals4hcs, client 100) via the
// SAP-Vibe MCP server (ZCL_M12_ORG_MODEL_DUMP + ZCL_M12_PC_HIER_DUMP), on ${today}.
// This is real configuration data, not mock data. Regenerate with
// scripts/gen-sap-model-data.mjs (see its header for the workflow).
import type { SapEnterpriseModel } from './types'

export const SAP_ENTERPRISE_MODEL: SapEnterpriseModel = `;

writeFileSync(DATA_TS, `${header}${JSON.stringify(model, null, 2)}\n`, "utf8");

console.log(`data.ts regenerated (pulled ${today})`);
console.log(`  company codes: ${companyCodes.length} (${companyCodes.map((c) => c.bukrs).join(", ")})`);
console.log(`  plants: ${plants.length}, storage locations: ${assignmentCounts["Plant → Storage Location"]}`);
console.log(`  purchasing orgs: ${purchasingOrgs.length}, sales orgs: ${salesOrgs.length}`);
console.log(`  profit centers: ${pcA000.length}, cost centers: ${ccA000.length}, RA WBS: ${wbsRa.length}`);
