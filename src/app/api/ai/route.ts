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
    const { action, prompt, context, image, scope } = await req.json()

    if (action === 'generate') {
      return handleGenerate(prompt, image)
    } else if (action === 'suggest') {
      return handleSuggest(context)
    } else if (action === 'analyze') {
      return handleAnalyze(context)
    } else if (action === 'implement') {
      return handleImplement(context)
    } else if (action === 'sipoc-generate') {
      return handleSIPOCGenerate(prompt, context, scope)
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
    } else if (action === 'sipoc-analyze-l3') {
      return handleSIPOCAnalyzeL3(context)
    } else if (action === 'process-generate') {
      return handleProcessGenerate(prompt, context)
    } else if (action === 'bpmn-from-text') {
      return handleBpmnFromText(prompt, context)
    } else if (action === 'process-gap-assessment') {
      return handleProcessGapAssessment(context)
    } else if (action === 'process-exec-map') {
      return handleProcessExecMap(prompt, context)
    } else if (action === 'process-playbook') {
      return handleProcessPlaybook(context)
    } else if (action === 'bedrock-integrations') {
      return handleBedrockIntegrations(context)
    } else if (action === 'capability-map-draft') {
      return handleCapabilityMapDraft(prompt, context)
    } else if (action === 'capability-map-align') {
      return handleCapabilityMapAlign(context)
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
    model: 'claude-sonnet-4-6',
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
    model: 'claude-sonnet-4-6',
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
    model: 'claude-sonnet-4-6',
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
    model: 'claude-sonnet-4-6',
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

async function handleSIPOCUseCasesOnly(prompt: string, context?: {
  capabilityName?: string
  capabilityDescription?: string
  capabilityFeatures?: string[]
  capabilityUseCases?: string[]
}) {
  const existingUseCases = context?.capabilityUseCases || []
  const existingFeatures = context?.capabilityFeatures || []

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    system: SIPOC_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Generate use cases ONLY for this L3 capability. Do not return inputs, outputs, or features.

${context?.capabilityName ? `Capability: ${context.capabilityName}` : ''}
${context?.capabilityDescription ? `Description: ${context.capabilityDescription}` : ''}
${existingFeatures.length > 0 ? `\nFeatures on this L3 (use as context):\n${existingFeatures.map(f => `- ${f}`).join('\n')}` : ''}
${existingUseCases.length > 0 ? `\nExisting use cases (DO NOT re-suggest these):\n${existingUseCases.map(u => `- ${u}`).join('\n')}` : ''}

User request: ${prompt}

Return this exact JSON structure:
{
  "inputs": [],
  "outputs": [],
  "features": [],
  "use_cases": [
    "Concrete business scenario where this L3 is exercised end-to-end, phrased as a short user-story-style sentence"
  ]
}

Guidelines:
- USE CASES are concrete scenarios describing how a persona uses this L3 to accomplish a goal (e.g., "Rates Manager develops forward pricing rates for an upcoming IDIQ bid", "Finance locks annual provisional billing rates for DCAA submission").
- Generate 4-8 distinct, specific use cases.
- Each use case is a plain string — no objects, no nesting.
- Do NOT repeat any existing use cases listed above.
- If the existing set already looks complete, return an empty array rather than padding.

No markdown, no explanation, just the JSON object.`,
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  let json
  try {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    json = JSON.parse(cleaned)
    json.inputs = json.inputs || []
    json.outputs = json.outputs || []
    json.features = json.features || []
    json.use_cases = json.use_cases || []
  } catch {
    return NextResponse.json({ error: 'Failed to parse use cases generation', raw: text }, { status: 500 })
  }

  return NextResponse.json(json)
}

async function handleSIPOCGenerate(prompt: string, context?: {
  capabilityName?: string
  capabilityDescription?: string
  capabilityFeatures?: string[]
  capabilityUseCases?: string[]
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
}, scope?: 'full' | 'use-cases') {
  if (scope === 'use-cases') {
    return handleSIPOCUseCasesOnly(prompt, context)
  }
  const hasExistingData = (context?.currentInputs?.length || 0) > 0 || (context?.currentOutputs?.length || 0) > 0
  const existingFeatures = context?.capabilityFeatures || []
  const existingUseCases = context?.capabilityUseCases || []

  const entitiesBlock = context ? `
EXISTING ORG ENTITIES (reuse these names when applicable):
- Personas already defined: ${(context.existingPersonas || []).join(', ') || 'None'}
- Information Products already defined: ${(context.existingInformationProducts || []).join(', ') || 'None'}
- Logical Systems already defined: ${(context.existingLogicalSystems || []).join(', ') || 'None'}
${context.capabilityName ? `\nCapability being modeled: ${context.capabilityName}` : ''}
${context.capabilityDescription ? `Description: ${context.capabilityDescription}` : ''}
${existingFeatures.length > 0 ? `\nExisting features on this L3 (DO NOT re-suggest these):\n${existingFeatures.map(f => `- ${f}`).join('\n')}` : ''}
${existingUseCases.length > 0 ? `\nExisting use cases on this L3 (DO NOT re-suggest these):\n${existingUseCases.map(u => `- ${u}`).join('\n')}` : ''}` : ''

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
    model: 'claude-sonnet-4-6',
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
  ],
  "features": [
    "Short noun-phrase describing a sub-capability or distinct function this L3 performs"
  ],
  "use_cases": [
    "Concrete business scenario where this L3 is exercised end-to-end, phrased as a short user-story-style sentence"
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

Features vs Use Cases:
- FEATURES are the distinct sub-capabilities or functions the L3 performs (e.g., "Labor rate escalation modeling", "Fringe pool allocation", "Bid & proposal rate development"). 4-8 features typically.
- USE CASES are concrete scenarios describing how a persona uses this L3 to accomplish a goal (e.g., "Rates Manager develops forward pricing rates for an upcoming IDIQ bid", "Finance locks annual provisional billing rates for DCAA submission"). 3-6 use cases typically.
- Both are plain strings — no objects, no nesting.
- Do NOT repeat any of the existing features or use cases listed in the context. Only return NEW additions.
- If the existing set already looks complete for this L3, return an empty array for that field rather than padding.

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
    model: 'claude-sonnet-4-6',
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
    model: 'claude-sonnet-4-6',
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
    model: 'claude-sonnet-4-6',
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
    model: 'claude-sonnet-4-6',
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
    model: 'claude-sonnet-4-6',
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

async function handleSIPOCAnalyzeL3(context: {
  capabilityName: string
  level: number
  system?: string
  features?: string[]
  tags?: string[]
  inputs: {
    informationProduct: string
    category?: string
    supplierPersonas: string[]
    sourceSystems: string[]
    feedingSystem?: string
    dimensions: string[]
    tags?: string[]
  }[]
  outputs: {
    informationProduct: string
    category?: string
    consumerPersonas: string[]
    destinationSystems?: string[]
    dimensions: string[]
  }[]
}) {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 3000,
    system: 'You are an expert SAP data architect and business process analyst specializing in Aerospace, Defense, and Government Contracting. You provide clear, executive-ready analysis of SIPOC capability definitions.',
    messages: [{
      role: 'user',
      content: `Analyze this single L${context.level} SIPOC capability for an executive audience. Return ONLY valid JSON.

CAPABILITY: "${context.capabilityName}"
${context.system ? `SYSTEM: ${context.system}` : ''}
${(context.features || []).length > 0 ? `FEATURES: ${context.features!.join(', ')}` : ''}

INPUTS:
${context.inputs.map(i => `- ${i.informationProduct}${i.category ? ` (${i.category})` : ''}
  Suppliers: ${i.supplierPersonas.join(', ') || 'None'}
  Source Systems: ${i.sourceSystems.join(', ') || 'None'}${i.feedingSystem ? `\n  Feeding System: ${i.feedingSystem}` : ''}
  Dimensions: ${i.dimensions.join(', ') || 'None'}${(i.tags || []).length > 0 ? `\n  Tags: ${i.tags!.join(', ')}` : ''}`).join('\n')}

OUTPUTS:
${context.outputs.map(o => `- ${o.informationProduct}${o.category ? ` (${o.category})` : ''}
  Customers: ${o.consumerPersonas.join(', ') || 'None'}${(o.destinationSystems || []).length > 0 ? `\n  Destination Systems: ${o.destinationSystems!.join(', ')}` : ''}
  Dimensions: ${o.dimensions.join(', ') || 'None'}`).join('\n')}

Return this exact JSON structure:
{
  "executiveSummary": "2-4 sentence executive-ready description of what this capability does, who it serves, what data it consumes and produces, and why it matters to the organization. Write for a VP or C-level who needs to understand this capability in 30 seconds.",
  "completenessScore": 75,
  "strengths": [
    "Specific strength of this SIPOC definition"
  ],
  "gaps": [
    {
      "area": "Missing supplier|Missing input|Missing output|Missing customer|Missing dimension|Missing system|Incomplete coverage",
      "title": "Short gap title",
      "description": "What's missing and why it matters",
      "priority": "high|medium|low",
      "recommendation": "Specific action to address this gap"
    }
  ],
  "recommendations": [
    "Specific, actionable recommendation to improve this SIPOC"
  ]
}

Guidelines:
- The executive summary should be the MOST important output. Write it so someone unfamiliar with SIPOC can understand the capability.
- Score 0-100 based on completeness: are all suppliers identified? Are dimensions detailed enough? Are systems mapped?
- Identify 2-3 strengths
- Identify 2-5 gaps with specific recommendations
- Provide 2-4 overall recommendations
- Reference actual information products, personas, and systems from the data
- Consider A&D industry best practices (CAS compliance, DCAA audit readiness, EVMS, etc.)

No markdown, no explanation, just the JSON object.`,
    }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  try {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const json = JSON.parse(cleaned)
    return NextResponse.json(json)
  } catch {
    return NextResponse.json({ error: 'Failed to parse L3 analysis', raw: text }, { status: 500 })
  }
}

// ─── Process Studio AI ──────────────────────────────────

const PROCESS_SYSTEM_PROMPT = `You are an expert Business Process Architect specializing in Aerospace & Defense and Government Contracting, with deep SAP best-practice (Signavio / Solution Manager BPML) knowledge.

You understand:
- A&D end-to-end scenarios: Bid-to-Win, Contract-to-Closeout, Plan-to-Produce, Source-to-Pay, Design-to-Release, Acquire-to-Retire, Sustainment/MRO, Record-to-Report, Hire-to-Retire
- Value-chain decomposition: Scenario (L1) → Process Group (L2) → Process (L3, the BPMN leaf)
- BPMN 2.0: tasks (user/service/manual), gateways (exclusive/parallel/inclusive), start/end/intermediate events, swimlanes (one per system or role), sequence flows
- A&D compliance overlays: CAS, DCAA, EVMS (EIA-748), FAR/DFARS, CMMC, ITAR, AS9102
- Enterprise systems: SAP S/4HANA, Costpoint/Deltek, Teamcenter, Windchill, Primavera P6, WAWF`

// Generate a process hierarchy (Scenario→Group→Process) from a prompt.
async function handleProcessGenerate(prompt: string, context?: {
  targetName?: string
  targetLevel?: number    // 1 = scenario, 2 = group, 3 = process; children generated one level below
  existing?: string[]
}) {
  const target = context?.targetName
  const targetLevel = context?.targetLevel ?? 0
  const childLevelLabel = targetLevel === 1 ? 'Process Groups (L2) each with Processes (L3)'
    : targetLevel === 2 ? 'Processes (L3, the BPMN leaves)'
    : 'Scenarios (L1) each with Process Groups (L2) and Processes (L3)'

  const existingNote = context?.existing?.length
    ? `\n\nAlready present (DO NOT duplicate):\n${context.existing.map(n => `- ${n}`).join('\n')}`
    : ''

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: PROCESS_SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Generate a process hierarchy ${target ? `under "${target}"` : 'as a set of end-to-end scenarios'}.
Produce ${childLevelLabel}.

User request: ${prompt}${existingNote}

Return ONLY valid JSON in this exact shape (nest children to represent the levels below the target):
{
  "children": [
    {
      "name": "Name",
      "description": "One-line description",
      "children": [
        { "name": "Name", "description": "…", "children": [ { "name": "Name", "description": "…" } ] }
      ]
    }
  ]
}

Guidelines:
- Be thorough and realistic for A&D / GovCon. Use concise, professional process names.
- Leaf processes (the deepest level) should be concrete, single-flow processes suitable for a BPMN swimlane diagram (e.g. "Process Contract Modification", "Run Incurred Cost Submission").
- Do NOT duplicate anything listed as already present.
- No markdown, just the JSON object.`,
    }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  try {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    return NextResponse.json(JSON.parse(cleaned))
  } catch {
    return NextResponse.json({ error: 'Failed to parse process generation', raw: text }, { status: 500 })
  }
}

