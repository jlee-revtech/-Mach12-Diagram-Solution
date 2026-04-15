import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are an expert data architect specializing in enterprise systems integration for Aerospace & Defense and Government Contracting organizations. You help users create data architecture diagrams.

When generating diagrams, you return structured JSON matching this exact schema:

{
  "systems": [
    {
      "id": "system-1",
      "label": "System Name",
      "systemType": "erp|crm|plm|scm|middleware|database|data_warehouse|analytics|cloud|legacy|custom",
      "physicalSystem": "e.g., SAP S/4HANA, Oracle PeopleSoft, Salesforce",
      "position": { "x": number, "y": number }
    }
  ],
  "flows": [
    {
      "id": "flow-1",
      "source": "system-1",
      "target": "system-2",
      "sourceHandle": "right-src",
      "targetHandle": "left-tgt",
      "direction": "forward|bidirectional",
      "dataElements": [
        {
          "name": "Data Element Name",
          "elementType": "transaction|master_data|document|event|data_object|custom",
          "attributes": [{"name": "attribute name"}]
        }
      ]
    }
  ]
}

Position systems in a clean layout:
- Space systems horizontally ~350px apart, vertically ~250px apart
- Use a left-to-right or top-to-bottom flow that follows the business process
- Typical canvas starts at x:100, y:100

Handle IDs for connections:
- top-src, top-tgt (top of node)
- bottom-src, bottom-tgt (bottom of node)
- left-src, left-tgt (left of node)
- right-src, right-tgt (right of node)
Choose handles that create clean, non-overlapping connections.

For data_object elements, include relevant attributes as sub-items.

System types and their typical physical systems:
- erp: SAP S/4HANA, SAP ECC, Oracle E-Business Suite, Oracle Cloud ERP
- crm: Salesforce, SAP CRM, Microsoft Dynamics 365
- plm: Siemens Teamcenter, PTC Windchill, Dassault ENOVIA
- scm: SAP SCM, Oracle SCM Cloud, Kinaxis
- middleware: SAP PI/PO, MuleSoft, Dell Boomi, SAP CPI
- database: Oracle DB, SQL Server, PostgreSQL
- data_warehouse: Snowflake, SAP BW/4HANA, Azure Synapse, Databricks
- analytics: SAP Analytics Cloud, Power BI, Tableau
- cloud: AWS, Azure, GCP
- legacy: Mainframe, AS/400, custom legacy

