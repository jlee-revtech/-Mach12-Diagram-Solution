import { NextRequest } from 'next/server'
import type { SectionContent, TrainingSectionContent, WorkshopScreenshot } from '@jlee-revtech/agent-core'
import { serverModelDb } from '@/lib/workshop/server'

// 057: capture a screenshot of a tool/technology screen for a training module.
// The training agent proposes screenshot slots (hint + optional url); this route
// drives Playwright to capture the URL, uploads the PNG to the public
// `workshop-screenshots` Supabase Storage bucket, patches the module's screenshot
// slot inside the section content JSON, and returns the updated content so the
// prep view renders the image immediately.
//
// Runtime: Node (Playwright needs a real Chromium). On Vercel/Lambda it uses
// @sparticuz/chromium; locally it uses an installed Chrome (channel 'chrome' or
// CHROME_EXECUTABLE_PATH). Gated systems behind a VPN may be unreachable from a
// serverless function; the facilitator can also attach an image via the URL of an
// already-hosted screenshot.

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

const BUCKET = 'workshop-screenshots'
const onServerless = !!process.env.AWS_LAMBDA_FUNCTION_NAME || !!process.env.VERCEL

type ContentRow = { content: SectionContent | null; section_kind: string | null; version: number | null }

export async function POST(req: NextRequest) {
  try {
    const { workshopId, orgId, agendaItemId, moduleId, url } = (await req.json()) as {
      workshopId?: string; orgId?: string; agendaItemId?: string; moduleId?: string; url?: string
    }
    if (!orgId || !workshopId || !agendaItemId || !moduleId || !url) {
      return json({ error: 'orgId, workshopId, agendaItemId, moduleId, and url are required' }, 400)
    }
    let target: URL
    try { target = new URL(url) } catch { return json({ error: 'Invalid URL' }, 400) }
    if (target.protocol !== 'http:' && target.protocol !== 'https:') {
      return json({ error: 'Only http(s) URLs can be captured' }, 400)
    }

    const db = serverModelDb()

    // Org-scope the workshop.
    const { data: ws } = await db
      .from('workshops')
      .select('id')
      .eq('id', workshopId)
      .eq('organization_id', orgId)
      .maybeSingle()
    if (!ws) return json({ error: 'Workshop not found for this organization' }, 404)

    // Load the training section content row (must belong to the workshop).
    const { data: row } = await db
      .from('workshop_agenda_content')
      .select('content, section_kind, version')
      .eq('agenda_item_id', agendaItemId)
      .eq('workshop_id', workshopId)
      .maybeSingle<ContentRow>()
    if (!row?.content) return json({ error: 'Section content not found' }, 404)
    if (row.section_kind !== 'training' || (row.content as SectionContent).kind !== 'training') {
      return json({ error: 'Screenshots are only supported on training sections' }, 400)
    }
    const content = row.content as TrainingSectionContent
    const mod = (content.toolTraining || []).find((m) => m.id === moduleId)
    if (!mod) return json({ error: 'Module not found in this section' }, 404)

    // ─── Capture with Playwright ─────────────────────────────────
    let png: Buffer
    let dims = { width: 1280, height: 800 }
    try {
      const shot = await captureScreenshot(target.toString())
      png = shot.png
      dims = shot.dims
    } catch (e) {
      return json({ error: `Capture failed: ${e instanceof Error ? e.message : 'unknown error'}` }, 502)
    }

    // ─── Upload to Storage (public bucket) ───────────────────────
    const safeMod = moduleId.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 60)
    const path = `${workshopId}/${agendaItemId}/${safeMod}-${Date.now()}.png`
    const { error: upErr } = await db.storage.from(BUCKET).upload(path, png, {
      contentType: 'image/png',
      upsert: true,
    })
    if (upErr) return json({ error: `Upload failed: ${upErr.message}` }, 502)
    const { data: pub } = db.storage.from(BUCKET).getPublicUrl(path)
    const imageUrl = pub.publicUrl

    // ─── Patch the module's screenshot slot ──────────────────────
    const prior: WorkshopScreenshot | undefined = mod.screenshot
    const updatedShot: WorkshopScreenshot = {
      hint: prior?.hint || mod.title,
      ...(prior?.system || mod.system ? { system: prior?.system || mod.system } : {}),
      url: target.toString(),
      ...(prior?.caption ? { caption: prior.caption } : {}),
      status: 'captured',
      imageUrl,
      width: dims.width,
      height: dims.height,
      capturedAt: new Date().toISOString(),
    }
    const updatedContent: TrainingSectionContent = {
      ...content,
      toolTraining: (content.toolTraining || []).map((m) => (m.id === moduleId ? { ...m, screenshot: updatedShot } : m)),
    }

    const nextVersion = (row.version ?? 1) + 1
    const { error: updErr } = await db
      .from('workshop_agenda_content')
      .update({ content: updatedContent, version: nextVersion, updated_at: new Date().toISOString() })
      .eq('agenda_item_id', agendaItemId)
      .eq('workshop_id', workshopId)
    if (updErr) return json({ error: `Persist failed: ${updErr.message}` }, 502)

    return json({ content: updatedContent, imageUrl, version: nextVersion }, 200)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'bad request' }, 400)
  }
}

// Launch Chromium (serverless: @sparticuz/chromium; local: installed Chrome),
// navigate, and capture a viewport PNG. Always closes the browser.
async function captureScreenshot(url: string): Promise<{ png: Buffer; dims: { width: number; height: number } }> {
  const { chromium } = await import('playwright-core')
  const width = 1280
  const height = 800

  let launchOpts: Parameters<typeof chromium.launch>[0]
  if (onServerless) {
    const chromiumPkg = (await import('@sparticuz/chromium')).default
    launchOpts = {
      args: chromiumPkg.args,
      executablePath: await chromiumPkg.executablePath(),
      headless: true,
    }
  } else {
    // Local dev: prefer an explicit path, else the installed Chrome channel.
    const executablePath = process.env.CHROME_EXECUTABLE_PATH
    launchOpts = executablePath ? { executablePath, headless: true } : { channel: 'chrome', headless: true }
  }

  const browser = await chromium.launch(launchOpts)
  try {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 })
    await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 }).catch(async () => {
      // networkidle can hang on live apps; fall back to DOMContentLoaded.
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 })
    })
    // Small settle for late paints.
    await page.waitForTimeout(1200)
    const buf = await page.screenshot({ type: 'png' })
    return { png: Buffer.from(buf), dims: { width, height } }
  } finally {
    await browser.close()
  }
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}