// Draft a BPMN swimlane graph (lanes/nodes/edges with positions) from text.
async function handleBpmnFromText(prompt: string, context?: { processName?: string; systems?: string[] }) {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 6000,
    system: PROCESS_SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Draft a BPMN 2.0 swimlane process flow for "${context?.processName || 'this process'}".
${context?.systems?.length ? `Prefer these systems/roles as swimlanes when relevant: ${context.systems.join(', ')}.` : ''}

User description: ${prompt}

Return ONLY valid JSON matching this exact schema:
{
  "lanes": [ { "id": "lane1", "label": "Role or System", "order": 0 } ],
  "nodes": [
    { "id": "n1", "elementType": "startEvent|endEvent|intermediateEvent|task|userTask|serviceTask|manualTask|subProcess|exclusiveGateway|parallelGateway|inclusiveGateway", "label": "Step name", "laneId": "lane1", "x": 120, "y": 60 }
  ],
  "edges": [ { "id": "e1", "source": "n1", "target": "n2", "kind": "sequence|conditional|default", "label": "" } ]
}

Layout rules (CRITICAL — produce clean coordinates):
- One lane per role/system. Lanes stack vertically; lane with order=k occupies the horizontal band y ∈ [k*150, k*150+150).
- Position each node's y near the vertical center of its lane band: y ≈ order*150 + 50.
- Lay the flow left-to-right: increase x by ~190 for each sequential step (start at x≈90).
- When a step happens in a different role, put it in that lane (its y changes accordingly) and continue x to the right.
- Every flow starts with exactly one startEvent and ends with at least one endEvent.
- Use gateways for branches; label conditional edges (e.g. "Approved", "Rejected").
- 8–20 nodes is typical. Give every node a unique id and a laneId that exists in "lanes".

No markdown, just the JSON object.`,
    }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  try {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    return NextResponse.json(JSON.parse(cleaned))
  } catch {
    return NextResponse.json({ error: 'Failed to parse BPMN draft', raw: text }, { status: 500 })
  }
}

// As-is vs best-practice fit/gap assessment.
async function handleProcessGapAssessment(context: {
  modelTitle: string
  asIs: { name: string; level: number; parent?: string }[]
  reference?: { name: string; level: number; parent?: string }[]
  referenceName?: string
}) {
  const refBlock = context.reference?.length
    ? `BEST-PRACTICE REFERENCE ("${context.referenceName || 'reference'}"):\n${context.reference.map(n => `${'  '.repeat(n.level - 1)}- ${n.name}`).join('\n')}`
    : 'No explicit reference subtree provided — assess against SAP best-practice + A&D/GovCon norms for this scenario.'

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: PROCESS_SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Compare this client's AS-IS process model against best practice and return a fit/gap assessment. Return ONLY valid JSON.

MODEL: "${context.modelTitle}"

AS-IS HIERARCHY:
${context.asIs.map(n => `${'  '.repeat(Math.max(0, n.level - 1))}- ${n.name}`).join('\n')}

${refBlock}

Return this exact JSON:
{
  "overallScore": 0-100,
  "summary": "2-3 sentence executive summary of fit vs best practice.",
  "fitGaps": [
    { "type": "missing_process|missing_group|extra_process|sequence_gap|granularity", "title": "…", "description": "What's missing or misaligned and why it matters", "severity": "high|medium|low" }
  ],
  "complianceGaps": [
    { "framework": "CAS|DCAA|EVMS|FAR|DFARS|CMMC|ITAR|Other", "title": "…", "description": "Control or compliance step that should exist" }
  ],
  "recommendations": [ "Specific, actionable recommendation" ]
}

Guidelines:
- Score 0-100 on coverage + compliance vs best practice.
- Identify concrete missing processes/groups by name; flag extra/non-standard items.
- Surface A&D compliance steps that are absent (e.g. DCAA timekeeping, EVMS variance analysis, FAR property accountability).
- 3-8 fit gaps, 2-6 compliance gaps, 3-6 recommendations. Reference actual node names.
- No markdown, just the JSON object.`,
    }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  try {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    return NextResponse.json(JSON.parse(cleaned))
  } catch {
    return NextResponse.json({ error: 'Failed to parse gap assessment', raw: text }, { status: 500 })
  }
}

