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
