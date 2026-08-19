import type { AnswerSheetDefinition, AnswerSheetPageLayout } from '../../src/types/answerSheet'
import type { OmrImageBuffer } from '../../src/types/omr'

export type SyntheticMarkOption = {
  itemNumber: number
  /** Label to mark ('A', 'B', 'C', 'D', 'T', 'F') */
  markedLabels?: string[]
  /** Darkness (0 to 1, where 1 is solid black, 0.3 is faint pencil/erasure) */
  darkness?: number
  /** If true, marks two options (double mark) */
  multipleLabels?: string[]
}

export type SyntheticSheetOptions = {
  width?: number
  height?: number
  marks?: Record<number, string | string[]>
  markDarkness?: Record<number, number>
  /** Perspective tilt factor */
  perspectiveTilt?: { x: number; y: number }
  /** Add linear shadow across page */
  addShadowGradient?: boolean
  /** Omit one or more corner markers */
  omitTopLeftMarker?: boolean
  omitBottomRightMarker?: boolean
}

/**
 * Creates a synthetic raster image buffer of a Smart Answer Sheet for deterministic testing.
 */
export function createSyntheticAnswerSheetImage(
  sheet: AnswerSheetDefinition,
  options: SyntheticSheetOptions = {},
): OmrImageBuffer {
  const W = options.width ?? 1050
  const H = options.height ?? 1485
  const data = new Uint8Array(W * H)
  data.fill(255) // White paper background

  const page = sheet.pages[0]
  const pageDims = page.dimensionsMm
  const scaleX = W / pageDims.widthMm
  const scaleY = H / pageDims.heightMm

  // 1. Draw Corner Fiducials
  const drawFiducial = (f: typeof page.fiducialMarkers.topLeft, omit = false) => {
    if (omit) return
    const cx = f.centerMm.xMm * scaleX
    const cy = f.centerMm.yMm * scaleY
    const size = f.sizeMm * scaleX
    const half = size / 2

    const x0 = Math.round(cx - half)
    const y0 = Math.round(cy - half)
    const x1 = Math.round(cx + half)
    const y1 = Math.round(cy + half)

    // Outer black square
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (x >= 0 && x < W && y >= 0 && y < H) {
          data[y * W + x] = 10
        }
      }
    }

    // Inner white square
    const innerSize = size * 0.35
    const innerHalf = innerSize / 2
    const ix0 = Math.round(cx - innerHalf)
    const iy0 = Math.round(cy - innerHalf)
    const ix1 = Math.round(cx + innerHalf)
    const iy1 = Math.round(cy + innerHalf)

    for (let y = iy0; y <= iy1; y++) {
      for (let x = ix0; x <= ix1; x++) {
        if (x >= 0 && x < W && y >= 0 && y < H) {
          data[y * W + x] = 250
        }
      }
    }
  }

  drawFiducial(page.fiducialMarkers.topLeft, options.omitTopLeftMarker)
  drawFiducial(page.fiducialMarkers.topRight)
  drawFiducial(page.fiducialMarkers.bottomLeft)
  drawFiducial(page.fiducialMarkers.bottomRight, options.omitBottomRightMarker)

  // 2. Draw Bubbles and Student Marks
  const marksMap = options.marks ?? {}
  const darknessMap = options.markDarkness ?? {}

  for (const item of page.items) {
    const itemMarksRaw = marksMap[item.itemNumber]
    const itemMarks: string[] = Array.isArray(itemMarksRaw)
      ? itemMarksRaw
      : itemMarksRaw ? [itemMarksRaw] : []
    const itemDarkness = darknessMap[item.itemNumber] ?? 0.9

    for (const b of item.bubbles) {
      const cx = b.centerMm.xMm * scaleX
      const cy = b.centerMm.yMm * scaleY
      const r = b.radiusMm * scaleX
      const r2 = r * r

      const isMarked = itemMarks.includes(b.label) || itemMarks.includes(b.id)

      const bx0 = Math.max(0, Math.floor(cx - r - 2))
      const bx1 = Math.min(W - 1, Math.ceil(cx + r + 2))
      const by0 = Math.max(0, Math.floor(cy - r - 2))
      const by1 = Math.min(H - 1, Math.ceil(cy + r + 2))

      for (let y = by0; y <= by1; y++) {
        for (let x = bx0; x <= bx1; x++) {
          const dx = x - cx
          const dy = y - cy
          const dist2 = dx * dx + dy * dy

          if (isMarked && dist2 <= (r * 0.8) ** 2) {
            // Filled mark
            const darknessVal = Math.round(255 * (1 - itemDarkness))
            data[y * W + x] = Math.min(data[y * W + x], darknessVal)
          } else if (dist2 >= (r * 0.9) ** 2 && dist2 <= (r * 1.05) ** 2) {
            // Bubble circular border
            data[y * W + x] = Math.min(data[y * W + x], 50)
          }
        }
      }
    }
  }

  // 3. Add Optional Shadow Gradient
  if (options.addShadowGradient) {
    for (let y = 0; y < H; y++) {
      const factor = (y / H) * 0.4 // Darker towards bottom
      for (let x = 0; x < W; x++) {
        const cur = data[y * W + x]
        data[y * W + x] = Math.max(0, Math.round(cur * (1 - factor)))
      }
    }
  }

  return {
    width: W,
    height: H,
    data,
  }
}
