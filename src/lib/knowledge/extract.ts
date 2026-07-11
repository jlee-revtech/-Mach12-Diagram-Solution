// Server-only document text extraction for knowledge uploads. Supports PDF
// (unpdf / pdf.js text layer), DOCX + PPTX (OOXML zips via jszip), XLSX
// (SheetJS), and plain text/markdown. Extraction is best-effort: a PDF with no
// text layer (scanned) returns needsVision so the analyzer can hand the raw
// PDF to Claude instead.

import JSZip from 'jszip'
import * as XLSX from 'xlsx'

export type DocFormat = 'pdf' | 'docx' | 'pptx' | 'xlsx' | 'text'

export interface ExtractedDoc {
  text: string
  format: DocFormat
  /** pdf pages / pptx slides / xlsx sheets, when known */
  pages?: number
  /** PDF had (almost) no text layer; analyzer should send the PDF itself */
  needsVision?: boolean
}

const EXT_FORMAT: Record<string, DocFormat> = {
  pdf: 'pdf',
  docx: 'docx',
  pptx: 'pptx',
  xlsx: 'xlsx',
  xls: 'xlsx',
  txt: 'text',
  md: 'text',
  markdown: 'text',
  csv: 'text',
}

export function detectFormat(filename: string): DocFormat | null {
  const ext = filename.toLowerCase().split('.').pop() || ''
  return EXT_FORMAT[ext] ?? null
}

export const SUPPORTED_EXTENSIONS = Object.keys(EXT_FORMAT)

export async function extractDocumentText(filename: string, buffer: Buffer): Promise<ExtractedDoc> {
  const format = detectFormat(filename)
  if (!format) throw new Error(`Unsupported file type: ${filename}. Supported: ${SUPPORTED_EXTENSIONS.join(', ')}`)
  switch (format) {
    case 'pdf': return extractPdf(buffer)
    case 'docx': return extractDocx(buffer)
    case 'pptx': return extractPptx(buffer)
    case 'xlsx': return extractXlsx(buffer)
    case 'text': return { text: buffer.toString('utf8'), format: 'text' }
  }
}

async function extractPdf(buffer: Buffer): Promise<ExtractedDoc> {
  const { getDocumentProxy, extractText } = await import('unpdf')
  const pdf = await getDocumentProxy(new Uint8Array(buffer))
  const { totalPages, text } = await extractText(pdf, { mergePages: true })
  const clean = (text || '').trim()
  // Scanned PDFs have no text layer; flag so the analyzer sends the PDF itself.
  return { text: clean, format: 'pdf', pages: totalPages, needsVision: clean.length < 200 }
}

async function extractDocx(buffer: Buffer): Promise<ExtractedDoc> {
  const zip = await JSZip.loadAsync(buffer)
  const doc = zip.file('word/document.xml')
  if (!doc) throw new Error('Not a valid .docx file (word/document.xml missing)')
  const xml = await doc.async('text')
  const paragraphs = xml
    .split(/<\/w:p>/)
    .map((p) => ooxmlRunsToText(p, /<w:t[^>]*>([\s\S]*?)<\/w:t>/g))
    .filter(Boolean)
  return { text: paragraphs.join('\n\n'), format: 'docx' }
}

async function extractPptx(buffer: Buffer): Promise<ExtractedDoc> {
  const zip = await JSZip.loadAsync(buffer)
  const slideFiles = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => slideNum(a) - slideNum(b))
  if (slideFiles.length === 0) throw new Error('Not a valid .pptx file (no slides found)')

  const parts: string[] = []
  for (const name of slideFiles) {
    const n = slideNum(name)
    const xml = await zip.files[name].async('text')
    const body = pptxXmlToText(xml)
    const notesFile = zip.file(`ppt/notesSlides/notesSlide${n}.xml`)
    let notes = ''
    if (notesFile) {
      const notesText = pptxXmlToText(await notesFile.async('text'))
      // Notes slides embed the slide number as a lone digit run; skip empties.
      if (notesText && notesText.replace(/\d+/g, '').trim()) notes = `\nNotes: ${notesText}`
    }
    if (body || notes) parts.push(`## Slide ${n}\n${body}${notes}`)
  }
  return { text: parts.join('\n\n'), format: 'pptx', pages: slideFiles.length }
}

function slideNum(path: string): number {
  const m = path.match(/(\d+)\.xml$/)
  return m ? parseInt(m[1], 10) : 0
}

function pptxXmlToText(xml: string): string {
  return xml
    .split(/<\/a:p>/)
    .map((p) => ooxmlRunsToText(p, /<a:t[^>]*>([\s\S]*?)<\/a:t>/g))
    .filter(Boolean)
    .join('\n')
}

// Collect the text runs of one OOXML paragraph fragment.
function ooxmlRunsToText(fragment: string, runPattern: RegExp): string {
  const runs: string[] = []
  let m: RegExpExecArray | null
  const re = new RegExp(runPattern.source, 'g')
  while ((m = re.exec(fragment)) !== null) runs.push(decodeXmlEntities(m[1]))
  return runs.join('').trim()
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, '&')
}

const MAX_CHARS_PER_SHEET = 100_000

function extractXlsx(buffer: Buffer): ExtractedDoc {
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const parts: string[] = []
  for (const name of wb.SheetNames) {
    let csv = XLSX.utils.sheet_to_csv(wb.Sheets[name])
    if (csv.length > MAX_CHARS_PER_SHEET) csv = csv.slice(0, MAX_CHARS_PER_SHEET) + '\n…(sheet truncated)'
    if (csv.trim()) parts.push(`## Sheet: ${name}\n${csv.trim()}`)
  }
  return { text: parts.join('\n\n'), format: 'xlsx', pages: wb.SheetNames.length }
}
