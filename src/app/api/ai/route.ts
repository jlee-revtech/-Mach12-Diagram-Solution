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
- Generate 4-8 inputs and 3-6 outputs for a typical L3 capability
- Mark all items with "status": "new"`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
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
