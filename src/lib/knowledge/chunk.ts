// Paragraph-aware chunker. Targets ~800 tokens (~3200 chars) per chunk with a
// small overlap so retrieval keeps cross-boundary context. Headings are kept
// with the paragraph that follows them.

const TARGET_CHARS = 3200
const OVERLAP_CHARS = 400

export interface Chunk {
  index: number
  content: string
  tokenCount: number
}

export function chunkText(text: string): Chunk[] {
  const clean = (text || '').replace(/\r\n/g, '\n').trim()
  if (!clean) return []

  const paragraphs = clean.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
  const chunks: string[] = []
  let buf = ''

  for (const para of paragraphs) {
    if (buf && (buf.length + para.length + 2) > TARGET_CHARS) {
      chunks.push(buf)
      const tail = buf.slice(Math.max(0, buf.length - OVERLAP_CHARS))
      buf = tail + '\n\n' + para
    } else {
      buf = buf ? `${buf}\n\n${para}` : para
    }
    // A single oversized paragraph: hard-split it.
    while (buf.length > TARGET_CHARS * 1.5) {
      chunks.push(buf.slice(0, TARGET_CHARS))
      buf = buf.slice(TARGET_CHARS - OVERLAP_CHARS)
    }
  }
  if (buf.trim()) chunks.push(buf)

  return chunks.map((content, index) => ({
    index,
    content,
    tokenCount: Math.ceil(content.length / 4),
  }))
}
