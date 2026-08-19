import type { AnswerSheetDefinition, AnswerSheetItemRegion, AnswerSheetPageLayout } from '../../types/answerSheet'
import type { OmrBubbleMeasurement, OmrImageBuffer, OmrItemRecognition, OmrMarkState } from '../../types/omr'

const FILL_THRESHOLD_PERCENT = 40 // >= 40% fill is considered marked
const EMPTY_THRESHOLD_PERCENT = 16 // <= 16% fill is considered blank
const MIN_CONTRAST_PERCENT = 18 // minimum contrast against local background

/**
 * Measures the photometric darkness and contrast of a single circular bubble on the rectified image.
 */
export function measureBubble(
  image: OmrImageBuffer,
  pageDims: { widthMm: number; heightMm: number },
  bubble: { id: string; label: string; centerMm: { xMm: number; yMm: number }; radiusMm: number },
): OmrBubbleMeasurement {
  const { width: imgW, height: imgH, data } = image
  const cx = (bubble.centerMm.xMm / pageDims.widthMm) * imgW
  const cy = (bubble.centerMm.yMm / pageDims.heightMm) * imgH
  const r = (bubble.radiusMm / pageDims.widthMm) * imgW

  // 1. Measure interior (inside radius * 0.8 to ignore the printed border stroke)
  const innerR = r * 0.8
  const innerR2 = innerR * innerR
  let innerDarknessSum = 0
  let innerPixelCount = 0

  const minX = Math.max(0, Math.floor(cx - innerR))
  const maxX = Math.min(imgW - 1, Math.ceil(cx + innerR))
  const minY = Math.max(0, Math.floor(cy - innerR))
  const maxY = Math.min(imgH - 1, Math.ceil(cy + innerR))

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dx = x - cx
      const dy = y - cy
      if (dx * dx + dy * dy <= innerR2) {
        const val = data[y * imgW + x] // 0 = black, 255 = white
        const darkness = 255 - val
        innerDarknessSum += darkness
        innerPixelCount++
      }
    }
  }

  const meanInnerDarkness = innerPixelCount > 0 ? innerDarknessSum / innerPixelCount : 0
  const fillPercentage = Math.round((meanInnerDarkness / 255) * 100)

  // 2. Measure local background paper darkness in the surrounding ring (radius * 1.3 to radius * 1.8)
  const bgInnerR = r * 1.3
  const bgOuterR = r * 1.8
  const bgInnerR2 = bgInnerR * bgInnerR
  const bgOuterR2 = bgOuterR * bgOuterR

  let bgDarknessSum = 0
  let bgPixelCount = 0

  const bgMinX = Math.max(0, Math.floor(cx - bgOuterR))
  const bgMaxX = Math.min(imgW - 1, Math.ceil(cx + bgOuterR))
  const bgMinY = Math.max(0, Math.floor(cy - bgOuterR))
  const bgMaxY = Math.min(imgH - 1, Math.ceil(cy + bgOuterR))

  for (let y = bgMinY; y <= bgMaxY; y++) {
    for (let x = bgMinX; x <= bgMaxX; x++) {
      const dx = x - cx
      const dy = y - cy
      const d2 = dx * dx + dy * dy
      if (d2 >= bgInnerR2 && d2 <= bgOuterR2) {
        const val = data[y * imgW + x]
        bgDarknessSum += 255 - val
        bgPixelCount++
      }
    }
  }

  const meanBgDarkness = bgPixelCount > 0 ? bgDarknessSum / bgPixelCount : 0
  const backgroundDarkness = Math.round((meanBgDarkness / 255) * 100)
  const contrast = Math.max(0, fillPercentage - backgroundDarkness)

  let state: OmrBubbleMeasurement['state'] = 'EMPTY'
  let isMarked = false

  if (fillPercentage >= FILL_THRESHOLD_PERCENT && contrast >= MIN_CONTRAST_PERCENT) {
    state = 'FILLED'
    isMarked = true
  } else if (fillPercentage > EMPTY_THRESHOLD_PERCENT || (contrast > 12 && fillPercentage > 20)) {
    state = 'UNCERTAIN'
    isMarked = false
  } else {
    state = 'EMPTY'
    isMarked = false
  }

  return {
    choiceId: bubble.id,
    label: bubble.label,
    centerMm: bubble.centerMm,
    centerNormalized: { x: bubble.centerMm.xMm / pageDims.widthMm, y: bubble.centerMm.yMm / pageDims.heightMm },
    radiusMm: bubble.radiusMm,
    fillPercentage,
    backgroundDarkness,
    contrast,
    state,
    isMarked,
  }
}

