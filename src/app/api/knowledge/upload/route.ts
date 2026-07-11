import { NextRequest, NextResponse } from 'next/server'
import { extractDocumentText, detectFormat, SUPPORTED_EXTENSIONS } from '@/lib/knowledge/extract'
import { analyzeDocument } from '@/lib/knowledge/analyze'

// Upload a document (PDF / DOCX / PPTX / XLSX / TXT / MD), extract its text,
// and run the AI analysis that distills it into a skill draft. Nothing is
// saved here: the draft (plus the extracted full text) goes back to the client
// for review, then the review UI saves via POST /api/knowledge/sources.
export const runtime = 'nodejs'
export const maxDuration = 300

const MAX_FILE_BYTES = 40 * 1024 * 1024

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided (multipart field "file").' }, { status: 400 })
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: 'File is too large (40 MB max).' }, { status: 400 })
    }
    if (!detectFormat(file.name)) {
      return NextResponse.json(
        { error: `Unsupported file type. Supported: ${SUPPORTED_EXTENSIONS.map((e) => '.' + e).join(' ')}` },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const extracted = await extractDocumentText(file.name, buffer)

    // Scanned PDF (no text layer): let Claude read the PDF itself.
    const usedVision = extracted.format === 'pdf' && !!extracted.needsVision
    const { draft, truncated } = await analyzeDocument({
      filename: file.name,
      text: extracted.text,
      pdfBase64: usedVision ? buffer.toString('base64') : undefined,
    })

    return NextResponse.json({
      draft,
      fullText: extracted.text,
      extraction: {
        filename: file.name,
        format: extracted.format,
        pages: extracted.pages ?? null,
        chars: extracted.text.length,
        truncated,
        usedVision,
      },
    })
  } catch (e) {
    console.error('knowledge upload failed', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'upload failed' }, { status: 500 })
  }
}
