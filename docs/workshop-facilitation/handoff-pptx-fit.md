# Hand-off: PPTX facilitation deck fit fixes

Scope: app-only bug fix (no agent-core change, no route/DB change). Fixes two
PowerPoint export defects in the workshop facilitation deck.

## 1. Defects

**Defect 1 - diagrams clipped off the right edge.** The SVG renderers took a fixed
`width` (caller passes 1000, clamped to <= 1100 in the public entry). When a band's
node row (`renderLayers`), a row of flow boxes (`renderFlow`), or a wide table
(`renderMatrix`) was wider than the available inner width, the layout advanced x past
the canvas edge and the rightmost content rendered OUTSIDE the SVG and got clipped.

**Defect 2 - PPTX text ran off the slide AND was dropped on slides with a diagram.**
(a) Text boxes had no shrink-to-fit, so long bullets/blocks/bodies overflowed the slide
or their card. (b) The per-slide loop checked `if (slide.diagram)` FIRST, rendered only
the diagram, and `continue`d, so the `blocks`/`bullets` on decision, options, and
evaluation slides were dropped entirely. Now that every key-decision slide carries a
required diagram, all decision text was vanishing.

## 2. Renderer fix (dynamic width) - `src/lib/workshop/diagramSvg.ts`

All three overflow-prone renderers now MEASURE natural content width first, then set the
final SVG width to `Math.min(1600, Math.max(requestedWidth, naturalWidth))`, recompute
the internal available width / column widths from that final width, lay out, and pass the
final width to `shell(...)`. Elbow routing, palette, and wrapping are unchanged.

- `renderLayers`: measures every band's node widths up front (node width logic
  unchanged), computes `maxRowW = max over bands of (sum(nodeW) + NODE_GAP*(count-1))`,
  `naturalWidth = padX*2 + LABEL_GUTTER + maxRowW`. Recomputes `availW`/`bandX`; nodes
  still centered per band; band backgrounds + `shell` use the grown width.
- `renderFlow`: measures per-row grouping widths (`maxRowW`), `naturalWidth = padX*2 +
  maxRowW`, recomputes `availW`; `shell` uses the grown width.
- `renderMatrix`: uses a comfortable `desiredDataColW = 150`, `naturalWidth = padX*2 +
  labelColW + desiredDataColW*nDataCols`; then `dataColW` fills the final available
  width so the table is never squeezed below a readable minimum; `shell` uses the grown
  width. (Removed the pre-existing unused `totalCols` local.)

The wider SVG is fine: the PPTX exporter contain-fits it and the HTML view scrolls.

## 3. Export fix (shrink-fit + text-and-diagram layout) - `src/lib/workshop/export.ts`

`exportFacilitationPptx`:

1. Every variable-length `addText` now passes `fit: 'shrink'` (pptxgenjs 4.x
   `TextPropsOptions.fit`): context body, plain bullet lists, card body, card bullets,
   pros/cons lists, and the title-slide heading/subheading. This alone stops overflow.
2. The per-slide loop was restructured so a slide with BOTH text and a diagram shows
   BOTH. Computes `hasText` (any block body/bullets/pros/cons, or non-title bullets) and
   `hasDiagram`. `title` slide unchanged. Otherwise render the heading, then:
   - `hasDiagram && hasText`: rasterize the SVG once (`renderWorkshopDiagramSvg(..,
     {width:1000})` -> `svgToPngDataUrl`), compute `aspect`. If `aspect >= 2.0` (wide,
     e.g. layers): a shrink-fit TEXT BAND on top (bounded ~2.6in) and the diagram
     contain-fit full-width below. Else (squarer): TEXT in a ~6.6in LEFT column and the
     diagram contain-fit in the RIGHT column.
   - `hasDiagram && !hasText`: diagram contain-fit full-width below the heading.
   - `!hasDiagram`: text full-width below the heading.
3. Two helpers: `renderTextArea(s, slide, x, y, w, maxY)` renders context body / plain
   bullets / single-column stacked block cards (more robust than the old 2-column grid),
   all shrink-fit and bounded to `maxY = 7.15`; `placeDiagram(...)` contain-fits an image
   (scale to fit preserving aspect, centered, never exceeding the box). Pros/cons keep
   their two-sub-column layout WITHIN a card. The recommendation block stays highlighted
   (`REC_FILL`/`REC_BORDER`). `facilitatorNotes` still go to `addNotes`.
4. `svgToPngDataUrl` still returns '' on failure and the image is skipped (never throws).

The old 2-column `renderBlocks` was replaced by the single-column stacked cards inside
`renderTextArea`. Recap deck (`exportRecapPptx`) got `fit:'shrink'` on its bullet + summary
text only (low-risk nice-to-have); `exportRecapDocx` untouched.

## 4. Verification

- `npm run build` passes clean (TypeScript + Next build; all 27 routes generated).
- No `any` types; `WorkshopSlide` / `WorkshopSlideBlock` / `WorkshopDiagram` imported from
  `@jlee-revtech/agent-core`.
- NOT opened in PowerPoint (headless build environment). Layout bounds are enforced in
  code (`MAX_Y = 7.15` on the 7.5in slide; contain-fit never exceeds its box; renderer
  width capped at 1600px and contain-fit into the slide area).

## 5. Git

- Repo: `jlee-revtech/-Mach12-Diagram-Solution`.
- Version bumped 0.3.132 -> 0.3.133 (`package.json` + `src/lib/version.ts`).
- Staged only: `src/lib/workshop/diagramSvg.ts`, `src/lib/workshop/export.ts`,
  `package.json`, `src/lib/version.ts`, `docs/workshop-facilitation/handoff-pptx-fit.md`.
- Commit + push status recorded below by the committing step.