/**
 * Evaluates all question response regions across a rectified answer sheet image.
 */
export function detectMarksOnRectifiedSheet(
  image: OmrImageBuffer,
  sheet: AnswerSheetDefinition,
  pageIndex = 0,
): OmrItemRecognition[] {
  const page = sheet.pages[pageIndex] || sheet.pages[0]
  const pageDims = page.dimensionsMm

  return page.items.map((item) => evaluateItemRegion(image, pageDims, item))
}

function evaluateItemRegion(
  image: OmrImageBuffer,
  pageDims: { widthMm: number; heightMm: number },
  item: AnswerSheetItemRegion,
): OmrItemRecognition {
  if (!item.isMachineCheckable) {
    return {
      itemId: item.itemId,
      itemNumber: item.itemNumber,
      questionType: item.questionType,
      isMachineCheckable: false,
      state: 'EMPTY',
      selectedChoiceIds: [],
      selectedLabels: [],
      confidence: 1.0,
      needsReview: false,
      bubbles: [],
      boundsMm: item.boundsMm,
    }
  }

  // 1. Evaluate Multiple Choice
  if (item.questionType === 'multiple_choice') {
    const measurements = item.bubbles.map((b) => measureBubble(image, pageDims, b))
    const filled = measurements.filter((m) => m.state === 'FILLED')
    const uncertain = measurements.filter((m) => m.state === 'UNCERTAIN')

    let state: OmrMarkState = 'EMPTY'
    let selectedChoiceIds: string[] = []
    let selectedLabels: string[] = []
    let confidence = 1.0
    let needsReview = false
    let reviewReason: string | undefined

    if (filled.length === 1 && uncertain.length === 0) {
      // Clean single answer
      state = 'FILLED'
      selectedChoiceIds = [filled[0].choiceId]
      selectedLabels = [filled[0].label]
      confidence = Math.min(1.0, filled[0].fillPercentage / 80)
      needsReview = false
    } else if (filled.length > 1) {
      // Multiple marked
      state = 'MULTIPLE'
      selectedChoiceIds = filled.map((f) => f.choiceId)
      selectedLabels = filled.map((f) => f.label)
      confidence = 0.5
      needsReview = true
      reviewReason = `Multiple answers detected (${selectedLabels.join(', ')}). Please verify intended choice.`
    } else if (uncertain.length > 0) {
      // Ambiguous / faint / erased answer
      state = 'AMBIGUOUS'
      const top = [...uncertain].sort((a, b) => b.fillPercentage - a.fillPercentage)[0]
      selectedChoiceIds = [top.choiceId]
      selectedLabels = [top.label]
      confidence = 0.4
      needsReview = true
      reviewReason = `Faint or partially erased mark on choice ${top.label} (${top.fillPercentage}% fill). Review required.`
    } else {
      // Blank / omitted
      state = 'EMPTY'
      selectedChoiceIds = []
      selectedLabels = []
      confidence = 1.0
      needsReview = false
    }

    return {
      itemId: item.itemId,
      itemNumber: item.itemNumber,
      questionType: item.questionType,
      isMachineCheckable: true,
      state,
      selectedChoiceIds,
      selectedLabels,
      confidence,
      needsReview,
      reviewReason,
      bubbles: measurements,
      boundsMm: item.boundsMm,
    }
  }

  // 2. Evaluate True / False
  if (item.questionType === 'true_false') {
    const measurements = item.bubbles.map((b) => measureBubble(image, pageDims, b))
    const filled = measurements.filter((m) => m.state === 'FILLED')
    const uncertain = measurements.filter((m) => m.state === 'UNCERTAIN')

    let state: OmrMarkState = 'EMPTY'
    let trueFalseValue: boolean | undefined
    let selectedLabels: string[] = []
    let confidence = 1.0
    let needsReview = false
    let reviewReason: string | undefined

    if (filled.length === 1 && uncertain.length === 0) {
      state = 'FILLED'
      trueFalseValue = filled[0].label === 'T'
      selectedLabels = [filled[0].label]
      confidence = 0.95
    } else if (filled.length > 1) {
      state = 'MULTIPLE'
      selectedLabels = filled.map((f) => f.label)
      confidence = 0.5
      needsReview = true
      reviewReason = 'Both True and False were marked. Teacher review required.'
    } else if (uncertain.length > 0) {
      state = 'AMBIGUOUS'
      const top = uncertain[0]
      trueFalseValue = top.label === 'T'
      selectedLabels = [top.label]
      confidence = 0.45
      needsReview = true
      reviewReason = `Faint mark on ${top.label === 'T' ? 'True' : 'False'}. Review required.`
    }

    return {
      itemId: item.itemId,
      itemNumber: item.itemNumber,
      questionType: item.questionType,
      isMachineCheckable: true,
      state,
      selectedChoiceIds: filled.map((f) => f.choiceId),
      selectedLabels,
      trueFalseValue,
      confidence,
      needsReview,
      reviewReason,
      bubbles: measurements,
      boundsMm: item.boundsMm,
    }
  }

  // 3. Evaluate Multiple Select
  if (item.questionType === 'multiple_select') {
    const measurements = item.bubbles.map((b) => measureBubble(image, pageDims, b))
    const filled = measurements.filter((m) => m.state === 'FILLED')
    const uncertain = measurements.filter((m) => m.state === 'UNCERTAIN')

    const state: OmrMarkState = filled.length > 0 ? 'FILLED' : uncertain.length > 0 ? 'AMBIGUOUS' : 'EMPTY'
    const needsReview = uncertain.length > 0
    const reviewReason = uncertain.length > 0
      ? `Ambiguous marks on: ${uncertain.map((u) => u.label).join(', ')}`
      : undefined

    return {
      itemId: item.itemId,
      itemNumber: item.itemNumber,
      questionType: item.questionType,
      isMachineCheckable: true,
      state,
      selectedChoiceIds: filled.map((f) => f.choiceId),
      selectedLabels: filled.map((f) => f.label),
      confidence: needsReview ? 0.6 : 0.95,
      needsReview,
      reviewReason,
      bubbles: measurements,
      boundsMm: item.boundsMm,
    }
  }

  // 4. Evaluate Matching Type
  if (item.questionType === 'matching' && item.matchingPrompts) {
    const allBubbles: OmrBubbleMeasurement[] = []
    const matches: Record<string, string> = {}
    let hasUncertain = false
    let hasMultiple = false

    for (const promptRow of item.matchingPrompts) {
      const rowMeasurements = promptRow.bubbles.map((b) => measureBubble(image, pageDims, b))
      allBubbles.push(...rowMeasurements)

      const rowFilled = rowMeasurements.filter((m) => m.state === 'FILLED')
      const rowUncertain = rowMeasurements.filter((m) => m.state === 'UNCERTAIN')

      if (rowFilled.length === 1) {
        // Choice ID is encoded as "promptId:choiceId"
        const choiceId = rowFilled[0].choiceId.split(':')[1] || rowFilled[0].choiceId
        matches[promptRow.promptId] = choiceId
      } else if (rowFilled.length > 1) {
        hasMultiple = true
      }
      if (rowUncertain.length > 0) {
        hasUncertain = true
      }
    }

    const state: OmrMarkState = hasMultiple
      ? 'MULTIPLE'
      : hasUncertain
      ? 'AMBIGUOUS'
      : Object.keys(matches).length > 0
      ? 'FILLED'
      : 'EMPTY'

    const needsReview = hasMultiple || hasUncertain
    const reviewReason = hasMultiple
      ? 'Multiple matches marked for one or more prompts.'
      : hasUncertain
      ? 'Faint or uncertain mark in matching table.'
      : undefined

    return {
      itemId: item.itemId,
      itemNumber: item.itemNumber,
      questionType: item.questionType,
      isMachineCheckable: true,
      state,
      selectedChoiceIds: Object.values(matches),
      selectedLabels: [],
      matchingMatches: matches,
      confidence: needsReview ? 0.5 : 0.92,
      needsReview,
      reviewReason,
      bubbles: allBubbles,
      boundsMm: item.boundsMm,
    }
  }

  return {
    itemId: item.itemId,
    itemNumber: item.itemNumber,
    questionType: item.questionType,
    isMachineCheckable: false,
    state: 'EMPTY',
    selectedChoiceIds: [],
    selectedLabels: [],
    confidence: 1.0,
    needsReview: false,
    bubbles: [],
    boundsMm: item.boundsMm,
  }
}