// Executive process map — a clean leveled value-chain SVG for slides.
async function handleProcessExecMap(prompt: string, context: {
  modelTitle: string
  scenarios: { name: string; groups: { name: string; processes: string[] }[] }[]
}) {
  const summary = context.scenarios.map(s =>
    `SCENARIO: ${s.name}\n` + s.groups.map(g => `  GROUP: ${g.name} — ${g.processes.join(', ')}`).join('\n')
  ).join('\n')

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 16000,
    messages: [{
      role: 'user',
      content: `Create a world-class executive PROCESS MAP as an SVG for a board/executive presentation.

TITLE: "${context.modelTitle}"
${prompt ? `USER DIRECTION: ${prompt}` : ''}

PROCESS LANDSCAPE (value chain):
${summary}

STRICT VISUAL STANDARDS — follow every rule:

CANVAS & BACKGROUND:
- viewBox="0 0 1400 900" (16:9 slide ratio)
- Background: clean white (#FFFFFF); subtle 1px #E2E8F0 border around the diagram area.

LAYOUT — a horizontal value chain:
- Render each L1 SCENARIO as a large chevron/arrow block flowing left-to-right across the top band (like a Porter value chain or SAP end-to-end ribbon). Equal width, joined as a process ribbon.
- Under each scenario, stack its PROCESS GROUPS as clean rounded rectangles.
- Inside/under each group, list its processes as small text rows or mini-cards.
- Generous spacing; no overlaps; minimum 24px between elements.

NODE STYLING:
- Scenario chevrons: fill="#0EA5E9" with white 14px bold text, or alternating #0EA5E9 / #0C7FB3 for rhythm.
- Process groups: fill="#EFF6FF" stroke="#2563EB" strokeWidth="1.2" rx="6"; group name 12px bold #1E293B.
- Processes: 10px #475569 text rows, left-aligned, with a small bullet.
- Section labels: 9px bold uppercase tracking="2" #94A3B8.

TYPOGRAPHY: font-family="Arial, Helvetica, sans-serif" on ALL text. Title 22px bold #0F172A at top center y=44.

ANTI-PATTERNS — do NOT: use cartoon colors, gradients, heavy shadows, circles/ellipses for blocks, overlapping elements, curved decorative art, or any text outside boxes except labels/title.

BRANDING: bottom-right "Mach12.ai" 8px #94A3B8.

This should look like a McKinsey/Gartner process architecture slide — clean, minimal, precise, A&D-appropriate.

Return ONLY the raw <svg>...</svg> element. No markdown, no code fences, no explanation.`,
    }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  let svg = text.trim().replace(/```(?:svg|xml|html)?\n?/g, '').replace(/```\n?$/g, '').trim()
  if (!svg.startsWith('<svg')) {
    const m = svg.match(/<svg[\s\S]*<\/svg>/i)
    if (m) svg = m[0]
    else return NextResponse.json({ error: 'AI did not return valid SVG', raw: text.substring(0, 500) }, { status: 500 })
  }
  return new Response(svg, { headers: { 'Content-Type': 'image/svg+xml' } })
}

// Per-process playbook: narrative, RACI, controls, systems, KPIs, compliance.
async function handleProcessPlaybook(context: {
  processName: string
  modelTitle?: string
  description?: string
  scopeItemRef?: string
  lifecycle?: string | null
  variant?: string | null
  lanes: { label: string; system?: string | null }[]
  steps: {
    label: string; elementType: string; lane?: string | null
    responsibleRole?: string | null; raci?: unknown; systems?: string[]
    module?: string | null; fioriApp?: string | null; tcode?: string | null; ricefwCodes?: string[]
  }[]
  interfaces?: { source?: string | null; target?: string | null; direction?: string | null; frequency?: string | null; tech?: string | null; ref?: string | null }[]
  ricefw?: { code: string; type: string; title: string; status: string }[]
  overlays: { kind: string; title: string; framework?: string; code?: string; kpiTarget?: string }[]
  sipoc?: { suppliers: string[]; inputs: string[]; outputs: string[]; customers: string[] } | null
}) {
  const stepLines = context.steps.map(s => {
    const bits = [
      `${s.label} (${s.elementType}${s.lane ? ` @ ${s.lane}` : ''})`,
      s.responsibleRole ? `R:${s.responsibleRole}` : '',
      s.systems?.length ? `sys:${s.systems.join('/')}` : '',
      s.module ? `module:${s.module}` : '',
      s.tcode ? `tcode:${s.tcode}` : '',
      s.fioriApp ? `fiori:${s.fioriApp}` : '',
      s.ricefwCodes?.length ? `RICEFW:${s.ricefwCodes.join(',')}` : '',
    ].filter(Boolean)
    return bits.join(' | ')
  }).join('\n')
  const ifaceLines = (context.interfaces || []).map(i => `${i.source || '?'} ${i.direction === 'inbound' ? '<-' : i.direction === 'bidirectional' ? '<->' : '->'} ${i.target || '?'} (${[i.tech, i.frequency, i.ref].filter(Boolean).join(', ')})`).join('; ')
  const ricefwLines = (context.ricefw || []).map(r => `${r.code} [${r.type}] ${r.title} (${r.status})`).join('; ')
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: PROCESS_SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Write an executive process playbook for the process below. Return ONLY valid JSON.

PROCESS: "${context.processName}"${context.modelTitle ? ` (model: ${context.modelTitle})` : ''}${context.lifecycle ? ` [${context.lifecycle}]` : ''}${context.variant ? ` variant: ${context.variant}` : ''}
${context.description ? `Description: ${context.description}` : ''}
${context.scopeItemRef ? `SAP scope item: ${context.scopeItemRef}` : ''}
Swimlanes (roles/systems): ${context.lanes.map(l => `${l.label}${l.system ? ` [${l.system}]` : ''}`).join('; ') || 'none defined'}
Steps (with metadata where known):
${stepLines || 'none defined'}
Interfaces: ${ifaceLines || 'none documented'}
RICEFW build objects: ${ricefwLines || 'none registered'}
Existing overlays: ${context.overlays.map(o => `${o.framework || o.kind}:${o.code || o.title}`).join(', ') || 'none'}
${context.sipoc ? `SIPOC — Suppliers: ${context.sipoc.suppliers.join(', ')}; Inputs: ${context.sipoc.inputs.join(', ')}; Outputs: ${context.sipoc.outputs.join(', ')}; Customers: ${context.sipoc.customers.join(', ')}` : ''}

Use the provided per-step roles, systems, T-codes, and RICEFW where given; only infer what is missing.

Return this exact JSON:
{
  "narrative": "2-4 paragraph executive description of the process, its purpose, and value.",
  "steps": [ { "step": "Step name", "role": "Responsible role/lane", "system": "System or null", "description": "What happens" } ],
  "raci": [ { "activity": "Activity", "responsible": "R", "accountable": "A", "consulted": "C", "informed": "I" } ],
  "controls": [ { "framework": "CAS|DCAA|EVMS|FAR|DFARS|CMMC|ITAR|Other", "control": "Control name", "requirement": "What must be true" } ],
  "systems": [ { "system": "System", "role": "How it's used" } ],
  "kpis": [ { "kpi": "Metric", "target": "Target", "rationale": "Why it matters" } ],
  "complianceNotes": [ "A&D compliance note" ]
}

Guidelines:
- Be specific and A&D/GovCon-grade. Infer sensible RACI, controls, and KPIs even where not given, but stay consistent with the steps and overlays provided.
- 4-12 steps, 3-8 RACI rows, 2-6 controls, 2-6 systems, 2-5 KPIs.
- No markdown, just the JSON object.`,
    }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  try {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    return NextResponse.json(JSON.parse(cleaned))
  } catch {
    return NextResponse.json({ error: 'Failed to parse playbook', raw: text }, { status: 500 })
  }
}

// ─── Bedrock Data Integrations ─────────────────────────
const BEDROCK_SYSTEM_PROMPT = `You are an expert enterprise data-integration architect specializing in Aerospace & Defense and Government Contracting on SAP-centric landscapes. You map the INFORMATION PASSED BETWEEN SYSTEMS for each business process.

You understand:
- The BPML hierarchy: Scenario (L1) → Process Group (L2) → Process (L3).
- Enterprise system categories and their physical platforms (ERP=SAP S/4HANA, PLM=Teamcenter/Windchill, IMS=Primavera P6, HCM=SuccessFactors/Costpoint, MES=SAP DM/Opcenter, etc.).
- Real A&D integration patterns: IDoc, OData, CDS view, ALE/RFC/BAPI, SOAP, REST API, CPI iFlow, Event Mesh, file/SFTP, DB link.
- A&D data objects: Material Master, BOM, Routing, Purchase Order, Sales Order/Contract (CLIN/SLIN), Production Order, Cost Estimate, Forward Rates, Timesheet/CATS, Journal Entry, CDRL, DD250/Delivery, Earned Value (BCWS/BCWP/ACWP), Project/WBS, Funding/ACRN.

For each L3 process you identify the specific inter-system integrations: which bedrock system SENDS which data object to which bedrock system, in which direction, at what frequency, via what integration pattern, and what triggers it. Stay at a LOW level of detail — name concrete data objects, not vague categories.

You MUST ground every system reference in the provided bedrock catalog: use ONLY the systemType slugs given in the catalog as source/target. Never invent a system category that is not in the catalog.`

// Deterministically map one L1 scenario's processes to inter-system data
// integrations grounded in the org's bedrock catalog. temperature 0 + caller's
// stable input ordering make re-runs reproducible.
async function handleBedrockIntegrations(context?: {
  modelTitle?: string
  scenario?: {
    name: string
    description?: string
    workstream?: string | null
    groups: { name: string; description?: string; processes: { name: string; description?: string; scopeItemRef?: string | null; boundSystems?: { systemType: string; name: string }[] }[] }[]
  }
  catalog?: { systemType: string; label: string; primaryPhysical?: string; physicals: string[] }[]
}) {
  const scenario = context?.scenario
  const catalog = context?.catalog || []
  if (!scenario || catalog.length === 0) {
    return NextResponse.json({ error: 'Missing scenario or bedrock catalog' }, { status: 400 })
  }

  const catalogLines = catalog
    .map(c => `- ${c.systemType} = ${c.label}${c.primaryPhysical ? ` (primary: ${c.primaryPhysical})` : ''}${c.physicals.length ? `; also: ${c.physicals.join(', ')}` : ''}`)
    .join('\n')

  const hierarchyLines = scenario.groups
    .map(g => {
      const procs = g.processes
        .map(p => `- ${p.name}${p.scopeItemRef ? ` <${p.scopeItemRef}>` : ''}${p.boundSystems?.length ? ` [systems: ${p.boundSystems.map(s => s.systemType).join(', ')}]` : ''}${p.description ? ` — ${p.description}` : ''}`)
        .join('\n')
      return `## ${g.name}${g.description ? ` — ${g.description}` : ''}\n${procs}`
    })
    .join('\n\n')

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    temperature: 0,
    system: BEDROCK_SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Map the inter-system data integrations for this L1 scenario, process by process. Return ONLY valid JSON.