Common A&D data flows by process:
- Procure to Pay: Purchase Requisition, Purchase Order, Goods Receipt, Invoice, Payment
- Order to Cash: Sales Order, Delivery, Billing, Invoice, Payment Receipt
- Plan to Produce: Production Order, BOM, Routing, Goods Issue, Confirmation
- Record to Report: Journal Entry, GL Posting, Trial Balance, Financial Statement
- Material Management: Material Master, BOM, Inventory, Stock Transfer`

export async function POST(req: NextRequest) {
  try {
    const { action, prompt, context, image } = await req.json()

    if (action === 'generate') {
      return handleGenerate(prompt, image)
    } else if (action === 'suggest') {
      return handleSuggest(context)
    } else if (action === 'analyze') {
      return handleAnalyze(context)
    } else if (action === 'implement') {
      return handleImplement(context)
    } else if (action === 'sipoc-generate') {
      return handleSIPOCGenerate(prompt, context)
    } else if (action === 'sipoc-analyze') {
      return handleSIPOCAnalyze(context)
    } else if (action === 'sipoc-executive-summary') {
      return handleSIPOCExecutiveSummary(context)
    } else if (action === 'sipoc-flow-diagram') {
      return handleSIPOCFlowDiagram(prompt, context)
    } else if (action === 'sipoc-bulk-load') {
      return handleSIPOCBulkLoad(prompt, context, image)
    } else if (action === 'sipoc-l2-narrative') {
      return handleSIPOCL2Narrative(context)
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err) {
    console.error('AI route error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'AI request failed' },
      { status: 500 }
    )
  }
}

async function handleGenerate(prompt: string, image?: string) {
  // Build message content — text only, or image + text
  const content: any[] = []

  if (image) {
    // image is a data URL like "data:image/png;base64,..."
    const match = image.match(/^data:(image\/\w+);base64,(.+)$/)
    if (match) {
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: match[1],
          data: match[2],
        },
      })
    }
  }

  const textPrompt = image
    ? `Analyze this screenshot/image of a data architecture or system diagram. Extract all systems, data flows, and data elements visible in the image and generate a structured diagram from it. ${prompt ? `Additional context: ${prompt}` : ''} Return ONLY valid JSON matching the schema described in your instructions. No markdown, no explanation, just the JSON object.`
    : `Generate a data architecture diagram for the following request. Return ONLY valid JSON matching the schema described in your instructions. No markdown, no explanation, just the JSON object.\n\nRequest: ${prompt}`

  content.push({ type: 'text', text: textPrompt })

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''

  // Parse JSON from response (handle potential markdown wrapping)
  let json
  try {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    json = JSON.parse(cleaned)
  } catch {
    return NextResponse.json({ error: 'Failed to parse AI response', raw: text }, { status: 500 })
  }

  return NextResponse.json(json)
}

async function handleSuggest(context: {
  sourceSystem: string
  targetSystem: string
  sourceType: string
  targetType: string
  processContext?: string
}) {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Suggest data elements that typically flow between these two systems. Return ONLY a JSON array of data elements.

Source: ${context.sourceSystem} (${context.sourceType})
Target: ${context.targetSystem} (${context.targetType})
${context.processContext ? `Process Context: ${context.processContext}` : ''}

Return format:
[
  {
    "name": "Element Name",
    "elementType": "transaction|master_data|document|event|data_object|custom",
    "description": "Brief description",
    "attributes": [{"name": "attr name"}]  // only for data_object type
  }
]

Return 5-10 of the most relevant data elements. No markdown, just JSON array.`,
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  let json
  try {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    json = JSON.parse(cleaned)
  } catch {
    return NextResponse.json({ error: 'Failed to parse suggestions', raw: text }, { status: 500 })
  }

  return NextResponse.json({ suggestions: json })
}

