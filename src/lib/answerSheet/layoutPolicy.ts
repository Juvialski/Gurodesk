import type { AnswerSheetDensity, AnswerSheetPaperSize } from '../../types/answerSheet'
import type { QuestionType } from '../../types/assessment'

export type AnswerSheetFitValidationResult = {
  valid: boolean
  reason?: string
  maxRecommendedItems?: number
  recommendedDensity?: AnswerSheetDensity
}

export const PAPER_PRINTABLE_HEIGHT_MM: Record<AnswerSheetPaperSize, number> = {
  a4: 297,
  letter: 279.4,
  legal: 355.6,
  folio: 330.2,
}

/**
 * Resolves the optimal or requested slips per page.
 * Prevents circular dependencies between layout engine and document exporters.
 */
export function resolveSlipsPerPage(
  itemCount: number,
  density: AnswerSheetDensity = 'auto',
  paperSize: AnswerSheetPaperSize = 'a4',
): number {
  if (density === '1-up') return 1
  if (density === '2-up') return 2
  if (density === '3-up') return 3
  if (density === '4-up') return 4

  // Auto mode: select densest safe layout based on item count and paper height
  const heightMm = PAPER_PRINTABLE_HEIGHT_MM[paperSize] || 297

  // If paper is taller (Legal/Folio), slightly more capacity per slip
  const heightFactor = heightMm / 297

  if (itemCount <= Math.round(12 * heightFactor)) return 3
  if (itemCount <= Math.round(28 * heightFactor)) return 2
  return 1
}

/**
 * Validates whether the item count and density can physically fit on the requested paper size.
 */
export function validateAnswerSheetFit(
  itemCount: number,
  density: AnswerSheetDensity,
  paperSize: AnswerSheetPaperSize = 'a4',
  questionTypes: QuestionType[] = [],
): AnswerSheetFitValidationResult {
  const slips = resolveSlipsPerPage(itemCount, density, paperSize)
  const totalPaperH = PAPER_PRINTABLE_HEIGHT_MM[paperSize] || 297
  const slipH = totalPaperH / slips

  // Dedicated margins and header:
  // Margin (6mm * 2) + Fiducials (5.5mm * 2) + Header/Learner (14mm) + Footer/Safety (6mm) = ~37mm
  const reservedHeaderFooterMm = 37
  const availableContentHeightMm = slipH - reservedHeaderFooterMm

  if (availableContentHeightMm < 15) {
    return {
      valid: false,
      reason: `Slip height (${slipH.toFixed(1)}mm for ${slips}-up on ${paperSize.toUpperCase()}) is too small to fit the fiducials and answer grid.`,
      recommendedDensity: '1-up',
    }
  }

  // Calculate required vertical height for items
  // Columns: up to 5 columns on full sheet, 3-4 on multi-up
  const maxColumns = slips >= 3 ? 3 : slips === 2 ? 4 : 5
  const itemsPerColumn = Math.ceil(itemCount / maxColumns)
  const minRowHeightMm = 4.4
  const requiredGridHeightMm = itemsPerColumn * minRowHeightMm

  if (requiredGridHeightMm > availableContentHeightMm) {
    const maxItemsPossible = Math.floor(availableContentHeightMm / minRowHeightMm) * maxColumns
    const recDensity: AnswerSheetDensity = slips > 2 ? '2-up' : '1-up'
    return {
      valid: false,
      reason: `Cannot fit ${itemCount} items in a ${slips}-up layout on ${paperSize.toUpperCase()} paper (maximum ~${maxItemsPossible} items).`,
      maxRecommendedItems: maxItemsPossible,
      recommendedDensity: recDensity,
    }
  }

  return { valid: true }
}