MODEL: "${context?.modelTitle || ''}"
SCENARIO (L1): "${scenario.name}"${scenario.workstream ? ` [workstream: ${scenario.workstream}]` : ''}
${scenario.description || ''}

BEDROCK SYSTEM CATALOG (use ONLY these systemType slugs as source/target):
${catalogLines}

PROCESS HIERARCHY (L2 groups → L3 processes; bound systems are hints from the BPMN swimlanes):
${hierarchyLines}

Return this exact JSON structure:
{
  "scenario": "${scenario.name}",
  "integrations": [
    {
      "l2": "Process Group name (exact, from the hierarchy above)",
      "l3": "Process name (exact, from the hierarchy above)",
      "sourceSystemType": "one of the catalog systemType slugs",
      "targetSystemType": "one of the catalog systemType slugs",
      "direction": "forward|bidirectional",
      "dataObjects": [
        { "name": "Specific data object (e.g. 'Purchase Order IDoc')", "elementType": "transaction|master_data|document|event|data_object", "description": "what it carries" }
      ],
      "frequency": "Real-time|On demand|Hourly|Daily|Weekly|Monthly|Batch",
      "integrationPattern": "IDoc|OData|CDS view|RFC/BAPI|SOAP|REST API|CPI iFlow|Event Mesh|File/SFTP|DB link",
      "trigger": "What initiates this flow (e.g. 'PO release')"
    }
  ]
}