async function handleAnalyze(context: {
  systems: { label: string; systemType: string; physicalSystem?: string }[]
  flows: { source: string; target: string; dataElements: { name: string }[] }[]
  processContext?: string
}) {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Analyze this data architecture diagram for completeness and provide recommendations. Return ONLY valid JSON.

Current diagram:
Systems: ${JSON.stringify(context.systems)}
Data Flows: ${JSON.stringify(context.flows)}
${context.processContext ? `Process Context: ${context.processContext}` : ''}

Return format:
{
  "score": 0-100,
  "missingSystems": ["System name - reason"],
  "missingFlows": ["Source -> Target: missing data elements"],
  "dataGovernance": ["Observation about data governance"],
  "recommendations": ["Specific recommendation"]
}

No markdown, just JSON.`,
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  let json
  try {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    json = JSON.parse(cleaned)
  } catch {
    return NextResponse.json({ error: 'Failed to parse analysis', raw: text }, { status: 500 })
  }

  return NextResponse.json(json)
}

async function handleImplement(context: {
  systems: { id: string; label: string; systemType: string; physicalSystem?: string }[]
  flows: { id: string; source: string; target: string; dataElements: { name: string; elementType?: string }[] }[]
  processContext?: string
  analysis: {
    missingSystems?: string[]
    missingFlows?: string[]
    dataGovernance?: string[]
    recommendations?: string[]
  }
}) {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `You are updating an existing data architecture diagram based on analysis recommendations. The current diagram has these systems and flows. Implement the recommendations by adding new systems and data flows.

IMPORTANT RULES:
- Only ADD new systems and flows. Do NOT include existing systems or flows in your response.
- For new flows, the "source" and "target" must reference system IDs. Use existing system IDs (listed below) for connections to existing systems, and your new system IDs for new systems.
- Position new systems logically relative to the existing layout.

EXISTING SYSTEMS:
${JSON.stringify(context.systems, null, 2)}

EXISTING FLOWS:
${JSON.stringify(context.flows, null, 2)}

${context.processContext ? `Process Context: ${context.processContext}` : ''}

ANALYSIS RECOMMENDATIONS TO IMPLEMENT:
- Missing Systems: ${JSON.stringify(context.analysis.missingSystems ?? [])}
- Missing Data Flows: ${JSON.stringify(context.analysis.missingFlows ?? [])}
- Data Governance: ${JSON.stringify(context.analysis.dataGovernance ?? [])}
- Recommendations: ${JSON.stringify(context.analysis.recommendations ?? [])}

Return ONLY valid JSON with new systems and flows to ADD to the diagram. Use this schema:
{
  "systems": [
    {
      "id": "new-system-1",
      "label": "System Name",
      "systemType": "erp|crm|plm|scm|middleware|database|data_warehouse|analytics|cloud|legacy|custom",
      "physicalSystem": "e.g., SAP S/4HANA",
      "position": { "x": number, "y": number }
    }
  ],
  "flows": [
    {
      "id": "new-flow-1",
      "source": "existing-system-id OR new-system-id",
      "target": "existing-system-id OR new-system-id",
      "direction": "forward|bidirectional",
      "dataElements": [
        {
          "name": "Data Element Name",
          "elementType": "transaction|master_data|document|event|data_object|custom",
          "attributes": [{"name": "attr name"}]
        }
      ]
    }
  ]
}

No markdown, just JSON.`,
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  let json
  try {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    json = JSON.parse(cleaned)
  } catch {
    return NextResponse.json({ error: 'Failed to parse implementation', raw: text }, { status: 500 })
  }

  return NextResponse.json(json)
}

// ─── SIPOC AI Generation ────────────────────────────────

const SIPOC_SYSTEM_PROMPT = `You are an expert Business Transformation Architect specializing in Aerospace & Defense and Government Contracting. You help users model SIPOC (Suppliers, Inputs, Process, Outputs, Customers) capability maps for BPML Level 3 processes.

You understand:
- A&D business processes: Procure to Pay, Order to Cash, Plan to Produce, Plan to Perform, Record to Report, Hire to Retire, Design to Operate, Acquire to Dispose
- Enterprise systems: SAP S/4HANA, Oracle, Salesforce, Teamcenter, Windchill, Costpoint, Deltek, etc.
- Data governance, master data management, and information product flows
- Organizational roles in A&D: Program Managers, Control Account Managers, Contracts Managers, Financial Planning, Rates Management, Cost Management, Proposal Managers, Engineering, Quality, Supply Chain, etc.

When generating SIPOC data, think about:
- Who supplies each piece of information (personas/roles AND source systems)
- What the actual information products are (the data objects)
- What dimensions/attributes make up each information product
- Who consumes the outputs and why
- The end-to-end data flow through the L3 capability`

async function handleSIPOCGenerate(prompt: string, context?: {
  capabilityName?: string
  capabilityDescription?: string
  existingPersonas?: string[]
  existingInformationProducts?: string[]
  existingLogicalSystems?: string[]
  currentInputs?: {
    informationProduct: string
    category?: string
    supplierPersonas: string[]
    sourceSystems: string[]
    dimensions: string[]
  }[]
  currentOutputs?: {
    informationProduct: string
    category?: string
    consumerPersonas: string[]
    dimensions: string[]
  }[]
}) {
  const hasExistingData = (context?.currentInputs?.length || 0) > 0 || (context?.currentOutputs?.length || 0) > 0

  const entitiesBlock = context ? `
EXISTING ORG ENTITIES (reuse these names when applicable):
- Personas already defined: ${(context.existingPersonas || []).join(', ') || 'None'}
- Information Products already defined: ${(context.existingInformationProducts || []).join(', ') || 'None'}
- Logical Systems already defined: ${(context.existingLogicalSystems || []).join(', ') || 'None'}
${context.capabilityName ? `\nCapability being modeled: ${context.capabilityName}` : ''}
${context.capabilityDescription ? `Description: ${context.capabilityDescription}` : ''}` : ''

  const currentDataBlock = hasExistingData ? `
CURRENT CAPABILITY DATA (already configured — analyze for gaps and enhancements):
Current Inputs:
${JSON.stringify(context!.currentInputs, null, 2)}

Current Outputs:
${JSON.stringify(context!.currentOutputs, null, 2)}` : ''

  const modeInstructions = hasExistingData
    ? `This capability already has data configured. Your job is to:
1. Analyze what is already there for completeness
2. Suggest NEW inputs/outputs that are missing
3. For EXISTING inputs/outputs, suggest additional suppliers, source systems, consumers, or dimensions that are missing
4. Mark each item with "status": "new" for brand new items, or "enhancement" for additions to existing items
5. For enhancements, set "existingProduct" to the exact name of the existing information product being enhanced
6. Do NOT re-suggest items that are already fully configured`
    : `Generate a comprehensive SIPOC breakdown from scratch.
- Be thorough: generate ALL relevant inputs and outputs for this capability — typically 10-25+ inputs and 8-20+ outputs depending on complexity
- Do not artificially limit the count; include every data element, document, system feed, or information product that would realistically flow through this process
- Mark all items with "status": "new"`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8192,
    system: SIPOC_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `${modeInstructions}

Return ONLY valid JSON.
${entitiesBlock}
${currentDataBlock}

User request: ${prompt}

Return this exact JSON structure:
{
  "inputs": [
    {
      "status": "new|enhancement",
      "existingProduct": "Only for enhancements — exact name of the existing info product",
      "informationProduct": "Name of the information product / data object",
      "category": "Financial|Operational|Engineering|Supply Chain|Human Resources|Compliance|Customer|Program Management|Quality|Other",
      "supplierPersonas": [
        { "name": "Role Name", "role": "Brief role description" }
      ],
      "sourceSystems": [
        { "name": "System Name", "systemType": "erp|crm|plm|scm|middleware|database|data_warehouse|analytics|mes|clm|cloud|legacy|ppm|ims|hcm|fpa|custom" }
      ],
      "dimensions": [
        { "name": "Dimension/attribute name" }
      ]
    }
  ],
  "outputs": [
    {
      "status": "new|enhancement",
      "existingProduct": "Only for enhancements — exact name of the existing info product",
      "informationProduct": "Name of the output information product",
      "category": "Financial|Operational|Engineering|Supply Chain|Human Resources|Compliance|Customer|Program Management|Quality|Other",
      "consumerPersonas": [
        { "name": "Role Name", "role": "Brief role description" }
      ],
      "dimensions": [
        { "name": "Dimension/attribute name" }
      ]
    }
  ]
}

Guidelines:
- Each input should have 1-3 supplier personas and 1-2 source systems
- Each input/output should have 2-5 dimensions (the key attributes/fields of that data object)
- Each output should have 1-3 consumer personas
- Use realistic A&D terminology and role names
- Reuse existing entity names from the org context when they match
- Dimensions should represent the key data fields or measures within the information product
- For enhancements: only include the NEW suppliers, systems, consumers, or dimensions being added — not what already exists

No markdown, no explanation, just the JSON object.`,
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  let json
  try {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    json = JSON.parse(cleaned)
  } catch {
    return NextResponse.json({ error: 'Failed to parse SIPOC generation', raw: text }, { status: 500 })
  }

  return NextResponse.json(json)
}

// ─── SIPOC Analysis ─────────────────────────────────────

async function handleSIPOCAnalyze(context: {
  mapTitle: string
  capabilities: {
    name: string
    description?: string
    inputs: {
      informationProduct: string
      category?: string
      supplierPersonas: string[]
      sourceSystems: string[]
      dimensions: string[]
    }[]
    outputs: {
      informationProduct: string
      category?: string
      consumerPersonas: string[]
      dimensions: string[]
    }[]
  }[]
}) {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: SIPOC_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Analyze this SIPOC Capability Map for completeness, quality, and opportunities. Return ONLY valid JSON.

CAPABILITY MAP: "${context.mapTitle}"

CAPABILITIES:
${JSON.stringify(context.capabilities, null, 2)}

Analyze the map and return this exact JSON structure:
{
  "overallScore": 75,
  "summary": "One paragraph executive summary of the capability map's maturity and completeness.",
  "strengths": [
    "Specific strength observed in the map"
  ],
  "gaps": [
    {
      "type": "missing_input|missing_output|missing_supplier|missing_consumer|missing_system|missing_dimension|missing_capability|data_governance",
      "capability": "Which capability this applies to (or 'Overall' for map-level)",
      "title": "Short title of the gap",
      "description": "Detailed explanation of what's missing and why it matters",
      "priority": "high|medium|low"
    }
  ],
  "suggestions": [
    {
      "type": "new_input|new_output|new_capability|new_persona|new_system|reuse_opportunity|dimension_detail|process_improvement",
      "capability": "Which capability this applies to (or 'Overall')",
      "title": "Short title",
      "description": "Actionable suggestion with specific details",
      "impact": "high|medium|low"
    }
  ],
  "dataGovernance": [
    "Observation about data ownership, lineage, quality, or governance"
  ],
  "crossCapabilityInsights": [
    "Insight about how capabilities relate to each other, shared information products, or upstream/downstream dependencies"
  ]
}

Guidelines:
- Score from 0-100 based on completeness of S, I, P, O, C coverage
- Identify 2-4 strengths
- Identify 3-8 specific gaps with priority
- Provide 3-8 actionable suggestions
- Include 2-4 data governance observations
- Include 1-3 cross-capability insights if multiple capabilities exist
- Be specific — reference actual information products, personas, and systems from the map
- Think about A&D industry standards and best practices

No markdown, no explanation, just the JSON object.`,
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  let json
  try {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    json = JSON.parse(cleaned)
  } catch {
    return NextResponse.json({ error: 'Failed to parse SIPOC analysis', raw: text }, { status: 500 })
  }

  return NextResponse.json(json)
}

