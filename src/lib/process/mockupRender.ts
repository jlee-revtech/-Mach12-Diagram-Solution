import * as htmlToImage from 'html-to-image'

// Render an AI-generated, self-contained HTML fragment (a Fiori screen mockup)
// to a PNG data URL, entirely client-side. The fragment uses only inline styles
// and system fonts, so html-to-image can rasterize it without any external
// resource fetches (skipFonts avoids web-font CORS stalls). This keeps the
// whole screenshot path on the existing Vercel deploy — no headless browser.
export async function renderHtmlToPng(html: string, width: number, height: number): Promise<string> {
  const host = document.createElement('div')
  Object.assign(host.style, {
    position: 'fixed', top: '0', left: '-100000px',
    width: `${width}px`, height: `${height}px`,
    overflow: 'hidden', background: '#ffffff', zIndex: '-1',
  } as Partial<CSSStyleDeclaration>)
  host.innerHTML = html
  document.body.appendChild(host)
  try {
    const target = (host.firstElementChild as HTMLElement) || host
    // Two RAFs so the layout is committed and painted before we snapshot.
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(null))))
    return await htmlToImage.toPng(target, {
      width, height, pixelRatio: 2, backgroundColor: '#ffffff',
      skipFonts: true, cacheBust: true,
    })
  } finally {
    document.body.removeChild(host)
  }
}

/** Convert a `data:image/png;base64,...` URL into raw bytes for docx ImageRun. */
export function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}
