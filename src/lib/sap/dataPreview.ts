// Parser for the ADT freestyle data-preview payload
// (/sap/bc/adt/datapreview/freestyle).
//
// The response is COLUMN-major: one <dataPreview:columns> block per field, each
// holding every row's value for that field in order. Rows are reassembled by
// index, so order inside a dataSet is load-bearing.
//
// Ported from the equivalent reader in SAP Solution Studio, including the two
// traps its comments call out - both are easy to reintroduce and both corrupt
// data silently rather than throwing.

import type { PreviewResult } from './types'

export function parseDataPreview(xml: string): PreviewResult {
  const fields: string[] = []
  const columnValues: string[][] = []

  const colRe = /<dataPreview:columns>([\s\S]*?)<\/dataPreview:columns>/g
  let m: RegExpExecArray | null
  while ((m = colRe.exec(xml))) {
    const block = m[1]
    const name = block.match(/dataPreview:name="([^"]+)"/)?.[1]
    if (!name) continue
    fields.push(name)

    // Scope to the dataSet, then walk each <dataPreview:data> IN ORDER.
    //   1. A naive /<dataPreview:data[^>]*>/ also matches the <dataPreview:dataSet>
    //      wrapper ("Set" is swallowed by [^>]*), leaking markup into the first
    //      cell of every column. The (?=[\s/>]) lookahead forbids that.
    //   2. Self-closing empties (<dataPreview:data/>) must be emitted as "" in
    //      position - counting them and appending at the end shifts every later
    //      row in that column.
    const dataSet = block.match(/<dataPreview:dataSet>([\s\S]*?)<\/dataPreview:dataSet>/)?.[1] ?? ''
    const vals: string[] = []
    const cellRe = /<dataPreview:data(?=[\s/>])[^>]*?(?:\/>|>([\s\S]*?)<\/dataPreview:data>)/g
    let d: RegExpExecArray | null
    while ((d = cellRe.exec(dataSet))) {
      vals.push(d[1] != null ? decodeXml(d[1]) : '')
    }
    columnValues.push(vals)
  }

  const rowCount = columnValues.reduce((max, c) => Math.max(max, c.length), 0)
  const rows: Array<Record<string, string>> = []
  for (let r = 0; r < rowCount; r++) {
    const row: Record<string, string> = {}
    fields.forEach((f, c) => {
      row[f] = columnValues[c]?.[r] ?? ''
    })
    rows.push(row)
  }

  const totalRows = Number(xml.match(/<dataPreview:totalRows>(\d+)<\/dataPreview:totalRows>/)?.[1] ?? rowCount)
  return { fields, rows, totalRows, truncated: totalRows > rowCount }
}

/** Pull the human-readable reason out of an ADT exception payload. */
export function parseAdtError(body: string): string | null {
  const msg = body.match(/<message[^>]*>([\s\S]*?)<\/message>/)?.[1]
  return msg ? decodeXml(msg) : null
}

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim()
}