// ─── SIPOC Executive Summary ────────────────────────────

async function handleSIPOCExecutiveSummary(context: {
  mapTitle: string
  capabilities: {
    name: string
    description?: string
    system?: string
    inputs: {
      informationProduct: string
      category?: string
      supplierPersonas: string[]
      sourceSystems: string[]
      feedingSystem?: string
      dimensions: string[]
    }[]
    outputs: {
      informationProduct: string
      category?: string
      consumerPersonas: string[]
      dimensions: string[]
    }[]
  }[]
}) {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: SIPOC_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Create an executive-level summary of this SIPOC Capability Map for a senior architecture audience. Return ONLY valid JSON.

CAPABILITY MAP: "${context.mapTitle}"

FULL DATA:
${JSON.stringify(context.capabilities, null, 2)}

Return this exact JSON structure:
{
  "headline": "One-line headline summarizing the capability landscape (max 15 words)",
  "executiveSummary": "2-3 paragraph executive summary. Cover the scope of capabilities, the data ecosystem, key system dependencies, and organizational touchpoints. Write for a CTO/CIO audience.",
  "capabilityOverviews": [
    {
      "name": "Capability Name",
      "system": "System it runs in (or null)",
      "oneLiner": "One sentence describing what this capability does and why it matters",
      "inputCount": 5,
      "outputCount": 3,
      "keyInputs": ["Top 3 most critical input information products"],
      "keyOutputs": ["Top 3 most critical output information products"],
      "criticalSystems": ["Key systems in the data flow"],
      "riskLevel": "low|medium|high",
      "riskNote": "Brief note on data risk or dependency concern (or null if low)"
    }
  ],
  "dataLandscape": {
    "totalInformationProducts": 25,
    "totalDimensions": 80,
    "categoryCounts": { "Financial": 8, "Operational": 5 },
    "topCategories": ["Top 3 categories by count"]
  },
  "systemDependencies": [
    {
      "system": "System Name",
      "role": "Brief description of its role in the data ecosystem",
      "capabilitiesServed": 3,
      "criticality": "high|medium|low"
    }
  ],
  "personaMap": [
    {
      "persona": "Role Name",
      "involvement": "supplier|consumer|both",
      "capabilitiesInvolved": 4,
      "keyContribution": "Brief note on what they supply or consume"
    }
  ],
  "strategicInsights": [
    "High-level strategic observation about the data architecture, integration patterns, or transformation opportunities"
  ],
  "recommendations": [
    {
      "priority": 1,
      "title": "Recommendation title",
      "description": "Actionable executive recommendation",
      "impact": "Expected business impact"
    }
  ]
}

Guidelines:
- Write for executives — focus on business impact, risk, and strategic value
- Keep capability overviews concise and scannable
- Identify the 3-5 most critical system dependencies
- Highlight the top 5-8 personas by involvement
- Provide 3-5 ranked strategic recommendations
- Reference specific data from the map, not generic advice
- Think about A&D enterprise architecture patterns

No markdown, no explanation, just the JSON object.`,
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  let json
  try {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    json = JSON.parse(cleaned)
  } catch {
    return NextResponse.json({ error: 'Failed to parse executive summary', raw: text }, { status: 500 })
  }

  return NextResponse.json(json)
}

// ─── SIPOC Flow Diagram (AI-generated SVG) ──────────────

async function handleSIPOCFlowDiagram(prompt: string, context: {
  mapTitle: string
  capabilities: {
    name: string
    system?: string | null
    inputs: { informationProduct: string; category?: string; sourceSystems: string[]; feedingSystem?: string }[]
    outputs: { informationProduct: string; category?: string; consumerPersonas: string[] }[]
  }[]
}) {
  // Pre-process data into aggregated summary for the AI
  const systemSet = new Set<string>()
  const inputCats = new Map<string, { count: number; examples: string[] }>()
  const outputCats = new Map<string, { count: number; examples: string[] }>()
  const capSummaries: string[] = []

  context.capabilities.forEach(cap => {
    const sysLabel = cap.system ? ` (${cap.system})` : ''
    capSummaries.push(`${cap.name}${sysLabel}: ${cap.inputs.length} inputs, ${cap.outputs.length} outputs`)
    cap.inputs.forEach(inp => {
      const cat = inp.category || 'Other'
      const entry = inputCats.get(cat) || { count: 0, examples: [] }
      entry.count++
      if (entry.examples.length < 3) entry.examples.push(inp.informationProduct)
      inputCats.set(cat, entry)
      inp.sourceSystems.forEach(s => systemSet.add(s))
      if (inp.feedingSystem) systemSet.add(inp.feedingSystem)
    })
    cap.outputs.forEach(out => {
      const cat = out.category || 'Other'
      const entry = outputCats.get(cat) || { count: 0, examples: [] }
      entry.count++
      if (entry.examples.length < 3) entry.examples.push(out.informationProduct)
      outputCats.set(cat, entry)
    })
  })

  const dataSummary = `
SYSTEMS: ${[...systemSet].join(', ')}
CAPABILITIES: ${capSummaries.join(' | ')}
INPUT DATA DOMAINS: ${[...inputCats.entries()].map(([cat, d]) => `${cat} (${d.count} products, e.g. ${d.examples.join(', ')})`).join(' | ')}
OUTPUT DATA DOMAINS: ${[...outputCats.entries()].map(([cat, d]) => `${cat} (${d.count} products, e.g. ${d.examples.join(', ')})`).join(' | ')}`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 16000,
    messages: [
      {
        role: 'user',
        content: `Create a world-class enterprise data architecture SVG diagram for an executive presentation.

TITLE: "${context.mapTitle}"
${prompt ? `USER DIRECTION: ${prompt}` : ''}
${dataSummary}

STRICT VISUAL STANDARDS — follow every rule:

CANVAS & BACKGROUND:
- viewBox="0 0 1400 900" (16:9 slide ratio)
- Background: clean white (#FFFFFF)
- Add a subtle 1px border around the diagram area in #E2E8F0

LAYOUT PRINCIPLES:
- Use a structured but NOT rigid grid. Think architecture blueprints, not flowcharts.
- Place SOURCE SYSTEMS on the left third as clean rounded rectangles with a thin colored left border accent
- Place CAPABILITIES in the center as the main process blocks
- Place OUTPUT DATA DOMAINS on the right third
- Vertically space elements generously — no crowding. Minimum 30px between any two elements.
- ALL connection lines must route AROUND boxes, never through them. Use waypoints if needed.

NODE STYLING (every node must follow this exactly):
- Rounded rectangles only: rx="6" — no circles, no ellipses, no organic shapes
- Source Systems: fill="#F1F5F9" stroke="#CBD5E1" strokeWidth="1". Left accent bar: 3px wide colored rect inside the left edge.
  - System name: 12px bold #1E293B. Subtitle: 9px #64748B.
- Capabilities: fill="#EFF6FF" stroke="#2563EB" strokeWidth="1.5". Must be wider (200px+).
  - Capability name: 13px bold #1E293B. System name below: 9px #2563EB.
- Input Data Domains: fill="#FFFBEB" stroke="#F59E0B" strokeWidth="1". Small category cards.
  - Category name: 11px bold #92400E. Count: 9px #B45309.
- Output Data Domains: fill="#ECFDF5" stroke="#10B981" strokeWidth="1". Small category cards.
  - Category name: 11px bold #065F46. Count: 9px #047857.

CONNECTION LINES (critical — this is what makes it professional):
- Use ONLY orthogonal paths (horizontal and vertical segments with rounded corners) — like circuit board traces
- Stroke: #94A3B8 strokeWidth="1.2" fill="none"
- Add small arrowhead markers (6x4px, fill #94A3B8)
- Lines must have clean 90-degree bends with at least 8px radius corners
- NEVER overlap or cross through any box — route lines around obstacles
- Add small text labels on lines (8px #94A3B8 font-family="Arial") describing the data flow category
- Group parallel flows into single thicker lines where multiple products flow the same path

TYPOGRAPHY:
- font-family="Arial, Helvetica, sans-serif" on ALL text elements — no exceptions
- Title: 20px bold #0F172A at top center, y=40
- Section labels: 9px bold uppercase tracking="3" #94A3B8
- All text must be crisp, left-aligned within cards, vertically centered

ANTI-PATTERNS — do NOT do any of these:
- No circles or ellipses for nodes
- No gradient fills or heavy drop shadows
- No cartoon colors (bright purple, orange fills, etc.)
- No overlapping elements
- No curved/bezier connection lines — use only orthogonal routing
- No text outside of boxes except line labels and the title
- No decorative elements, icons, or illustrations

BRANDING:
- Bottom-right: "Mach12.ai" in 8px #94A3B8
- Bottom-left: date in 8px #CBD5E1

This should look like a diagram from a Gartner research report or a McKinsey technology architecture slide — clean, minimal, precise.

Return ONLY the raw <svg>...</svg> element. No markdown, no code fences, no explanation.`,
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''

  // Extract SVG from response (handle potential markdown wrapping)
  let svg = text.trim()
  // Remove markdown code fences if present
  svg = svg.replace(/```(?:svg|xml|html)?\n?/g, '').replace(/```\n?$/g, '').trim()

  // Validate it looks like SVG
  if (!svg.startsWith('<svg')) {
    // Try to find SVG within the response
    const match = svg.match(/<svg[\s\S]*<\/svg>/i)
    if (match) {
      svg = match[0]
    } else {
      return NextResponse.json({ error: 'AI did not return valid SVG', raw: text.substring(0, 500) }, { status: 500 })
    }
  }

  return new Response(svg, {
    headers: { 'Content-Type': 'image/svg+xml' },
  })
}

// ─── Bulk Load L2/L3 capabilities under an L1 Core Area ──

async function handleSIPOCBulkLoad(
  prompt: string,
  context: { coreAreaName: string; existingL2s?: string[]; existingL3s?: string[] },
  image?: string
) {
  const content: any[] = []

  if (image) {
    const match = image.match(/^data:(image\/\w+);base64,(.+)$/)
    if (match) {
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: match[1], data: match[2] },
      })
    }
  }

  const existingNote = context.existingL2s?.length
    ? `\n\nExisting L2 Capabilities already in this Core Area (DO NOT duplicate these):\n${context.existingL2s.map(n => `- ${n}`).join('\n')}${context.existingL3s?.length ? `\n\nExisting L3 Functionalities:\n${context.existingL3s.map(n => `- ${n}`).join('\n')}` : ''}`
    : ''

  const textPrompt = `You are an expert enterprise capability modeler for Aerospace & Defense organizations.

The user wants to populate an L1 Core Area called "${context.coreAreaName}" with L2 Capabilities and L3 Functionalities.

${image ? 'An image has been provided — analyze it to extract capabilities and functionalities. The image may be a screenshot of an existing capability model, org chart, process map, or similar document.' : ''}

${prompt ? `User instructions: ${prompt}` : 'Generate a comprehensive set of L2 Capabilities and L3 Functionalities for this core area.'}
${existingNote}

Return ONLY valid JSON matching this exact structure:
{
  "capabilities": [
    {
      "name": "L2 Capability Name",
      "description": "Brief description of this capability",
      "level": 2,
      "children": [
        {
          "name": "L3 Functionality Name",
          "description": "Brief description",
          "level": 3
        }
      ]
    }
  ]
}

Guidelines:
- L2 = Business Capability (e.g., "Budget Authorization", "Cost Estimation")
- L3 = Specific Functionality/Process within that capability (e.g., "Labor Rate Development", "Material Cost Forecasting")
- Be thorough: generate ALL relevant L2 capabilities and their L3 functionalities — do not artificially limit the count
- Names should be concise, professional, and specific to A&D/GovCon where applicable
- If an image is provided, extract capabilities and functionalities visible in it
- Do NOT duplicate any existing capabilities listed above

Return ONLY the JSON. No markdown, no explanation.`

  content.push({ type: 'text', text: textPrompt })

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [{ role: 'user', content }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''

  try {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const json = JSON.parse(cleaned)
    return NextResponse.json(json)
  } catch {
    return NextResponse.json({ error: 'Failed to parse AI response', raw: text }, { status: 500 })
  }
}

async function handleSIPOCL2Narrative(context: {
  name: string
  level?: number
  features?: string[]
  suppliers?: string[]
  inputs?: { name: string; dimensions?: string[]; tags?: string[] }[]
  outputs?: { name: string; dimensions?: string[]; tags?: string[] }[]
  customers?: string[]
  feedingSystems?: string[]
  sourceSystems?: string[]
  destinationSystems?: string[]
}) {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 600,
    system: 'You are an expert business and data architect. Generate concise, executive-ready capability descriptions for enterprise SIPOC models.',
    messages: [{
      role: 'user',
      content: `Write a 2–4 sentence description for the capability "${context.name}" (Level ${context.level ?? 2}) based on its rolled-up SIPOC detail below. The description should explain WHAT the capability does, WHO it serves, and the key data it consumes and produces. Avoid bullet points. Do not wrap in quotes. Return plain prose only — no preamble, no JSON.

Sub-capabilities (features): ${(context.features || []).join(', ') || '(none)'}
Suppliers: ${(context.suppliers || []).join(', ') || '(none)'}
Inputs: ${(context.inputs || []).map(i => `${i.name}${i.dimensions?.length ? ` [${i.dimensions.join(', ')}]` : ''}${i.tags?.length ? ` #${i.tags.join(' #')}` : ''}`).join('; ') || '(none)'}
Feeding systems: ${(context.feedingSystems || []).join(', ') || '(none)'}
Source systems: ${(context.sourceSystems || []).join(', ') || '(none)'}
Outputs: ${(context.outputs || []).map(o => `${o.name}${o.dimensions?.length ? ` [${o.dimensions.join(', ')}]` : ''}`).join('; ') || '(none)'}
Destination systems: ${(context.destinationSystems || []).join(', ') || '(none)'}
Customers: ${(context.customers || []).join(', ') || '(none)'}`,
    }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
  return NextResponse.json({ narrative: text })
}
