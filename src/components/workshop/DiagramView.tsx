'use client'

// Shared diagram surface used by BOTH the section editor and the Workshop
// Experience walkthrough. It renders a typed WorkshopDiagram to a clean SVG via
// renderWorkshopDiagramSvg (ONE representation, same as the PPTX rasterizer) and
// injects it. The SVG is app-built from structured data (NOT raw LLM output), so
// dangerouslySetInnerHTML is safe here. The intrinsic viewBox is preserved and the
// wrapper forces width:100% / height:auto so it scales responsively to its column.

import { useMemo } from 'react'
import type { WorkshopDiagram } from '@jlee-revtech/agent-core'
import { renderWorkshopDiagramSvg } from '@/lib/workshop/diagramSvg'

// Make the intrinsic-sized SVG fluid: strip fixed width/height attrs so the
// wrapper's CSS (width:100%, height:auto) drives layout while the viewBox keeps
// the aspect ratio. Also inject a preserveAspectRatio for safety.
function makeResponsive(svg: string): string {
  return svg
    .replace(/(<svg[^>]*?)\swidth="[^"]*"/, '$1')
    .replace(/(<svg[^>]*?)\sheight="[^"]*"/, '$1')
    .replace(/<svg /, '<svg preserveAspectRatio="xMidYMid meet" style="width:100%;height:auto;display:block" ')
}

export default function DiagramView({
  diagram,
  width,
  className,
}: {
  diagram: WorkshopDiagram
  // Intrinsic render width (px). The output is still responsive; this only sets
  // the coordinate space + how much wraps per row. Default suits a slide stage.
  width?: number
  className?: string
}) {
  const html = useMemo(() => {
    const { svg } = renderWorkshopDiagramSvg(diagram, { width })
    return makeResponsive(svg)
  }, [diagram, width])

  return (
    <div
      className={className}
      style={{ width: '100%', overflowX: 'auto' }}
      // eslint-disable-next-line react/no-danger -- app-built SVG from structured data, not LLM HTML
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

// Editor card wrapper: a titled, bordered, horizontally-scrollable container that
// matches the SectionEditor card styling. The diagram's own title/caption live
// INSIDE the SVG; this frame adds the surrounding chrome only.
export function DiagramCard({ diagram, width }: { diagram: WorkshopDiagram; width?: number }) {
  return (
    <div className="bg-white border border-border rounded-lg p-3">
      <DiagramView diagram={diagram} width={width} />
    </div>
  )
}
