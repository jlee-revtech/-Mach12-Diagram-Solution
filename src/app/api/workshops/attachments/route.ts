import { NextRequest, NextResponse } from 'next/server'
import { extractDocumentText, detectFormat, SUPPORTED_EXTENSIONS } from '@/lib/knowledge/extract'
import { serverModelDb } from '@/lib/workshop/server'

// Workshop prep attachments (055). POST a file (multipart) with workshopId +
// orgId: the text is extracted server-side (same pipeline as /knowledge
// uploads) and stored on workshop_attachments, where the brief and every
// section generate read it as facilitator-provided context. List + delete run
// client-side under the user's RLS (src/lib/supabase/workshops.ts).
export const runtime = 'nodejs'
export const maxDuration = 120

const MAX_FILE_BYTES = 40 * 1024 * 1024
// Stored cap: keep the whole doc within reason; prep prompts re-cap on read.
const MAX_STORED_CHARS = 120_000

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = form.get('file')
    const workshopId = String(form.get('workshopId') || '')
    const orgId = String(form.get('orgId') || '')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided (multipart field "file").' }, { status: 400 })
    }
    if (!workshopId || !orgId) {
      return NextResponse.json({ error: 'workshopId and orgId are required.' }, { status: 400 })
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: 'File is too large (40 MB max).' }, { status: 400 })
    }
    if (!detectFormat(file.name)) {
      return NextResponse.json(
        { error: `Unsupported file type. Supported: ${SUPPORTED_EXTENSIONS.map((e) => '.' + e).join(' ')}` },
        { status: 400 },
      )
    }

    const db = serverModelDb()
    const { data: ws } = await db
      .from('workshops')
      .select('id')
      .eq('id', workshopId)
      .eq('organization_id', orgId)
      .maybeSingle()
    if (!ws) return NextResponse.json({ error: 'Workshop not found for this organization' }, { status: 404 })

    const buffer = Buffer.from(await file.arrayBuffer())
    let text = ''
    let format: string | null = null
    let pages: number | null = null
    let status: 'extracted' | 'no_text' | 'failed' = 'extracted'
    let note: string | null = null
    try {
      const extracted = await extractDocumentText(file.name, buffer)
      text = (extracted.text || '').trim()
      format = extracted.format
      pages = extracted.pages ?? null
      if (extracted.format === 'pdf' && extracted.needsVision) {
        status = 'no_text'
        note = 'Scanned PDF with no text layer; it cannot be read as prep context. Export a text PDF or paste the content into the guidance prompt.'
      } else if (!text) {
        status = 'no_text'
        note = 'No readable text was found in this file.'
      }
    } catch (e) {
      status = 'failed'
      note = e instanceof Error ? e.message : 'Text extraction failed.'
    }

    const chars = text.length
    if (text.length > MAX_STORED_CHARS) text = text.slice(0, MAX_STORED_CHARS) + '\n...(truncated)'

    const { data: row, error } = await db
      .from('workshop_attachments')
      .insert({
        workshop_id: workshopId,
        file_name: file.name,
        format,
        pages,
        size_bytes: file.size,
        extracted_text: status === 'extracted' ? text : null,
        chars,
        status,
        note,
      })
      .select('id, workshop_id, file_name, format, pages, size_bytes, chars, status, note, created_by, created_at')
      .maybeSingle()
    if (error) throw new Error(error.message)

    return NextResponse.json({ attachment: row })
  } catch (e) {
    console.error('workshop attachment upload failed', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'upload failed' }, { status: 500 })
  }
}