Guidelines:
- One integration object per distinct (l3, source, target, primary data direction). Group multiple data objects flowing the same direction between the same two systems into one integration's dataObjects array.
- Be concrete and A&D/GovCon-grade. Prefer real SAP object names where source/target is an SAP system.
- sourceSystemType and targetSystemType MUST be slugs present in the catalog. Skip flows you cannot ground in the catalog. Do not emit self-loops (source equals target).
- Order integrations by L2 then L3 as listed above. Within a process, order by source then target systemType alphabetically.
- No markdown, no explanation, just the JSON object.`,
    }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  try {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    return NextResponse.json(JSON.parse(cleaned))
  } catch {
    return NextResponse.json({ error: 'Failed to parse bedrock integrations', raw: text }, { status: 500 })
  }
}

// ─── Capability Map draft ──────────────────────────────
const CAPABILITY_MAP_SYSTEM_PROMPT = `You are an expert enterprise & business architect specializing in Aerospace & Defense and Government Contracting. You build business/application capability maps, align each capability to an end-to-end value stream, and map it to the enterprise systems that realize it.

You understand:
- Business capability modeling: concise capability names (noun phrases like "Demand Planning", "Contract Cost Management", "Earned Value Management", "Talent Acquisition").
- A&D/GovCon end-to-end value streams (workstreams): Bid-to-Win, Contract-to-Closeout, Plan-to-Produce, Source-to-Pay, Design-to-Release, Acquire-to-Retire, Sustainment/MRO, Plan-to-Perform (Program & Portfolio), Record-to-Report, Hire-to-Retire. Every capability belongs to exactly one value stream.
- A&D/GovCon enterprise systems and which capabilities they realize (ERP=SAP S/4HANA, PLM=Teamcenter/Windchill, IMS=Primavera P6, HCM=SuccessFactors/Workday/Costpoint, CLM=Dassian/Icertis, MES=SAP DM/Opcenter, FP&A=SAC/Anaplan, etc.).

