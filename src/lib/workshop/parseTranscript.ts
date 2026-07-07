// Parse an uploaded transcript into speaker + content lines the workshop room can
// store as messages (as if they had been recorded live). Handles the common shapes:
//   - "Speaker: text" plain text or pasted chat logs (with speaker inheritance for
//     continuation lines).
//   - WebVTT (.vtt), including <v Speaker> voice tags.
//   - SubRip (.srt) with numeric cues + comma-millisecond timecodes.
// Unattributed lines fall back to a default speaker. Leading timestamps like
// "[00:12:34]" or "(1:02)" are stripped.

export interface ParsedLine {
  speaker: string
  content: string
}

const MAX_LINES = 3000
const TIMECODE = /-->/
const TS_PREFIX = /^[[(]?\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?[\])]?\s*[-–:]?\s*/

// Pull a leading "Name:" speaker off a line, if it looks like a speaker label
// (short, has text after the colon, and is not a URL scheme).
function splitSpeaker(line: string): { speaker?: string; content: string } {
  const m = line.match(/^([^:]{1,40}):\s+(.*\S.*)$/)
  if (m && !/^https?$/i.test(m[1].trim()) && !/\d{1,2}:\d{2}/.test(m[1])) {
    return { speaker: m[1].trim(), content: m[2].trim() }
  }
  return { content: line.trim() }
}

function stripTags(s: string): string {
  return s.replace(/<\/?[^>]+>/g, '').trim()
}

function isVtt(text: string): boolean {
  return /^﻿?WEBVTT/.test(text.trimStart())
}

function isSrt(lines: string[]): boolean {
  // A cue index line followed by a comma-millisecond timecode.
  for (let i = 0; i < lines.length - 1; i++) {
    if (/^\d+$/.test(lines[i].trim()) && /\d{2}:\d{2}:\d{2},\d{3}\s*-->/.test(lines[i + 1])) return true
  }
  return false
}

// Cue-based formats (VTT / SRT): split on blank lines, drop index + timecode lines,
// join the remaining utterance lines, and read a leading speaker.
function parseCues(text: string, defaultSpeaker: string): ParsedLine[] {
  const blocks = text.replace(/\r/g, '').split(/\n{2,}/)
  const out: ParsedLine[] = []
  let lastSpeaker = defaultSpeaker
  for (const block of blocks) {
    const raw = block.split('\n').map((l) => l.trim()).filter(Boolean)
    const lines = raw.filter(
      (l) => l !== 'WEBVTT' && !TIMECODE.test(l) && !/^\d+$/.test(l) && !/^NOTE\b/.test(l) && !l.startsWith('WEBVTT'),
    )
    if (!lines.length) continue
    // VTT voice tag on the first line: <v Speaker>text</v>
    let speaker: string | undefined
    const vtag = lines[0].match(/^<v\s+([^>]+)>\s*(.*)$/i)
    if (vtag) {
      speaker = vtag[1].trim()
      lines[0] = vtag[2]
    }
    const joined = stripTags(lines.map(stripTags).join(' ')).replace(/\s+/g, ' ').trim()
    if (!joined) continue
    if (!speaker) {
      const s = splitSpeaker(joined)
      speaker = s.speaker
      out.push({ speaker: speaker || lastSpeaker, content: s.content })
    } else {
      out.push({ speaker, content: joined })
    }
    if (speaker) lastSpeaker = speaker
    if (out.length >= MAX_LINES) break
  }
  return out
}

// Plain text / pasted chat: one utterance per non-empty line, inheriting the last
// speaker for continuation lines that carry no "Name:" prefix.
function parsePlain(text: string, defaultSpeaker: string): ParsedLine[] {
  const out: ParsedLine[] = []
  let lastSpeaker = defaultSpeaker
  for (const rawLine of text.replace(/\r/g, '').split('\n')) {
    let line = rawLine.trim()
    if (!line) continue
    line = line.replace(TS_PREFIX, '').trim()
    if (!line) continue
    const { speaker, content } = splitSpeaker(line)
    if (!content) continue
    if (speaker) lastSpeaker = speaker
    out.push({ speaker: speaker || lastSpeaker, content })
    if (out.length >= MAX_LINES) break
  }
  return out
}

export function parseTranscript(text: string, opts?: { defaultSpeaker?: string }): ParsedLine[] {
  const defaultSpeaker = (opts?.defaultSpeaker || 'Participant').trim() || 'Participant'
  if (!text || !text.trim()) return []
  const lines = text.replace(/\r/g, '').split('\n')
  if (isVtt(text) || isSrt(lines)) return parseCues(text, defaultSpeaker)
  return parsePlain(text, defaultSpeaker)
}
