import { readFileSync } from 'node:fs'
for (const l of readFileSync('.env.local','utf8').split(/\r?\n/)) { const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if(m&&!process.env[m[1]]) process.env[m[1]]=m[2] }
const { generateSectionContent } = await import('@jlee-revtech/agent-core')
const base = { sectionKind:'workstream', title:'Record-to-Report: Finance, EVMS, DCAA, and CAS Segregation Impact',
  objective:'Assess how company code separation affects CAS-covered vs commercial cost pools', topic:'Commercial Company Code Decision', customerName:'Moog',
  workstream:{code:'record-to-report',name:'Record-to-Report'}, focus:'process', timeboxMinutes:20, durationMinutes:120,
  guidance:'Keep it executive-level, favor buy over build, and flag any FAR/DFARS exposure.',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY }
for (let i=1;i<=3;i++){
  const r = await generateSectionContent({...base})
  const c = r?.content
  const dec = c?.keyDecisions||[]
  console.log(`run ${i}: decisions=${dec.length} withDiagram=${dec.filter(d=>d.diagram).length} sectionDiagrams=${(c?.diagrams||[]).length} options=${(c?.futureStateOptions||[]).length}`)
}