You assign each capability to one value stream (by code) and map it to the LOGICAL bedrock system categories that typically realize it, using ONLY the systemType slugs and value-stream codes provided.`

async function handleCapabilityMapDraft(prompt: string, context?: {
  catalog?: { systemType: string; label: string; physicals?: string[] }[]
  existing?: string[]
  workstreams?: { code: string; name: string; description?: string }[]
  focusWorkstream?: string
}) {
  const catalog = context?.catalog || []
  if (catalog.length === 0) {
    return NextResponse.json({ error: 'Missing bedrock catalog' }, { status: 400 })
  }
  const workstreams = context?.workstreams || []
  const catalogLines = catalog
    .map(c => `- ${c.systemType} = ${c.label}${c.physicals?.length ? ` (${c.physicals.join(', ')})` : ''}`)
    .join('\n')
  const wsLines = workstreams.length
    ? workstreams.map(w => `- ${w.code} = ${w.name}${w.description ? ` — ${w.description}` : ''}`).join('\n')
    : '(no value streams defined)'
  const existingNote = context?.existing?.length
    ? `\n\nAlready present (DO NOT duplicate these):\n${context.existing.map(n => `- ${n}`).join('\n')}`
    : ''
  const focusNote = context?.focusWorkstream
    ? `\nFocus ONLY on capabilities for the "${context.focusWorkstream}" value stream.`
    : ''

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    system: CAPABILITY_MAP_SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Draft a business/application capability map for this organization. Align each capability to one value stream and map it to the logical bedrock systems that realize it.

${prompt ? `Organization context / request: ${prompt}` : 'Assume a typical Aerospace & Defense / Government Contracting manufacturer.'}${focusNote}

VALUE STREAMS (assign each capability to exactly one, by code):
${wsLines}

BEDROCK SYSTEM CATALOG (use ONLY these systemType slugs):
${catalogLines}${existingNote}

Return ONLY valid JSON in this exact shape:
{
  "capabilities": [
    {
      "name": "Capability name (concise noun phrase)",
      "workstream": "value stream code from the list above",
      "domain": "Optional finer grouping (e.g. Finance, Supply Chain, Engineering)",
      "description": "One-line description of the capability",
      "systems": ["systemType slugs from the catalog that realize this capability"]
    }
  ]
}

Guidelines:
- Produce a thorough capability map${context?.focusWorkstream ? ' for the focused value stream (roughly 6-15 capabilities)' : ': roughly 25-45 capabilities spanning all the value streams'}.
- "workstream" MUST be one of the value-stream codes listed above. Every capability gets exactly one.
- Each capability maps to 1-3 logical systemType slugs. Use ONLY slugs present in the catalog.
- Be A&D/GovCon-grade and concrete. Order by value stream.
- Do NOT duplicate anything listed as already present.
- No markdown, just the JSON object.`,
    }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  try {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    return NextResponse.json(JSON.parse(cleaned))
  } catch {
    return NextResponse.json({ error: 'Failed to parse capability map draft', raw: text }, { status: 500 })
  }
}

// Align existing capabilities to value streams (workstreams). Returns the
// best-fit value-stream code for each capability name.
async function handleCapabilityMapAlign(context?: {
  capabilities?: { name: string; domain?: string | null; description?: string | null }[]
  workstreams?: { code: string; name: string; description?: string }[]
}) {
  const caps = context?.capabilities || []
  const workstreams = context?.workstreams || []
  if (caps.length === 0 || workstreams.length === 0) {
    return NextResponse.json({ error: 'Missing capabilities or value streams' }, { status: 400 })
  }
  const wsLines = workstreams.map(w => `- ${w.code} = ${w.name}${w.description ? ` — ${w.description}` : ''}`).join('\n')
  const capLines = caps.map(c => `- ${c.name}${c.domain ? ` [${c.domain}]` : ''}${c.description ? ` — ${c.description}` : ''}`).join('\n')

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    temperature: 0,
    system: CAPABILITY_MAP_SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Assign each capability below to the single best-fit value stream.

VALUE STREAMS (use these codes):
${wsLines}

CAPABILITIES:
${capLines}

Return ONLY valid JSON in this exact shape:
{
  "assignments": [
    { "name": "exact capability name", "workstream": "value stream code" }
  ]
}

Guidelines:
- Echo each capability name EXACTLY as given. Assign exactly one value-stream code from the list to each.
- No markdown, just the JSON object.`,
    }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  try {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    return NextResponse.json(JSON.parse(cleaned))
  } catch {
    return NextResponse.json({ error: 'Failed to parse capability alignment', raw: text }, { status: 500 })
  }
}
